/**
 * Formal Pipeline Guard
 *
 * Single source of truth for the rule:
 *   "Only job_submissions with workflow_type = 'client_invitation' may participate
 *    in the hiring pipeline (interviews, offers, contracts, messaging, name-reveal)."
 *
 * Every enforcement point in the codebase should import constants or helpers from
 * here rather than hand-writing the predicate. Adding a new pipeline route means
 * calling loadClientFormalSubmission / loadAdminFormalSubmission or embedding
 * FORMAL_PIPELINE_PREDICATE — the guard is inherited automatically.
 *
 * Usage patterns:
 *   1. Simple ownership check: call loadClientFormalSubmission / loadAdminFormalSubmission.
 *   2. Complex JOIN query: embed `js.${FORMAL_PIPELINE_PREDICATE}` in the WHERE clause.
 *   3. Name-reveal EXISTS: call nameRevealExistsSQL(clientParam, talentParam).
 *   4. Status IN-list: embed FORMAL_PIPELINE_ACTIVE_STATUS_SQL.
 */

import { query } from "../db.js";

// ── Core predicate ─────────────────────────────────────────────────────────────

/**
 * SQL predicate fragment that restricts any query to formally-invited submissions
 * only. Embed this in WHERE / JOIN ON clauses; prefix with a table alias when the
 * query has JOINs (e.g. `AND js.${FORMAL_PIPELINE_PREDICATE}`).
 */
export const FORMAL_PIPELINE_PREDICATE = `workflow_type = 'client_invitation'` as const;

// ── Name-reveal / messaging statuses ──────────────────────────────────────────

/**
 * Ordered list of submission statuses that unlock name-reveal and active messaging
 * in a formal client_invitation pipeline. Identity is hidden for earlier statuses
 * (e.g. 'invited') so a rejected invitation never exposes the candidate's name.
 */
export const FORMAL_PIPELINE_ACTIVE_STATUSES = [
  "new",
  "under_review",
  "reviewed",
  "interviewing",
  "offer_extended",
  "offer_accepted",
  "contract_sent",
  "hired",
] as const;

export type FormalPipelineActiveStatus = (typeof FORMAL_PIPELINE_ACTIVE_STATUSES)[number];

/**
 * SQL IN-list literal for FORMAL_PIPELINE_ACTIVE_STATUSES, ready to embed inside
 * a parenthesised IN expression:
 *   `js.status IN (${FORMAL_PIPELINE_ACTIVE_STATUS_SQL})`
 */
export const FORMAL_PIPELINE_ACTIVE_STATUS_SQL = FORMAL_PIPELINE_ACTIVE_STATUSES.map(
  (s) => `'${s}'`,
).join(", ");

/**
 * Build the name-reveal EXISTS sub-clause for a participant pair.
 * The caller supplies SQL placeholders or unaliased column references for the two
 * user IDs.
 *
 * @example
 *   // Inside a larger SELECT list:
 *   `${nameRevealExistsSQL("$2", "u.id")} AS name_revealed`
 */
export function nameRevealExistsSQL(clientParam: string, talentParam: string): string {
  return `EXISTS (
    SELECT 1 FROM job_submissions js
     WHERE ((js.client_id = ${clientParam} AND js.talent_id = ${talentParam})
         OR (js.client_id = ${talentParam} AND js.talent_id = ${clientParam}))
       AND js.${FORMAL_PIPELINE_PREDICATE}
       AND js.status IN (${FORMAL_PIPELINE_ACTIVE_STATUS_SQL})
  )`;
}

// ── Result types ───────────────────────────────────────────────────────────────

export interface FormalSubmissionCore {
  id: string;
  status: string;
  workflow_type: string;
  client_id: string;
  talent_id: string | null;
  email: string | null;
  job_id: string;
  // Extra columns requested via `extraCols` are present at runtime but not
  // declared here; callers should type-assert or use the generic overload.
  [key: string]: any;
}

export type GuardOk<T> = { ok: true; row: T };
export type GuardErr = { ok: false; status: 404 | 403; error: string };
export type GuardResult<T> = GuardOk<T> | GuardErr;

// ── Structural DB interface ────────────────────────────────────────────────────
// Accepts both pg.PoolClient and @neondatabase/serverless PoolClient without
// binding to either package's concrete type. Any object with a compatible
// .query(sql, params) method works — pool clients, transaction clients, etc.

type AnyDbClient = {
  query(sql: string, params: any[]): Promise<{ rows: any[] }>;
};

function resolveDb(txClient?: AnyDbClient): AnyDbClient {
  return txClient ?? { query: (sql, params) => query(sql, params) };
}

// ── Client-ownership guard ─────────────────────────────────────────────────────

export interface LoadClientFormalOptions {
  /**
   * Comma-prefixed extra column expressions appended to the SELECT list.
   * Columns from joined tables are available when joinClause is also provided.
   * @example ", j.title AS job_title"
   */
  extraCols?: string;
  /**
   * Raw SQL JOIN clause(s) appended after `FROM job_submissions js`, before WHERE.
   * Use to join additional tables whose columns you need in extraCols.
   * @example "JOIN jobs j ON j.id = js.job_id"
   */
  joinClause?: string;
  /** Append FOR UPDATE OF js to lock the row inside a transaction (default false). */
  forUpdate?: boolean;
  /** Active transaction client. Omit to use the shared pool. */
  txClient?: AnyDbClient;
}

/**
 * Load a job_submissions row that belongs to a specific client AND carries
 * workflow_type = 'client_invitation'. Returns 404 if not found, not owned by
 * the client, or is a silent shortlist / organic application row.
 *
 * The returned `row` always includes the FormalSubmissionCore columns plus
 * anything requested via `extraCols`.
 */
export async function loadClientFormalSubmission(
  submissionId: string,
  clientId: string,
  options?: LoadClientFormalOptions,
): Promise<GuardResult<FormalSubmissionCore & Record<string, unknown>>> {
  const {
    extraCols = "",
    joinClause = "",
    forUpdate = false,
    txClient,
  } = options ?? {};
  const db = resolveDb(txClient);
  const lock = forUpdate ? " FOR UPDATE OF js" : "";

  const result = await db.query(
    `SELECT js.id, js.status, js.workflow_type, js.client_id,
            js.talent_id, js.email, js.job_id${extraCols}
       FROM job_submissions js
       ${joinClause}
      WHERE js.id = $1
        AND js.client_id = $2
        AND js.${FORMAL_PIPELINE_PREDICATE}${lock}`,
    [submissionId, clientId],
  );

  if (!result.rows.length) {
    return { ok: false, status: 404, error: "Submission not found or forbidden" };
  }
  return { ok: true, row: result.rows[0] };
}

// ── Admin guard (no ownership filter) ─────────────────────────────────────────

export interface LoadAdminFormalOptions {
  extraCols?: string;
  joinClause?: string;
  forUpdate?: boolean;
  txClient?: AnyDbClient;
}

/**
 * Load a job_submissions row for admin access, enforcing formal pipeline membership
 * but without any client-ownership filter. Admins may access any client's formal
 * invitation; they still cannot reach shortlist or organic application rows through
 * pipeline endpoints.
 */
export async function loadAdminFormalSubmission(
  submissionId: string,
  options?: LoadAdminFormalOptions,
): Promise<GuardResult<FormalSubmissionCore & Record<string, unknown>>> {
  const {
    extraCols = "",
    joinClause = "",
    forUpdate = false,
    txClient,
  } = options ?? {};
  const db = resolveDb(txClient);
  const lock = forUpdate ? " FOR UPDATE OF js" : "";

  const result = await db.query(
    `SELECT js.id, js.status, js.workflow_type, js.client_id,
            js.talent_id, js.email, js.job_id${extraCols}
       FROM job_submissions js
       ${joinClause}
      WHERE js.id = $1
        AND js.${FORMAL_PIPELINE_PREDICATE}${lock}`,
    [submissionId],
  );

  if (!result.rows.length) {
    return { ok: false, status: 404, error: "Submission not found or forbidden" };
  }
  return { ok: true, row: result.rows[0] };
}
