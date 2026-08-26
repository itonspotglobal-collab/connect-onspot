import type { Express, Request, Response, NextFunction } from "express";
import sanitizeHtml from "sanitize-html";

// ── Profile rich-text sanitizer (server-side) ─────────────────────────────────
// Mirrors the client-side DOMPurify allowlist in ProfileRichTextRenderer.tsx.
// Applied to summary and moreAboutMe before persistence.
const PROFILE_ALLOWED_TAGS = [
  "p", "br", "h2", "h3", "strong", "em",
  "ul", "ol", "li", "blockquote", "a",
];

function sanitizeProfileHtml(input: string | null | undefined): string | null {
  if (!input || !input.trim()) return null;
  const clean = sanitizeHtml(input, {
    allowedTags: PROFILE_ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "rel", "target"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      // Force safe rel on every anchor regardless of what the client sent
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: "noopener noreferrer",
          ...(attribs.href?.startsWith("http") ? { target: "_blank" } : {}),
        },
      }),
    },
  });
  return clean.trim() || null;
}
import { registerCandidateMediaRoutes } from "./routes/candidateMedia.js";
import { parsePagination, pageSlice } from "./lib/paginate";
import { escHtml } from "./lib/escHtml";
import { inferCategory } from "./lib/searchScaffold";
import {
  normalizeInterviewTimeZone,
  normalizeInterviewTimes,
  parseInterviewTimestamp,
} from "./lib/interviewTime";
import { sanitizeSearchCandidate, sanitizeFullProfileForClient } from "./lib/clientSearchSanitize";
import { maskClientTalentName } from "../shared/talentName";
import { containsPii } from "./lib/piiPatterns";
import fs from "fs";
import path from "path";
import { createServer, type Server } from "http";
import * as Sentry from "@sentry/node";
import { storage, type CreateUserData } from "./storage";
import { isAuthenticated } from "./replitAuth";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  validateEmail,
} from "./auth-utils";
import { ghlService } from "./services/ghlService";
import { sendMessageToAssistant, streamMessageToAssistant, streamWithAssistant } from "./services/openaiService";
import { analyzeResumeWithVanessa } from "./services/vanessaResumeAnalyzer";
import { ingestKnowledgeFiles, runLearningLoop } from "./services/learningLoop";
import * as dbManager from "./services/db_manager";
import {
  ContractError,
  createHiringContract,
  updateHiringContract,
  voidHiringContract,
} from "./services/hiringContractService";
import {
  loadClientFormalSubmission,
  FORMAL_PIPELINE_PREDICATE,
  SHORTLIST_EXCLUSION_PREDICATE,
  FORMAL_PIPELINE_ACTIVE_STATUS_SQL,
  nameRevealExistsSQL,
} from "./services/formalPipelineGuard.js";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import multer from "multer";
import Papa from "papaparse";
import jwt from "jsonwebtoken";
import { query, db, pool, getClient } from "./db.ts";
import { and, eq, desc, sql as sqlOp } from "drizzle-orm";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";
import { setObjectAclPolicy } from "./objectAcl";
import { v4 as uuidv4 } from "uuid";
import { randomUUID, randomBytes, createHash } from "crypto";
import {
  notifyClientOfJobApplication,
  notifyTalentOfApplicationStatusChange,
  resolveTalentPortalNotificationRecipient,
} from "./services/applicationNotificationService";
import { transitionJobApprovalStatus } from "./services/jobApprovalNotificationService";
import {
  sendInterviewConfirmedEmail,
  sendInterviewProposalEmail,
} from "./services/interviewEmailService.js";
import {
  insertUserSchema,
  insertProfileSchema,
  insertSkillSchema,
  insertUserSkillSchema,
  profiles,
  insertJobSchema,
  type InsertJob,
  insertJobSkillSchema,
  insertMessageThreadSchema,
  insertMessageSchema,
  insertReviewSchema,
  insertPortfolioItemSchema,
  insertCertificationSchema,
  insertNotificationSchema,
  insertLeadIntakeSchema,
  csvTalentRowSchema,
  csvBulkImportSchema,
  csvImportResultSchema,
  csvTemplateSchema,
  waitlist,
  users as usersTable,
  clientProfiles,
  insertClientProfileSchema,
  inquiries as inquiriesTable,
  candidates as candidatesTable,
} from "@shared/schema";
import {
  computeDepositAmount,
  computePeriodAmounts,
  computeCureDeadline,
  computeReplenishmentDeadline,
  type EngagementType,
} from "./lib/billing.js";
import { z } from "zod";

// Organization invitations remain actionable for 30 days. Expiration is a
// terminal status (distinct from declined/revoked) so owners can resend to
// the same address without revoking or deleting invitation history.
export const ORGANIZATION_INVITATION_EXPIRY_DAYS = 30;

/**
 * Canonical engagement type values shared across all job-write routes.
 * The DB constraint mirrors this list; keeping one source of truth here
 * prevents route-level and constraint-level drift from drifting apart again.
 */
export const CANONICAL_ENGAGEMENT_TYPES = ["Lite", "Standard"] as const;

/**
 * Returns a 400-ready error object when `value` is supplied but not canonical,
 * or null when the value is absent (null/undefined/"") or already canonical.
 *
 * Use this before any INSERT/UPDATE so invalid values never reach the database
 * and callers receive a clear 400 instead of an opaque 500.
 */
export function validateEngagementType(
  value: string | null | undefined,
): { error: string; message: string } | null {
  if (!value) return null; // absent / null / "" — allowed (nullable column)
  if ((CANONICAL_ENGAGEMENT_TYPES as readonly string[]).includes(value)) return null;
  return {
    error: "Invalid engagement type",
    message: `engagementType must be one of: ${CANONICAL_ENGAGEMENT_TYPES.join(", ")}`,
  };
}

const JOB_COMPENSATION_DISPLAY_TYPES = ["range", "starting_from", "negotiable"] as const;
const JOB_SKILL_EXPERIENCE_VALUES = ["any", "1", "2", "3", "5"] as const;

/**
 * Validates the structured metadata added to the shared Admin / Client job form.
 * Fields are optional here for legacy API compatibility; the current form enforces
 * its required fields before submit.
 */
export function validateJobFormMetadata(
  value: Record<string, unknown>,
): { error: string; message: string } | null {
  if (
    value.compensationDisplayType !== undefined &&
    !JOB_COMPENSATION_DISPLAY_TYPES.includes(value.compensationDisplayType as never)
  ) {
    return {
      error: "Invalid compensation display type",
      message: "compensationDisplayType must be range, starting_from, or negotiable.",
    };
  }

  if (value.requiredSkills !== undefined) {
    if (!Array.isArray(value.requiredSkills) || value.requiredSkills.some((skill) =>
      !skill ||
      typeof skill !== "object" ||
      typeof (skill as any).name !== "string" ||
      !(skill as any).name.trim() ||
      !JOB_SKILL_EXPERIENCE_VALUES.includes((skill as any).years),
    )) {
      return {
        error: "Invalid required skills",
        message: "requiredSkills must contain skill names with a supported experience threshold.",
      };
    }
  }

  return null;
}

// Permanently remove organizations whose deletion due date has passed.
//
// Isolation guarantee (confirmed by schema audit and test coverage):
//   • Only `organization_members` and `organization_invitations` rows whose
//     `organization_id` matches the deleted org are removed by CASCADE.  Both
//     columns are NOT NULL, so they can only reference the org being deleted —
//     memberships a user holds in *other* organizations are completely unaffected.
//   • `users`, `client_profiles`, and all other tables have no FK reference to
//     `organizations.id`, so no cross-org or cross-user data is touched.
//   • A user who is both the owner of the due organization and a member of
//     another organization retains their second-org membership and full account
//     access after cleanup runs.
//
// This function is restart-safe: it re-checks the due date inside each DELETE
// statement, so a concurrent restart cannot delete an org whose grace period
// was extended between the SELECT and the DELETE.
export const cleanupDueOrganizations = async (): Promise<number> => {
  const due = await query(
    `SELECT id, name FROM organizations
      WHERE delete_due_at IS NOT NULL AND delete_due_at <= NOW()
      LIMIT 50`,
  );
  if (!due.rows.length) return 0;

  let cleaned = 0;
  for (const org of due.rows) {
    const dbClient = await query(
      `DELETE FROM organizations WHERE id = $1 AND delete_due_at IS NOT NULL AND delete_due_at <= NOW() RETURNING id`,
      [org.id],
    );
    if (dbClient.rows.length) {
      cleaned++;
      console.log(`🗑️  Organization deleted after grace period: ${org.name} (${org.id})`);
    }
  }
  return cleaned;
};

export const expireOrganizationInvitations = async (): Promise<number> => {
  const result = await query(
    `UPDATE organization_invitations
        SET status = 'expired', responded_at = NOW(), updated_at = NOW()
      WHERE status = 'pending'
        AND expires_at <= NOW()
     RETURNING id`,
  );
  return result.rowCount ?? 0;
};

export const autoPromoteVettedCandidates = async (): Promise<number> => {
  const thresholdResult = await query(
    `SELECT value FROM platform_settings
      WHERE key = 'vetted_auto_hire_threshold'
      LIMIT 1`,
  );
  const rawThreshold = thresholdResult.rows[0]?.value;
  const threshold = rawThreshold == null
    ? null
    : Number.parseInt(String(rawThreshold), 10);

  // Match the eligibility endpoint's dormant behavior: missing, invalid, or
  // zero thresholds do not accidentally vet every contractor.
  if (threshold === null || !Number.isInteger(threshold) || threshold <= 0) {
    return 0;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const promotedResult = await client.query(
      `WITH eligible_candidates AS (
         SELECT c.id AS candidate_id, c.user_id, u.email
           FROM candidates c
           JOIN users u ON u.id = c.user_id
           JOIN job_submissions js ON js.talent_id = u.id
           JOIN hiring_contracts hc ON hc.submission_id = js.id
          WHERE c.is_vetted = false
            AND hc.onspot_signed_at IS NOT NULL
          GROUP BY c.id, c.user_id, u.email
         HAVING COUNT(*) >= $1
       )
       UPDATE candidates c
          SET is_vetted = true,
              vetted_by_mechanism = 'automatic_milestone',
              vetted_at = NOW(),
              updated_at = NOW()
         FROM eligible_candidates eligible
        WHERE c.id = eligible.candidate_id
          AND c.is_vetted = false
       RETURNING c.user_id, eligible.email`,
      [threshold],
    );

    for (const promoted of promotedResult.rows) {
      await client.query(
        `INSERT INTO admin_role_changes
           (user_id, email, previous_role, new_role, mechanism, changed_by, notes, change_type)
         VALUES ($1, $2, 'unvetted', 'vetted', 'automatic_milestone_job', 'system', $3, 'vetting_status')`,
        [
          promoted.user_id,
          promoted.email,
          `Automatically vetted after reaching the ${threshold}-hire milestone.`,
        ],
      );
    }

    await client.query("COMMIT");
    return promotedResult.rowCount ?? 0;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error if rollback itself cannot complete.
    }
    throw err;
  } finally {
    client.release();
  }
};
interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Custom Request type for JWT authenticated routes
type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email: string;
    role: string;
  };
};

// JWT Authentication Middleware
const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      console.log(
        `🔒 JWT Auth failed: No token provided [${(req as any).requestId}] for ${req.method} ${req.path}`,
      );
      return res.status(401).json({
        error: "Authentication required",
        message: "No authentication token provided",
        requestId: (req as any).requestId,
      });
    }

    // Get JWT secret
    let jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      if (process.env.NODE_ENV === "development") {
        jwtSecret = "development-fallback-secret-not-for-production";
      } else {
        console.error("❌ JWT_SECRET not configured for production");
        return res.status(500).json({
          error: "Server configuration error",
          requestId: (req as any).requestId,
        });
      }
    }

    // Verify and decode JWT
    const decoded = jwt.verify(token, jwtSecret) as any;

    // ── Talent candidate token (type: "candidate") ──────────────────────────
    // Talent users log in through the talent portal which issues a candidate JWT
    // ({ type: "candidate", candidateId, email }) instead of a user JWT
    // ({ userId, email, role }). Accept it here by resolving the linked user account.
    if ((decoded as any).type === "candidate" && (decoded as any).candidateId) {
      const candidateEmail = (decoded as any).email;
      const talentUserQuery =
        "SELECT id, email, role FROM users WHERE lower(email) = lower($1) LIMIT 1";
      const talentUserResult = await query(talentUserQuery, [candidateEmail]);

      if (talentUserResult.rows.length === 0) {
        // No linked user account — use candidateId as the user id so profile
        // routes can still find/create a profile row keyed to this identity.
        // This handles candidates who were never registered as JWT users.
        console.warn(
          `⚠️ JWT Auth (talent): No user row for email ${candidateEmail} — using candidateId as userId`,
        );
        (req as any).user = {
          id: (decoded as any).candidateId,
          email: candidateEmail,
          role: "talent",
        };
      } else {
        const u = talentUserResult.rows[0];
        (req as any).user = { id: u.id, email: u.email, role: u.role };
      }
      // Preserve the auth form for billing routes that distinguish a
      // candidate-portal identity from a standard users.id JWT.
      (req as any).talentAuth = {
        candidateId: (decoded as any).candidateId,
        email: candidateEmail,
      };

      console.log(`✅ JWT Auth (talent token) [${(req as any).requestId}]:`, {
        candidateId: (decoded as any).candidateId,
        userId: (req as any).user.id,
      });
      return next();
    }

    // ── Standard user JWT (userId / email / role) ───────────────────────────
    const stdDecoded = decoded as JWTPayload;

    // Validate JWT payload structure
    if (!stdDecoded.userId || !stdDecoded.email || !stdDecoded.role) {
      console.error(
        `❌ JWT Auth failed: Invalid token payload [${(req as any).requestId}]:`,
        {
          hasUserId: !!stdDecoded.userId,
          hasEmail: !!stdDecoded.email,
          hasRole: !!stdDecoded.role,
        },
      );
      return res.status(401).json({
        error: "Invalid token",
        message: "Token missing required claims",
        requestId: (req as any).requestId,
      });
    }

    // Verify user still exists in database
    const userQuery = "SELECT id, email, role FROM users WHERE id = $1";
    const userResult = await query(userQuery, [stdDecoded.userId]);

    if (userResult.rows.length === 0) {
      console.error(
        `❌ JWT Auth failed: User not found in database [${(req as any).requestId}]: ${stdDecoded.userId}`,
      );
      return res.status(401).json({
        error: "Invalid token",
        message: "User account no longer exists",
        requestId: (req as any).requestId,
      });
    }

    const dbUser = userResult.rows[0];

    // Verify role hasn't changed
    if (dbUser.role !== stdDecoded.role) {
      console.error(
        `❌ JWT Auth failed: Role mismatch [${(req as any).requestId}]:`,
        {
          tokenRole: stdDecoded.role,
          dbRole: dbUser.role,
          userId: stdDecoded.userId,
        },
      );
      return res.status(401).json({
        error: "Invalid token",
        message: "User role has changed, please log in again",
        requestId: (req as any).requestId,
      });
    }

    // Add user to request object
    (req as any).user = {
      id: stdDecoded.userId,
      email: stdDecoded.email,
      role: stdDecoded.role,
    };

    console.log(`✅ JWT Auth successful [${(req as any).requestId}]:`, {
      userId: stdDecoded.userId,
      role: stdDecoded.role,
    });

    next();
  } catch (error: any) {
    const requestId = (req as any).requestId;
    console.error(`❌ JWT Auth error [${requestId}]:`, {
      error: error.message,
      name: error.name,
    });

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expired",
        message: "Your session has expired, please log in again",
        requestId,
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid token",
        message: "Authentication token is invalid",
        requestId,
      });
    }

    return res.status(500).json({
      error: "Authentication error",
      message: "Failed to authenticate token",
      requestId,
    });
  }
};

// Middleware: verify a Talent Profile JWT (type: "candidate")
const authenticateTalentJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Talent auth required" });
    const jwtSecret = process.env.JWT_SECRET || "dev-fallback-secret";
    const decoded = jwt.verify(token, jwtSecret) as any;
    if (decoded.type !== "candidate" || !decoded.candidateId) {
      return res.status(401).json({ error: "Invalid talent token" });
    }
    (req as any).talentAuth = { candidateId: decoded.candidateId, email: decoded.email };
    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") return res.status(401).json({ error: "Session expired — please log in again" });
    return res.status(401).json({ error: "Invalid talent auth token" });
  }
};

// Helper: ensure the authenticated talent owns the profile in :id param
function requireTalentOwns(req: Request, res: Response, paramKey = "id"): boolean {
  const profileId = req.params[paramKey];
  const talentAuth = (req as any).talentAuth;
  if (!talentAuth || talentAuth.candidateId !== profileId) {
    res.status(403).json({ error: "You are not authorized to edit this profile" });
    return false;
  }
  return true;
}

// ── Admin email domain enforcement ─────────────────────────────────────────────
// Only @onspotglobal.com addresses may ever hold the 'admin' role.
// Call this before every role='admin' assignment — signup, provisioning, role-flip.
// No-ops for non-admin roles; throws on domain violation.
function assertAdminEmailDomain(email: string, role: string): void {
  if (role === "admin" && !email.toLowerCase().endsWith("@onspotglobal.com")) {
    throw Object.assign(
      new Error(`Admin role is restricted to @onspotglobal.com addresses. Received: ${email}`),
      { statusCode: 403 }
    );
  }
}

// Role-Based Access Control Middleware
const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).requestId;

    if (!(req as any).user) {
      console.error(`❌ RBAC failed: No user in request [${requestId}]`);
      return res.status(401).json({
        error: "Authentication required",
        message: "User not authenticated",
        requestId,
      });
    }

    if (!allowedRoles.includes((req as any).user.role)) {
      console.error(
        `❌ RBAC failed: Insufficient permissions [${requestId}]:`,
        {
          userRole: (req as any).user.role,
          allowedRoles,
          userId: (req as any).user.id,
        },
      );
      return res.status(403).json({
        error: "Insufficient permissions",
        message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
        requestId,
      });
    }

    console.log(`✅ RBAC check passed [${requestId}]:`, {
      userId: (req as any).user.id,
      userRole: (req as any).user.role,
      allowedRoles,
    });

    next();
  };
};

// Convenience middleware functions
const requireClient = requireRole(["client"]);
const requireTalent = requireRole(["talent"]);
const requireAdmin = requireRole(["admin"]);
const requireClientOrTalent = requireRole(["client", "talent"]);
const requireAnyRole = requireRole(["client", "talent", "admin"]);

/**
 * isAdminWithTalentAccess — true when the admin (by userId) has permission to
 * access Talent/candidate data: admin_sub_role IS NULL (super-admin) or
 * admin_sub_role = 'talent_acquisition'. client_success admins are denied.
 */
async function isAdminWithTalentAccess(userId: string): Promise<boolean> {
  try {
    const result = await query(
      "SELECT admin_sub_role FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );
    if (result.rows.length === 0) return false;
    const subRole: string | null = result.rows[0].admin_sub_role ?? null;
    return subRole === null || subRole === "talent_acquisition";
  } catch {
    return false;
  }
}
/**
 * Sub-role enforcement middleware (Phase 5).
 * Requires the authenticated admin to have one of the given admin_sub_role values.
 * NULL admin_sub_role = super-admin bypass (passes all sub-role checks).
 * Must run AFTER authenticateAdminFlexible (or authenticateJWT + requireAdmin).
 */
const requireAdminSubRole = (allowedSubRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const result = await query(
        "SELECT admin_sub_role FROM users WHERE id = $1 LIMIT 1",
        [userId]
      );
      if (result.rows.length === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const adminSubRole: string | null = result.rows[0].admin_sub_role ?? null;
      // NULL = super-admin, bypasses all sub-role checks
      if (adminSubRole === null) {
        return next();
      }
      if (!allowedSubRoles.includes(adminSubRole)) {
        return res.status(403).json({
          error: "Insufficient permissions",
          message: `This action requires sub-role: ${allowedSubRoles.join(" or ")}`,
        });
      }
      next();
    } catch (err: any) {
      console.error("requireAdminSubRole error:", err);
      return res.status(500).json({ error: "Authorization check failed" });
    }
  };
};

async function withLedgerTransaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error if the connection is already unhealthy.
    }
    throw err;
  } finally {
    client.release();
  }
}

function parseLedgerNumber(value: unknown, field: string, options: { min?: number } = {}): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || (options.min !== undefined && parsed < options.min)) {
    throw Object.assign(new Error(`${field} must be a valid number${options.min !== undefined ? ` greater than or equal to ${options.min}` : ""}`), {
      status: 422,
    });
  }
  return parsed;
}

function parseLedgerDate(value: unknown, field: string): Date {
  const date = new Date(String(value ?? ""));
  if (!value || Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`${field} must be a valid date`), { status: 422 });
  }
  return date;
}

async function refreshInvoicePeriodStatus(client: any, periodId: string): Promise<void> {
  const result = await client.query(
    `SELECT ip.status AS current_status,
            inv.status AS invoice_status,
            p.status AS payout_status
       FROM invoice_periods ip
       LEFT JOIN LATERAL (
         SELECT status FROM invoices WHERE period_id = ip.id ORDER BY created_at DESC LIMIT 1
       ) inv ON true
       LEFT JOIN LATERAL (
         SELECT status FROM payouts WHERE period_id = ip.id ORDER BY created_at DESC LIMIT 1
       ) p ON true
      WHERE ip.id = $1`,
    [periodId],
  );
  const row = result.rows[0];
  if (!row || row.current_status === "draft" || row.current_status === "ready") return;

  let status = "invoiced";
  if (row.invoice_status === "paid" && row.payout_status === "disbursed") {
    status = "closed";
  } else if (row.payout_status === "pending" || row.payout_status === "scheduled") {
    status = "payout_scheduled";
  } else if (row.payout_status === "disbursed" || row.invoice_status) {
    status = "invoiced";
  }
  await client.query(
    `UPDATE invoice_periods SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, periodId],
  );
}


/**
 * Flexible admin auth middleware — accepts either:
 *   1. JWT Bearer token in Authorization header (portal / Access Portal login)
 *   2. Valid Replit Auth session where the DB user has role = "admin"
 * This allows admins who authenticated via Replit Auth (no onspot_jwt_token in
 * localStorage) to still call protected admin endpoints.
 */
const authenticateAdminFlexible = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // ── Path 1: JWT Bearer token ───────────────────────────────────────────
    const authHeader = req.headers["authorization"];
    const bearerToken = authHeader && authHeader.split(" ")[1];

    if (bearerToken) {
      let jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        if (process.env.NODE_ENV === "development") {
          jwtSecret = "development-fallback-secret-not-for-production";
        } else {
          return res.status(500).json({ error: "Server configuration error" });
        }
      }
      const decoded = jwt.verify(bearerToken, jwtSecret) as JWTPayload;
      if (!decoded.userId || !decoded.email || !decoded.role) {
        return res.status(401).json({ error: "Invalid token", message: "Token missing required claims" });
      }
      if (decoded.role !== "admin") {
        return res.status(403).json({ error: "Forbidden", message: "Admin access required" });
      }
      const userResult = await query(
        "SELECT id, email, role FROM users WHERE id = $1",
        [decoded.userId],
      );
      if (userResult.rows.length === 0 || userResult.rows[0].role !== "admin") {
        return res.status(403).json({ error: "Forbidden", message: "Admin access required" });
      }
      (req as any).user = { id: decoded.userId, email: decoded.email, role: "admin" };
      return next();
    }

    // ── Path 2: Replit Auth / session cookie ──────────────────────────────
    const reqAny = req as any;
    if (typeof reqAny.isAuthenticated === "function" && reqAny.isAuthenticated()) {
      let userId: string | undefined;
      if (reqAny.user?.user?.id) {
        userId = reqAny.user.user.id;
      } else if (reqAny.user?.claims?.sub) {
        userId = reqAny.user.claims.sub;
      }
      if (userId) {
        // The Replit Auth claims.sub is the Replit user ID, stored in the
        // `replit_id` column — NOT the primary key `id`. Check both columns.
        const userResult = await query(
          "SELECT id, email, role FROM users WHERE id = $1 OR replit_id = $1 LIMIT 1",
          [userId],
        );
        if (userResult.rows.length > 0 && userResult.rows[0].role === "admin") {
          reqAny.user = { id: userResult.rows[0].id, email: userResult.rows[0].email, role: "admin" };
          return next();
        }
      }
      return res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    }

    // ── Neither auth method worked ─────────────────────────────────────────
    return res.status(401).json({
      error: "Authentication required",
      message: "Please log in to perform this action",
    });
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired", message: "Your session has expired, please log in again" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token", message: "Authentication token is invalid" });
    }
    console.error("Admin flexible auth error:", error);
    return res.status(500).json({ error: "Authentication error" });
  }
};

// Enhanced validation middleware factory
const validateRequest = (
  schema: z.ZodSchema,
  target: "body" | "query" | "params" = "body",
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate =
        target === "body"
          ? req.body
          : target === "query"
            ? req.query
            : req.params;

      schema.parse(dataToValidate);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        console.warn(`🚨 Validation Error [${(req as any).requestId}]:`, {
          endpoint: req.path,
          method: req.method,
          target: target,
          errors: validationErrors,
        });

        return res.status(400).json({
          error: "Validation failed",
          message: `Invalid ${target} data provided`,
          details: validationErrors,
          requestId: (req as any).requestId,
        });
      }
      next(error);
    }
  };
};

// Enhanced error handler utility
const handleRouteError = (
  error: any,
  req: Request,
  res: Response,
  operation: string,
  statusCode: number = 500,
) => {
  const requestId = (req as any).requestId;
  const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

  console.error(`🚨 ${operation} Error [${requestId}]:`, {
    error: error.message,
    stack: error.stack,
    userId: userId,
    endpoint: req.path,
    method: req.method,
  });

  // Send to Sentry if configured and it's a server error
  if (process.env.SENTRY_DSN && statusCode >= 500) {
    Sentry.captureException(error, {
      tags: {
        operation: operation,
        requestId: requestId,
        endpoint: req.path,
        method: req.method,
        userId: userId,
      },
      user: {
        id: userId,
        ip_address: req.ip,
      },
      extra: {
        userAgent: req.get("User-Agent"),
      },
    });
  }

  // Return appropriate error message
  const isServerError = statusCode >= 500;
  res.status(statusCode).json({
    error: isServerError
      ? "Internal server error"
      : error.message || "Operation failed",
    message: isServerError
      ? "An unexpected error occurred. Please try again later."
      : error.message || `Failed to ${operation.toLowerCase()}`,
    requestId: requestId,
  });
};

// ─── Auth rate limiters ───────────────────────────────────────────────────────
// Each endpoint type has its own counter so login, signup, and reset never
// share a budget. In development the limits are very generous so testing never
// causes lock-outs; tighter production values are set via environment variables.
//
// NOTE: The in-memory store resets on server restart and does not coordinate
// across multiple instances. For multi-instance deployments, replace with a
// shared store (e.g. PostgreSQL-backed) in the future.
// ─────────────────────────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== "production";

// Helper: seconds until the rate-limit window resets for this request
const retryAfterSecs = (req: Request): number => {
  const info = (req as any).rateLimit;
  if (info?.resetTime instanceof Date) {
    return Math.max(1, Math.ceil((info.resetTime.getTime() - Date.now()) / 1000));
  }
  return 900; // safe fallback
};

// LOGIN limiter — keyed by IP + email so one user cannot block every other user
// sharing the same Replit proxy IP.  Successful logins are NOT counted so a
// correct password never consumes the quota.
const loginLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_LOGIN_WINDOW_MS ?? 15 * 60 * 1000),
  max: Number(process.env.AUTH_LOGIN_LIMIT ?? (isDev ? 100 : 20)),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "unknown";
    return `login:${ipKeyGenerator(req.ip ?? "")}:${email}`;
  },
  handler: (req: Request, res: Response) => {
    const secs = retryAfterSecs(req);
    console.warn(`🚫 Login rate-limit: IP=${req.ip} [${(req as any).requestId}]`);
    res.status(429).set("Retry-After", String(secs)).json({
      success: false,
      error: "RATE_LIMITED",
      message: "Too many failed sign-in attempts. Please try again shortly.",
      retryAfter: secs,
      requestId: (req as any).requestId,
    });
  },
});

// SIGNUP limiter — keyed by IP, 1-hour window
const signupLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_SIGNUP_WINDOW_MS ?? 60 * 60 * 1000),
  max: Number(process.env.AUTH_SIGNUP_LIMIT ?? (isDev ? 50 : 10)),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `signup:${ipKeyGenerator(req.ip ?? "")}`,
  handler: (req: Request, res: Response) => {
    const secs = retryAfterSecs(req);
    console.warn(`🚫 Signup rate-limit: IP=${req.ip} [${(req as any).requestId}]`);
    res.status(429).set("Retry-After", String(secs)).json({
      success: false,
      error: "RATE_LIMITED",
      message: "Too many account creation attempts. Please try again later.",
      retryAfter: secs,
      requestId: (req as any).requestId,
    });
  },
});

// PASSWORD-RESET limiter — keyed by IP
const authResetLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RESET_WINDOW_MS ?? 15 * 60 * 1000),
  max: Number(process.env.AUTH_RESET_LIMIT ?? (isDev ? 50 : 5)),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `reset:${ipKeyGenerator(req.ip ?? "")}`,
  handler: (req: Request, res: Response) => {
    const secs = retryAfterSecs(req);
    console.warn(`🚫 Reset rate-limit: IP=${req.ip} [${(req as any).requestId}]`);
    res.status(429).set("Retry-After", String(secs)).json({
      success: false,
      error: "RATE_LIMITED",
      message: "Too many password reset attempts. Please try again later.",
      retryAfter: secs,
      requestId: (req as any).requestId,
    });
  },
});

// Kept for legacy routes that still reference authLimiter (talent-auth, /login, /signup)
const authLimiter = loginLimiter;

// JOB-APPLY limiter — keyed by IP, 5 submissions per minute
const applyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 50 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `apply:${ipKeyGenerator(req.ip ?? "")}`,
  handler: (req: Request, res: Response) => {
    const secs = retryAfterSecs(req);
    console.warn(`🚫 Apply rate-limit: IP=${req.ip} [${(req as any).requestId}]`);
    res.status(429).set("Retry-After", String(secs)).json({
      success: false,
      error: "RATE_LIMITED",
      message: "Too many applications submitted. Please wait a minute and try again.",
      retryAfter: secs,
    });
  },
});

// PUBLIC TALENT-SEARCH limiter — keyed by IP, 10 requests per minute.
// The public endpoint does no DB writes; this rate limit guards scoring CPU cost.
const publicSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `pubsearch:${ipKeyGenerator(req.ip ?? "")}`,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: "Too many search requests. Please wait a moment and try again.",
    });
  },
});

// Pipeline mutations can create database rows and trigger email/notifications.
// Keep a generous development budget while bounding abuse in production.
const pipelineMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `pipeline:${ipKeyGenerator(req.ip ?? "")}:${(req as any).user?.id ?? "anonymous"}`,
  handler: (req: Request, res: Response) => {
    const secs = retryAfterSecs(req);
    res.status(429).set("Retry-After", String(secs)).json({
      error: "RATE_LIMITED",
      message: "Too many pipeline updates. Please wait a moment and try again.",
      retryAfter: secs,
    });
  },
});

// ── Auto application-received email (non-blocking helper) ─────────────────────
async function fireAutoApplicationEmail(submissionId: string): Promise<void> {
  try {
    const appData = await query(
      `SELECT js.first_name, js.last_name, js.applicant_name, js.email, js.phone,
              js.status, js.submitted_at,
              j.title AS job_title, j.company AS job_company, j.location AS job_location
       FROM job_submissions js
       JOIN jobs j ON j.id = js.job_id
       WHERE js.id = $1`,
      [submissionId],
    );
    if (appData.rows.length === 0) return;
    const row = appData.rows[0];

    const tpl = await query(
      `SELECT id, subject, body_html FROM applicant_email_templates
       WHERE category = 'application_received' AND is_published = true AND is_archived = false
       ORDER BY is_default DESC LIMIT 1`,
      [],
    );
    if (tpl.rows.length === 0) return; // no published template — skip silently

    const { buildEmailContext, renderApplicantEmail } = await import("./services/emailVariableResolver.ts");
    const ctx = buildEmailContext({
      firstName: row.first_name, lastName: row.last_name,
      applicantName: row.applicant_name, email: row.email, phone: row.phone,
      jobTitle: row.job_title, jobCompany: row.job_company, jobLocation: row.job_location,
      status: row.status, submittedAt: row.submitted_at,
    });
    const rendered = renderApplicantEmail({
      subject: tpl.rows[0].subject,
      bodyHtml: tpl.rows[0].body_html,
    }, ctx);
    if (rendered.unresolvedKeys.length > 0) {
      console.error(
        `fireAutoApplicationEmail: blocked template ${tpl.rows[0].id} for ${submissionId}; unresolved variables: ${rendered.unresolvedKeys.join(", ")}`,
      );
      return;
    }

    const { sendApplicantEmail } = await import("./services/microsoftGraphEmailService.ts");
    const sendResult = await sendApplicantEmail({
      to: row.email,
      subject: rendered.subject,
      bodyHtml: rendered.bodyHtml,
    });

    await query(
      `INSERT INTO job_application_emails
         (application_id, template_id, subject, body_html, sent_to, status, error_message, is_test)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
      [
        submissionId, tpl.rows[0].id,
        rendered.subject, rendered.bodyHtml, row.email,
        sendResult.success ? "sent" : "failed",
        sendResult.success ? null : sendResult.error,
      ],
    );
  } catch (e: any) {
    console.warn("fireAutoApplicationEmail (non-fatal):", e?.message);
  }
}

// escHtml imported from ./lib/escHtml.js
async function fireInvitationEmail(opts: {
  talentEmail: string;
  talentName: string;
  jobTitle: string;
  jobDescription: string | null;
  submissionId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!opts.talentEmail) return { success: false, error: "Talent email is unavailable" };
    // The production route is also used by isolated smoke tests. Those tests
    // opt into a no-op transport so exercising invitation creation never sends
    // mail or depends on Microsoft Graph credentials.
    if (process.env.INVITATION_EMAIL_TRANSPORT === "noop") return { success: true };
    const { sendApplicantEmail } = await import("./services/microsoftGraphEmailService.ts");
    const { buildEmailContext, renderApplicantEmail, renderBrandedEmailLayout } =
      await import("./services/emailVariableResolver.ts");

    const safeName  = escHtml(opts.talentName);
    const safeTitle = escHtml(opts.jobTitle);

    const descriptionHtml = opts.jobDescription
      ? `<p style="color:#444;font-size:15px;margin:16px 0;">${escHtml(opts.jobDescription)}</p>`
      : "";

    const subject = `You've been invited to apply for ${opts.jobTitle}`;
    const contentHtml = `
  <h2 style="color:#1a1a2e;margin-bottom:8px;">You've been invited to a role</h2>
  <p style="color:#444;font-size:15px;margin-bottom:4px;">Hi ${safeName},</p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    A client has invited you to apply for the following role:
  </p>
  <h3 style="color:#1a1a2e;margin:8px 0;">${safeTitle}</h3>
  ${descriptionHtml}
  <p style="margin:24px 0;">
    <a href="{{portal_url}}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:15px;display:inline-block;">
      View Invitation
    </a>
  </p>
  <p style="color:#888;font-size:13px;">
    You can accept or decline the invitation from your
    <a href="{{portal_url}}" style="color:#4f46e5;">My Applications</a> page.
  </p>
`.trim();
    const rendered = renderApplicantEmail(
      { subject, bodyHtml: renderBrandedEmailLayout(contentHtml) },
      buildEmailContext({
        applicantName: opts.talentName,
        email: opts.talentEmail,
        jobTitle: opts.jobTitle,
      }),
    );
    if (rendered.unresolvedKeys.length > 0) {
      console.warn(
        `fireInvitationEmail: blocked email for ${opts.submissionId}; unresolved variables: ${rendered.unresolvedKeys.join(", ")}`,
      );
      return { success: false, error: "Invitation email template could not be rendered" };
    }

    const result = await sendApplicantEmail({
      to: opts.talentEmail,
      subject: rendered.subject,
      bodyHtml: rendered.bodyHtml,
      senderEmail: "findwork@onspotglobal.com",
    });
    if (result.success) {
      console.log(`[TalentInvitationEmail] Sent submissionId=${opts.submissionId} sender=findwork@onspotglobal.com`);
    } else {
      console.warn(`[TalentInvitationEmail] Failed submissionId=${opts.submissionId} error=${result.error ?? "unknown"}`);
    }
    return result;
  } catch (e: any) {
    console.warn(`[TalentInvitationEmail] Failed submissionId=${opts.submissionId} error=${e?.message ?? "unknown"}`);
    return { success: false, error: e?.message ?? "Invitation email failed" };
  }
}

// hint: Logic changed on both sides. Requires understanding intent of each change.
// hint: Logic changed on both sides. Requires understanding intent of each change.
// hint: Logic changed on both sides. Requires understanding intent of each change.
// hint: Logic changed on both sides. Requires understanding intent of each change.
export async function registerRoutes(
  app: Express,
  httpServer: Server = createServer(app),
): Promise<Server> {
  // Configure multer for file uploads (CSV, PDF, videos)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 200 * 1024 * 1024, // 200 MB — accommodates video introduction uploads
    },
  });

  // Dedicated Multer instance for profile photo uploads — enforces 5 MB at middleware level
  // so oversized payloads are rejected before any handler logic runs.
  const photoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  console.log("🔗 Registering API routes...");

  // ── One-time safe migration: structured counts for grouped message alerts ──
  try {
    await query(
      `ALTER TABLE notifications
       ADD COLUMN IF NOT EXISTS message_count integer NOT NULL DEFAULT 1`,
    );
    await query(
      `CREATE INDEX IF NOT EXISTS notifications_unread_message_group_idx
         ON notifications (user_id, related_id, created_at DESC)
       WHERE type = 'new_message' AND is_read = false`,
    );
    await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_key text`);
    await query(
      `CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_key_unique_idx
         ON notifications (event_key)
       WHERE event_key IS NOT NULL`,
    );
    const consolidated = await storage.consolidateUnreadMessageNotifications();
    if (consolidated > 0) {
      console.log(
        `🔔 Consolidated ${consolidated} legacy unread message notification${consolidated === 1 ? "" : "s"}.`,
      );
    }
  } catch (migErr: any) {
    console.warn("⚠️  message notification grouping migration skipped:", migErr.message);
  }

  // ── One-time safe migration: Client organization foundation ────────────────
  // Organizations are intentionally independent from jobs/client_profiles so
  // existing individual Client accounts keep working unchanged.
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id           varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name         text NOT NULL,
        website      text,
        industry     text,
        company_size text,
        location     text,
        about        text,
        timezone     text,
        created_by   varchar NOT NULL REFERENCES users(id),
        created_at   timestamp DEFAULT now(),
        updated_at   timestamp DEFAULT now()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at)`);
    await query(`
      CREATE TABLE IF NOT EXISTS organization_members (
        id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id         varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role            text NOT NULL DEFAULT 'member',
        status          text NOT NULL DEFAULT 'active',
        joined_at       timestamp DEFAULT now(),
        created_at      timestamp DEFAULT now(),
        updated_at      timestamp DEFAULT now(),
        CONSTRAINT organization_members_org_user_unique UNIQUE (organization_id, user_id)
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON organization_members(organization_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_organization_members_status ON organization_members(status)`);
    await query(`
      CREATE TABLE IF NOT EXISTS organization_invitations (
        id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id varchar NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email           varchar NOT NULL,
        invited_by      varchar NOT NULL REFERENCES users(id),
        status          text NOT NULL DEFAULT 'pending',
        email_status    text NOT NULL DEFAULT 'pending',
        email_error     text,
        email_sent_at   timestamp,
        accepted_by     varchar REFERENCES users(id),
        created_at      timestamp DEFAULT now(),
        expires_at      timestamp NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
        responded_at    timestamp,
        updated_at      timestamp DEFAULT now()
      )
    `);
    await query(`ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'pending'`);
    await query(`ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS email_error text`);
    await query(`ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS email_sent_at timestamp`);
    await query(`ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS expires_at timestamp`);
    await query(`
      UPDATE organization_invitations
         SET expires_at = COALESCE(created_at, NOW()) + INTERVAL '30 days'
       WHERE expires_at IS NULL
    `);
    await query(`
      ALTER TABLE organization_invitations
        ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 days'),
        ALTER COLUMN expires_at SET NOT NULL
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_organization_invitations_organization_id ON organization_invitations(organization_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_organization_invitations_email ON organization_invitations(email)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_organization_invitations_status ON organization_invitations(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_organization_invitations_expires_at ON organization_invitations(expires_at)`);
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_pending_email_unique
        ON organization_invitations (organization_id, lower(email))
        WHERE status = 'pending'
    `);
    // ── Organization invitation tokens (secure token-based invite links) ──────
    await query(`ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS token_hash text`);
    await query(`CREATE INDEX IF NOT EXISTS idx_organization_invitations_token_hash ON organization_invitations(token_hash)`);
    // ── Organization deletion lifecycle columns ────────────────────────────────
    await query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS delete_requested_at timestamp`);
    await query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS delete_requested_by varchar REFERENCES users(id)`);
    await query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS delete_due_at timestamp`);
    await query(`CREATE INDEX IF NOT EXISTS idx_organizations_delete_due_at ON organizations(delete_due_at) WHERE delete_due_at IS NOT NULL`);
  } catch (migErr: any) {
    console.warn("⚠️  organization tables migration skipped:", migErr.message);
  }

  // ── One-time safe migration: set application_method = 'built_in_form' for
  // approved/open jobs that have no valid external apply link (empty, null, or
  // pointing at the old LeadConnector placeholder URL).
  // Intentionally external jobs that have a real non-LeadConnector HTTPS URL
  // are left untouched.
  try {
    const migResult = await query(
      `UPDATE jobs
         SET application_method = 'built_in_form',
             apply_link = NULL,
             updated_at = NOW()
       WHERE approval_status = 'approved'
         AND status = 'open'
         AND (
               application_method IS NULL
            OR application_method = ''
            OR application_method != 'external_link'
            OR apply_link IS NULL
            OR apply_link = ''
            OR apply_link ILIKE '%leadconnectorhq.com%'
         )
         AND NOT (
               application_method = 'external_link'
           AND apply_link IS NOT NULL
           AND apply_link != ''
           AND apply_link NOT ILIKE '%leadconnectorhq.com%'
         )`,
    );
    if (migResult.rowCount && migResult.rowCount > 0) {
      console.log(`✅ Migration: set ${migResult.rowCount} open job(s) to built_in_form application method`);
    }
  } catch (migErr: any) {
    console.warn("⚠️  built_in_form migration skipped:", migErr.message);
  }

  // ── One-time safe migration: add is_repeat_application column to job_submissions ──
  try {
    await query(`ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS is_repeat_application boolean NOT NULL DEFAULT false`);
  } catch (migErr: any) {
    console.warn("⚠️  is_repeat_application migration skipped:", migErr.message);
  }

  // ── One-time safe migration: create applicant_email_templates and job_application_emails tables ──
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS applicant_email_templates (
        id           uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
        name         text      NOT NULL,
        subject      text      NOT NULL,
        body_html    text      NOT NULL,
        category     text      NOT NULL,
        stage        text,
        is_published boolean   NOT NULL DEFAULT false,
        is_default   boolean   NOT NULL DEFAULT false,
        is_archived  boolean   NOT NULL DEFAULT false,
        variables    jsonb     NOT NULL DEFAULT '[]',
        created_at   timestamp NOT NULL DEFAULT now(),
        updated_at   timestamp NOT NULL DEFAULT now()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_aet_category     ON applicant_email_templates(category)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aet_stage        ON applicant_email_templates(stage)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_aet_is_published ON applicant_email_templates(is_published)`);

    await query(`
      CREATE TABLE IF NOT EXISTS job_application_emails (
        id             uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id varchar   NOT NULL REFERENCES job_submissions(id) ON DELETE CASCADE,
        template_id    uuid      REFERENCES applicant_email_templates(id) ON DELETE SET NULL,
        subject        text      NOT NULL,
        body_html      text      NOT NULL,
        sent_to        text      NOT NULL,
        sent_by        varchar   REFERENCES users(id),
        status         text      NOT NULL DEFAULT 'sent',
        error_message  text,
        is_test        boolean   NOT NULL DEFAULT false,
        sent_at        timestamp NOT NULL DEFAULT now(),
        created_at     timestamp NOT NULL DEFAULT now()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_jae_application_id ON job_application_emails(application_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_jae_sent_at         ON job_application_emails(sent_at)`);
  } catch (migErr: any) {
    console.warn("⚠️  email tables migration skipped:", migErr.message);
  }

  // ── One-time safe migration: add role taxonomy columns to jobs table ──────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS professional_role_name TEXT`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS original_role_name TEXT`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_function TEXT`);
    // Backfill existing rows from legacy title / category columns
    await query(`UPDATE jobs SET professional_role_name = title WHERE professional_role_name IS NULL OR professional_role_name = ''`);
    // Seed job_function from category then normalise legacy values to canonical names
    await query(`UPDATE jobs SET job_function = category WHERE job_function IS NULL OR job_function = ''`);
    await query(`
      UPDATE jobs
      SET job_function = CASE LOWER(TRIM(job_function))
        WHEN 'admin'            THEN 'Operations'
        WHEN 'it'               THEN 'Information Technology (IT)'
        WHEN 'finance'          THEN 'Finance & Accounting'
        WHEN 'hr'               THEN 'Human Resources'
        WHEN 'customer success' THEN 'Customer Success'
        WHEN 'customer support' THEN 'Customer Support'
        WHEN 'development'      THEN 'Engineering'
        WHEN 'tech support'     THEN 'Information Technology (IT)'
        WHEN 'design'           THEN 'Design (UI/UX)'
        WHEN 'marketing'        THEN 'Marketing'
        WHEN 'sales'            THEN 'Sales'
        WHEN 'operations'       THEN 'Operations'
        WHEN 'data'             THEN 'Data & Analytics'
        WHEN 'product'          THEN 'Product'
        WHEN 'legal'            THEN 'Legal & Compliance'
        WHEN 'strategy'         THEN 'Strategy'
      END
      WHERE job_function IS NOT NULL
        AND LOWER(TRIM(job_function)) IN (
          'admin','it','finance','hr','customer success','customer support',
          'development','tech support','design','marketing','sales',
          'operations','data','product','legal','strategy'
        )
    `);
    console.log("✅ Migration: role taxonomy columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  role taxonomy migration skipped:", migErr.message);
  }

  // ── One-time safe migration: add view_count column to jobs table ──────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0`);
    console.log("✅ Migration: jobs.view_count column ready");
  } catch (migErr: any) {
    console.warn("⚠️  view_count migration skipped:", migErr.message);
  }

  // ── One-time safe migration: add benefits column to jobs table ────────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS benefits text`);
    console.log("✅ Migration: jobs.benefits column ready");
  } catch (migErr: any) {
    console.warn("⚠️  benefits migration skipped:", migErr.message);
  }

  // ── One-time safe migration: add commission / equity flags to jobs table ──────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS has_commission boolean NOT NULL DEFAULT false`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS has_equity    boolean NOT NULL DEFAULT false`);
    console.log("✅ Migration: jobs.has_commission / has_equity columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  commission/equity migration skipped:", migErr.message);
  }

  // ── One-time safe migration: add is_featured flag to jobs table ────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false`);
    console.log("✅ Migration: jobs.is_featured column ready");
  } catch (migErr: any) {
    console.warn("⚠️  is_featured migration skipped:", migErr.message);
  }

  // ── One-time safe migration: urgently_hiring flag ─────────────────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS urgently_hiring boolean NOT NULL DEFAULT false`);
    console.log("✅ Migration: jobs.urgently_hiring column ready");
  } catch (migErr: any) {
    console.warn("⚠️  urgently_hiring migration skipped:", migErr.message);
  }

  // ── One-time safe migration: is_company_confidential + confidential_client_overview ──
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_company_confidential boolean NOT NULL DEFAULT false`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS confidential_client_overview text`);
    console.log("✅ Migration: jobs.is_company_confidential + confidential_client_overview columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  confidentiality migration skipped:", migErr.message);
  }

  // ── One-time safe migration: job_summary (public card preview) ────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_summary text`);
    console.log("✅ Migration: jobs.job_summary column ready");
  } catch (migErr: any) {
    console.warn("⚠️  job_summary migration skipped:", migErr.message);
  }

  // ── One-time safe migration: role detail fields ───────────────────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reporting_to text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS division text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_code text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_grade text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_level text`);
    console.log("✅ Migration: jobs role detail columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  role detail migration skipped:", migErr.message);
  }

  // ── One-time safe migration: Job Success Profile (JSP) content sections ───
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_overview text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS role_mission text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS key_outcomes text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS key_responsibilities text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS skills_and_competencies text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS behavioral_traits text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS kpis text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS training_and_support text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS growth_path text`);
    console.log("✅ Migration: jobs JSP content columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  JSP content migration skipped:", migErr.message);
  }

  // ── One-time safe migration: system requirements fields ───────────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS minimum_internet_speed text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS system_requirements text`);
    console.log("✅ Migration: jobs system requirement columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  system requirements migration skipped:", migErr.message);
  }

  // ── One-time safe migration: template alignment fields ────────────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS preferred_qualifications text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS required_tools_software text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS other_equipment_requirements text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_days text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS time_zone text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS compensation_notes text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS what_we_offer text`);
    console.log("✅ Migration: jobs template alignment columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  template alignment migration skipped:", migErr.message);
  }

  // ── One-time safe migration: posting timestamp fields ─────────────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS posted_at timestamp`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS original_posted_at timestamp`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_refreshed_at timestamp`);
    console.log("✅ Migration: jobs posting timestamp columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  posting timestamp migration skipped:", migErr.message);
  }

  // ── One-time safe migration: approval workflow columns ────────────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending'`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approved_by varchar`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approved_at timestamp`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rejected_by varchar`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rejected_at timestamp`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rejection_reason text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_client_submitted boolean NOT NULL DEFAULT false`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS existing_job_id varchar`);
    console.log("✅ Migration: jobs approval workflow columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  approval workflow migration skipped:", migErr.message);
  }

  // ── One-time safe migration: private Client talent favorites ──────────────
  // Favorites are deliberately independent from job_submissions and jobs. They
  // are a Client-owned bookmark only, never a pipeline state or notification.
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS client_talent_favorites (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id  varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        talent_id  varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT client_talent_favorites_client_talent_unique
          UNIQUE (client_id, talent_id)
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_client_talent_favorites_client_id
        ON client_talent_favorites (client_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_client_talent_favorites_talent_id
        ON client_talent_favorites (talent_id)
    `);
    console.log("✅ Migration: client_talent_favorites table ready");
  } catch (migErr: any) {
    console.warn("⚠️  client talent favorites migration skipped:", migErr.message);
  }

  // ── One-time safe migration: application method / link ────────────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS apply_link text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_method text DEFAULT 'external_link'`);
    console.log("✅ Migration: jobs application method columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  application method migration skipped:", migErr.message);
  }

  // ── One-time safe migration: budget / salary extended fields ─────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budget_currency text DEFAULT 'PHP'`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS custom_currency_code text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_display text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS duration text`);
    console.log("✅ Migration: jobs budget/salary extended columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  budget/salary migration skipped:", migErr.message);
  }

  // ── One-time safe migration: requires_resume field ──────────────────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requires_resume boolean NOT NULL DEFAULT false`);
    // CV is no longer required for any role — talent profile serves as the resume.
    // Reset any jobs that had requires_resume = true so they don't block applicants.
    await query(`UPDATE jobs SET requires_resume = false WHERE requires_resume = true`);
    console.log("✅ Migration: requires_resume column ready; all roles reset to not require CV");
  } catch (migErr: any) {
    console.warn("⚠️  requires_resume migration skipped:", migErr.message);
  }

  // ── One-time safe migration: video introduction fields ──────────────────────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requires_video_intro boolean NOT NULL DEFAULT false`);
    await query(`ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS video_introduction_url text`);
    await query(`ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS video_introduction_file_name text`);
    console.log("✅ Migration: video introduction columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  video introduction migration skipped:", migErr.message);
  }

  // ── One-time safe migration: application commercial terms ──────────────────
  try {
    await query(`ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS proposed_rate numeric(12,2)`);
    await query(`ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS proposed_budget numeric(12,2)`);
    await query(`ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS estimated_duration text`);
    console.log("✅ Migration: application commercial terms columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  application commercial terms migration skipped:", migErr.message);
  }

  // ── One-time safe migration: email sender tracking fields ────────────────
  try {
    await query(`ALTER TABLE job_application_emails ADD COLUMN IF NOT EXISTS sender_email text`);
    await query(`ALTER TABLE job_application_emails ADD COLUMN IF NOT EXISTS sender_name text`);
    await query(`ALTER TABLE job_application_emails ADD COLUMN IF NOT EXISTS status_update text`);
    await query(`ALTER TABLE job_application_emails ADD COLUMN IF NOT EXISTS status_previous text`);
    await query(`ALTER TABLE job_application_emails ADD COLUMN IF NOT EXISTS status_note text`);
    console.log("✅ Migration: email sender columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  email sender migration skipped:", migErr.message);
  }

  // ── One-time safe migration: candidate separate first/last name columns ──
  try {
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS first_name text`);
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_name  text`);
    console.log("✅ Migration: candidates.first_name / last_name columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  candidates name migration skipped:", migErr.message);
  }

  // ── One-time safe migration: candidate more_about_me long-form text ──
  try {
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS more_about_me text`);
    console.log("✅ Migration: candidates.more_about_me column ready");
  } catch (migErr: any) {
    console.warn("⚠️  candidates more_about_me migration skipped:", migErr.message);
  }

  // ── One-time safe migration: candidates vetting columns ──────────────────────
  try {
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_vetted boolean NOT NULL DEFAULT false`);
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS vetted_at timestamptz`);
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS vetted_by_mechanism text`);
    console.log("✅ Migration: candidates vetting columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  candidates vetting migration skipped:", migErr.message);
  }

  // ── One-time safe migration: candidates verification columns ─────────────────
  // Canonical three-tier: No Classification → Verified → Vetted.
  // Verified = admin-confirmed identity/certifications; prerequisite for Vetted.
  try {
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false`);
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS verified_at timestamptz`);
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS verified_by text`);
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS verified_by_mechanism text`);
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS verification_notes text`);
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS verification_status text`);
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS verification_doc_url text`);
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS verification_doc_name text`);
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS verification_rejection_reason text`);
    console.log("✅ Migration: candidates verification columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  candidates verification migration skipped:", migErr.message);
  }

  // ── One-time safe migration: 1-Click Apply — application_questions + answers ──
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_questions jsonb`);
    await query(`ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS answers jsonb`);
    console.log("✅ Migration: jobs.application_questions + job_submissions.answers columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  1-click apply migration skipped:", migErr.message);
  }

  // ── One-time safe migration: platform_settings key-value config table ─────
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key        text      PRIMARY KEY,
        value      text      NOT NULL,
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    // Seed default: name reveal triggers on "new" (talent accepts invite; was 'submitted' pre-rename)
    await query(`
      INSERT INTO platform_settings (key, value)
      VALUES ('name_reveal_threshold', 'new')
      ON CONFLICT (key) DO NOTHING
    `);
    // Migrate any existing stored 'submitted' threshold value to canonical 'new'
    await query(`
      UPDATE platform_settings SET value = 'new', updated_at = NOW()
      WHERE key = 'name_reveal_threshold' AND value = 'submitted'
    `);
    // Seed default: search chip activation threshold = 100 (raised from launch-window 10)
    await query(`
      INSERT INTO platform_settings (key, value)
      VALUES ('search_suggestion_threshold', '100')
      ON CONFLICT (key) DO NOTHING
    `);
    console.log("✅ Migration: platform_settings table ready");

  // ── search_query_frequency — aggregate real search query volume for chips ──
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS search_query_frequency (
        normalized_query text PRIMARY KEY,
        count            integer NOT NULL DEFAULT 1,
        last_searched_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Migration: search_query_frequency table ready");
  } catch (sqfErr: any) {
    console.warn("⚠️  search_query_frequency migration skipped:", sqfErr.message);
  }
  } catch (migErr: any) {
    console.warn("⚠️  platform_settings migration skipped:", migErr.message);
  }

  // Cleanup pass 1: reset any scaffold jobs that were created with approvalStatus='approved'
  // (old default) to 'pending'. Idempotent — no-op once all rows are already 'pending'.
  try {
    const scaffoldReset = await query(`
      UPDATE jobs
      SET approval_status = 'pending'
      WHERE created_via = 'search_scaffold'
        AND approval_status = 'approved'
    `);
    if (scaffoldReset.rowCount && scaffoldReset.rowCount > 0) {
      console.log(`✅ Migration: reset ${scaffoldReset.rowCount} scaffold job(s) approval_status approved→pending`);
    }
  } catch (scaffoldResetErr: any) {
    console.warn("⚠️  Scaffold approval_status reset skipped:", scaffoldResetErr.message);
  }

  // Cleanup pass 2: delete stale draft scaffold jobs that have NO attached submissions.
  // IMPORTANT: scaffold jobs with status='draft' CAN have real job_submissions rows —
  // the Search-to-Shortlist invitation flow creates submissions (status='invited'/'submitted',
  // initiated_by='client') on scaffold jobs. A scaffold with ANY submission — regardless
  // of its own status — must never be deleted. Only scaffolds with zero submissions are inert.
  try {
    const scaffoldDelete = await query(`
      DELETE FROM jobs
      WHERE created_via = 'search_scaffold'
        AND status = 'draft'
        AND NOT EXISTS (
          SELECT 1 FROM job_submissions WHERE job_id = jobs.id
        )
    `);
    if (scaffoldDelete.rowCount && scaffoldDelete.rowCount > 0) {
      console.log(`✅ Migration: deleted ${scaffoldDelete.rowCount} stale draft scaffold job(s) with no submissions`);
    }
  } catch (scaffoldDeleteErr: any) {
    console.warn("⚠️  Scaffold draft cleanup skipped:", scaffoldDeleteErr.message);
  }

  // ── Hiring pipeline tables: interviews, offers, hiring_contracts ─────────
  try {
    await query(`ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS combined_invite_reveal boolean NOT NULL DEFAULT false`);
    await query(`ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS workflow_type text NOT NULL DEFAULT 'application'`);
    await query(`
      UPDATE job_submissions
         SET workflow_type = 'client_invitation'
       WHERE workflow_type = 'application'
         AND initiated_by = 'client'
         AND (
           status IN (
             'invited', 'declined', 'interviewing', 'offer_extended',
             'offer_accepted', 'offer_declined', 'offer_expired', 'hired'
           )
           OR combined_invite_reveal = true
         )
    `);
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
           WHERE conrelid = 'job_submissions'::regclass
             AND conname = 'job_submissions_workflow_type_check'
        ) THEN
          ALTER TABLE job_submissions
            ADD CONSTRAINT job_submissions_workflow_type_check
            CHECK (workflow_type IN ('application', 'client_shortlist', 'client_invitation'));
        END IF;
      END $$;
    `);
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS job_submissions_active_shortlist_unique
        ON job_submissions (client_id, job_id, talent_id)
       WHERE workflow_type = 'client_shortlist' AND status = 'shortlisted'
    `);

    // interviews — one row per round per submission, client-driven
    await query(`
      CREATE TABLE IF NOT EXISTS interviews (
        id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        submission_id    varchar     NOT NULL REFERENCES job_submissions(id) ON DELETE CASCADE,
        round_number     integer     NOT NULL DEFAULT 1,
        interview_type   text        NOT NULL DEFAULT 'initial',
        status           text        NOT NULL DEFAULT 'proposed',
        outcome          text,
        proposed_times   jsonb       NOT NULL DEFAULT '[]',
        confirmed_time   timestamptz,
        confirmed_time_zone text,
        current_proposal_owner text,
        meeting_link     text,
        proposal_exchange_count integer NOT NULL DEFAULT 0,
        created_by       varchar     NOT NULL REFERENCES users(id),
        candidate_notes  text,
        internal_notes   text,
        created_at       timestamp   NOT NULL DEFAULT now(),
        updated_at       timestamp   NOT NULL DEFAULT now()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_interviews_submission_id ON interviews(submission_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status)`);
    await query(`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS current_proposal_owner text`);
    await query(`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS meeting_link text`);
    await query(`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS proposal_exchange_count integer NOT NULL DEFAULT 0`);
    await query(`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS confirmed_time_zone text`);
    const confirmedTimeType = await query(
      `SELECT data_type FROM information_schema.columns
        WHERE table_name = 'interviews' AND column_name = 'confirmed_time'`,
    );
    if (confirmedTimeType.rows[0]?.data_type === "timestamp without time zone") {
      await query(`
        ALTER TABLE interviews
          ALTER COLUMN confirmed_time TYPE timestamptz
          USING CASE
            WHEN confirmed_time IS NULL THEN NULL
            ELSE confirmed_time AT TIME ZONE 'UTC'
          END
      `);
    }
    await query(`
      UPDATE interviews
         SET confirmed_time_zone = 'UTC'
       WHERE confirmed_time IS NOT NULL AND confirmed_time_zone IS NULL
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS interview_proposals (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        interview_id    uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
        proposer_id     varchar NOT NULL REFERENCES users(id),
        proposer_role   text NOT NULL,
        action          text NOT NULL,
        proposed_times  jsonb NOT NULL DEFAULT '[]',
        selected_time   timestamptz,
        selected_time_zone text,
        created_at      timestamp NOT NULL DEFAULT now()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_interview_proposals_interview_id ON interview_proposals(interview_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_interview_proposals_created_at ON interview_proposals(created_at)`);
    await query(`ALTER TABLE interview_proposals ADD COLUMN IF NOT EXISTS selected_time_zone text`);
    const selectedTimeType = await query(
      `SELECT data_type FROM information_schema.columns
        WHERE table_name = 'interview_proposals' AND column_name = 'selected_time'`,
    );
    if (selectedTimeType.rows[0]?.data_type === "timestamp without time zone") {
      await query(`
        ALTER TABLE interview_proposals
          ALTER COLUMN selected_time TYPE timestamptz
          USING CASE
            WHEN selected_time IS NULL THEN NULL
            ELSE selected_time AT TIME ZONE 'UTC'
          END
      `);
    }
    await query(`
      UPDATE interview_proposals
         SET selected_time_zone = 'UTC'
       WHERE selected_time IS NOT NULL AND selected_time_zone IS NULL
    `);

    // Backfill ownership for pending interviews created before proposal
    // ownership was introduced. The latest proposal decides the next owner;
    // no-history rows are initial client proposals awaiting talent.
    await query(`
      UPDATE interviews i
         SET current_proposal_owner = CASE
           WHEN latest.proposer_role = 'talent' THEN 'client'
           ELSE 'talent'
         END,
             updated_at = NOW()
        FROM (
          SELECT DISTINCT ON (interview_id) interview_id, proposer_role
            FROM interview_proposals
           ORDER BY interview_id, created_at DESC, id DESC
        ) latest
       WHERE i.id = latest.interview_id
         AND i.current_proposal_owner IS NULL
         AND i.status IN ('proposed', 'rescheduled')
    `);
    await query(`
      UPDATE interviews
         SET current_proposal_owner = 'talent',
             updated_at = NOW()
       WHERE current_proposal_owner IS NULL
         AND status IN ('proposed', 'rescheduled')
    `);
    console.log("✅ Migration: pending interview proposal owners backfilled");

    // offers — client creates; talent responds
    await query(`
      CREATE TABLE IF NOT EXISTS offers (
        id                         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        submission_id              varchar       NOT NULL REFERENCES job_submissions(id) ON DELETE CASCADE,
        engagement_type            text          NOT NULL CHECK (engagement_type IN ('Lite', 'Standard')),
        rate                       numeric(12,2) NOT NULL,
        rate_currency              text          NOT NULL DEFAULT 'PHP',
        proposed_start_date        date,
        status                     text          NOT NULL DEFAULT 'sent',
        parent_offer_id            uuid,
        talent_expected_rate       numeric(12,2),
        talent_expected_currency   text,
        talent_expected_engagement text,
        rate_below_expectation     boolean,
        rate_delta                 numeric(12,2),
        sent_at                    timestamp     NOT NULL DEFAULT now(),
        responded_at               timestamp,
        expires_at                 timestamp,
        notes                      text,
        created_at                 timestamp     NOT NULL DEFAULT now(),
        updated_at                 timestamp     NOT NULL DEFAULT now()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_offers_submission_id ON offers(submission_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status)`);
    await query(`ALTER TABLE offers ADD COLUMN IF NOT EXISTS parent_offer_id uuid`);
    await query(`ALTER TABLE offers ADD COLUMN IF NOT EXISTS proposer_role text NOT NULL DEFAULT 'client'`);
    // Race safety: at most ONE pending ('sent') offer per submission, enforced by
    // the database — concurrent POST /api/client/offers cannot both insert.
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_offers_one_pending_per_submission
      ON offers(submission_id) WHERE status = 'sent'
    `);

    // hiring_contracts — admin/OnSpot-driven; linked to offers
    await query(`
      CREATE TABLE IF NOT EXISTS hiring_contracts (
        id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        offer_id         uuid        NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
        submission_id    varchar     NOT NULL REFERENCES job_submissions(id),
        template_ref     text,
        document_path    text,
        document_version integer     NOT NULL DEFAULT 1,
        status           text        NOT NULL DEFAULT 'draft',
        signing_entity   text        NOT NULL DEFAULT 'OnSpot Technologies Inc.',
        signature_provider text,
        signature_envelope_id text,
        talent_signed_at   timestamp,
        onspot_signed_at   timestamp,
        voided_at        timestamp,
        voided_reason    text,
        created_at       timestamp   NOT NULL DEFAULT now(),
        updated_at       timestamp   NOT NULL DEFAULT now()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_hiring_contracts_offer_id ON hiring_contracts(offer_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_hiring_contracts_submission_id ON hiring_contracts(submission_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_hiring_contracts_status ON hiring_contracts(status)`);
    await query(`ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS signature_provider text`);
    await query(`ALTER TABLE hiring_contracts ADD COLUMN IF NOT EXISTS signature_envelope_id text`);
    // Keep legacy 'voided' rows out of the active-offer uniqueness constraint.
    await query(`DROP INDEX IF EXISTS uq_hiring_contracts_active_offer`);
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_hiring_contracts_active_offer
      ON hiring_contracts(offer_id)
      WHERE status NOT IN ('void', 'voided')
    `);

    // Seed the signing entity into platform_settings (idempotent)
    await query(`
      INSERT INTO platform_settings (key, value)
      VALUES ('contract_signing_entity', 'OnSpot Technologies Inc.')
      ON CONFLICT (key) DO NOTHING
    `);

    // ── V1 scheduling metadata (additive, backward-compatible) ─────────────────
    await query(`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS duration_minutes integer`);
    await query(`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS cancelled_at timestamptz`);
    await query(`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS cancellation_reason text`);
    await query(`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS completed_at timestamptz`);

    console.log("✅ Migration: hiring pipeline tables ready (interviews, offers, hiring_contracts)");
  } catch (pipelineErr: any) {
    console.warn("⚠️  Hiring pipeline table migration skipped:", pipelineErr.message);
  }

  // ── Client MSA acceptance fields ───────────────────────────────────────────
  try {
    await query(`ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS msa_accepted_at timestamp`);
    await query(`ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS msa_version text`);
    console.log("✅ Migration: client MSA acceptance fields ready");
  } catch (msaColErr: any) {
    console.warn("⚠️  Client MSA migration skipped:", msaColErr.message);
  }

  // ── Add expiry_reminder_sent_at to offers (idempotent) ────────────────────
  try {
    await query(`
      ALTER TABLE offers
        ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at timestamp
    `);
    console.log("✅ Migration: offers.expiry_reminder_sent_at column ready");
  } catch (reminderColErr: any) {
    console.warn("⚠️  offers.expiry_reminder_sent_at migration skipped:", reminderColErr.message);
  }

  // ── Migrate stale engagement_type values → canonical names, rebuild constraint ─
  // IMPORTANT: the old constraint (Half-Day | Full-Time) must be DROPPED FIRST.
  // UPDATEs that write 'Standard' or 'Lite' are blocked by the old constraint
  // if we try to normalize before dropping — that is why production stayed stuck.
  // Safe order: drop → normalize approved values → safety-check → add new constraint.
  try {
    // Step 0: Drop the stale constraint so the normalizing UPDATEs are not blocked.
    // IF NOT EXISTS makes this a no-op when the constraint is already gone.
    await query(`ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_engagement_type_check`);

    // Step 1: Normalize every repository-approved legacy value.
    //   'Full-Time'  (pre-2026-08 label)  → 'Standard'
    //   'Half-Day'   (pre-2026-08 label)  → 'Lite'
    //   'full-time'  (old lowercase form) → 'Standard'
    //   'part-time'  (old lowercase form) → 'Lite'
    const ftMigration = await query(`
      UPDATE jobs SET engagement_type = 'Standard', updated_at = NOW()
      WHERE  engagement_type = 'Full-Time'
    `);
    if ((ftMigration.rowCount ?? 0) > 0) {
      console.log(`✅ Migration: normalized ${ftMigration.rowCount} jobs.engagement_type 'Full-Time' → 'Standard'`);
    }
    const hdMigration = await query(`
      UPDATE jobs SET engagement_type = 'Lite', updated_at = NOW()
      WHERE  engagement_type = 'Half-Day'
    `);
    if ((hdMigration.rowCount ?? 0) > 0) {
      console.log(`✅ Migration: normalized ${hdMigration.rowCount} jobs.engagement_type 'Half-Day' → 'Lite'`);
    }
    const ftLowerMigration = await query(`
      UPDATE jobs SET engagement_type = 'Standard', updated_at = NOW()
      WHERE  engagement_type = 'full-time'
    `);
    if ((ftLowerMigration.rowCount ?? 0) > 0) {
      console.log(`✅ Migration: normalized ${ftLowerMigration.rowCount} jobs.engagement_type 'full-time' → 'Standard'`);
    }
    const ptLowerMigration = await query(`
      UPDATE jobs SET engagement_type = 'Lite', updated_at = NOW()
      WHERE  engagement_type = 'part-time'
    `);
    if ((ptLowerMigration.rowCount ?? 0) > 0) {
      console.log(`✅ Migration: normalized ${ptLowerMigration.rowCount} jobs.engagement_type 'part-time' → 'Lite'`);
    }

    // Step 2: Pre-flight — confirm zero non-canonical rows before adding the new constraint.
    const violatingJobs = await query(
      `SELECT id, engagement_type FROM jobs
       WHERE  engagement_type IS NOT NULL
         AND  engagement_type NOT IN ('Lite', 'Standard')
       LIMIT  20`
    );
    if ((violatingJobs.rowCount ?? 0) > 0) {
      const details = violatingJobs.rows.map((r: any) => `${r.id}:${r.engagement_type}`).join(", ");
      console.error(
        `❌ Migration: cannot add jobs.engagement_type CHECK constraint — ` +
        `${violatingJobs.rowCount} row(s) still have non-canonical values: ${details}. ` +
        `Review and reclassify them manually, then restart.`
      );
    } else {
      // Step 3: Add the new canonical constraint.
      await query(`
        ALTER TABLE jobs
        ADD CONSTRAINT jobs_engagement_type_check
        CHECK (engagement_type IS NULL OR engagement_type IN ('Lite', 'Standard'))
      `);
      console.log("✅ Migration: jobs.engagement_type CHECK constraint set to (NULL | 'Lite' | 'Standard')");
    }

    // Offers engagement_type constraint: normalize any stale values then rebuild.
    await query(`
      UPDATE offers SET engagement_type = 'Standard' WHERE engagement_type = 'Full-Time'
    `);
    await query(`
      UPDATE offers SET engagement_type = 'Lite' WHERE engagement_type = 'Half-Day'
    `);
    await query(`
      UPDATE offers SET talent_expected_engagement = 'Standard' WHERE talent_expected_engagement = 'Full-Time'
    `);
    await query(`
      UPDATE offers SET talent_expected_engagement = 'Lite' WHERE talent_expected_engagement = 'Half-Day'
    `);
    await query(`ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_engagement_type_check`);
    const offersViolating = await query(
      `SELECT id, engagement_type FROM offers
       WHERE  engagement_type NOT IN ('Lite', 'Standard') LIMIT 20`
    );
    if ((offersViolating.rowCount ?? 0) > 0) {
      const details = offersViolating.rows.map((r: any) => `${r.id}:${r.engagement_type}`).join(", ");
      console.error(`❌ Migration: offers.engagement_type has non-canonical values: ${details}`);
    } else {
      await query(`
        ALTER TABLE offers
        ADD CONSTRAINT offers_engagement_type_check
        CHECK (engagement_type IN ('Lite', 'Standard'))
      `);
      console.log("✅ Migration: offers.engagement_type CHECK constraint set to ('Lite', 'Standard')");
    }

    // Step 0b: drop the now-empty non-canonical compensation columns.
    // All rows were nulled in the previous migration (Task #259). Dropping is
    // idempotent via IF EXISTS so it is safe to re-run on every restart.
    try {
      await query(`
        ALTER TABLE jobs
          DROP COLUMN IF EXISTS compensation_type,
          DROP COLUMN IF EXISTS payment_frequency,
          DROP COLUMN IF EXISTS weekly_hours,
          DROP COLUMN IF EXISTS schedule_flexibility
      `);
      console.log("✅ Migration: dropped non-canonical compensation columns (compensation_type, payment_frequency, weekly_hours, schedule_flexibility)");
    } catch (dropErr: any) {
      console.warn("⚠️  compensation column drop skipped:", dropErr.message);
    }

    // Step 1: normalize legacy status values to canonical names before the CHECK
    // constraint is added. All updates are idempotent — no-op when values are correct.

    // 'submitted' is a legacy alias for 'new' (display layer only).
    const submittedMigration = await query(`
      UPDATE job_submissions SET status = 'new', updated_at = NOW()
      WHERE status = 'submitted'
    `);
    // 'offered' → 'offer_extended'
    const offeredMigration = await query(`
      UPDATE job_submissions SET status = 'offer_extended', updated_at = NOW()
      WHERE status = 'offered'
    `);
    // 'interview' → 'interviewing'
    const interviewMigration = await query(`
      UPDATE job_submissions SET status = 'interviewing', updated_at = NOW()
      WHERE status = 'interview'
    `);
    const totalNormalized =
      (submittedMigration.rowCount ?? 0) +
      (offeredMigration.rowCount ?? 0) +
      (interviewMigration.rowCount ?? 0);
    if (totalNormalized > 0) {
      console.log(
        `✅ Migration: normalized status values — ` +
        `${submittedMigration.rowCount ?? 0} 'submitted'→'new', ` +
        `${offeredMigration.rowCount ?? 0} 'offered'→'offer_extended', ` +
        `${interviewMigration.rowCount ?? 0} 'interview'→'interviewing'`
      );
    }

    // Step 2: add the CHECK constraint.
    // First check whether it already exists so we can skip cleanly and avoid
    // the DO-block exception path, which can mask real errors on some PG versions.
    const constraintExists = await query(`
      SELECT 1 FROM pg_constraint
      WHERE  conrelid = 'job_submissions'::regclass
        AND  conname  = 'job_submissions_status_check'
      LIMIT  1
    `);

    if ((constraintExists.rowCount ?? 0) > 0) {
      // The constraint exists — check whether it already includes 'offer_expired'.
      // If not, drop it and re-add it with the full, current set of valid values.
      const hasOfferExpired = await query(`
        SELECT 1 FROM pg_constraint
        WHERE  conrelid = 'job_submissions'::regclass
          AND  conname  = 'job_submissions_status_check'
          AND  pg_get_constraintdef(oid) LIKE '%offer_expired%'
        LIMIT  1
      `);
      if ((hasOfferExpired.rowCount ?? 0) === 0) {
        // Drop old constraint and re-add with offer_expired included.
        await query(`
          ALTER TABLE job_submissions DROP CONSTRAINT job_submissions_status_check
        `);
        await query(`
          ALTER TABLE job_submissions ADD CONSTRAINT job_submissions_status_check
            CHECK (status IN (
              'new', 'invited', 'declined', 'withdrawn',
              'under_review', 'reviewed', 'shortlisted', 'rejected',
              'interviewing',
              'offer_extended', 'offer_expired', 'offer_accepted', 'offer_declined',
              'contract_sent', 'hired'
            ))
        `);
        console.log("✅ Migration: job_submissions.status CHECK constraint upgraded to include 'offer_expired'");
      } else {
        console.log("✅ Migration: job_submissions.status CHECK constraint already exists — skipping");
      }
    } else {
      // Verify no violating rows remain before adding the constraint.
      const violations = await query(`
        SELECT status, COUNT(*) AS cnt
        FROM   job_submissions
        WHERE  status NOT IN (
                 'new','invited','declined','withdrawn',
                 'under_review','reviewed','shortlisted','rejected',
                 'interviewing',
                 'offer_extended','offer_accepted','offer_declined',
                 'contract_sent','hired'
               )
        GROUP  BY status
      `);
      if ((violations.rowCount ?? 0) > 0) {
        console.error(
          "❌ Migration: cannot add CHECK constraint — violating rows exist:",
          violations.rows.map((r: any) => `${r.status}×${r.cnt}`).join(", ")
        );
      } else {
        await query(`
          ALTER TABLE job_submissions ADD CONSTRAINT job_submissions_status_check
            CHECK (status IN (
              'new', 'invited', 'declined', 'withdrawn',
              'under_review', 'reviewed', 'shortlisted', 'rejected',
              'interviewing',
              'offer_extended', 'offer_expired', 'offer_accepted', 'offer_declined',
              'contract_sent', 'hired'
            ))
        `);
        console.log("✅ Migration: job_submissions.status CHECK constraint added");
      }
    }
  } catch (statusCheckErr: any) {
    console.error("❌ job_submissions.status CHECK constraint migration failed:", statusCheckErr.message);
  }

  // ── admin_file_access_log — audit trail for scoped admin bypass on private hiring docs ──
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS admin_file_access_log (
        id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        object_path  text        NOT NULL,
        accessed_by  text        NOT NULL REFERENCES users(id),
        accessed_at  timestamptz NOT NULL DEFAULT NOW(),
        context_note text
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_admin_file_access_log_accessed_by
        ON admin_file_access_log(accessed_by)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_admin_file_access_log_accessed_at
        ON admin_file_access_log(accessed_at)
    `);
    console.log("✅ Migration: admin_file_access_log table ready");
  } catch (adminLogErr: any) {
    console.error("❌ admin_file_access_log migration failed:", adminLogErr.message);
  }

  // ── admin_role_changes — permanent audit trail for every admin role assignment ──
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS admin_role_changes (
        id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       varchar     NOT NULL,
        email         text        NOT NULL,
        previous_role text,
        new_role      text        NOT NULL,
        mechanism     text        NOT NULL,
        changed_by    text        NOT NULL,
        changed_at    timestamptz NOT NULL DEFAULT NOW(),
        notes         text
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_admin_role_changes_user_id ON admin_role_changes(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_admin_role_changes_changed_at ON admin_role_changes(changed_at)`);
    console.log("✅ Migration: admin_role_changes table ready");
  } catch (err: any) {
    console.error("❌ admin_role_changes migration failed:", err.message);
  }

  // ── One-time safe migration: admin_role_changes.change_type discriminator ──
  // Distinguishes 'role_change' (admin sub-role assignments) from 'vetting_status'
  // (Vetted badge grants/revocations) so the two event classes remain queryable
  // independently without conflating them in the new_role column.
  try {
    await query(`ALTER TABLE admin_role_changes ADD COLUMN IF NOT EXISTS change_type text NOT NULL DEFAULT 'role_change'`);
    console.log("✅ Migration: admin_role_changes.change_type column ready");
  } catch (migErr: any) {
    console.warn("⚠️  admin_role_changes change_type migration skipped:", migErr.message);
  }

  // ── One-time safe migration: grandfather already-Vetted contractors with is_verified ──
  // Contractors who were Vetted before the Verified tier existed are automatically
  // considered Verified. Their Vetted review was more thorough than identity-only
  // Verification. change_type = 'verification_status' so the audit history surface
  // shows the event. Applies only forward — new Vetted grants require is_verified=true.
  try {
    const toGrandfather = await query(`
      SELECT c.id, c.user_id, c.vetted_at, COALESCE(u.email, 'unknown') AS email
      FROM candidates c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.is_vetted = true AND (c.is_verified IS NULL OR c.is_verified = false)
    `);
    if (toGrandfather.rows.length > 0) {
      await query(`
        UPDATE candidates
        SET is_verified = true,
            verified_at = COALESCE(vetted_at, NOW()),
            verified_by_mechanism = 'grandfathered_pre_verified'
        WHERE is_vetted = true AND (is_verified IS NULL OR is_verified = false)
      `);
      for (const row of toGrandfather.rows) {
        await query(
          `INSERT INTO admin_role_changes
             (user_id, email, previous_role, new_role, mechanism, changed_by, notes, change_type)
           VALUES ($1, $2, 'unverified', 'verified', 'grandfathered_pre_verified', 'system',
                   'Grandfathered: was Vetted before Verified tier existed', 'verification_status')`,
          [row.user_id, row.email]
        );
      }
      console.log(`✅ Migration: grandfathered ${toGrandfather.rows.length} Vetted contractor(s) with is_verified=true`);
    } else {
      console.log("✅ Migration: no Vetted contractors needed grandfathering");
    }
  } catch (migErr: any) {
    console.warn("⚠️  verification grandfathering migration skipped:", migErr.message);
  }

  // ── Phase 0: admin_sub_role column on users ───────────────────────────────
  // Values: NULL = super-admin (bypass), 'talent_acquisition', 'client_success'.
  // All current admins default to NULL — no behavioral change until Phase 5
  // sub-role assignments are confirmed and requireAdminSubRole is uncommented
  // at the 6 call sites tracked in Task #271.
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_sub_role VARCHAR`);
    console.log("✅ Migration: users.admin_sub_role column ready");
  } catch (err: any) {
    console.error("❌ admin_sub_role migration failed:", err.message);
  }

  // ── One-time bootstrap: convert 5 internal @onspotglobal.com accounts to admin ──
  // Guarded by platform_settings flag — runs exactly once per environment.
  // Consequence acknowledged by Nur Amina 2026-08-18: each account loses its
  // current Client/Talent portal access (role is exclusive, not additive).
  try {
    const bootstrapFlag = await query(
      `SELECT value FROM platform_settings WHERE key = 'admin_bootstrap_v1_done' LIMIT 1`
    );
    if (bootstrapFlag.rows.length === 0 || bootstrapFlag.rows[0].value !== "true") {
      const bootstrapAccounts = [
        "val@onspotglobal.com",
        "nur@onspotglobal.com",
        "emmanuel@onspotglobal.com",
        "odie.galang@onspotglobal.com",
        "mark.apostol@onspotglobal.com",
      ];
      for (const acctEmail of bootstrapAccounts) {
        const row = await query(
          `SELECT id, email, role FROM users WHERE lower(email) = lower($1) LIMIT 1`,
          [acctEmail]
        );
        if (row.rows.length === 0) {
          console.log(`⏭️  Admin bootstrap: ${acctEmail} not found in this environment — skipping`);
          continue;
        }
        const { id, email: canonEmail, role: prevRole } = row.rows[0];
        if (prevRole === "admin") {
          console.log(`⏭️  Admin bootstrap: ${canonEmail} already admin — skipping`);
          continue;
        }
        await query(`UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = $1`, [id]);
        await query(
          `INSERT INTO admin_role_changes (user_id, email, previous_role, new_role, mechanism, changed_by, notes)
           VALUES ($1, $2, $3, 'admin', 'startup_bootstrap_v1', 'system',
                  'One-time internal account bootstrap — approved by Nur Laminero 2026-08-18; role is exclusive, previous portal access acknowledged as lost')`,
          [id, canonEmail, prevRole]
        );
        console.log(`✅ Admin bootstrap: ${canonEmail} elevated ${prevRole} → admin`);
      }
      await query(
        `INSERT INTO platform_settings (key, value) VALUES ('admin_bootstrap_v1_done', 'true')
         ON CONFLICT (key) DO UPDATE SET value = 'true'`
      );
      console.log("✅ Migration: admin bootstrap v1 complete");
    } else {
      console.log("⏭️  Migration: admin bootstrap v1 already applied — skipping");
    }
  } catch (err: any) {
    console.error("❌ Admin bootstrap migration failed:", err.message);
  }

  // ── Billing engine tables — Phase 1 (Payments / Invoicing) ───────────────
  // Money model: Client pays OnSpot → OnSpot pays Talent.
  // Commission is added ON TOP of talent rate (never deducted).
  // commission_rate stored explicitly on every period/invoice row — not a
  // hardcoded constant — so a future Loyalty-tier discount is a data change only.
  try {
    // 1. payout_region_configs — per-region configurable payout rail
    await query(`
      CREATE TABLE IF NOT EXISTS payout_region_configs (
        region_code       text PRIMARY KEY,
        available_methods text[]      NOT NULL DEFAULT '{}',
        default_method    text        NOT NULL,
        currency          text        NOT NULL,
        notes             text,
        updated_at        timestamptz NOT NULL DEFAULT now()
      )
    `);

    // 2. invoice_periods — one row per billing cycle per contract; the ledger spine.
    await query(`
      CREATE TABLE IF NOT EXISTS invoice_periods (
        id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        hiring_contract_id      uuid        NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
        offer_id                uuid        NOT NULL REFERENCES offers(id)           ON DELETE RESTRICT,

        -- Billing window
        period_start            date        NOT NULL,
        period_end              date        NOT NULL,

        -- Rate snapshot (from offers.rate at period creation; never re-derived)
        talent_rate             numeric(12,2) NOT NULL,
        talent_rate_currency    text          NOT NULL DEFAULT 'PHP',

        -- Rate-adjustment engine inputs
        -- standard_period_hours = 160 (Standard) or 80 (Lite) — derived from engagement_type
        standard_period_hours   int           NOT NULL,
        extended_hours          numeric(8,2)  NOT NULL DEFAULT 0,
        deduction_hours         numeric(8,2)  NOT NULL DEFAULT 0,

        -- Derived amounts — computed by billing.ts, stored here for consistency
        -- hourly_equivalent   = talent_rate / standard_period_hours  (for extended/deduction use only)
        -- adjustedTalentPayout= talent_rate + (extended − deduction) × hourly_equivalent
        -- clientInvoiceAmount  = adjustedTalentPayout × (1 + commission_rate)
        -- commissionEarned     = clientInvoiceAmount − adjustedTalentPayout
        hourly_equivalent       numeric(12,4) NOT NULL,
        adjusted_talent_payout  numeric(12,2) NOT NULL,
        commission_rate         numeric(5,4)  NOT NULL,    -- e.g. 0.2000 for 20%
        client_invoice_amount   numeric(12,2) NOT NULL,
        commission_earned       numeric(12,2) NOT NULL,

        -- Lifecycle
        status                  text          NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft','ready','invoiced','payout_scheduled','closed')),
        notes                   text,
        created_at              timestamptz   NOT NULL DEFAULT now(),
        updated_at              timestamptz   NOT NULL DEFAULT now()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_invoice_periods_contract ON invoice_periods(hiring_contract_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_invoice_periods_status   ON invoice_periods(status)`);
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_periods_contract_dates_unique
        ON invoice_periods(hiring_contract_id, period_start, period_end)
    `);

    // Invoice number sequence — human-readable INV-YYYY-NNNN generated in Phase 2
    await query(`CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1`);

    // 3. invoices — client-facing billing document (one per invoice_period)
    await query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        period_id             uuid          REFERENCES invoice_periods(id) ON DELETE RESTRICT,
        hiring_contract_id    uuid          NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
        client_id             text          NOT NULL REFERENCES users(id),

        -- invoice_number generated as 'INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text,4,'0')
        invoice_number        text          UNIQUE,

        -- Amount mirrors invoice_periods.client_invoice_amount
        amount                numeric(12,2) NOT NULL,
        currency              text          NOT NULL DEFAULT 'PHP',
        commission_rate       numeric(5,4)  NOT NULL,   -- copied from period row for auditability

        -- Payment details
        payment_method        text          CHECK (payment_method IN ('wire','credit_card')),
        external_ref          text,         -- wire reference # or card charge ID

        -- Lifecycle
        status                text          NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','sent','paid','overdue','void')),
        issued_at             timestamptz,
        due_date              timestamptz,
        paid_at               timestamptz,
        voided_at             timestamptz,
        notes                 text,
        created_at            timestamptz   NOT NULL DEFAULT now(),
        updated_at            timestamptz   NOT NULL DEFAULT now()
      )
    `);
    // Keep customer-facing payment instructions separate from internal notes
    // and references. These additive columns support wire details and hosted
    // card checkout URLs without exposing internal ledger metadata.
    await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_instructions text`);
    await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS card_payment_url text`);
    await query(`CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices(hiring_contract_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_invoices_client   ON invoices(client_id)`);

    // 4. payouts — talent-facing disbursement record (one per invoice_period)
    await query(`
      CREATE TABLE IF NOT EXISTS payouts (
        id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        period_id             uuid          REFERENCES invoice_periods(id) ON DELETE RESTRICT,
        hiring_contract_id    uuid          NOT NULL REFERENCES hiring_contracts(id) ON DELETE RESTRICT,
        talent_id             text          NOT NULL REFERENCES users(id),

        -- Amount = invoice_periods.adjusted_talent_payout (commission never deducted)
        amount                numeric(12,2) NOT NULL,
        currency              text          NOT NULL DEFAULT 'PHP',

        -- Payout rail — per-region configurable, never hardcoded to PH
        payout_region         text          REFERENCES payout_region_configs(region_code),
        payout_method         text,         -- e.g. 'gcash','bank_transfer','wise'
        external_ref          text,         -- transaction ID or receipt reference

        -- Lifecycle
        status                text          NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','scheduled','disbursed','failed')),
        scheduled_at          timestamptz,
        disbursed_at          timestamptz,
        failed_reason         text,
        notes                 text,
        created_at            timestamptz   NOT NULL DEFAULT now(),
        updated_at            timestamptz   NOT NULL DEFAULT now()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_payouts_contract ON payouts(hiring_contract_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_payouts_talent   ON payouts(talent_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_payouts_status   ON payouts(status)`);

    // 5. security_deposits — one per hiring_contract
    // Deposit = 30 days of daily rate = (talent_rate / 20 working days) × 30
    // Status escalation ladder:
    //   pending → held → drawn → replenishment_pending → suspended → forfeited  (nonpayment breach)
    //   held → applied  (normal / mutual termination — deposit offsets final invoice)
    // CRITICAL: forfeiture applies ONLY when termination_reason = 'nonpayment_breach'.
    //           Any other termination always results in 'applied' (deposit credited).
    await query(`
      CREATE TABLE IF NOT EXISTS security_deposits (
        id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        hiring_contract_id      uuid          NOT NULL UNIQUE REFERENCES hiring_contracts(id) ON DELETE RESTRICT,

        amount                  numeric(12,2) NOT NULL,
        currency                text          NOT NULL DEFAULT 'PHP',

        -- Status lifecycle (see header comment above)
        status                  text          NOT NULL DEFAULT 'pending'
                                    CHECK (status IN (
                                      'pending',
                                      'held',
                                      'drawn',
                                      'replenishment_pending',
                                      'suspended',
                                      'forfeited',
                                      'applied',
                                      'void'
                                    )),

        -- Clock 1: Day-5 replenishment deadline (triggered by draw event)
        held_at                 timestamptz,
        drawn_at                timestamptz,
        drawn_reason            text,
        replenishment_due_at    timestamptz,    -- drawn_at + 5 days

        -- Clock 2: Day-15 suspension + cure window (separate clock, not same as Clock 1)
        suspended_at            timestamptz,
        cure_deadline_at        timestamptz,    -- suspended_at + deposit_cure_period_days (platform_settings)

        -- Terminal state disambiguation
        -- 'normal_termination' | 'mutual_end' | 'nonpayment_breach' | 'admin_void'
        terminal_reason         text,

        -- Normal-termination path (deposit credited to client's final invoice)
        notice_given_at         timestamptz,    -- when 30-day termination notice was logged
        applied_at              timestamptz,
        applied_to_invoice_id   uuid            REFERENCES invoices(id),

        -- Non-payment forfeiture path
        forfeited_at            timestamptz,

        created_at              timestamptz     NOT NULL DEFAULT now(),
        updated_at              timestamptz     NOT NULL DEFAULT now()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_security_deposits_contract ON security_deposits(hiring_contract_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_security_deposits_status   ON security_deposits(status)`);

    // ── Seed platform_settings ──────────────────────────────────────────────
    // deposit_cure_period_days: confirmed = 5 (Day 15 suspension → Day 20 forfeiture).
    // Super-Admin-updatable via platform_settings without a migration.
    await query(`
      INSERT INTO platform_settings (key, value)
      VALUES ('deposit_cure_period_days', '5')
      ON CONFLICT (key) DO NOTHING
    `);

    // ── Seed payout_region_configs ──────────────────────────────────────────
    // PH is the only active rail today; global-sourcing model means new regions
    // are added as data rows, not code changes.
    await query(`
      INSERT INTO payout_region_configs (region_code, available_methods, default_method, currency, notes)
      VALUES (
        'PH',
        ARRAY['gcash','bank_transfer','wise'],
        'bank_transfer',
        'PHP',
        'Philippines — primary sourcing region'
      )
      ON CONFLICT (region_code) DO NOTHING
    `);

    console.log("✅ Migration: billing engine tables ready (invoice_periods, invoices, payouts, security_deposits, payout_region_configs)");
  } catch (err: any) {
    console.error("❌ Billing engine migration failed:", err.message);
  }

  // ── Customer billing and talent payout views — Phase 3 ────────────────────
  // These read-only routes deliberately select an allow-list of fields. In
  // particular, commission_rate and commission_earned are never selected or
  // serialized for either audience.
  const serializeClientInvoice = (row: any) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    amount: row.amount,
    currency: row.currency,
    status: row.display_status ?? row.status,
    paymentMethod: row.payment_method ?? null,
    paymentInstructions: row.payment_instructions ?? null,
    cardPaymentUrl: row.payment_method === "credit_card" &&
      typeof row.card_payment_url === "string" &&
      /^https?:\/\//i.test(row.card_payment_url)
      ? row.card_payment_url
      : null,
    issuedAt: row.issued_at ?? null,
    dueDate: row.due_date ?? null,
    paidAt: row.paid_at ?? null,
    periodStart: row.period_start ?? null,
    periodEnd: row.period_end ?? null,
    jobTitle: row.job_title ?? null,
  });

  const getTalentBillingUserId = async (req: Request): Promise<string | null> => {
    const authenticatedUser = (req as any).user;
    if (!authenticatedUser?.id) return null;

    // Standard talent JWTs already carry the exact users.id used by payouts.
    // They must not depend on a candidate profile row existing.
    if (!(req as any).talentAuth) return authenticatedUser.id;

    // Candidate-portal JWTs carry candidates.id, so resolve that identity to
    // the linked users.id before querying the payout ledger.
    const result = await query(
      `SELECT COALESCE(c.user_id, u.id) AS user_id
         FROM candidates c
         LEFT JOIN users u ON LOWER(u.email) = LOWER(c.email)
        WHERE c.id = $1
           OR c.user_id = $1
           OR LOWER(c.email) = LOWER($2)
        ORDER BY CASE
          WHEN c.user_id = $1 THEN 0
          WHEN LOWER(c.email) = LOWER($2) THEN 1
          ELSE 2
        END
        LIMIT 1`,
      [authenticatedUser.id, authenticatedUser.email ?? ""],
    );
    return result.rows[0]?.user_id ?? null;
  };

  // GET /api/client/invoices — only invoices owned by the authenticated client.
  app.get("/api/client/invoices", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const clientId = (req as any).user?.id;
      if (!clientId) return res.status(401).json({ error: "Unauthorized" });

      const result = await query(
        `SELECT i.id, i.invoice_number, i.amount, i.currency,
                i.status, i.payment_method, i.payment_instructions,
                i.card_payment_url, i.issued_at, i.due_date, i.paid_at,
                ip.period_start, ip.period_end, j.title AS job_title,
                CASE
                  WHEN i.status = 'sent' AND i.due_date < NOW() THEN 'overdue'
                  ELSE i.status
                END AS display_status
           FROM invoices i
           LEFT JOIN invoice_periods ip ON ip.id = i.period_id
           LEFT JOIN hiring_contracts hc ON hc.id = i.hiring_contract_id
           LEFT JOIN job_submissions js ON js.id = hc.submission_id
           LEFT JOIN jobs j ON j.id = js.job_id
          WHERE i.client_id = $1
          ORDER BY COALESCE(i.due_date, i.created_at) DESC, i.created_at DESC`,
        [clientId],
      );

      return res.json(result.rows.map(serializeClientInvoice));
    } catch (err: any) {
      console.error("GET /api/client/invoices error:", err);
      return res.status(500).json({ error: "Failed to load invoices" });
    }
  });

  // GET /api/client/invoices/:id — ownership is part of the lookup so an
  // invoice belonging to another client is indistinguishable from not found.
  app.get("/api/client/invoices/:id", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const clientId = (req as any).user?.id;
      if (!clientId) return res.status(401).json({ error: "Unauthorized" });

      const result = await query(
        `SELECT i.id, i.invoice_number, i.amount, i.currency,
                i.status, i.payment_method, i.payment_instructions,
                i.card_payment_url, i.issued_at, i.due_date, i.paid_at,
                ip.period_start, ip.period_end, j.title AS job_title,
                CASE
                  WHEN i.status = 'sent' AND i.due_date < NOW() THEN 'overdue'
                  ELSE i.status
                END AS display_status
           FROM invoices i
           LEFT JOIN invoice_periods ip ON ip.id = i.period_id
           LEFT JOIN hiring_contracts hc ON hc.id = i.hiring_contract_id
           LEFT JOIN job_submissions js ON js.id = hc.submission_id
           LEFT JOIN jobs j ON j.id = js.job_id
          WHERE i.id = $1 AND i.client_id = $2
          LIMIT 1`,
        [req.params.id, clientId],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Invoice not found" });

      return res.json(serializeClientInvoice(result.rows[0]));
    } catch (err: any) {
      console.error("GET /api/client/invoices/:id error:", err);
      return res.status(500).json({ error: "Failed to load invoice" });
    }
  });

  // GET /api/talent/payouts — only payouts associated with the authenticated
  // talent's resolved users.id. No internal references or commission fields
  // are returned.
  app.get("/api/talent/payouts", authenticateJWT, requireTalent, async (req: Request, res: Response) => {
    try {
      const talentId = await getTalentBillingUserId(req);
      if (!talentId) return res.status(404).json({ error: "Talent profile not found" });

      const result = await query(
        `SELECT id, amount, currency, status, scheduled_at, disbursed_at, created_at
           FROM payouts
          WHERE talent_id = $1
          ORDER BY COALESCE(scheduled_at, created_at) DESC, created_at DESC`,
        [talentId],
      );

      return res.json(result.rows.map((row: any) => ({
        id: row.id,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        scheduledAt: row.scheduled_at ?? null,
        disbursedAt: row.disbursed_at ?? null,
        createdAt: row.created_at ?? null,
      })));
    } catch (err: any) {
      console.error("GET /api/talent/payouts error:", err);
      return res.status(500).json({ error: "Failed to load payouts" });
    }
  });

  app.get(
    "/talent-dashboard",
    authenticateJWT,
    requireTalent,
    (req: Request, res: Response) => {
      console.log(`🎯 Talent dashboard access [${(req as any).requestId}]:`, {
        userId: (req as any).user?.id,
        role: (req as any).user?.role,
      });
      // In a production app, this would render the talent dashboard or return appropriate data
      res.json({
        success: true,
        message: "Talent dashboard access granted",
        userRole: (req as any).user?.role,
        userId: (req as any).user?.id,
      });
    },
  );

  // Protected API Route Validation Endpoint
  app.get(
    "/api/validate-access",
    authenticateJWT,
    (req: Request, res: Response) => {
      console.log(`✅ Access validation [${(req as any).requestId}]:`, {
        userId: (req as any).user?.id,
        role: (req as any).user?.role,
      });
      res.json({
        success: true,
        user: (req as any).user,
        message: "Access validated successfully",
      });
    },
  );

  // Role-specific API validation endpoints for testing
  app.get(
    "/api/client-only",
    authenticateJWT,
    requireClient,
    (req: Request, res: Response) => {
      res.json({
        success: true,
        message: "Client-only API access granted",
        role: (req as any).user?.role,
      });
    },
  );

  app.get(
    "/api/talent-only",
    authenticateJWT,
    requireTalent,
    (req: Request, res: Response) => {
      res.json({
        success: true,
        message: "Talent-only API access granted",
        role: (req as any).user?.role,
      });
    },
  );

  // JWT-based signup route
  app.post("/api/signup", signupLimiter, async (req: Request, res: Response) => {
    try {
      const {
        email: rawEmail,
        username,
        password,
        first_name,
        last_name,
        role,
        company,
      } = req.body;
      const requestId = (req as any).requestId;

      // Normalize email the same way the login route does — trim + lowercase
      const email = rawEmail ? rawEmail.trim().toLowerCase() : rawEmail;

      // Debug: Log DATABASE_URL being used (mask password)
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl) {
        const maskedDbUrl = dbUrl.replace(/:([^:]+)@/, ":***@");
        console.log(
          `🗄️ Debug [${requestId}]: Using DATABASE_URL = ${maskedDbUrl}`,
        );
      } else {
        console.error(`❌ Debug [${requestId}]: DATABASE_URL not set!`);
      }

      // Debug: Log JWT_SECRET status
      const hasJwtSecret = !!process.env.JWT_SECRET;
      console.log(
        `🔑 Debug [${requestId}]: JWT_SECRET loaded = ${hasJwtSecret}`,
      );

      console.log(`🔍 Signup request received [${requestId}]:`, {
        email: email ? "***@" + email.split("@")[1] : "missing",
        username: username || "not provided",
        first_name: first_name || "missing",
        last_name: last_name || "missing",
        role: role || "missing",
        company: company || "not provided",
      });

      // Validate required fields
      if (!email || !password || !first_name || !last_name || !role) {
        const missingFields = [];
        if (!email) missingFields.push("email");
        if (!password) missingFields.push("password");
        if (!first_name) missingFields.push("first_name");
        if (!last_name) missingFields.push("last_name");
        if (!role) missingFields.push("role");

        console.error(
          `❌ Signup validation failed [${requestId}]: Missing fields:`,
          missingFields,
        );

        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
          requestId,
        });
      }

      // Validate email format
      if (!validateEmail(email)) {
        console.error(
          `❌ Email validation failed [${requestId}]: Invalid format for email:`,
          email,
        );
        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid email address (e.g., name@example.com)",
          requestId,
        });
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        console.error(
          `❌ Password validation failed [${requestId}]:`,
          passwordValidation.errors,
        );
        return res.status(400).json({
          success: false,
          message: passwordValidation.errors.join(", "),
          requestId,
        });
      }

      // Validate role — only client and talent are allowed from the public signup form
      const allowedPublicRoles = ["client", "talent"];
      if (!allowedPublicRoles.includes(role)) {
        console.error(`❌ Invalid role [${requestId}]: "${role}"`);
        return res.status(400).json({
          success: false,
          message: "Invalid account type. Please select Client or Talent.",
          requestId,
        });
      }
      // Domain enforcement: admin role requires @onspotglobal.com (defense-in-depth;
      // the allowlist above already blocks admin from public signup)
      assertAdminEmailDomain(email, role);

      // Check if user already exists
      const existingUserQuery =
        "SELECT id, email, username FROM users WHERE email = $1 OR username = $2";
      const existingUser = await query(existingUserQuery, [
        email,
        username || email,
      ]);

      if (existingUser.rows.length > 0) {
        const existing = existingUser.rows[0];
        console.error(`❌ User already exists [${requestId}]:`, {
          existingEmail: existing.email,
          existingUsername: existing.username,
          attemptedEmail: email,
          attemptedUsername: username || email,
        });

        return res.status(409).json({
          success: false,
          message: "An account with this email or username already exists",
          requestId,
        });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      console.log(`🔐 Password hashed successfully [${requestId}]`);

      // Self-verify the hash immediately — catches any server-side bcrypt issues
      const selfVerify = await verifyPassword(password, passwordHash);
      if (!selfVerify) {
        console.error(`❌ CRITICAL: bcrypt self-verification failed immediately after hashing [${requestId}]. This should never happen.`);
        return res.status(500).json({
          success: false,
          message: "An internal error occurred while securing your password. Please try again.",
          requestId,
        });
      }
      console.log(`✅ Password self-verification passed [${requestId}]`);

      // Generate user ID
      const userId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insert user into database
      const insertUserQuery = `
        INSERT INTO users (id, email, username, "first_name", "last_name", "password_hash", company, role, "created_at", "updated_at")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, email, username, "first_name", "last_name", role
      `;

      console.log(`📝 Inserting user into database [${requestId}]:`, {
        userId,
        email,
        username: username || email.split("@")[0],
        first_name,
        last_name,
        role,
        company: company || null,
      });

      const userResult = await query(insertUserQuery, [
        userId,
        email,
        username || email.split("@")[0], // Use email prefix as username if not provided
        first_name,
        last_name,
        passwordHash,
        company || null,
        role,
      ]);

      const newUser = userResult.rows[0];
      console.log(
        `🔍 Debug [${requestId}]: User inserted into database = true`,
      );

      // If user is client, create client_profiles entry
      if (role === "client") {
        const cpId = `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await query(
          `INSERT INTO client_profiles (id, user_id, company_name, contact_person, email, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (user_id) DO NOTHING`,
          [cpId, userId, company || null, `${first_name} ${last_name}`.trim(), email],
        );
        console.log(`✅ Client profile created [${requestId}]`);
      }

      // If user is talent, create profile entry + a matching candidates record
      // so they can be redirected straight to /talent-profile/:candidateId after signup.
      let talentCandidateId: string | null = null;
      let talentJwtToken: string | null = null;

      if (role === "talent") {
        const profileId = `prof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const insertProfileQuery = `
          INSERT INTO profiles (id, "user_id", "first_name", "last_name", location, languages, timezone, "created_at", "updated_at")
          VALUES ($1, $2, $3, $4, 'Global', ARRAY['English'], 'UTC', NOW(), NOW())
        `;

        console.log(`👤 Creating talent profile [${requestId}]:`, {
          profileId,
          userId,
          first_name,
          last_name,
        });

        await query(insertProfileQuery, [
          profileId,
          userId,
          first_name,
          last_name,
        ]);

        console.log(`✅ Talent profile created successfully [${requestId}]`);

        // Also create a minimal candidates record so the talent profile page
        // (/talent-profile/:id) works immediately after signup.
        // We store the same password_hash in the candidates table so that
        // /api/talent-auth/login works with the same credentials.
        try {
          const candidateResult = await query(
            `INSERT INTO candidates (full_name, email, password_hash, user_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [`${first_name} ${last_name}`.trim(), email, passwordHash, userId],
          );
          talentCandidateId = candidateResult.rows[0]?.id ?? null;
          console.log(`✅ Candidate record created for talent [${requestId}]: ${talentCandidateId}`);
        } catch (candErr: any) {
          // Non-fatal: the talent can still sign up; they just won't have a candidate record yet.
          console.warn(`⚠️ Could not create candidates row during signup [${requestId}]:`, candErr.message);
        }
      }

      console.log(`✅ User signup successful [${requestId}]:`, {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
      });

      // Generate JWT token immediately so the client can auto-login
      // without a separate /api/login round-trip.
      let jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        if (process.env.NODE_ENV === "development") {
          jwtSecret = "development-fallback-secret-not-for-production";
        } else {
          return res.status(500).json({ success: false, message: "JWT not configured" });
        }
      }

      const signupToken = jwt.sign(
        { userId: newUser.id, email: newUser.email, role: newUser.role },
        jwtSecret,
        { expiresIn: "7d" },
      );

      // For talent signups also issue a 30-day candidate JWT so the profile
      // page lets them edit their own profile without a separate login step.
      if (role === "talent" && talentCandidateId) {
        talentJwtToken = jwt.sign(
          { type: "candidate", candidateId: talentCandidateId, email },
          jwtSecret,
          { expiresIn: "30d" },
        );
        console.log(`🔑 Talent JWT issued for candidate [${requestId}]: ${talentCandidateId}`);
      }

      console.log(`🔑 JWT token generated for new user [${requestId}]`);

      res.status(201).json({
        success: true,
        token: signupToken,
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        // Talent-specific: candidateId for the /talent-profile/:id route,
        // talentToken for the candidate JWT (stored as talent_profile_token).
        candidateId: talentCandidateId,
        talentToken: talentJwtToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          role: newUser.role,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
        },
      });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Signup error [${requestId}]:`, {
        message: error.message,
        stack: error.stack,
        code: error.code,
        constraint: error.constraint,
      });

      // Handle specific database errors
      if (error.code === "23505") {
        // Unique violation
        if (error.constraint?.includes("email")) {
          return res.status(409).json({
            success: false,
            message: "An account with this email already exists",
            requestId,
          });
        }
        if (error.constraint?.includes("username")) {
          return res.status(409).json({
            success: false,
            message: "This username is already taken",
            requestId,
          });
        }
      }

      return handleRouteError(error, req, res, "Signup", 500);
    }
  });

  // JWT-based login route
  app.post("/api/login", loginLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const requestId = (req as any).requestId;

      // Debug: Log DATABASE_URL being used (mask password)
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl) {
        const maskedDbUrl = dbUrl.replace(/:([^:]+)@/, ":***@");
        console.log(
          `🗄️ Debug [${requestId}]: Using DATABASE_URL = ${maskedDbUrl}`,
        );
      } else {
        console.error(`❌ Debug [${requestId}]: DATABASE_URL not set!`);
      }

      // Debug: Log JWT_SECRET status
      const hasJwtSecret = !!process.env.JWT_SECRET;
      console.log(
        `🔑 Debug [${requestId}]: JWT_SECRET loaded = ${hasJwtSecret}`,
      );

      console.log(`🔐 Login request received [${requestId}]:`, {
        email: email ? "***@" + email.split("@")[1] : "missing",
        hasPassword: !!password,
      });

      if (!email || !password) {
        const missingFields = [];
        if (!email) missingFields.push("email");
        if (!password) missingFields.push("password");

        console.error(
          `❌ Login validation failed [${requestId}]: Missing fields:`,
          missingFields,
        );

        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
          requestId,
        });
      }

      // Normalize email — trim whitespace and lowercase
      const normalizedEmail = email.trim().toLowerCase();

      // Basic email format validation
      if (!validateEmail(normalizedEmail)) {
        console.error(`❌ Email format validation failed [${requestId}]`);
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address",
          requestId,
        });
      }

      // Find user by email (users table — Client / Admin accounts)
      const userQuery =
        'SELECT id, email, username, "first_name", "last_name", "password_hash", role, company FROM users WHERE email = $1';
      const userResult = await query(userQuery, [normalizedEmail]);

      console.log(`🔍 Debug [${requestId}]: Table checked = users, Record found = ${userResult.rows.length > 0}`);

      if (userResult.rows.length === 0) {
        console.error(
          `❌ User not found [${requestId}]: No user with email ${normalizedEmail}`,
        );
        console.log(`🔍 Debug [${requestId}]: User record found = false`);

        // Cross-portal detection: check if this email belongs to a candidate (Talent Portal)
        try {
          const candidateCheck = await query(
            'SELECT id FROM candidates WHERE email = $1 LIMIT 1',
            [normalizedEmail],
          );
          if (candidateCheck.rows.length > 0) {
            console.log(`🔍 Debug [${requestId}]: Email found in candidates table — wrong portal`);
            return res.status(401).json({
              success: false,
              error: "talent_account",
              message: "This is a Talent account. Please use the Talent Portal.",
              requestId,
            });
          }
        } catch {
          // Non-fatal — fall through to generic error
        }

        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
          requestId,
        });
      }

      console.log(`👤 User found [${requestId}]:`, {
        userId: userResult.rows[0].id,
        email: userResult.rows[0].email,
        role: userResult.rows[0].role,
      });
      console.log(`🔍 Debug [${requestId}]: User record found = true`);

      const user = userResult.rows[0];

      // Check if user has a password (OAuth users might not)
      if (!user.password_hash) {
        console.error(
          `❌ Password verification failed [${requestId}]: User ${user.id} has no password (OAuth user?)`,
        );
        return res.status(401).json({
          success: false,
          message:
            "This account was created with social login. Please use Google or LinkedIn to sign in.",
          requestId,
        });
      }

      // Verify password
      console.log(`🔐 Verifying password [${requestId}]`);
      const isPasswordValid = await verifyPassword(
        password,
        user.password_hash,
      );
      if (!isPasswordValid) {
        console.error(
          `❌ Password verification failed [${requestId}]: Password did not match for user ${user.id}`,
        );
        console.log(`🔍 Debug [${requestId}]: bcrypt.compare result = false`);
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
          requestId,
        });
      }

      console.log(`✅ Password verified successfully [${requestId}]`);
      console.log(`🔍 Debug [${requestId}]: bcrypt.compare result = true`);

      // Generate JWT token with proper secret handling and development fallback
      let jwtSecret = process.env.JWT_SECRET;

      if (!jwtSecret) {
        // Development fallback with warning
        if (process.env.NODE_ENV === "development") {
          jwtSecret = "development-fallback-secret-not-for-production";
          console.warn(
            "⚠️  Using development fallback JWT_SECRET. Please set JWT_SECRET environment variable for production!",
          );
        } else {
          console.error(
            "❌ JWT_SECRET environment variable not set! This is required for secure authentication.",
          );
          return res.status(500).json({
            success: false,
            message: "JWT not configured",
          });
        }
      }

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
        },
        jwtSecret,
        { expiresIn: "7d" },
      );

      console.log(`🔍 Debug [${requestId}]: JWT signing status = true`);

      // Return exact format required by specification - snake_case as per spec
      const userResponse = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
      };

      console.log(`✅ User login successful [${requestId}]:`, {
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.status(200).json({
        success: true,
        token,
        user: userResponse,
      });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Login error [${requestId}]:`, {
        message: error.message,
        stack: error.stack,
        code: error.code,
      });

      // Handle specific errors
      if (error.message?.includes("password")) {
        return res.status(401).json({
          success: false,
          message: "Authentication failed",
          requestId,
        });
      }

      return handleRouteError(error, req, res, "Login", 500);
    }
  });
  // Protected Lead Intake - Client Only
  app.get(
    "/api/lead-intakes",
    authenticateJWT,
    requireClient,
    async (req: Request, res: Response) => {
      try {
        const leads = await storage.searchLeadIntakes({});
        console.log(`📋 Lead intakes accessed [${(req as any).requestId}]:`, {
          userId: (req as any).user?.id,
          role: (req as any).user?.role,
          count: leads.length,
        });
        res.json({ success: true, leads });
      } catch (error: any) {
        handleRouteError(error, req as Request, res, "Get Lead Intakes", 500);
      }
    },
  );

  // Manual GHL Sync Trigger - Admin Only
  app.post(
    "/api/ghl/sync",
    authenticateJWT,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { ghlSyncService } = await import('./services/ghlSyncService');
        console.log(`🔄 Manual GHL sync triggered [${(req as any).requestId}]:`, {
          userId: (req as any).user?.id,
          role: (req as any).user?.role,
        });
        
        await ghlSyncService.triggerManualSync();
        
        res.json({ 
          success: true, 
          message: 'GHL sync completed successfully' 
        });
      } catch (error: any) {
        handleRouteError(error, req as Request, res, "Manual GHL Sync", 500);
      }
    },
  );

  // Protected User Profile Routes
  app.get(
    "/api/user/profile",
    authenticateJWT,
    requireAnyRole,
    async (req: Request, res: Response) => {
      try {
        const profile = await storage.getProfileByUserId((req as any).user!.id);
        res.json({ success: true, profile });
      } catch (error: any) {
        handleRouteError(error, req as Request, res, "Get User Profile", 500);
      }
    },
  );

  // Auth routes - Updated for OAuth compatibility with enhanced error handling
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({
          error: "Not authenticated",
          message: "Please log in to access this resource",
          requestId: req.requestId,
        });
      }

      let user;

      // Handle OAuth users (Google/LinkedIn/Dev)
      if (req.user && req.user.user) {
        user = req.user.user;
        const provider = req.user.provider || "unknown";
        console.log(
          `✅ ${provider.toUpperCase()} user authenticated [${req.requestId}]:`,
          {
            id: user.id,
            email: user.email,
            provider: provider,
          },
        );

        // For dev login, make sure user exists in storage
        if (provider === "dev") {
          try {
            const storedUser = await storage.getUser(user.id);
            if (!storedUser) {
              console.warn(
                `⚠️ Dev user not found in storage, creating: ${user.id}`,
              );
              await storage.upsertUser(user);
            }
          } catch (error) {
            console.error(
              `❌ Error checking/creating dev user [${req.requestId}]:`,
              error,
            );
          }
        }
      }
      // Handle Replit Auth users
      else if (req.user && req.user.claims) {
        const userId = req.user.claims.sub;
        user = await storage.getUser(userId);
        console.log(`✅ Replit Auth user authenticated [${req.requestId}]:`, {
          id: userId,
        });
      } else {
        console.error(
          `❌ Unknown user type in session [${req.requestId}]:`,
          req.user,
        );
        return res.status(401).json({
          error: "Invalid session",
          message: "Session format not recognized",
          requestId: req.requestId,
        });
      }

      if (!user) {
        return res.status(404).json({
          error: "User not found",
          message: "User account not found in database",
          requestId: req.requestId,
        });
      }

      // Return user data with auth provider info
      res.json({
        ...user,
        authProvider: (req.user as any).provider || "replit",
      });
    } catch (error) {
      handleRouteError(error, req, res, "Get current user", 500);
    }
  });

  // Alternative endpoint name for better frontend compatibility
  app.get("/api/me", async (req: any, res) => {
    // Reuse the same logic as /api/auth/user
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      let user;

      // Handle OAuth users (Google/LinkedIn)
      if (req.user && req.user.user) {
        user = req.user.user;
      }
      // Handle Replit Auth users
      else if (req.user && req.user.claims) {
        const userId = req.user.claims.sub;
        user = await storage.getUser(userId);
      } else {
        return res.status(401).json({ message: "Invalid session" });
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        ...user,
        authProvider: (req.user as any).provider || "replit",
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // OAuth error handling route
  app.get("/api/auth/error", (req, res) => {
    const { error, provider, message } = req.query;
    res.json({
      error: error || "oauth_error",
      provider: provider || "unknown",
      message: message || "Authentication failed. Please try again.",
      support: "Contact support@onspotglobal.com for assistance",
      retry: true,
    });
  });

  // Health check route returning exact format required by specification
  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  // === VANESSA CHAT (OpenAI Assistant) ===
  
  // Rate limiter for chat endpoint
  const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
    message: "Too many chat requests, please try again later.",
  });

  // Non-streaming chat endpoint
  app.post(
    "/api/chat",
    chatLimiter,
    validateRequest(
      z.object({
        message: z.string().min(1).max(2000),
        threadId: z.string().optional(),
      })
    ),
    async (req: any, res: Response) => {
      try {
        const { message, threadId } = req.body;

        console.log(`💬 Chat request [${req.requestId}]:`, {
          message: message.substring(0, 50) + "...",
          threadId: threadId || "new",
        });

        const response = await sendMessageToAssistant(message, threadId);

        res.json({
          message: response.message,
          threadId: response.threadId,
        });
      } catch (error: any) {
        console.error(`❌ Chat error [${req.requestId}]:`, error);
        res.status(500).json({
          error: "Failed to get response from assistant",
          message: error.message,
          requestId: req.requestId,
        });
      }
    }
  );

  // Streaming chat endpoint
  app.post(
    "/api/chat/stream",
    chatLimiter,
    validateRequest(
      z.object({
        message: z.string().min(1).max(2000),
        threadId: z.string().optional(),
      })
    ),
    async (req: any, res: Response) => {
      try {
        const { message, threadId } = req.body;

        console.log(`💬 Chat stream request [${req.requestId}]:`, {
          message: message.substring(0, 50) + "...",
          threadId: threadId || "new",
        });

        // Set headers for SSE (Server-Sent Events)
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // Stream the response
        for await (const chunk of streamMessageToAssistant(message, threadId)) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        res.write("data: [DONE]\n\n");
        res.end();
      } catch (error: any) {
        console.error(`❌ Chat stream error [${req.requestId}]:`, error);
        res.write(`data: ${JSON.stringify({ type: "error", data: error.message })}\n\n`);
        res.end();
      }
    }
  );

  // ===== Vanessa AI Conversation Logs API Routes =====
  
  // GET /api/vanessa/responses - Get all conversation threads
  app.get("/api/vanessa/responses", async (req: any, res) => {
    try {
      const threads = await storage.getAllVanessaThreads();
      res.json({ success: true, threads });
    } catch (error: any) {
      console.error(`❌ Error fetching Vanessa threads [${req.requestId}]:`, error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch conversation threads",
        requestId: req.requestId 
      });
    }
  });

  // GET /api/vanessa/responses/:threadId - Get messages for a specific thread
  app.get("/api/vanessa/responses/:threadId", async (req: any, res) => {
    try {
      const { threadId } = req.params;
      const messages = await storage.getVanessaLogsByThread(threadId);
      res.json({ success: true, messages });
    } catch (error: any) {
      console.error(`❌ Error fetching thread messages [${req.requestId}]:`, error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch thread messages",
        requestId: req.requestId 
      });
    }
  });

  // GET /api/vanessa/search - Search conversation logs
  app.get("/api/vanessa/search", async (req: any, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Search query is required" 
        });
      }

      const results = await storage.searchVanessaLogs(query);
      res.json({ success: true, results });
    } catch (error: any) {
      console.error(`❌ Error searching Vanessa logs [${req.requestId}]:`, error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to search conversation logs",
        requestId: req.requestId 
      });
    }
  });

  // DELETE /api/vanessa/responses/:threadId - Delete a conversation thread
  app.delete("/api/vanessa/responses/:threadId", async (req: any, res) => {
    try {
      const { threadId } = req.params;
      const deleted = await storage.deleteVanessaThread(threadId);
      
      if (!deleted) {
        return res.status(404).json({ 
          success: false, 
          error: "Thread not found" 
        });
      }

      console.log(`🗑️ Deleted Vanessa thread [${req.requestId}]: ${threadId}`);
      res.json({ 
        success: true, 
        message: `Deleted thread ${threadId}` 
      });
    } catch (error: any) {
      console.error(`❌ Error deleting thread [${req.requestId}]:`, error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to delete thread",
        requestId: req.requestId 
      });
    }
  });

  // ===== Learning System API Routes =====

  // Helper function to extract topic/keyword from text
  function extractTopic(userMessage: string, comment?: string): string | null {
    // Combine user message and comment for topic extraction
    const text = `${userMessage} ${comment || ""}`.toLowerCase();
    
    // Common stopwords to filter out
    const stopwords = new Set([
      "the", "is", "at", "which", "on", "a", "an", "and", "or", "but",
      "in", "with", "to", "for", "of", "as", "by", "from", "about",
      "should", "would", "could", "can", "will", "be", "are", "was",
      "were", "been", "have", "has", "had", "do", "does", "did",
      "this", "that", "these", "those", "it", "its", "they", "them",
      "their", "i", "you", "we", "he", "she", "my", "your", "our"
    ]);
    
    // Extract meaningful words
    const words = text
      .replace(/[^\w\s]/g, " ") // Remove punctuation
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopwords.has(word));
    
    // Return first meaningful word as topic
    return words.length > 0 ? words[0] : null;
  }

  // POST /api/feedback - Submit user feedback for a message (public for development)
  app.post(
    "/api/feedback",
    validateRequest(
      z.object({
        messageId: z.string().min(1),
        threadId: z.string().min(1),
        rating: z.enum(["up", "down"]),
        comment: z.string().max(500).optional(),
      })
    ),
    async (req: any, res) => {
      try {
        const { messageId, threadId, rating, comment } = req.body;

        // Get conversation context from database
        const conversationLogs = await storage.getVanessaLogsByThread(threadId);
        const recentLog = conversationLogs[conversationLogs.length - 1];
        
        const userMessage = recentLog?.userMessage || "";
        const assistantResponse = recentLog?.assistantResponse || "";

        // Extract topic from user message or comment
        const topic = extractTopic(userMessage, comment);

        // Save feedback to PostgreSQL
        const feedback = await storage.createFeedback({
          threadId,
          messageId,
          userMessage,
          assistantResponse,
          rating,
          comment: comment || null,
          topic: topic || null,
        });

        console.log(`🧠 Feedback saved to database for topic: ${topic || "(no topic)"}`);

        // Count feedbacks for this topic
        let shouldTriggerLearning = false;
        let topicCount = 0;

        if (topic) {
          topicCount = await storage.getFeedbackCountByTopic(topic);
          console.log(`📊 Topic "${topic}" has ${topicCount} feedback(s)`);

          // Auto-trigger learning loop if we have 2 or more feedbacks for this topic
          if (topicCount >= 2) {
            shouldTriggerLearning = true;
            console.log(`⚙️ Detected ${topicCount} similar feedbacks (topic: ${topic})`);
            console.log(`🔁 Running learning loop automatically... [${req.requestId}]`);
            
            // Run learning loop in background (don't wait for it)
            runLearningLoop()
              .then(() => {
                console.log(`✅ Vanessa updated vanessa_knowledge.txt with new information about: ${topic}`);
              })
              .catch((error) => {
                console.error(`❌ Auto-learning failed [${req.requestId}]:`, error);
              });
          }
        }

        res.json({ 
          success: true, 
          message: "Feedback received",
          topic: topic || null,
          topicCount,
          autoLearningTriggered: shouldTriggerLearning,
        });
      } catch (error: any) {
        console.error(`❌ Error storing feedback [${req.requestId}]:`, error);
        res.status(500).json({
          success: false,
          error: "Failed to store feedback",
          requestId: req.requestId,
        });
      }
    }
  );

  // GET /api/feedback - Get all feedback (admin only)
  app.get("/api/feedback", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      const feedback = await storage.getAllFeedbacks();
      res.json({ success: true, feedback });
    } catch (error: any) {
      console.error(`❌ Error fetching feedback [${req.requestId}]:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch feedback",
        requestId: req.requestId,
      });
    }
  });

  // GET /api/feedback/all - Get all feedback from database (admin only)
  app.get("/api/feedback/all", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      const feedback = await storage.getAllFeedbacks();
      const stats = await storage.getFeedbackStats();
      
      res.json({ 
        success: true, 
        feedback,
        stats,
      });
    } catch (error: any) {
      console.error(`❌ Error fetching feedback history [${req.requestId}]:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch feedback history",
        requestId: req.requestId,
      });
    }
  });

  // GET /api/feedback/stats - Get feedback statistics (admin only)
  app.get("/api/feedback/stats", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getFeedbackStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      console.error(`❌ Error fetching feedback stats [${req.requestId}]:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch feedback stats",
        requestId: req.requestId,
      });
    }
  });

  // POST /api/learn - Ingest knowledge files from /resources/knowledge/ (admin only)
  app.post("/api/learn", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      console.log(`📚 Knowledge ingestion started [${req.requestId}]`);
      const result = await ingestKnowledgeFiles();

      res.json({
        success: result.success,
        summaries: result.summaries,
        errors: result.errors,
        message: `Processed ${result.summaries} knowledge files`,
      });
    } catch (error: any) {
      console.error(`❌ Error ingesting knowledge [${req.requestId}]:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to ingest knowledge",
        requestId: req.requestId,
      });
    }
  });

  // GET /api/learn/knowledge - Get all knowledge summaries (admin only)
  app.get("/api/learn/knowledge", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      const knowledge = await dbManager.getAllKnowledge();
      res.json({ success: true, knowledge });
    } catch (error: any) {
      console.error(`❌ Error fetching knowledge [${req.requestId}]:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch knowledge",
        requestId: req.requestId,
      });
    }
  });

  // POST /api/learn/summarize - Run learning loop analysis (admin only)
  app.post("/api/learn/summarize", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      console.log(`🔄 Learning loop triggered [${req.requestId}]`);
      const summary = await runLearningLoop();

      res.json({
        success: true,
        summary,
        message: "Learning loop completed successfully",
      });
    } catch (error: any) {
      console.error(`❌ Error running learning loop [${req.requestId}]:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to run learning loop",
        requestId: req.requestId,
      });
    }
  });

  // GET /api/learn/summary - Get latest learning summary (admin only)
  app.get("/api/learn/summary", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      const summary = await dbManager.getLatestLearningSummary();
      res.json({ success: true, summary });
    } catch (error: any) {
      console.error(`❌ Error fetching learning summary [${req.requestId}]:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch learning summary",
        requestId: req.requestId,
      });
    }
  });

  // GET /api/learn/stats - Get database statistics (admin only)
  app.get("/api/learn/stats", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      const stats = await dbManager.getDatabaseStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      console.error(`❌ Error fetching stats [${req.requestId}]:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch statistics",
        requestId: req.requestId,
      });
    }
  });

  // GET /api/learn/status - Get recent learning run statuses (admin only)
  app.get("/api/learn/status", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      const statuses = await dbManager.getRecentLearningStatuses(5);
      res.json({ success: true, statuses });
    } catch (error: any) {
      console.error(`❌ Error fetching learning statuses [${req.requestId}]:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch learning statuses",
        requestId: req.requestId,
      });
    }
  });

  // GET /api/learn/health - Get learning health metrics (admin only)
  app.get("/api/learn/health", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      // Try to get cached health metrics first
      let health = await dbManager.getLearningHealth();
      
      // If no cached metrics, calculate them
      if (!health) {
        health = await dbManager.calculateLearningHealth();
      }
      
      res.json({ success: true, health });
    } catch (error: any) {
      console.error(`❌ Error fetching learning health [${req.requestId}]:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch learning health",
        requestId: req.requestId,
      });
    }
  });

  // GET /api/learn/summary/latest - Get latest learning summary with metadata (admin only)
  app.get("/api/learn/summary/latest", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      const summary = await dbManager.getLatestLearningSummary();
      
      if (!summary) {
        return res.status(404).json({
          success: false,
          error: "No learning summary found",
          requestId: req.requestId,
        });
      }

      // Format response with metadata
      const response = {
        summaryKey: "learning_summary:latest",
        generatedAt: summary.date,
        feedbackCount: summary.totalFeedback,
        summaryText: summary.insights.join(" ").substring(0, 200),
        insights: summary.insights,
        improvementAreas: summary.improvementAreas,
        topPositiveTopics: summary.topPositiveTopics,
        commonIssues: summary.commonIssues,
        positiveCount: summary.positiveCount,
        negativeCount: summary.negativeCount,
      };
      
      res.json({ success: true, summary: response });
    } catch (error: any) {
      console.error(`❌ Error fetching latest summary [${req.requestId}]:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch latest summary",
        requestId: req.requestId,
      });
    }
  });

  // POST /api/train/correct - Submit admin correction for Vanessa training (admin only)
  app.post(
    "/api/train/correct",
    authenticateJWT,
    requireAdmin,
    validateRequest(
      z.object({
        logId: z.number().int().positive(),
        correctedText: z.string().min(1, "Corrected text is required"),
      }),
    ),
    async (req: any, res) => {
      try {
        const { logId, correctedText } = req.body;
        const adminId = req.user?.id || 1; // Use default admin ID in development

        // Retrieve the conversation log
        const conversationLog = await storage.getVanessaLog(logId);
        
        if (!conversationLog) {
          return res.status(404).json({
            success: false,
            error: "Conversation log not found",
            requestId: req.requestId,
          });
        }

        // Extract topic from correctedText
        const topic = dbManager.extractTopicFromCorrection(correctedText);

        // Save correction to database
        const correction = await storage.createCorrection({
          logId,
          topic,
          correctedText,
          adminId,
        });

        // Update Replit DB memory for instant recall
        await dbManager.storeMemory(topic, correctedText);
        console.log(`🧠 Admin correction received → topic: ${topic}`);

        // Update vanessa_knowledge.txt
        const fs = await import("fs/promises");
        const path = await import("path");
        const knowledgeFilePath = path.join(process.cwd(), "resources", "vanessa_knowledge.txt");
        
        try {
          const timestamp = new Date().toISOString().split('T')[0];
          const correctionSection = `\n\n=== Correction (${timestamp}) ===\nTopic: ${topic}\nVanessa should say: "${correctedText}"\n=== End Correction ===\n`;
          
          await fs.appendFile(knowledgeFilePath, correctionSection);
          console.log(`✅ Vanessa knowledge updated successfully.`);
        } catch (fileError: any) {
          console.error(`⚠️ Failed to update knowledge file:`, fileError);
          // Continue even if file update fails - memory is already updated
        }

        res.json({
          success: true,
          correction,
          message: "Correction submitted successfully. Vanessa will remember this.",
          requestId: req.requestId,
        });
      } catch (error: any) {
        console.error(`❌ Error submitting correction [${req.requestId}]:`, error);
        res.status(500).json({
          success: false,
          error: "Failed to submit correction",
          requestId: req.requestId,
        });
      }
    },
  );

  // POST /api/train/chat/stream - Stream conversational training with Vanessa (admin only)
  app.post(
    "/api/train/chat/stream",
    authenticateJWT,
    requireAdmin,
    validateRequest(
      z.object({
        message: z.string().min(1, "Message is required"),
        threadId: z.string().optional(), // Reuse the training thread across sends
      }),
    ),
    async (req: any, res) => {
      try {
        const { message, threadId: incomingThreadId } = req.body;
        const adminId = req.user?.id || 1; // Use default admin ID in development

        if (incomingThreadId) {
          console.log(`🎓 [TrainingChat] Reusing training thread: ${incomingThreadId} | message: "${message.substring(0, 50)}..."`);
        } else {
          console.log(`🎓 [TrainingChat] Creating new training thread | message: "${message.substring(0, 50)}..."`);
        }

        // Set up SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        let fullResponse = "";

        try {
          // Stream response from OpenAI — pass threadId so the same training session
          // stays in one OpenAI thread and appears as one conversation in /admin/vanessa-responses
          for await (const chunk of streamWithAssistant(message, incomingThreadId)) {
            if (chunk.type === "threadId") {
              // Forward the threadId to the frontend so it can reuse it on the next send
              res.write(`data: ${JSON.stringify({ type: "threadId", threadId: chunk.data })}\n\n`);
            } else if (chunk.type === "content") {
              fullResponse += chunk.data;
              res.write(`data: ${JSON.stringify({ text: chunk.data })}\n\n`);
            }
          }

          // Send done signal
          res.write("data: [DONE]\n\n");
          res.end();

          // Detect if this was a correction (for logging purposes only)
          // Note: streamWithAssistant already handles correction storage and knowledge base updates
          const isCorrectionDetected = dbManager.isCorrection(message);
          const topic = isCorrectionDetected ? dbManager.extractTopicFromCorrection(message) : null;

          // Save training log to database
          await storage.createTrainingLog({
            adminId,
            userMessage: message,
            aiResponse: fullResponse,
            isCorrection: isCorrectionDetected,
            topic,
          });

          if (isCorrectionDetected && topic) {
            console.log(`🔧 Correction logged in training_logs: ${topic}`);
          }

          console.log(`✅ Training chat completed successfully`);
        } catch (error: any) {
          console.error(`❌ Error in training stream [${req.requestId}]:`, error);
          res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
          res.end();
        }
      } catch (error: any) {
        console.error(`❌ Error in training chat [${req.requestId}]:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: "Failed to process training chat",
            requestId: req.requestId,
          });
        }
      }
    },
  );

  // POST /api/site/reindex - Trigger manual site crawl (admin only)
  app.post("/api/site/reindex", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      console.log(`🔁 Admin triggered manual site reindex [${req.requestId}]`);

      // Import crawler dynamically
      const { crawlWebsite } = await import("./services/siteCrawler");

      // Run crawl in background
      crawlWebsite()
        .then((siteIndex) => {
          console.log(
            `🌐 Site crawl completed at ${siteIndex.lastUpdated} — ${siteIndex.totalPages} pages indexed`
          );
        })
        .catch((error) => {
          console.error(`❌ Site crawl failed [${req.requestId}]:`, error);
        });

      res.json({
        success: true,
        message: "Site reindexing started in background",
        requestId: req.requestId,
      });
    } catch (error: any) {
      console.error(`❌ Error starting reindex [${req.requestId}]:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to start reindexing",
        requestId: req.requestId,
      });
    }
  });

  // ── RAG Admin Endpoints ──────────────────────────────────────────────────────
  // These endpoints allow admins to manage Vanessa's semantic knowledge base.

  // GET /api/rag/status — check index health
  app.get("/api/rag/status", async (req: any, res) => {
    try {
      const { getRagStatus } = await import("./services/ragService");
      const status = await getRagStatus();
      res.json({ success: true, ...status });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/rag/reindex — full re-crawl + rebuild RAG index from scratch
  app.post("/api/rag/reindex", async (req: any, res) => {
    try {
      console.log(`🔁 RAG full reindex triggered [${req.requestId}]`);
      const { crawlWebsite } = await import("./services/siteCrawler");

      // crawlWebsite() already triggers buildRagIndex internally at the end
      crawlWebsite()
        .then((siteIndex) =>
          console.log(`🌐 RAG reindex crawl done: ${siteIndex.totalPages} pages`)
        )
        .catch((err) => console.error(`❌ RAG reindex failed:`, err.message));

      res.json({
        success: true,
        message: "RAG reindex started — crawling site then building embeddings in background",
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/rag/reindex-url — add or re-index a single URL
  app.post("/api/rag/reindex-url", async (req: any, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ success: false, error: "url is required" });
      }

      console.log(`🔁 Single-URL RAG reindex: ${url} [${req.requestId}]`);

      const axios = (await import("axios")).default;
      const cheerio = await import("cheerio");

      const response = await axios.get(url, {
        timeout: 12000,
        headers: { "User-Agent": "OnSpot-Vanessa-Bot/1.0" },
      });

      const $ = cheerio.load(response.data);
      const title = $("title").text().trim() || $("h1").first().text().trim() || url;

      // Strip boilerplate before extracting full text
      $(
        "nav, footer, header, script, style, noscript, iframe, " +
        "[class*='nav'], [class*='footer'], [class*='cookie'], [class*='banner']"
      ).remove();
      const root = $("main, article, [role='main']");
      const fullText = (root.length ? root : $("body"))
        .find("h1,h2,h3,h4,h5,h6,p,li,td,th,dt,dd,blockquote,figcaption")
        .map((_: any, el: any) => $(el).text().trim())
        .get()
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      const { addPageToRagIndex } = await import("./services/ragService");
      await addPageToRagIndex({ url, title, fullText });

      res.json({ success: true, message: `Page indexed: ${url}`, title, chunksEstimate: Math.ceil(fullText.length / 600) });
    } catch (error: any) {
      console.error(`❌ Single-URL RAG reindex failed:`, error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/rag/pages — list all indexed pages and chunk counts
  app.get("/api/rag/pages", async (req: any, res) => {
    try {
      const { loadRagIndex } = await import("./services/ragService");
      const index = await loadRagIndex();
      if (!index) {
        return res.json({ success: true, pages: [], totalChunks: 0, lastUpdated: null });
      }

      // Group chunks by URL, tagging type
      const pageMap = new Map<string, { url: string; title: string; chunkCount: number; lastIndexed: string; isKnowledge?: boolean; isContent?: boolean; isJob?: boolean }>();
      for (const chunk of index.chunks) {
        const existing = pageMap.get(chunk.url);
        if (existing) {
          existing.chunkCount++;
        } else {
          pageMap.set(chunk.url, {
            url: chunk.url,
            title: chunk.title,
            chunkCount: 1,
            lastIndexed: chunk.lastIndexed,
            isKnowledge: !!chunk.isKnowledge,
            isContent: !!chunk.isContent,
            isJob: !!chunk.isJob,
          });
        }
      }

      res.json({
        success: true,
        lastUpdated: index.lastUpdated,
        totalChunks: index.totalChunks,
        embeddingModel: index.embeddingModel,
        jobsLastIndexed: index.jobsLastIndexed ?? null,
        pages: Array.from(pageMap.values()).sort((a, b) => a.url.localeCompare(b.url)),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/rag/reindex-knowledge — re-index only resources/vanessa_knowledge.txt
  app.post("/api/rag/reindex-knowledge", async (req: any, res) => {
    try {
      console.log(`📖 Knowledge file reindex triggered [${req.requestId}]`);
      const { indexKnowledgeFile, invalidateRagCache } = await import("./services/ragService");
      invalidateRagCache();

      // Run in background (embedding can take a few seconds)
      indexKnowledgeFile()
        .then(r => console.log(`✅ Knowledge file reindexed: ${r.chunksAdded} chunks`))
        .catch(err => console.error(`❌ Knowledge reindex failed:`, err.message));

      res.json({
        success: true,
        message: "Knowledge file reindexing started in background (vanessa_knowledge.txt)",
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/rag/reindex-site — re-index only website pages (preserves knowledge chunks)
  app.post("/api/rag/reindex-site", async (req: any, res) => {
    try {
      console.log(`🌐 Site-only RAG reindex triggered [${req.requestId}]`);
      const { crawlWebsite } = await import("./services/siteCrawler");

      crawlWebsite()
        .then(si => console.log(`🌐 Site reindex complete: ${si.totalPages} pages`))
        .catch(err => console.error(`❌ Site reindex failed:`, err.message));

      res.json({
        success: true,
        message: "Site reindex started — crawling pages and rebuilding embeddings in background",
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/admin/update-vanessa-knowledge — regenerate platform_knowledge.auto.txt (admin only)
  app.post("/api/admin/update-vanessa-knowledge", authenticateJWT, requireAdmin, async (req: any, res) => {
    try {
      console.log(`📚 Platform knowledge update triggered by admin [${req.requestId}]`);
      const { savePlatformKnowledge, validatePlatformKnowledge } = await import("./services/knowledgeBaseUpdater");
      const result = await savePlatformKnowledge();

      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error });
      }

      const validation = validatePlatformKnowledge();
      res.json({
        success: true,
        message: "Platform knowledge updated successfully",
        filePath: result.filePath,
        timestamp: result.timestamp,
        validation,
      });
    } catch (error: any) {
      console.error(`❌ Platform knowledge update failed:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/rag/reindex-content — re-index resources/website_content.txt (Layer 2)
  app.post("/api/rag/reindex-content", async (req: any, res) => {
    try {
      console.log(`📄 Website content RAG reindex triggered [${req.requestId}]`);
      const { indexWebsiteContent, invalidateRagCache } = await import("./services/ragService");
      invalidateRagCache();

      // Run in background (embedding can take a minute)
      indexWebsiteContent()
        .then(r => console.log(`✅ Website content reindexed: ${r.chunksAdded} chunks`))
        .catch(err => console.error(`❌ Content reindex failed:`, err.message));

      res.json({
        success: true,
        message: "Website content reindexing started in background (website_content.txt)",
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/rag/reindex-jobs — re-index all open job listings from the database
  app.post("/api/rag/reindex-jobs", async (req: any, res) => {
    try {
      console.log(`💼 Job listings RAG reindex triggered [${req.requestId}]`);
      const { indexJobListings, invalidateRagCache } = await import("./services/ragService");
      invalidateRagCache();

      indexJobListings()
        .then(r => console.log(`💼 Job reindex complete: ${r.jobsIndexed} jobs, ${r.chunksAdded} chunks`))
        .catch(err => console.error(`❌ Job reindex failed:`, err.message));

      res.json({
        success: true,
        message: "Job listings reindex started — reading from database and rebuilding embeddings in background",
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/rag/search — test semantic search (dev/admin tool)
  app.post("/api/rag/search", async (req: any, res) => {
    try {
      const { query, topK = 5 } = req.body;
      if (!query) return res.status(400).json({ success: false, error: "query is required" });

      const { searchRag } = await import("./services/ragService");
      const chunks = await searchRag(query, Number(topK));

      res.json({
        success: true,
        query,
        totalResults: chunks.length,
        chunks: chunks.map((c) => ({
          url: c.url,
          title: c.title,
          content: c.content,
          chunkIndex: c.chunkIndex,
          lastIndexed: c.lastIndexed,
          isKnowledge: !!c.isKnowledge,
          isContent: !!(c as any).isContent,
          isJob: !!c.isJob,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Enhanced development login endpoint with validation and monitoring
  app.post(
    "/api/dev/login",
    validateRequest(
      z.object({
        email: z.string().email("Valid email address required"),
        userType: z.enum(["talent", "client"]).optional().default("talent"),
      }),
    ),
    async (req: any, res) => {
      // Only allow in development environment
      if (process.env.NODE_ENV === "production") {
        console.warn(
          `🚫 Production dev login attempt blocked [${req.requestId}]`,
          {
            ip: req.ip,
            userAgent: req.get("User-Agent"),
          },
        );
        return res.status(403).json({
          error: "Development login not available in production",
          requestId: req.requestId,
        });
      }

      try {
        const { email, userType } = req.body;

        // Create or get mock user for development
        const mockUserId = `dev_${email.replace("@", "_").replace(".", "_")}`;
        const mockUser = {
          id: mockUserId,
          email: email,
          firstName: email.split("@")[0],
          lastName: "DevUser",
          role: userType || "talent",
          profileImageUrl: null,
        };

        // Store user in database
        await storage.upsertUser(mockUser);

        // CRITICAL: Use req.login() to establish proper server session
        req.login({ user: mockUser, provider: "dev" }, (err: any) => {
          if (err) {
            console.error(
              `🚨 Dev login session error [${req.requestId}]:`,
              err,
            );

            // Log session creation failure for monitoring
            if (process.env.SENTRY_DSN) {
              Sentry.captureException(err, {
                tags: {
                  operation: "dev_login_session",
                  requestId: req.requestId,
                  userId: mockUserId,
                },
              });
            }

            return res.status(500).json({
              error: "Failed to create session",
              requestId: req.requestId,
            });
          }

          console.log(`✅ Dev login successful [${req.requestId}]:`, {
            email,
            userId: mockUserId,
            userType,
          });

          res.json({
            success: true,
            user: mockUser,
            message: "Development login successful",
            sessionEstablished: true,
          });
        });
      } catch (error) {
        handleRouteError(error, req, res, "Development login", 500);
      }
    },
  );

  // POST /api/object-storage/upload-url - Generate presigned S3 URL for file uploads
  app.post(
    "/api/object-storage/upload-url",
    authenticateJWT,
    async (req: any, res) => {
      try {
        const { fileName, contentType } = req.body;

        console.log(`📤 Upload URL request [${req.requestId}]:`, {
          fileName,
          contentType,
        });

        // Validate required parameters
        if (!fileName || !contentType) {
          console.error(`❌ Missing parameters [${req.requestId}]:`, {
            fileName,
            contentType,
          });
          return res
            .status(400)
            .json({ error: "fileName and contentType required" });
        }

        // Use Replit Object Storage
        const objectStorageService = new ObjectStorageService();
        const { uploadUrl, objectPath } = await objectStorageService.getObjectEntityUploadURL();

        // Response format required by ObjectUploader.tsx
        const response = {
          url: uploadUrl,
          method: "PUT",
          headers: { "Content-Type": contentType },
          fileUrl: objectPath, // Return the permanent path, not the temporary signed URL
        };

        console.log(`✅ Signed URL generated [${req.requestId}]:`, { objectPath });
        res.json(response);
      } catch (error: any) {
        console.error(
          `❌ S3 upload URL generation failed [${req.requestId}]:`,
          {
            error: error.message,
            stack: error.stack,
          },
        );
        res.status(500).json({ error: "Failed to generate upload URL" });
      }
    },
  );

  // POST /api/object-storage/upload - Direct file upload to Replit Object Storage
  app.post(
    "/api/object-storage/upload",
    authenticateJWT,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        const file = req.file;

        if (!file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        console.log(`📤 Direct upload request [${req.requestId}]:`, {
          userId,
          fileName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        });

        // Use Replit Object Storage
        const objectStorageService = new ObjectStorageService();
        const objectId = randomUUID();
        const objectPath = `/objects/uploads/${objectId}`;

        // Upload file buffer to object storage
        const privateObjectDir = objectStorageService.getPrivateObjectDir();
        if (!privateObjectDir) {
          throw new Error("PRIVATE_OBJECT_DIR not configured");
        }

        const fullPath = `${privateObjectDir}/uploads/${objectId}`;
        const parts = fullPath.split("/").filter(p => p);
        const bucketName = parts[0];
        const objectName = parts.slice(1).join("/");
        
        const bucket = objectStorageClient.bucket(bucketName);
        const objectFile = bucket.file(objectName);

        // Upload the file
        await objectFile.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
            metadata: {
              originalName: file.originalname,
              uploadedBy: userId,
              uploadedAt: new Date().toISOString(),
            },
          },
        });

        // Set ACL for the uploaded file
        const aclPolicy = {
          visibility: "private" as const,
          owner: userId,
        };
        await setObjectAclPolicy(objectFile, aclPolicy);

        console.log(`✅ File uploaded successfully [${req.requestId}]:`, { objectPath });

        res.json({
          success: true,
          fileUrl: objectPath,
          fileName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        });
      } catch (error: any) {
        console.error(`❌ Upload failed [${req.requestId}]:`, {
          error: error.message,
          stack: error.stack,
        });
        res.status(500).json({ error: "Failed to upload file" });
      }
    },
  );

  // Object Storage File Retrieval with ACL
  app.get("/api/objects/:objectPath(*)", authenticateJWT, async (req: any, res) => {
    const userId = req.user?.id || req.user?.claims?.sub;
    const userRole = req.user?.role;
    const objectStorageService = new ObjectStorageService();
    try {
      // Get the path parameter (e.g., "uploads/123")
      let objectPath = req.params.objectPath;
      
      // Normalize to canonical path format: /objects/{path}
      // Handle case where path might already have "objects/" prefix
      if (objectPath.startsWith("objects/")) {
        objectPath = objectPath.substring(8); // Remove "objects/" prefix
      }
      const canonicalPath = `/objects/${objectPath}`;
      
      console.log(`📁 File retrieval request [${req.requestId}]:`, { rawPath: req.params.objectPath, canonicalPath });

      const objectFile = await objectStorageService.getObjectEntityFile(canonicalPath);

      // ── Scoped admin bypass for hiring-pipeline documents ─────────────────
      // Admins reviewing applications need read access to private resumes and
      // video intros. This bypass is intentionally scoped to the two hiring-doc
      // path prefixes only — all other private objects (profile photos, etc.)
      // continue to use the standard canAccessObjectEntity check.
      //
      // IMPORTANT: the audit row is written BEFORE the file streams.
      // A failed write blocks the download — access without a trace is not acceptable.
      const isHiringDoc =
        objectPath.startsWith("application-resumes/") ||
        objectPath.startsWith("application-videos/");

      if (isHiringDoc && userRole === "admin" && userId) {
        await query(
          `INSERT INTO admin_file_access_log (object_path, accessed_by, context_note)
           VALUES ($1, $2, $3)`,
          [canonicalPath, userId, "admin bypass — hiring pipeline document"],
        );
        console.log(`✅ Admin file access logged and granted [${req.requestId}]:`, { userId, path: canonicalPath });
        await objectStorageService.downloadObject(objectFile, res);
        return;
      }
      // ─────────────────────────────────────────────────────────────────────

      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: undefined, // defaults to READ
      });
      if (!canAccess) {
        console.log(`❌ Access denied [${req.requestId}]:`, { userId, path: canonicalPath });
        return res.sendStatus(401);
      }
      console.log(`✅ File access granted [${req.requestId}]:`, { userId, path: canonicalPath });
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error(`❌ Object retrieval error [${req.requestId}]:`, error);
      if ((error as any).name === "ObjectNotFoundError") {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // POST /api/talent/import - Talent Import from Resume/CSV
  app.post("/api/talent/import", authenticateJWT, async (req: any, res) => {
    try {
      const { fileUrl, fileName, type, fileContent } = req.body;
      const userId = req.user.id;

      if (!fileName) {
        return res.status(400).json({ success: false, error: "Missing fileName parameter" });
      }

      console.log(`📄 Talent import started for user ${userId}`, { fileName, type });

      // Determine file type
      const fileExtension = fileName.toLowerCase().split(".").pop();
      let textContent = "";
      let parsedData: any = {};

      // 1. Get file content
      if (fileContent) {
        textContent = fileContent;
        console.log(`📄 Using provided file content (${textContent.length} bytes)`);
      } else if (fileUrl) {
        console.log(`⬇️ Downloading file from ${fileUrl}`);
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Failed to download file");
        textContent = await response.text();
        console.log(`📄 File content fetched (${textContent.length} bytes)`);
      } else {
        return res.status(400).json({ success: false, error: "Either fileUrl or fileContent is required" });
      }

      // 2. Parse based on file type
      if (fileExtension === "csv") {
        console.log(`📊 Parsing CSV file: ${fileName}`);
        
        const parseResult = Papa.parse(textContent, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
        });

        if (parseResult.errors && parseResult.errors.length > 0) {
          return res.status(400).json({
            success: false,
            error: "CSV parsing failed",
            details: parseResult.errors,
          });
        }

        // For CSV: only process first row for single talent import
        const row = parseResult.data[0] as any;
        if (!row) {
          return res.status(400).json({
            success: false,
            error: "No data found in CSV file",
          });
        }

        parsedData = {
          firstName: row.first_name?.trim() || row.firstName?.trim(),
          lastName: row.last_name?.trim() || row.lastName?.trim(),
          title: row.title?.trim(),
          bio: row.bio?.trim(),
          location: row.location?.trim(),
          skills: row.skills
            ? row.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
            : [],
        };
      } else {
        // For PDF/resume files: save document without parsing
        console.log(`📄 Processing resume file: ${fileName}`);
        console.log(`⚠️ PDF/DOCX parsing not yet implemented - saving document only`);
        
        // Save document and inform user to manually update profile
        try {
          const documentId = uuidv4();
          await query(
            `INSERT INTO documents (id, user_id, type, file_name, file_url, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
            [documentId, userId, type || "resume", fileName, fileUrl || "local"]
          );
        } catch (docError: any) {
          console.log(`⚠️ Document save failed:`, docError.message);
        }

        return res.json({
          success: true,
          message: "Resume uploaded successfully. Please update your profile manually as automatic parsing is not yet available for PDF/DOCX files.",
          requiresManualUpdate: true,
        });
      }

      console.log("🔍 Parsed data:", parsedData);

      // 3. Upsert into profiles table using direct SQL
      const profileResult = await query(
        `
        INSERT INTO profiles (user_id, first_name, last_name, title, bio, location, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET 
          first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
          last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
          title = COALESCE(EXCLUDED.title, profiles.title),
          bio = COALESCE(EXCLUDED.bio, profiles.bio),
          location = COALESCE(EXCLUDED.location, profiles.location),
          updated_at = NOW()
        RETURNING id;
        `,
        [
          userId,
          parsedData.firstName,
          parsedData.lastName,
          parsedData.title || null,
          parsedData.bio || null,
          parsedData.location || null
        ]
      );
      const profileId = profileResult.rows[0].id;

      // 4. Upsert skills
      if (parsedData.skills && parsedData.skills.length > 0) {
        // Delete existing skills first
        await query(`DELETE FROM user_skills WHERE user_id = $1`, [userId]);
        
        // Insert new skills
        for (const skillName of parsedData.skills) {
          // First, find or create the skill in the skills table
          let skillResult = await query(
            `SELECT id FROM skills WHERE LOWER(name) = LOWER($1) LIMIT 1`,
            [skillName]
          );
          
          let skillId;
          if (skillResult.rows.length > 0) {
            skillId = skillResult.rows[0].id;
          } else {
            // Create new skill
            const newSkillResult = await query(
              `INSERT INTO skills (name, category, created_at) VALUES ($1, $2, NOW()) RETURNING id`,
              [skillName, 'Technical']
            );
            skillId = newSkillResult.rows[0].id;
          }
          
          // Now link the skill to the user
          await query(
            `INSERT INTO user_skills (user_id, skill_id, level, years_experience, created_at) 
             VALUES ($1, $2, $3, $4, NOW())`,
            [userId, skillId, 'intermediate', 0]
          );
        }
      }

      // 5. Save document reference
      try {
        const documentId = uuidv4();
        await query(
          `INSERT INTO documents (id, user_id, type, file_name, file_url, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
          [documentId, userId, type || "resume", fileName, fileUrl || "local"]
        );
      } catch (docError: any) {
        // Ignore duplicate document errors, just log them
        console.log(`⚠️ Document insert skipped (may already exist):`, docError.message);
      }

      console.log(`✅ Talent profile updated for user ${userId}`);

      res.json({
        success: true,
        message: "Talent profile updated from resume",
        profileId,
        importedSkills: parsedData.skills || [],
      });

    } catch (error: any) {
      console.error("❌ Talent import failed:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to import resume",
      });
    }
  });

  // PHASE 1 PRIORITY ROUTES

  // ====== DOCUMENTS ======
  // GET /api/talent/me/resume-status - Check if authenticated talent has a resume and/or video intro
  // Replaces the legacy /api/documents fetch used only for the hasResume/hasVideoIntro profile-completion checks.
  app.get("/api/talent/me/resume-status", authenticateJWT, async (req: any, res) => {
    try {
      const email = req.user?.email;
      if (!email) return res.status(401).json({ error: "Authentication required" });

      const row = await query(
        `SELECT resume_url AS "resumeUrl", video_intro_url AS "videoIntroUrl"
         FROM candidates WHERE lower(email) = lower($1) LIMIT 1`,
        [email],
      );
      const resumeUrl: string | null = row.rows[0]?.resumeUrl ?? null;
      const videoIntroUrl: string | null = row.rows[0]?.videoIntroUrl ?? null;
      res.json({ hasResume: !!resumeUrl, resumeUrl, hasVideoIntro: !!videoIntroUrl, videoIntroUrl });
    } catch (error) {
      handleRouteError(error, req, res, "Get talent resume status", 500);
    }
  });

  // PATCH /api/talent/me/resume-url - Persist a resume URL (from presigned-URL upload) to the candidate profile
  app.patch("/api/talent/me/resume-url", authenticateJWT, async (req: any, res) => {
    try {
      const email = req.user?.email;
      if (!email) return res.status(401).json({ error: "Authentication required" });
      const { fileUrl, fileName } = req.body;
      if (!fileUrl) return res.status(400).json({ error: "fileUrl is required" });
      const result = await query(
        `UPDATE candidates SET resume_url = $1, resume_file_name = $2, updated_at = NOW()
         WHERE lower(email) = lower($3)`,
        [fileUrl, fileName ?? null, email],
      );
      if ((result.rowCount ?? 0) === 0) {
        return res.status(404).json({ error: "Candidate profile not found — please complete your profile setup first." });
      }
      res.json({ success: true, resumeUrl: fileUrl, resumeFileName: fileName ?? null });
    } catch (error) {
      handleRouteError(error, req, res, "Update talent resume URL", 500);
    }
  });

  // PATCH /api/talent/me/video-intro-url - Persist a video intro URL (from presigned-URL upload) to the candidate profile
  app.patch("/api/talent/me/video-intro-url", authenticateJWT, async (req: any, res) => {
    try {
      const email = req.user?.email;
      if (!email) return res.status(401).json({ error: "Authentication required" });
      const { fileUrl, fileName } = req.body;
      if (!fileUrl) return res.status(400).json({ error: "fileUrl is required" });
      const result = await query(
        `UPDATE candidates SET video_intro_url = $1, video_intro_file_name = $2, updated_at = NOW()
         WHERE lower(email) = lower($3)`,
        [fileUrl, fileName ?? null, email],
      );
      if ((result.rowCount ?? 0) === 0) {
        return res.status(404).json({ error: "Candidate profile not found — please complete your profile setup first." });
      }
      res.json({ success: true, videoIntroUrl: fileUrl, videoIntroFileName: fileName ?? null });
    } catch (error) {
      handleRouteError(error, req, res, "Update talent video intro URL", 500);
    }
  });

  // ====== USERS ======
  app.get(
    "/api/users/:id",
    validateRequest(
      z.object({ id: z.string().min(1, "User ID required") }),
      "params",
    ),
    async (req: any, res) => {
      try {
        console.log(`🔍 Fetching user [${req.requestId}]:`, {
          userId: req.params.id,
        });
        const user = await storage.getUser(req.params.id);
        if (!user) {
          return res.status(404).json({
            error: "User not found",
            message: "No user exists with the provided ID",
            requestId: req.requestId,
          });
        }
        res.json(user);
      } catch (error) {
        handleRouteError(error, req, res, "Get user by ID", 500);
      }
    },
  );

  app.get("/api/users/username/:username", async (req, res) => {
    try {
      const user = await storage.getUserByUsername(req.params.username);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.post(
    "/api/users",
    authenticateJWT,
    requireAdmin,
    validateRequest(insertUserSchema),
    async (req: Request, res: Response) => {
      try {
        console.log(`👤 Creating new user [${req.requestId}]:`, {
          email: req.body.email,
          role: req.body.role,
        });
        const validated = insertUserSchema.parse(req.body);
        const user = await storage.createUser(validated);

        console.log(`✅ User created successfully [${req.requestId}]:`, {
          userId: user.id,
        });
        res.status(201).json(user);
      } catch (error) {
        handleRouteError(error, req, res, "Create user", 500);
      }
    },
  );

  app.patch(
    "/api/users/:id",
    validateRequest(z.object({ id: z.string().min(1) }), "params"),
    validateRequest(insertUserSchema.partial()),
    async (req: any, res) => {
      try {
        console.log(`✏️ Updating user [${req.requestId}]:`, {
          userId: req.params.id,
          updateFields: Object.keys(req.body),
        });

        const updates = insertUserSchema.partial().parse(req.body);
        const user = await storage.updateUser(req.params.id, updates);

        if (!user) {
          return res.status(404).json({
            error: "User not found",
            message: "No user exists with the provided ID",
            requestId: req.requestId,
          });
        }

        console.log(`✅ User updated successfully [${req.requestId}]:`, {
          userId: user.id,
        });
        res.json(user);
      } catch (error) {
        handleRouteError(error, req, res, "Update user", 500);
      }
    },
  );

  // ====== PROFILES ======

  // GET /api/profiles/me - Get current user's profile (must come before /:id route)
  app.get(
    "/api/profiles/me",
    authenticateJWT,
    async (req: Request, res: Response) => {
      try {
        const requestId = (req as any).requestId;
        const userId = (req as any).user?.id;

        if (!userId) {
          return res.status(401).json({
            error: "Authentication required",
            message: "User not authenticated",
            requestId,
          });
        }

        console.log(`👤 Fetching current user profile [${requestId}]:`, {
          userId,
        });

        // Query database using Drizzle ORM
        const result = await db
          .select()
          .from(profiles)
          .where(eq(profiles.userId, userId));

        if (result.length === 0) {
          // Create a default profile for the user instead of returning 404
          console.log(
            `➕ Creating default profile for new user [${requestId}]:`,
            { userId },
          );

          const defaultProfileData = {
            userId: userId,
            firstName: "",
            lastName: "",
            location: "Global",
            rateCurrency: "USD",
            availability: "available",
            languages: ["English"],
            timezone: "UTC",
          };

          const newProfile = await db
            .insert(profiles)
            .values(defaultProfileData)
            .returning();
          const profile = newProfile[0];

          console.log(
            `✅ Default profile created successfully [${requestId}]:`,
            { profileId: profile.id },
          );

          return res.json({
            success: true,
            profile: profile, // Drizzle automatically returns camelCase
          });
        }

        const profile = result[0];

        console.log(
          `✅ Current user profile fetched successfully [${requestId}]:`,
          { profileId: profile.id },
        );

        res.json({
          success: true,
          profile: profile, // Drizzle automatically returns camelCase
        });
      } catch (error: any) {
        const requestId = (req as any).requestId;
        console.error(
          `❌ Failed to fetch current user profile [${requestId}]:`,
          error.message,
        );
        res.status(500).json({
          success: false,
          message: error.message,
          requestId,
        });
      }
    },
  );

  // PUT /api/profiles/me - Update current user's profile (must come before /:id route)
  console.log("✅ Registered route: PUT /api/profiles/me");
  app.put(
    "/api/profiles/me",
    authenticateJWT,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).user?.id;
        const requestId = (req as any).requestId;

        if (!userId) {
          return res.status(401).json({
            error: "Authentication required",
            message: "User not authenticated",
            requestId,
          });
        }

        console.log(`👤 Updating current user profile [${requestId}]:`, {
          userId: userId,
          updateFields: Object.keys(req.body),
          bodyData: req.body,
        });

        // Prepare profile data (already in camelCase, which Drizzle expects)
        // NOTE: profilePicture is intentionally excluded — use POST/DELETE /api/profiles/me/photo
        const profileData = {
          userId: userId, // Add userId from authenticated session
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          title: req.body.title,
          bio: req.body.bio,
          location: req.body.location,
          hourlyRate: req.body.hourlyRate ? String(req.body.hourlyRate) : null,
          rateCurrency: req.body.rateCurrency,
          availability: req.body.availability,
          phoneNumber: req.body.phoneNumber,
          languages: req.body.languages,
          timezone: req.body.timezone,
        };

        console.log(
          `🔍 Profile data for validation [${requestId}]:`,
          profileData,
        );

        // Validate the data using Drizzle schema
        const validated = insertProfileSchema.parse(profileData);

        // Check if profile already exists for this user using Drizzle ORM
        const existingProfile = await db
          .select()
          .from(profiles)
          .where(eq(profiles.userId, userId));

        let profile;

        if (existingProfile.length > 0) {
          // Update existing profile
          console.log(`📝 Updating existing profile [${requestId}]:`, {
            profileId: existingProfile[0].id,
          });

          // Prepare update data with defaults (profilePicture excluded — managed by photo endpoint)
          const updateData = {
            firstName: validated.firstName,
            lastName: validated.lastName,
            title: validated.title,
            bio: validated.bio,
            location: validated.location || "Global",
            hourlyRate: validated.hourlyRate,
            rateCurrency: validated.rateCurrency || "USD",
            availability: validated.availability || "available",
            phoneNumber: validated.phoneNumber,
            languages: validated.languages || ["English"],
            timezone: validated.timezone || "UTC",
          };

          const updatedProfiles = await db
            .update(profiles)
            .set(updateData)
            .where(eq(profiles.userId, userId))
            .returning();

          profile = updatedProfiles[0];
        } else {
          // Create new profile
          console.log(`➕ Creating new profile [${requestId}]`);

          // Set defaults for required fields (profilePicture starts null — managed by photo endpoint)
          const insertData = {
            userId: userId,
            firstName: validated.firstName,
            lastName: validated.lastName,
            title: validated.title,
            bio: validated.bio,
            location: validated.location || "Global",
            hourlyRate: validated.hourlyRate,
            rateCurrency: validated.rateCurrency || "USD",
            availability: validated.availability || "available",
            profilePicture: null,
            phoneNumber: validated.phoneNumber,
            languages: validated.languages || ["English"],
            timezone: validated.timezone || "UTC",
          };

          const insertedProfiles = await db
            .insert(profiles)
            .values(insertData)
            .returning();
          profile = insertedProfiles[0];
        }

        // Dual-write: mirror rateAmount + rateEngagementType into candidates.preferences
        // so the match scorer sees data entered through onboarding forms, not just Settings.
        // Use profileData.hourlyRate (pre-parse string) — insertProfileSchema may return
        // Decimal/undefined for this field, making validated.hourlyRate falsy.
        const rawHourlyRate = profileData.hourlyRate;
        const rawRateEngagementType = req.body.rateEngagementType
          ? String(req.body.rateEngagementType)
          : null;
        const rawRateCurrency = profileData.rateCurrency
          ? String(profileData.rateCurrency)
          : null;
        if (rawHourlyRate || rawRateEngagementType) {
          const prefPatch: Record<string, string> = {};
          if (rawHourlyRate) prefPatch.rateAmount = rawHourlyRate;
          if (rawRateEngagementType) prefPatch.rateEngagementType = rawRateEngagementType;
          if (rawRateCurrency) prefPatch.rateCurrency = rawRateCurrency;
          await query(
            `UPDATE candidates
             SET preferences = COALESCE(preferences, '{}'::jsonb)
               || $1::jsonb
             WHERE user_id = $2`,
            [JSON.stringify(prefPatch), userId],
          );
        }

        console.log(
          `✅ Current user profile updated successfully [${requestId}]:`,
          { profileId: profile.id },
        );
        res.json({
          success: true,
          profile: profile, // Drizzle automatically returns camelCase
          message: "Profile saved successfully",
        });

        // Option C trigger A: recompute job matches after profile/preferences save.
        // Fire-and-forget — does not delay the response.
        setImmediate(() => {
          storage.getCandidateByUserId(userId)
            .then(c => { if (c?.id) return (storage as any).recomputeMatchesForTalent(c.id); })
            .catch((err: any) => console.error("❌ Background match recompute (profile save):", err));
        });
      } catch (error: any) {
        const requestId = (req as any).requestId;
        console.error(
          `❌ Failed to update current user profile [${requestId}]:`,
          error.message,
        );
        res.status(500).json({
          success: false,
          message: error.message,
          requestId,
        });
      }
    },
  );

  app.get("/api/profiles/:id", async (req, res) => {
    try {
      const profile = await storage.getProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  app.get(
    "/api/profiles/user/:userId",
    authenticateJWT,
    async (req: Request, res: Response) => {
      try {
        const requestId = (req as any).requestId;
        const userId = req.params.userId;
        const authUserId = (req as any).user?.id;

        // Users can only access their own profile (or admins can access any)
        if (authUserId !== userId && (req as any).user?.role !== "admin") {
          return res.status(403).json({
            success: false,
            message: "Access denied",
            requestId,
          });
        }

        console.log(`👤 Fetching profile [${requestId}]:`, { userId });

        // Query database directly for profile
        const profileQuery = `
          SELECT id, user_id, first_name, last_name, title, bio, location, 
                 hourly_rate, rate_currency, availability, profile_picture, 
                 phone_number, languages, timezone, rating, total_earnings, 
                 job_success_score, created_at, updated_at
          FROM profiles 
          WHERE user_id = $1
        `;

        const result = await query(profileQuery, [userId]);

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Profile not found",
            requestId,
          });
        }

        const profile = result.rows[0];
        console.log(`✅ Profile fetched successfully [${requestId}]:`, {
          profileId: profile.id,
        });

        res.json({
          success: true,
          profile,
        });
      } catch (error: any) {
        const requestId = (req as any).requestId;
        console.error(
          `❌ Failed to fetch profile [${requestId}]:`,
          error.message,
        );
        res.status(500).json({
          success: false,
          message: error.message,
          requestId,
        });
      }
    },
  );

  app.post(
    "/api/profiles",
    authenticateJWT,
    requireAnyRole,
    async (req: Request, res: Response) => {
      try {
        const userId = (req as any).user?.id;
        const requestId = (req as any).requestId;

        if (!userId) {
          return res.status(401).json({
            success: false,
            message: "Authentication required",
            requestId,
          });
        }

        console.log(`👤 Creating/updating profile [${requestId}]:`, {
          userId: userId,
        });

        // Add userId from authenticated session to the request body
        const dataWithUserId = {
          ...req.body,
          userId: userId,
        };

        // Validate the complete data including userId
        const validated = insertProfileSchema.parse(dataWithUserId);

        // Check if profile already exists for this user
        const existingProfileQuery = `
          SELECT id FROM profiles WHERE user_id = $1
        `;
        const existingResult = await query(existingProfileQuery, [userId]);

        let profile;

        if (existingResult.rows.length > 0) {
          // Update existing profile
          const profileId = existingResult.rows[0].id;
          console.log(`📝 Updating existing profile [${requestId}]:`, {
            profileId,
          });

          const updateQuery = `
            UPDATE profiles 
            SET first_name = $2, last_name = $3, title = $4, bio = $5, 
                location = $6, hourly_rate = $7, rate_currency = $8, 
                availability = $9, phone_number = $10, languages = $11, 
                timezone = $12, updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `;

          const updateParams = [
            profileId,
            validated.firstName,
            validated.lastName,
            validated.title,
            validated.bio,
            validated.location || "Global",
            validated.hourlyRate,
            validated.rateCurrency || "USD",
            validated.availability || "available",
            validated.phoneNumber,
            validated.languages || ["English"],
            validated.timezone || "UTC",
          ];

          const updateResult = await query(updateQuery, updateParams);
          profile = updateResult.rows[0];
        } else {
          // Create new profile
          console.log(`➕ Creating new profile [${requestId}]`);

          const insertQuery = `
            INSERT INTO profiles (user_id, first_name, last_name, title, bio, 
                                location, hourly_rate, rate_currency, availability, 
                                phone_number, languages, timezone, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
            RETURNING *
          `;

          const insertParams = [
            userId,
            validated.firstName,
            validated.lastName,
            validated.title,
            validated.bio,
            validated.location || "Global",
            validated.hourlyRate,
            validated.rateCurrency || "USD",
            validated.availability || "available",
            validated.phoneNumber,
            validated.languages || ["English"],
            validated.timezone || "UTC",
          ];

          const insertResult = await query(insertQuery, insertParams);
          profile = insertResult.rows[0];
        }

        console.log(`✅ Profile saved successfully [${requestId}]:`, {
          profileId: profile.id,
        });
        res.status(201).json({
          success: true,
          profile,
        });
      } catch (error: any) {
        const requestId = (req as any).requestId;
        console.error(
          `❌ Failed to save profile [${requestId}]:`,
          error.message,
        );
        res.status(500).json({
          success: false,
          message: error.message,
          requestId,
        });
      }
    },
  );

  app.patch(
    "/api/profiles/:id",
    validateRequest(z.object({ id: z.string().min(1) }), "params"),
    validateRequest(insertProfileSchema.partial()),
    async (req: any, res) => {
      try {
        console.log(`📝 Updating profile [${req.requestId}]:`, {
          profileId: req.params.id,
          updateFields: Object.keys(req.body),
        });

        const updates = insertProfileSchema.partial().parse(req.body);
        const profile = await storage.updateProfile(req.params.id, updates);

        if (!profile) {
          return res.status(404).json({
            error: "Profile not found",
            message: "No profile exists with the provided ID",
            requestId: req.requestId,
          });
        }

        console.log(`✅ Profile updated successfully [${req.requestId}]:`, {
          profileId: profile.id,
        });
        res.json(profile);
      } catch (error) {
        handleRouteError(error, req, res, "Update profile", 500);
      }
    },
  );

  // Advanced Profile Search - Critical for talent discovery
  app.get("/api/profiles/search", async (req, res) => {
    try {
      const filters = {
        location: req.query.location as string,
        skills: req.query.skills
          ? (req.query.skills as string).split(",")
          : undefined,
        availability: req.query.availability as string,
        minRate: req.query.minRate ? Number(req.query.minRate) : undefined,
        maxRate: req.query.maxRate ? Number(req.query.maxRate) : undefined,
        rating: req.query.rating ? Number(req.query.rating) : undefined,
      };
      const profiles = await storage.searchProfiles(filters);
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to search profiles" });
    }
  });

  // ====== LEAD INTAKE ======
  app.post(
    "/api/lead-intake",
    validateRequest(insertLeadIntakeSchema),
    async (req, res) => {
      try {
        console.log(
          `📝 Lead intake submission started [${(req as any).requestId}]:`,
          {
            email: req.body.email,
            company: req.body.companyName,
            serviceType: req.body.serviceType,
            urgencyLevel: req.body.urgencyLevel,
            budgetRange: req.body.budgetRange,
          },
        );

        // Create lead intake with automatic scoring
        const leadIntake = await storage.createLeadIntake(req.body);

        console.log(
          `✅ Lead intake created successfully [${(req as any).requestId}]:`,
          {
            leadId: leadIntake.id,
            leadScore: leadIntake.leadScore,
            status: leadIntake.status,
          },
        );

        // Send lead to Go-High-Level CRM
        const ghlResult = await ghlService.sendLeadToGHL(leadIntake);
        if (ghlResult.success && ghlResult.ghlContactId) {
          const ghlInfo = `GHL Contact ID: ${ghlResult.ghlContactId}` + 
            (ghlResult.ghlOpportunityId ? `, Opportunity ID: ${ghlResult.ghlOpportunityId}` : '');
          console.log(`🎯 Lead successfully sent to GHL: ${ghlInfo}`);
          
          // Update the lead with GHL contact and opportunity IDs
          await storage.updateLeadIntake(leadIntake.id, {
            internalNotes: ghlInfo,
          });
        } else if (ghlResult.error) {
          console.warn(`⚠️ Failed to send lead to GHL: ${ghlResult.error}`);
          // Continue with success response - GHL failure shouldn't break the flow
        }

        // Return success response with lead ID for potential follow-up
        res.status(201).json({
          success: true,
          leadId: leadIntake.id,
          leadScore: leadIntake.leadScore,
          message:
            "Thank you for your interest! We'll contact you within 24 hours.",
          nextSteps:
            "Our team will reach out to schedule a discovery call to discuss your specific needs.",
        });
      } catch (error) {
        handleRouteError(error, req, res, "Create lead intake", 500);
      }
    },
  );

  app.get("/api/lead-intake/:id", async (req, res) => {
    try {
      const leadIntake = await storage.getLeadIntake(req.params.id);
      if (!leadIntake) {
        return res.status(404).json({
          error: "Lead intake not found",
          requestId: (req as any).requestId,
        });
      }
      res.json(leadIntake);
    } catch (error) {
      handleRouteError(error, req, res, "Get lead intake", 500);
    }
  });

  app.get("/api/lead-intake", async (req, res) => {
    try {
      const filters = {
        status: req.query.status as string,
        email: req.query.email as string,
        createdAfter: req.query.createdAfter
          ? new Date(req.query.createdAfter as string)
          : undefined,
      };
      const leadIntakes = await storage.searchLeadIntakes(filters);
      res.json(leadIntakes);
    } catch (error) {
      handleRouteError(error, req, res, "Search lead intakes", 500);
    }
  });

  // ====== WAITLIST ======
  app.post("/api/waitlist", async (req, res) => {
    try {
      const { email, fullName, businessName, phone } = req.body;
      
      // Validate required fields
      if (!email || !fullName) {
        return res.status(400).json({
          error: "Missing required fields",
          message: "Email and full name are required",
          requestId: (req as any).requestId,
        });
      }

      // Save to waitlist table
      const waitlistEntry = await db.insert(waitlist).values({
        email,
        fullName,
        businessName: businessName || null,
        phone: phone || null,
        status: "new",
      }).returning();

      console.log(
        `✅ Waitlist entry created [${(req as any).requestId}]:`,
        { id: waitlistEntry[0].id, email }
      );

      res.status(201).json({
        success: true,
        id: waitlistEntry[0].id,
        message: "Thank you for your interest! We'll be in touch soon.",
      });
    } catch (error) {
      handleRouteError(error, req, res, "Create waitlist entry", 500);
    }
  });

  // ====== SKILLS ======
  app.get("/api/skills", async (req, res) => {
    try {
      const category = req.query.category as string;
      const skills = await storage.listSkills(category);
      res.json(skills);
    } catch (error) {
      res.status(500).json({ error: "Failed to get skills" });
    }
  });

  app.get("/api/skills/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }
      const skills = await storage.searchSkills(query);
      res.json(skills);
    } catch (error) {
      res.status(500).json({ error: "Failed to search skills" });
    }
  });

  app.get("/api/skills/:id", async (req, res) => {
    try {
      const skill = await storage.getSkill(Number(req.params.id));
      if (!skill) {
        return res.status(404).json({ error: "Skill not found" });
      }
      res.json(skill);
    } catch (error) {
      res.status(500).json({ error: "Failed to get skill" });
    }
  });

  app.post("/api/skills", async (req, res) => {
    try {
      const validated = insertSkillSchema.parse(req.body);
      const skill = await storage.createSkill(validated);
      res.status(201).json(skill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create skill" });
    }
  });

  // ====== USER SKILLS ======
  app.get("/api/users/:userId/skills", async (req, res) => {
    try {
      const includeNames = req.query.includeNames === "true";
      const userSkills = includeNames
        ? await storage.getUserSkillsWithNames(req.params.userId)
        : await storage.getUserSkills(req.params.userId);
      res.json(userSkills);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user skills" });
    }
  });

  app.post("/api/users/:userId/skills", authenticateJWT, async (req, res) => {
    try {
      const authenticatedUserId = (req as any).user?.id;
      const requestId = (req as any).requestId;

      // Ensure users can only add skills to their own profile
      if (authenticatedUserId !== req.params.userId) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only modify your own skills",
          requestId,
        });
      }

      const validated = insertUserSkillSchema.parse({
        ...req.body,
        userId: req.params.userId,
      });
      const userSkill = await storage.createUserSkill(validated);
      res.status(201).json(userSkill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create user skill" });
    }
  });

  app.patch("/api/user-skills/:id", authenticateJWT, async (req, res) => {
    try {
      const authenticatedUserId = (req as any).user?.id;
      const requestId = (req as any).requestId;

      // First, get the existing user skill to verify ownership
      const existingUserSkill = await storage.getUserSkill(
        Number(req.params.id),
      );
      if (!existingUserSkill) {
        return res.status(404).json({
          error: "User skill not found",
          requestId,
        });
      }

      // Ensure users can only modify their own skills
      if (authenticatedUserId !== existingUserSkill.userId) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only modify your own skills",
          requestId,
        });
      }

      const updates = insertUserSkillSchema.partial().parse(req.body);
      const userSkill = await storage.updateUserSkill(
        Number(req.params.id),
        updates,
      );
      if (!userSkill) {
        return res.status(404).json({ error: "User skill not found" });
      }
      res.json(userSkill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update user skill" });
    }
  });

  app.delete("/api/user-skills/:id", authenticateJWT, async (req, res) => {
    try {
      const authenticatedUserId = (req as any).user?.id;
      const requestId = (req as any).requestId;

      // First, get the existing user skill to verify ownership
      const existingUserSkill = await storage.getUserSkill(
        Number(req.params.id),
      );
      if (!existingUserSkill) {
        return res.status(404).json({
          error: "User skill not found",
          requestId,
        });
      }

      // Ensure users can only delete their own skills
      if (authenticatedUserId !== existingUserSkill.userId) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only delete your own skills",
          requestId,
        });
      }

      const deleted = await storage.deleteUserSkill(Number(req.params.id));
      if (!deleted) {
        return res.status(404).json({ error: "User skill not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user skill" });
    }
  });

  // ====== HOT SEARCHES ======
  app.post("/api/hot-searches/track", async (req, res) => {
    try {
      const { term } = req.body;
      if (!term || typeof term !== "string") {
        return res.status(400).json({ error: "Search term is required" });
      }
      const entry = await storage.trackHotSearch(term.trim());
      res.json(entry);
    } catch (error) {
      console.error("Track hot search error:", error);
      res.status(500).json({ error: "Failed to track search" });
    }
  });

  app.get("/api/hot-searches", async (req, res) => {
    try {
      const range = (req.query.range as string) === "weekly" ? "weekly" : "daily";
      const results = await storage.getHotSearches(range);
      res.json(results);
    } catch (error) {
      console.error("Get hot searches error:", error);
      res.status(500).json({ error: "Failed to get hot searches" });
    }
  });

  // ====== CANDIDATES ======
  /**
   * POST /api/candidates/account-setup
   * Checks if a candidate with the given email exists.
   * - If found: returns { status: "existing", candidate }
   * - If not found and candidateId provided: updates that record, returns { status: "updated", candidate }
   * - Otherwise: creates a new record, returns { status: "created", candidate }
   * Designed to be upgraded to real auth without API contract changes.
   */
  app.post("/api/candidates/account-setup", async (req, res) => {
    try {
      const { email, candidateId, profileData } = req.body as {
        email: string;
        candidateId?: string;
        profileData?: Record<string, unknown>;
      };

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Valid email is required" });
      }

      const existing = await storage.getCandidateByEmail(email);

      if (existing) {
        // If we have a pending candidateId and it's a different record, optionally merge profile data
        if (candidateId && candidateId !== existing.id && profileData) {
          await storage.updateCandidate(existing.id, {
            ...profileData,
            email,
            accountCreated: true,
            updatedAt: new Date().toISOString(),
          } as any);
        } else {
          // Just mark accountCreated if not already
          if (!existing.accountCreated) {
            await storage.updateCandidate(existing.id, {
              accountCreated: true,
              updatedAt: new Date().toISOString(),
            } as any);
          }
        }
        const refreshed = await storage.getCandidate(existing.id);
        return res.json({
          status: "existing",
          candidateId: existing.id,
          accountCreated: true,
          message: "An account with this email already exists in our system.",
          candidate: refreshed ?? existing,
        });
      }

      // No existing record — update the pending candidate or create new
      if (candidateId) {
        const updated = await storage.updateCandidate(candidateId, {
          email,
          accountCreated: true,
          updatedAt: new Date().toISOString(),
        } as any);
        return res.json({
          status: "updated",
          candidateId,
          accountCreated: true,
          message: "Account details saved to your profile.",
          candidate: updated,
        });
      }

      // Create brand new candidate record
      const { insertCandidateSchema } = await import("@shared/schema");
      const payload = insertCandidateSchema.parse({
        email,
        fullName: (profileData?.fullName as string) ?? "Unknown",
        targetPosition: (profileData?.targetPosition as string) ?? "Unknown",
        category: (profileData?.category as string) ?? "General",
        profileCompleted: false,
        accountCreated: true,
        ...(profileData ?? {}),
      });
      const created = await storage.createCandidate(payload);
      return res.json({
        status: "created",
        candidateId: created.id,
        accountCreated: true,
        message: "Your account has been created successfully.",
        candidate: created,
      });
    } catch (error: any) {
      if (error?.name === "ZodError") return res.status(400).json({ error: error.errors });
      console.error("POST /api/candidates/account-setup error:", error);
      res.status(500).json({ error: "Account setup failed" });
    }
  });

  /**
   * POST /api/candidates/check-email
   * Returns whether a candidate with the given email exists.
   */
  app.post("/api/candidates/check-email", async (req, res) => {
    try {
      const { email } = req.body as { email?: string };
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }
      const candidate = await storage.getCandidateByEmail(email.toLowerCase().trim());
      return res.json({ exists: !!candidate, candidateId: candidate?.id ?? null });
    } catch (error: any) {
      console.error("POST /api/candidates/check-email error:", error);
      return res.status(500).json({ error: "Email check failed" });
    }
  });

  /**
   * POST /api/candidates/login
   * Test-mode login — verifies the email exists and returns the candidate.
   * Structured so real password/JWT auth can be dropped in later.
   */
  app.post("/api/candidates/login", async (req, res) => {
    try {
      const { email } = req.body as { email?: string };
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }
      const candidate = await storage.getCandidateByEmail(email.toLowerCase().trim());
      if (!candidate) {
        return res.json({ exists: false });
      }
      return res.json({
        exists: true,
        candidateId: candidate.id,
        candidate: {
          id: candidate.id,
          fullName: candidate.fullName,
          email: candidate.email,
          targetPosition: candidate.targetPosition,
          coreSkills: candidate.coreSkills,
        },
      });
    } catch (error: any) {
      console.error("POST /api/candidates/login error:", error);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  // ── Talent Profile Auth ───────────────────────────────────────────────────────

  /**
   * POST /api/talent-auth/login
   * Email + password → JWT token for talent profile ownership.
   */
  app.post("/api/talent-auth/login", async (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const normalizedTalentEmail = email.trim().toLowerCase();
      console.log(`🔍 [talent-auth/login]: Table checked = candidates, email = ***@${normalizedTalentEmail.split("@")[1]}`);
      const candidate = await storage.getCandidateByEmail(normalizedTalentEmail);

      if (!candidate) {
        // Cross-portal detection: check if this email belongs to a users (Client/Admin) account
        try {
          const userCheck = await query(
            `SELECT id, email, first_name, last_name, password_hash, role
             FROM users WHERE lower(email) = lower($1) LIMIT 1`,
            [normalizedTalentEmail],
          );
          if (userCheck.rows.length > 0) {
            const userRow = userCheck.rows[0];
            console.log(`🔍 [talent-auth/login]: Email found in users table (role=${userRow.role})`);

            if (userRow.role === "talent") {
              // This is a legitimate Talent account that predates the candidates
              // auto-creation fix (or whose candidates row failed to create).
              // Verify their password then auto-create the candidates record.
              const validPw = await verifyPassword(password, userRow.password_hash);
              if (!validPw) {
                return res.status(401).json({ error: "Invalid email or password" });
              }
              // Auto-create the missing candidates record
              const fullName = `${userRow.first_name || ""} ${userRow.last_name || ""}`.trim() || userRow.email;
              const autoCreate = await query(
                `INSERT INTO candidates (full_name, email, password_hash, user_id)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                [fullName, userRow.email.toLowerCase(), userRow.password_hash, userRow.id],
              );
              const newCandidateId = autoCreate.rows[0].id;
              console.log(`✅ [talent-auth/login]: Auto-created candidates record for legacy talent user: ${newCandidateId}`);
              // Issue talent JWT
              let jwtSec = process.env.JWT_SECRET;
              if (!jwtSec) jwtSec = process.env.NODE_ENV === "production" ? "" : "dev-fallback-secret";
              if (!jwtSec) return res.status(500).json({ error: "Auth not configured" });
              const autoToken = jwt.sign(
                { type: "candidate", candidateId: newCandidateId, email: userRow.email.toLowerCase() },
                jwtSec,
                { expiresIn: "30d" },
              );
              return res.json({
                success: true,
                token: autoToken,
                candidate: {
                  id: newCandidateId,
                  fullName,
                  email: userRow.email.toLowerCase(),
                  targetPosition: null,
                },
              });
            }

            // Non-talent (client/admin) user trying the Talent Portal
            return res.status(401).json({
              error: "client_account",
              message: "This is a Client account. Please use the Client Portal.",
            });
          }
        } catch (crossErr: any) {
          console.warn("[talent-auth/login]: cross-portal user check failed:", crossErr.message);
        }
        console.log(`🔍 [talent-auth/login]: Candidate record found = false`);
        return res.status(401).json({ error: "not_found", message: "No Talent account found with this email." });
      }
      console.log(`🔍 [talent-auth/login]: Candidate record found = true, id = ${candidate.id}`);
      if (!candidate.passwordHash) {
        return res.status(403).json({
          error: "no_password",
          requiresPasswordSetup: true,
          message: "This profile exists but does not have a password yet. Please set a password to continue.",
          candidateEmail: candidate.email,
        });
      }
      const valid = await verifyPassword(password, candidate.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      let jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        if (process.env.NODE_ENV === "production") return res.status(500).json({ error: "Auth not configured" });
        jwtSecret = "dev-fallback-secret";
      }
      const token = jwt.sign(
        { type: "candidate", candidateId: candidate.id, email: candidate.email },
        jwtSecret,
        { expiresIn: "30d" },
      );
      return res.json({
        success: true,
        token,
        candidate: {
          id: candidate.id,
          fullName: candidate.fullName,
          email: candidate.email,
          targetPosition: candidate.targetPosition,
        },
      });
    } catch (error: any) {
      console.error("POST /api/talent-auth/login error:", error);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  /**
   * POST /api/talent-auth/set-password
   * First-time password setup for a candidate (requires knowing their email + candidateId).
   */
  app.post("/api/talent-auth/set-password", async (req, res) => {
    try {
      const { email, candidateId, password } = req.body as {
        email?: string;
        candidateId?: string;
        password?: string;
      };
      if (!email || !candidateId || !password) {
        return res.status(400).json({ error: "email, candidateId, and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const candidate = await storage.getCandidateByEmail(email.toLowerCase().trim());
      if (!candidate || candidate.id !== candidateId) {
        return res.status(403).json({ error: "Invalid credentials" });
      }
      const hash = await hashPassword(password);
      await storage.updateCandidate(candidateId, { passwordHash: hash } as any);

      // Issue a token immediately after setting password
      let jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        jwtSecret = process.env.NODE_ENV === "production" ? null as any : "dev-fallback-secret";
        if (!jwtSecret) return res.status(500).json({ error: "Auth not configured" });
      }
      const token = jwt.sign(
        { type: "candidate", candidateId: candidate.id, email: candidate.email },
        jwtSecret,
        { expiresIn: "30d" },
      );
      return res.json({ success: true, token, candidateId: candidate.id });
    } catch (error: any) {
      console.error("POST /api/talent-auth/set-password error:", error);
      return res.status(500).json({ error: "Failed to set password" });
    }
  });

  /**
   * POST /api/candidates/setup-password
   * Allows an existing candidate with NULL password_hash to set a password for the first time.
   * Does NOT require knowing candidateId — only email + chosen password.
   */
  app.post("/api/candidates/setup-password", async (req, res) => {
    try {
      const { email, newPassword } = req.body as { email?: string; newPassword?: string };
      if (!email || !newPassword) {
        return res.status(400).json({ error: "email and newPassword are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const candidate = await storage.getCandidateByEmail(email.toLowerCase().trim());
      if (!candidate) {
        return res.status(404).json({ error: "No candidate profile found with that email address." });
      }
      if (candidate.passwordHash) {
        return res.status(409).json({
          error: "password_exists",
          message: "A password is already set for this profile. Please sign in or use Forgot Password.",
        });
      }
      const hash = await hashPassword(newPassword);
      await storage.updateCandidate(candidate.id, { passwordHash: hash } as any);

      let jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        if (process.env.NODE_ENV === "production") return res.status(500).json({ error: "Auth not configured" });
        jwtSecret = "dev-fallback-secret";
      }
      const token = jwt.sign(
        { type: "candidate", candidateId: candidate.id, email: candidate.email },
        jwtSecret,
        { expiresIn: "30d" },
      );
      console.log(`🔑 Candidate password set for: ***@${email.split("@")[1]}`);
      return res.json({
        success: true,
        message: "Password created successfully. You can now sign in.",
        token,
        candidate: {
          id: candidate.id,
          email: candidate.email,
          fullName: candidate.fullName,
          targetPosition: candidate.targetPosition,
        },
      });
    } catch (error: any) {
      console.error("POST /api/candidates/setup-password error:", error);
      return res.status(500).json({ error: "Failed to set password" });
    }
  });

  /**
   * GET /api/admin/candidates/missing-passwords
   * Lists candidate records that have no password set — admin/dev utility.
   */
  app.get("/api/admin/candidates/missing-passwords", authenticateJWT, requireAdmin, async (_req, res) => {
    try {
      const result = await query(
        `SELECT id, email, full_name, first_name, last_name, created_at
         FROM candidates
         WHERE password_hash IS NULL
         ORDER BY created_at DESC`,
        [],
      );
      return res.json({ count: result.rows.length, candidates: result.rows });
    } catch (error: any) {
      console.error("GET /api/admin/candidates/missing-passwords error:", error);
      return res.status(500).json({ error: "Failed to query candidates" });
    }
  });

  /**
   * POST /api/dev/candidates/set-temp-password
   * DEV ONLY: temporary tool for fixing old candidate records that have no password_hash.
   * Disabled in production unless ENABLE_DEV_PASSWORD_RESET=true.
   */
  app.post("/api/dev/candidates/set-temp-password", async (req: Request, res: Response) => {
    // DEV ONLY: temporary tool for fixing old candidate records
    const isEnabled =
      process.env.NODE_ENV !== "production" ||
      process.env.ENABLE_DEV_PASSWORD_RESET === "true";
    if (!isEnabled) {
      return res.status(403).json({ error: "Disabled in this environment." });
    }
    try {
      const { email, temporaryPassword } = req.body as { email?: string; temporaryPassword?: string };
      if (!email || !temporaryPassword) {
        return res.status(400).json({ error: "email and temporaryPassword are required" });
      }
      const candidate = await storage.getCandidateByEmail(email.toLowerCase().trim());
      if (!candidate) {
        return res.status(404).json({ error: "No candidate found with that email." });
      }
      const hash = await hashPassword(temporaryPassword);
      await storage.updateCandidate(candidate.id, { passwordHash: hash } as any);
      console.log(`🔑 [DEV] Temp password set for candidate: ***@${email.split("@")[1]}`);
      return res.json({ success: true, candidateId: candidate.id, email: candidate.email });
    } catch (error: any) {
      console.error("POST /api/dev/candidates/set-temp-password error:", error);
      return res.status(500).json({ error: "Failed to set temporary password" });
    }
  });

  /**
   * GET /api/talent-auth/me
   * Verifies the talent JWT and returns basic identity info.
   */
  app.get("/api/talent-auth/me", authenticateTalentJWT, async (req: any, res) => {
    try {
      const candidate = await storage.getCandidate(req.talentAuth.candidateId);
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });
      res.json({
        candidateId: candidate.id,
        fullName: candidate.fullName,
        email: candidate.email,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to verify session" });
    }
  });

  /**
   * GET /api/talent/applications
   * Returns the authenticated talent's own application history from job_submissions.
   * Uses the same table as /admin/job-applications — no duplicate tracking tables.
   * Ownership is derived server-side from the Talent JWT; never accepts a query param.
   * Never exposes internal admin notes or other applicants' data.
   */
  // ── Recommended job matches (reads from persisted job_matches table) ────────
  app.get("/api/talent/matches", authenticateTalentJWT, async (req: any, res) => {
    try {
      const { candidateId } = req.talentAuth;
      const storage_ = storage as any;

      let matches = await storage_.getJobMatchesForTalent(candidateId);

      // First visit — no persisted matches yet. Compute on-demand and return.
      if (matches.length === 0) {
        await storage_.recomputeMatchesForTalent(candidateId);
        matches = await storage_.getJobMatchesForTalent(candidateId);
      }

      // SECURITY: redact the employer identity for confidential jobs before the
      // payload leaves the server — same guard as public job search.
      // Also normalise overlapSkills to always be a string[] so clients never
      // receive undefined and crash on .slice() / .map().
      const redacted = matches.map((m: any) => {
        const job = m.job;
        const normalised = {
          ...m,
          overlapSkills: Array.isArray(m.overlapSkills) ? m.overlapSkills : [],
        };
        if (job?.isCompanyConfidential) {
          return { ...normalised, job: { ...job, company: null, companyName: null, companyOverview: null } };
        }
        return normalised;
      });

      res.json(redacted);
    } catch (error) {
      console.error("GET /api/talent/matches failed:", error);
      res.status(500).json({ error: "Failed to fetch job matches" });
    }
  });

  app.get("/api/talent/applications", authenticateJWT, async (req: any, res) => {
    try {
      const user = req.user as { id?: string; email?: string; role?: string } | undefined;
      if (!user?.id || user.role !== "talent") return res.status(403).json({ error: "Talent access required" });
      const linkedUserId = user.id;
      const candidateEmail = user.email ?? "";

      // Fetch applications where:
      //   - talent_id explicitly matches the linked users.id (preferred / secure), OR
      //   - talent_id is NULL and email matches (legacy applications before talent linking)
      const appsResult = await query(
        `SELECT
           js.id,
           js.status,
           js.submitted_at AS "submittedAt",
           js.updated_at   AS "updatedAt",
           js.resume_file_name AS "resumeFileName",
           js.resume_url   AS "resumeUrl",
           js.cover_letter AS "coverLetter",
           js.answers      AS "answers",
           j.id      AS "jobId",
           j.title   AS "jobTitle",
           j.company AS "jobCompany",
           j.location AS "jobLocation",
           j.work_days AS "jobWorkSetup",
           j.status  AS "jobStatus"
         FROM job_submissions js
         JOIN jobs j ON j.id = js.job_id
         WHERE (
           ($1::text IS NOT NULL AND js.talent_id = $1::text)
           OR
           (js.talent_id IS NULL AND lower(js.email) = lower($2))
         )
         AND js.${SHORTLIST_EXCLUSION_PREDICATE}
         ORDER BY js.submitted_at DESC`,
        [linkedUserId, candidateEmail],
      );

      const applications = appsResult.rows.map((row) => ({
        id: row.id,
        job: {
          id: row.jobId,
          title: row.jobTitle,
          companyName: row.jobCompany || "",
          location: row.jobLocation || undefined,
          workSetup: row.jobWorkSetup || undefined,
          status: row.jobStatus || undefined,
        },
        applicationStatus: row.status,
        submittedAt: row.submittedAt,
        updatedAt: row.updatedAt,
        resume: (row.resumeFileName || row.resumeUrl)
          ? { fileName: row.resumeFileName || undefined, url: row.resumeUrl || undefined }
          : undefined,
        coverLetter: row.coverLetter || null,
        answers: Array.isArray(row.answers) ? row.answers : (row.answers ? [] : null),
      }));

      return res.json(applications);
    } catch (error: any) {
      console.error("GET /api/talent/applications error:", error);
      return res.status(500).json({ error: "Failed to load applications" });
    }
  });

  /**
   * GET /api/talent/applications/:id/resume
   * Streams the submitted resume for a specific application.
   * Verifies the authenticated talent owns that submission before serving.
   * Never exposes other applicants' files.
   */
  app.get("/api/talent/applications/:id/resume", authenticateJWT, async (req: any, res) => {
    try {
      const user = req.user as { id?: string; email?: string; role?: string } | undefined;
      if (!user?.id || user.role !== "talent") return res.status(403).json({ error: "Talent access required" });
      const applicationId = req.params.id;
      const linkedUserId = user.id;
      const candidateEmail = user.email ?? "";

      // Fetch only the submission the talent owns
      const subResult = await query(
        `SELECT js.resume_url AS "resumeUrl", js.resume_file_name AS "resumeFileName"
         FROM job_submissions js
         WHERE js.id = $1
           AND (
             ($2::text IS NOT NULL AND js.talent_id = $2::text)
             OR (js.talent_id IS NULL AND lower(js.email) = lower($3))
           )
         LIMIT 1`,
        [applicationId, linkedUserId, candidateEmail],
      );

      if (!subResult.rows.length) {
        return res.status(404).json({ error: "Application not found" });
      }

      const row = subResult.rows[0];
      if (!row.resumeUrl) {
        return res.status(404).json({ error: "No resume attached to this application" });
      }

      const disposition = req.query.download === "1" ? "attachment" : "inline";
      const fileName = (row.resumeFileName || "resume").replace(/"/g, "");

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(row.resumeUrl);
      res.setHeader("Content-Disposition", `${disposition}; filename="${fileName}"`);
      await objectStorageService.downloadObject(objectFile, res, 0);
    } catch (err: any) {
      console.error("GET /api/talent/applications/:id/resume error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to serve resume" });
    }
  });

  /**
   * PATCH /api/talent/applications/:id/withdraw
   * Allows the authenticated talent to withdraw one of their own applications.
   * Only non-terminal applications (not hired/rejected/withdrawn) can be withdrawn.
   */
  app.patch("/api/talent/applications/:id/withdraw", authenticateJWT, async (req: any, res) => {
    try {
      const user = req.user as { id?: string; email?: string; role?: string } | undefined;
      if (!user?.id || user.role !== "talent") return res.status(403).json({ error: "Talent access required" });
      const applicationId = req.params.id;
      const linkedUserId = user.id;
      const candidateEmail = user.email ?? "";

      // Fetch the application, verifying ownership
      const appRow = await query(
        `SELECT id, status FROM job_submissions
         WHERE id = $1
           AND (
             ($2::text IS NOT NULL AND talent_id = $2::text)
             OR
             (talent_id IS NULL AND lower(email) = lower($3))
           )
         LIMIT 1`,
        [applicationId, linkedUserId, candidateEmail],
      );

      if (!appRow.rows.length) {
        return res.status(404).json({ error: "Application not found" });
      }

      const currentStatus = appRow.rows[0].status as string;
      const TERMINAL = new Set(["hired", "rejected", "withdrawn"]);
      if (TERMINAL.has(currentStatus)) {
        return res.status(409).json({
          error: "Cannot withdraw",
          message: `This application is already in a terminal state (${currentStatus}).`,
        });
      }

      // Perform the withdrawal
      const updated = await query(
        `UPDATE job_submissions SET status = 'withdrawn', updated_at = NOW()
         WHERE id = $1
         RETURNING id, status, updated_at AS "updatedAt"`,
        [applicationId],
      );

       console.log(`✅ Talent ${linkedUserId} withdrew application ${applicationId}`);
      return res.json(updated.rows[0]);
    } catch (error: any) {
      console.error("PATCH /api/talent/applications/:id/withdraw error:", error);
      return res.status(500).json({ error: "Failed to withdraw application" });
    }
  });

  app.post("/api/candidates", async (req, res) => {
    try {
      const { insertCandidateSchema } = await import("@shared/schema");
      const data = insertCandidateSchema.parse(req.body);
      const candidate = await storage.createCandidate(data);
      res.json(candidate);
    } catch (error: any) {
      if (error?.name === "ZodError") return res.status(400).json({ error: error.errors });
      console.error("POST /api/candidates error:", error);
      res.status(500).json({ error: "Failed to save candidate" });
    }
  });

  // Strip sensitive auth fields before sending candidate data to clients
  function sanitizeCandidate(c: any) {
    const { passwordHash: _ph, ...safe } = c;
    return safe;
  }

  // Public-safe candidate: strips contact fields and masks the name.
  // Used whenever the requester is NOT the owner or an admin/TA.
  function publicSanitizeCandidate(c: any) {
    // Explicit allowlist — NOT a spread-minus-few.
    // Anything not named here is dropped. URL fields (resumeUrl, linkedinUrl,
    // portfolioUrl, githubUrl, websiteUrl, videoIntroUrl, resumeFileName,
    // videoIntroFileName) are intentionally absent: they must never be returned
    // to non-privileged callers (anonymous visitors, client users).
    const maskedName = maskClientTalentName(c);
    return {
      // Identity — masked; real name surfaces only after an accepted invitation
      id:             c.id             ?? null,
      fullName:       maskedName,
      displayName:    maskedName,
      firstName:      maskedName ? maskedName.split(" ")[0] : "",
      lastName:       "",   // never expose surname to non-privileged viewers
      email:          null, // explicitly null so UI never renders it
      phone:          null,

      // Professional profile — safe to expose
      location:        c.location        ?? null,
      targetPosition:  c.targetPosition  ?? c.target_position  ?? null,
      category:        c.category        ?? null,
      experienceYears: c.experienceYears ?? c.experience_years ?? null,
      seniority:       c.seniority       ?? null,
      headline:        c.headline        ?? null,
      summary:         c.summary         ?? null,
      moreAboutMe:     c.moreAboutMe     ?? c.more_about_me    ?? null,
      availability:    c.availability    ?? null,
      profilePhotoUrl: c.profilePhotoUrl ?? c.profile_photo_url ?? null,

      // Skills, history, structured fields
      coreSkills:      c.coreSkills      ?? c.core_skills      ?? [],
      secondarySkills: c.secondarySkills ?? c.secondary_skills ?? [],
      workHistory:     c.workHistory     ?? c.work_history     ?? [],
      preferences:     c.preferences     ?? {},
      education:       c.education       ?? [],
      certifications:  c.certifications  ?? [],

      // Status flags
      profileCompleted: c.profileCompleted ?? c.profile_completed ?? false,
      accountCreated:   c.accountCreated   ?? c.account_created   ?? false,
      cultureScore:     c.cultureScore     ?? c.culture_score     ?? null,
      isVetted:         c.isVetted         ?? c.is_vetted         ?? false,
      vettedAt:         c.vettedAt         ?? c.vetted_at         ?? null,

      // Verified tier — identity/certifications confirmed by admin
      isVerified:         c.isVerified         ?? c.is_verified         ?? false,
      verificationStatus: c.verificationStatus ?? c.verification_status ?? null,

      // Timestamps
      createdAt: c.createdAt ?? c.created_at ?? null,
      updatedAt: c.updatedAt ?? c.updated_at ?? null,

      // Intentionally omitted — never returned to non-privileged callers:
      // resumeUrl, resumeFileName, videoIntroUrl, videoIntroFileName,
      // linkedinUrl, githubUrl, portfolioUrl, websiteUrl,
      // passwordHash, userId/user_id
    };
  }

  // Determine whether a request's Authorization header belongs to a
  // privileged viewer for the given candidate id.
  // Privileged = admin | talent_acquisition role  OR  profile owner.
  async function isPrivilegedCandidateViewer(req: any, candidateId: string, candidateEmail?: string | null): Promise<boolean> {
    const token = (req.headers["authorization"] ?? "").split(" ")[1];
    if (!token) return false;
    try {
      const jwtSecret = process.env.JWT_SECRET || "dev-fallback-secret";
      const decoded: any = jwt.verify(token, jwtSecret);
      // Internal staff — admin must have talent_acquisition sub-role (or NULL = super-admin)
      if (decoded.userId && decoded.role === "admin") {
        return await isAdminWithTalentAccess(decoded.userId);
      }
      if (decoded.userId && decoded.role === "talent_acquisition") return true;
      // Candidate JWT owner
      if (decoded.type === "candidate" && decoded.candidateId === candidateId) return true;
      // Talent user JWT owner (email match)
      if (decoded.role === "talent" && decoded.email && candidateEmail) {
        return decoded.email.toLowerCase() === candidateEmail.toLowerCase();
      }
    } catch { /* invalid/expired token → not privileged */ }
    return false;
  }

  // ── /api/candidates in-memory cache ──────────────────────────────────────────
  // The public homepage (hero slide + talent carousel) fetches this endpoint on
  // every cold page load. storage.getCandidates() does a full-table scan each
  // time; caching the raw result for 10 minutes eliminates per-visitor DB hits
  // on the highest-traffic public page.  Sanitization is applied per-request
  // after the cache read so admin/TA callers still get their privileged view
  // while sharing the same cached raw dataset.
  const _candidatesCache: { data: any[] | null; expiry: number } = { data: null, expiry: 0 };
  let _candidatesCacheRoleVersion = "";
  const CANDIDATES_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  app.get("/api/candidates", async (req: any, res) => {
    try {
      const { page, pageSize } = parsePagination(req.query);

      let all: any[];
      const now = Date.now();
      // A role change must invalidate the cached discovery set immediately.
      // updated_at is indexed and this lightweight version check avoids
      // serving a legacy candidate row after its user becomes an admin.
      const roleVersionResult = await query(
        `SELECT COALESCE(MAX(updated_at), TIMESTAMP 'epoch') AS role_version FROM users`,
      );
      const roleVersion = String(roleVersionResult.rows[0]?.role_version ?? "");
      if (_candidatesCache.data && now < _candidatesCache.expiry &&
          roleVersion === _candidatesCacheRoleVersion) {
        all = _candidatesCache.data;
        res.setHeader("X-Candidates-Cache", "HIT");
      } else {
        all = await storage.getCandidates();
        _candidatesCache.data   = all;
        _candidatesCache.expiry = now + CANDIDATES_CACHE_TTL_MS;
        _candidatesCacheRoleVersion = roleVersion;
        res.setHeader("X-Candidates-Cache", "MISS");
      }
      // Admin/TA get full data; everyone else gets public-safe records
      const token = (req.headers["authorization"] ?? "").split(" ")[1];
      let callerIsPrivileged = false;
      if (token) {
        try {
          const jwtSecret = process.env.JWT_SECRET || "dev-fallback-secret";
          const decoded: any = jwt.verify(token, jwtSecret);
          if (decoded.userId && decoded.role === "admin") {
            callerIsPrivileged = await isAdminWithTalentAccess(decoded.userId);
          } else if (decoded.userId && decoded.role === "talent_acquisition") {
            callerIsPrivileged = true;
          }
        } catch { /* ignore */ }
      }
      const sanitized = callerIsPrivileged
        ? all.map(sanitizeCandidate)
        : all.map(publicSanitizeCandidate);
      const { items, meta } = pageSlice(sanitized, page, pageSize);
      res.json({ items, meta });
    } catch (error) {
      console.error("GET /api/candidates error:", error);
      res.status(500).json({ error: "Failed to fetch candidates" });
    }
  });

  // GET /api/candidates/me — find the candidate record for the authenticated talent user by email.
  // Must be registered BEFORE /api/candidates/:id so Express doesn't match "me" as an id param.
  // Returns the same full DTO as GET /api/candidates/:id so all pages compute an identical
  // completion percentage regardless of which endpoint they use.
  app.get("/api/candidates/me", authenticateJWT, async (req: any, res) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail) return res.status(400).json({ error: "No email on authenticated user" });
      const result = await query(
        `SELECT c.id,
                c.display_name        AS "displayName",
                c.full_name           AS "fullName",
                c.first_name          AS "firstName",
                c.last_name           AS "lastName",
                c.email, c.phone, c.location,
                c.target_position     AS "targetPosition",
                c.headline,
                c.category,
                c.experience_years    AS "experienceYears",
                c.seniority,
                c.core_skills         AS "coreSkills",
                c.secondary_skills    AS "secondarySkills",
                c.work_history        AS "workHistory",
                c.education,
                c.preferences,
                c.summary,
                c.profile_photo_url   AS "profilePhotoUrl",
                c.resume_url          AS "resumeUrl",
                c.resume_file_name    AS "resumeFileName",
                c.linkedin_url        AS "linkedinUrl",
                c.portfolio_url       AS "portfolioUrl",
                c.profile_completed   AS "profileCompleted",
                c.culture_score       AS "cultureScore",
                c.availability,
                c.values_answers      AS "valuesAnswers",
                c.created_at          AS "createdAt",
                c.updated_at          AS "updatedAt"
          FROM candidates c
          JOIN users u
            ON u.role = 'talent'
           AND (u.id = c.user_id OR LOWER(u.email) = LOWER(c.email))
          WHERE LOWER(c.email) = LOWER($1) LIMIT 1`,
        [userEmail],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "No candidate profile found" });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("GET /api/candidates/me error:", error);
      res.status(500).json({ error: "Failed to fetch candidate" });
    }
  });

  app.get("/api/candidates/:id", async (req: any, res) => {
    try {
      const candidate = await storage.getCandidate(req.params.id);
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });
      const currentUser = await query(
        `SELECT role
           FROM users
          WHERE id = $1 OR LOWER(email) = LOWER($2)
          ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
          LIMIT 1`,
        [candidate.userId ?? "", candidate.email ?? ""],
      );
      if (currentUser.rows[0]?.role !== "talent") {
        return res.status(404).json({ error: "Candidate not found" });
      }
      const privileged = await isPrivilegedCandidateViewer(req, req.params.id, candidate.email);
      res.json(privileged ? sanitizeCandidate(candidate) : publicSanitizeCandidate(candidate));
    } catch (error) {
      console.error("GET /api/candidates/:id error:", error);
      res.status(500).json({ error: "Failed to fetch candidate" });
    }
  });

  app.patch("/api/candidates/:id", async (req: any, res) => {
    try {
      // Accept: (a) candidate JWT (owner), (b) staff JWT, or (c) talent user JWT whose email matches
      const authHeader = req.headers["authorization"];
      const token = authHeader?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "Authentication required" });

      const jwtSecret = process.env.JWT_SECRET || "dev-fallback-secret";
      let decoded: any;
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const profileId = req.params.id;
      const isTalentOwner = decoded.type === "candidate" && decoded.candidateId === profileId;
      // Admins must have talent_acquisition sub-role (or NULL = super-admin) to edit candidate profiles.
      const adminHasTalentAccess = decoded.role === "admin" && decoded.userId
        ? await isAdminWithTalentAccess(decoded.userId)
        : false;
      const isStaffUser = (decoded.userId && decoded.role === "talent_acquisition")
        || adminHasTalentAccess;

      // Allow talent users (standard user JWT) to update their own candidate record if email matches
      let isTalentUserOwner = false;
      if (!isTalentOwner && !isStaffUser && decoded.role === "talent" && decoded.email) {
        const candidateRow = await query(
          `SELECT id, email FROM candidates WHERE id = $1 LIMIT 1`,
          [profileId],
        );
        if (candidateRow.rows.length > 0 &&
            candidateRow.rows[0].email?.toLowerCase() === decoded.email.toLowerCase()) {
          isTalentUserOwner = true;
        }
      }

      if (!isTalentOwner && !isStaffUser && !isTalentUserOwner) {
        return res.status(403).json({ error: "You are not authorized to edit this profile" });
      }

      // Build an explicit allow-list — only confirmed candidates-table columns.
      // This prevents raw req.body keys from reaching Drizzle's .set() directly.
      const body = req.body as Record<string, any>;

      const candidateUpdates: Record<string, any> = {};

      // Text columns.
      // ⚠️  fullName / targetPosition / category are NOT NULL in the schema — coerce null/empty to "".
      // All other text columns are nullable — null is allowed.

      // firstName / lastName are stored separately; fullName is kept in sync.
      // If the client sends firstName + lastName, derive fullName from them.
      // If the client sends only fullName, write that directly.
      if (body.firstName !== undefined) candidateUpdates.firstName = body.firstName ?? "";
      if (body.lastName  !== undefined) candidateUpdates.lastName  = body.lastName  ?? "";

      if (body.firstName !== undefined || body.lastName !== undefined) {
        // Recompute fullName from the explicit parts so the columns never diverge.
        const fn = (body.firstName ?? "").trim();
        const ln = (body.lastName  ?? "").trim();
        candidateUpdates.fullName = [fn, ln].filter(Boolean).join(" ") || "";
      } else if (body.fullName !== undefined) {
        candidateUpdates.fullName = body.fullName ?? "";  // NOT NULL
      }

      if (body.targetPosition !== undefined) candidateUpdates.targetPosition = body.targetPosition ?? "";  // NOT NULL
      if (body.category       !== undefined) candidateUpdates.category       = body.category       ?? "";  // NOT NULL
      if (body.phone          !== undefined) candidateUpdates.phone          = body.phone          || null;
      if (body.location       !== undefined) candidateUpdates.location       = body.location       || null;
      if (body.summary     !== undefined) candidateUpdates.summary     = sanitizeProfileHtml(body.summary);
      if (body.moreAboutMe !== undefined) candidateUpdates.moreAboutMe = sanitizeProfileHtml(body.moreAboutMe);
      if (body.availability   !== undefined) candidateUpdates.availability   = body.availability   || null;
      if (body.headline       !== undefined) candidateUpdates.headline       = body.headline       || null;
      if (body.displayName    !== undefined) candidateUpdates.displayName    = body.displayName    || null;
      if (body.linkedinUrl    !== undefined) candidateUpdates.linkedinUrl    = body.linkedinUrl    || null;
      if (body.githubUrl      !== undefined) candidateUpdates.githubUrl      = body.githubUrl      || null;
      if (body.portfolioUrl   !== undefined) candidateUpdates.portfolioUrl   = body.portfolioUrl   || null;
      if (body.websiteUrl     !== undefined) candidateUpdates.websiteUrl     = body.websiteUrl     || null;
      if (body.seniority      !== undefined) candidateUpdates.seniority      = body.seniority      || null;
      if (body.experienceYears !== undefined) candidateUpdates.experienceYears = body.experienceYears || null;
      // Allow clearing profilePhotoUrl (e.g. remove photo sets it to null)
      if ("profilePhotoUrl" in body)       candidateUpdates.profilePhotoUrl = body.profilePhotoUrl ?? null;
      // Allow clearing resumeUrl / resumeFileName (e.g. talent removes their uploaded resume)
      if ("resumeUrl"      in body)       (candidateUpdates as any).resumeUrl      = body.resumeUrl      ?? null;
      if ("resumeFileName" in body)       (candidateUpdates as any).resumeFileName = body.resumeFileName ?? null;

      // Array columns (text[])
      if (body.coreSkills !== undefined) {
        candidateUpdates.coreSkills = Array.isArray(body.coreSkills) ? body.coreSkills : [];
      }
      if (body.secondarySkills !== undefined) {
        candidateUpdates.secondarySkills = Array.isArray(body.secondarySkills) ? body.secondarySkills : [];
      }

      // JSONB columns — merge preferences so existing keys (workSetup, shift, etc.) survive
      if (body.preferences !== undefined && typeof body.preferences === "object") {
        // Fetch the current row so we can merge preferences safely
        const existing = await storage.getCandidate(profileId);
        const existingPrefs = (existing?.preferences && typeof existing.preferences === "object")
          ? (existing.preferences as Record<string, any>)
          : {};
        candidateUpdates.preferences = { ...existingPrefs, ...body.preferences };
      }
      if (body.workHistory !== undefined && Array.isArray(body.workHistory)) {
        candidateUpdates.workHistory = body.workHistory;
      }
      if (body.education !== undefined && Array.isArray(body.education)) {
        candidateUpdates.education = body.education;
      }
      if (body.certifications !== undefined && Array.isArray(body.certifications)) {
        candidateUpdates.certifications = body.certifications;
      }

      // Boolean columns
      if (body.profileCompleted !== undefined) candidateUpdates.profileCompleted = Boolean(body.profileCompleted);
      if (body.accountCreated   !== undefined) candidateUpdates.accountCreated   = Boolean(body.accountCreated);

      // Always stamp the update time
      candidateUpdates.updatedAt = new Date();

      console.log(`PATCH /api/candidates/${profileId} — updating fields:`, Object.keys(candidateUpdates));

      if (Object.keys(candidateUpdates).length <= 1) {
        // Only updatedAt — nothing useful to update
        return res.status(400).json({ error: "No valid fields provided for update" });
      }

      const updated = await storage.updateCandidate(profileId, candidateUpdates as any);
      if (!updated) return res.status(404).json({ error: "Candidate not found" });
      res.json(sanitizeCandidate(updated));

      // Invalidate the homepage candidates cache whenever availability changes so
      // the carousel never shows a stale "Ready now" / "Unavailable" state.
      if (candidateUpdates.availability !== undefined) {
        _candidatesCache.data   = null;
        _candidatesCache.expiry = 0;
        console.log(`🔄 _candidatesCache invalidated — availability updated for candidate ${profileId}`);
      }

      // Option C trigger A: recompute job matches after candidate preferences update.
      setImmediate(() => {
        (storage as any).recomputeMatchesForTalent(profileId)
          .catch((err: any) => console.error("❌ Background match recompute (candidate save):", err));
      });
    } catch (error) {
      const pgErr = error as any;
      console.error("PATCH /api/candidates/:id FAILED", {
        candidateId: req.params.id,
        message:     pgErr instanceof Error ? pgErr.message : String(pgErr),
        code:        pgErr?.code,
        column:      pgErr?.column,
        constraint:  pgErr?.constraint,
        detail:      pgErr?.detail,
        stack:       pgErr instanceof Error ? pgErr.stack?.split("\n").slice(0, 5).join(" | ") : undefined,
      });
      res.status(500).json({ error: "Failed to update candidate" });
    }
  });

  // POST /api/candidates/:id/photo — Upload profile photo (requires talent auth + ownership)
  app.post("/api/candidates/:id/photo", authenticateTalentJWT, upload.single("photo"), async (req: any, res) => {
    try {
      if (!requireTalentOwns(req, res)) return;
      const { id } = req.params;
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedMimes.includes(file.mimetype)) {
        return res.status(400).json({ error: "Only JPG, PNG, and WEBP images are allowed" });
      }
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "File too large — max 5 MB" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectId = randomUUID();
      const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/candidate-photos/${objectId}.${ext}`;
      const parts = fullPath.split("/").filter((p: string) => p);
      const bucketName = parts[0];
      const objectName = parts.slice(1).join("/");

      const bucket = objectStorageClient.bucket(bucketName);
      const objectFile = bucket.file(objectName);
      await objectFile.save(file.buffer, {
        metadata: { contentType: file.mimetype },
      });
      await setObjectAclPolicy(objectFile, { visibility: "public" });

      const photoUrl = `/objects/candidate-photos/${objectId}.${ext}`;
      await storage.updateCandidate(id, { profilePhotoUrl: photoUrl } as any);

      // Sync to profiles.profilePicture so the Settings page photo stays in
      // step with the TalentProfile page upload.
      const talentEmail = (req as any).talentAuth?.email;
      if (talentEmail) {
        try {
          await db
            .update(profiles)
            .set({ profilePicture: photoUrl })
            .where(
              sqlOp`lower(${profiles.userId}) = (
                SELECT lower(id) FROM users WHERE lower(email) = lower(${talentEmail}) LIMIT 1
              )`
            );
        } catch (syncErr: any) {
          // Non-fatal — candidate photo was saved; just log the sync failure
          console.warn("POST /api/candidates/:id/photo — profile sync failed:", syncErr.message);
        }
      }

      res.json({ success: true, profilePhotoUrl: photoUrl });
    } catch (error: any) {
      console.error("POST /api/candidates/:id/photo error:", error);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  });

  // GET /api/candidate-photos/:path(*) — Publicly serve candidate profile photos
  app.get("/api/candidate-photos/:photoPath(*)", async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const canonicalPath = `/objects/candidate-photos/${req.params.photoPath}`;
      const objectFile = await objectStorageService.getObjectEntityFile(canonicalPath);
      await objectStorageService.downloadObject(objectFile, res, 86400);
    } catch (error: any) {
      if (error.name === "ObjectNotFoundError") return res.status(404).send("Not found");
      console.error("GET /api/candidate-photos error:", error);
      res.status(500).send("Error serving photo");
    }
  });

  // POST /api/profiles/me/photo — Upload / replace the authenticated user's profile photo.
  // Dedicated endpoint with server-side MIME validation and size limit.
  // Stores only in the /objects/profile-photos/{userId}/ namespace.
  app.post(
    "/api/profiles/me/photo",
    authenticateJWT,
    // Apply dedicated 5 MB Multer instance; intercept LIMIT_FILE_SIZE before it bubbles up
    (req: any, res: any, next: any) => {
      photoUpload.single("photo")(req, res, (err: any) => {
        if (err?.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: "File too large — max 5 MB" });
        }
        if (err) return next(err);
        next();
      });
    },
    async (req: any, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: "Authentication required" });

        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        // Server-side MIME validation (Multer reports multipart header, so also validate here)
        const allowedMimes: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png":  "png",
          "image/webp": "webp",
          "image/gif":  "gif",
        };
        const ext = allowedMimes[file.mimetype];
        if (!ext) {
          return res.status(400).json({ error: "Only JPEG, PNG, WebP, or GIF images are allowed" });
        }

        // Store in dedicated profile-photos namespace: /objects/profile-photos/{userId}/{uuid}.{ext}
        const objectStorageService = new ObjectStorageService();
        const objectId = randomUUID();
        const privateObjectDir = objectStorageService.getPrivateObjectDir();
        const fullPath = `${privateObjectDir}/profile-photos/${userId}/${objectId}.${ext}`;
        const parts = fullPath.split("/").filter((p: string) => p);
        const bucketName = parts[0];
        const objectName = parts.slice(1).join("/");

        const bucket = objectStorageClient.bucket(bucketName);
        const objectFile = bucket.file(objectName);
        await objectFile.save(file.buffer, {
          metadata: { contentType: file.mimetype },
        });
        await setObjectAclPolicy(objectFile, { visibility: "public" });

        // Canonical path stored in the DB — namespace-scoped, never user-supplied
        const storagePath = `/objects/profile-photos/${userId}/${objectId}.${ext}`;
        await db
          .update(profiles)
          .set({ profilePicture: storagePath })
          .where(eq(profiles.userId, userId));

        // Sync to the linked candidate record so the public talent profile page
        // picks up the photo without a separate upload flow.
        // Prefer joining on user_id (stable FK) so an email change never breaks
        // the link; fall back to email for legacy rows that predate the FK column.
        const publicPhotoUrl = `/api/profile-picture/${userId}`;
        const syncResult = await db
          .update(candidatesTable)
          .set({ profilePhotoUrl: publicPhotoUrl } as any)
          .where(sqlOp`${candidatesTable.userId} = ${userId}`);
        // Fallback: legacy rows without user_id set — match by email
        const syncedByUserId = (syncResult as any).rowCount ?? 0;
        if (syncedByUserId === 0) {
          const userEmail = req.user?.email;
          if (userEmail) {
            await db
              .update(candidatesTable)
              .set({ profilePhotoUrl: publicPhotoUrl } as any)
              .where(sqlOp`lower(${candidatesTable.email}) = lower(${userEmail})`);
          }
        }

        console.log(`✅ Profile photo uploaded [${req.requestId}]:`, { userId, storagePath });
        res.json({ success: true });
      } catch (error: any) {
        console.error(`❌ Profile photo upload failed [${req.requestId}]:`, error.message);
        res.status(500).json({ error: "Failed to upload photo" });
      }
    },
  );

  // DELETE /api/profiles/me/photo — Remove the authenticated user's profile photo.
  app.delete("/api/profiles/me/photo", authenticateJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Authentication required" });
      await db
        .update(profiles)
        .set({ profilePicture: null })
        .where(eq(profiles.userId, userId));

      // Also clear the linked candidate's photo if it was synced from the profile upload.
      // Join on user_id (stable FK) so an email change doesn't leave the photo stuck.
      // Fall back to email for legacy rows that predate the FK column.
      const profilePhotoPrefix = `/api/profile-picture/${userId}`;
      const deleteSync = await db
        .update(candidatesTable)
        .set({ profilePhotoUrl: null } as any)
        .where(
          sqlOp`${candidatesTable.userId} = ${userId}
            AND ${candidatesTable.profilePhotoUrl} = ${profilePhotoPrefix}`
        );
      if (((deleteSync as any).rowCount ?? 0) === 0) {
        const userEmail = req.user?.email;
        if (userEmail) {
          await db
            .update(candidatesTable)
            .set({ profilePhotoUrl: null } as any)
            .where(
              sqlOp`lower(${candidatesTable.email}) = lower(${userEmail})
                AND ${candidatesTable.profilePhotoUrl} = ${profilePhotoPrefix}`
            );
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error(`❌ Profile photo removal failed [${req.requestId}]:`, error.message);
      res.status(500).json({ error: "Failed to remove photo" });
    }
  });

  // GET /api/profile-picture/:userId — Public: serve a talent's profile picture.
  // SECURITY: only serves from the dedicated /objects/profile-photos/ namespace;
  // forces a safe image Content-Type and adds nosniff / disposition headers.
  const PROFILE_PHOTO_NAMESPACE = "/objects/profile-photos/";
  app.get("/api/profile-picture/:userId", async (req: any, res) => {
    try {
      const { userId } = req.params;
      const rows = await db
        .select({ profilePicture: profiles.profilePicture })
        .from(profiles)
        .where(eq(profiles.userId, userId));
      const picturePath = rows[0]?.profilePicture;

      // Allowed namespaces: the dedicated profile-photos namespace (current),
      // the legacy uploads namespace (pre-dedicated-endpoint photos), and the
      // candidate-photos namespace (synced from the TalentProfile page uploader).
      const LEGACY_NAMESPACE = "/objects/uploads/";
      const CANDIDATE_PHOTO_NAMESPACE = "/objects/candidate-photos/";
      if (!picturePath || (
        !picturePath.startsWith(PROFILE_PHOTO_NAMESPACE) &&
        !picturePath.startsWith(LEGACY_NAMESPACE) &&
        !picturePath.startsWith(CANDIDATE_PHOTO_NAMESPACE)
      )) {
        return res.status(404).send("No photo");
      }

      // Derive the allowed Content-Type from the file extension — reject non-image extensions.
      // This provides defence-in-depth even for legacy paths.
      const storedExt = picturePath.split(".").pop()?.toLowerCase();
      const mimeByExt: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg",
        png: "image/png", webp: "image/webp", gif: "image/gif",
      };
      const contentType = storedExt ? mimeByExt[storedExt] : undefined;
      if (!contentType) return res.status(404).send("No photo");

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(picturePath);

      // Stream with safe, forced headers — never trust stored metadata content type
      const [metadata] = await objectFile.getMetadata();
      res.set({
        "Content-Type":              contentType,
        "Content-Length":            metadata.size,
        "Cache-Control":             "public, max-age=3600",
        "Content-Disposition":       "inline",
        "X-Content-Type-Options":    "nosniff",
      });
      objectFile.createReadStream().pipe(res);
    } catch (error: any) {
      if (error.name === "ObjectNotFoundError") return res.status(404).send("Not found");
      console.error("GET /api/profile-picture error:", error);
      res.status(500).send("Error serving photo");
    }
  });

  // GET /api/candidates/:id/resume — Download/view the candidate's own resume
  // Accepts: candidate JWT or matching talent user JWT (or admin)
  app.get("/api/candidates/:id/resume", async (req: any, res) => {
    try {
      const { id } = req.params;
      const authHeader = req.headers["authorization"];
      const token = authHeader?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "Authentication required" });
      const jwtSecret = process.env.JWT_SECRET || "dev-fallback-secret";
      let decoded: any;
      try { decoded = jwt.verify(token, jwtSecret); }
      catch { return res.status(401).json({ error: "Invalid or expired token" }); }
      if (decoded.type === "candidate") {
        if (decoded.candidateId !== id) return res.status(403).json({ error: "Forbidden" });
      } else if (decoded.role === "talent" && decoded.email) {
        const check = await query(`SELECT id FROM candidates WHERE id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`, [id, decoded.email]);
        if (check.rows.length === 0) return res.status(403).json({ error: "Forbidden" });
      } else if (decoded.role === "admin" && decoded.userId) {
        // Admin must have talent_acquisition sub-role (or NULL = super-admin)
        const allowed = await isAdminWithTalentAccess(decoded.userId);
        if (!allowed) return res.status(403).json({ error: "Insufficient permissions — talent_acquisition sub-role required" });
      } else if (decoded.role === "talent_acquisition") {
        // explicit talent_acquisition role (legacy path) — permitted
      } else {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      const row = await query(`SELECT resume_url AS "resumeUrl", resume_file_name AS "resumeFileName" FROM candidates WHERE id = $1 LIMIT 1`, [id]);
      if (!row.rows.length) return res.status(404).json({ error: "Candidate not found" });
      const { resumeUrl, resumeFileName } = row.rows[0];
      if (!resumeUrl) return res.status(404).json({ error: "No resume on this profile" });
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(resumeUrl);
      const disposition = req.query.download === "1" ? "attachment" : "inline";
      const fileName = (resumeFileName || "resume").replace(/"/g, "");
      res.setHeader("Content-Disposition", `${disposition}; filename="${fileName}"`);
      await objectStorageService.downloadObject(objectFile, res, 0);
    } catch (error: any) {
      console.error("GET /api/candidates/:id/resume error:", error);
      if (!res.headersSent) res.status(500).json({ error: "Failed to serve resume" });
    }
  });

  // ── Candidate resume & video upload/delete ────────────────────────────────
  // Registered via candidateMedia.ts module (injectable deps for testability).
  registerCandidateMediaRoutes(app, upload, {
    jwtSecret: process.env.JWT_SECRET || "dev-fallback-secret",
    dbQuery: query,
    updateCandidate: (id, updates) => storage.updateCandidate(id, updates as any) as any,
    saveToStorage: async (subdir, buffer, mimetype, originalName) => {
      const objectStorageService = new ObjectStorageService();
      const objectId = randomUUID();
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/${subdir}/${objectId}`;
      const parts = fullPath.split("/").filter((p: string) => p);
      const bucketName = parts[0];
      const objectName = parts.slice(1).join("/");
      const bucket = objectStorageClient.bucket(bucketName);
      const objectFile = bucket.file(objectName);
      await objectFile.save(buffer, {
        metadata: { contentType: mimetype, metadata: { originalName } },
      });
      await setObjectAclPolicy(objectFile, { visibility: "private" });
      return `/objects/${subdir}/${objectId}`;
    },
    deleteFromStorage: async (url) => {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(url);
      await objectFile.delete({ ignoreNotFound: true });
    },
  });

  // GET /api/candidates/:id/video — Stream profile video to the authenticated owner
  app.get("/api/candidates/:id/video", async (req: any, res) => {
    try {
      const { id } = req.params;

      // Flexible auth: candidate JWT or talent user JWT
      const authHeader = req.headers["authorization"];
      const token = authHeader?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "Authentication required" });

      const jwtSecret = process.env.JWT_SECRET || "dev-fallback-secret";
      let decoded: any;
      try { decoded = jwt.verify(token, jwtSecret); }
      catch { return res.status(401).json({ error: "Invalid or expired token" }); }

      if (decoded.type === "candidate") {
        if (decoded.candidateId !== id) return res.status(403).json({ error: "Forbidden" });
      } else if (decoded.role === "talent" && decoded.email) {
        const check = await query(
          `SELECT id FROM candidates WHERE id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
          [id, decoded.email],
        );
        if (check.rows.length === 0) return res.status(403).json({ error: "Forbidden" });
      } else if (decoded.role === "admin" && decoded.userId) {
        // Admin must have talent_acquisition sub-role (or NULL = super-admin)
        const allowed = await isAdminWithTalentAccess(decoded.userId);
        if (!allowed) return res.status(403).json({ error: "Insufficient permissions — talent_acquisition sub-role required" });
      } else if (decoded.role === "talent_acquisition") {
        // explicit talent_acquisition role (legacy path) — permitted
      } else {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const candRow = await query(
        `SELECT video_intro_url AS "videoIntroUrl", video_intro_file_name AS "videoIntroFileName" FROM candidates WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (!candRow.rows.length) return res.status(404).json({ error: "Candidate not found" });
      const { videoIntroUrl, videoIntroFileName } = candRow.rows[0];
      if (!videoIntroUrl) return res.status(404).json({ error: "No video on this profile" });

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(videoIntroUrl);

      const [metadata] = await objectFile.getMetadata();
      const contentType = (metadata.contentType as string) || "video/mp4";
      const fileSize = Number(metadata.size) || 0;
      const fileName = (videoIntroFileName || "video-intro").replace(/"/g, "");

      // Support Range requests so the browser video player can seek
      const rangeHeader = req.headers.range;
      if (rangeHeader && fileSize > 0) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        const start = match?.[1] ? parseInt(match[1], 10) : 0;
        const end   = match?.[2] ? parseInt(match[2], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        res.status(206);
        res.set({
          "Content-Range":  `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges":  "bytes",
          "Content-Length": chunkSize,
          "Content-Type":   contentType,
          "Content-Disposition": `inline; filename="${fileName}"`,
        });
        objectFile.createReadStream({ start, end }).pipe(res);
      } else {
        res.set({
          "Content-Type":        contentType,
          "Accept-Ranges":       "bytes",
          "Content-Length":      fileSize || undefined,
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control":       "no-store",
        });
        objectFile.createReadStream().pipe(res);
      }
    } catch (error: any) {
      console.error("GET /api/candidates/:id/video error:", error);
      if (!res.headersSent) res.status(500).json({ error: "Failed to serve video" });
    }
  });

  // ====== CULTURE EVALUATIONS ======

  /**
   * POST /api/candidates/:candidateId/culture-evaluation
   * Saves (or updates) the cultural evaluation for a candidate.
   * Returns the saved evaluation with computed scores.
   */
  app.post("/api/candidates/:candidateId/culture-evaluation", async (req, res) => {
    try {
      const { candidateId } = req.params;
      if (!candidateId) {
        return res.status(400).json({ error: "candidateId is required" });
      }

      const candidate = await storage.getCandidate(candidateId);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      const {
        answers,
        valueScores,
        overallScore,
        alignmentLevel,
        summary,
        traits,
      } = req.body;

      if (typeof overallScore !== "number" || !answers) {
        return res.status(400).json({ error: "answers and overallScore are required" });
      }

      const evaluation = await storage.upsertCultureEvaluation(candidateId, {
        answers,
        valueScores: valueScores ?? [],
        overallScore,
        alignmentLevel: alignmentLevel ?? "",
        summary: summary ?? "",
        traits: traits ?? [],
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      // Also update the top-level cultureScore on the candidate for quick access
      await storage.updateCandidate(candidateId, {
        cultureScore: overallScore,
        updatedAt: new Date().toISOString(),
      } as any);

      return res.json({
        success: true,
        evaluationId: evaluation.id,
        candidateId,
        overallScore: evaluation.overallScore,
        alignmentLevel: evaluation.alignmentLevel,
        summary: evaluation.summary,
        evaluation,
      });
    } catch (error) {
      console.error("POST /api/candidates/:id/culture-evaluation error:", error);
      res.status(500).json({ error: "Failed to save culture evaluation" });
    }
  });

  /**
   * GET /api/candidates/:candidateId/culture-evaluation
   * Fetches the saved cultural evaluation for a candidate.
   */
  app.get("/api/candidates/:candidateId/culture-evaluation", async (req, res) => {
    try {
      const { candidateId } = req.params;
      const evaluation = await storage.getCultureEvaluationByCandidate(candidateId);
      if (!evaluation) {
        return res.status(404).json({ error: "No culture evaluation found for this candidate" });
      }
      res.json(evaluation);
    } catch (error) {
      console.error("GET /api/candidates/:id/culture-evaluation error:", error);
      res.status(500).json({ error: "Failed to fetch culture evaluation" });
    }
  });

  // ====== JOBS ======
  // Advanced Job Search - Critical for job discovery (must come before :id route)
  app.get("/api/jobs/search", async (req, res) => {
    try {
      const { page, pageSize } = parsePagination(req.query);

      // Use true SQL-level pagination: COUNT(*) for total, LIMIT/OFFSET for page data.
      // This fixes the old architecture where .limit(500) was applied before filtering,
      // causing meta.total to be wrong and older jobs to disappear beyond 500 records.
      const { items: rawItems, total } = await storage.searchJobsPaginated({
        category: req.query.category as string | undefined,
        categories: req.query.categories
          ? (req.query.categories as string).split(",").map(s => s.trim()).filter(Boolean)
          : undefined,
        engagementType: req.query.engagementType as string | undefined,
        experienceLevel: req.query.experienceLevel as string | undefined,
        minBudget: req.query.minBudget ? Number(req.query.minBudget) : undefined,
        maxBudget: req.query.maxBudget ? Number(req.query.maxBudget) : undefined,
        minSalary: req.query.minSalary ? Number(req.query.minSalary) : undefined,
        status: (req.query.status as string) || "open",
        q: req.query.q as string | undefined,
        location: req.query.location as string | undefined,
        page,
        pageSize,
      });

      const totalPages = Math.ceil(total / pageSize);

      // Mask company data for confidential jobs before sending to public callers
      const items = rawItems.map((job: any) =>
        job.isCompanyConfidential
          ? { ...job, company: "Confidential Company", companyOverview: job.confidentialClientOverview ?? null }
          : job
      );

      res.json({ items, meta: { page, pageSize, total, totalPages } });
    } catch (error) {
      console.error("Job search error:", error);
      res.status(500).json({ error: "Failed to search jobs" });
    }
  });

  // ── Popular jobs (top 5 open+approved by view count, fallback to newest) ─────
  app.get("/api/jobs/popular", async (req, res) => {
    try {
      const result = await query(
        `SELECT id, title, professional_role_name
         FROM jobs
         WHERE status = 'open'
           AND approval_status = 'approved'
           AND (created_via IS NULL OR created_via != 'search_scaffold')
         ORDER BY COALESCE(view_count, 0) DESC, created_at DESC
         LIMIT 5`
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Popular jobs error:", error);
      res.status(500).json({ error: "Failed to get popular jobs" });
    }
  });

  // ── Increment job view count (idempotent; caller rate-limits) ─────────────
  app.post("/api/jobs/:id/view", async (req, res) => {
    try {
      await query(
        `UPDATE jobs SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`,
        [req.params.id]
      );
      res.json({ ok: true });
    } catch (error) {
      // Non-critical — swallow silently so it never breaks the detail page
      res.json({ ok: false });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const jobWithSkills = await storage.getJobWithSkills(req.params.id);
      if (!jobWithSkills) {
        return res.status(404).json({ error: "Job not found" });
      }
      // Public job details require the same explicit open + approved gate as
      // the public search endpoint. A missing field must never mean approved.
      const approval =
        (jobWithSkills as any).approvalStatus ??
        (jobWithSkills as any).approval_status;
      const isApproved = approval === "approved";
      const isOpen = jobWithSkills.status === "open";
      const isScaffold =
        ((jobWithSkills as any).createdVia ?? (jobWithSkills as any).created_via) === "search_scaffold";
      if (!isApproved || !isOpen || isScaffold) {
        return res.status(404).json({ error: "Job not found" });
      }
      // Mask company data for confidential jobs before sending to public callers
      const jobToReturn = (jobWithSkills as any).isCompanyConfidential
        ? { ...jobWithSkills, company: "Confidential Company", companyOverview: (jobWithSkills as any).confidentialClientOverview ?? null }
        : jobWithSkills;
      res.json(jobToReturn);
    } catch (error) {
      console.error("Job fetch error:", error);
      res.status(500).json({ error: "Failed to get job" });
    }
  });

  app.post(
    "/api/jobs",
    authenticateJWT,
    requireClient,
    async (req: Request, res: Response) => {
      try {
        // Guard 1: reject any non-canonical engagement type value before the DB sees it.
        const etErr = validateEngagementType(req.body.engagementType);
        if (etErr) return res.status(400).json(etErr);

        // Guard 2: published jobs must have an engagement type set.
        const effectiveStatus = req.body.status ?? "open";
        if (["open", "published"].includes(effectiveStatus) && !req.body.engagementType) {
          return res.status(400).json({
            error: "Engagement Type required",
            message: "An Engagement Type (Lite or Standard) must be set before publishing a job.",
          });
        }

        const validated = insertJobSchema.parse(req.body);
        const job = await storage.createJob(validated);
        res.status(201).json(job);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ error: "Validation failed", details: error.errors });
        }
        res.status(500).json({ error: "Failed to create job" });
      }
    },
  );

  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      const updates = insertJobSchema.partial().parse(req.body);

      // Guard 1: reject any non-canonical engagement type value before the DB sees it.
      const etErrPatch = validateEngagementType(updates.engagementType);
      if (etErrPatch) return res.status(400).json(etErrPatch);

      // Guard 2: published jobs must have an engagement type set.
      const existingJob = await storage.getJob(req.params.id);
      const effectiveStatus = updates.status ?? existingJob?.status;
      const effectiveEngagementType =
        "engagementType" in updates ? updates.engagementType : existingJob?.engagementType;
      if (
        ["open", "published"].includes(effectiveStatus as string) &&
        !["Lite", "Standard"].includes(effectiveEngagementType as string)
      ) {
        return res.status(400).json({
          error: "Engagement Type required",
          message: "An Engagement Type (Lite or Standard) must be set before publishing a job.",
        });
      }

      const job = await storage.updateJob(req.params.id, updates);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  app.get("/api/clients/:clientId/jobs", async (req, res) => {
    try {
      const jobs = await storage.listJobsByClient(req.params.clientId);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get client jobs" });
    }
  });

  // ====== ADMIN JOBS ======
  app.get("/api/admin/jobs", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { page, pageSize } = parsePagination(req.query);
      // tab param drives server-side filtering so each tab has its own correct pagination
      const tab = (req.query.tab as string) || "all";

      const allJobs = await storage.listAllJobs();
      // Batch-fetch all needed client profiles in one query to avoid N+1
      const clientIds = Array.from(new Set(allJobs.map((j) => j.clientId)));
      let profileMap: Record<string, { company_name: string | null; contact_person: string | null }> = {};
      if (clientIds.length > 0) {
        const placeholders = clientIds.map((_, i) => `$${i + 1}`).join(", ");
        try {
          const profileResult = await query(
            `SELECT user_id, company_name, contact_person FROM client_profiles WHERE user_id IN (${placeholders})`,
            clientIds,
          );
          for (const row of profileResult.rows) {
            profileMap[row.user_id] = { company_name: row.company_name, contact_person: row.contact_person };
          }
        } catch { /* non-fatal */ }
      }
      const enriched = allJobs.map((job: any) => ({
        ...job,
        clientCompanyName: profileMap[job.clientId]?.company_name ?? null,
        clientContactName: profileMap[job.clientId]?.contact_person ?? null,
      }));

      // Stats are always computed from ALL jobs (not filtered by tab)
      const stats = {
        total: enriched.length,
        open: enriched.filter((j: any) => j.status === "open").length,
        closed: enriched.filter((j: any) => j.status === "closed" || j.status === "cancelled").length,
        pending: enriched.filter((j: any) => j.approvalStatus === "pending").length,
        approved: enriched.filter((j: any) => j.approvalStatus === "approved").length,
        declined: enriched.filter((j: any) => j.approvalStatus === "rejected" || j.approvalStatus === "linked_to_existing").length,
        clientRequests: enriched.filter((j: any) => j.isClientSubmitted === true).length,
      };

      // Filter by tab before paginating so totalPages/total reflect the tab's dataset
      let filtered = enriched;
      if (tab === "pending") {
        filtered = enriched.filter((j: any) => j.approvalStatus === "pending");
      } else if (tab === "approved") {
        filtered = enriched.filter((j: any) => j.approvalStatus === "approved");
      } else if (tab === "declined") {
        filtered = enriched.filter((j: any) => j.approvalStatus === "rejected" || j.approvalStatus === "linked_to_existing");
      }

      // Priority sort within each tab: urgent (2) > featured (1) > normal (0), then newest first.
      // Must happen BEFORE pageSlice so priority jobs bubble to page 1, not stay buried on page N.
      const getPriority = (j: any) => (j.urgentlyHiring ? 2 : 0) + (j.isFeatured ? 1 : 0);
      filtered = [...filtered].sort((a, b) => {
        const pd = getPriority(b) - getPriority(a);
        if (pd !== 0) return pd;
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });

      const { items, meta } = pageSlice(filtered, page, pageSize);
      res.json({ items, meta, stats });
    } catch (error) {
      console.error("Admin jobs list error:", error);
      res.status(500).json({ error: "Failed to list jobs" });
    }
  });

  // GET /api/admin/jobs/options — lightweight job list for filter dropdowns.
  // Returns ALL jobs (no pagination) so the filter is never truncated.
  // MUST be registered before /api/admin/jobs/:id to avoid "options" being treated as an id.
  app.get("/api/admin/jobs/options", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const search = (req.query.search as string | undefined)?.trim();
      const params: any[] = [];
      let sql = `SELECT id, COALESCE(professional_role_name, title) AS title FROM jobs`;
      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        sql += ` WHERE lower(COALESCE(professional_role_name, title)) LIKE $1 OR lower(title) LIKE $1`;
      }
      sql += ` ORDER BY created_at DESC LIMIT 1000`;
      const result = await query(sql, params);
      res.json(result.rows);
    } catch (err: any) {
      console.error("GET /api/admin/jobs/options error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/admin/jobs/client-options — authenticated minimal list for the job-creation client selector.
  // This replaces the previous unauthed GET /api/admin/clients which was purpose-built only for
  // this dropdown. The guided JobFormPage calls this endpoint.
  // NOTE: must be registered BEFORE GET /api/admin/jobs/:id to prevent Express swallowing
  // the literal string "client-options" as a job ID parameter.
  app.get("/api/admin/jobs/client-options", authenticateJWT, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await query(`
        SELECT u.id, u.email, cp.company_name
        FROM   users u
        LEFT JOIN client_profiles cp ON cp.user_id = u.id
        WHERE  u.role = 'client'
        ORDER BY COALESCE(cp.company_name, u.email)
      `);
      res.json(result.rows);
    } catch (err: any) {
      console.error("GET /api/admin/jobs/client-options error:", err);
      res.status(500).json({ error: "Failed to fetch client options" });
    }
  });

  // GET /api/admin/jobs/:id — fetch a single job for the edit page.
  app.get("/api/admin/jobs/:id", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const job = await storage.getJob(id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      res.json(job);
    } catch (err: any) {
      console.error("GET /api/admin/jobs/:id error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Platform Settings routes ─────────────────────────────────────────────
  //
  // GET  /api/platform-settings/public   — unauthenticated, returns safe subset
  // GET  /api/admin/platform-settings    — admin: returns all settings
  // PATCH /api/admin/platform-settings   — admin: update one or more settings

  app.get("/api/platform-settings/public", async (_req: Request, res: Response) => {
    try {
      const { query: dbQuery } = await import('./db');
      const result = await dbQuery(
        `SELECT key, value FROM platform_settings WHERE key IN ('name_reveal_threshold')`
      );
      const settings: Record<string, string> = {};
      for (const row of result.rows) settings[row.key] = row.value;
      res.json({
        nameRevealThreshold: settings['name_reveal_threshold'] ?? 'new',
      });
    } catch (err: any) {
      console.error("GET /api/platform-settings/public error:", err);
      // Never break the client portal — fall back to safe default
      res.json({ nameRevealThreshold: 'new' });
    }
  });

  app.get("/api/admin/platform-settings", authenticateJWT, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const { query: dbQuery } = await import('./db');
      const result = await dbQuery(`SELECT key, value FROM platform_settings ORDER BY key`);
      const settings: Record<string, string> = {};
      for (const row of result.rows) settings[row.key] = row.value;
      res.json(settings);
    } catch (err: any) {
      console.error("GET /api/admin/platform-settings error:", err);
      res.status(500).json({ error: "Failed to fetch platform settings" });
    }
  });

  app.patch("/api/admin/platform-settings", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const ALLOWED_KEYS = new Set([
        'name_reveal_threshold',
        'search_suggestion_threshold',
        'vetted_auto_hire_threshold',
      ]);
      const VALID_THRESHOLDS = new Set(['new', 'reviewed', 'shortlisted', 'hired']);
      const updates: Array<{ key: string; value: string }> = [];

      for (const [key, value] of Object.entries(req.body)) {
        if (!ALLOWED_KEYS.has(key)) {
          return res.status(400).json({ error: `Unknown setting key: ${key}` });
        }
        if (typeof value !== 'string') {
          return res.status(400).json({ error: `Value for ${key} must be a string` });
        }
        if (key === 'name_reveal_threshold' && !VALID_THRESHOLDS.has(value)) {
          return res.status(400).json({ error: `Invalid name_reveal_threshold: ${value}` });
        }
        if (key === 'search_suggestion_threshold') {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 1 || num > 100000) {
            return res.status(400).json({ error: `search_suggestion_threshold must be a positive integer (1–100000)` });
          }
        }
        if (key === 'vetted_auto_hire_threshold') {
          const num = Number(value);
          if (!Number.isInteger(num) || num < 1 || num > 100000) {
            return res.status(400).json({ error: `vetted_auto_hire_threshold must be a positive integer (1–100000)` });
          }
        }
        updates.push({ key, value });
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No valid settings provided" });
      }

      const { query: dbQuery } = await import('./db');
      for (const { key, value } of updates) {
        await dbQuery(
          `INSERT INTO platform_settings (key, value, updated_at)
           VALUES ($1, $2, now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [key, value]
        );
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("PATCH /api/admin/platform-settings error:", err);
      res.status(500).json({ error: "Failed to update platform settings" });
    }
  });

  // GET /api/admin/users — list all platform users (super-admin only)
  app.get("/api/admin/users", authenticateAdminFlexible, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const result = await query(`
        SELECT id, email,
               first_name   AS "firstName",
               last_name    AS "lastName",
               role,
               admin_sub_role AS "adminSubRole"
        FROM users
        ORDER BY role, email
      `);
      res.json(result.rows);
    } catch (err: any) {
      console.error("GET /api/admin/users error:", err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // PATCH /api/admin/users/:id/sub-role — assign / clear admin_sub_role (super-admin only, transactional + audited)
  app.patch("/api/admin/users/:id/sub-role", authenticateAdminFlexible, requireSuperAdmin, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { subRole } = req.body; // 'talent_acquisition' | 'client_success' | null
      const changedBy = (req as any).user?.email ?? "unknown";

      const VALID_VALUES = ["talent_acquisition", "client_success", null];
      const normalizedSubRole: string | null = subRole === undefined ? null : (subRole ?? null);
      if (!VALID_VALUES.includes(normalizedSubRole)) {
        client.release();
        return res.status(400).json({
          error: "Invalid sub-role",
          message: "subRole must be 'talent_acquisition', 'client_success', or null",
        });
      }

      await client.query("BEGIN");

      const targetRow = await client.query(
        "SELECT id, email, role, admin_sub_role FROM users WHERE id = $1 LIMIT 1 FOR UPDATE",
        [id]
      );
      if (targetRow.rows.length === 0) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(404).json({ error: "User not found" });
      }
      const target = targetRow.rows[0];
      if (target.role !== "admin") {
        await client.query("ROLLBACK");
        client.release();
        return res.status(400).json({ error: "Sub-roles only apply to admin accounts" });
      }

      const previousSubRole: string | null = target.admin_sub_role ?? null;
      const newSubRole: string | null = normalizedSubRole;

      // Use 'super_admin' sentinel in audit table when sub-role is null
      // (admin_role_changes.new_role is NOT NULL; null sub-role = super-admin bypass)
      const auditPrevRole = previousSubRole ?? "super_admin";
      const auditNewRole  = newSubRole ?? "super_admin";

      await client.query(
        "UPDATE users SET admin_sub_role = $1, updated_at = NOW() WHERE id = $2",
        [newSubRole, id]
      );

      await client.query(
        `INSERT INTO admin_role_changes
           (user_id, email, previous_role, new_role, mechanism, changed_by, notes)
         VALUES ($1, $2, $3, $4, 'admin_ui_sub_role_assignment', $5,
                 'admin_sub_role changed from ' || $3 || ' to ' || $4)`,
        [id, target.email, auditPrevRole, auditNewRole, changedBy]
      );

      await client.query("COMMIT");
      client.release();

      console.log(`✅ PATCH /api/admin/users/${id}/sub-role: ${target.email} ${auditPrevRole} → ${auditNewRole} (by ${changedBy})`);
      res.json({ success: true, userId: id, email: target.email, previousSubRole, newSubRole });
    } catch (err: any) {
      try { await client.query("ROLLBACK"); } catch {}
      client.release();
      console.error("PATCH /api/admin/users/:id/sub-role error:", err);
      res.status(500).json({ error: "Failed to update sub-role" });
    }
  });

  // ── Interviewer management (Admin-only CRUD) ──────────────────────────────
  //
  // GET    /api/admin/interviewers            — list with calendar connection state
  // POST   /api/admin/interviewers            — create interviewer
  // PATCH  /api/admin/interviewers/:id        — update name/title/calendarEmail/sortOrder
  // DELETE /api/admin/interviewers/:id        — remove interviewer
  //
  // GET /api/admin/interviewer-availability
  //   Query params: interviewerId, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD),
  //                 duration (30|45|60), timezone (IANA)
  //   Returns available interview slot windows from the interviewer's Outlook calendar.
  //   This endpoint NEVER changes any application status.
  //
  // All endpoints are Admin-only.

  app.get("/api/admin/interviewers", authenticateJWT, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const { getInterviewerList } = await import("./services/microsoftGraphCalendarService");
      res.json({ interviewers: await getInterviewerList() });
    } catch (err: any) {
      console.error("GET /api/admin/interviewers error:", err);
      res.status(500).json({ error: "Failed to load interviewer list" });
    }
  });

  app.post("/api/admin/interviewers", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { name, title, calendarEmail, sortOrder } = req.body as {
        name?: string;
        title?: string;
        calendarEmail?: string;
        sortOrder?: number;
      };
      if (!name?.trim()) {
        return res.status(400).json({ error: "name is required" });
      }
      const { db } = await import("./db");
      const { adminInterviewers } = await import("@shared/schema");
      const [created] = await db
        .insert(adminInterviewers)
        .values({
          name: name.trim(),
          title: (title ?? "").trim(),
          calendarEmail: (calendarEmail ?? "").trim(),
          sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
        })
        .returning();
      // Omit calendarEmail from response (same rule as GET)
      const { calendarEmail: _ce, ...safe } = created;
      res.status(201).json({
        interviewer: {
          ...safe,
          isCalendarConnected: !!(
            process.env.MICROSOFT_TENANT_ID &&
            process.env.MICROSOFT_CLIENT_ID &&
            process.env.MICROSOFT_CLIENT_SECRET &&
            created.calendarEmail?.trim()
          ),
        },
      });
    } catch (err: any) {
      console.error("POST /api/admin/interviewers error:", err);
      res.status(500).json({ error: "Failed to create interviewer" });
    }
  });

  app.patch("/api/admin/interviewers/:id", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, title, calendarEmail, sortOrder } = req.body as {
        name?: string;
        title?: string;
        calendarEmail?: string;
        sortOrder?: number;
      };
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name.trim();
      if (title !== undefined) updates.title = title.trim();
      // Only overwrite calendarEmail when a non-empty value is sent.
      // A blank field means "keep existing" — never silently wipe a connection.
      if (calendarEmail !== undefined && calendarEmail.trim() !== "") {
        updates.calendarEmail = calendarEmail.trim();
      }
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;

      const { db } = await import("./db");
      const { adminInterviewers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [updated] = await db
        .update(adminInterviewers)
        .set(updates)
        .where(eq(adminInterviewers.id, id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Interviewer not found" });
      }
      const { calendarEmail: _ce, ...safe } = updated;
      res.json({
        interviewer: {
          ...safe,
          isCalendarConnected: !!(
            process.env.MICROSOFT_TENANT_ID &&
            process.env.MICROSOFT_CLIENT_ID &&
            process.env.MICROSOFT_CLIENT_SECRET &&
            updated.calendarEmail?.trim()
          ),
        },
      });
    } catch (err: any) {
      console.error("PATCH /api/admin/interviewers/:id error:", err);
      res.status(500).json({ error: "Failed to update interviewer" });
    }
  });

  app.delete("/api/admin/interviewers/:id", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { db } = await import("./db");
      const { adminInterviewers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const result = await db
        .delete(adminInterviewers)
        .where(eq(adminInterviewers.id, id));
      if ((result.rowCount ?? 0) === 0) {
        return res.status(404).json({ error: "Interviewer not found" });
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error("DELETE /api/admin/interviewers/:id error:", err);
      res.status(500).json({ error: "Failed to delete interviewer" });
    }
  });

  app.get("/api/admin/interviewer-availability", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { interviewerId, startDate, endDate, duration, timezone } = req.query as Record<string, string>;

      // Validate required params
      if (!interviewerId || !startDate || !endDate || !duration || !timezone) {
        return res.status(400).json({
          error: "Missing required query parameters",
          message: "interviewerId, startDate, endDate, duration, and timezone are all required",
        });
      }

      // Validate date format (YYYY-MM-DD)
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
        return res.status(400).json({ error: "startDate and endDate must be in YYYY-MM-DD format" });
      }

      if (startDate > endDate) {
        return res.status(400).json({ error: "startDate must not be after endDate" });
      }

      // Prevent excessively large windows (max 14 days)
      const startMs = new Date(startDate).getTime();
      const endMs   = new Date(endDate).getTime();
      const daysDiff = (endMs - startMs) / (1000 * 60 * 60 * 24);
      if (daysDiff > 14) {
        return res.status(400).json({ error: "Date range must not exceed 14 days" });
      }

      // Validate duration
      const durationMinutes = parseInt(duration, 10);
      if (![30, 45, 60].includes(durationMinutes)) {
        return res.status(400).json({ error: "duration must be 30, 45, or 60" });
      }

      // Validate timezone (IANA)
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
      } catch {
        return res.status(400).json({ error: `Invalid timezone: ${timezone}` });
      }

      const { getInterviewerSlots, findInterviewerConfig } = await import("./services/microsoftGraphCalendarService");

      // Verify interviewer exists and has a calendar configured before hitting Graph
      const interviewerConfig = await findInterviewerConfig(interviewerId);
      if (!interviewerConfig) {
        return res.status(404).json({ error: `Interviewer '${interviewerId}' not found` });
      }

      if (!interviewerConfig.calendarEmail?.trim()) {
        return res.status(422).json({
          error: "calendar_not_connected",
          message: "This interviewer's Outlook calendar is not yet configured.",
        });
      }

      // Check Graph credentials before making the call
      if (!process.env.MICROSOFT_TENANT_ID || !process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
        return res.status(503).json({
          error: "microsoft_graph_not_configured",
          message: "Microsoft Graph credentials are not configured. Contact the system administrator.",
        });
      }

      const slots = await getInterviewerSlots({
        interviewerId,
        startDate,
        endDate,
        durationMinutes,
        timezone,
      });

      res.json({ slots, timezone, interviewerId });
    } catch (err: any) {
      console.error("GET /api/admin/interviewer-availability error:", err);
      // Distinguish Graph API failures from internal errors
      const isGraphError =
        err.message?.includes("Graph") ||
        err.message?.includes("Microsoft") ||
        err.message?.includes("getSchedule");
      res.status(isGraphError ? 502 : 500).json({
        error: isGraphError ? "graph_api_error" : "internal_error",
        message: isGraphError
          ? "Could not retrieve calendar availability. Check Microsoft Graph permissions."
          : "Failed to retrieve availability",
      });
    }
  });

  // ── Admin interview calendar routes ──────────────────────────────────────────
  // Admins can view all interviews across clients, create new interview rows for
  // any formal-pipeline submission, and update (reschedule/cancel) any interview.
  // These routes do NOT replace the existing client/talent interview endpoints.

  // GET /api/admin/interviews — cross-client calendar listing with optional filters
  // Query params: status, clientId, talentId, jobId, dateFrom, dateTo
  app.get("/api/admin/interviews", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status, clientId, talentId, jobId, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

      const conditions: string[] = [];
      const params: any[] = [];

      if (status) {
        params.push(status);
        conditions.push(`i.status = $${params.length}`);
      }
      if (clientId) {
        params.push(clientId);
        conditions.push(`js.client_id = $${params.length}`);
      }
      if (talentId) {
        params.push(talentId);
        conditions.push(`js.talent_id = $${params.length}`);
      }
      if (jobId) {
        params.push(jobId);
        conditions.push(`js.job_id = $${params.length}`);
      }
      if (dateFrom) {
        params.push(dateFrom);
        conditions.push(`(i.confirmed_time >= $${params.length}::timestamptz OR (i.confirmed_time IS NULL AND i.created_at >= $${params.length}::timestamptz))`);
      }
      if (dateTo) {
        params.push(dateTo);
        conditions.push(`(i.confirmed_time <= $${params.length}::timestamptz OR (i.confirmed_time IS NULL AND i.created_at <= $${params.length}::timestamptz))`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const result = await query(
        `SELECT i.*,
                j.title       AS job_title,
                j.company     AS job_company,
                j.id          AS job_id,
                js.client_id  AS client_id,
                js.talent_id  AS talent_id,
                c.full_name   AS talent_full_name
           FROM interviews i
           JOIN job_submissions js ON js.id = i.submission_id
              AND js.${FORMAL_PIPELINE_PREDICATE}
           JOIN jobs j ON j.id = js.job_id
           LEFT JOIN candidates c ON c.id = (
             SELECT cand.id FROM candidates cand
              WHERE cand.user_id = js.talent_id LIMIT 1
           )
           ${where}
          ORDER BY
            CASE WHEN i.confirmed_time IS NOT NULL THEN i.confirmed_time
                 ELSE i.created_at END DESC
          LIMIT 500`,
        params,
      );
      return res.json(result.rows);
    } catch (err: any) {
      console.error("GET /api/admin/interviews error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/interviews — admin creates an interview for any formal-pipeline submission
  // Body: { submissionId, interviewType?, proposedTimes, durationMinutes?, candidateNotes?, internalNotes?, meetingLink? }
  app.post("/api/admin/interviews", pipelineMutationLimiter, authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const {
        submissionId, interviewType = "initial", proposedTimes,
        durationMinutes, candidateNotes, internalNotes, meetingLink,
        confirmedTime, confirmedTimeZone,
      } = req.body;

      if (!submissionId) return res.status(400).json({ error: "submissionId is required" });
      if (!Array.isArray(proposedTimes) || proposedTimes.length === 0) {
        return res.status(400).json({ error: "proposedTimes must be a non-empty array of time slots" });
      }
      const normalizedProposedTimes = normalizeInterviewTimes(proposedTimes);
      if (!normalizedProposedTimes) {
        return res.status(400).json({ error: "proposedTimes must contain one to ten valid time slots" });
      }

      // Optional: admin confirms a specific slot directly at creation time
      let directConfirmedTime: string | null = null;
      let directConfirmedZone: string | null = null;
      if (confirmedTime) {
        const ts = parseInterviewTimestamp(confirmedTime);
        if (Number.isNaN(ts)) {
          return res.status(400).json({ error: "confirmedTime is not a valid ISO timestamp" });
        }
        if (ts < Date.now()) {
          return res.status(400).json({ error: "confirmedTime must be in the future" });
        }
        directConfirmedTime = new Date(ts).toISOString();
        directConfirmedZone = confirmedTimeZone ? (normalizeInterviewTimeZone(confirmedTimeZone) ?? "UTC") : "UTC";
      }
      const validTypes = ["initial", "technical", "final", "culture", "other"];
      if (!validTypes.includes(interviewType)) {
        return res.status(400).json({ error: "interviewType must be one of: " + validTypes.join(", ") });
      }

      let parsedDuration: number | null = null;
      if (durationMinutes !== undefined && durationMinutes !== null) {
        parsedDuration = Number(durationMinutes);
        if (!Number.isInteger(parsedDuration) || parsedDuration < 15 || parsedDuration > 240) {
          return res.status(400).json({ error: "durationMinutes must be an integer between 15 and 240" });
        }
      }

      let normalizedMeetingLink: string | null | undefined;
      if (meetingLink !== undefined) {
        normalizedMeetingLink = normalizeMeetingLink(meetingLink);
        if (normalizedMeetingLink === undefined) {
          return res.status(400).json({ error: "meetingLink must be a valid http(s) URL no longer than 2048 characters" });
        }
      }

      // Verify submission exists and is in a formal pipeline
      const subResult = await query(
        `SELECT js.id, js.status, js.talent_id, js.client_id, j.title AS job_title
           FROM job_submissions js
           JOIN jobs j ON j.id = js.job_id
          WHERE js.id = $1 AND js.${FORMAL_PIPELINE_PREDICATE}`,
        [submissionId],
      );
      if (!subResult.rows.length) {
        return res.status(404).json({ error: "Submission not found or not in the formal pipeline" });
      }
      const submission = subResult.rows[0];

      const scheduleable = ["shortlisted", "reviewed", "under_review", "interviewing", "new", "in_review"];
      if (!scheduleable.includes(submission.status)) {
        return res.status(409).json({
          error: "cannot_schedule_interview",
          message: `Submission status '${submission.status}' does not allow scheduling an interview.`,
        });
      }

      // For direct-confirm: serialise conflict check + insert with a per-talent advisory lock
      // inside a transaction so two concurrent admin requests cannot both pass the overlap check.
      // For talent-led proposals there is no confirmed slot yet, so no lock/check needed.
      let interview: any;
      if (directConfirmedTime && submission.talent_id) {
        const txClient = await pool.connect();
        try {
          await txClient.query("BEGIN");
          // Advisory lock keyed by talent user id (prevents concurrent confirms for same talent)
          await txClient.query(
            `SELECT pg_advisory_xact_lock(hashtext($1 || ':interview_confirm'))`,
            [submission.talent_id],
          );
          // Conflict check inside the lock
          const effectiveDuration = parsedDuration ?? 60;
          const slotEnd = new Date(new Date(directConfirmedTime).getTime() + effectiveDuration * 60_000).toISOString();
          const conflict = await txClient.query(
            `SELECT 1 FROM interviews i
               JOIN job_submissions js ON js.id = i.submission_id
              WHERE js.talent_id = $1
                AND i.status = 'confirmed'
                AND i.confirmed_time IS NOT NULL
                AND i.confirmed_time < $3::timestamptz
                AND (i.confirmed_time + INTERVAL '1 minute' * COALESCE(i.duration_minutes, 60)) > $2::timestamptz
              LIMIT 1`,
            [submission.talent_id, directConfirmedTime, slotEnd],
          );
          if (conflict.rows.length > 0) {
            await txClient.query("ROLLBACK");
            txClient.release();
            return res.status(409).json({
              error: "interview_time_conflict",
              message: "That confirmed time overlaps another scheduled interview. Please choose another time.",
            });
          }
          const roundResult = await txClient.query(
            `SELECT COALESCE(MAX(round_number), 0) + 1 AS next_round FROM interviews WHERE submission_id = $1`,
            [submissionId],
          );
          const roundNumber = roundResult.rows[0].next_round;
          const insertRow = await txClient.query(
            `INSERT INTO interviews
               (submission_id, round_number, interview_type, status, proposed_times,
                current_proposal_owner, proposal_exchange_count,
                candidate_notes, internal_notes, created_by, duration_minutes, meeting_link,
                confirmed_time, confirmed_time_zone)
             VALUES ($1, $2, $3, 'confirmed', $4, NULL, 0, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
              submissionId, roundNumber, interviewType,
              JSON.stringify(normalizedProposedTimes),
              candidateNotes ?? null, internalNotes ?? null, userId, parsedDuration,
              normalizedMeetingLink ?? null, directConfirmedTime, directConfirmedZone,
            ],
          );
          interview = insertRow.rows[0];
          await txClient.query(
            `INSERT INTO interview_proposals
               (interview_id, proposer_id, proposer_role, action, proposed_times, selected_time, selected_time_zone)
             VALUES ($1, $2, 'admin', 'accepted', $3, $4, $5)`,
            [interview.id, userId, JSON.stringify(normalizedProposedTimes), directConfirmedTime, directConfirmedZone],
          );
          if (!["interviewing"].includes(submission.status)) {
            await txClient.query(
              `UPDATE job_submissions SET status = 'interviewing', updated_at = NOW() WHERE id = $1`,
              [submissionId],
            );
            await txClient.query(
              `INSERT INTO job_application_status_history
                 (application_id, previous_status, new_status, note, changed_by)
               VALUES ($1, $2, 'interviewing', $3, $4)`,
              [submissionId, submission.status,
               `Round ${roundNumber} interview confirmed by admin (type: ${interviewType})`, userId],
            );
          }
          await txClient.query("COMMIT");
        } catch (txErr: any) {
          await txClient.query("ROLLBACK").catch(() => {});
          txClient.release();
          throw txErr;
        }
        txClient.release();
      } else {
        // Talent-led: no confirmed slot yet — just insert proposed interview
        const roundResult = await query(
          `SELECT COALESCE(MAX(round_number), 0) + 1 AS next_round FROM interviews WHERE submission_id = $1`,
          [submissionId],
        );
        const roundNumber = roundResult.rows[0].next_round;
        const insertRow = await query(
          `INSERT INTO interviews
             (submission_id, round_number, interview_type, status, proposed_times,
              current_proposal_owner, proposal_exchange_count,
              candidate_notes, internal_notes, created_by, duration_minutes, meeting_link,
              confirmed_time, confirmed_time_zone)
           VALUES ($1, $2, $3, 'proposed', $4, 'talent', 0, $5, $6, $7, $8, $9, NULL, NULL)
           RETURNING *`,
          [
            submissionId, roundNumber, interviewType,
            JSON.stringify(normalizedProposedTimes),
            candidateNotes ?? null, internalNotes ?? null, userId, parsedDuration,
            normalizedMeetingLink ?? null,
          ],
        );
        interview = insertRow.rows[0];
        await query(
          `INSERT INTO interview_proposals
             (interview_id, proposer_id, proposer_role, action, proposed_times, selected_time, selected_time_zone)
           VALUES ($1, $2, 'admin', 'initial', $3, NULL, NULL)`,
          [interview.id, userId, JSON.stringify(normalizedProposedTimes)],
        );
        if (!["interviewing"].includes(submission.status)) {
          await query(
            `UPDATE job_submissions SET status = 'interviewing', updated_at = NOW() WHERE id = $1`,
            [submissionId],
          );
          await query(
            `INSERT INTO job_application_status_history
               (application_id, previous_status, new_status, note, changed_by)
             VALUES ($1, $2, 'interviewing', $3, $4)`,
            [submissionId, submission.status,
             `Round ${roundNumber} interview proposed by admin (type: ${interviewType})`, userId],
          );
        }
      }

      // Notify talent (fire-and-forget)
      if (submission.talent_id) {
        const isDirectConfirm = Boolean(directConfirmedTime);
        storage.createNotification({
          userId: submission.talent_id as string,
          type: isDirectConfirm ? "interview_confirmed" : "interview_proposed",
          title: isDirectConfirm ? "Interview confirmed" : "Interview proposed",
          message: isDirectConfirm
            ? `Your interview for "${submission.job_title}" has been confirmed. Log in to the portal to view the details.`
            : `An interview has been proposed for "${submission.job_title}". Please review the suggested times.`,
          relatedId: String(interview.id),
          relatedType: "interview",
        }).catch((e: any) => console.error("admin interview notification failed:", e));

        // Transactional email (fire-and-forget — failure never rolls back the scheduling)
        if (isDirectConfirm) {
          sendInterviewConfirmedEmail({
            talentUserId: submission.talent_id as string,
            jobTitle: submission.job_title,
            confirmedTime: directConfirmedTime!,
            confirmedTimeZone: directConfirmedZone ?? "UTC",
            durationMinutes: parsedDuration,
            meetingLink: normalizedMeetingLink ?? null,
            interviewType,
            roundNumber: interview.round_number ?? null,
          }).catch((e: any) => console.error("admin interview confirmation email failed:", e));
        } else {
          sendInterviewProposalEmail({
            talentUserId: submission.talent_id as string,
            jobTitle: submission.job_title,
            proposedTimes: normalizedProposedTimes,
            durationMinutes: parsedDuration,
            candidateNotes: candidateNotes ?? null,
            interviewType,
            roundNumber: interview.round_number ?? null,
            proposerRole: "admin",
          }).catch((e: any) => console.error("admin interview proposal email failed:", e));
        }
      }

      return res.status(201).json(interview);
    } catch (err: any) {
      console.error("POST /api/admin/interviews error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/admin/interviews/:id — admin reschedule or cancel
  // Body: { status?, proposedTimes?, confirmedTime?, confirmedTimeZone?, durationMinutes?,
  //         candidateNotes?, internalNotes?, meetingLink?, cancellationReason? }
  app.patch("/api/admin/interviews/:id", pipelineMutationLimiter, authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;
      const {
        status, proposedTimes, confirmedTime, confirmedTimeZone,
        durationMinutes, candidateNotes, internalNotes, meetingLink, cancellationReason,
      } = req.body;

      const interviewResult = await query(
        `SELECT i.*, js.talent_id, j.title AS job_title
           FROM interviews i
           JOIN job_submissions js ON js.id = i.submission_id
              AND js.${FORMAL_PIPELINE_PREDICATE}
           JOIN jobs j ON j.id = js.job_id
          WHERE i.id = $1`,
        [id],
      );
      if (!interviewResult.rows.length) {
        return res.status(404).json({ error: "Interview not found" });
      }
      const interview = interviewResult.rows[0];

      const updates: Record<string, any> = { updated_at: "NOW()" };
      const params: any[] = [];
      let notifType: string | null = null;
      // Confirm path needs atomic conflict-check+write; validated values captured here
      let confirmedIsoForTx: string | null = null;
      let confirmedTzForTx: string | null = null;

      if (status) {
        const validStatuses = ["proposed", "confirmed", "rescheduled", "cancelled"];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: "status must be one of: " + validStatuses.join(", ") });
        }
        if (status === "confirmed") {
          if (!confirmedTime) {
            return res.status(400).json({ error: "confirmedTime is required when confirming" });
          }
          const ts = parseInterviewTimestamp(confirmedTime);
          if (Number.isNaN(ts)) {
            return res.status(400).json({ error: "confirmedTime is not a valid ISO timestamp" });
          }
          confirmedIsoForTx = new Date(ts).toISOString();
          confirmedTzForTx = confirmedTimeZone ? (normalizeInterviewTimeZone(confirmedTimeZone) ?? "UTC") : "UTC";
          // These will be applied inside the transaction; pre-add placeholders so setClauses is built
          params.push(confirmedIsoForTx);
          updates.confirmed_time = `$${params.length}`;
          params.push(confirmedTzForTx);
          updates.confirmed_time_zone = `$${params.length}`;
          updates.current_proposal_owner = "NULL";
          notifType = "interview_confirmed";
        }
        if (status === "rescheduled" || (status === "proposed" && proposedTimes)) {
          const normalizedTimes = normalizeInterviewTimes(proposedTimes);
          if (!normalizedTimes) {
            return res.status(400).json({ error: "proposedTimes must contain one to ten valid time slots" });
          }
          params.push(JSON.stringify(normalizedTimes));
          updates.proposed_times = `$${params.length}`;
          updates.confirmed_time = "NULL";
          updates.confirmed_time_zone = "NULL";
          notifType = "interview_rescheduled";
          // Record in proposal history
          await query(
            `INSERT INTO interview_proposals
               (interview_id, proposer_id, proposer_role, action, proposed_times)
             VALUES ($1, $2, 'admin', 'reschedule', $3)`,
            [id, userId, JSON.stringify(normalizedTimes)],
          );
        }
        if (status === "cancelled") {
          updates.confirmed_time = "NULL";
          updates.confirmed_time_zone = "NULL";
          updates.cancelled_at = "NOW()";
          if (typeof cancellationReason === "string") {
            params.push(cancellationReason.slice(0, 2000));
            updates.cancellation_reason = `$${params.length}`;
          }
          notifType = "interview_cancelled";
        }
        params.push(status);
        updates.status = `$${params.length}`;
      }

      if (durationMinutes !== undefined && durationMinutes !== null) {
        const dur = Number(durationMinutes);
        if (!Number.isInteger(dur) || dur < 15 || dur > 240) {
          return res.status(400).json({ error: "durationMinutes must be an integer between 15 and 240" });
        }
        params.push(dur);
        updates.duration_minutes = `$${params.length}`;
      }
      if (candidateNotes !== undefined) {
        params.push(String(candidateNotes).slice(0, 5000));
        updates.candidate_notes = `$${params.length}`;
      }
      if (internalNotes !== undefined) {
        params.push(String(internalNotes).slice(0, 5000));
        updates.internal_notes = `$${params.length}`;
      }
      if (meetingLink !== undefined) {
        const normalized = normalizeMeetingLink(meetingLink);
        if (normalized === undefined) {
          return res.status(400).json({ error: "meetingLink must be a valid http(s) URL" });
        }
        params.push(normalized);
        updates.meeting_link = `$${params.length}`;
      }

      if (Object.keys(updates).length === 1) {
        return res.status(400).json({ error: "No updatable fields provided" });
      }

      const setClauses = Object.entries(updates)
        .map(([col, val]) => `${col} = ${val === "NOW()" || val === "NULL" ? val : val}`)
        .join(", ");
      params.push(id);

      let updatedRow: any;
      if (confirmedIsoForTx && interview.talent_id) {
        // Serialise conflict check + UPDATE with per-talent advisory lock
        const txClient2 = await pool.connect();
        try {
          await txClient2.query("BEGIN");
          await txClient2.query(
            `SELECT pg_advisory_xact_lock(hashtext($1 || ':interview_confirm'))`,
            [interview.talent_id],
          );
          const patchDuration = durationMinutes ? Number(durationMinutes) : (interview.duration_minutes ?? 60);
          const slotEnd = new Date(new Date(confirmedIsoForTx).getTime() + patchDuration * 60_000).toISOString();
          const conflict = await txClient2.query(
            `SELECT 1 FROM interviews i2
               JOIN job_submissions js ON js.id = i2.submission_id
              WHERE js.talent_id = $1
                AND i2.id != $4
                AND i2.status = 'confirmed'
                AND i2.confirmed_time IS NOT NULL
                AND i2.confirmed_time < $3::timestamptz
                AND (i2.confirmed_time + INTERVAL '1 minute' * COALESCE(i2.duration_minutes, 60)) > $2::timestamptz
              LIMIT 1`,
            [interview.talent_id, confirmedIsoForTx, slotEnd, id],
          );
          if (conflict.rows.length > 0) {
            await txClient2.query("ROLLBACK");
            txClient2.release();
            return res.status(409).json({
              error: "interview_time_conflict",
              message: "That confirmed time overlaps another scheduled interview for this talent.",
            });
          }
          const updated2 = await txClient2.query(
            `UPDATE interviews SET ${setClauses} WHERE id = $${params.length} RETURNING *`,
            params,
          );
          await txClient2.query(
            `INSERT INTO interview_proposals
               (interview_id, proposer_id, proposer_role, action, proposed_times, selected_time, selected_time_zone)
             VALUES ($1, $2, 'admin', 'accepted', $3, $4, $5)`,
            [id, userId, JSON.stringify(interview.proposed_times ?? []), confirmedIsoForTx, confirmedTzForTx],
          );
          await txClient2.query("COMMIT");
          updatedRow = updated2.rows[0];
        } catch (txErr: any) {
          await txClient2.query("ROLLBACK").catch(() => {});
          txClient2.release();
          throw txErr;
        }
        txClient2.release();
      } else {
        const updated = await query(
          `UPDATE interviews SET ${setClauses} WHERE id = $${params.length} RETURNING *`,
          params,
        );
        updatedRow = updated.rows[0];
      }

      // Post-update notification to talent
      if (notifType && interview.talent_id) {
        const notifMessages: Record<string, string> = {
          interview_confirmed: `Your interview for "${interview.job_title}" has been confirmed.`,
          interview_rescheduled: `New interview times have been proposed for "${interview.job_title}". Please review.`,
          interview_cancelled: `Your scheduled interview for "${interview.job_title}" has been cancelled.`,
        };
        storage.createNotification({
          userId: interview.talent_id,
          type: notifType,
          title: notifType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          message: notifMessages[notifType] ?? "Your interview has been updated.",
          relatedId: String(id),
          relatedType: "interview",
        }).catch((e: any) => console.error(`${notifType} notification failed:`, e));

        // Transactional email for confirmation (fire-and-forget)
        if (notifType === "interview_confirmed" && confirmedIsoForTx) {
          // Resolve meeting link: prefer the incoming value (already validated above)
          // then fall back to whatever was previously stored on the interview row.
          const emailMeetingLink =
            meetingLink !== undefined
              ? (normalizeMeetingLink(meetingLink) ?? null)
              : (interview.meeting_link ?? null);
          const emailDuration =
            durationMinutes !== undefined && durationMinutes !== null
              ? Number(durationMinutes)
              : (interview.duration_minutes ?? null);
          sendInterviewConfirmedEmail({
            talentUserId: interview.talent_id as string,
            jobTitle: interview.job_title,
            confirmedTime: confirmedIsoForTx,
            confirmedTimeZone: confirmedTzForTx ?? "UTC",
            durationMinutes: emailDuration,
            meetingLink: emailMeetingLink,
            interviewType: interview.interview_type ?? undefined,
            roundNumber: interview.round_number ?? null,
          }).catch((e: any) => console.error("admin interview confirmation email (PATCH) failed:", e));
        }
      }

      return res.json(updatedRow);
    } catch (err: any) {
      console.error("PATCH /api/admin/interviews/:id error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/clients — paginated, searchable client management list.
  // Phase 5: client_success sub-role required (NULL = super-admin bypass).
  app.get("/api/admin/clients", authenticateJWT, requireAdmin, requireAdminSubRole(["client_success"]), async (req: Request, res: Response) => {
    try {
      const search = (req.query.search as string) || null;
      const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
      const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 25));
      const offset = (page - 1) * limit;

      const countResult = await query(`
        SELECT COUNT(*)::int AS total
        FROM   users u
        LEFT JOIN client_profiles cp ON cp.user_id = u.id
        WHERE  u.role = 'client'
          AND ($1::text IS NULL
            OR u.email        ILIKE '%' || $1 || '%'
            OR cp.company_name ILIKE '%' || $1 || '%'
            OR u.first_name    ILIKE '%' || $1 || '%'
            OR u.last_name     ILIKE '%' || $1 || '%')
      `, [search]);

      const result = await query(`
        SELECT
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.created_at,
          cp.company_name,
          cp.contact_person,
          cp.phone_number,
          cp.industry,
          cp.location,
          cp.website,
          COUNT(j.id)::int                                               AS total_jobs,
          COUNT(j.id) FILTER (WHERE j.status = 'open')::int              AS open_jobs,
          COUNT(j.id) FILTER (WHERE j.status = 'closed')::int            AS closed_jobs,
          COUNT(j.id) FILTER (WHERE j.approval_status = 'pending')::int  AS pending_jobs
        FROM   users u
        LEFT JOIN client_profiles cp ON cp.user_id = u.id
        LEFT JOIN jobs j             ON j.client_id = u.id
        WHERE  u.role = 'client'
          AND ($1::text IS NULL
            OR u.email        ILIKE '%' || $1 || '%'
            OR cp.company_name ILIKE '%' || $1 || '%'
            OR u.first_name    ILIKE '%' || $1 || '%'
            OR u.last_name     ILIKE '%' || $1 || '%')
        GROUP BY
          u.id, u.email, u.first_name, u.last_name, u.created_at,
          cp.company_name, cp.contact_person, cp.phone_number,
          cp.industry, cp.location, cp.website
        ORDER BY u.created_at DESC
        LIMIT $2 OFFSET $3
      `, [search, limit, offset]);

      res.json({
        total: countResult.rows[0]?.total ?? 0,
        page,
        limit,
        items: result.rows,
      });
    } catch (err: any) {
      console.error("GET /api/admin/clients error:", err);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // GET /api/admin/clients/:id — single client detail (client_success sub-role required)
  app.get("/api/admin/clients/:id", authenticateJWT, requireAdmin, requireAdminSubRole(["client_success"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await query(`
        SELECT
          u.id, u.email, u.first_name, u.last_name, u.created_at,
          cp.company_name, cp.contact_person, cp.phone_number,
          cp.industry, cp.location, cp.website,
          COUNT(j.id)::int                                              AS total_jobs,
          COUNT(j.id) FILTER (WHERE j.status = 'open')::int             AS open_jobs,
          COUNT(j.id) FILTER (WHERE j.status = 'closed')::int           AS closed_jobs,
          COUNT(j.id) FILTER (WHERE j.approval_status = 'pending')::int AS pending_jobs
        FROM users u
        LEFT JOIN client_profiles cp ON cp.user_id = u.id
        LEFT JOIN jobs j             ON j.client_id = u.id
        WHERE u.id = $1 AND u.role = 'client'
        GROUP BY u.id, u.email, u.first_name, u.last_name, u.created_at,
                 cp.company_name, cp.contact_person, cp.phone_number,
                 cp.industry, cp.location, cp.website
      `, [id]);
      if (!result.rows.length) return res.status(404).json({ error: "Client not found" });
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error("GET /api/admin/clients/:id error:", err);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  // GET /api/admin/talent — paginated, searchable, filterable talent list.
  //
  // Query params:
  //   search          — matches email, first_name, last_name, full_name
  //   skill           — filter to talent whose core_skills or secondary_skills
  //                     contain this value (case-sensitive array containment)
  //   applicationStatus — filter to talent who have at least one submission
  //                       with this status value
  //   vetted          — when true, filter to talent with the Vetted badge
  //   sortBy          — "vetted" enables Vetted-status sorting
  //   sortOrder       — "asc" puts Not vetted first; "desc" puts Vetted first
  //   page, limit     — pagination
  //
  // Response item fields (all admin-accessible, none redacted):
  //   id, email, first_name, last_name, created_at, candidate_id,
  //   category, profile_completed, location, target_position, seniority,
  //   headline, availability,
  //   top_skills        — first 3 elements of core_skills (full array visible in detail)
  //   total_applications — count of job_submissions where talent_id = u.id
  //   last_active_at    — GREATEST(users.updated_at, latest submission.submitted_at)
  //   is_vetted        — whether the talent has the Vetted badge
  //
  // Note: profile_completed is the stored boolean; the full completion percentage
  // is computed and shown on the talent detail page (Phase 4).
  //
  // Phase 5 (Task #271): requireAdminSubRole(['talent_acquisition']) is already
  // present from the merged enforcement layer. NULL sub_role bypasses it (super-admin).
  app.get("/api/admin/talent", authenticateJWT, requireAdmin, requireAdminSubRole(["talent_acquisition"]), async (req: Request, res: Response) => {
    try {
      const search            = String(req.query.search            ?? "").trim();
      const skill             = String(req.query.skill             ?? "").trim();
      const applicationStatus = String(req.query.applicationStatus ?? "").trim();
      const vetted            = String(req.query.vetted            ?? "").trim().toLowerCase() === "true";
      const sortBy            = String(req.query.sortBy            ?? "").trim();
      const sortOrder         = String(req.query.sortOrder         ?? "").trim().toUpperCase() === "ASC" ? "ASC" : "DESC";
      const page   = Math.max(1, parseInt(String(req.query.page  ?? 1),  10));
      const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 50), 10)));
      const offset = (page - 1) * limit;
      const orderSQL = sortBy === "vetted"
        ? `COALESCE(c.is_vetted, false) ${sortOrder}, u.created_at DESC, u.id DESC`
        : "u.created_at DESC, u.id DESC";

      // Build WHERE clause dynamically so each filter is an independent
      // optional condition and parameter indices stay correct.
      const conditions: string[] = ["u.role = 'talent'"];
      const filterParams: any[]  = [];

      if (search) {
        filterParams.push(`%${search}%`);
        const p = `$${filterParams.length}`;
        conditions.push(
          `(u.email ILIKE ${p} OR u.first_name ILIKE ${p} OR u.last_name ILIKE ${p} OR c.full_name ILIKE ${p})`
        );
      }

      if (skill) {
        filterParams.push(skill);
        const p = `$${filterParams.length}`;
        conditions.push(
          `(c.core_skills @> ARRAY[${p}]::text[] OR c.secondary_skills @> ARRAY[${p}]::text[])`
        );
      }

      if (applicationStatus) {
        filterParams.push(applicationStatus);
        const p = `$${filterParams.length}`;
        conditions.push(
          `EXISTS (SELECT 1 FROM job_submissions js2 WHERE js2.talent_id = u.id AND js2.status = ${p})`
        );
      }

      if (vetted) {
        conditions.push("c.is_vetted = true");
      }

      const whereSQL   = `WHERE ${conditions.join(" AND ")}`;
      const limitIdx   = filterParams.length + 1;
      const offsetIdx  = filterParams.length + 2;
      const listParams = [...filterParams, limit, offset];

      const [countResult, vettedCountResult, listResult] = await Promise.all([
        query(
          `SELECT COUNT(*)::int AS total
           FROM   users u
           LEFT JOIN candidates c ON c.user_id = u.id
           ${whereSQL}`,
          filterParams
        ),
        query(
          `SELECT COUNT(*)::int AS total
           FROM   users u
           LEFT JOIN candidates c ON c.user_id = u.id
           ${whereSQL}
             AND c.is_vetted = true`,
          filterParams
        ),
        query(
          `SELECT
             u.id,
             u.email,
             u.first_name,
             u.last_name,
             u.created_at,
             c.id                    AS candidate_id,
             c.category,
             c.profile_completed,
             c.location,
             c.target_position,
             c.seniority,
             c.headline,
             c.availability,
              COALESCE(c.is_vetted,    false) AS is_vetted,
              COALESCE(c.is_verified, false) AS is_verified,
             c.core_skills[1:3]      AS top_skills,
             COALESCE(
               (SELECT COUNT(*)::int FROM job_submissions js
                WHERE js.talent_id = u.id),
               0
             )                       AS total_applications,
             GREATEST(
               u.updated_at,
               (SELECT MAX(js.submitted_at) FROM job_submissions js
                WHERE js.talent_id = u.id)
             )                       AS last_active_at
           FROM   users u
           LEFT JOIN candidates c ON c.user_id = u.id
           ${whereSQL}
            ORDER BY ${orderSQL}
           LIMIT  $${limitIdx} OFFSET $${offsetIdx}`,
          listParams
        ),
      ]);

      res.json({
        total: countResult.rows[0]?.total ?? 0,
        vettedTotal: vettedCountResult.rows[0]?.total ?? 0,
        page,
        limit,
        items: listResult.rows,
      });
    } catch (err: any) {
      console.error("GET /api/admin/talent error:", err);
      res.status(500).json({ error: "Failed to fetch talent list" });
    }
  });

  // GET /api/admin/talent/:id — full talent profile + reverse cross-reference applications.
  //
  // The :id parameter is users.id (what AdminTalent.tsx sends from the list).
  // The original Task #271 handler used storage.getCandidate(candidates.id) which
  // would 404 for every row — replaced here with a users.id lookup.
  //
  // REVERSE CROSS-REFERENCE BOUNDARY (enforced at query + object-construction level):
  // The nested applications array contains ONLY:
  //   { applicationId, jobTitle, clientCompanyName, applicationStatus, submittedAt }
  // No client email, phone, contactPerson, about, companySize, website, or any other
  // client-profile field is selected by the query or placed into the response object.
  // Enforcement is double: SQL SELECT names only those five values, and the JS push()
  // explicitly constructs the object with only those five keys — no spread, no row
  // passthrough.
  //
  // Phase 5 (Task #271): requireAdminSubRole(['talent_acquisition']) already applied.
  app.get("/api/admin/talent/:id", authenticateJWT, requireAdmin, requireAdminSubRole(["talent_acquisition"]), async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;

      // ── 1. Talent profile (lookup by users.id, joined to candidates) ──────
      const profileResult = await query(`
        SELECT
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.created_at,
          c.id                   AS candidate_id,
          c.full_name,
          c.display_name,
          c.category,
          c.target_position,
          c.seniority,
          c.experience_years,
          c.headline,
          c.summary,
          c.more_about_me,
          c.availability,
          c.location,
          c.core_skills,
          c.secondary_skills,
          c.work_history,
          c.education,
          c.certifications,
          c.preferences,
          c.profile_completed,
          c.profile_photo_url,
          c.linkedin_url,
          c.github_url,
          c.portfolio_url,
          c.website_url,
          c.resume_url           IS NOT NULL AS has_resume,
          c.video_intro_url      IS NOT NULL AS has_video,
          c.resume_file_name,
          c.video_intro_file_name,
          c.updated_at           AS profile_updated_at,
          c.is_vetted,
          c.vetted_at,
          c.vetted_by_mechanism
        FROM   users u
        LEFT JOIN candidates c ON c.user_id = u.id
        WHERE  u.id   = $1
          AND  u.role = 'talent'
      `, [userId]);

      if (profileResult.rows.length === 0) {
        return res.status(404).json({ error: "Talent not found" });
      }

      const profileRow = profileResult.rows[0];

      // ── 2. Applications — reverse cross-reference ─────────────────────────
      // SQL SELECT names ONLY the five cross-reference fields.
      // No client email, phone, contactPerson, or other client-profile columns
      // are fetched here. The JS push() below constructs the object explicitly
      // with only those five keys — no spread.
      const appsResult = await query(`
        SELECT
          js.id                                                    AS application_id,
          COALESCE(j.professional_role_name, j.title)             AS job_title,
          COALESCE(cp.company_name, u_c.email)                    AS client_company_name,
          js.status                                                AS application_status,
          js.submitted_at
        FROM   job_submissions js
        JOIN   jobs          j   ON j.id        = js.job_id
        JOIN   users         u_c ON u_c.id      = js.client_id
        LEFT JOIN client_profiles cp ON cp.user_id = u_c.id
        WHERE  js.talent_id = $1
        ORDER  BY js.submitted_at DESC NULLS LAST
      `, [userId]);

      // Explicit object construction — no spread, no row passthrough.
      const applications = appsResult.rows.map(row => ({
        applicationId:     row.application_id,
        jobTitle:          row.job_title,
        clientCompanyName: row.client_company_name,
        applicationStatus: row.application_status,
        submittedAt:       row.submitted_at,
      }));

      // ── 3. Vetted status audit history ─────────────────────────────────────
      // Keep this separate from the profile's current status so admins can see
      // every grant/revoke event, including the reason and acting admin.
      const vettingHistoryResult = await query(`
        SELECT
          id,
          new_role    AS action,
          notes       AS reason,
          changed_by,
          changed_at
        FROM admin_role_changes
        WHERE user_id = $1
          AND change_type = 'vetting_status'
        ORDER BY changed_at DESC
      `, [userId]);

      const vettingHistory = vettingHistoryResult.rows.map(row => ({
        id:        row.id,
        action:    row.action === 'vetted' ? 'granted' : 'revoked',
        reason:    row.reason,
        changedBy: row.changed_by,
        changedAt: row.changed_at,
      }));

      res.json({
        talent: {
          id:                 profileRow.id,
          email:              profileRow.email,
          firstName:          profileRow.first_name,
          lastName:           profileRow.last_name,
          createdAt:          profileRow.created_at,
          candidateId:        profileRow.candidate_id,
          fullName:           profileRow.full_name,
          displayName:        profileRow.display_name,
          category:           profileRow.category,
          targetPosition:     profileRow.target_position,
          seniority:          profileRow.seniority,
          experienceYears:    profileRow.experience_years,
          headline:           profileRow.headline,
          summary:            profileRow.summary,
          moreAboutMe:        profileRow.more_about_me,
          availability:       profileRow.availability,
          location:           profileRow.location,
          coreSkills:         profileRow.core_skills ?? [],
          secondarySkills:    profileRow.secondary_skills ?? [],
          workHistory:        profileRow.work_history ?? [],
          education:          profileRow.education ?? [],
          certifications:     profileRow.certifications ?? [],
          preferences:        profileRow.preferences ?? {},
          profileCompleted:   profileRow.profile_completed,
          profilePhotoUrl:    profileRow.profile_photo_url,
          linkedinUrl:        profileRow.linkedin_url,
          githubUrl:          profileRow.github_url,
          portfolioUrl:       profileRow.portfolio_url,
          websiteUrl:         profileRow.website_url,
          hasResume:          profileRow.has_resume,
          hasVideo:           profileRow.has_video,
          resumeFileName:     profileRow.resume_file_name,
          videoIntroFileName: profileRow.video_intro_file_name,
          profileUpdatedAt:   profileRow.profile_updated_at,
          isVetted:           profileRow.is_vetted ?? false,
          vettedAt:           profileRow.vetted_at ?? null,
          vettedByMechanism:  profileRow.vetted_by_mechanism ?? null,
        },
        applications,
        vettingHistory,
      });
    } catch (err: any) {
      console.error("GET /api/admin/talent/:id error:", err);
      res.status(500).json({ error: "Failed to fetch talent detail" });
    }
  });

  // GET /api/admin/talent/:id/resume — stream talent resume (talent_acquisition sub-role required)
  // Note: :id is users.id — lookup changed from candidates.id to candidates.user_id
  // to match what AdminTalentDetail sends.
  app.get("/api/admin/talent/:id/resume", authenticateJWT, requireAdmin, requireAdminSubRole(["talent_acquisition"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const row = await query(
        `SELECT resume_url AS "resumeUrl", resume_file_name AS "resumeFileName" FROM candidates WHERE user_id = $1 LIMIT 1`,
        [id]
      );
      if (!row.rows.length) return res.status(404).json({ error: "Candidate not found" });
      const { resumeUrl, resumeFileName } = row.rows[0];
      if (!resumeUrl) return res.status(404).json({ error: "No resume on this profile" });
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(resumeUrl);
      const disposition = req.query.download === "1" ? "attachment" : "inline";
      const fileName = (resumeFileName || "resume").replace(/"/g, "");
      res.setHeader("Content-Disposition", `${disposition}; filename="${fileName}"`);
      await objectStorageService.downloadObject(objectFile, res, 0);
    } catch (err: any) {
      console.error("GET /api/admin/talent/:id/resume error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to serve resume" });
    }
  });

  // GET /api/admin/talent/:id/video — stream talent video intro (talent_acquisition sub-role required)
  // Note: :id is users.id — lookup changed from candidates.id to candidates.user_id.
  app.get("/api/admin/talent/:id/video", authenticateJWT, requireAdmin, requireAdminSubRole(["talent_acquisition"]), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const candRow = await query(
        `SELECT video_intro_url AS "videoIntroUrl", video_intro_file_name AS "videoIntroFileName" FROM candidates WHERE user_id = $1 LIMIT 1`,
        [id]
      );
      if (!candRow.rows.length) return res.status(404).json({ error: "Candidate not found" });
      const { videoIntroUrl, videoIntroFileName } = candRow.rows[0];
      if (!videoIntroUrl) return res.status(404).json({ error: "No video on this profile" });

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(videoIntroUrl);
      const [metadata] = await objectFile.getMetadata();
      const contentType = (metadata.contentType as string) || "video/mp4";
      const fileSize = Number(metadata.size) || 0;
      const fileName = (videoIntroFileName || "video-intro").replace(/"/g, "");

      const rangeHeader = req.headers.range;
      if (rangeHeader && fileSize > 0) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        const start = match?.[1] ? parseInt(match[1], 10) : 0;
        const end   = match?.[2] ? parseInt(match[2], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        res.status(206);
        res.set({
          "Content-Range":  `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges":  "bytes",
          "Content-Length": chunkSize,
          "Content-Type":   contentType,
          "Content-Disposition": `inline; filename="${fileName}"`,
        });
        objectFile.createReadStream({ start, end }).pipe(res);
      } else {
        res.set({
          "Content-Type":        contentType,
          "Accept-Ranges":       "bytes",
          "Content-Length":      fileSize || undefined,
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control":       "no-store",
        });
        objectFile.createReadStream().pipe(res);
      }
    } catch (err: any) {
      console.error("GET /api/admin/talent/:id/video error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to serve video" });
    }
  });

  // ── GET /api/admin/talent/:id/vetted-eligibility ─────────────────────────────
  // Returns current vetting status and completed-hire count so AdminTalentDetail
  // can display eligibility context alongside the grant/revoke action.
  // The auto-threshold (platform_settings.vetted_auto_hire_threshold) is returned
  // as null when not yet configured — auto-promotion stays dormant.
  app.get("/api/admin/talent/:id/vetted-eligibility", authenticateJWT, requireAdmin, requireAdminSubRole(["talent_acquisition"]), async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;

      // Fetch vetting status + candidate id
      const candidateResult = await query(
        `SELECT c.id AS candidate_id, c.is_vetted, c.vetted_at, c.vetted_by_mechanism
         FROM users u
         LEFT JOIN candidates c ON c.user_id = u.id
         WHERE u.id = $1 AND u.role = 'talent'`,
        [userId]
      );
      if (candidateResult.rows.length === 0) {
        return res.status(404).json({ error: "Talent not found" });
      }
      const row = candidateResult.rows[0];

      // Count completed hires: contracts that OnSpot has countersigned
      const hireCountResult = await query(
        `SELECT COUNT(*)::int AS completed_hire_count
         FROM hiring_contracts hc
         JOIN job_submissions js ON js.id = hc.submission_id
         WHERE js.talent_id = $1
           AND hc.onspot_signed_at IS NOT NULL`,
        [userId]
      );
      const completedHireCount: number = hireCountResult.rows[0]?.completed_hire_count ?? 0;

      // Auto-threshold from platform_settings (NULL = dormant; never auto-promotes)
      const thresholdResult = await query(
        `SELECT value FROM platform_settings WHERE key = 'vetted_auto_hire_threshold'`
      );
      const autoThreshold: number | null = thresholdResult.rows.length > 0
        ? parseInt(thresholdResult.rows[0].value, 10) || null
        : null;

      const meetsAutoThreshold = autoThreshold !== null && completedHireCount >= autoThreshold;

      res.json({
        isVetted:          row.is_vetted ?? false,
        vettedAt:          row.vetted_at ?? null,
        vettedByMechanism: row.vetted_by_mechanism ?? null,
        completedHireCount,
        autoThreshold,
        meetsAutoThreshold,
      });
    } catch (err: any) {
      console.error("GET /api/admin/talent/:id/vetted-eligibility error:", err);
      res.status(500).json({ error: "Failed to fetch vetting eligibility" });
    }
  });

  // ── PATCH /api/admin/talent/:id/vetted ──────────────────────────────────────
  // Grants or revokes the Vetted badge for a contractor.
  // Body: { action: 'grant' | 'revoke', reason: string (required, non-empty) }
  // Audited to admin_role_changes with change_type = 'vetting_status'.
  app.patch("/api/admin/talent/:id/vetted", authenticateJWT, requireAdmin, requireAdminSubRole(["talent_acquisition"]), async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const userId = req.params.id;
      const { action, reason } = req.body;

      if (action !== 'grant' && action !== 'revoke') {
        return res.status(400).json({ error: "action must be 'grant' or 'revoke'" });
      }
      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        return res.status(400).json({ error: "A non-empty reason is required" });
      }

      const changedBy = (req as any).user?.email ?? (req as any).user?.userId ?? 'admin';

      await client.query("BEGIN");

      // Fetch current candidate row
      const candidateResult = await client.query(
        `SELECT c.id AS candidate_id, c.is_vetted, c.is_verified, u.email
         FROM users u
         LEFT JOIN candidates c ON c.user_id = u.id
         WHERE u.id = $1 AND u.role = 'talent'`,
        [userId]
      );
      if (candidateResult.rows.length === 0) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(404).json({ error: "Talent not found" });
      }
      const { candidate_id: candidateId, is_vetted: currentlyVetted, is_verified: currentlyVerified, email } = candidateResult.rows[0];

      if (!candidateId) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(400).json({ error: "This talent has no candidate profile yet" });
      }

      // Prerequisite enforcement: Vetted requires Verified first.
      // This check applies to NEW grants only — existing Vetted contractors are
      // grandfathered with is_verified=true via the startup migration.
      if (action === 'grant' && !currentlyVerified) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(422).json({ error: "Contractor must be Verified before Vetted status can be granted." });
      }

      const newIsVetted = action === 'grant';

      // Update candidate
      await client.query(
        `UPDATE candidates
         SET is_vetted = $1,
             vetted_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
             vetted_by_mechanism = CASE WHEN $1 THEN 'manual_admin' ELSE NULL END,
             updated_at = NOW()
         WHERE id = $2`,
        [newIsVetted, candidateId]
      );

      // Audit to admin_role_changes with change_type = 'vetting_status'
      await client.query(
        `INSERT INTO admin_role_changes
           (user_id, email, previous_role, new_role, mechanism, changed_by, notes, change_type)
         VALUES ($1, $2, $3, $4, 'admin_ui_vetted_status', $5, $6, 'vetting_status')`,
        [
          userId,
          email,
          currentlyVetted ? 'vetted' : 'unvetted',
          newIsVetted ? 'vetted' : 'unvetted',
          changedBy,
          reason.trim(),
        ]
      );

      await client.query("COMMIT");
      client.release();

      console.log(`✅ PATCH /api/admin/talent/${userId}/vetted: ${email} → ${newIsVetted ? 'vetted' : 'unvetted'} (by ${changedBy})`);
      res.json({ success: true, isVetted: newIsVetted });
    } catch (err: any) {
      try { await client.query("ROLLBACK"); } catch {}
      client.release();
      console.error("PATCH /api/admin/talent/:id/vetted error:", err);
      res.status(500).json({ error: "Failed to update vetting status" });
    }
  });

  // ── Verification tier endpoints ──────────────────────────────────────────────
  // Three-tier model: No Classification → Verified → Vetted.
  // Verified = admin has confirmed identity doc + certifications.
  // Raw documents are deleted from storage immediately after any decision (confirm/reject).
  // Access: contractor endpoints use authenticateJWT; admin endpoints require Super Admin
  //         (requireSuperAdmin), never Talent Acquisition.
  // Every raw-document view is written to admin_file_access_log, no exceptions.

  // Helper: extract candidate ID from talent JWT (type:'candidate') or regular talent JWT.
  async function extractCandidateId(req: any): Promise<string | null> {
    const user = req.user;
    if (user?.type === 'candidate' && user?.candidateId) return user.candidateId as string;
    if (user?.role === 'talent' || user?.userRole === 'talent') {
      const uid = user.id ?? user.userId;
      const r = await query(`SELECT id FROM candidates WHERE user_id = $1`, [uid]);
      return r.rows[0]?.id ?? null;
    }
    return null;
  }

  // GET /api/talent/verification/status — contractor checks their own verification state
  app.get("/api/talent/verification/status", authenticateJWT, async (req: any, res: Response) => {
    try {
      const candidateId = await extractCandidateId(req);
      if (!candidateId) return res.status(401).json({ error: 'Only Contractors can access this endpoint' });
      const result = await query(
        `SELECT is_verified, verified_at, verified_by_mechanism,
                verification_status, verification_doc_name, verification_rejection_reason
         FROM candidates WHERE id = $1`,
        [candidateId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Candidate not found' });
      const row = result.rows[0];
      res.json({
        isVerified:       row.is_verified,
        verifiedAt:       row.verified_at,
        mechanism:        row.verified_by_mechanism ?? null,
        status:           row.verification_status   ?? null,
        docName:          row.verification_doc_name ?? null,
        rejectionReason:  row.verification_rejection_reason ?? null,
      });
    } catch (err: any) {
      console.error('GET /api/talent/verification/status error:', err);
      res.status(500).json({ error: 'Failed to fetch verification status' });
    }
  });

  // POST /api/talent/verification/submit — contractor uploads government-issued ID doc
  app.post("/api/talent/verification/submit", authenticateJWT, upload.single('idDocument'), async (req: any, res: Response) => {
    try {
      const candidateId = await extractCandidateId(req);
      if (!candidateId) return res.status(401).json({ error: 'Only Contractors can submit verification documents' });

      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No document uploaded (field: idDocument)' });

      const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!ALLOWED_MIME.includes(file.mimetype)) {
        return res.status(400).json({ error: 'Document must be a JPEG, PNG, or PDF' });
      }
      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ error: 'Document must be under 10 MB' });
      }

      const current = await query(
        `SELECT is_verified, verification_status, verification_doc_url FROM candidates WHERE id = $1`,
        [candidateId]
      );
      if (!current.rows.length) return res.status(404).json({ error: 'Candidate not found' });
      const { is_verified, verification_doc_url: oldDocUrl } = current.rows[0];
      if (is_verified) return res.status(409).json({ error: 'This contractor is already Verified' });

      // Delete any existing pending doc before replacing
      if (oldDocUrl) {
        try {
          const svc = new ObjectStorageService();
          const f = await svc.getObjectEntityFile(oldDocUrl);
          await f.delete({ ignoreNotFound: true });
        } catch {}
      }

      // Save new document to private storage
      const svc = new ObjectStorageService();
      const objectId = randomUUID();
      const privateDir = svc.getPrivateObjectDir();
      const fullPath = `${privateDir}/candidate-verification-docs/${objectId}`;
      const parts = fullPath.split('/').filter((p: string) => p);
      const bucketName = parts[0];
      const objectName = parts.slice(1).join('/');
      const bucket = objectStorageClient.bucket(bucketName);
      const objectFile = bucket.file(objectName);
      await objectFile.save(file.buffer, {
        metadata: { contentType: file.mimetype, metadata: { originalName: file.originalname } },
      });
      await setObjectAclPolicy(objectFile, { visibility: 'private' });
      const docUrl = `/objects/candidate-verification-docs/${objectId}`;

      await query(
        `UPDATE candidates SET
           verification_status = 'pending',
           verification_doc_url = $1,
           verification_doc_name = $2,
           verification_rejection_reason = NULL,
           updated_at = NOW()
         WHERE id = $3`,
        [docUrl, file.originalname, candidateId]
      );
      console.log(`✅ POST /api/talent/verification/submit: candidate ${candidateId} submitted ID doc`);
      res.json({ success: true, status: 'pending', docName: file.originalname });
    } catch (err: any) {
      console.error('POST /api/talent/verification/submit error:', err);
      res.status(500).json({ error: 'Failed to submit verification document' });
    }
  });

  // DELETE /api/talent/verification/submission — contractor cancels their pending submission
  app.delete("/api/talent/verification/submission", authenticateJWT, async (req: any, res: Response) => {
    try {
      const candidateId = await extractCandidateId(req);
      if (!candidateId) return res.status(401).json({ error: 'Only Contractors can cancel a verification submission' });
      const current = await query(
        `SELECT verification_status, verification_doc_url FROM candidates WHERE id = $1`,
        [candidateId]
      );
      if (!current.rows.length) return res.status(404).json({ error: 'Candidate not found' });
      const { verification_status, verification_doc_url } = current.rows[0];
      if (verification_status !== 'pending') {
        return res.status(409).json({ error: 'No pending submission to cancel' });
      }
      if (verification_doc_url) {
        try {
          const svc = new ObjectStorageService();
          const f = await svc.getObjectEntityFile(verification_doc_url);
          await f.delete({ ignoreNotFound: true });
        } catch {}
      }
      await query(
        `UPDATE candidates SET
           verification_status = NULL,
           verification_doc_url = NULL,
           verification_doc_name = NULL,
           updated_at = NOW()
         WHERE id = $1`,
        [candidateId]
      );
      res.json({ success: true });
    } catch (err: any) {
      console.error('DELETE /api/talent/verification/submission error:', err);
      res.status(500).json({ error: 'Failed to cancel submission' });
    }
  });

  // GET /api/admin/verification/queue — Super Admin: list pending verifications
  app.get("/api/admin/verification/queue", authenticateAdminFlexible, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const result = await query(`
        SELECT c.id AS candidate_id, u.id AS user_id, u.email,
               u.first_name, u.last_name, c.display_name, c.target_position, c.category,
               c.profile_photo_url, c.verification_doc_name, c.updated_at AS submitted_at
        FROM candidates c
        JOIN users u ON u.id = c.user_id
        WHERE c.verification_status = 'pending'
        ORDER BY c.updated_at ASC
      `);
      res.json({ queue: result.rows });
    } catch (err: any) {
      console.error('GET /api/admin/verification/queue error:', err);
      res.status(500).json({ error: 'Failed to fetch verification queue' });
    }
  });

  // GET /api/admin/talent/:id/verification-status — Super Admin: get a contractor's verification state
  app.get("/api/admin/talent/:id/verification-status", authenticateAdminFlexible, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const result = await query(
        `SELECT c.is_verified, c.verified_at, c.verified_by, c.verified_by_mechanism,
                c.verification_notes, c.verification_status, c.verification_doc_name,
                c.verification_rejection_reason
         FROM candidates c
         JOIN users u ON u.id = c.user_id
         WHERE u.id = $1 AND u.role = 'talent'`,
        [userId]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Talent not found' });
      const row = result.rows[0];
      res.json({
        isVerified:          row.is_verified,
        verifiedAt:          row.verified_at,
        verifiedBy:          row.verified_by,
        verifiedByMechanism: row.verified_by_mechanism,
        verificationNotes:   row.verification_notes,
        status:              row.verification_status    ?? null,
        docName:             row.verification_doc_name  ?? null,
        rejectionReason:     row.verification_rejection_reason ?? null,
      });
    } catch (err: any) {
      console.error('GET /api/admin/talent/:id/verification-status error:', err);
      res.status(500).json({ error: 'Failed to fetch verification status' });
    }
  });

  // GET /api/admin/talent/:id/verification-document — Super Admin: stream raw ID doc
  // MANDATORY audit log entry before every stream — no exceptions.
  app.get("/api/admin/talent/:id/verification-document", authenticateAdminFlexible, requireSuperAdmin, async (req: any, res: Response) => {
    try {
      const userId = req.params.id;
      const adminUserId = req.user?.id ?? req.user?.userId;
      const docResult = await query(
        `SELECT c.verification_doc_url, c.verification_doc_name
         FROM candidates c
         JOIN users u ON u.id = c.user_id
         WHERE u.id = $1 AND u.role = 'talent'`,
        [userId]
      );
      if (!docResult.rows.length || !docResult.rows[0].verification_doc_url) {
        return res.status(404).json({ error: 'No verification document on file' });
      }
      const { verification_doc_url, verification_doc_name } = docResult.rows[0];
      // Mandatory audit log — must succeed before streaming
      await query(
        `INSERT INTO admin_file_access_log (object_path, accessed_by, context_note)
         VALUES ($1, $2, $3)`,
        [verification_doc_url, adminUserId, `verification-doc-review:talent:${userId}`]
      );
      const svc = new ObjectStorageService();
      const objectFile = await svc.getObjectEntityFile(verification_doc_url);
      const [metadata] = await objectFile.getMetadata();
      const contentType = (metadata as any)?.contentType || 'application/octet-stream';
      const safeName = (verification_doc_name || 'id-document').replace(/[^a-zA-Z0-9._\- ]/g, '_');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
      objectFile.createReadStream().pipe(res);
    } catch (err: any) {
      console.error('GET /api/admin/talent/:id/verification-document error:', err);
      res.status(500).json({ error: 'Failed to stream verification document' });
    }
  });

  // GET /api/admin/talent/:id/verification-history — Super Admin: audit history
  app.get("/api/admin/talent/:id/verification-history", authenticateAdminFlexible, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const result = await query(
        `SELECT id, new_role AS action, notes AS reason, changed_by, changed_at
         FROM admin_role_changes
         WHERE user_id = $1 AND change_type = 'verification_status'
         ORDER BY changed_at DESC`,
        [userId]
      );
      res.json({
        history: result.rows.map((row: any) => ({
          id:        row.id,
          action:    row.action === 'verified' ? 'confirmed' : 'rejected_or_grandfathered',
          reason:    row.reason,
          changedBy: row.changed_by,
          changedAt: row.changed_at,
        })),
      });
    } catch (err: any) {
      console.error('GET /api/admin/talent/:id/verification-history error:', err);
      res.status(500).json({ error: 'Failed to fetch verification history' });
    }
  });

  // POST /api/admin/talent/:id/verification/confirm — Super Admin: confirm verification
  // Writes is_verified=true, clears doc fields, deletes raw doc from storage.
  app.post("/api/admin/talent/:id/verification/confirm", authenticateAdminFlexible, requireSuperAdmin, async (req: any, res: Response) => {
    const client = await pool.connect();
    try {
      const userId = req.params.id;
      const { notes } = req.body;
      const adminUserId = req.user?.id ?? req.user?.userId;
      const changedBy = req.user?.email ?? adminUserId ?? 'admin';

      await client.query("BEGIN");
      const candidateResult = await client.query(
        `SELECT c.id AS candidate_id, c.verification_status, c.verification_doc_url, u.email
         FROM users u
         LEFT JOIN candidates c ON c.user_id = u.id
         WHERE u.id = $1 AND u.role = 'talent'`,
        [userId]
      );
      if (!candidateResult.rows.length) {
        await client.query("ROLLBACK"); client.release();
        return res.status(404).json({ error: 'Talent not found' });
      }
      const { candidate_id: candidateId, verification_status, verification_doc_url, email } = candidateResult.rows[0];
      if (!candidateId) {
        await client.query("ROLLBACK"); client.release();
        return res.status(400).json({ error: 'No candidate profile found' });
      }
      if (verification_status !== 'pending') {
        await client.query("ROLLBACK"); client.release();
        return res.status(409).json({ error: 'No pending verification to confirm' });
      }

      await client.query(
        `UPDATE candidates SET
           is_verified = true,
           verified_at = NOW(),
           verified_by = $1,
           verified_by_mechanism = 'manual_admin',
           verification_notes = $2,
           verification_status = NULL,
           verification_doc_url = NULL,
           verification_doc_name = NULL,
           verification_rejection_reason = NULL,
           updated_at = NOW()
         WHERE id = $3`,
        [adminUserId, notes?.trim() || null, candidateId]
      );
      await client.query(
        `INSERT INTO admin_role_changes
           (user_id, email, previous_role, new_role, mechanism, changed_by, notes, change_type)
         VALUES ($1, $2, 'unverified', 'verified', 'admin_ui_verification', $3, $4, 'verification_status')`,
        [userId, email, changedBy, notes?.trim() || null]
      );
      await client.query("COMMIT");
      client.release();

      // Delete raw document AFTER commit — non-fatal if storage delete fails
      if (verification_doc_url) {
        try {
          const svc = new ObjectStorageService();
          const f = await svc.getObjectEntityFile(verification_doc_url);
          await f.delete({ ignoreNotFound: true });
        } catch (delErr) {
          console.warn('⚠️  verify-confirm: storage delete failed (non-fatal):', delErr);
        }
      }
      console.log(`✅ POST /api/admin/talent/${userId}/verification/confirm: ${email} → verified (by ${changedBy})`);
      res.json({ success: true });
    } catch (err: any) {
      try { await client.query("ROLLBACK"); } catch {}
      client.release();
      console.error('POST /api/admin/talent/:id/verification/confirm error:', err);
      res.status(500).json({ error: 'Failed to confirm verification' });
    }
  });

  // POST /api/admin/talent/:id/verification/reject — Super Admin: reject verification
  // Reason is mandatory. Raw doc deleted from storage.
  app.post("/api/admin/talent/:id/verification/reject", authenticateAdminFlexible, requireSuperAdmin, async (req: any, res: Response) => {
    const client = await pool.connect();
    try {
      const userId = req.params.id;
      const { reason } = req.body;
      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return res.status(400).json({ error: 'A reason is required when rejecting a verification' });
      }
      const adminUserId = req.user?.id ?? req.user?.userId;
      const changedBy = req.user?.email ?? adminUserId ?? 'admin';

      await client.query("BEGIN");
      const candidateResult = await client.query(
        `SELECT c.id AS candidate_id, c.verification_status, c.verification_doc_url, u.email
         FROM users u
         LEFT JOIN candidates c ON c.user_id = u.id
         WHERE u.id = $1 AND u.role = 'talent'`,
        [userId]
      );
      if (!candidateResult.rows.length) {
        await client.query("ROLLBACK"); client.release();
        return res.status(404).json({ error: 'Talent not found' });
      }
      const { candidate_id: candidateId, verification_status, verification_doc_url, email } = candidateResult.rows[0];
      if (!candidateId) {
        await client.query("ROLLBACK"); client.release();
        return res.status(400).json({ error: 'No candidate profile found' });
      }
      if (verification_status !== 'pending') {
        await client.query("ROLLBACK"); client.release();
        return res.status(409).json({ error: 'No pending verification to reject' });
      }

      await client.query(
        `UPDATE candidates SET
           verification_status = 'rejected',
           verification_rejection_reason = $1,
           verification_doc_url = NULL,
           verification_doc_name = NULL,
           updated_at = NOW()
         WHERE id = $2`,
        [reason.trim(), candidateId]
      );
      await client.query(
        `INSERT INTO admin_role_changes
           (user_id, email, previous_role, new_role, mechanism, changed_by, notes, change_type)
         VALUES ($1, $2, 'unverified', 'unverified', 'admin_ui_verification', $3, $4, 'verification_status')`,
        [userId, email, changedBy, `REJECTED: ${reason.trim()}`]
      );
      await client.query("COMMIT");
      client.release();

      // Delete raw document AFTER commit — non-fatal if storage delete fails
      if (verification_doc_url) {
        try {
          const svc = new ObjectStorageService();
          const f = await svc.getObjectEntityFile(verification_doc_url);
          await f.delete({ ignoreNotFound: true });
        } catch (delErr) {
          console.warn('⚠️  verify-reject: storage delete failed (non-fatal):', delErr);
        }
      }
      console.log(`✅ POST /api/admin/talent/${userId}/verification/reject: ${email} rejected (by ${changedBy})`);
      res.json({ success: true });
    } catch (err: any) {
      try { await client.query("ROLLBACK"); } catch {}
      client.release();
      console.error('POST /api/admin/talent/:id/verification/reject error:', err);
      res.status(500).json({ error: 'Failed to reject verification' });
    }
  });

  app.post("/api/admin/jobs", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { clientId: rawClientId } = req.body;

      if (!rawClientId || rawClientId === "admin-system") {
        return res.status(400).json({
          error: "Client required",
          message: "A client must be selected when creating a job as admin.",
        });
      }

      // Validate the selected owner is an actual client account. The admin UI
      // only lists clients, but this server check also protects direct requests.
      const clientUser = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.id, rawClientId), eq(usersTable.role, "client")))
        .limit(1);

      if (clientUser.length === 0) {
        return res.status(400).json({
          error: "Invalid client",
          message: "The selected account is not an active client.",
        });
      }

      // Admin-created jobs: isClientSubmitted stays false (distinguishes from self-serve)
      const body = { ...req.body, clientId: rawClientId, approvalStatus: "pending" };
      console.log("Admin job create - request body:", JSON.stringify(body));

      // Guard 1: reject any non-canonical engagement type value before the DB sees it.
      const adminCreateEtErr = validateEngagementType(body.engagementType);
      if (adminCreateEtErr) return res.status(400).json(adminCreateEtErr);
      const adminCreateMetadataErr = validateJobFormMetadata(body);
      if (adminCreateMetadataErr) return res.status(400).json(adminCreateMetadataErr);

      // Guard 2: published jobs must have an engagement type set.
      const effectiveStatus = body.status ?? "open";
      if (["open", "published"].includes(effectiveStatus) && !body.engagementType) {
        return res.status(400).json({
          error: "Engagement Type required",
          message: "An Engagement Type (Lite or Standard) must be set before publishing a job.",
        });
      }

      const validated = insertJobSchema.parse(body);
      const job = await storage.createJob(validated);
      res.status(201).json(job);
      // Option C trigger B: fan-out match recompute when a new job is published.
      if (job.id && ["open", "published"].includes(job.status ?? "")) {
        setImmediate(() => {
          (storage as any).recomputeMatchesForJob(job.id)
            .catch((err: any) => console.error("❌ Background match fan-out (job create):", err));
        });
      }
      // Keep Vanessa's job knowledge current after every change
      import("./services/ragService")
        .then(({ indexJobListings }) => indexJobListings())
        .catch((err: any) => console.error("❌ Background job reindex failed:", err.message));
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.error("Admin job create - validation error:", error.errors);
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Admin job create error:", error);
      res.status(500).json({
        error: "Job creation failed",
        message: error.message,
      });
    }
  });

  app.patch("/api/admin/jobs/:id", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { clientId, ...rest } = req.body;
      const updates = insertJobSchema.partial().parse(rest);

      // Guard 1: reject any non-canonical engagement type value before the DB sees it.
      const adminPatchEtErr = validateEngagementType(updates.engagementType);
      if (adminPatchEtErr) return res.status(400).json(adminPatchEtErr);
      const adminPatchMetadataErr = validateJobFormMetadata(updates);
      if (adminPatchMetadataErr) return res.status(400).json(adminPatchMetadataErr);

      // Guard 2: published jobs must have an engagement type set.
      const existingJob = await storage.getJob(req.params.id);
      const effectiveStatus = updates.status ?? existingJob?.status;
      const effectiveEngagementType =
        "engagementType" in updates ? updates.engagementType : existingJob?.engagementType;
      if (
        ["open", "published"].includes(effectiveStatus as string) &&
        !["Lite", "Standard"].includes(effectiveEngagementType as string)
      ) {
        return res.status(400).json({
          error: "Engagement Type required",
          message: "An Engagement Type (Lite or Standard) must be set before publishing a job.",
        });
      }

      const job = await storage.updateJob(req.params.id, updates);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
      import("./services/ragService")
        .then(({ indexJobListings }) => indexJobListings())
        .catch((err: any) => console.error("❌ Background job reindex failed:", err.message));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Admin job update error:", msg);
      res.status(500).json({ error: "Failed to update job", message: msg });
    }
  });

  app.patch("/api/admin/jobs/:id/status", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!status || !["open", "closed", "cancelled"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be 'open', 'closed', or 'cancelled'" });
      }
      // Guard: published jobs must have a valid engagement type
      if (["open", "published"].includes(status)) {
        const existingJob = await storage.getJob(req.params.id);
        if (!existingJob || !["Lite", "Standard"].includes(existingJob.engagementType as string)) {
          return res.status(400).json({
            error: "Engagement Type required",
            message: "An Engagement Type (Lite or Standard) must be set before publishing a job.",
          });
        }
      }
      const job = await storage.updateJob(req.params.id, { status });
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
      import("./services/ragService")
        .then(({ indexJobListings }) => indexJobListings())
        .catch((err: any) => console.error("❌ Background job reindex failed:", err.message));
    } catch (error) {
      console.error("Admin job status update error:", error);
      res.status(500).json({ error: "Failed to update job status" });
    }
  });

  app.post("/api/admin/jobs/:id/refresh", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const existing = await storage.getJob(req.params.id);
      if (!existing) return res.status(404).json({ error: "Job not found" });
      const job = await storage.updateJob(req.params.id, {
        postedAt: now,
        lastRefreshedAt: now,
        originalPostedAt: (existing as any).originalPostedAt ?? (existing as any).postedAt ?? existing.createdAt ?? now,
      } as any);
      res.json(job);
      import("./services/ragService")
        .then(({ indexJobListings }) => indexJobListings())
        .catch((err: any) => console.error("❌ Background job reindex failed:", err.message));
    } catch (error) {
      console.error("Admin job refresh error:", error);
      res.status(500).json({ error: "Failed to refresh job posting" });
    }
  });

  app.delete("/api/admin/jobs/:id", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const job = await storage.updateJob(req.params.id, { status: "cancelled" });
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json({ success: true });
      import("./services/ragService")
        .then(({ indexJobListings }) => indexJobListings())
        .catch((err: any) => console.error("❌ Background job reindex failed:", err.message));
    } catch (error) {
      console.error("Admin job delete error:", error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // ─── Admin: Approve a job posting ─────────────────────────────────────────
  app.post("/api/admin/jobs/:id/approve", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.id;
      // Guard: published jobs must have a valid engagement type
      const jobToApprove = await storage.getJob(req.params.id);
      if (!jobToApprove) return res.status(404).json({ error: "Job not found" });
      if (!["Lite", "Standard"].includes(jobToApprove.engagementType as string)) {
        return res.status(400).json({
          error: "Engagement Type required",
          message: "An Engagement Type (Lite or Standard) must be set before approving a job.",
        });
      }
      const transition = await transitionJobApprovalStatus({
        jobId: req.params.id,
        newStatus: "approved",
        adminId,
      });
      if (!transition) return res.status(404).json({ error: "Job not found" });
      res.json(transition.job);
      if (transition.transitioned) {
        import("./services/ragService")
          .then(({ indexJobListings }) => indexJobListings())
          .catch((err: any) => console.error("❌ Background job reindex failed:", err.message));
      }
    } catch (error) {
      console.error("Admin job approve error:", error);
      res.status(500).json({ error: "Failed to approve job" });
    }
  });

  // ─── Admin: Reject a job posting ──────────────────────────────────────────
  app.post("/api/admin/jobs/:id/reject", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.id;
      const { rejectionReason } = req.body;
      const transition = await transitionJobApprovalStatus({
        jobId: req.params.id,
        newStatus: "rejected",
        adminId,
        rejectionReason,
      });
      if (!transition) return res.status(404).json({ error: "Job not found" });
      res.json(transition.job);
      if (transition.transitioned) {
        import("./services/ragService")
          .then(({ indexJobListings }) => indexJobListings())
          .catch((err: any) => console.error("❌ Background job reindex failed:", err.message));
      }
    } catch (error) {
      console.error("Admin job reject error:", error);
      res.status(500).json({ error: "Failed to reject job" });
    }
  });

  // ─── Admin: Link a client job to an existing approved job ────────────────
  app.post("/api/admin/jobs/:id/link", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { existingJobId } = req.body;
      if (!existingJobId) return res.status(400).json({ error: "existingJobId is required" });
      const result = await query(
        `UPDATE jobs SET
          approval_status = 'linked_to_existing',
          existing_job_id = $1,
          approved_by = NULL,
          approved_at = NULL,
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [existingJobId, req.params.id],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Job not found" });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Admin job link error:", error);
      res.status(500).json({ error: "Failed to link job" });
    }
  });

  // ─── Admin: Scaffold-job management ──────────────────────────────────────

  // GET /api/admin/scaffold-jobs — list all search_scaffold rows with metadata
  app.get("/api/admin/scaffold-jobs", authenticateAdminFlexible, async (req: Request, res: Response) => {
    try {
      const rows = await storage.listScaffoldJobs();
      res.json(rows);
    } catch (err: any) {
      console.error("GET /api/admin/scaffold-jobs error:", err);
      res.status(500).json({ error: "Failed to fetch scaffold jobs" });
    }
  });

  // DELETE /api/admin/scaffold-jobs — bulk delete by IDs
  // Body: { ids: string[] }
  app.delete("/api/admin/scaffold-jobs", authenticateAdminFlexible, async (req: Request, res: Response) => {
    try {
      const { ids } = req.body as { ids?: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids must be a non-empty array" });
      }
      const deleted = await storage.deleteScaffoldJobsByIds(ids);
      res.json({ deleted });
    } catch (err: any) {
      console.error("DELETE /api/admin/scaffold-jobs error:", err);
      res.status(500).json({ error: "Failed to delete scaffold jobs" });
    }
  });

  // POST /api/admin/scaffold-jobs/cleanup — run the 7-day TTL cleanup immediately
  app.post("/api/admin/scaffold-jobs/cleanup", authenticateAdminFlexible, async (req: Request, res: Response) => {
    try {
      const deleted = await storage.cleanupOrphanedScaffoldJobs();
      res.json({ deleted });
    } catch (err: any) {
      console.error("POST /api/admin/scaffold-jobs/cleanup error:", err);
      res.status(500).json({ error: "Failed to run cleanup" });
    }
  });

  // ─── Admin: Move approved/rejected job back to pending ────────────────────
  app.post("/api/admin/jobs/:id/pending", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const transition = await transitionJobApprovalStatus({
        jobId: req.params.id,
        newStatus: "pending",
        adminId: (req as any).user?.id,
      });
      if (!transition) return res.status(404).json({ error: "Job not found" });
      res.json(transition.job);
      if (transition.transitioned) {
        import("./services/ragService")
          .then(({ indexJobListings }) => indexJobListings())
          .catch((err: any) => console.error("❌ Background job reindex failed:", err.message));
      }
    } catch (error) {
      console.error("Admin job pending error:", error);
      res.status(500).json({ error: "Failed to reset job approval" });
    }
  });

  // ====== JOB SKILLS ======
  app.get("/api/jobs/:jobId/skills", async (req, res) => {
    try {
      const jobSkills = await storage.getJobSkills(req.params.jobId);
      res.json(jobSkills);
    } catch (error) {
      res.status(500).json({ error: "Failed to get job skills" });
    }
  });

  app.post("/api/jobs/:jobId/skills", async (req, res) => {
    try {
      const validated = insertJobSkillSchema.parse({
        ...req.body,
        jobId: req.params.jobId,
      });
      const jobSkill = await storage.createJobSkill(validated);
      res.status(201).json(jobSkill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create job skill" });
    }
  });

  app.delete("/api/job-skills/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteJobSkill(Number(req.params.id));
      if (!deleted) {
        return res.status(404).json({ error: "Job skill not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete job skill" });
    }
  });

  // ====== JOB MATCHING ======
  // Job matching algorithm endpoint - personalized job recommendations
  app.get("/api/matches", isAuthenticated, async (req: any, res) => {
    try {
      // Get talent ID from authenticated user
      let userId: string;
      if (req.user.user) {
        userId = req.user.user.id; // OAuth users
      } else if (req.user.claims) {
        userId = req.user.claims.sub; // Replit Auth users
      } else {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Parse optional filters from query parameters
      const filters = {
        skills: req.query.skills
          ? (req.query.skills as string).split(",")
          : undefined,
        minRate: req.query.minRate ? Number(req.query.minRate) : undefined,
        maxRate: req.query.maxRate ? Number(req.query.maxRate) : undefined,
        timezone: req.query.timezone as string,
        engagementType: req.query.engagementType as string,
        category: req.query.category as string,
        experienceLevel: req.query.experienceLevel as string,
      };

      console.log(
        `🎯 Calculating job matches for user ${userId} with filters:`,
        filters,
      );

      // Calculate job matches using the matching algorithm
      const matches = await storage.calculateJobMatches(userId, filters);

      console.log(`✅ Found ${matches.length} job matches for user ${userId}`);
      res.json(matches);
    } catch (error) {
      console.error("Job matching error:", error);
      res.status(500).json({ error: "Failed to calculate job matches" });
    }
  });


  // ====== ADMIN FLAGGED MESSAGES ======

  // GET /api/admin/flagged-messages — list all messages with flaggedForReview = true
  app.get("/api/admin/flagged-messages", authenticateAdminFlexible, async (req, res) => {
    try {
      const flagged = await storage.listFlaggedMessages();
      res.json(flagged);
    } catch (error) {
      console.error("Failed to list flagged messages:", error);
      res.status(500).json({ error: "Failed to list flagged messages" });
    }
  });

  // PATCH /api/admin/messages/:id/clear-flag — mark a flagged message as reviewed (clears flag)
  app.patch("/api/admin/messages/:id/clear-flag", authenticateAdminFlexible, async (req, res) => {
    try {
      const { id } = req.params;
      const msg = await storage.getMessage(id);
      if (!msg) return res.status(404).json({ error: "Message not found" });
      await storage.clearMessageFlag(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to clear message flag:", error);
      res.status(500).json({ error: "Failed to clear message flag" });
    }
  });

  // ====== MESSAGES (Phase 1 Priority) ======
  // All messaging endpoints require authentication; access is limited to thread participants.
  const getAuthedUserId = (req: Request): string | undefined =>
    (req as any).user?.id;

  const resolveSafeMessageSenderName = async (
    senderId: string,
    recipientId: string,
  ): Promise<string> => {
    const result = await query(
      `SELECT
         TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS raw_name,
         (u.role = 'talent' OR EXISTS (
           SELECT 1 FROM candidates c WHERE c.user_id = u.id
         )) AS is_talent,
         ${nameRevealExistsSQL("$2", "u.id")} AS name_revealed
       FROM users u
      WHERE u.id = $1
      LIMIT 1`,
      [senderId, recipientId],
    );
    const row = result.rows[0];
    if (!row) return "A participant";

    const raw = (row.raw_name ?? "").trim();
    if (row.is_talent && !row.name_revealed) {
      const parts = raw.split(/\s+/).filter(Boolean);
      if (!parts.length) return "Talent Profile";
      return parts.length === 1
        ? `${parts[0][0]}${"•".repeat(4)}`
        : `${parts[0]} ${parts[1][0]}.`;
    }
    return raw || "A participant";
  };

  const APPLICATION_CHAT_STARTABLE_STATUSES = new Set([
    "new",
    "submitted",
    "under_review",
    "reviewed",
    "shortlisted",
    "interviewing",
    "offer_extended",
    "offer_accepted",
    "contract_sent",
  ]);

  type ApplicationThreadResult =
    | { threadId: string; isNew: boolean }
    | { error: string; status: 403 | 404 | 409 };

  /**
   * Resolves a single job submission to the canonical client/talent user IDs and
   * opens the one matching conversation. Both application entry points call this
   * helper so a Client and Talent always converge on the same thread.
   */
  const getOrCreateApplicationMessageThread = async ({
    applicationId,
    authenticatedUserId,
    role,
  }: {
    applicationId: string;
    authenticatedUserId: string;
    role: "client" | "talent";
  }): Promise<ApplicationThreadResult> => {
    const application = await query(
      `SELECT
         js.id,
         js.job_id,
         js.client_id,
         js.status,
         js.workflow_type,
         js.talent_id,
         js.email AS applicant_email,
         j.client_id AS job_owner_id,
         j.title AS job_title,
         COALESCE(talent_by_id.id, talent_by_email.id) AS talent_user_id
       FROM job_submissions js
       JOIN jobs j ON j.id = js.job_id
       LEFT JOIN users talent_by_id ON talent_by_id.id = js.talent_id
       LEFT JOIN users talent_by_email ON lower(talent_by_email.email) = lower(js.email)
       WHERE js.id = $1
       LIMIT 1`,
      [applicationId],
    );
    if (!application.rows.length) {
      return { status: 404, error: "Conversation is not available for this application." };
    }

    const submission = application.rows[0];
    const clientId = submission.job_owner_id ?? submission.client_id;
    const talentUserId = submission.talent_user_id as string | null;
    const jobId = submission.job_id as string | null;

    if (!clientId || !talentUserId || !jobId || clientId === talentUserId) {
      return { status: 404, error: "Conversation is not available for this application." };
    }
    if (submission.workflow_type !== "client_invitation") {
      return { status: 403, error: "Conversation is not available for this application." };
    }
    if (role === "client" && clientId !== authenticatedUserId) {
      return { status: 403, error: "Conversation is not available for this application." };
    }
    if (role === "talent" && talentUserId !== authenticatedUserId) {
      return { status: 403, error: "Conversation is not available for this application." };
    }

    const txClient = await pool.connect();
    try {
      await txClient.query("BEGIN");
      await txClient.query(
        `SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':' || $3))`,
        [clientId, talentUserId, jobId],
      );

      // Job-specific application threads take precedence. A pre-existing direct
      // or invitation thread is the established relationship-level channel and
      // is reused next, rather than creating a second conversation for the pair.
      const existingForJob = await txClient.query(
        `SELECT id FROM message_threads
         WHERE participants @> ARRAY[$1, $2]::text[]
           AND participants <@ ARRAY[$1, $2]::text[]
           AND job_id = $3
         LIMIT 1`,
        [clientId, talentUserId, jobId],
      );
      const existingDirect = existingForJob.rows.length
        ? existingForJob
        : await txClient.query(
            `SELECT id FROM message_threads
             WHERE participants @> ARRAY[$1, $2]::text[]
               AND participants <@ ARRAY[$1, $2]::text[]
               AND job_id IS NULL
             LIMIT 1`,
            [clientId, talentUserId],
          );

      if (existingDirect.rows.length) {
        await txClient.query("COMMIT");
        return { threadId: existingDirect.rows[0].id, isNew: false };
      }

      if (!APPLICATION_CHAT_STARTABLE_STATUSES.has(submission.status)) {
        await txClient.query("ROLLBACK");
        return { status: 409, error: "Conversation is not available for this application." };
      }

      const created = await txClient.query(
        `INSERT INTO message_threads (job_id, participants, subject)
         VALUES ($1, ARRAY[$2, $3]::text[], $4)
         RETURNING id`,
        [jobId, clientId, talentUserId, submission.job_title ?? null],
      );
      await txClient.query("COMMIT");
      return { threadId: created.rows[0].id, isNew: true };
    } catch (error) {
      await txClient.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      txClient.release();
    }
  };

  app.get("/api/message-threads/:id", authenticateJWT, async (req, res) => {
    try {
      const userId = getAuthedUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const thread = await storage.getMessageThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      if (!thread.participants.includes(userId)) {
        return res.status(403).json({ error: "Not a participant of this thread" });
      }
      res.json(thread);
    } catch (error) {
      res.status(500).json({ error: "Failed to get message thread" });
    }
  });

  // Thread creation is gated on an existing accepted relationship: a thread may
  // only be opened between a client and a talent who has accepted that client's
  // invitation (job_submissions status beyond 'invited'/'declined'). The jobId
  // and participants are derived server-side from that submission — callers
  // cannot open threads with arbitrary users (protects talent identity pre-accept).
  app.post("/api/message-threads", authenticateJWT, async (req, res) => {
    try {
      const userId = getAuthedUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const validated = insertMessageThreadSchema.parse(req.body);
      const participants = Array.from(new Set(validated.participants));
      if (participants.length !== 2 || !participants.includes(userId)) {
        return res.status(403).json({
          error: "Threads must have exactly two participants, including yourself",
        });
      }
      const otherId = participants.find((p) => p !== userId)!;
      // Verify an accepted client↔talent relationship exists between the pair
      // Only a client-initiated invitation that the talent has accepted counts —
      // ordinary talent applications (initiated_by <> 'client') do not open a
      // messaging channel, and only explicit accepted/downstream statuses qualify.
      const rel = await query(
        `SELECT job_id, client_id, talent_id FROM job_submissions
         WHERE ((client_id = $1 AND talent_id = $2) OR (client_id = $2 AND talent_id = $1))
           AND ${FORMAL_PIPELINE_PREDICATE}
           AND status IN (${FORMAL_PIPELINE_ACTIVE_STATUS_SQL})
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1`,
        [userId, otherId],
      );
      if (!rel.rows.length) {
        return res.status(403).json({
          error: "Messaging requires an accepted invitation between both parties",
        });
      }
      const jobId = rel.rows[0].job_id ?? null;
      const relClientId: string = rel.rows[0].client_id;
      const relTalentId: string = rel.rows[0].talent_id;
      // Race-safe idempotent creation: serialize on the same pair/job advisory
      // lock used by the acceptance flow (client:talent:job ordering), so
      // concurrent explicit creations (or a creation racing an accept) always
      // converge on a single thread.
       const txClient = await pool.connect();
      try {
        await txClient.query("BEGIN");
        await txClient.query(
          `SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':' || COALESCE($3, '')))`,
          [relClientId, relTalentId, jobId ?? null],
        );
        const existing = await txClient.query(
          `SELECT id FROM message_threads
           WHERE participants @> ARRAY[$1, $2]::text[]
             AND participants <@ ARRAY[$1, $2]::text[]
             AND (job_id = $3 OR ($3::text IS NULL AND job_id IS NULL))
           LIMIT 1`,
          [userId, otherId, jobId],
        );
        if (existing.rows.length) {
          await txClient.query("COMMIT");
          const thread = await storage.getMessageThread(existing.rows[0].id);
          return res.status(200).json(thread);
        }
        const created = await txClient.query(
          `INSERT INTO message_threads (job_id, participants, subject)
           VALUES ($1, ARRAY[$2, $3]::text[], $4)
           RETURNING *`,
          [jobId, userId, otherId, validated.subject ?? null],
        );
        await txClient.query("COMMIT");
        return res.status(201).json({
          id: created.rows[0].id,
          jobId: created.rows[0].job_id,
          participants: created.rows[0].participants,
          subject: created.rows[0].subject,
          lastMessageAt: created.rows[0].last_message_at,
          createdAt: created.rows[0].created_at,
        });
      } catch (txErr) {
        await txClient.query("ROLLBACK").catch(() => {});
        throw txErr;
      } finally {
        txClient.release();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create message thread" });
    }
  });

  // Opens the canonical conversation for one application. IDs and participant
  // roles are always derived from the owned submission — the browser submits only
  // the application path parameter.
  app.post("/api/applications/:applicationId/message-thread", authenticateJWT, async (req, res) => {
    try {
      const user = (req as any).user as { id?: string; role?: string } | undefined;
      if (!user?.id) return res.status(401).json({ error: "Unauthorized" });
      if (user.role !== "client" && user.role !== "talent") {
        return res.status(403).json({ error: "Conversation is not available for this application." });
      }

      const result = await getOrCreateApplicationMessageThread({
        applicationId: req.params.applicationId,
        authenticatedUserId: user.id,
        role: user.role,
      });
      if ("error" in result) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(result.isNew ? 201 : 200).json({ threadId: result.threadId });
    } catch (error) {
      console.error("POST /api/applications/:applicationId/message-thread error:", error);
      return res.status(500).json({ error: "Unable to open conversation. Please try again." });
    }
  });

  // Threads for the authenticated user (works for both legacy and talent JWTs,
  // since authenticateJWT normalizes both to a users.id).
  app.get("/api/me/message-threads", authenticateJWT, async (req, res) => {
    try {
      const userId = getAuthedUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const threads = await storage.listMessageThreadsByUserWithUnread(userId);
      // Enrich with participant display names.
      // Talent participants whose identity has NOT yet been revealed (no accepted
      // client-initiated invitation) are masked as "Jane S." — the same format used
      // everywhere else in the search/shortlist UI.  Client names are never masked.
      const otherIds = Array.from(
        new Set(threads.flatMap((t) => t.participants).filter((p) => p !== userId)),
      );
      const names: Record<string, string> = {};
      if (otherIds.length) {
        const result = await query(
          `SELECT
             u.id,
             TRIM(CONCAT(u.first_name, ' ', u.last_name))   AS raw_name,
             u.first_name,
             u.last_name,
             u.username,
             -- Revealed once the talent has accepted a client-initiated invitation
             ${nameRevealExistsSQL("$2", "u.id")} AS name_revealed,
             -- Clients are never masked; only talent participants need masking
             EXISTS (SELECT 1 FROM candidates c WHERE c.user_id = u.id) AS is_talent
           FROM users u
           WHERE u.id = ANY($1::text[])`,
          [otherIds as any, userId],
        );
        for (const row of result.rows) {
          const raw = (row.raw_name?.trim() || row.username || "").trim();
          if (!row.name_revealed && row.is_talent) {
            names[row.id] = maskClientTalentName({
              firstName: row.first_name,
              lastName: row.last_name,
              fullName: raw,
            });
          } else {
            names[row.id] = raw || "Member";
          }
        }
      }
      res.json({
        userId,
        threads,
        unreadMessageCount: threads.reduce((total, thread) => total + thread.unreadCount, 0),
        participantNames: names,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get message threads" });
    }
  });

  app.get("/api/users/:userId/message-threads", authenticateJWT, async (req, res) => {
    try {
      const userId = getAuthedUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (req.params.userId !== userId) {
        return res.status(403).json({ error: "Cannot view another user's threads" });
      }
      const threads = await storage.listMessageThreadsByUserWithUnread(userId);
      res.json(threads);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user message threads" });
    }
  });

  app.get("/api/message-threads/:threadId/messages", authenticateJWT, async (req, res) => {
    try {
      const userId = getAuthedUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const thread = await storage.getMessageThread(req.params.threadId);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      if (!thread.participants.includes(userId)) {
        return res.status(403).json({ error: "Not a participant of this thread" });
      }
       const messages = await storage.listMessagesByThread(req.params.threadId);
      // Strip admin-only field before returning to participants
       res.json(messages.map(({ flaggedForReview: _omit, readBy, ...m }) => ({
         ...m,
         // A participant may see read state only for canonical thread
         // participants; never echo arbitrary IDs stored in historical data.
         readBy: (readBy ?? []).filter((readerId) => thread.participants.includes(readerId)),
       })));
    } catch (error) {
      res.status(500).json({ error: "Failed to get thread messages" });
    }
  });

  app.post("/api/messages", authenticateJWT, async (req, res) => {
    try {
      const userId = getAuthedUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const validated = insertMessageSchema.parse({
        ...req.body,
        senderId: userId, // sender is always the authenticated user
      });
      const thread = await storage.getMessageThread(validated.threadId);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      if (!thread.participants.includes(userId)) {
        return res.status(403).json({ error: "Not a participant of this thread" });
      }
      const message = await storage.createMessage(validated);

      // Canonical threads have one other participant. Group unread notifications
      // by recipient/thread after persistence; the message body and contact
      // details never enter the notification payload.
      const recipientId = thread.participants.find((p) => p !== userId);
      if (recipientId) {
        void (async () => {
          const senderName = await resolveSafeMessageSenderName(userId, recipientId);
          await storage.upsertMessageNotification({
            recipientId,
            threadId: message.threadId,
            senderName,
            messageId: message.id,
          });
        })().catch((notifErr) =>
          console.error(
            "[notify] message notification failed for",
            recipientId,
            notifErr,
          ),
        );
      }

      // PII detection: runs post-save so it never blocks delivery.
      // Errors are caught and logged; sender receives no indication either way.
      try {
        if (containsPii(validated.content)) {
          await storage.flagMessageForReview(message.id);
        }
      } catch (piiErr) {
        console.error("[pii-flag] Failed to evaluate/flag message", message.id, piiErr);
      }

      // Strip admin-only field before returning to sender
      const { flaggedForReview: _omit, ...safeMessage } = message;
      res.status(201).json(safeMessage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  // ── Direct client→talent messaging (no prior invite required) ──────────────
  // Opens a pre-invite null-job_id thread from the Full Profile / Preview modal.
  // The talent's identity stays masked in the Messages UI until a formal invitation
  // is accepted — this endpoint carries no acceptance gate and no name exposure.
  app.post(
    "/api/client/message-talent",
    authenticateJWT,
    requireClient,
    async (req, res) => {
      try {
        const clientId = getAuthedUserId(req);
        if (!clientId) return res.status(401).json({ error: "Unauthorized" });

        const { talentUserId } = req.body;
        if (!talentUserId || typeof talentUserId !== "string") {
          return res.status(400).json({ error: "talentUserId is required" });
        }

        // Verify the target user exists as a talent (candidates row required)
        const talentCheck = await query(
          `SELECT id FROM candidates WHERE user_id = $1 LIMIT 1`,
          [talentUserId],
        );
        if (!talentCheck.rows.length) {
          return res.status(404).json({ error: "Talent not found" });
        }

        // Idempotent creation under advisory lock — same pattern as the
        // existing thread endpoints so concurrent clicks converge on one thread.
        const txClient = await pool.connect();
        try {
          await txClient.query("BEGIN");
          await txClient.query(
            `SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':direct'))`,
            [clientId, talentUserId],
          );

          // Reuse any existing null-job_id thread between this pair
          const existing = await txClient.query(
            `SELECT id FROM message_threads
             WHERE participants @> ARRAY[$1, $2]::text[]
               AND participants <@ ARRAY[$1, $2]::text[]
               AND job_id IS NULL
             LIMIT 1`,
            [clientId, talentUserId],
          );

          let threadId: string;
          let isNew = false;

          if (existing.rows.length) {
            threadId = existing.rows[0].id;
          } else {
            const created = await txClient.query(
              `INSERT INTO message_threads (job_id, participants, subject)
               VALUES (NULL, ARRAY[$1, $2]::text[], NULL)
               RETURNING id`,
              [clientId, talentUserId],
            );
            threadId = created.rows[0].id;
            isNew = true;
          }

          await txClient.query("COMMIT");
          return res.status(isNew ? 201 : 200).json({ threadId, isNew });
        } catch (txErr) {
          await txClient.query("ROLLBACK").catch(() => {});
          throw txErr;
        } finally {
          txClient.release();
        }
      } catch (err: any) {
        console.error("POST /api/client/message-talent error:", err);
        res.status(500).json({ error: "Failed to open message thread" });
      }
    },
  );

  app.post("/api/message-threads/:threadId/mark-read", authenticateJWT, async (req, res) => {
    try {
      const userId = getAuthedUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const thread = await storage.getMessageThread(req.params.threadId);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      if (!thread.participants.includes(userId)) {
        return res.status(403).json({ error: "Not a participant of this thread" });
      }
      await storage.markMessagesAsRead(req.params.threadId, userId);
      // Also mark any grouped new_message notification for this thread as read
      // so the unread badge in the talent nav clears when the thread is opened.
      try {
        await storage.markMessageNotificationsAsRead(userId, req.params.threadId);
      } catch {
        // Non-critical — badge will self-correct on next poll
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  // Reviews
  app.get("/api/users/:userId/reviews", async (req, res) => {
    try {
      const asReviewer = req.query.as_reviewer === "true";
      const reviews = await storage.listReviewsByUser(
        req.params.userId,
        asReviewer,
      );
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user reviews" });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    try {
      const validated = insertReviewSchema.parse(req.body);
      const review = await storage.createReview(validated);
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  // Portfolio
  app.get("/api/talents/:talentId/portfolio", async (req, res) => {
    try {
      const items = await storage.listPortfolioItemsByTalent(
        req.params.talentId,
      );
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to get portfolio items" });
    }
  });

  app.get("/api/portfolio/:id", async (req, res) => {
    try {
      const item = await storage.getPortfolioItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Portfolio item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to get portfolio item" });
    }
  });

  app.post("/api/portfolio", async (req, res) => {
    try {
      const validated = insertPortfolioItemSchema.parse(req.body);
      const item = await storage.createPortfolioItem(validated);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create portfolio item" });
    }
  });

  app.patch("/api/portfolio/:id", async (req, res) => {
    try {
      const updates = insertPortfolioItemSchema.partial().parse(req.body);
      const item = await storage.updatePortfolioItem(req.params.id, updates);
      if (!item) {
        return res.status(404).json({ error: "Portfolio item not found" });
      }
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update portfolio item" });
    }
  });

  app.delete("/api/portfolio/:id", async (req, res) => {
    try {
      const success = await storage.deletePortfolioItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Portfolio item not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete portfolio item" });
    }
  });

  // Certification Routes
  /**
   * Resolve the canonical users.id for certification writes.
   * authenticateJWT resolves candidate JWTs via email→users lookup, but falls
   * back to candidateId when no users row exists. The certifications.talent_id
   * FK requires a real users.id, so we verify the resolved ID and fall back to
   * candidates.user_id when necessary.
   */
  async function resolveCertUserId(req: any): Promise<string | null> {
    const resolvedId: string = req.user?.id;
    if (!resolvedId) return null;
    // Fast check: is this already a valid users.id?
    const userCheck = await query("SELECT id FROM users WHERE id = $1 LIMIT 1", [resolvedId]);
    if (userCheck.rows.length > 0) return resolvedId;
    // Fallback: resolvedId is actually the candidateId — try candidates.user_id
    const candCheck = await query(
      "SELECT user_id FROM candidates WHERE id = $1 AND user_id IS NOT NULL LIMIT 1",
      [resolvedId]
    );
    if (candCheck.rows.length > 0) return candCheck.rows[0].user_id as string;
    return null; // No linked user account
  }

  app.get("/api/talents/:talentId/certifications", authenticateJWT, async (req: any, res) => {
    try {
      // Admins may view any talent's certifications; all others must request their own.
      const isAdmin = req.user?.role === "admin" || req.user?.role === "talent_acquisition";
      if (!isAdmin) {
        const userId = await resolveCertUserId(req);
        if (!userId || userId !== req.params.talentId) {
          return res.status(403).json({ error: "You may only view your own certifications." });
        }
      }
      const certs = await storage.listCertificationsByTalent(req.params.talentId);
      res.json(certs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get certifications" });
    }
  });

  app.post("/api/certifications", authenticateJWT, async (req: any, res) => {
    try {
      if (req.user?.role !== "talent") {
        return res.status(403).json({ error: "Only talent users may create certifications." });
      }
      const userId = await resolveCertUserId(req);
      if (!userId) {
        return res.status(422).json({ error: "Your account is not linked to a user profile. Please complete account setup to manage certifications." });
      }
      const raw = req.body;
      const body = {
        ...raw,
        talentId: userId,
        issueDate: raw.issueDate ? new Date(raw.issueDate) : undefined,
        expiryDate: raw.expiryDate ? new Date(raw.expiryDate) : undefined,
      };
      const validated = insertCertificationSchema.parse(body);
      const cert = await storage.createCertification(validated);
      res.status(201).json(cert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create certification" });
    }
  });

  app.put("/api/certifications/:id", authenticateJWT, async (req: any, res) => {
    try {
      const userId = await resolveCertUserId(req);
      if (!userId) {
        return res.status(422).json({ error: "Your account is not linked to a user profile. Please complete account setup to manage certifications." });
      }
      const existing = await storage.getCertification(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Certification not found" });
      }
      if (existing.talentId !== userId) {
        return res.status(403).json({ error: "You are not authorized to edit this certification" });
      }
      // Only allow fields present in insertCertificationSchema (excludes verified)
      const raw = req.body;
      const updates = insertCertificationSchema.partial().parse({
        ...raw,
        talentId: existing.talentId,
        issueDate: raw.issueDate ? new Date(raw.issueDate) : undefined,
        expiryDate: 'expiryDate' in raw
          ? (raw.expiryDate ? new Date(raw.expiryDate) : null)
          : undefined,
      });
      const updated = await storage.updateCertification(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update certification" });
    }
  });

  app.delete("/api/certifications/:id", authenticateJWT, async (req: any, res) => {
    try {
      const userId = await resolveCertUserId(req);
      if (!userId) {
        return res.status(422).json({ error: "Your account is not linked to a user profile. Please complete account setup to manage certifications." });
      }
      const existing = await storage.getCertification(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Certification not found" });
      }
      if (existing.talentId !== userId) {
        return res.status(403).json({ error: "You are not authorized to delete this certification" });
      }
      await storage.deleteCertification(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete certification" });
    }
  });

  // Notifications

  // GET /api/users/:userId/notifications
  // Requires authentication; the requesting user must own the target userId (or be admin).
  // Talent-portal sessions should use GET /api/talent/notifications instead.
  app.get("/api/users/:userId/notifications", authenticateJWT, async (req: any, res) => {
    try {
      const authedUser = req.user;
      if (authedUser.role !== "admin" && authedUser.id !== req.params.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const unreadOnly = req.query.unread_only === "true";
      const notifications = await storage.listNotificationsByUser(
        req.params.userId,
        unreadOnly,
      );
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  // GET /api/talent/notifications
  // Talent-portal authenticated endpoint. Resolves candidateId → linked users.id
  // server-side so the correct notification owner is always used. Supports
  // ?unread_only=true for badge-count queries.
  app.get("/api/talent/notifications", authenticateTalentJWT, async (req: any, res) => {
    try {
      const { candidateId } = req.talentAuth;
      const linkedUserId = await resolveTalentPortalNotificationRecipient(candidateId);

      if (!linkedUserId) {
        // No linked user account; no notifications can exist for this talent.
        return res.json([]);
      }

      const unreadOnly = req.query.unread_only === "true";
      const notifications = await storage.listNotificationsByUser(
        linkedUserId,
        unreadOnly,
      );
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to get talent notifications" });
    }
  });

  // POST /api/notifications — requires authentication; caller may only create
  // notifications for themselves (admin may create for any user).
  // Note: internal server-side notification creation (e.g. from POST /api/messages)
  // calls storage.createNotification() directly and is not affected by this gate.
  app.post("/api/notifications", authenticateJWT, async (req: any, res) => {
    try {
      const validated = insertNotificationSchema.parse(req.body);
      const authedUser = req.user;
      if (authedUser.role !== "admin" && validated.userId !== authedUser.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const notification = await storage.createNotification(validated);
      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create notification" });
    }
  });

  // PATCH /api/notifications/:id/read
  // Requires authentication (main JWT). Verifies the caller owns the notification
  // before marking it read. Talent-portal sessions should use
  // PATCH /api/talent/notifications/:id/read instead.
  app.patch("/api/notifications/:id/read", authenticateJWT, async (req: any, res) => {
    try {
      const authedUser = req.user;
      // Verify ownership: look up the notification's userId.
      const notifRow = await query(
        `SELECT user_id FROM notifications WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      if (!notifRow.rows.length) {
        return res.status(404).json({ error: "Notification not found" });
      }
      if (authedUser.role !== "admin" && notifRow.rows[0].user_id !== authedUser.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const success = await storage.markNotificationAsRead(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // PATCH /api/talent/notifications/:id/read
  // Talent-portal authenticated endpoint. Resolves candidateId → linked users.id
  // and verifies the notification belongs to that user before marking it read.
  app.patch("/api/talent/notifications/:id/read", authenticateTalentJWT, async (req: any, res) => {
    try {
      const { candidateId } = req.talentAuth;
      const linkedUserId = await resolveTalentPortalNotificationRecipient(candidateId);

      if (!linkedUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Verify ownership.
      const notifRow = await query(
        `SELECT user_id FROM notifications WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      if (!notifRow.rows.length) {
        return res.status(404).json({ error: "Notification not found" });
      }
      if (notifRow.rows[0].user_id !== linkedUserId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const success = await storage.markNotificationAsRead(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to mark talent notification as read" });
    }
  });

  // ====== LINKEDIN INTEGRATION ======

  // LinkedIn OAuth Connect - Initiate LinkedIn authentication
  app.post("/api/linkedin/connect", async (req, res) => {
    try {
      // In a real implementation, this would redirect to LinkedIn OAuth
      // For now, we'll simulate a successful connection
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }

      // Check if user already has LinkedIn profile
      const existingProfile = await storage.getLinkedinProfileByUserId(userId);
      if (existingProfile) {
        return res.json({
          status: "already_connected",
          linkedinProfile: existingProfile,
        });
      }

      // In production, redirect to LinkedIn OAuth URL
      // For development, we'll simulate connected state
      const linkedinProfile = {
        userId,
        linkedinId: `linkedin_${userId}_${Date.now()}`,
        profileUrl: `https://linkedin.com/in/user${userId}`,
        isVerified: true,
        lastSync: new Date(),
        profileData: {
          firstName: "Sample",
          lastName: "User",
          headline: "Professional Title",
          summary: "Professional summary from LinkedIn",
          location: "Global",
          profilePictureUrl: null,
          experience: [],
          education: [],
          skills: ["JavaScript", "React", "Node.js"],
        },
      };

      const createdProfile =
        await storage.createLinkedinProfile(linkedinProfile);

      res.json({
        status: "connected",
        linkedinProfile: createdProfile,
      });
    } catch (error) {
      console.error("LinkedIn connect error:", error);
      res.status(500).json({ error: "Failed to connect LinkedIn" });
    }
  });

  // LinkedIn Profile Import - Import data from LinkedIn to OnSpot profile
  app.post("/api/linkedin/import-profile", async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }

      // Get LinkedIn profile data
      const linkedinProfile = await storage.getLinkedinProfileByUserId(userId);
      if (!linkedinProfile || !linkedinProfile.profileData) {
        return res
          .status(404)
          .json({ error: "LinkedIn profile not found or not connected" });
      }

      const profileData = linkedinProfile.profileData;

      // Map LinkedIn data to OnSpot profile format
      const profileImportData = {
        firstName: profileData.firstName || "",
        lastName: profileData.lastName || "",
        title: profileData.headline || "",
        bio: profileData.summary || "",
        location: profileData.location || "Global",
        profilePicture: profileData.profilePictureUrl || null,
        languages: ["English"],
      };

      // Get or create user profile
      let profile = await storage.getProfileByUserId(userId);
      if (profile) {
        // Update existing profile with LinkedIn data
        profile = await storage.updateProfile(profile.id, profileImportData);
      } else {
        // Create new profile with LinkedIn data
        profile = await storage.createProfile({
          ...profileImportData,
          userId,
          hourlyRate: "50.00",
          rateCurrency: "USD",
          availability: "available",
          timezone: "UTC",
        });
      }

      // Import skills from LinkedIn
      if (profileData.skills && Array.isArray(profileData.skills)) {
        for (const skillName of profileData.skills) {
          // Check if skill exists
          let skill = await storage.getSkillByName(skillName);
          if (!skill) {
            // Create new skill
            skill = await storage.createSkill({
              name: skillName,
              category: "Technical",
            });
          }

          // Add user skill if not already exists
          const existingUserSkills = await storage.getUserSkills(userId);
          const hasSkill = existingUserSkills.some(
            (us) => us.skillId === skill!.id,
          );

          if (!hasSkill) {
            await storage.createUserSkill({
              userId,
              skillId: skill.id,
              level: "intermediate",
              yearsExperience: 2,
            });
          }
        }
      }

      // Update LinkedIn profile sync timestamp
      await storage.updateLinkedinProfile(linkedinProfile.id, {
        lastSync: new Date(),
      });

      res.json({
        status: "imported",
        profile,
        importedData: {
          personalInfo: !!profileData.firstName,
          skills: profileData.skills?.length || 0,
          experience: profileData.experience?.length || 0,
          education: profileData.education?.length || 0,
        },
      });
    } catch (error) {
      console.error("LinkedIn import error:", error);
      res.status(500).json({ error: "Failed to import LinkedIn profile" });
    }
  });

  // Resume Parsing endpoint for auto-import
  app.post("/api/resume/parse", async (req, res) => {
    try {
      const { resumeText, userId } = req.body;

      if (!resumeText || !userId) {
        return res
          .status(400)
          .json({ error: "Resume text and user ID required" });
      }

      // Simple resume parsing logic (can be enhanced with NLP)
      const parsedData = parseResumeText(resumeText);

      res.json({
        status: "parsed",
        parsedData,
      });
    } catch (error) {
      console.error("Resume parsing error:", error);
      res.status(500).json({ error: "Failed to parse resume" });
    }
  });

  // ── Vanessa Resume Intelligence ───────────────────────────────────────────────
  // Accepts plain-text resume content, runs it through Vanessa AI (OpenAI Chat
  // Completions), returns a structured candidate profile. The OpenAI key is
  // NEVER exposed to the browser. Resume content is not stored in Vanessa's
  // global RAG / knowledge base.
  app.post("/api/resume/analyze", async (req, res) => {
    try {
      const { resumeText, candidateId } = req.body as { resumeText?: string; candidateId?: string };

      if (!resumeText || typeof resumeText !== "string" || !resumeText.trim()) {
        return res.status(400).json({ success: false, error: "resumeText is required" });
      }

      const profile = await analyzeResumeWithVanessa(resumeText.trim(), candidateId);

      return res.json({
        success:       true,
        source:        "vanessa",
        parserVersion: profile.parserVersion,
        profile: {
          personalInfo: profile.personalInfo,
          professional: profile.professional,
          skills:        profile.skills,
          experience:   profile.experience,
          education:    profile.education,
          certifications: profile.certifications,
          confidence:   profile.confidence,
        },
      });
    } catch (error: any) {
      console.warn("⚠️ Vanessa Resume Analysis unavailable:", error?.message ?? error);
      // Return 503 so the client can fall back to deterministic parsing gracefully
      return res.status(503).json({
        success: false,
        source:  "error",
        error:   "Vanessa Resume Intelligence is temporarily unavailable",
      });
    }
  });

  // Get LinkedIn connection status
  app.get("/api/linkedin/status/:userId", async (req, res) => {
    try {
      const linkedinProfile = await storage.getLinkedinProfileByUserId(
        req.params.userId,
      );

      res.json({
        isConnected: !!linkedinProfile,
        lastSync: linkedinProfile?.lastSync || null,
        profileUrl: linkedinProfile?.profileUrl || null,
      });
    } catch (error) {
      console.error("LinkedIn status error:", error);
      res.status(500).json({ error: "Failed to get LinkedIn status" });
    }
  });

  // CSV Talent Import Routes

  // Get CSV template for talent import
  app.get("/api/admin/csv-import/template", async (req: any, res) => {
    try {
      // Admin authentication check
      if (!req.isAuthenticated()) {
        return res.status(401).json({
          error: "Authentication required",
          message: "Please log in to access this resource",
          requestId: req.requestId,
        });
      }

      const user =
        (req.user as any)?.user ||
        (await storage.getUser((req.user as any)?.claims?.sub));
      if (!user || user.role !== "admin") {
        return res.status(403).json({
          error: "Access denied",
          message: "Admin access required for CSV import",
          requestId: req.requestId,
        });
      }

      const template = {
        headers: [
          "firstName",
          "lastName",
          "email",
          "title",
          "bio",
          "location",
          "rateCurrency",
          "availability",
          "phoneNumber",
          "languages",
          "timezone",
          "skills",
        ],
        sampleData: [
          {
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@example.com",
            title: "Senior Software Engineer",
            bio: "Experienced full-stack developer with expertise in React, Node.js, and cloud technologies. Passionate about building scalable applications.",
            location: "Manila, Philippines",
            rateCurrency: "USD",
            availability: "available",
            phoneNumber: "+63 9123456789",
            languages: "English, Filipino",
            timezone: "Asia/Manila",
            skills: "JavaScript, React, Node.js, AWS, MongoDB",
          },
          {
            firstName: "Maria",
            lastName: "Santos",
            email: "maria.santos@example.com",
            title: "Digital Marketing Specialist",
            bio: "Creative marketing professional with 5+ years of experience in social media marketing, content creation, and campaign management.",
            location: "Cebu, Philippines",
            rateCurrency: "USD",
            availability: "available",
            phoneNumber: "+63 9876543210",
            languages: "English, Filipino, Cebuano",
            timezone: "Asia/Manila",
            skills:
              "Social Media Marketing, Content Writing, Google Ads, SEO, Canva",
          },
        ],
        fieldDescriptions: {
          firstName: "Required. First name of the talent (max 100 characters)",
          lastName: "Required. Last name of the talent (max 100 characters)",
          email: "Required. Valid email address (must be unique)",
          title:
            "Required. Professional title or job position (max 200 characters)",
          bio: "Required. Professional biography or summary (minimum 10 characters, max 2000)",
          location: 'Optional. Geographic location (default: "Global")',
          rateCurrency:
            'Optional. Currency code: "USD" or "PHP" (default: "USD")',
          availability:
            'Optional. Status: "available", "busy", or "offline" (default: "available")',
          phoneNumber: "Optional. Contact phone number",
          languages: 'Optional. Comma-separated languages (default: "English")',
          timezone: 'Optional. Timezone identifier (default: "UTC")',
          skills: "Optional. Comma-separated list of skills",
        },
        requiredFields: ["firstName", "lastName", "email", "title", "bio"],
        optionalFields: [
          "location",
          "rateCurrency",
          "availability",
          "phoneNumber",
          "languages",
          "timezone",
          "skills",
        ],
      };

      res.json(template);
    } catch (error) {
      handleRouteError(error, req, res, "Get CSV template", 500);
    }
  });

  // Download CSV template file
  app.get("/api/admin/csv-import/template/download", async (req: any, res) => {
    try {
      // Admin authentication check
      if (!req.isAuthenticated()) {
        return res.status(401).json({
          error: "Authentication required",
          requestId: req.requestId,
        });
      }

      const user =
        (req.user as any)?.user ||
        (await storage.getUser((req.user as any)?.claims?.sub));
      if (!user || user.role !== "admin") {
        return res.status(403).json({
          error: "Access denied",
          message: "Admin access required for CSV import",
          requestId: req.requestId,
        });
      }

      const csvHeaders = [
        "firstName",
        "lastName",
        "email",
        "title",
        "bio",
        "location",
        "rateCurrency",
        "availability",
        "phoneNumber",
        "languages",
        "timezone",
        "skills",
      ];

      const sampleRow = [
        "John",
        "Doe",
        "john.doe@example.com",
        "Senior Software Engineer",
        "Experienced full-stack developer with expertise in React and Node.js",
        "Manila, Philippines",
        "USD",
        "available",
        "+63 9123456789",
        "English, Filipino",
        "Asia/Manila",
        "JavaScript, React, Node.js",
      ];

      const csvContent = Papa.unparse([csvHeaders, sampleRow]);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="onspot_talent_import_template.csv"',
      );
      res.send(csvContent);
    } catch (error) {
      handleRouteError(error, req, res, "Download CSV template", 500);
    }
  });

  // Validate CSV data before import
  app.post(
    "/api/admin/csv-import/validate",
    upload.single("csvFile"),
    async (req: any, res) => {
      try {
        // Admin authentication check
        if (!req.isAuthenticated()) {
          return res.status(401).json({
            error: "Authentication required",
            requestId: req.requestId,
          });
        }

        const user =
          (req.user as any)?.user ||
          (await storage.getUser((req.user as any)?.claims?.sub));
        if (!user || user.role !== "admin") {
          return res.status(403).json({
            error: "Access denied",
            message: "Admin access required for CSV import",
            requestId: req.requestId,
          });
        }

        if (!req.file) {
          return res.status(400).json({
            error: "No CSV file provided",
            requestId: req.requestId,
          });
        }

        console.log(`📊 CSV validation started [${req.requestId}]:`, {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          userId: user.id,
        });

        // Parse CSV
        const csvContent = req.file.buffer.toString("utf-8");
        const parseResult = Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
        });

        if (parseResult.errors && parseResult.errors.length > 0) {
          return res.status(400).json({
            error: "CSV parsing failed",
            message: "Invalid CSV format",
            details: parseResult.errors,
            requestId: req.requestId,
          });
        }

        // Validate each row
        const validationResult = await storage.validateCsvTalentRows(
          parseResult.data as any[],
        );

        console.log(`✅ CSV validation completed [${req.requestId}]:`, {
          totalRows: parseResult.data.length,
          validRows: validationResult.validRows.length,
          errorRows: validationResult.errors.length,
          duplicateEmails: validationResult.duplicateEmails.length,
        });

        res.json({
          success: validationResult.errors.length === 0,
          totalRows: parseResult.data.length,
          validRows: validationResult.validRows.length,
          errorRows: validationResult.errors.length,
          errors: validationResult.errors,
          duplicateEmails: validationResult.duplicateEmails,
          sampleValidRows: validationResult.validRows.slice(0, 3), // Show first 3 for preview
          requestId: req.requestId,
        });
      } catch (error) {
        handleRouteError(error, req, res, "Validate CSV data", 500);
      }
    },
  );

  // Import CSV talents
  app.post(
    "/api/admin/csv-import/import",
    upload.single("csvFile"),
    validateRequest(
      z.object({
        skipDuplicateEmails: z
          .string()
          .optional()
          .transform((val) => val === "true"),
      }),
      "body",
    ),
    async (req: any, res) => {
      try {
        // Admin authentication check
        if (!req.isAuthenticated()) {
          return res.status(401).json({
            error: "Authentication required",
            requestId: req.requestId,
          });
        }

        const user =
          (req.user as any)?.user ||
          (await storage.getUser((req.user as any)?.claims?.sub));
        if (!user || user.role !== "admin") {
          return res.status(403).json({
            error: "Access denied",
            message: "Admin access required for CSV import",
            requestId: req.requestId,
          });
        }

        if (!req.file) {
          return res.status(400).json({
            error: "No CSV file provided",
            requestId: req.requestId,
          });
        }

        const { skipDuplicateEmails = true } = req.body;

        console.log(`📈 CSV talent import started [${req.requestId}]:`, {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          skipDuplicateEmails,
          userId: user.id,
        });

        // Parse CSV
        const csvContent = req.file.buffer.toString("utf-8");
        const parseResult = Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
        });

        if (parseResult.errors && parseResult.errors.length > 0) {
          return res.status(400).json({
            error: "CSV parsing failed",
            message: "Invalid CSV format",
            details: parseResult.errors,
            requestId: req.requestId,
          });
        }

        // Validate and process
        const validationResult = await storage.validateCsvTalentRows(
          parseResult.data as any[],
        );

        // Filter out duplicates if requested
        let talentDataToImport = validationResult.validRows;
        if (skipDuplicateEmails) {
          // Remove rows with duplicate emails from import
          const duplicateEmailsSet = new Set(validationResult.duplicateEmails);
          talentDataToImport = validationResult.validRows.filter(
            (row) => !duplicateEmailsSet.has(row.user.email!),
          );
        }

        // Perform bulk import
        const importResult =
          await storage.bulkCreateTalents(talentDataToImport);

        console.log(`✅ CSV talent import completed [${req.requestId}]:`, {
          totalProcessed: importResult.totalRows,
          successful: importResult.successfulRows,
          failed: importResult.failedRows,
          duplicatesSkipped: importResult.summary.duplicatesSkipped,
        });

        res.json({
          ...importResult,
          requestId: req.requestId,
        });
      } catch (error) {
        handleRouteError(error, req, res, "Import CSV talents", 500);
      }
    },
  );

  // Debug endpoint to check environment configuration (development only for security)
  app.get("/debug/env", (req: Request, res: Response) => {
    // Security: Only allow in development environment
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    const requestId = (req as any).requestId;

    // Mask sensitive values
    const dbUrl = process.env.DATABASE_URL;
    const maskedDbUrl = dbUrl ? dbUrl.replace(/:([^:]+)@/, ":***@") : "NOT_SET";

    const envDebugInfo = {
      requestId,
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || "NOT_SET",
      hasJwtSecret: !!process.env.JWT_SECRET,
      databaseUrl: maskedDbUrl,
      port: process.env.PORT || "NOT_SET",
      frontendBaseUrl: process.env.VITE_API_BASE || "NOT_SET",
    };

    console.log(
      `🔍 Debug environment info requested [${requestId}] (development only):`,
      envDebugInfo,
    );

    res.json({
      success: true,
      environment: envDebugInfo,
    });
  });

  // Production-friendly routes without /api prefix (prevents double /api in production URLs)
  // These are identical to the /api routes but without the prefix for production baseURL compatibility

  // Production login route (without /api prefix)
  app.post("/login", loginLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const requestId = (req as any).requestId;

      // Debug: Log DATABASE_URL being used (mask password)
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl) {
        const maskedDbUrl = dbUrl.replace(/:([^:]+)@/, ":***@");
        console.log(
          `🗄️ Debug [${requestId}]: Using DATABASE_URL = ${maskedDbUrl}`,
        );
      } else {
        console.error(`❌ Debug [${requestId}]: DATABASE_URL not set!`);
      }

      // Debug: Log JWT_SECRET status
      const hasJwtSecret = !!process.env.JWT_SECRET;
      console.log(
        `🔑 Debug [${requestId}]: JWT_SECRET loaded = ${hasJwtSecret}`,
      );

      // Production diagnostics logging
      if (process.env.NODE_ENV === "production") {
        console.log(`🌐 Production login attempt [${requestId}]:`, {
          email: email ? "***@" + email.split("@")[1] : "missing",
          hasPassword: !!password,
          userAgent: req.get("User-Agent")?.substring(0, 50) + "...",
          ip: req.ip,
        });
      }

      console.log(`🔐 Login request received [${requestId}]:`, {
        email: email ? "***@" + email.split("@")[1] : "missing",
        hasPassword: !!password,
      });

      if (!email || !password) {
        const missingFields = [];
        if (!email) missingFields.push("email");
        if (!password) missingFields.push("password");

        console.error(
          `❌ Login validation failed [${requestId}]: Missing fields:`,
          missingFields,
        );

        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
          requestId,
        });
      }

      // Basic email format validation
      if (!validateEmail(email)) {
        console.error(`❌ Email format validation failed [${requestId}]`);
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address",
          requestId,
        });
      }

      // Find user by email
      const userQuery =
        'SELECT id, email, username, "first_name", "last_name", "password_hash", role, company FROM users WHERE email = $1';
      const userResult = await query(userQuery, [email]);

      if (userResult.rows.length === 0) {
        console.error(
          `❌ User not found [${requestId}]: No user with email ${email}`,
        );
        console.log(`🔍 Debug [${requestId}]: User record found = false`);
        if (process.env.NODE_ENV === "production") {
          console.log(
            `🌐 Production login failed: User not found [${requestId}]`,
          );
        }
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
          requestId,
        });
      }

      console.log(`👤 User found [${requestId}]:`, {
        userId: userResult.rows[0].id,
        email: userResult.rows[0].email,
        role: userResult.rows[0].role,
      });
      console.log(`🔍 Debug [${requestId}]: User record found = true`);

      const user = userResult.rows[0];

      // Check if user has a password (OAuth users might not)
      if (!user.password_hash) {
        console.error(
          `❌ Password verification failed [${requestId}]: User ${user.id} has no password (OAuth user?)`,
        );
        return res.status(401).json({
          success: false,
          message:
            "This account was created with social login. Please use Google or LinkedIn to sign in.",
          requestId,
        });
      }

      // Verify password
      console.log(`🔐 Verifying password [${requestId}]`);
      const isPasswordValid = await verifyPassword(
        password,
        user.password_hash,
      );
      if (!isPasswordValid) {
        console.error(
          `❌ Password verification failed [${requestId}]: Password did not match for user ${user.id}`,
        );
        console.log(`🔍 Debug [${requestId}]: bcrypt.compare result = false`);
        if (process.env.NODE_ENV === "production") {
          console.log(
            `🌐 Production login failed: Invalid password [${requestId}]`,
          );
        }
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
          requestId,
        });
      }

      console.log(`✅ Password verified successfully [${requestId}]`);
      console.log(`🔍 Debug [${requestId}]: bcrypt.compare result = true`);

      // Get JWT secret with graceful error handling
      let jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        if (process.env.NODE_ENV === "development") {
          jwtSecret = "development-fallback-secret-not-for-production";
          console.warn(
            `⚠️ Using development fallback JWT secret [${requestId}]`,
          );
        } else {
          console.error(
            `❌ JWT_SECRET not configured for production [${requestId}]`,
          );
          return res.status(500).json({
            success: false,
            message: "JWT not configured",
          });
        }
      }

      // Generate JWT token
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "7d" });

      console.log(`🔍 Debug [${requestId}]: JWT signed = true`);

      console.log(`✅ JWT token generated successfully [${requestId}]:`, {
        userId: user.id,
        role: user.role,
        expiresIn: "7d",
      });

      if (process.env.NODE_ENV === "production") {
        console.log(`🌐 Production login successful [${requestId}]:`, {
          userId: user.id,
          role: user.role,
          jwtSigned: !!token,
        });
      }

      // Return successful login response
      res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          company: user.company,
        },
        authProvider: "jwt",
        requestId,
      });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Login error [${requestId}]:`, {
        error: error.message,
        stack: error.stack?.split("\n")[0],
      });

      if (process.env.NODE_ENV === "production") {
        console.log(
          `🌐 Production login error [${requestId}]: ${error.message}`,
        );
      }

      return res.status(500).json({
        success: false,
        message: "Login failed due to server error",
        requestId,
      });
    }
  });

  // Production signup route (without /api prefix)
  app.post("/signup", signupLimiter, async (req: Request, res: Response) => {
    try {
      const {
        email,
        username,
        password,
        first_name,
        last_name,
        role,
        company,
      } = req.body;
      const requestId = (req as any).requestId;

      // Debug: Log DATABASE_URL being used (mask password)
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl) {
        const maskedDbUrl = dbUrl.replace(/:([^:]+)@/, ":***@");
        console.log(
          `🗄️ Debug [${requestId}]: Using DATABASE_URL = ${maskedDbUrl}`,
        );
      } else {
        console.error(`❌ Debug [${requestId}]: DATABASE_URL not set!`);
      }

      // Debug: Log JWT_SECRET status
      const hasJwtSecret = !!process.env.JWT_SECRET;
      console.log(
        `🔑 Debug [${requestId}]: JWT_SECRET loaded = ${hasJwtSecret}`,
      );

      // Production diagnostics logging
      if (process.env.NODE_ENV === "production") {
        console.log(`🌐 Production signup attempt [${requestId}]:`, {
          email: email ? "***@" + email.split("@")[1] : "missing",
          role: role || "missing",
          userAgent: req.get("User-Agent")?.substring(0, 50) + "...",
          ip: req.ip,
        });
      }

      console.log(`🔍 Signup request received [${requestId}]:`, {
        email: email ? "***@" + email.split("@")[1] : "missing",
        username: username || "not provided",
        first_name: first_name || "missing",
        last_name: last_name || "missing",
        role: role || "missing",
        company: company || "not provided",
      });

      // Validate required fields
      if (!email || !password || !first_name || !last_name || !role) {
        const missingFields = [];
        if (!email) missingFields.push("email");
        if (!password) missingFields.push("password");
        if (!first_name) missingFields.push("first_name");
        if (!last_name) missingFields.push("last_name");
        if (!role) missingFields.push("role");

        console.error(
          `❌ Signup validation failed [${requestId}]: Missing fields:`,
          missingFields,
        );

        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
          requestId,
        });
      }

      // Validate email format
      if (!validateEmail(email)) {
        console.error(
          `❌ Email validation failed [${requestId}]: Invalid format for email:`,
          email,
        );
        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid email address (e.g., name@example.com)",
          requestId,
        });
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        console.error(
          `❌ Password validation failed [${requestId}]:`,
          passwordValidation.errors,
        );
        return res.status(400).json({
          success: false,
          message: passwordValidation.errors.join(", "),
          requestId,
        });
      }

      // Validate role — only client and talent are allowed from the public signup form
      const allowedSignupRoles = ["client", "talent"];
      if (!allowedSignupRoles.includes(role)) {
        console.error(`❌ Invalid role [${requestId}]: "${role}"`);
        return res.status(400).json({
          success: false,
          message: "Invalid account type. Please select Client or Talent.",
          requestId,
        });
      }
      // Domain enforcement: admin role requires @onspotglobal.com (defense-in-depth)
      assertAdminEmailDomain(email, role);

      // Check for existing user
      const existingUserQuery =
        "SELECT id, email, username FROM users WHERE email = $1 OR username = $2";
      const existingUser = await query(existingUserQuery, [
        email,
        username || email,
      ]);

      if (existingUser.rows.length > 0) {
        const existing = existingUser.rows[0];
        console.error(`❌ User already exists [${requestId}]:`, {
          existingEmail: existing.email,
          existingUsername: existing.username,
          attemptedEmail: email,
          attemptedUsername: username || email,
        });

        return res.status(409).json({
          success: false,
          message: "An account with this email or username already exists",
          requestId,
        });
      }

      // Hash password (using bcrypt with 12 salt rounds)
      const passwordHash = await hashPassword(password);

      console.log(`🔐 Password hashed successfully [${requestId}]`);

      // Generate user ID
      const userId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insert user into database
      const insertUserQuery = `
        INSERT INTO users (id, email, username, "first_name", "last_name", "password_hash", company, role, "created_at", "updated_at")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, email, username, "first_name", "last_name", role
      `;

      console.log(`📝 Inserting user into database [${requestId}]:`, {
        userId,
        email,
        username: username || email.split("@")[0],
        first_name,
        last_name,
        role,
        company: company || null,
      });

      const userResult = await query(insertUserQuery, [
        userId,
        email,
        username || email.split("@")[0], // Use email prefix as username if not provided
        first_name,
        last_name,
        passwordHash,
        company || null,
        role,
      ]);

      const newUser = userResult.rows[0];
      console.log(
        `🔍 Debug [${requestId}]: User inserted into database = true`,
      );

      // If user is talent, create profile entry
      if (role === "talent") {
        const profileId = `prof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const insertProfileQuery = `
          INSERT INTO profiles (id, "user_id", "first_name", "last_name", location, languages, timezone, "created_at", "updated_at")
          VALUES ($1, $2, $3, $4, 'Global', ARRAY['English'], 'UTC', NOW(), NOW())
        `;

        console.log(`👤 Creating talent profile [${requestId}]:`, {
          profileId,
          userId,
          first_name,
          last_name,
        });

        await query(insertProfileQuery, [
          profileId,
          userId,
          first_name,
          last_name,
        ]);
      }

      // Get JWT secret with graceful error handling
      let jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        if (process.env.NODE_ENV === "development") {
          jwtSecret = "development-fallback-secret-not-for-production";
          console.warn(
            `⚠️ Using development fallback JWT secret [${requestId}]`,
          );
        } else {
          console.error(
            `❌ JWT_SECRET not configured for production [${requestId}]`,
          );
          return res.status(500).json({
            success: false,
            message: "Server configuration error - authentication unavailable",
            requestId,
          });
        }
      }

      // Generate JWT token for auto-login
      const tokenPayload = {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
      };

      const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "7d" });

      console.log(`✅ User signup completed successfully [${requestId}]:`, {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        hasProfile: role === "talent",
      });

      if (process.env.NODE_ENV === "production") {
        console.log(`🌐 Production signup successful [${requestId}]:`, {
          userId: newUser.id,
          role: newUser.role,
          jwtSigned: !!token,
        });
      }

      res.status(201).json({
        success: true,
        message: "Account created successfully",
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          role: newUser.role,
        },
        authProvider: "jwt",
        requestId,
      });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Signup error [${requestId}]:`, {
        error: error.message,
        stack: error.stack?.split("\n")[0],
      });

      if (process.env.NODE_ENV === "production") {
        console.log(
          `🌐 Production signup error [${requestId}]: ${error.message}`,
        );
      }

      return res.status(500).json({
        success: false,
        message: "Signup failed due to server error",
        requestId,
      });
    }
  });

  // LegalOps Trial - Stripe Payment Integration
  app.post("/api/legal-ops/create-trial", async (req: Request, res: Response) => {
    try {
      const { fullName, firmName, email, phone, tier, amount } = req.body;
      const requestId = (req as any).requestId;

      console.log(`💳 Creating LegalOps trial payment [${requestId}]:`, {
        firmName,
        email,
        tier,
        amount,
      });

      // Check if Stripe is configured
      if (!process.env.STRIPE_SECRET_KEY) {
        console.error(`❌ Stripe not configured [${requestId}]`);
        return res.status(500).json({
          error: "Payment system not configured",
          message: "Stripe integration is not set up. Please contact support.",
          requestId,
        });
      }

      // Initialize Stripe
      const Stripe = await import("stripe");
      const stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2025-08-27.basil",
      });

      // Create payment intent for card capture (no immediate charge)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount), // Already in cents
        currency: "usd",
        description: `OnSpot LegalOps ${tier === "launch" ? "Launch System" : "Executive Suite"} - 90-Day Trial`,
        metadata: {
          fullName,
          firmName,
          email,
          phone: phone || "",
          tier,
        },
        setup_future_usage: "off_session", // Allows future charges without customer present
      });

      console.log(`✅ Payment intent created [${requestId}]:`, {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        status: paymentIntent.status,
      });

      // Save trial signup to database
      try {
        await storage.createLegalOpsTrial({
          fullName,
          firmName,
          email,
          phone: phone || null,
          tier,
          fteCount: 1,
          stripePaymentIntentId: paymentIntent.id,
          status: "pending",
        });

        console.log(`✅ LegalOps trial saved to database [${requestId}]`);
      } catch (dbError: any) {
        console.error(`⚠️  Failed to save trial to database [${requestId}]:`, dbError.message);
        // Continue anyway since payment intent was created successfully
      }

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ LegalOps trial creation error [${requestId}]:`, {
        error: error.message,
        stack: error.stack?.split("\n")[0],
      });

      res.status(500).json({
        error: "Payment setup failed",
        message: error.message || "Unable to create payment intent. Please try again.",
        requestId,
      });
    }
  });

  // ======
  // Inquiry & Payment Flow
  // POST   /api/inquiries              — submit a new inquiry
  // GET    /api/inquiries/:id          — fetch a single inquiry
  // PATCH  /api/inquiries/:id/endorse  — approve/endorse an inquiry
  // POST   /api/payments               — create Stripe PaymentIntent, return clientSecret
  // PATCH  /api/inquiries/:id/paid     — verify PI with Stripe and mark inquiry as paid
  // ======

  const inquirySubmitSchema = z.object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Valid email required"),
    phoneNumber: z.string().optional(),
    company: z.string().optional(),
    serviceNeeded: z.string().min(1, "Service is required"),
    details: z.string().optional(),
    estimatedBudget: z.number().positive().optional(),
    refundPolicyAccepted: z.boolean().optional(),
    refundPolicyAcceptedAt: z.string().optional(),
  });

  // Generate reference number: INQ-YYYY-XXXX
  function generateInquiryRef(): string {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `INQ-${year}-${rand}`;
  }

  app.post("/api/inquiries", async (req: Request, res: Response) => {
    try {
      const parsed = inquirySubmitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }
      const { fullName, email, phoneNumber, company, serviceNeeded, details, estimatedBudget, refundPolicyAccepted, refundPolicyAcceptedAt } = parsed.data;
      const referenceNumber = generateInquiryRef();

      const result = await db.insert(inquiriesTable).values({
        referenceNumber,
        fullName,
        email,
        phoneNumber: phoneNumber ?? null,
        company: company ?? null,
        serviceNeeded,
        details: details ?? null,
        estimatedBudget: estimatedBudget ? String(estimatedBudget) : null,
        status: "pending_endorsement",
        refundPolicyAccepted: refundPolicyAccepted ?? false,
        refundPolicyAcceptedAt: refundPolicyAcceptedAt ? new Date(refundPolicyAcceptedAt) : null,
      }).returning();

      res.status(201).json({ inquiry: result[0] });
    } catch (error: any) {
      console.error("❌ Create inquiry error:", error.message);
      res.status(500).json({ error: "Failed to create inquiry" });
    }
  });

  app.get("/api/inquiries/:id", async (req: Request, res: Response) => {
    try {
      const result = await db.select().from(inquiriesTable).where(eq(inquiriesTable.id, req.params.id)).limit(1);
      if (!result.length) return res.status(404).json({ error: "Inquiry not found" });
      res.json({ inquiry: result[0] });
    } catch (error: any) {
      console.error("❌ Fetch inquiry error:", error.message);
      res.status(500).json({ error: "Failed to fetch inquiry" });
    }
  });

  app.patch("/api/inquiries/:id/endorse", async (req: Request, res: Response) => {
    try {
      const result = await db.update(inquiriesTable)
        .set({ status: "endorsed", updatedAt: new Date() })
        .where(eq(inquiriesTable.id, req.params.id))
        .returning();
      if (!result.length) return res.status(404).json({ error: "Inquiry not found" });
      res.json({ inquiry: result[0] });
    } catch (error: any) {
      console.error("❌ Endorse inquiry error:", error.message);
      res.status(500).json({ error: "Failed to endorse inquiry" });
    }
  });

  // POST /api/payments — creates a Stripe PaymentIntent for an endorsed inquiry.
  // Returns clientSecret so the frontend can confirm with Stripe Elements.
  // Status remains "endorsed" until PATCH /api/inquiries/:id/paid verifies the confirmed PI.
  app.post("/api/payments", async (req: Request, res: Response) => {
    try {
      const { inquiryId } = req.body;
      if (!inquiryId) return res.status(400).json({ error: "inquiryId is required" });

      const inquiryRows = await db.select().from(inquiriesTable)
        .where(eq(inquiriesTable.id, inquiryId)).limit(1);
      if (!inquiryRows.length) return res.status(404).json({ error: "Inquiry not found" });
      const inquiry = inquiryRows[0];

      if (inquiry.status !== "endorsed") {
        return res.status(400).json({ error: "Inquiry must be endorsed before payment can be taken" });
      }

      // Reject payment setup if no valid budget is on file
      if (!inquiry.estimatedBudget || isNaN(parseFloat(inquiry.estimatedBudget)) || parseFloat(inquiry.estimatedBudget) <= 0) {
        return res.status(400).json({
          error: "No quoted amount",
          message: "This inquiry does not have a valid estimated budget. Please contact hello@onspotglobal.com to receive a formal quote before payment.",
        });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({
          error: "Payment system not configured",
          message: "Stripe integration is not set up. Please contact hello@onspotglobal.com to arrange payment.",
        });
      }

      const Stripe = await import("stripe");
      const stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
      const amountCents = Math.round(parseFloat(inquiry.estimatedBudget) * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        description: `OnSpot Inquiry ${inquiry.referenceNumber} — ${inquiry.serviceNeeded}`,
        receipt_email: inquiry.email,
        // Store inquiryId in metadata so PATCH /paid can verify the PI belongs to this inquiry
        metadata: { inquiryId: inquiry.id, referenceNumber: inquiry.referenceNumber, email: inquiry.email },
      });

      // Persist PI id on the inquiry so /paid can verify the same PI is presented back
      await db.update(inquiriesTable)
        .set({ stripePaymentIntentId: paymentIntent.id, updatedAt: new Date() })
        .where(eq(inquiriesTable.id, inquiry.id));

      console.log(`✅ PaymentIntent created for inquiry ${inquiry.referenceNumber}:`, paymentIntent.id);
      res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
    } catch (error: any) {
      console.error("❌ Create PaymentIntent error:", error.message);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  // PATCH /api/inquiries/:id/paid — verifies the Stripe PaymentIntent status (server-side)
  // and marks the inquiry as paid only when the charge is confirmed by Stripe.
  app.patch("/api/inquiries/:id/paid", async (req: Request, res: Response) => {
    try {
      const { paymentIntentId } = req.body;
      if (!paymentIntentId) return res.status(400).json({ error: "paymentIntentId is required" });

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ error: "Payment system not configured" });
      }

      // Fetch inquiry first to verify the PI belongs to it
      const inquiryRows = await db.select().from(inquiriesTable)
        .where(eq(inquiriesTable.id, req.params.id)).limit(1);
      if (!inquiryRows.length) return res.status(404).json({ error: "Inquiry not found" });
      const inquiry = inquiryRows[0];

      // Reject if a different PI id was presented (prevents cross-inquiry reuse)
      if (inquiry.stripePaymentIntentId !== paymentIntentId) {
        return res.status(400).json({
          error: "Payment intent mismatch",
          message: "The provided PaymentIntent does not match the one issued for this inquiry.",
        });
      }

      const Stripe = await import("stripe");
      const stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // Verify PI belongs to this inquiry via metadata
      if (paymentIntent.metadata?.inquiryId !== req.params.id) {
        return res.status(400).json({
          error: "Payment intent binding mismatch",
          message: "PaymentIntent metadata does not match this inquiry.",
        });
      }

      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({
          error: "Payment not confirmed",
          message: `Stripe PaymentIntent status is '${paymentIntent.status}', expected 'succeeded'.`,
        });
      }

      const result = await db.update(inquiriesTable)
        .set({ status: "paid", stripePaymentIntentId: paymentIntentId, paidAt: new Date(), updatedAt: new Date() })
        .where(eq(inquiriesTable.id, req.params.id))
        .returning();

      if (!result.length) return res.status(404).json({ error: "Inquiry not found" });
      console.log(`✅ Inquiry ${req.params.id} marked as paid via PI ${paymentIntentId}`);
      res.json({ success: true, inquiry: result[0] });
    } catch (error: any) {
      console.error("❌ Confirm payment error:", error.message);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  });

  // ======
  // Admin Inquiry Routes
  // GET  /api/inquiries           — list all (TODO: protect with admin auth before production)
  // PATCH /api/inquiries/:id/status — update status / payment method
  // PATCH /api/inquiries/:id/notes  — update admin notes
  // ======

  app.get("/api/inquiries", async (req: Request, res: Response) => {
    try {
      const { page, pageSize } = parsePagination(req.query);
      const all = await db
        .select()
        .from(inquiriesTable)
        .orderBy(desc(inquiriesTable.createdAt));
      const { items, meta } = pageSlice(all, page, pageSize);
      res.json({ inquiries: items, meta });
    } catch (error: any) {
      console.error("❌ List inquiries error:", error.message);
      res.status(500).json({ error: "Failed to fetch inquiries" });
    }
  });

  app.patch("/api/inquiries/:id/status", async (req: Request, res: Response) => {
    try {
      const { status, paymentMethod } = req.body as { status?: string; paymentMethod?: string };
      if (!status) return res.status(400).json({ error: "status is required" });
      const updatePayload: Record<string, unknown> = { status, updatedAt: new Date() };
      if (paymentMethod !== undefined) updatePayload.paymentMethod = paymentMethod;
      if (status === "paid") updatePayload.paidAt = new Date();
      const result = await db
        .update(inquiriesTable)
        .set(updatePayload as any)
        .where(eq(inquiriesTable.id, req.params.id))
        .returning();
      if (!result.length) return res.status(404).json({ error: "Inquiry not found" });
      res.json({ inquiry: result[0] });
    } catch (error: any) {
      console.error("❌ Update inquiry status error:", error.message);
      res.status(500).json({ error: "Failed to update inquiry status" });
    }
  });

  app.patch("/api/inquiries/:id/notes", async (req: Request, res: Response) => {
    try {
      const { adminNotes } = req.body as { adminNotes: string };
      const result = await db
        .update(inquiriesTable)
        .set({ adminNotes, updatedAt: new Date() })
        .where(eq(inquiriesTable.id, req.params.id))
        .returning();
      if (!result.length) return res.status(404).json({ error: "Inquiry not found" });
      res.json({ inquiry: result[0] });
    } catch (error: any) {
      console.error("❌ Update inquiry notes error:", error.message);
      res.status(500).json({ error: "Failed to update notes" });
    }
  });

  // PATCH /api/inquiries/:id/payment — record payment details (manual or Stripe)
  app.patch("/api/inquiries/:id/payment", async (req: Request, res: Response) => {
    try {
      const {
        paymentStatus,   // "paid" | "payment_pending" | "completed"
        paymentMethod,   // "stripe" | "manual"
        paymentAmount,   // number (USD)
        transactionReference, // Stripe PI id or manual reference
        receiptUrl,      // optional URL to receipt
      } = req.body as {
        paymentStatus?: string;
        paymentMethod?: string;
        paymentAmount?: number;
        transactionReference?: string;
        receiptUrl?: string;
      };

      const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
      if (paymentStatus) {
        updatePayload.status = paymentStatus;
        if (paymentStatus === "paid" || paymentStatus === "completed") {
          updatePayload.paidAt = new Date();
        }
      }
      if (paymentMethod !== undefined) updatePayload.paymentMethod = paymentMethod;
      if (paymentAmount !== undefined) updatePayload.paymentAmount = String(paymentAmount);
      if (transactionReference !== undefined) updatePayload.transactionReference = transactionReference;
      if (receiptUrl !== undefined) updatePayload.receiptUrl = receiptUrl;

      const result = await db
        .update(inquiriesTable)
        .set(updatePayload as any)
        .where(eq(inquiriesTable.id, req.params.id))
        .returning();
      if (!result.length) return res.status(404).json({ error: "Inquiry not found" });
      console.log(`✅ Payment recorded for inquiry ${req.params.id}`);
      res.json({ inquiry: result[0] });
    } catch (error: any) {
      console.error("❌ Record payment error:", error.message);
      res.status(500).json({ error: "Failed to record payment" });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/inquiries/:id/payment-confirmation
  // Client uploads QR payment proof; sets paymentStatus = pending_verification
  // ─────────────────────────────────────────────────────────────
  app.post(
    "/api/inquiries/:id/payment-confirmation",
    upload.single("proofFile"),
    async (req: Request, res: Response) => {
      try {
        const inquiryId = req.params.id;

        const paymentReferenceNumber = (req.body.paymentReferenceNumber ?? "").trim();
        const paymentNotes = (req.body.paymentNotes ?? "").trim();
        const file = (req as any).file as Express.Multer.File | undefined;

        if (!paymentReferenceNumber && !file) {
          return res.status(400).json({
            error: "Please provide a payment reference number or upload proof of payment.",
          });
        }

        let paymentProofUrl: string | null = null;
        let paymentProofFilename: string | null = null;

        if (file) {
          const ext = path.extname(file.originalname) || "";
          const filename = `${randomUUID()}${ext}`;
          const proofDir = path.join(process.cwd(), "public", "payment-proofs");
          fs.mkdirSync(proofDir, { recursive: true });
          fs.writeFileSync(path.join(proofDir, filename), file.buffer);
          paymentProofUrl = `/payment-proofs/${filename}`;
          paymentProofFilename = file.originalname;
        }

        const result = await db
          .update(inquiriesTable)
          .set({
            paymentStatus: "pending_verification",
            paymentReferenceNumber: paymentReferenceNumber || null,
            paymentProofUrl,
            paymentProofFilename,
            paymentNotes: paymentNotes || null,
            paymentConfirmationSubmittedAt: new Date(),
            updatedAt: new Date(),
          } as any)
          .where(eq(inquiriesTable.id, inquiryId))
          .returning();

        if (!result.length) return res.status(404).json({ error: "Inquiry not found" });
        console.log(`📤 Payment confirmation submitted for inquiry ${inquiryId}`);
        return res.json({ inquiry: result[0] });
      } catch (error: any) {
        console.error("❌ Payment confirmation error:", error.message);
        return res.status(500).json({ error: "Failed to record payment confirmation" });
      }
    }
  );

  // PATCH /api/inquiries/:id/payment/verify — admin marks payment as verified
  app.patch("/api/inquiries/:id/payment/verify", async (req: Request, res: Response) => {
    try {
      const inquiryId = req.params.id;
      const { adminPaymentNotes } = req.body;

      const result = await db
        .update(inquiriesTable)
        .set({
          paymentStatus: "verified",
          status: "paid",
          paidAt: new Date(),
          paymentVerifiedAt: new Date(),
          adminPaymentNotes: adminPaymentNotes ?? null,
          updatedAt: new Date(),
        } as any)
        .where(eq(inquiriesTable.id, inquiryId))
        .returning();

      if (!result.length) return res.status(404).json({ error: "Inquiry not found" });
      console.log(`✅ Payment verified for inquiry ${inquiryId}`);
      return res.json({ inquiry: result[0] });
    } catch (error: any) {
      console.error("❌ Payment verify error:", error.message);
      return res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  // PATCH /api/inquiries/:id/payment/reject — admin rejects payment confirmation
  app.patch("/api/inquiries/:id/payment/reject", async (req: Request, res: Response) => {
    try {
      const inquiryId = req.params.id;
      const { adminPaymentNotes } = req.body;

      const result = await db
        .update(inquiriesTable)
        .set({
          paymentStatus: "rejected",
          paymentRejectedAt: new Date(),
          adminPaymentNotes: adminPaymentNotes ?? null,
          updatedAt: new Date(),
        } as any)
        .where(eq(inquiriesTable.id, inquiryId))
        .returning();

      if (!result.length) return res.status(404).json({ error: "Inquiry not found" });
      console.log(`❌ Payment rejected for inquiry ${inquiryId}`);
      return res.json({ inquiry: result[0] });
    } catch (error: any) {
      console.error("❌ Payment reject error:", error.message);
      return res.status(500).json({ error: "Failed to reject payment" });
    }
  });

  // ======
  // Blog Posts API (Insights page) - No Auth Required
  // Publishing, editing, and deleting posts
  // ======

  // Validation schema for creating posts
  const createPostSchema = z.object({
    title: z.string().min(1, "Title is required"),
    slug: z.string().min(1, "Slug is required").max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
    excerpt: z.string().min(1, "Excerpt is required"),
    content: z.string().optional().default(""),
    coverImageUrl: z.string().optional().nullable(),
    category: z.string().min(1, "Category is required"),
    author: z.string().min(1, "Author is required"),
    isFeatured: z.boolean().optional().default(false),
    status: z.enum(["draft", "published"]).optional().default("draft"),
    readTime: z.string().optional().nullable(),
    likes: z.number().optional().default(0),
    publishedAt: z.coerce.date().optional().nullable(),
  });

  // Supported categories — kept in sync with the public Insights filter tabs
  const VALID_CATEGORIES = [
    "CEO Insights",
    "Talent Insights",
    "Client Insights",
    "Industry Insights",
    "Learning Centre",
    "Podcast Videos",
  ] as const;

  // Validation schema for updating posts (all fields optional for partial updates).
  // category uses a transform so that legacy / empty-string values from older posts
  // don't cause a hard validation failure — they're normalised to a valid category
  // or dropped from the update payload when empty.
  const updatePostSchema = z.object({
    title: z.string().min(1).optional(),
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
    excerpt: z.string().min(1).optional(),
    content: z.string().optional(),
    coverImageUrl: z.string().optional().nullable(),
    category: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || !val.trim()) return undefined; // treat empty as "not provided"
        const trimmed = val.trim();
        if ((VALID_CATEGORIES as readonly string[]).includes(trimmed)) return trimmed;
        // Best-effort normalisation for legacy values
        const lower = trimmed.toLowerCase();
        if (lower.includes("ceo") || lower.includes("founder")) return "CEO Insights";
        if (lower.includes("talent") || lower.includes("freelanc")) return "Talent Insights";
        if (lower.includes("client") || lower.includes("customer")) return "Client Insights";
        if (lower.includes("podcast") || lower.includes("video")) return "Podcast Videos";
        if (lower.includes("learn") || lower.includes("guide")) return "Learning Centre";
        return "Industry Insights"; // safe default for any unknown legacy value
      }),
    author: z.string().optional().transform((v) => (v && v.trim() ? v.trim() : undefined)),
    isFeatured: z.boolean().optional(),
    showOnHomepage: z.boolean().optional(),
    homepageOrder: z.number().int().nullable().optional(),
    status: z.enum(["draft", "published"]).optional(),
    readTime: z.string().optional().nullable(),
    likes: z.number().optional(),
    publishedAt: z.coerce.date().optional().nullable(),
  });

  // GET /public/blog-images/:filename - Serve blog images publicly (no auth required)
  // This proxies images from Object Storage to avoid GCS public access issues
  app.get("/public/blog-images/:filename", async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const requestId = (req as any).requestId || "unknown";
      
      // Security: validate filename format (only allow safe characters)
      if (!/^cover-[a-f0-9-]+\.(jpg|jpeg|png|gif|webp|avif)$/i.test(filename)) {
        return res.status(400).json({ error: "Invalid filename format" });
      }

      // Get public directory from Object Storage config
      const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",") || [];
      if (publicPaths.length === 0) {
        return res.status(500).json({ error: "Object storage not configured" });
      }

      const publicDir = publicPaths[0].trim();
      const fullPath = `${publicDir}/blog-images/${filename}`;
      
      // Parse bucket and object path
      const pathParts = fullPath.split("/").filter(Boolean);
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");

      const bucket = objectStorageClient.bucket(bucketName);
      const blob = bucket.file(objectName);

      // Check if file exists
      const [exists] = await blob.exists();
      if (!exists) {
        console.log(`❌ [PUBLIC] Blog image not found [${requestId}]: ${filename}`);
        return res.status(404).json({ error: "Image not found" });
      }

      // Get metadata and stream the file
      const [metadata] = await blob.getMetadata();
      
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size?.toString() || "",
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      });

      const stream = blob.createReadStream();
      stream.on("error", (err) => {
        console.error(`❌ [PUBLIC] Stream error [${requestId}]:`, err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
      
      stream.pipe(res);
    } catch (error: any) {
      console.error(`❌ [PUBLIC] Blog image error:`, error.message);
      res.status(500).json({ error: "Failed to serve image" });
    }
  });

  // GET /api/posts - Fetch published posts (for public display)
  app.get("/api/posts", async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      const { category, featured } = req.query;

      console.log(`📰 Fetching posts [${requestId}]:`, { category, featured });

      const posts = await storage.listPublishedPosts({
        category: category as string | undefined,
        featured: featured === "true" ? true : undefined,
      });

      res.json({ success: true, posts });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Error fetching posts [${requestId}]:`, error.message);
      res.status(500).json({
        error: "Failed to fetch posts",
        message: error.message,
        requestId,
      });
    }
  });

  // GET /api/posts/homepage - Return up to 3 explicitly selected homepage posts
  app.get("/api/posts/homepage", async (req: Request, res: Response) => {
    try {
      const posts = await storage.listHomepagePosts();
      res.json({ success: true, posts });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch homepage posts", message: error.message });
    }
  });

  // GET /api/posts/all - Admin endpoint to fetch all posts including drafts
  app.get("/api/posts/all", async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      console.log(`📰 Fetching all posts including drafts [${requestId}]`);
      
      const posts = await storage.listAllPosts();
      res.json({ success: true, posts });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Error fetching all posts [${requestId}]:`, error.message);
      res.status(500).json({
        error: "Failed to fetch posts",
        message: error.message,
        requestId,
      });
    }
  });

  // GET /api/posts/:id - Fetch single post by ID
  app.get("/api/posts/:id", async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      const { id } = req.params;

      console.log(`📰 Fetching post [${requestId}]: ${id}`);

      const post = await storage.getPost(id);
      if (!post) {
        return res.status(404).json({
          error: "Post not found",
          requestId,
        });
      }

      res.json({ success: true, post });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Error fetching post [${requestId}]:`, error.message);
      res.status(500).json({
        error: "Failed to fetch post",
        message: error.message,
        requestId,
      });
    }
  });

  // GET /api/posts/slug/:slug - Fetch single post by slug (for blog detail page)
  app.get("/api/posts/slug/:slug", async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      const { slug } = req.params;

      console.log(`📰 Fetching post by slug [${requestId}]: ${slug}`);

      const post = await storage.getPostBySlug(slug);
      if (!post) {
        return res.status(404).json({
          error: "Post not found",
          requestId,
        });
      }

      res.json({ success: true, post });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Error fetching post by slug [${requestId}]:`, error.message);
      res.status(500).json({
        error: "Failed to fetch post",
        message: error.message,
        requestId,
      });
    }
  });

  // POST /api/posts/:id/view - Increment view count
  app.post("/api/posts/:id/view", async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      const { id } = req.params;

      const views = await storage.incrementPostViews(id);
      console.log(`👁 View recorded [${requestId}]: post ${id}, views: ${views}`);
      res.json({ success: true, views });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Error incrementing views [${requestId}]:`, error.message);
      res.status(500).json({ error: "Failed to record view", requestId });
    }
  });

  // POST /api/posts/:id/like - Increment like count
  app.post("/api/posts/:id/like", async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      const { id } = req.params;

      const likes = await storage.incrementPostLikes(id);
      console.log(`❤️ Like recorded [${requestId}]: post ${id}, likes: ${likes}`);
      res.json({ success: true, likes });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Error incrementing likes [${requestId}]:`, error.message);
      res.status(500).json({ error: "Failed to record like", requestId });
    }
  });

  // POST /api/posts - Create new post (PUBLISH)
  app.post("/api/posts", async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;

      // Validate request body with Zod
      const parseResult = createPostSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errors = parseResult.error.flatten();
        console.error(`❌ Validation error [${requestId}]:`, errors);
        return res.status(400).json({
          error: "Validation failed",
          message: "Invalid post data",
          details: errors.fieldErrors,
          requestId,
        });
      }

      const postData = parseResult.data;

      console.log(`📝 Creating new post [${requestId}]:`, {
        title: postData.title,
        slug: postData.slug,
        status: postData.status,
      });

      // Check for duplicate slug
      const existingPost = await storage.getPostBySlug(postData.slug);
      if (existingPost) {
        return res.status(409).json({
          error: "Slug already exists",
          message: "A post with this slug already exists",
          requestId,
        });
      }

      // Set published date if status is published
      if (postData.status === "published" && !postData.publishedAt) {
        postData.publishedAt = new Date();
      }

      const newPost = await storage.createPost(postData);

      console.log(`✅ Post created [${requestId}]:`, {
        id: newPost.id,
        slug: newPost.slug,
      });

      res.status(201).json({ success: true, post: newPost });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Error creating post [${requestId}]:`, error.message);
      res.status(500).json({
        error: "Failed to create post",
        message: error.message,
        requestId,
      });
    }
  });

  // PUT /api/posts/:id - Update existing post (EDIT)
  app.put("/api/posts/:id", async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      const { id } = req.params;

      // Validate request body with Zod
      const parseResult = updatePostSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errors = parseResult.error.flatten();
        console.error(`❌ Validation error [${requestId}]:`, errors);
        return res.status(400).json({
          error: "Validation failed",
          message: "Invalid post data",
          details: errors.fieldErrors,
          requestId,
        });
      }

      const updates = parseResult.data;

      console.log(`✏️ Updating post [${requestId}]: ${id}`);

      // Check post exists
      const existingPost = await storage.getPost(id);
      if (!existingPost) {
        return res.status(404).json({
          error: "Post not found",
          requestId,
        });
      }

      // If changing slug, check for duplicates
      if (updates.slug && updates.slug !== existingPost.slug) {
        const slugPost = await storage.getPostBySlug(updates.slug);
        if (slugPost) {
          return res.status(409).json({
            error: "Slug already exists",
            message: "A post with this slug already exists",
            requestId,
          });
        }
      }

      // Set published date if status is changing to published
      if (updates.status === "published" && existingPost.status !== "published" && !updates.publishedAt) {
        updates.publishedAt = new Date();
      }

      const updatedPost = await storage.updatePost(id, updates);

      console.log(`✅ Post updated [${requestId}]:`, {
        id: updatedPost?.id,
        slug: updatedPost?.slug,
      });

      res.json({ success: true, post: updatedPost });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Error updating post [${requestId}]:`, error.message);
      res.status(500).json({
        error: "Failed to update post",
        message: error.message,
        requestId,
      });
    }
  });

  // DELETE /api/posts/:id - Delete post
  app.delete("/api/posts/:id", async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      const { id } = req.params;

      console.log(`🗑️ Deleting post [${requestId}]: ${id}`);

      const deleted = await storage.deletePost(id);
      if (!deleted) {
        return res.status(404).json({
          error: "Post not found",
          requestId,
        });
      }

      console.log(`✅ Post deleted [${requestId}]: ${id}`);

      res.json({ success: true, message: "Post deleted successfully" });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ Error deleting post [${requestId}]:`, error.message);
      res.status(500).json({
        error: "Failed to delete post",
        message: error.message,
        requestId,
      });
    }
  });

  // ======
  // ADMIN POSTS ROUTES
  // TODO: Add authentication middleware when login system is complete
  // ======

  // GET /api/admin/posts - Admin endpoint to fetch all posts (draft + published)
  app.get("/api/admin/posts", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      console.log(`📰 [ADMIN] Fetching all posts [${requestId}]`);
      
      const posts = await storage.listAllPosts();
      res.json({ success: true, posts });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ [ADMIN] Error fetching posts [${requestId}]:`, error.message);
      res.status(500).json({
        error: "Failed to fetch posts",
        message: error.message,
        requestId,
      });
    }
  });

  // POST /api/admin/posts - Admin create new post
  app.post("/api/admin/posts", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;

      const parseResult = createPostSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errors = parseResult.error.flatten();
        console.error(`❌ [ADMIN] Validation error [${requestId}]:`, errors);
        return res.status(400).json({
          error: "Validation failed",
          message: "Invalid post data",
          details: errors.fieldErrors,
          requestId,
        });
      }

      const postData = parseResult.data;

      console.log(`📝 [ADMIN] Creating new post [${requestId}]:`, {
        title: postData.title,
        slug: postData.slug,
        status: postData.status,
      });

      const existingPost = await storage.getPostBySlug(postData.slug);
      if (existingPost) {
        return res.status(409).json({
          error: "Slug already exists",
          message: "A post with this slug already exists",
          requestId,
        });
      }

      if (postData.status === "published" && !postData.publishedAt) {
        postData.publishedAt = new Date();
      }

      const newPost = await storage.createPost(postData);

      console.log(`✅ [ADMIN] Post created [${requestId}]:`, {
        id: newPost.id,
        slug: newPost.slug,
      });

      res.status(201).json({ success: true, post: newPost });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ [ADMIN] Error creating post [${requestId}]:`, error.message);
      res.status(500).json({
        error: "Failed to create post",
        message: error.message,
        requestId,
      });
    }
  });

  // GET /api/admin/posts/:id - Admin get single post
  app.get("/api/admin/posts/:id", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      const { id } = req.params;

      const post = await storage.getPost(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          error: "Post not found",
          requestId,
        });
      }

      console.log(`✅ [ADMIN] Fetched post [${requestId}]: ${post.title}`);
      return res.json({
        success: true,
        post,
        requestId,
      });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ [ADMIN] Error fetching post [${requestId}]:`, error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch post",
        message: error.message,
        requestId,
      });
    }
  });

  // PUT /api/admin/posts/:id - Admin update post
  app.put("/api/admin/posts/:id", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      const { id } = req.params;

      const parseResult = updatePostSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errors = parseResult.error.flatten();
        console.error(`❌ [ADMIN] Validation error [${requestId}]:`, errors);
        return res.status(400).json({
          error: "Validation failed",
          message: "Invalid post data",
          details: errors.fieldErrors,
          requestId,
        });
      }

      const updates = parseResult.data;

      // Log the full update payload to trace image URL persistence
      console.log(`✏️ [ADMIN] Updating post [${requestId}]: ${id}`, {
        coverImageUrl: updates.coverImageUrl,
        hasImage: !!updates.coverImageUrl,
        updateFields: Object.keys(updates),
      });

      const existingPost = await storage.getPost(id);
      if (!existingPost) {
        return res.status(404).json({
          error: "Post not found",
          requestId,
        });
      }

      if (updates.slug && updates.slug !== existingPost.slug) {
        const slugPost = await storage.getPostBySlug(updates.slug);
        if (slugPost) {
          return res.status(409).json({
            error: "Slug already exists",
            message: "A post with this slug already exists",
            requestId,
          });
        }
      }

      if (updates.status === "published" && existingPost.status !== "published" && !updates.publishedAt) {
        updates.publishedAt = new Date();
      }

      const updatedPost = await storage.updatePost(id, updates);

      console.log(`✅ [ADMIN] Post updated [${requestId}]:`, {
        id: updatedPost?.id,
        slug: updatedPost?.slug,
      });

      res.json({ success: true, post: updatedPost });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ [ADMIN] Error updating post [${requestId}]:`, error.message);
      res.status(500).json({
        error: "Failed to update post",
        message: error.message,
        requestId,
      });
    }
  });

  // DELETE /api/admin/posts/:id - Admin delete post
  app.delete("/api/admin/posts/:id", authenticateJWT, requireAdmin, async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      const { id } = req.params;

      console.log(`🗑️ [ADMIN] Deleting post [${requestId}]: ${id}`);

      const deleted = await storage.deletePost(id);
      if (!deleted) {
        return res.status(404).json({
          error: "Post not found",
          requestId,
        });
      }

      console.log(`✅ [ADMIN] Post deleted [${requestId}]: ${id}`);

      res.json({ success: true, message: "Post deleted successfully" });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ [ADMIN] Error deleting post [${requestId}]:`, error.message);
      res.status(500).json({
        error: "Failed to delete post",
        message: error.message,
        requestId,
      });
    }
  });

  // ======
  // POST /api/admin/upload-image - Upload cover image for blog posts
  // Uses Replit Object Storage to store images and returns a public URL
  // 
  // NOTE: This endpoint is temporarily unauthenticated to match other admin routes.
  // TODO: Add authentication middleware when login system is complete.
  // ======
  const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max file size
    },
    fileFilter: (_req, file, cb) => {
      // Validate image file types
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, GIF, WebP, AVIF`));
      }
    },
  });

  app.post("/api/admin/upload-image", imageUpload.single("image"), async (req: Request, res: Response) => {
    try {
      const requestId = (req as any).requestId;
      console.log(`📤 [ADMIN] Image upload request [${requestId}]`);

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          error: "No image file provided",
          message: "Please select an image file to upload",
          requestId,
        });
      }

      const file = req.file;
      console.log(`📤 [ADMIN] Processing image [${requestId}]:`, {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: `${(file.size / 1024).toFixed(1)}KB`,
      });

      // Generate unique filename with original extension
      const ext = file.originalname.split(".").pop() || "jpg";
      const uniqueFilename = `cover-${uuidv4()}.${ext}`;

      // Get public directory from Object Storage config
      const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(",") || [];
      if (publicPaths.length === 0) {
        throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not configured");
      }

      // Use the first public path for uploads
      const publicDir = publicPaths[0].trim();
      const fullPath = `${publicDir}/blog-images/${uniqueFilename}`;

      // Parse bucket and object path
      const pathParts = fullPath.split("/").filter(Boolean);
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");

      // Upload to Object Storage
      const bucket = objectStorageClient.bucket(bucketName);
      const blob = bucket.file(objectName);

      await blob.save(file.buffer, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Use our proxy endpoint for public access (GCS blocks direct public access)
      const proxyUrl = `/public/blog-images/${uniqueFilename}`;

      console.log(`✅ [ADMIN] Image uploaded successfully [${requestId}]:`, {
        filename: uniqueFilename,
        proxyUrl,
      });

      res.json({
        success: true,
        proxyUrl: proxyUrl,
        filename: uniqueFilename,
      });
    } catch (error: any) {
      const requestId = (req as any).requestId;
      console.error(`❌ [ADMIN] Image upload failed [${requestId}]:`, error.message);
      res.status(500).json({
        error: "Failed to upload image",
        message: error.message,
        requestId,
      });
    }
  });

  // ── Client Profile ────────────────────────────────────────────────────────
  // Helper: map snake_case client_profiles row → camelCase
  const mapClientProfileRow = (row: any) => ({
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name ?? null,
    contactPerson: row.contact_person ?? null,
    email: row.email ?? null,
    phoneNumber: row.phone_number ?? null,
    website: row.website ?? null,
    industry: row.industry ?? null,
    companySize: row.company_size ?? null,
    location: row.location ?? null,
    about: row.about ?? null,
    hiringNeeds: row.hiring_needs ?? null,
    preferredRoles: row.preferred_roles ?? [],
    timezone: row.timezone ?? null,
    msaAcceptedAt: row.msa_accepted_at ?? null,
    msaVersion: row.msa_version ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
  const CURRENT_MSA_VERSION = "2026-08-14";
  const CLIENT_TERMS_URL = "/terms-and-conditions";

  // ── Client Organizations ──────────────────────────────────────────────────
  // Organization membership is the authorization boundary for organization
  // reads. It does not replace the existing user/client-profile relationships.
  const optionalOrganizationText = (maxLength: number) =>
    z.string().trim().max(maxLength).optional().or(z.literal(""));
  const createOrganizationPayloadSchema = z.object({
    name: z.string().trim().min(1, "Organization name is required").max(200),
    website: optionalOrganizationText(2048),
    industry: optionalOrganizationText(120),
    companySize: optionalOrganizationText(80),
    location: optionalOrganizationText(200),
    about: optionalOrganizationText(5000),
    timezone: optionalOrganizationText(120),
  }).strict();

  const mapOrganizationRow = (row: any) => ({
    id: row.id,
    name: row.name,
    website: row.website ?? null,
    industry: row.industry ?? null,
    companySize: row.company_size ?? null,
    location: row.location ?? null,
    about: row.about ?? null,
    timezone: row.timezone ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleteRequestedAt: row.delete_requested_at ?? null,
    deleteRequestedBy: row.delete_requested_by ?? null,
    deleteDueAt: row.delete_due_at ?? null,
  });

  const mapOrganizationMembership = (row: any) => ({
    id: row.membership_id,
    organizationId: row.organization_id,
    role: row.membership_role,
    status: row.membership_status,
    joinedAt: row.joined_at,
  });

  const mapOrganizationInvitation = (row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name ?? undefined,
    email: row.email,
    status: row.status,
    emailStatus: row.email_status ?? "pending",
    emailError: row.email_error ?? null,
    emailSentAt: row.email_sent_at ?? null,
    invitedBy: row.invited_by,
    inviterName: row.inviter_name ?? null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    respondedAt: row.responded_at ?? null,
  });

  const organizationInvitationStatuses = ["pending", "expired", "accepted", "declined", "revoked"] as const;
  const organizationInvitationStatusSchema = z.enum(organizationInvitationStatuses).optional();

  const getActiveOrganizationMembership = async (organizationId: string, userId: string) => {
    const result = await query(
      `SELECT om.id, om.organization_id, om.user_id, om.role, om.status
         FROM organization_members om
        WHERE om.organization_id = $1 AND om.user_id = $2 AND om.status = 'active'
        LIMIT 1`,
      [organizationId, userId],
    );
    return result.rows[0] ?? null;
  };

  const requireOrganizationOwner = async (organizationId: string, userId: string) => {
    const membership = await getActiveOrganizationMembership(organizationId, userId);
    return membership?.role === "owner" ? membership : null;
  };

  app.post("/api/organizations", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const payload = createOrganizationPayloadSchema.parse(req.body ?? {});
      const dbClient = await getClient();

      try {
        await dbClient.query("BEGIN");
        const organizationResult = await dbClient.query(
          `INSERT INTO organizations
             (name, website, industry, company_size, location, about, timezone, created_by)
           VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), $8)
           RETURNING *`,
          [
            payload.name,
            payload.website ?? "",
            payload.industry ?? "",
            payload.companySize ?? "",
            payload.location ?? "",
            payload.about ?? "",
            payload.timezone ?? "",
            userId,
          ],
        );
        const organization = organizationResult.rows[0];

        const membershipResult = await dbClient.query(
          `INSERT INTO organization_members
             (organization_id, user_id, role, status)
           VALUES ($1, $2, 'owner', 'active')
           RETURNING id, organization_id, user_id, role, status, joined_at`,
          [organization.id, userId],
        );

        await dbClient.query("COMMIT");
        return res.status(201).json({
          organization: mapOrganizationRow(organization),
          membership: {
            id: membershipResult.rows[0].id,
            organizationId: membershipResult.rows[0].organization_id,
            userId: membershipResult.rows[0].user_id,
            role: membershipResult.rows[0].role,
            status: membershipResult.rows[0].status,
            joinedAt: membershipResult.rows[0].joined_at,
          },
        });
      } catch (transactionError) {
        await dbClient.query("ROLLBACK").catch(() => {});
        throw transactionError;
      } finally {
        dbClient.release();
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: err.errors,
        });
      }
      console.error("POST /api/organizations failed:", err);
      return res.status(500).json({ error: "Failed to create organization" });
    }
  });

  app.get("/api/organizations/me", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const result = await query(
        `SELECT o.*, om.id AS membership_id, om.organization_id,
                om.role AS membership_role, om.status AS membership_status,
                om.joined_at
           FROM organizations o
           INNER JOIN organization_members om ON om.organization_id = o.id
          WHERE om.user_id = $1 AND om.status = 'active'
          ORDER BY o.created_at DESC`,
        [userId],
      );
      return res.json(result.rows.map((row: any) => ({
        organization: mapOrganizationRow(row),
        membership: mapOrganizationMembership(row),
      })));
    } catch (err: any) {
      console.error("GET /api/organizations/me failed:", err);
      return res.status(500).json({ error: "Failed to load organizations" });
    }
  });

  app.get("/api/organizations/:organizationId", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const result = await query(
        `SELECT o.*, om.id AS membership_id, om.organization_id,
                om.role AS membership_role, om.status AS membership_status,
                om.joined_at
           FROM organizations o
           INNER JOIN organization_members om ON om.organization_id = o.id
          WHERE o.id = $1 AND om.user_id = $2 AND om.status = 'active'
          LIMIT 1`,
        [req.params.organizationId, userId],
      );
      if (!result.rows.length) return res.status(404).json({ error: "Organization not found" });
      const row = result.rows[0];
      return res.json({
        organization: mapOrganizationRow(row),
        membership: mapOrganizationMembership(row),
      });
    } catch (err: any) {
      console.error("GET /api/organizations/:organizationId failed:", err);
      return res.status(500).json({ error: "Failed to load organization" });
    }
  });

  // Team membership is managed separately from the existing individual Client
  // account. Only an active organization owner can invite, revoke, or remove.
  app.get("/api/organizations/:organizationId/members", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const requestedStatus = req.query.status === "" ? undefined : req.query.status;
      const statusResult = organizationInvitationStatusSchema.safeParse(requestedStatus);
      if (!statusResult.success) {
        return res.status(400).json({
          error: "Invalid invitation status",
          details: `status must be one of: ${organizationInvitationStatuses.join(", ")}`,
        });
      }
      const invitationStatus = statusResult.data;
      const membership = await getActiveOrganizationMembership(req.params.organizationId, userId);
      if (!membership) return res.status(404).json({ error: "Organization not found" });
      await expireOrganizationInvitations();

      const membersResult = await query(
        `SELECT om.id, om.organization_id, om.user_id, om.role, om.status,
                om.joined_at, u.email, u.first_name, u.last_name, u.company
           FROM organization_members om
           INNER JOIN users u ON u.id = om.user_id
          WHERE om.organization_id = $1 AND om.status = 'active'
          ORDER BY CASE WHEN om.role = 'owner' THEN 0 ELSE 1 END, om.joined_at ASC`,
        [req.params.organizationId],
      );

      const invitationsResult = membership.role === "owner"
        ? await query(
          `SELECT oi.*, o.name AS organization_name,
                  TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS inviter_name
             FROM organization_invitations oi
             INNER JOIN organizations o ON o.id = oi.organization_id
             INNER JOIN users u ON u.id = oi.invited_by
            WHERE oi.organization_id = $1
              ${invitationStatus ? "AND oi.status = $2" : ""}
            ORDER BY oi.created_at DESC`,
          invitationStatus ? [req.params.organizationId, invitationStatus] : [req.params.organizationId],
        )
        : { rows: [] };

      return res.json({
        canManage: membership.role === "owner",
        members: membersResult.rows.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          role: row.role,
          status: row.status,
          joinedAt: row.joined_at,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          company: row.company,
        })),
        invitations: invitationsResult.rows.map(mapOrganizationInvitation),
      });
    } catch (err: any) {
      console.error("GET organization members failed:", err);
      return res.status(500).json({ error: "Failed to load organization members" });
    }
  });

  const organizationInvitationSchema = z.object({
    email: z.string().trim().email("Enter a valid email address").max(320),
  }).strict();

  type OrganizationInvitationCreationResult =
    | { invitation: ReturnType<typeof mapOrganizationInvitation> }
    | { error: string; status: number };

  // Build a secure raw+hash token pair for tokenized invitation links.
  const generateOrganizationInvitationToken = () => {
    const raw = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(raw).digest("hex");
    return { raw, hash };
  };

  const deliverOrganizationInvitation = async ({
    invitation,
    invitationRawToken,
    organizationName,
    inviterName,
    recipientName,
  }: {
    invitation: any;
    invitationRawToken?: string;
    organizationName: string;
    inviterName: string;
    recipientName?: string | null;
  }) => {
    let emailStatus = "failed";
    let emailError = "Invitation email could not be sent.";
    try {
      const rawBase =
        process.env.PUBLIC_APP_URL ??
        process.env.APP_URL ??
        process.env.PUBLIC_BASE_URL ??
        (process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
          : null);
      if (!rawBase) {
        throw new Error("No public application URL is configured.");
      }
      const baseUrl = rawBase.replace(/\/$/, "");
      // Use tokenized URL when available; fall back to generic sign-in URL.
      const signInUrl = invitationRawToken
        ? `${baseUrl}/organization-invite/${encodeURIComponent(invitationRawToken)}`
        : `${baseUrl}/sign-in?portal=client&email=${encodeURIComponent(invitation.email)}&returnTo=${encodeURIComponent("/organization-invitations")}`;
      const { isEmailServiceConfigured, sendOrganizationInvitationEmail } =
        await import("./services/microsoftGraphEmailService.ts");
      if (!isEmailServiceConfigured()) {
        throw new Error("Microsoft Graph email service is not configured.");
      }

      const emailResult = await sendOrganizationInvitationEmail({
        to: invitation.email,
        organizationName,
        inviterName,
        recipientName,
        signInUrl,
      });
      if (!emailResult.success) {
        throw new Error(emailResult.error || "The email provider rejected the invitation.");
      }
      emailStatus = "sent";
      emailError = "";
    } catch (emailErr: any) {
      emailError = emailErr?.message || "The invitation email could not be sent.";
      console.warn(`Organization invitation email failed for ${invitation.email}:`, emailError);
    }

    const deliveryUpdate = await query(
      `UPDATE organization_invitations
          SET email_status = $1,
              email_error = $2,
              email_sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE NULL END,
              updated_at = NOW()
        WHERE id = $3
        RETURNING *`,
      [emailStatus, emailStatus === "sent" ? null : emailError.slice(0, 1000), invitation.id],
    );
    return mapOrganizationInvitation({
      ...(deliveryUpdate.rows[0] ?? invitation),
      organization_name: organizationName,
      inviter_name: inviterName,
    });
  };

  const createOrganizationInvitation = async (
    organizationId: string,
    userId: string,
    rawEmail: string,
  ): Promise<OrganizationInvitationCreationResult> => {
    await expireOrganizationInvitations();

    const { email } = organizationInvitationSchema.parse({ email: rawEmail });
    const normalizedEmail = email.toLowerCase();
    const inviter = await query(
      `SELECT id, first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const targetUser = await query(
      `SELECT id, role, first_name, last_name FROM users WHERE lower(email) = $1 LIMIT 1`,
      [normalizedEmail],
    );

    // Self-invite check (must be before the membership check below).
    if (targetUser.rows[0]?.id === userId) {
      return { status: 400, error: "You are already an owner of this organization" };
    }

    // Allow Talent and Admin email addresses to receive invitations — the Client
    // role is enforced at acceptance time so the invited person can read the
    // reason even when they arrive at the invitation page as a non-Client user.
    if (targetUser.rows[0] && targetUser.rows[0].role === "client") {
      const existingMembership = await query(
        `SELECT status FROM organization_members
          WHERE organization_id = $1 AND user_id = $2
          LIMIT 1`,
        [organizationId, targetUser.rows[0].id],
      );
      if (existingMembership.rows[0]?.status === "active") {
        return { status: 409, error: "This user is already a member of the organization" };
      }
      if (existingMembership.rows[0]?.status === "suspended") {
        return { status: 409, error: "This user's organization membership is suspended" };
      }
    }

    const existingInvitation = await query(
      `SELECT id, status FROM organization_invitations
        WHERE organization_id = $1 AND lower(email) = $2 AND status = 'pending'
        LIMIT 1`,
      [organizationId, normalizedEmail],
    );
    if (existingInvitation.rows.length) {
      return { status: 409, error: "An invitation is already pending for this email" };
    }

    // Generate a secure raw token; only the SHA-256 hash is stored in the DB.
    const { raw: rawToken, hash: tokenHash } = generateOrganizationInvitationToken();

    const invitationResult = await query(
      `INSERT INTO organization_invitations (organization_id, email, invited_by, expires_at, token_hash)
       VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 day'), $5)
       RETURNING *`,
      [organizationId, normalizedEmail, userId, ORGANIZATION_INVITATION_EXPIRY_DAYS, tokenHash],
    );
    const invitation = invitationResult.rows[0];
    const organization = await query(
      `SELECT name FROM organizations WHERE id = $1 LIMIT 1`,
      [organizationId],
    );
    const inviterName =
      `${inviter.rows[0]?.first_name ?? ""} ${inviter.rows[0]?.last_name ?? ""}`.trim() ||
      "An organization owner";

    // Registered Client invitees also receive an in-app notification. The
    // invitation remains usable for people who sign up after the invite.
    if (targetUser.rows[0]?.id && targetUser.rows[0].role === "client") {
      await storage.createNotification({
        userId: targetUser.rows[0].id,
        type: "organization_invitation",
        title: "Organization invitation",
        message: `${inviterName} invited you to join ${organization.rows[0]?.name ?? "an organization"}.`,
        relatedId: invitation.id,
        relatedType: "organization_invitation",
      });
    }

    const deliveredInvitation = await deliverOrganizationInvitation({
      invitation,
      invitationRawToken: rawToken,
      organizationName: organization.rows[0]?.name ?? "an OnSpot organization",
      inviterName,
      recipientName: targetUser.rows[0]
        ? `${targetUser.rows[0].first_name ?? ""} ${targetUser.rows[0].last_name ?? ""}`.trim()
        : null,
    });
    return {
      invitation: deliveredInvitation,
    };
  };

  app.post("/api/organizations/:organizationId/invitations", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const owner = await requireOrganizationOwner(req.params.organizationId, userId);
      if (!owner) return res.status(403).json({ error: "Only organization owners can invite members" });

      const result = await createOrganizationInvitation(
        req.params.organizationId,
        userId,
        organizationInvitationSchema.parse(req.body ?? {}).email,
      );
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      return res.status(201).json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      if (err?.code === "23505") {
        return res.status(409).json({ error: "An invitation is already pending for this email" });
      }
      console.error("POST organization invitation failed:", err);
      return res.status(500).json({ error: "Failed to create organization invitation" });
    }
  });

  app.post("/api/organizations/:organizationId/invitations/:invitationId/resend", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const owner = await requireOrganizationOwner(req.params.organizationId, userId);
      if (!owner) return res.status(403).json({ error: "Only organization owners can resend invitations" });
      await expireOrganizationInvitations();

      const invitationResult = await query(
        `SELECT oi.*, o.name AS organization_name,
                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS inviter_name,
                target.first_name AS recipient_first_name,
                target.last_name AS recipient_last_name
           FROM organization_invitations oi
           INNER JOIN organizations o ON o.id = oi.organization_id
           INNER JOIN users u ON u.id = oi.invited_by
           LEFT JOIN users target ON lower(target.email) = lower(oi.email)
          WHERE oi.id = $1
            AND oi.organization_id = $2
            AND (
              oi.status = 'expired'
              OR (oi.status = 'pending' AND oi.email_status = 'failed')
            )
          LIMIT 1`,
        [req.params.invitationId, req.params.organizationId],
      );
      if (!invitationResult.rows.length) {
        return res.status(404).json({ error: "Invitation not found or is not eligible for resend" });
      }
      const existingInvitation = invitationResult.rows[0];

      if (existingInvitation.status === "pending") {
        // Regenerate the invitation token so the retry link is always fresh.
        const { raw: rawToken, hash: newTokenHash } = generateOrganizationInvitationToken();
        await query(
          `UPDATE organization_invitations SET token_hash = $1, updated_at = NOW() WHERE id = $2`,
          [newTokenHash, existingInvitation.id],
        );
        const invitation = await deliverOrganizationInvitation({
          invitation: existingInvitation,
          invitationRawToken: rawToken,
          organizationName: existingInvitation.organization_name,
          inviterName: existingInvitation.inviter_name || "An organization owner",
          recipientName: [
            existingInvitation.recipient_first_name,
            existingInvitation.recipient_last_name,
          ].filter(Boolean).join(" ") || null,
        });
        return res.json({ invitation });
      }

      const result = await createOrganizationInvitation(
        req.params.organizationId,
        userId,
        existingInvitation.email,
      );
      if ("error" in result) return res.status(result.status).json({ error: result.error });
      return res.status(201).json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      if (err?.code === "23505") {
        return res.status(409).json({ error: "An invitation is already pending for this email" });
      }
      console.error("POST organization invitation resend failed:", err);
      return res.status(500).json({ error: "Failed to resend organization invitation" });
    }
  });

  app.delete("/api/organizations/:organizationId/invitations/:invitationId", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const owner = await requireOrganizationOwner(req.params.organizationId, userId);
      if (!owner) return res.status(403).json({ error: "Only organization owners can revoke invitations" });
      const result = await query(
        `UPDATE organization_invitations
            SET status = 'revoked', responded_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND organization_id = $2 AND status = 'pending'
          RETURNING id`,
        [req.params.invitationId, req.params.organizationId],
      );
      if (!result.rows.length) return res.status(404).json({ error: "Pending invitation not found" });
      return res.json({ status: "revoked" });
    } catch (err: any) {
      console.error("DELETE organization invitation failed:", err);
      return res.status(500).json({ error: "Failed to revoke organization invitation" });
    }
  });

  app.delete("/api/organizations/:organizationId/members/:membershipId", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const owner = await requireOrganizationOwner(req.params.organizationId, userId);
      if (!owner) return res.status(403).json({ error: "Only organization owners can remove members" });
      const result = await query(
        `UPDATE organization_members
            SET status = 'suspended', updated_at = NOW()
          WHERE id = $1 AND organization_id = $2 AND status = 'active' AND role = 'member'
          RETURNING id`,
        [req.params.membershipId, req.params.organizationId],
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: "Active member not found or cannot be removed" });
      }
      return res.json({ status: "suspended" });
    } catch (err: any) {
      console.error("DELETE organization member failed:", err);
      return res.status(500).json({ error: "Failed to remove organization member" });
    }
  });

  // ── Public token-based invitation lookup (no authentication required) ────────
  // Allows any visitor (signed-out or signed-in) to see invitation details
  // before deciding whether to sign in or create an account.
  app.get("/api/organization-invitations/public/:token", async (req: Request, res: Response) => {
    try {
      await expireOrganizationInvitations();
      const tokenHash = createHash("sha256").update(req.params.token).digest("hex");
      const result = await query(
        `SELECT oi.id, oi.organization_id, oi.email, oi.status, oi.expires_at, oi.created_at,
                o.name AS organization_name,
                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS inviter_name
           FROM organization_invitations oi
           INNER JOIN organizations o ON o.id = oi.organization_id
           INNER JOIN users u ON u.id = oi.invited_by
          WHERE oi.token_hash = $1
          LIMIT 1`,
        [tokenHash],
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: "Invitation not found or the link is invalid" });
      }
      const row = result.rows[0];
      return res.json({
        id: row.id,
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        email: row.email,
        status: row.status,
        inviterName: row.inviter_name || null,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      });
    } catch (err: any) {
      console.error("GET organization-invitations/public/:token failed:", err);
      return res.status(500).json({ error: "Failed to load invitation" });
    }
  });

  // ── Token-based invitation acceptance ─────────────────────────────────────
  // Accepts an invitation using the raw token in the URL, without requiring the
  // invitation ID. The signed-in user must be a Client whose email matches the
  // invitation. Talent and Admin accounts receive a specific role-mismatch error.
  app.post("/api/organization-invitations/accept-by-token", authenticateJWT, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const userEmail = (req as any).user?.email;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const rawToken = req.body?.token;
    if (!rawToken || typeof rawToken !== "string") {
      return res.status(400).json({ error: "token is required" });
    }

    const action = req.body?.action;
    if (action !== "accept" && action !== "decline") {
      return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
    }

    const dbClient = await getClient();
    try {
      await dbClient.query("BEGIN");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const invitationResult = await dbClient.query(
        `SELECT oi.*, o.name AS organization_name
           FROM organization_invitations oi
           INNER JOIN organizations o ON o.id = oi.organization_id
          WHERE oi.token_hash = $1
          FOR UPDATE OF oi`,
        [tokenHash],
      );
      if (!invitationResult.rows.length) {
        await dbClient.query("ROLLBACK");
        return res.status(404).json({ error: "Invitation not found or the link is invalid" });
      }
      const invitation = invitationResult.rows[0];

      // Verify email match before any role check so the message is accurate.
      if (userEmail?.toLowerCase() !== invitation.email.toLowerCase()) {
        await dbClient.query("ROLLBACK");
        return res.status(403).json({
          error: "email_mismatch",
          message: `This invitation was sent to ${invitation.email}. Sign in with that email address to accept it.`,
        });
      }

      // Only Client accounts can join an organization. Give Talent/Admin a clear
      // role explanation rather than a generic 403.
      if (userRole !== "client") {
        await dbClient.query("ROLLBACK");
        return res.status(403).json({
          error: "wrong_role",
          message: "Only Client accounts can join an organization. This invitation cannot be accepted with a Talent or Admin account.",
        });
      }

      // Expire check
      const expiredResult = await dbClient.query(
        `UPDATE organization_invitations
            SET status = 'expired', responded_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND status = 'pending' AND expires_at <= NOW()
          RETURNING id`,
        [invitation.id],
      );
      if (expiredResult.rows.length) {
        await dbClient.query("COMMIT");
        return res.status(409).json({ error: "This invitation has expired" });
      }
      if (invitation.status !== "pending") {
        await dbClient.query("ROLLBACK");
        return res.status(409).json({
          error: invitation.status === "expired"
            ? "This invitation has expired"
            : "This invitation is no longer pending",
        });
      }

      if (action === "decline") {
        await dbClient.query(
          `UPDATE organization_invitations
              SET status = 'declined', responded_at = NOW(), updated_at = NOW()
            WHERE id = $1`,
          [invitation.id],
        );
        await dbClient.query("COMMIT");
        return res.json({ status: "declined" });
      }

      // Accept: upsert membership
      const existingMembership = await dbClient.query(
        `SELECT id, role, status FROM organization_members
          WHERE organization_id = $1 AND user_id = $2
          FOR UPDATE`,
        [invitation.organization_id, userId],
      );
      let membership;
      if (existingMembership.rows[0]?.role === "owner") {
        await dbClient.query("ROLLBACK");
        return res.status(409).json({ error: "You already own this organization" });
      } else if (existingMembership.rows[0]) {
        const membershipResult = await dbClient.query(
          `UPDATE organization_members
              SET status = 'active', role = 'member', joined_at = NOW(), updated_at = NOW()
            WHERE id = $1
            RETURNING id, organization_id, user_id, role, status, joined_at`,
          [existingMembership.rows[0].id],
        );
        membership = membershipResult.rows[0];
      } else {
        const membershipResult = await dbClient.query(
          `INSERT INTO organization_members (organization_id, user_id, role, status)
           VALUES ($1, $2, 'member', 'active')
           RETURNING id, organization_id, user_id, role, status, joined_at`,
          [invitation.organization_id, userId],
        );
        membership = membershipResult.rows[0];
      }

      await dbClient.query(
        `UPDATE organization_invitations
            SET status = 'accepted', accepted_by = $2, responded_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
        [invitation.id, userId],
      );
      await dbClient.query("COMMIT");
      return res.json({
        status: "accepted",
        organization: { id: invitation.organization_id, name: invitation.organization_name },
        membership: {
          id: membership.id,
          organizationId: membership.organization_id,
          userId: membership.user_id,
          role: membership.role,
          status: membership.status,
          joinedAt: membership.joined_at,
        },
      });
    } catch (err: any) {
      await dbClient.query("ROLLBACK").catch(() => {});
      console.error("POST organization-invitations/accept-by-token failed:", err);
      return res.status(500).json({ error: "Failed to respond to organization invitation" });
    } finally {
      dbClient.release();
    }
  });

  // Invitee-only endpoints. Both the email match and the Client role are
  // checked server-side; the invitation id alone never grants access.
  app.get("/api/organization-invitations", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      await expireOrganizationInvitations();
      const result = await query(
        `SELECT oi.*, o.name AS organization_name,
                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS inviter_name
           FROM organization_invitations oi
           INNER JOIN organizations o ON o.id = oi.organization_id
           INNER JOIN users u ON u.id = oi.invited_by
           INNER JOIN users invitee ON lower(invitee.email) = lower(oi.email)
          WHERE invitee.id = $1 AND oi.status = 'pending'
          ORDER BY oi.created_at DESC`,
        [userId],
      );
      return res.json(result.rows.map(mapOrganizationInvitation));
    } catch (err: any) {
      console.error("GET organization invitations failed:", err);
      return res.status(500).json({ error: "Failed to load organization invitations" });
    }
  });

  app.post("/api/organization-invitations/:invitationId/respond", authenticateJWT, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const action = req.body?.action;
    if (action !== "accept" && action !== "decline") {
      return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
    }

    const dbClient = await getClient();
    try {
      await dbClient.query("BEGIN");
      const invitationResult = await dbClient.query(
        `SELECT oi.*, o.name AS organization_name
           FROM organization_invitations oi
           INNER JOIN organizations o ON o.id = oi.organization_id
           INNER JOIN users u ON lower(u.email) = lower(oi.email)
          WHERE oi.id = $1 AND u.id = $2
          FOR UPDATE OF oi`,
        [req.params.invitationId, userId],
      );
      if (!invitationResult.rows.length) {
        await dbClient.query("ROLLBACK");
        return res.status(404).json({ error: "Organization invitation not found" });
      }
      const invitation = invitationResult.rows[0];
      const expiredResult = await dbClient.query(
        `UPDATE organization_invitations
            SET status = 'expired', responded_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND status = 'pending' AND expires_at <= NOW()
          RETURNING id`,
        [invitation.id],
      );
      if (expiredResult.rows.length) {
        await dbClient.query("COMMIT");
        return res.status(409).json({ error: "This invitation has expired" });
      }
      if (invitation.status !== "pending") {
        await dbClient.query("ROLLBACK");
        return res.status(409).json({
          error: invitation.status === "expired"
            ? "This invitation has expired"
            : "This invitation is no longer pending",
        });
      }

      if (action === "decline") {
        await dbClient.query(
          `UPDATE organization_invitations
              SET status = 'declined', responded_at = NOW(), updated_at = NOW()
            WHERE id = $1`,
          [invitation.id],
        );
        await dbClient.query("COMMIT");
        return res.json({ status: "declined" });
      }

      // Role enforcement happens here at acceptance time, not at invitation time,
      // so Talent/Admin users can receive and see the invitation before they
      // understand why they cannot accept it.
      if (userRole !== "client") {
        await dbClient.query("ROLLBACK");
        return res.status(403).json({
          error: "wrong_role",
          message: "Only Client accounts can join an organization. This invitation cannot be accepted with a Talent or Admin account.",
        });
      }

      const existingMembership = await dbClient.query(
        `SELECT id, role, status FROM organization_members
          WHERE organization_id = $1 AND user_id = $2
          FOR UPDATE`,
        [invitation.organization_id, userId],
      );
      let membership;
      if (existingMembership.rows[0]?.role === "owner") {
        await dbClient.query("ROLLBACK");
        return res.status(409).json({ error: "You already own this organization" });
      } else if (existingMembership.rows[0]) {
        const membershipResult = await dbClient.query(
          `UPDATE organization_members
              SET status = 'active', role = 'member', joined_at = NOW(), updated_at = NOW()
            WHERE id = $1
            RETURNING id, organization_id, user_id, role, status, joined_at`,
          [existingMembership.rows[0].id],
        );
        membership = membershipResult.rows[0];
      } else {
        const membershipResult = await dbClient.query(
          `INSERT INTO organization_members (organization_id, user_id, role, status)
           VALUES ($1, $2, 'member', 'active')
           RETURNING id, organization_id, user_id, role, status, joined_at`,
          [invitation.organization_id, userId],
        );
        membership = membershipResult.rows[0];
      }

      await dbClient.query(
        `UPDATE organization_invitations
            SET status = 'accepted', accepted_by = $2, responded_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
        [invitation.id, userId],
      );
      await dbClient.query("COMMIT");
      return res.json({
        status: "accepted",
        organization: { id: invitation.organization_id, name: invitation.organization_name },
        membership: {
          id: membership.id,
          organizationId: membership.organization_id,
          userId: membership.user_id,
          role: membership.role,
          status: membership.status,
          joinedAt: membership.joined_at,
        },
      });
    } catch (err: any) {
      await dbClient.query("ROLLBACK").catch(() => {});
      console.error("POST organization invitation response failed:", err);
      return res.status(500).json({ error: "Failed to respond to organization invitation" });
    } finally {
      dbClient.release();
    }
  });

  // ── Organization deletion lifecycle ──────────────────────────────────────
  // Only the owner can schedule deletion. A three-day grace period allows
  // cancellation. Due organizations are cleaned up by background cleanup
  // (cleanupDueOrganizations exported below) without affecting users or
  // other organizations.
  const ORGANIZATION_DELETION_GRACE_DAYS = 3;

  app.post("/api/organizations/:organizationId/request-deletion", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const owner = await requireOrganizationOwner(req.params.organizationId, userId);
      if (!owner) return res.status(403).json({ error: "Only organization owners can request deletion" });

      const orgResult = await query(
        `SELECT name, delete_requested_at FROM organizations WHERE id = $1 LIMIT 1`,
        [req.params.organizationId],
      );
      if (!orgResult.rows.length) return res.status(404).json({ error: "Organization not found" });
      const org = orgResult.rows[0];
      if (org.delete_requested_at) {
        return res.status(409).json({ error: "Deletion is already scheduled for this organization" });
      }

      const confirmName = (req.body?.confirmName ?? "").trim();
      if (!confirmName || confirmName !== org.name) {
        return res.status(400).json({ error: "Confirmation name does not match the organization name" });
      }

      const updated = await query(
        `UPDATE organizations
            SET delete_requested_at = NOW(),
                delete_requested_by = $1,
                delete_due_at = NOW() + ($2 * INTERVAL '1 day'),
                updated_at = NOW()
          WHERE id = $3
          RETURNING id, name, delete_requested_at, delete_due_at`,
        [userId, ORGANIZATION_DELETION_GRACE_DAYS, req.params.organizationId],
      );
      return res.json({
        status: "deletion_scheduled",
        deleteDueAt: updated.rows[0].delete_due_at,
      });
    } catch (err: any) {
      console.error("POST organization request-deletion failed:", err);
      return res.status(500).json({ error: "Failed to schedule organization deletion" });
    }
  });

  app.delete("/api/organizations/:organizationId/request-deletion", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const owner = await requireOrganizationOwner(req.params.organizationId, userId);
      if (!owner) return res.status(403).json({ error: "Only organization owners can cancel deletion" });

      const result = await query(
        `UPDATE organizations
            SET delete_requested_at = NULL,
                delete_requested_by = NULL,
                delete_due_at = NULL,
                updated_at = NOW()
          WHERE id = $1 AND delete_requested_at IS NOT NULL
          RETURNING id`,
        [req.params.organizationId],
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: "No pending deletion request found for this organization" });
      }
      return res.json({ status: "deletion_cancelled" });
    } catch (err: any) {
      console.error("DELETE organization request-deletion failed:", err);
      return res.status(500).json({ error: "Failed to cancel organization deletion" });
    }
  });

  app.get("/api/client/msa-status", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const r = await query(
        `SELECT msa_accepted_at, msa_version
           FROM client_profiles
          WHERE user_id = $1
          LIMIT 1`,
        [userId],
      );
      return res.json({
        accepted: Boolean(
          r.rows[0]?.msa_accepted_at &&
          r.rows[0]?.msa_version === CURRENT_MSA_VERSION,
        ),
        acceptedAt: r.rows[0]?.msa_accepted_at ?? null,
        version: r.rows[0]?.msa_version ?? null,
        currentVersion: CURRENT_MSA_VERSION,
        termsUrl: CLIENT_TERMS_URL,
      });
    } catch (err: any) {
      console.error("GET /api/client/msa-status error:", err);
      return res.status(500).json({ error: "Failed to load MSA status" });
    }
  });

  app.post("/api/client/msa-acceptance", pipelineMutationLimiter, authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (req.body?.accepted !== true) {
        return res.status(400).json({ error: "You must accept the Terms of Service before inviting talent." });
      }

      const existing = await query(`SELECT id FROM client_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
      let result;
      if (existing.rows.length) {
        result = await query(
          `UPDATE client_profiles
              SET msa_accepted_at = NOW(),
                  msa_version = $1,
                  updated_at = NOW()
            WHERE user_id = $2
            RETURNING *`,
          [CURRENT_MSA_VERSION, userId],
        );
      } else {
        const userRes = await query(`SELECT company, first_name, last_name, email FROM users WHERE id = $1`, [userId]);
        const u = userRes.rows[0];
        result = await query(
          `INSERT INTO client_profiles
             (id, user_id, company_name, contact_person, email, msa_accepted_at, msa_version, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6, NOW(), NOW())
           RETURNING *`,
          [
            `cp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            userId,
            u?.company ?? null,
            `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim() || null,
            u?.email ?? null,
            CURRENT_MSA_VERSION,
          ],
        );
      }
      return res.json({
        accepted: true,
        acceptedAt: result.rows[0].msa_accepted_at,
        version: result.rows[0].msa_version,
        currentVersion: CURRENT_MSA_VERSION,
        termsUrl: CLIENT_TERMS_URL,
      });
    } catch (err: any) {
      console.error("POST /api/client/msa-acceptance error:", err);
      return res.status(500).json({ error: "Failed to save MSA acceptance" });
    }
  });

  app.get("/api/client-profile/me", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const r = await query("SELECT * FROM client_profiles WHERE user_id = $1", [userId]);
      if (r.rows.length === 0) {
        const cpId = `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const userRes = await query("SELECT * FROM users WHERE id = $1", [userId]);
        const u = userRes.rows[0];
        const ins = await query(
          `INSERT INTO client_profiles (id, user_id, company_name, contact_person, email, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
          [cpId, userId, u?.company || null, `${u?.first_name || ""} ${u?.last_name || ""}`.trim() || null, u?.email || null],
        );
        return res.json(mapClientProfileRow(ins.rows[0]));
      }
      return res.json(mapClientProfileRow(r.rows[0]));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/client-profile/me", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const {
        companyName, contactPerson, email, phoneNumber, website, industry,
        companySize, location, about, hiringNeeds, timezone,
      } = req.body;
      // Use $1::text so that empty strings are stored (not COALESCE'd away)
      const r = await query(
        `UPDATE client_profiles
         SET company_name   = $1,
             contact_person = $2,
             email          = $3,
             phone_number   = $4,
             website        = $5,
             industry       = $6,
             company_size   = $7,
             location       = $8,
             about          = $9,
             hiring_needs   = $10,
             timezone       = $11,
             updated_at     = NOW()
         WHERE user_id = $12
         RETURNING *`,
        [
          companyName   ?? null,
          contactPerson ?? null,
          email         ?? null,
          phoneNumber   ?? null,
          website       ?? null,
          industry      ?? null,
          companySize   ?? null,
          location      ?? null,
          about         ?? null,
          hiringNeeds   ?? null,
          timezone      ?? null,
          userId,
        ],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Profile not found" });
      return res.json(mapClientProfileRow(r.rows[0]));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Client Jobs ───────────────────────────────────────────────────────────
  // GET /api/client/invitation-readiness — returns the client's complete
  // invitation prerequisites without exposing search-scaffold rows. The picker
  // needs the non-invitable jobs' state to explain why it cannot proceed.
  app.get("/api/client/invitation-readiness", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const [jobsResult, scaffoldResult, profileResult, firstInviteResult] = await Promise.all([
        query(
          `SELECT j.*,
             j.proposal_count AS "proposalCount"
            FROM jobs j
           WHERE j.client_id = $1
             AND (j.created_via IS NULL OR j.created_via != 'search_scaffold')
           ORDER BY j.created_at DESC`,
          [userId],
        ),
        query(
          `SELECT COUNT(*)::int AS count
             FROM jobs
            WHERE client_id = $1 AND created_via = 'search_scaffold'`,
          [userId],
        ),
        query(
          `SELECT msa_accepted_at, msa_version
             FROM client_profiles
            WHERE user_id = $1
            LIMIT 1`,
          [userId],
        ),
        query(
          `SELECT NOT EXISTS (
             SELECT 1
               FROM job_submissions
              WHERE client_id = $1
                AND (workflow_type = 'client_invitation'
                  OR (workflow_type = 'application' AND initiated_by = 'client'))
           ) AS is_first`,
          [userId],
        ),
      ]);

      const jobs = jobsResult.rows;
      const scaffoldJobsCount = Number(scaffoldResult.rows[0]?.count ?? 0);
      const pendingApprovalCount = jobs.filter((job: any) =>
        job.approval_status === "pending" && job.status === "open",
      ).length;
      const closedJobsCount = jobs.filter((job: any) =>
        ["closed", "cancelled", "completed"].includes(job.status),
      ).length;
      const openApprovedCount = jobs.filter((job: any) =>
        job.status === "open" && job.approval_status === "approved",
      ).length;

      let state: "ready" | "pending_approval" | "closed_jobs" | "scaffold_only" | "no_jobs" | "not_ready";
      if (openApprovedCount > 0) {
        state = "ready";
      } else if (pendingApprovalCount > 0) {
        state = "pending_approval";
      } else if (jobs.length === 0 && scaffoldJobsCount > 0) {
        state = "scaffold_only";
      } else if (jobs.length === 0) {
        state = "no_jobs";
      } else if (jobs.every((job: any) => ["closed", "cancelled", "completed"].includes(job.status))) {
        state = "closed_jobs";
      } else {
        state = "not_ready";
      }

      const accepted = Boolean(
        profileResult.rows[0]?.msa_accepted_at &&
        profileResult.rows[0]?.msa_version === CURRENT_MSA_VERSION,
      );
      const isFirstInvitation = Boolean(firstInviteResult.rows[0]?.is_first);

      return res.json({
        jobs,
        summary: {
          state,
          totalJobs: jobs.length,
          pendingApprovalCount,
          closedJobsCount,
          scaffoldJobsCount,
          openApprovedCount,
        },
        msa: {
          required: isFirstInvitation && !accepted,
          accepted,
          termsUrl: CLIENT_TERMS_URL,
        },
      });
    } catch (err: any) {
      console.error("GET /api/client/invitation-readiness error:", err);
      return res.status(500).json({ error: "Failed to load invitation readiness" });
    }
  });

  app.get("/api/client/jobs", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const r = await query(
        `SELECT j.*,
          j.proposal_count AS "proposalCount"
         FROM jobs j
         WHERE j.client_id = $1
           AND (j.created_via IS NULL OR j.created_via != 'search_scaffold')
         ORDER BY j.created_at DESC`,
        [userId],
      );
      return res.json(r.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/client/jobs/:jobId — owner-aware single-job fetch.
  // Returns the job regardless of status/approval as long as the authenticated client
  // owns it and it is not a scaffold. Used by the View button on the client dashboard
  // to let clients see their own draft, pending, and closed jobs.
  // 404s for: (a) scaffold jobs, (b) another client's job, (c) non-existent job.
  // 401s for any unauthenticated request.
  app.get("/api/client/jobs/:jobId", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { jobId } = req.params;
      const r = await query(
        `SELECT j.*, j.proposal_count AS "proposalCount"
         FROM jobs j
         WHERE j.id = $1
           AND j.client_id = $2
           AND (j.created_via IS NULL OR j.created_via != 'search_scaffold')`,
        [jobId, userId],
      );
      if (!r.rows.length) return res.status(404).json({ error: "Job not found" });
      return res.json(r.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/client/jobs", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      // Client-created jobs always start as pending approval
      const body = { ...req.body, clientId: userId, approvalStatus: "pending", isClientSubmitted: true };

      // Guard 1: reject any non-canonical engagement type value before the DB sees it.
      const clientCreateEtErr = validateEngagementType(body.engagementType);
      if (clientCreateEtErr) return res.status(400).json(clientCreateEtErr);
      const clientCreateMetadataErr = validateJobFormMetadata(body);
      if (clientCreateMetadataErr) return res.status(400).json(clientCreateMetadataErr);

      // Guard 2: published jobs must have an engagement type set.
      const effectiveStatus = body.status ?? "open";
      if (["open", "published"].includes(effectiveStatus) && !body.engagementType) {
        return res.status(400).json({
          error: "Engagement Type required",
          message: "An Engagement Type (Lite or Standard) must be set before publishing a job.",
        });
      }

      const validated = insertJobSchema.parse(body);
      const job = await storage.createJob(validated);
      return res.status(201).json(job);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/client/jobs/:jobId", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { jobId } = req.params;
      // Ownership check
      const check = await query("SELECT id, approval_status FROM jobs WHERE id = $1 AND client_id = $2", [jobId, userId]);
      if (check.rows.length === 0) return res.status(403).json({ error: "Forbidden" });
      const { clientId: _strip, ...rest } = req.body;
      const updates = insertJobSchema.partial().parse(rest);

      // Guard 1: reject any non-canonical engagement type value before the DB sees it.
      const clientPatchEtErr = validateEngagementType(updates.engagementType);
      if (clientPatchEtErr) return res.status(400).json(clientPatchEtErr);
      const clientPatchMetadataErr = validateJobFormMetadata(updates);
      if (clientPatchMetadataErr) return res.status(400).json(clientPatchMetadataErr);

      // Guard 2: published jobs must have an engagement type set.
      const existingJob = await storage.getJob(jobId);
      const effectiveStatus = updates.status ?? existingJob?.status;
      const effectiveEngagementType =
        "engagementType" in updates ? updates.engagementType : existingJob?.engagementType;
      if (
        ["open", "published"].includes(effectiveStatus as string) &&
        !["Lite", "Standard"].includes(effectiveEngagementType as string)
      ) {
        return res.status(400).json({
          error: "Engagement Type required",
          message: "An Engagement Type (Lite or Standard) must be set before publishing a job.",
        });
      }

      // Editing an approved job resets it to pending — must be re-reviewed
      const currentApproval = check.rows[0].approval_status;
      if (currentApproval === "approved") {
        (updates as any).approvalStatus = "pending";
        (updates as any).approvedBy = null;
        (updates as any).approvedAt = null;
      }
      const job = await storage.updateJob(jobId, updates);
      if (!job) return res.status(404).json({ error: "Job not found" });
      return res.json(job);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/client/jobs/:jobId/status", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { jobId } = req.params;
      const { status } = req.body;
      if (!["open", "closed", "cancelled"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be open, closed, or cancelled" });
      }
      // Guard: published jobs must have a valid engagement type
      if (["open", "published"].includes(status)) {
        const existingJob = await storage.getJob(jobId);
        // Scaffold jobs are internal scoring artifacts — they must never be published publicly
        if ((existingJob as any)?.createdVia === "search_scaffold") {
          return res.status(400).json({
            error: "Cannot publish",
            message: "Search result jobs are internal records and cannot be published as job postings.",
          });
        }
        if (!existingJob || !["Lite", "Standard"].includes(existingJob.engagementType as string)) {
          return res.status(400).json({
            error: "Engagement Type required",
            message: "An Engagement Type (Lite or Standard) must be set before publishing a job.",
          });
        }
      }
      const r = await query(
        "UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 AND client_id = $3 RETURNING *",
        [status, jobId, userId],
      );
      if (r.rows.length === 0) return res.status(403).json({ error: "Forbidden" });
      return res.json(r.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/client/jobs/:jobId — permanently removes a job the client owns.
  // Decision: hard delete, not soft-close. "Close" is already a separate action on the
  // dashboard. "Delete" must mean gone. Blocks with 409 if any business data references
  // this job (submissions, applications, proposals, contracts, message threads).
  // job_skills rows are cleaned up first (NO ACTION FK). job_matches auto-cascade.
  app.delete("/api/client/jobs/:jobId", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { jobId } = req.params;

      // Verify ownership and that this is not a scaffold
      const owns = await query(
        `SELECT id FROM jobs WHERE id = $1 AND client_id = $2 AND (created_via IS NULL OR created_via != 'search_scaffold')`,
        [jobId, userId],
      );
      if (!owns.rows.length) return res.status(403).json({ error: "Forbidden" });

      // Block if any real business data references this job.
      // These tables have NO ACTION FK constraints — PostgreSQL would also reject the
      // DELETE if we skipped this check, but we want a helpful client-facing message.
      // Wrap in a subquery so the outer LIMIT 1 applies to the whole UNION result.
      const deps = await query(
        `SELECT 1 FROM (
           SELECT 1 FROM job_submissions  WHERE job_id = $1
           UNION ALL
           SELECT 1 FROM job_applications WHERE job_id = $1
           UNION ALL
           SELECT 1 FROM message_threads  WHERE job_id = $1
         ) _deps LIMIT 1`,
        [jobId],
      );
      if (deps.rows.length > 0) {
        return res.status(409).json({
          error: "has_applications",
          message: "This job has existing applications or conversations and cannot be deleted. You can close it instead.",
        });
      }

      // Safe to delete — clean up the NO ACTION FK tag rows first.
      // job_matches will auto-delete via their ON DELETE CASCADE constraint.
      await query(`DELETE FROM job_skills WHERE job_id = $1`, [jobId]);
      const r = await query(
        `DELETE FROM jobs WHERE id = $1 AND client_id = $2 RETURNING id`,
        [jobId, userId],
      );
      if (!r.rows.length) return res.status(403).json({ error: "Forbidden" });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ====== SEARCH-TO-SHORTLIST (Client-initiated talent discovery) ======

  // Normalize a raw search query for aggregation — lowercase, trim, collapse whitespace,
  // strip punctuation — so "Manage my inbox!" and "manage my inbox" count as one entry.
  function normalizeSearchQuery(raw: string): string {
    return raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
  }

  // Optionally resolve the caller's role from a Bearer JWT without requiring auth.
  // Used by unauthenticated routes that still want to skip admin-originated traffic.
  // Never throws — returns undefined when no token is present or the token is invalid.
  function peekCallerRole(req: Request): string | undefined {
    try {
      const bearer = req.headers["authorization"]?.split(" ")[1];
      if (!bearer) return undefined;
      const jwtSecret = process.env.JWT_SECRET || "development-fallback-secret-not-for-production";
      const decoded = jwt.verify(bearer, jwtSecret) as any;
      // Standard user JWT carries role directly; talent JWTs carry type:"candidate"
      return decoded?.role ?? (decoded?.type === "candidate" ? "talent" : undefined);
    } catch {
      return undefined;
    }
  }

  // Fire-and-forget search query frequency UPSERT.
  // Never throws — a failed write must never break the search response.
  // Skips recording when the caller is an admin so internal/test searches do
  // not pollute the suggestion chips shown to real clients.
  function recordSearchQuery(raw: string, userRole?: string): void {
    if (userRole === "admin") return;
    const normalized = normalizeSearchQuery(raw);
    if (!normalized) return;
    query(
      `INSERT INTO search_query_frequency (normalized_query, count, last_searched_at)
       VALUES ($1, 1, NOW())
       ON CONFLICT (normalized_query)
       DO UPDATE SET
         count            = search_query_frequency.count + 1,
         last_searched_at = NOW()`,
      [normalized],
    ).catch((err: any) =>
      console.warn("⚠️  search_query_frequency upsert failed:", err.message),
    );
  }

  // ── Search query frequency admin endpoints ───────────────────────────────
  //
  // GET  /api/admin/search-query-stats — total count, top queries, threshold status
  // POST /api/admin/search-query-stats/seed — pre-populate high-value chips

  // Helper: read the chip-activation threshold from platform_settings.
  // Falls back to 100 if the row is missing (e.g. fresh DB without migration).
  async function getSearchSuggestionThreshold(): Promise<number> {
    try {
      const row = await query(
        `SELECT value FROM platform_settings WHERE key = 'search_suggestion_threshold' LIMIT 1`,
      );
      if (row.rows.length > 0) {
        const n = parseInt(row.rows[0].value, 10);
        if (!isNaN(n) && n > 0) return n;
      }
    } catch (_) {
      // ignore — fall through to default
    }
    return 100;
  }

  app.get("/api/admin/search-query-stats", authenticateAdminFlexible, async (_req: Request, res: Response) => {
    try {
      const [totalRow, topRows, threshold] = await Promise.all([
        query(`SELECT COALESCE(SUM(count),0)::int AS total FROM search_query_frequency`),
        query(
          `SELECT normalized_query, count, last_searched_at
           FROM search_query_frequency
           ORDER BY count DESC, last_searched_at DESC
           LIMIT 20`,
        ),
        getSearchSuggestionThreshold(),
      ]);
      const total = Number(totalRow.rows[0]?.total ?? 0);

      return res.json({
        total_recorded_searches: total,
        threshold,
        chips_active: total >= threshold,
        top_queries: topRows.rows.map((r: any) => ({
          query: r.normalized_query,
          count: Number(r.count),
          last_searched_at: r.last_searched_at,
        })),
      });
    } catch (err: any) {
      console.error("GET /api/admin/search-query-stats error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/search-query-stats/seed", authenticateAdminFlexible, async (req: Request, res: Response) => {
    try {
      // Body: { queries: Array<{ query: string; count?: number }> }
      // Seeds or bumps entries so admins can prime high-value chips before organic volume accrues.
      const body = req.body as { queries?: unknown };
      if (!Array.isArray(body.queries) || body.queries.length === 0) {
        return res.status(400).json({ error: "Provide a non-empty queries array: [{ query, count? }]" });
      }
      if (body.queries.length > 50) {
        return res.status(400).json({ error: "Maximum 50 queries per seed call" });
      }

      let seeded = 0;
      for (const item of body.queries) {
        if (typeof (item as any).query !== "string") continue;
        const raw = String((item as any).query).trim();
        const normalized = raw.toLowerCase().replace(/\s+/g, " ").trim();
        if (!normalized || normalized.length < 2 || normalized.length > 200) continue;
        const seedCount = Math.min(Math.max(Number((item as any).count ?? 1), 1), 1000);
        await query(
          `INSERT INTO search_query_frequency (normalized_query, count, last_searched_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (normalized_query)
           DO UPDATE SET
             count            = search_query_frequency.count + EXCLUDED.count,
             last_searched_at = NOW()`,
          [normalized, seedCount],
        );
        seeded++;
      }

      const totalRow = await query(
        `SELECT COALESCE(SUM(count),0)::int AS total FROM search_query_frequency`,
      );
      const total = Number(totalRow.rows[0]?.total ?? 0);

      const threshold = await getSearchSuggestionThreshold();
      return res.json({
        seeded_count: seeded,
        total_recorded_searches: total,
        chips_active: total >= threshold,
      });
    } catch (err: any) {
      console.error("POST /api/admin/search-query-stats/seed error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/client/talent-search/suggestions — top-volume categories as suggestion chips
  // Returns [{ category, phrase }] for the top 5 categories by approved-job count.
  // The phrase mapping lives in the frontend (jobConstants.TALENT_CATEGORY_PHRASES);
  // the server returns the category name and the frontend looks up the phrase.
  // No auth required — only returns aggregate category counts, no PII
  app.get("/api/client/talent-search/suggestions", async (req: Request, res: Response) => {
    try {
      // Server-side alias map — mirrors client/src/lib/jobConstants.ts BROWSE_CATEGORY_ALIASES
      const SERVER_BROWSE_ALIASES: Record<string, string> = {
        "customer support": "Customer Support",
        "support": "Customer Support",
        "customer success": "Customer Support",
        "virtual assistant": "Virtual Assistants",
        "virtual assistants": "Virtual Assistants",
        "admin": "Virtual Assistants",
        "engineering": "Developers",
        "development": "Developers",
        "software": "Developers",
        "design (ui/ux)": "Designers",
        "design": "Designers",
        "marketing": "Marketing Specialists",
        "finance & accounting": "Accountants",
        "finance": "Accountants",
        "accounting": "Accountants",
        "healthcare": "Healthcare Professionals",
        "sales": "Sales Representatives",
        "sales development": "Sales Representatives",
        "operations": "Operations Specialists",
        "project & program management": "Operations Specialists",
        "information technology (it)": "IT & Technical Support",
        "it": "IT & Technical Support",
        "tech support": "IT & Technical Support",
        "technical support": "IT & Technical Support",
      };
      const CANONICAL = new Set([
        "Customer Support", "Virtual Assistants", "Developers", "Designers",
        "Marketing Specialists", "Accountants", "Healthcare Professionals",
        "Sales Representatives", "Operations Specialists", "IT & Technical Support",
      ]);

      const resolveCanonical = (raw: string | null | undefined): string | null => {
        if (!raw) return null;
        const key = raw.trim().toLowerCase();
        for (const cat of Array.from(CANONICAL)) { if (cat.toLowerCase() === key) return cat; }
        return SERVER_BROWSE_ALIASES[key] ?? null;
      };

      // ── Primary: real search query frequency ─────────────────────────────────
      // Threshold is stored in platform_settings (key: search_suggestion_threshold).
      // Admins can adjust it from the Platform Settings tab in AdminDashboard
      // without a redeploy. Default = 100.
      const [totalRow, chipThreshold] = await Promise.all([
        query(`SELECT COALESCE(SUM(count),0)::int AS total FROM search_query_frequency`),
        getSearchSuggestionThreshold(),
      ]);
      const totalSearches = Number(totalRow.rows[0]?.total ?? 0);

      if (totalSearches >= chipThreshold) {
        const freqRows = await query(
          `SELECT normalized_query, count
           FROM search_query_frequency
           WHERE count >= 3
           ORDER BY count DESC, last_searched_at DESC
           LIMIT 6`,
        );
        const chips = freqRows.rows.map((r: any) => ({
          // Capitalize first letter for display; keep rest as-is (already lowercase)
          query: r.normalized_query.charAt(0).toUpperCase() + r.normalized_query.slice(1),
          count: Number(r.count),
        }));
        return res.json(chips);
      }

      // ── Fallback: category job-posting volume ─────────────────────────────────
      const rows = await query(
        `SELECT COALESCE(NULLIF(job_function,''), category) AS raw_cat, COUNT(*) AS cnt
         FROM jobs
         WHERE approval_status = 'approved'
           AND created_via != 'search_scaffold'
         GROUP BY raw_cat
         ORDER BY cnt DESC
         LIMIT 30`,
      );

      const counts = new Map<string, number>();
      for (const row of rows.rows) {
        const canonical = resolveCanonical(row.raw_cat);
        if (!canonical) continue;
        counts.set(canonical, (counts.get(canonical) ?? 0) + Number(row.cnt));
      }

      const suggestions = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category]) => ({ category }));

      return res.json(suggestions);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/talent-search — public anonymous search. No DB write, no auth.
  // Rate-limited by IP (10/min). Results pass through sanitizeSearchCandidate.
  // Response shape: { results: [...] }  — no jobId since no scaffold row is created.
  // The jobId (needed for invitations) only exists after the visitor authenticates
  // and re-runs via the authenticated endpoint below.
  app.post("/api/talent-search", publicSearchLimiter, async (req: Request, res: Response) => {
    try {
      const { searchText, category, engagementType = "Standard" } = req.body;
      if (!searchText?.trim()) return res.status(400).json({ error: "searchText is required" });

      const title = String(searchText).trim().slice(0, 120);
      const resolvedCategory = category?.trim() || inferCategory(title);

      const raw = await storage.rankTalentByParams(
        { title, category: resolvedCategory, engagementType },
        30,
      );
      const results = raw.map((r) => ({
        ...r,
        candidate: sanitizeSearchCandidate(r.candidate),
      }));
      // Record query frequency (fire-and-forget — never blocks the response).
      // peekCallerRole decodes the JWT token without requiring auth so that
      // admin searches on the public endpoint are also excluded.
      recordSearchQuery(title, peekCallerRole(req));
      return res.json({ results });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/client/talent-profile/:userId — full candidate profile for a specific talent.
  // Returns education + certifications in addition to standard search-result fields.
  // Requires client JWT; results pass through sanitizeFullProfileForClient (explicit allowlist).
  app.get("/api/client/talent-profile/:userId", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const userResult = await query(
        `SELECT id FROM users WHERE id = $1 AND role = 'talent' LIMIT 1`,
        [userId],
      );
      if (!userResult.rows.length) {
        return res.status(404).json({ error: "Talent profile not found" });
      }
      const candidate = await storage.getCandidateByUserId(userId);
      if (!candidate) {
        return res.status(404).json({ error: "Talent profile not found" });
      }
      res.json(sanitizeFullProfileForClient(candidate as Record<string, any>));
    } catch (err) {
      console.error("GET /api/client/talent-profile/:userId error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/client/talent-search — rank talent in-memory against search params.
  // Architecture decision: the Hire Talent search bar NEVER writes to the jobs table.
  // Jobs may only be created through the explicit "Post a Job" flow on the Client Profile.
  // This endpoint is the authenticated-client counterpart of the anonymous /api/talent-search
  // endpoint — same scorer (rankTalentByParams), same response shape, zero DB writes.
  app.post("/api/client/talent-search", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { searchText, category, engagementType = "Standard" } = req.body;
      if (!searchText?.trim()) return res.status(400).json({ error: "searchText is required" });

      const title = String(searchText).trim().slice(0, 120);
      const resolvedCategory = category?.trim() || inferCategory(title);

      // No DB write — rank talent purely in-memory against virtual params.
      const raw = await storage.rankTalentByParams(
        { title, category: resolvedCategory, engagementType },
        30,
      );
      const results = raw.map((r) => ({
        ...r,
        candidate: sanitizeSearchCandidate(r.candidate),
      }));
      // Record query frequency (fire-and-forget — never blocks the response)
      recordSearchQuery(title, (req as any).user?.role);
      return res.json({ results });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/client/jobs/:jobId/talent-search — job-specific Client search.
  // This is intentionally separate from general discovery: it only accepts a
  // real, owned, approved and open posting, then ranks talent against that job.
  app.post("/api/client/jobs/:jobId/talent-search", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const clientId = (req as any).user?.id;
      const jobId = req.params.jobId;
      if (!clientId) return res.status(401).json({ error: "Unauthorized" });
      if (!jobId || jobId.length > 200) return res.status(400).json({ error: "A valid job ID is required" });

      const jobResult = await query(
        `SELECT id, client_id, status, approval_status, created_via
           FROM jobs
          WHERE id = $1
          LIMIT 1`,
        [jobId],
      );
      if (!jobResult.rows.length) return res.status(404).json({ error: "Job not found" });

      const job = jobResult.rows[0];
      if (job.client_id !== clientId) return res.status(403).json({ error: "This job does not belong to you" });
      if (job.created_via === "search_scaffold") {
        return res.status(400).json({ error: "Search placeholders cannot be used to invite talent" });
      }
      if (job.status !== "open" || job.approval_status !== "approved") {
        return res.status(400).json({ error: "Only open, approved job postings can be used to invite talent" });
      }

      const searchText = typeof req.body?.searchText === "string" ? req.body.searchText.trim() : "";
      if (searchText.length > 120) return res.status(400).json({ error: "Search text must be 120 characters or fewer" });
      const terms = searchText.toLowerCase().split(/\s+/).filter(Boolean);

      // Search the complete eligible population first. Limiting before text
      // filtering caused valid low-score candidates to disappear.
      const ranked = await storage.rankTalentForJob(jobId, Number.POSITIVE_INFINITY);
      const filtered = terms.length
        ? ranked.filter((result) => {
            const candidate = result.candidate ?? {};
            const safeCandidate = sanitizeSearchCandidate(candidate);
            const searchable = [
              safeCandidate.maskedName,
              candidate.targetPosition,
              candidate.headline,
              candidate.summary,
              candidate.category,
              candidate.seniority,
              candidate.location,
              candidate.experienceYears,
              ...(Array.isArray(candidate.coreSkills) ? candidate.coreSkills : []),
              ...(Array.isArray(candidate.secondarySkills) ? candidate.secondarySkills : []),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return terms.every((term: string) => searchable.includes(term));
          })
        : ranked;
      const visibleResults = filtered.slice(0, 50);

      const talentIds = visibleResults.map((result) => result.userId);
      const invitations = talentIds.length
        ? await query(
            `SELECT DISTINCT talent_id
               FROM job_submissions
              WHERE client_id = $1
                AND job_id = $2
                AND talent_id = ANY($3::text[])
                AND (workflow_type = 'client_invitation'
                  OR (workflow_type = 'application' AND initiated_by = 'client' AND status <> 'shortlisted'))
                AND status NOT IN ('declined', 'rejected', 'withdrawn')`,
            [clientId, jobId, talentIds],
          )
        : { rows: [] as Array<{ talent_id: string }> };

      return res.json({
        results: visibleResults.map((result) => ({
          candidateId: result.candidateId,
          userId: result.userId,
          score: result.score,
          overlapSkills: result.overlapSkills,
          matchReasons: result.matchReasons,
          candidate: sanitizeSearchCandidate(result.candidate),
        })),
        invitedTalentIds: invitations.rows.map((row: any) => row.talent_id),
      });
    } catch (err: any) {
      console.error("POST /api/client/jobs/:jobId/talent-search error:", err);
      return res.status(500).json({ error: "We couldn't load talent right now. Please try again." });
    }
  });

  // PATCH /api/client/talent-search/:jobId — REMOVED.
  // Engagement-type rescoring is now handled by re-calling POST /api/client/talent-search
  // with the new engagementType — no stored scaffold row to update.
  // Route intentionally omitted; any remaining client calls will receive 404.

  // GET /api/client/invitations/check — given a list of talentUserIds, return which are already invited by this client
  app.get("/api/client/invitations/check", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const clientId = (req as any).user?.id;
      if (!clientId) return res.status(401).json({ error: "Unauthorized" });

      // Accept talentUserIds as a comma-separated query param or repeated param
      const raw = req.query.talentUserIds;
      let talentUserIds: string[] = [];
      if (Array.isArray(raw)) {
        talentUserIds = (raw as string[]).filter(Boolean);
      } else if (typeof raw === "string" && raw.trim()) {
        talentUserIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
      }

      if (talentUserIds.length === 0) {
        return res.json({ invitedIds: [] });
      }

      const result = await query(
        `SELECT DISTINCT talent_id
         FROM job_submissions
         WHERE client_id = $1
           AND talent_id = ANY($2::text[])
           AND workflow_type = 'client_invitation'
           AND status NOT IN ('declined', 'rejected', 'withdrawn')`,
        [clientId, talentUserIds],
      );

      return res.json({ invitedIds: result.rows.map((r: any) => r.talent_id) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Private Client favorites ───────────────────────────────────────────────
  // Favorites are intentionally not job-specific. Do not convert them into
  // shortlists, invitations, submissions, messages, or notifications.
  app.get("/api/client/favorites", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const clientId = (req as any).user?.id;
      if (!clientId) return res.status(401).json({ error: "Unauthorized" });

      const result = await query(
        `SELECT id,
                talent_id AS "talentId",
                created_at AS "createdAt"
           FROM client_talent_favorites
          WHERE client_id = $1
          ORDER BY created_at DESC`,
        [clientId],
      );
      return res.json({ favorites: result.rows });
    } catch (err: any) {
      console.error("GET /api/client/favorites error:", err);
      return res.status(500).json({ error: "Failed to load favorites" });
    }
  });

  app.post("/api/client/favorites", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const clientId = (req as any).user?.id;
      const talentUserId = req.body?.talentUserId;
      if (!clientId) return res.status(401).json({ error: "Unauthorized" });
      if (
        typeof talentUserId !== "string" ||
        !talentUserId.trim() ||
        talentUserId.length > 200 ||
        talentUserId === clientId
      ) {
        return res.status(400).json({ error: "A valid talent user ID is required" });
      }

      // Only linked talent accounts can be favorited. This prevents a Client
      // from using this private relationship as an arbitrary user bookmark.
      const talent = await query(
        `SELECT u.id
           FROM users u
          WHERE u.id = $1
            AND u.role = 'talent'
            AND EXISTS (
              SELECT 1 FROM candidates c WHERE c.user_id = u.id
            )
          LIMIT 1`,
        [talentUserId],
      );
      if (!talent.rows.length) {
        return res.status(404).json({ error: "Talent profile not found" });
      }

      const inserted = await query(
        `INSERT INTO client_talent_favorites (client_id, talent_id)
         VALUES ($1, $2)
         ON CONFLICT (client_id, talent_id) DO NOTHING
         RETURNING id, talent_id AS "talentId", created_at AS "createdAt"`,
        [clientId, talentUserId],
      );
      if (inserted.rows.length) {
        return res.status(201).json({ ...inserted.rows[0], alreadyFavorited: false });
      }

      const existing = await query(
        `SELECT id, talent_id AS "talentId", created_at AS "createdAt"
           FROM client_talent_favorites
          WHERE client_id = $1 AND talent_id = $2`,
        [clientId, talentUserId],
      );
      return res.json({ ...existing.rows[0], alreadyFavorited: true });
    } catch (err: any) {
      console.error("POST /api/client/favorites error:", err);
      return res.status(500).json({ error: "Failed to save favorite" });
    }
  });

  app.delete("/api/client/favorites/:talentUserId", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const clientId = (req as any).user?.id;
      const talentUserId = req.params.talentUserId;
      if (!clientId) return res.status(401).json({ error: "Unauthorized" });
      if (!talentUserId || talentUserId.length > 200) {
        return res.status(400).json({ error: "A valid talent user ID is required" });
      }

      const result = await query(
        `DELETE FROM client_talent_favorites
          WHERE client_id = $1 AND talent_id = $2
          RETURNING id`,
        [clientId, talentUserId],
      );
      if (!result.rows.length) return res.status(404).json({ error: "Favorite not found" });
      return res.status(204).send();
    } catch (err: any) {
      console.error("DELETE /api/client/favorites error:", err);
      return res.status(500).json({ error: "Failed to remove favorite" });
    }
  });

  // GET /api/client/shortlists — silent, client-owned shortlist rows.
  // These rows intentionally do not appear in talent applications or trigger
  // invitation/status notifications until the client promotes one to an invite.
  app.get("/api/client/shortlists", authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const clientId = (req as any).user?.id;
      if (!clientId) return res.status(401).json({ error: "Unauthorized" });
      const result = await query(
        `SELECT js.id,
                js.job_id AS "jobId",
                js.talent_id AS "talentId",
                c.id AS "candidateId",
                js.status,
                j.title AS "jobTitle",
                j.status AS "jobStatus",
                j.approval_status AS "approvalStatus",
                js.created_at AS "createdAt",
                js.updated_at AS "updatedAt"
           FROM job_submissions js
           JOIN jobs j ON j.id = js.job_id
           LEFT JOIN candidates c
             ON c.user_id = js.talent_id
             OR (c.user_id IS NULL AND lower(c.email) = lower(js.email))
          WHERE js.client_id = $1
            AND js.workflow_type = 'client_shortlist'
            AND js.status = 'shortlisted'
          ORDER BY js.updated_at DESC`,
        [clientId],
      );
      return res.json({ shortlists: result.rows });
    } catch (err: any) {
      console.error("GET /api/client/shortlists error:", err);
      return res.status(500).json({ error: "Failed to load shortlists" });
    }
  });

  // POST /api/client/shortlists — save a talent against one real client role.
  // No MSA, interview proposal, email, or talent notification is involved.
  app.post("/api/client/shortlists", pipelineMutationLimiter, authenticateJWT, requireClient, async (req: Request, res: Response) => {
    const clientId = (req as any).user?.id;
    if (!clientId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { jobId, talentUserId: requestedTalentUserId, candidateId } = req.body ?? {};
      if (
        typeof jobId !== "string" ||
        jobId.length > 200 ||
        (requestedTalentUserId !== undefined &&
          (typeof requestedTalentUserId !== "string" || requestedTalentUserId.length > 200)) ||
        (candidateId !== undefined &&
          (typeof candidateId !== "string" || candidateId.length > 200)) ||
        (typeof requestedTalentUserId !== "string" && typeof candidateId !== "string")
      ) {
        return res.status(400).json({ error: "jobId and a talent user or candidate ID are required" });
      }

      const txClient = await pool.connect();
      try {
        await txClient.query("BEGIN");
        let talentUserId = typeof requestedTalentUserId === "string" ? requestedTalentUserId : null;
        if (!talentUserId && typeof candidateId === "string") {
          const candidateResult = await txClient.query(
            `SELECT u.id
               FROM candidates c
               JOIN users u
                 ON u.role = 'talent'
                AND (u.id = c.user_id
                  OR (c.user_id IS NULL AND lower(u.email) = lower(c.email)))
              WHERE c.id = $1
              LIMIT 1`,
            [candidateId],
          );
          talentUserId = candidateResult.rows[0]?.id ?? null;
        }
        if (!talentUserId) {
          await txClient.query("ROLLBACK");
          return res.status(400).json({ error: "Target candidate is not linked to a talent account" });
        }

        await txClient.query(
          `SELECT pg_advisory_xact_lock(hashtext('shortlist:' || $1 || ':' || $2 || ':' || $3))`,
          [clientId, talentUserId, jobId],
        );

        const jobResult = await txClient.query(
          `SELECT id, title, status, approval_status, created_via
             FROM jobs
            WHERE id = $1 AND client_id = $2
            LIMIT 1`,
          [jobId, clientId],
        );
        if (!jobResult.rows.length) {
          await txClient.query("ROLLBACK");
          return res.status(404).json({ error: "job_not_found", message: "This role is not available to your account." });
        }
        const job = jobResult.rows[0];
        if (job.created_via === "search_scaffold") {
          await txClient.query("ROLLBACK");
          return res.status(403).json({
            error: "job_not_shortlistable",
            reason: "scaffold_only",
            message: "This search placeholder is not a role. Create a real job posting before saving talent.",
          });
        }
        if (job.status !== "open") {
          await txClient.query("ROLLBACK");
          return res.status(403).json({
            error: "job_not_shortlistable",
            reason: "closed",
            message: "This role is closed. Reopen it or choose another role.",
          });
        }

        const targetUser = await txClient.query(
          `SELECT id, email FROM users WHERE id = $1 AND role = 'talent' LIMIT 1`,
          [talentUserId],
        );
        if (!targetUser.rows.length) {
          await txClient.query("ROLLBACK");
          return res.status(400).json({ error: "Target account is not a talent user" });
        }

        const existingInvite = await txClient.query(
          `SELECT id
             FROM job_submissions
            WHERE client_id = $1 AND job_id = $2 AND talent_id = $3
           AND (
             workflow_type = 'client_invitation'
             OR (workflow_type = 'application' AND initiated_by = 'client' AND status <> 'shortlisted')
           )
              AND status NOT IN ('declined', 'rejected', 'withdrawn')
            LIMIT 1`,
          [clientId, jobId, talentUserId],
        );
        if (existingInvite.rows.length) {
          await txClient.query("ROLLBACK");
          return res.status(409).json({ error: "already_invited", message: "This talent has already been invited to this role." });
        }

        const existingShortlist = await txClient.query(
          `SELECT id
             FROM job_submissions
            WHERE client_id = $1 AND job_id = $2 AND talent_id = $3
              AND workflow_type = 'client_shortlist' AND status = 'shortlisted'
            LIMIT 1`,
          [clientId, jobId, talentUserId],
        );
        if (existingShortlist.rows.length) {
          await txClient.query("ROLLBACK");
          return res.status(200).json({
            id: existingShortlist.rows[0].id,
            alreadyShortlisted: true,
            jobId,
            talentId: talentUserId,
          });
        }

        const talentResult = await txClient.query(
          `SELECT c.first_name, c.last_name, c.full_name
             FROM candidates c
            WHERE c.user_id = $1
            LIMIT 1`,
          [talentUserId],
        );
        const talent = talentResult.rows[0] ?? {};
        const name = talent.full_name ||
          [talent.first_name, talent.last_name].filter(Boolean).join(" ") ||
          "Talent";
        const inserted = await txClient.query(
          `INSERT INTO job_submissions
             (id, job_id, client_id, applicant_name, first_name, last_name, email,
              status, initiated_by, workflow_type, talent_id, registration_status, combined_invite_reveal)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'shortlisted', 'client',
                   'client_shortlist', $7, 'linked', false)
          RETURNING id`,
          [
            jobId,
            clientId,
            name,
            talent.first_name ?? name,
            talent.last_name ?? "",
            targetUser.rows[0].email ?? "",
            talentUserId,
          ],
        );
        await txClient.query("COMMIT");
        return res.status(201).json({
          id: inserted.rows[0].id,
          alreadyShortlisted: false,
          jobId,
          talentId: talentUserId,
          jobTitle: job.title,
        });
      } catch (txErr) {
        await txClient.query("ROLLBACK").catch(() => {});
        throw txErr;
      } finally {
        txClient.release();
      }
    } catch (err: any) {
      console.error("POST /api/client/shortlists error:", err);
      return res.status(500).json({ error: "Failed to save shortlist" });
    }
  });

  app.delete("/api/client/shortlists/:id", pipelineMutationLimiter, authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const clientId = (req as any).user?.id;
      if (!clientId) return res.status(401).json({ error: "Unauthorized" });
      const result = await query(
        `DELETE FROM job_submissions
          WHERE id = $1 AND client_id = $2
            AND workflow_type = 'client_shortlist' AND status = 'shortlisted'
        RETURNING id`,
        [req.params.id, clientId],
      );
      if (!result.rows.length) return res.status(404).json({ error: "Shortlist not found" });
      return res.status(204).send();
    } catch (err: any) {
      console.error("DELETE /api/client/shortlists error:", err);
      return res.status(500).json({ error: "Failed to remove shortlist" });
    }
  });

  const normalizeMeetingLink = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    if (typeof value !== "string" || value.length > 2048) return undefined;
    try {
      const parsed = new URL(value);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : undefined;
    } catch {
      return undefined;
    }
  };

  // POST /api/client/invitations — invite a specific talent to one of the client's real job postings.
  // jobId must reference a job that: (a) is owned by the authenticated client,
  // (b) has status='open' and approval_status='approved', and (c) is NOT a search scaffold.
  // Scaffold jobs were never meant to be client-manageable postings and are explicitly rejected.
  app.post("/api/client/invitations", pipelineMutationLimiter, authenticateJWT, requireClient, async (req: Request, res: Response) => {
    try {
      const clientId = (req as any).user?.id;
      if (!clientId) return res.status(401).json({ error: "Unauthorized" });

      const {
        jobId,
        talentUserId: requestedTalentUserId,
        candidateId,
        proposedTimes,
        interviewType = "initial",
        candidateNotes,
      } = req.body ?? {};
      if (
        typeof jobId !== "string" ||
        jobId.length > 200 ||
        (requestedTalentUserId !== undefined &&
          (typeof requestedTalentUserId !== "string" || requestedTalentUserId.length > 200)) ||
        (candidateId !== undefined &&
          (typeof candidateId !== "string" || candidateId.length > 200)) ||
        (typeof requestedTalentUserId !== "string" && typeof candidateId !== "string")
      ) {
        return res.status(400).json({ error: "jobId and a talent user or candidate ID are required" });
      }
       if (candidateNotes !== undefined &&
           (typeof candidateNotes !== "string" || candidateNotes.length > 5000)) {
         return res.status(400).json({ error: "candidateNotes must be no longer than 5000 characters" });
       }
       const normalizedTimes = normalizeInterviewTimes(proposedTimes);
       if (!normalizedTimes) {
         return res.status(400).json({ error: "proposedTimes must contain one to ten valid time slots" });
       }
       const validInterviewTypes = ["initial", "technical", "final", "culture", "other"];
       if (!validInterviewTypes.includes(interviewType)) {
         return res.status(400).json({ error: "interviewType is invalid" });
       }

       const txClient = await pool.connect();
       let created: any;
       let talent: any;
       let jobTitle = "a new role";
       let jobDescription: string | null = null;
       let notificationCreated = false;
       try {
         await txClient.query("BEGIN");
        let talentUserId: string | null =
          typeof requestedTalentUserId === "string" ? requestedTalentUserId : null;
        if (!talentUserId && typeof candidateId === "string") {
          const candidateRow = await txClient.query(
            `SELECT u.id AS user_id
               FROM candidates c
               JOIN users u
                 ON u.role = 'talent'
                AND (u.id = c.user_id
                  OR (c.user_id IS NULL AND lower(u.email) = lower(c.email)))
              WHERE c.id = $1
              LIMIT 1`,
            [candidateId],
          );
          talentUserId = candidateRow.rows[0]?.user_id ?? null;
        }
        if (!talentUserId) {
          await txClient.query("ROLLBACK");
          return res.status(400).json({ error: "Target candidate is not linked to a talent account" });
        }
         await txClient.query(
           `SELECT pg_advisory_xact_lock(hashtext('invite:' || $1 || ':' || $2 || ':' || $3))`,
           [clientId, talentUserId, jobId],
         );
          const jobCheck = await txClient.query(
            `SELECT id, title, description, status, approval_status, created_via FROM jobs
             WHERE id = $1 AND client_id = $2`,
            [jobId, clientId],
          );
          if (!jobCheck.rows.length) {
           await txClient.query("ROLLBACK");
           return res.status(403).json({ error: "Job not found, not owned by you, or not an open approved posting" });
         }
          const selectedJob = jobCheck.rows[0];
          if (selectedJob.created_via === "search_scaffold") {
            await txClient.query("ROLLBACK");
            return res.status(403).json({
              error: "job_not_invitable",
              reason: "scaffold_only",
              message: "This search placeholder is not a job posting. Create a real job posting before inviting talent.",
            });
          }
          if (selectedJob.status !== "open") {
            await txClient.query("ROLLBACK");
            return res.status(403).json({
              error: "job_not_invitable",
              reason: ["closed", "cancelled", "completed"].includes(selectedJob.status) ? "closed_jobs" : "not_open",
              message: "This job is not open for invitations. Reopen an approved job posting before inviting talent.",
            });
          }
          if (selectedJob.approval_status !== "approved") {
            await txClient.query("ROLLBACK");
            return res.status(403).json({
              error: "job_not_invitable",
              reason: selectedJob.approval_status === "pending" ? "pending_approval" : "not_approved",
              message: selectedJob.approval_status === "pending"
                ? "This job is awaiting approval. You can send invitations after an admin approves it."
                : "This job is not approved for invitations.",
            });
          }

          // Serialize all first invites for a client so parallel requests cannot
          // bypass the durable MSA acceptance gate. This check follows job
          // validation so the response always describes the actual blocker.
          await txClient.query(
            `SELECT pg_advisory_xact_lock(hashtext('invite-client:' || $1))`,
            [clientId],
          );
          const firstInvite = await txClient.query(
            `SELECT NOT EXISTS (
               SELECT 1 FROM job_submissions
             WHERE client_id = $1
               AND (workflow_type = 'client_invitation'
                 OR (workflow_type = 'application' AND initiated_by = 'client'))
             ) AS is_first`,
            [clientId],
          );
          if (firstInvite.rows[0]?.is_first) {
            const msa = await txClient.query(
              `SELECT msa_accepted_at, msa_version FROM client_profiles WHERE user_id = $1 LIMIT 1`,
              [clientId],
            );
            if (
              !msa.rows[0]?.msa_accepted_at ||
              msa.rows[0]?.msa_version !== CURRENT_MSA_VERSION
            ) {
              await txClient.query("ROLLBACK");
              return res.status(428).json({
                error: "msa_required",
                message: "Accept the Terms of Service before sending your first talent invitation.",
                termsUrl: CLIENT_TERMS_URL,
              });
            }
          }
         jobTitle = jobCheck.rows[0].title ?? jobTitle;
         jobDescription = jobCheck.rows[0].description ?? null;

        const targetUser = await txClient.query(
           `SELECT id, role FROM users WHERE id = $1 LIMIT 1`,
           [talentUserId],
         );
         if (!targetUser.rows.length || targetUser.rows[0].role !== "talent") {
           await txClient.query("ROLLBACK");
           return res.status(400).json({ error: "Target account is not a talent user" });
         }
         const existing = await txClient.query(
           `SELECT id FROM job_submissions
             WHERE client_id = $1 AND job_id = $2 AND talent_id = $3
               AND (
                 workflow_type = 'client_invitation'
                 OR (workflow_type = 'application' AND initiated_by = 'client' AND status <> 'shortlisted')
               )
               AND status NOT IN ('declined', 'rejected', 'withdrawn')`,
           [clientId, jobId, talentUserId],
         );
         if (existing.rows.length > 0) {
           await txClient.query("ROLLBACK");
           return res.status(409).json({ error: "already_invited", message: "This talent has already been invited" });
         }
         const talentRow = await txClient.query(
           `SELECT c.first_name, c.last_name, c.full_name, u.email
              FROM candidates c
              JOIN users u ON u.id = c.user_id
             WHERE c.user_id = $1 LIMIT 1`,
           [talentUserId],
         );
         talent = talentRow.rows[0] ?? {};
         const name = talent.full_name ||
           [talent.first_name, talent.last_name].filter(Boolean).join(" ") ||
           "Invited Talent";
         const email = talent.email ?? "";

         const existingShortlist = await txClient.query(
           `SELECT id FROM job_submissions
             WHERE client_id = $1 AND job_id = $2 AND talent_id = $3
               AND workflow_type = 'client_shortlist' AND status = 'shortlisted'
             LIMIT 1`,
           [clientId, jobId, talentUserId],
         );
         const submissionResult = existingShortlist.rows.length
           ? await txClient.query(
               `UPDATE job_submissions
                   SET status = 'invited',
                       workflow_type = 'client_invitation',
                       combined_invite_reveal = true,
                       updated_at = NOW()
                 WHERE id = $1
                RETURNING id`,
               [existingShortlist.rows[0].id],
             )
           : await txClient.query(
               `INSERT INTO job_submissions
                  (id, job_id, client_id, applicant_name, first_name, last_name, email,
                    status, initiated_by, workflow_type, talent_id, registration_status, combined_invite_reveal)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'invited', 'client',
                        'client_invitation', $7, 'linked', true)
               RETURNING id`,
               [
                 jobId, clientId, name, talent.first_name ?? name, talent.last_name ?? "",
                 email, talentUserId,
               ],
             );
         created = submissionResult.rows[0];
         if (existingShortlist.rows.length) {
           await txClient.query(
             `INSERT INTO job_application_status_history
                (application_id, previous_status, new_status, note, changed_by)
              VALUES ($1, 'shortlisted', 'invited', 'Client promoted a shortlist to an interview invitation', $2)`,
             [created.id, clientId],
           );
         }
         if (normalizedTimes) {
           const interviewResult = await txClient.query(
             `INSERT INTO interviews
                (submission_id, round_number, interview_type, status, proposed_times,
                 current_proposal_owner, proposal_exchange_count, candidate_notes, created_by)
               VALUES ($1, 1, $2, 'proposed', $3, 'talent', 0, $4, $5)
              RETURNING *`,
             [created.id, interviewType, JSON.stringify(normalizedTimes), candidateNotes ?? null, clientId],
           );
           await txClient.query(
             `INSERT INTO interview_proposals
                (interview_id, proposer_id, proposer_role, action, proposed_times)
              VALUES ($1, $2, 'client', 'initial', $3)`,
             [interviewResult.rows[0].id, clientId, JSON.stringify(normalizedTimes)],
           );
           created.interview = interviewResult.rows[0];
         }
          await txClient.query(
            `INSERT INTO notifications
               (user_id, type, title, message, related_id, related_type, event_key, is_read)
             VALUES ($1, 'job_invitation', $2, $3, $4, 'job_submission', $5, false)
             ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`,
            [
              talentUserId,
              "You've been invited to apply",
              `A client has invited you to apply for “${jobTitle}”.`,
              created.id,
              `job_invitation:${created.id}`,
            ],
          );
          notificationCreated = true;
         await txClient.query("COMMIT");
          console.log(`[TalentInvitationNotification] Created submissionId=${created.id} talentUserId=${talentUserId}`);
       } catch (txErr: any) {
         await txClient.query("ROLLBACK").catch(() => {});
         throw txErr;
       } finally {
         txClient.release();
       }

       const emailResult = await fireInvitationEmail({
         talentEmail: talent.email ?? "",
         talentName: talent.full_name ||
           [talent.first_name, talent.last_name].filter(Boolean).join(" ") ||
           "Invited Talent",
         jobTitle,
         jobDescription,
         submissionId: created.id,
       });

       return res.status(201).json({
         id: created.id,
          combinedInvite: true,
         interview: created.interview ?? null,
          invitationCreated: true,
          notificationCreated,
          emailSent: emailResult.success,
        });
    } catch (err: any) {
       console.error("POST /api/client/invitations error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/talent/invitations — talent sees their pending role invitations
  app.get("/api/talent/invitations", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const result = await query(
        `SELECT js.id,
                js.job_id        AS "jobId",
                js.status,
                js.created_at    AS "createdAt",
                j.title          AS "jobTitle",
                j.category       AS "jobCategory",
                j.engagement_type AS "engagementType",
                j.salary_display AS "salaryDisplay",
                j.budget_currency AS "budgetCurrency",
                 i.id            AS "interviewId",
                 i.status        AS "interviewStatus",
                 i.proposed_times AS "proposedTimes",
                 i.confirmed_time AS "confirmedTime",
                 i.confirmed_time_zone AS "confirmedTimeZone",
                 i.current_proposal_owner AS "currentProposalOwner",
                 i.meeting_link AS "meetingLink",
                 i.proposal_exchange_count AS "proposalExchangeCount",
                -- Never expose internal scaffold descriptions to talent
                CASE WHEN j.created_via = 'search_scaffold' THEN NULL ELSE j.description END AS "description"
         FROM job_submissions js
         JOIN jobs j ON j.id = js.job_id
          LEFT JOIN LATERAL (
            SELECT * FROM interviews
             WHERE submission_id = js.id
             ORDER BY created_at DESC
             LIMIT 1
          ) i ON true
         WHERE js.talent_id = $1
           AND js.status = 'invited'
         ORDER BY js.created_at DESC`,
        [userId],
      );

      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/talent/invitations/:id/respond — accept (→ submitted) or decline an invitation
  app.post("/api/talent/invitations/:id/respond", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { id } = req.params;
      const { action } = req.body;
      if (!["accept", "decline"].includes(action)) {
        return res.status(400).json({ error: "action must be 'accept' or 'decline'" });
      }

      // Ownership check for friendly 404 (the authoritative status check is the
      // conditional UPDATE below, which is race-safe).
      const check = await query(
        `SELECT id FROM job_submissions WHERE id = $1 AND talent_id = $2`,
        [id, userId],
      );
      if (!check.rows.length) return res.status(404).json({ error: "Invitation not found" });

      // Canonical DB values: accept → 'new' (display alias 'submitted'), decline → 'declined'
      const newStatus = action === "accept" ? "new" : "declined";

      if (action !== "accept") {
        // Atomic transition: only flips if still pending; concurrent accept/decline
        // requests cannot both win.
        const declined = await query(
          `UPDATE job_submissions SET status = $1, updated_at = NOW()
           WHERE id = $2 AND talent_id = $3 AND status = 'invited'
           RETURNING id`,
          [newStatus, id, userId],
        );
        if (!declined.rows.length) {
          return res.status(409).json({ error: "This invitation is no longer pending" });
        }
        return res.json({ status: newStatus, threadId: null });
      }

      // Acceptance opens an in-platform message thread between client and talent
      // (so interviews can be scheduled without exchanging contact details).
      // The conditional status transition and thread creation run in one
      // transaction on a dedicated connection: only the request that wins the
      // 'invited' → 'submitted' transition creates the thread, and acceptance
      // never silently succeeds without the required communication channel.
      let threadId: string;
      const txClient = await pool.connect();
      try {
        await txClient.query("BEGIN");
        // Only client-initiated invitations can be accepted into a messaging
        // relationship — talent-initiated (legacy/malformed) 'invited' rows never
        // create a thread or reveal identities.
        const updated = await txClient.query(
          `UPDATE job_submissions SET status = $1, updated_at = NOW()
           WHERE id = $2 AND talent_id = $3 AND status = 'invited' AND initiated_by = 'client'
           RETURNING client_id, job_id`,
          [newStatus, id, userId],
        );
        if (!updated.rows.length) {
          await txClient.query("ROLLBACK");
          return res.status(409).json({ error: "This invitation is no longer pending" });
        }
        const { client_id: clientId, job_id: jobId } = updated.rows[0];
        const jobRow = jobId
          ? await txClient.query(`SELECT title FROM jobs WHERE id = $1`, [jobId])
          : { rows: [] as any[] };
        const jobTitle = jobRow.rows[0]?.title ?? null;
        if (!clientId || clientId === userId) {
          throw new Error("Invitation has no valid inviting client");
        }
        // Serialize thread creation per client/talent pair so concurrent accepts
        // cannot create duplicate threads (lock released at COMMIT/ROLLBACK).
        await txClient.query(
          `SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':' || COALESCE($3, '')))`,
          [clientId, userId, jobId ?? null],
        );
        // Thread graduation: if the talent and client were already messaging
        // via a pre-invite direct-message thread (job_id IS NULL), continue
        // that same thread so conversation history is preserved. Job context
        // lives on job_submissions — it doesn't need to be duplicated onto the
        // thread row. If no pre-invite thread exists, create a new null-job_id
        // thread now. Either way, post a system message so both sides know the
        // invitation has been accepted.
        const systemMsg = jobTitle
          ? `Invitation accepted — ${jobTitle}. You can now coordinate next steps, such as scheduling an interview.`
          : "Invitation accepted. You can use this thread to coordinate next steps, such as scheduling an interview.";
        const preInviteThread = await txClient.query(
          `SELECT id FROM message_threads
           WHERE participants @> ARRAY[$1, $2]::text[]
             AND participants <@ ARRAY[$1, $2]::text[]
             AND job_id IS NULL
           LIMIT 1`,
          [clientId, userId],
        );
        if (preInviteThread.rows.length) {
          // Graduation: reuse the existing direct-message thread.
          threadId = preInviteThread.rows[0].id;
        } else {
          // No prior thread — create a new null-job_id thread.
          const created = await txClient.query(
            `INSERT INTO message_threads (job_id, participants, subject)
             VALUES (NULL, ARRAY[$1, $2]::text[], $3)
             RETURNING id`,
            [
              clientId,
              userId,
              jobTitle ? `Invitation accepted — ${jobTitle}` : "Invitation accepted",
            ],
          );
          threadId = created.rows[0].id;
        }
        // System message so neither side opens an empty thread
        await txClient.query(
          `INSERT INTO messages (thread_id, sender_id, content, message_type)
           VALUES ($1, $2, $3, 'system')`,
          [threadId, userId, systemMsg],
        );
        await txClient.query("COMMIT");
      } catch (threadErr: any) {
        await txClient.query("ROLLBACK").catch(() => {});
        console.error("Invitation accept failed (rolled back):", threadErr);
        return res
          .status(500)
          .json({ error: "Failed to accept invitation. Please try again." });
      } finally {
        txClient.release();
      }

      return res.json({ status: newStatus, threadId });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/talent/interviews — proposed/confirmed interviews for the
  // authenticated talent, including immutable proposal history.
  app.get("/api/talent/interviews", authenticateTalentJWT, async (req: Request, res: Response) => {
    try {
      const candidateId = (req as any).talentAuth?.candidateId;
      const talentUserResult = await query(
        `SELECT c.user_id AS user_id
           FROM candidates c
           JOIN users u ON u.id = c.user_id AND u.role = 'talent'
          WHERE c.id = $1
          UNION ALL
         SELECT u.id AS user_id
           FROM candidates c
           JOIN users u ON lower(u.email) = lower(c.email) AND u.role = 'talent'
          WHERE c.id = $1 AND c.user_id IS NULL
          LIMIT 1`,
        [candidateId],
      );
      const userId = talentUserResult.rows[0]?.user_id;
      if (!userId) return res.status(404).json({ error: "Talent profile not found" });
      const result = await query(
        `SELECT i.*, js.status AS submission_status, js.id AS submission_id,
                j.title AS job_title, j.company AS job_company,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', ip.id,
                      'action', ip.action,
                      'proposerRole', ip.proposer_role,
                      'proposedTimes', ip.proposed_times,
                      'selectedTime', ip.selected_time,
                      'selectedTimeZone', ip.selected_time_zone,
                      'createdAt', ip.created_at
                    ) ORDER BY ip.created_at ASC
                  ) FILTER (WHERE ip.id IS NOT NULL),
                  '[]'::json
                ) AS proposals
           FROM interviews i
           JOIN job_submissions js ON js.id = i.submission_id
           JOIN jobs j ON j.id = js.job_id
           LEFT JOIN interview_proposals ip ON ip.interview_id = i.id
          WHERE js.talent_id = $1
            AND i.status IN ('proposed', 'rescheduled', 'confirmed', 'cancelled')
          GROUP BY i.id, js.status, js.id, j.title, j.company
          ORDER BY i.created_at DESC`,
        [userId],
      );
      return res.json(result.rows.map((row: any) => ({
        id: row.id,
        submissionId: row.submission_id,
        submissionStatus: row.submission_status,
        job: { title: row.job_title, company: row.job_company || "OnSpot" },
        roundNumber: row.round_number,
        interviewType: row.interview_type,
        status: row.status,
        proposedTimes: row.proposed_times ?? [],
        confirmedTime: row.confirmed_time,
        confirmedTimeZone: row.confirmed_time_zone ?? "UTC",
        currentProposalOwner: row.current_proposal_owner,
        meetingLink: row.meeting_link,
        durationMinutes: row.duration_minutes ?? null,
        cancelledAt: row.cancelled_at ?? null,
        cancellationReason: row.cancellation_reason ?? null,
        proposalExchangeCount: Number(row.proposal_exchange_count ?? 0),
        proposals: row.proposals ?? [],
        nudge: Number(row.proposal_exchange_count ?? 0) >= 3 && row.status !== "confirmed",
      })));
    } catch (err: any) {
      console.error("GET /api/talent/interviews error:", err);
      return res.status(500).json({ error: "Failed to load interviews" });
    }
  });

  // PATCH /api/talent/interviews/:id/respond — accept a slot, decline the
  // pipeline, or counter-propose. Negotiation never changes round_number.
  app.patch("/api/talent/interviews/:id/respond", pipelineMutationLimiter, authenticateTalentJWT, async (req: Request, res: Response) => {
    const candidateId = (req as any).talentAuth?.candidateId;
    const talentUserResult = await query(
      `SELECT c.user_id AS user_id
         FROM candidates c
         JOIN users u ON u.id = c.user_id AND u.role = 'talent'
        WHERE c.id = $1
        UNION ALL
       SELECT u.id AS user_id
         FROM candidates c
         JOIN users u ON lower(u.email) = lower(c.email) AND u.role = 'talent'
        WHERE c.id = $1 AND c.user_id IS NULL
        LIMIT 1`,
      [candidateId],
    );
    const userId = talentUserResult.rows[0]?.user_id;
    if (!userId) return res.status(404).json({ error: "Talent profile not found" });
    const { action, selectedTime, proposedTimes } = req.body ?? {};
    if (!["accept", "decline", "counter"].includes(action)) {
      return res.status(400).json({ error: "action must be 'accept', 'decline', or 'counter'" });
    }
    let confirmedEmailParams: {
      talentUserId: string;
      jobTitle: string;
      confirmedTime: string;
      confirmedTimeZone: string;
      durationMinutes: number | null;
      meetingLink: string | null;
      interviewType: string | undefined;
      roundNumber: number | null;
    } | null = null;
    const txClient = await pool.connect();
    try {
      await txClient.query("BEGIN");
      const interviewResult = await txClient.query(
        `SELECT i.*, js.status AS submission_status, js.id AS submission_id, js.client_id,
                j.title AS job_title
           FROM interviews i
           JOIN job_submissions js ON js.id = i.submission_id
           JOIN jobs j ON j.id = js.job_id
          WHERE i.id = $1 AND js.talent_id = $2
          FOR UPDATE OF i`,
        [req.params.id, userId],
      );
      if (!interviewResult.rows.length) {
        await txClient.query("ROLLBACK");
        return res.status(404).json({ error: "Interview not found" });
      }
      const interview = interviewResult.rows[0];
      if (!["proposed", "rescheduled"].includes(interview.status)) {
        await txClient.query("ROLLBACK");
        return res.status(409).json({ error: "This interview is no longer awaiting a response" });
      }
      if (interview.current_proposal_owner !== "talent") {
        await txClient.query("ROLLBACK");
        return res.status(409).json({ error: "It is not your turn to respond to this proposal" });
      }

      if (action === "accept") {
        if (!selectedTime || Number.isNaN(parseInterviewTimestamp(selectedTime))) {
          await txClient.query("ROLLBACK");
          return res.status(400).json({ error: "selectedTime must be a valid ISO date" });
        }
        const selectedTimestamp = parseInterviewTimestamp(selectedTime);
        const selectedSlot = (Array.isArray(interview.proposed_times) ? interview.proposed_times : [])
          .find((slot: any) => typeof slot?.start === "string" && parseInterviewTimestamp(slot.start) === selectedTimestamp);
        if (Number.isNaN(selectedTimestamp) || !selectedSlot) {
          await txClient.query("ROLLBACK");
          return res.status(400).json({ error: "selectedTime must match one of the proposed slots" });
        }
        const canonicalSelectedTime = new Date(selectedTimestamp).toISOString();
        const selectedTimeZone = normalizeInterviewTimeZone(selectedSlot.timezone) ?? "UTC";

        // Per-talent advisory lock so two concurrent acceptances for the same
        // talent (different interview rows) cannot both pass the overlap check.
        await txClient.query(
          `SELECT pg_advisory_xact_lock(hashtext($1 || ':interview_confirm'))`,
          [userId],
        );

        // Conflict check: no other confirmed interview for this talent overlaps the selected slot
        {
          const effectiveDuration = interview.duration_minutes ?? 60;
          const slotEnd = new Date(selectedTimestamp + effectiveDuration * 60_000).toISOString();
          const conflict = await txClient.query(
            `SELECT 1 FROM interviews i2
               JOIN job_submissions js ON js.id = i2.submission_id
              WHERE js.talent_id = $1
                AND i2.id != $2
                AND i2.status = 'confirmed'
                AND i2.confirmed_time IS NOT NULL
                AND i2.confirmed_time < $4::timestamptz
                AND (i2.confirmed_time + INTERVAL '1 minute' * COALESCE(i2.duration_minutes, 60)) > $3::timestamptz
              LIMIT 1`,
            [userId, interview.id, canonicalSelectedTime, slotEnd],
          );
          if (conflict.rows.length > 0) {
            await txClient.query("ROLLBACK");
            return res.status(409).json({
              error: "interview_time_conflict",
              message: "That time overlaps another scheduled interview. Please choose another slot.",
            });
          }
        }

        await txClient.query(
          `UPDATE interviews
              SET status = 'confirmed', confirmed_time = $1, confirmed_time_zone = $2,
                  current_proposal_owner = NULL, updated_at = NOW()
             WHERE id = $3`,
          [canonicalSelectedTime, selectedTimeZone, interview.id],
        );
        await txClient.query(
          `INSERT INTO interview_proposals
             (interview_id, proposer_id, proposer_role, action, proposed_times, selected_time, selected_time_zone)
           VALUES ($1, $2, 'talent', 'accepted', $3, $4, $5)`,
          [interview.id, userId, JSON.stringify(interview.proposed_times ?? []), canonicalSelectedTime, selectedTimeZone],
        );
        if (interview.submission_status !== "interviewing") {
          await txClient.query(
            `UPDATE job_submissions SET status = 'interviewing', updated_at = NOW() WHERE id = $1`,
            [interview.submission_id],
          );
          await txClient.query(
            `INSERT INTO job_application_status_history
               (application_id, previous_status, new_status, note, changed_by)
             VALUES ($1, $2, 'interviewing', 'Talent confirmed an interview time', $3)`,
            [interview.submission_id, interview.submission_status, userId],
          );
        }
        confirmedEmailParams = {
          talentUserId: userId,
          jobTitle: interview.job_title,
          confirmedTime: canonicalSelectedTime,
          confirmedTimeZone: selectedTimeZone,
          durationMinutes: interview.duration_minutes ?? null,
          meetingLink: interview.meeting_link ?? null,
          interviewType: interview.interview_type ?? undefined,
          roundNumber: interview.round_number ?? null,
        };
      } else if (action === "counter") {
        const normalized = normalizeInterviewTimes(proposedTimes);
        if (!normalized) {
          await txClient.query("ROLLBACK");
          return res.status(400).json({ error: "proposedTimes must contain one to ten valid time slots" });
        }
        const nextCount = Number(interview.proposal_exchange_count ?? 0) + 1;
        await txClient.query(
          `UPDATE interviews
              SET status = 'proposed', proposed_times = $1,
                  current_proposal_owner = 'client',
                  proposal_exchange_count = $2,
                  confirmed_time = NULL, confirmed_time_zone = NULL, updated_at = NOW()
            WHERE id = $3`,
          [JSON.stringify(normalized), nextCount, interview.id],
        );
        await txClient.query(
          `INSERT INTO interview_proposals
             (interview_id, proposer_id, proposer_role, action, proposed_times)
           VALUES ($1, $2, 'talent', 'counter', $3)`,
          [interview.id, userId, JSON.stringify(normalized)],
        );
      } else {
        await txClient.query(
          `UPDATE interviews
              SET status = 'cancelled', outcome = 'declined',
                  current_proposal_owner = NULL, confirmed_time = NULL,
                  confirmed_time_zone = NULL, updated_at = NOW()
            WHERE id = $1`,
          [interview.id],
        );
        await txClient.query(
          `INSERT INTO interview_proposals
             (interview_id, proposer_id, proposer_role, action, proposed_times)
           VALUES ($1, $2, 'talent', 'declined', $3)`,
          [interview.id, userId, JSON.stringify(interview.proposed_times ?? [])],
        );
        if (!["declined", "withdrawn"].includes(interview.submission_status)) {
          await txClient.query(
            `UPDATE job_submissions SET status = 'declined', updated_at = NOW() WHERE id = $1`,
            [interview.submission_id],
          );
          await txClient.query(
            `INSERT INTO job_application_status_history
               (application_id, previous_status, new_status, note, changed_by)
             VALUES ($1, $2, 'declined', 'Talent declined the interview invitation', $3)`,
            [interview.submission_id, interview.submission_status, userId],
          );
        }
      }
      const updated = await txClient.query(`SELECT * FROM interviews WHERE id = $1`, [interview.id]);
      await txClient.query("COMMIT");

      // Fire-and-forget confirmation email when talent accepts — failure never rolls back the accept
      if (confirmedEmailParams) {
        sendInterviewConfirmedEmail(confirmedEmailParams).catch((e: any) =>
          console.error("talent accept interview confirmation email failed:", e),
        );
      }

      const exchangeCount = Number(updated.rows[0]?.proposal_exchange_count ?? 0);
      if (interview.client_id) {
        storage.createNotification({
          userId: interview.client_id,
          type: action === "accept" ? "interview_confirmed" : "interview_response",
          title: action === "accept" ? "Interview confirmed" : "Interview proposal updated",
          message: action === "decline"
            ? "A talent declined the interview invitation."
            : action === "counter"
              ? "A talent proposed different interview times."
              : "A talent confirmed an interview time.",
          relatedId: String(interview.id),
          relatedType: "interview",
        }).catch((notifyErr: any) => console.error("Interview notification failed:", notifyErr));
      }
      return res.json({
        ...updated.rows[0],
        nudge: action === "counter" && exchangeCount >= 3,
      });
    } catch (err: any) {
      await txClient.query("ROLLBACK").catch(() => {});
      console.error("PATCH /api/talent/interviews/:id/respond error:", err);
      return res.status(500).json({ error: "Failed to respond to interview proposal" });
    } finally {
      txClient.release();
    }
  });

  // ====== JOB SUBMISSIONS (Built-in Application Form) ======

  // GET /api/jobs/:jobId/application-prefill — returns prefilled candidate data for 1-Click Apply
  app.get("/api/jobs/:jobId/application-prefill", authenticateTalentJWT, async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const talentAuth = (req as any).talentAuth as { candidateId: string; email: string };

      // Load job
      const job = await storage.getJob(jobId);
      if (!job) return res.status(404).json({ error: "Job not found" });
      if ((job as any).applicationMethod === "external_link") {
        return res.status(400).json({ error: "This job uses an external application link" });
      }
      if (job.status !== "open") {
        return res.status(400).json({ error: "This job is not open for applications" });
      }

      // Load candidate
      const candidate = await storage.getCandidate(talentAuth.candidateId);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate profile not found" });
      }

      // Derive first/last name
      const firstName =
        candidate.firstName ||
        (candidate.fullName || "").split(" ").slice(0, -1).join(" ") ||
        (candidate.fullName || "").split(" ")[0] ||
        "";
      const lastName =
        candidate.lastName ||
        (candidate.fullName || "").split(" ").slice(-1)[0] ||
        "";

      // Load resume and video — candidates table is preferred (source of truth);
      // legacy documents table is consulted only when the candidates columns are absent.
      let resumes: any[] = [];
      let videos: any[] = [];

      // Primary source: candidates.resume_url / candidates.video_intro_url
      if (candidate.resumeUrl) {
        resumes.push({
          id: "profile-resume",
          fileName: (candidate as any).resumeFileName || "resume",
          fileUrl: candidate.resumeUrl,
          isPrimary: true,
          createdAt: null,
        });
      }
      if ((candidate as any).videoIntroUrl) {
        videos.push({
          id: "profile-video",
          fileName: (candidate as any).videoIntroFileName || "video-intro",
          fileUrl: (candidate as any).videoIntroUrl,
          isPrimary: true,
          createdAt: null,
        });
      }

      // Fallback: query legacy documents table for types still missing
      if (resumes.length === 0 || videos.length === 0) {
        try {
          const userRow = await query(
            `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
            [candidate.email?.toLowerCase() || ""],
          );
          if (userRow.rows.length > 0) {
            const userId = userRow.rows[0].id;
            const typesNeeded: string[] = [];
            if (resumes.length === 0) typesNeeded.push("'resume'");
            if (videos.length === 0) typesNeeded.push("'video_intro'");
            const docsRow = await query(
              `SELECT id, type, file_name, file_url, file_size, mime_type, is_primary, created_at
               FROM documents
               WHERE user_id = $1 AND type IN (${typesNeeded.join(",")})
               ORDER BY is_primary DESC, created_at DESC`,
              [userId],
            );
            for (const d of docsRow.rows) {
              const doc = {
                id: d.id,
                fileName: d.file_name,
                fileUrl: d.file_url,
                fileSize: d.file_size,
                mimeType: d.mime_type,
                isPrimary: d.is_primary,
                createdAt: d.created_at,
              };
              if (d.type === "resume") resumes.push(doc);
              else videos.push(doc);
            }
          }
        } catch (_) { /* non-fatal — continue without legacy documents */ }
      }

      const selectedResumeId = resumes.length > 0 ? resumes[0].id : null;
      const selectedVideoId = videos.length > 0 ? videos[0].id : null;

      // Readiness check
      const missing: string[] = [];
      if (!candidate.phone) missing.push("phone");
      if ((job as any).requiresVideoIntro && videos.length === 0) missing.push("video_intro");
      if (resumes.length === 0) missing.push("resume");

      // Application questions from job
      const questions: any[] = (job as any).applicationQuestions || [];

      return res.json({
        candidate: {
          id: candidate.id,
          firstName,
          lastName,
          email: candidate.email,
          phone: candidate.phone || "",
          location: candidate.location || "",
        },
        documents: {
          resumes,
          selectedResumeId,
          videos,
          selectedVideoId,
        },
        previousDefaults: {
          coverLetter: undefined,
        },
        job: {
          id: job.id,
          title: job.title,
          requiresResume: false,
          requiresVideoIntro: !!(job as any).requiresVideoIntro,
          questions,
        },
        readiness: {
          ready: missing.length === 0,
          missing,
        },
      });
    } catch (err: any) {
      console.error("GET /api/jobs/:jobId/application-prefill error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/jobs/:jobId/my-application — check whether the authenticated talent has already applied.
  // Accepts both Talent Portal JWTs (type:"candidate") and standard talent user JWTs because
  // authenticateJWT resolves both to req.user = { id: users.id, email, role }.
  // job_submissions.talent_id stores users.id, so we match on that.
  // We also check by email as a fallback for unlinked submissions that have no talent_id yet.
  app.get("/api/jobs/:jobId/my-application", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const authedUser = (req as any).user as { id: string; email: string; role: string };

      if (!authedUser || authedUser.role !== "talent") {
        return res.status(403).json({ error: "Talent access required" });
      }

      const result = await query(
        `SELECT id, created_at FROM job_submissions
          WHERE job_id = $1
            AND (talent_id = $2 OR lower(email) = lower($3))
          ORDER BY created_at ASC LIMIT 1`,
        [jobId, authedUser.id, authedUser.email],
      );

      if (result.rows.length === 0) {
        return res.json({ applied: false });
      }

      return res.json({
        applied: true,
        appliedAt: result.rows[0].created_at,
        submissionId: result.rows[0].id,
      });
    } catch (err: any) {
      console.error("GET /api/jobs/:jobId/my-application error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/jobs/:jobId/apply — submit a built-in application (multipart/form-data with optional CV)
  // Supports both authenticated Talent users (fast-path, no continuation token) and
  // unauthenticated applicants (continuation token → signup/login flow).
  // CORE RULE: the application is ALWAYS saved first. Email uniqueness is only
  // enforced at account-creation time, not at application time.
  app.post("/api/jobs/:jobId/apply", applyLimiter, upload.fields([{ name: "resume", maxCount: 1 }, { name: "video", maxCount: 1 }]), async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = await storage.getJob(jobId);
      if (!job) return res.status(404).json({ error: "Job not found" });
      if ((job as any).applicationMethod === "external_link") {
        return res.status(400).json({ error: "This job uses an external application link." });
      }
      if (job.status !== "open") {
        return res.status(400).json({ error: "This job is no longer accepting applications" });
      }

      const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;

      // ── Early auth check (needed before CV validation to support useProfileResume) ──
      const useProfileResume = req.body.useProfileResume === "true";
      let earlyAuthedUser: { id: string; email: string; role: string } | null = null;
      try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          const jwtSecret =
            process.env.JWT_SECRET ||
            (process.env.NODE_ENV === "development" ? "development-fallback-secret-not-for-production" : "");
          if (jwtSecret) {
            const decoded = jwt.verify(authHeader.slice(7), jwtSecret) as any;
            if (decoded?.userId) {
              // Legacy JWT — look up by user ID
              const ur = await query(`SELECT id, email, role FROM users WHERE id = $1`, [decoded.userId]);
              if (ur.rows.length > 0) earlyAuthedUser = ur.rows[0];
            } else if (decoded?.type === "candidate" && decoded?.candidateId && decoded?.email) {
              // Talent Portal JWT — look up user by the candidate's email
              const ur = await query(`SELECT id, email, role FROM users WHERE LOWER(email) = $1 LIMIT 1`, [decoded.email.toLowerCase()]);
              if (ur.rows.length > 0) earlyAuthedUser = ur.rows[0];
            }
          }
        }
      } catch (_) { /* token absent or invalid — continue as public applicant */ }

      // CV / resume is never required — the talent's profile serves as their resume.
      // A file is accepted if the applicant voluntarily attaches one, but never blocked.
      const cvFile = files?.["resume"]?.[0];
      if (cvFile) {
        const allowedCvMimes = [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];
        if (!allowedCvMimes.includes(cvFile.mimetype)) {
          return res.status(400).json({ error: "Invalid CV format. Only PDF, DOC, and DOCX files are allowed." });
        }
        if (cvFile.size > 10 * 1024 * 1024) {
          return res.status(400).json({ error: "CV file too large — maximum size is 10 MB." });
        }
      }

      // ── Video introduction validation (required when job.requiresVideoIntro is true) ─
      const videoFile = files?.["video"]?.[0];
      const requiresVideoIntro = !!(job as any).requiresVideoIntro;
      const useProfileVideo = req.body.useProfileVideo === "true";
      if (requiresVideoIntro && !videoFile && !useProfileVideo) {
        return res.status(400).json({ error: "A video introduction is required for this position. Please upload an MP4, MOV, or WebM file." });
      }
      if (videoFile) {
        const allowedVideoMimes = ["video/mp4", "video/quicktime", "video/webm"];
        if (!allowedVideoMimes.includes(videoFile.mimetype)) {
          return res.status(400).json({ error: "Invalid video format. Only MP4, MOV, and WebM files are allowed." });
        }
        if (videoFile.size > 200 * 1024 * 1024) {
          return res.status(400).json({ error: "Video file too large — maximum size is 200 MB." });
        }
      }

      // ── Upload CV to object storage (only when a new file is attached) ────────
      let cvResumeUrl: string | null = null;
      let cvResumeFileName: string | null = null;
      if (cvFile) {
        try {
          const objectStorageService = new ObjectStorageService();
          const objectId = randomUUID();
          const privateObjectDir = objectStorageService.getPrivateObjectDir();
          const fullPath = `${privateObjectDir}/application-resumes/${objectId}`;
          const parts = fullPath.split("/").filter((p: string) => p);
          const bucketName = parts[0];
          const objectName = parts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const objectFile = bucket.file(objectName);
          await objectFile.save(cvFile.buffer, {
            metadata: { contentType: cvFile.mimetype, metadata: { originalName: cvFile.originalname } },
          });
          await setObjectAclPolicy(objectFile, {
            visibility: "private",
            // earlyAuthedUser is resolved from the JWT before this block.
            // Anonymous applicants (no account) have no owner yet — their files
            // become accessible once the scoped admin-bypass is in place.
            ...(earlyAuthedUser?.id ? { owner: earlyAuthedUser.id } : {}),
          });
          cvResumeUrl = `/objects/application-resumes/${objectId}`;
          cvResumeFileName = cvFile.originalname;
        } catch (uploadErr: any) {
          console.error("CV upload to object storage failed:", uploadErr.message);
          return res.status(500).json({
            error: "cv_upload_failed",
            message: "CV upload failed — please try a different file or check your connection.",
          });
        }
      }

      // ── Upload video introduction to object storage (if present) ─────────────
      let videoIntroUrl: string | null = null;
      let videoIntroFileName: string | null = null;
      if (videoFile) {
        try {
          const objectStorageService = new ObjectStorageService();
          const videoId = randomUUID();
          const privateObjectDir = objectStorageService.getPrivateObjectDir();
          const fullPath = `${privateObjectDir}/application-videos/${videoId}`;
          const parts = fullPath.split("/").filter((p: string) => p);
          const bucketName = parts[0];
          const objectName = parts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const objectVideoFile = bucket.file(objectName);
          await objectVideoFile.save(videoFile.buffer, {
            metadata: { contentType: videoFile.mimetype, metadata: { originalName: videoFile.originalname } },
          });
          await setObjectAclPolicy(objectVideoFile, {
            visibility: "private",
            ...(earlyAuthedUser?.id ? { owner: earlyAuthedUser.id } : {}),
          });
          videoIntroUrl = `/objects/application-videos/${videoId}`;
          videoIntroFileName = videoFile.originalname;
        } catch (uploadErr: any) {
          console.error("Video upload to object storage failed:", uploadErr.message);
          return res.status(500).json({
            error: "video_upload_failed",
            message: "Video upload failed — please try a different file or check your connection.",
          });
        }
      }

      const { firstName, lastName, email, phone, coverLetter } = req.body;
      if (!firstName?.trim()) return res.status(400).json({ error: "First name is required" });
      if (!lastName?.trim()) return res.status(400).json({ error: "Last name is required" });
      if (!email?.trim()) return res.status(400).json({ error: "Email is required" });
      if (!phone?.trim()) return res.status(400).json({ error: "Phone is required" });

      const parseOptionalApplicationAmount = (value: unknown, field: string, minimum: number, maximum: number) => {
        if (value === undefined || value === null || String(value).trim() === "") return null;
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount < minimum || amount > maximum) {
          throw Object.assign(new Error(`${field} must be between ${minimum} and ${maximum}`), { status: 400 });
        }
        return amount;
      };
      let proposedRate: number | null;
      let proposedBudget: number | null;
      try {
        proposedRate = parseOptionalApplicationAmount(req.body.proposedRate, "proposedRate", 1, 1000);
        proposedBudget = parseOptionalApplicationAmount(req.body.proposedBudget, "proposedBudget", 10, 100000);
      } catch (amountError: any) {
        return res.status(amountError.status ?? 400).json({ error: amountError.message });
      }
      const estimatedDuration = req.body.estimatedDuration?.trim() || null;
      if (estimatedDuration && estimatedDuration.length > 200) {
        return res.status(400).json({ error: "estimatedDuration must be 200 characters or fewer" });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Use the result from the early auth check (done before CV validation)
      let authedUser: { id: string; email: string; role: string } | null = earlyAuthedUser;

      // ── Profile-resume reuse: resolve existing resume URL from candidate's profile ──
      if (useProfileResume && !cvResumeUrl) {
        if (!authedUser || authedUser.role !== "talent") {
          return res.status(400).json({ error: "CV / Resume is required. Please upload a resume file." });
        }
        // Try candidates table first (resume_url column)
        const candRow = await query(
          `SELECT resume_url, resume_file_name FROM candidates WHERE LOWER(email) = $1 LIMIT 1`,
          [normalizedEmail],
        );
        if (candRow.rows.length > 0 && candRow.rows[0].resume_url) {
          cvResumeUrl = candRow.rows[0].resume_url;
          cvResumeFileName = candRow.rows[0].resume_file_name || null;
        } else {
          // Fall back to the documents table (most recent resume document)
          const docRow = await query(
            `SELECT file_url, file_name FROM documents WHERE user_id = $1 AND type = 'resume' ORDER BY created_at DESC LIMIT 1`,
            [authedUser.id],
          );
          if (docRow.rows.length > 0) {
            cvResumeUrl = docRow.rows[0].file_url;
            cvResumeFileName = docRow.rows[0].file_name || null;
          }
        }
        if (!cvResumeUrl) {
          return res.status(400).json({ error: "No resume found on your Talent profile. Please upload a resume file." });
        }
      }

      // ── Profile-video reuse: resolve existing video intro URL ─────────────────
      if (useProfileVideo && !videoIntroUrl && authedUser) {
        // Prefer candidates.video_intro_url (the new source of truth)
        const candVidRow = await query(
          `SELECT video_intro_url, video_intro_file_name FROM candidates WHERE lower(email) = lower($1) LIMIT 1`,
          [normalizedEmail],
        );
        if (candVidRow.rows[0]?.video_intro_url) {
          videoIntroUrl = candVidRow.rows[0].video_intro_url;
          videoIntroFileName = candVidRow.rows[0].video_intro_file_name || null;
        } else {
          // Fallback: legacy documents table
          const vidRow = await query(
            `SELECT file_url, file_name FROM documents WHERE user_id = $1 AND type = 'video_intro' ORDER BY created_at DESC LIMIT 1`,
            [authedUser.id],
          );
          if (vidRow.rows.length > 0) {
            videoIntroUrl = vidRow.rows[0].file_url;
            videoIntroFileName = vidRow.rows[0].file_name || null;
          }
        }
      }

      // ── Authenticated user fast-path ──────────────────────────────────────────
      if (authedUser) {
        // Reject non-talent roles (client, admin, etc.) — identity guard, not email check
        if (authedUser.role !== "talent") {
          return res.status(403).json({
            error: "role_mismatch",
            message: "You are signed in with a non-Talent account. Sign out or use a Talent account to apply.",
          });
        }

        // For authenticated Talent, the application contact email may differ from
        // the account email — ownership is established by the verified token, not
        // the submitted email.  We no longer block on email mismatch here.
        // (The submitted email is stored as application contact info only; it
        //  does NOT change talentId or account ownership.)

        // Repeat-application indicator (allowed, but flagged for admin visibility)
        const priorByTalent = await query(
          `SELECT COUNT(*) FROM job_submissions WHERE job_id = $1 AND talent_id = $2`,
          [jobId, authedUser.id],
        );
        const isRepeat = parseInt(priorByTalent.rows[0].count, 10) > 0;

        // Parse and validate answers — gated on explicit field presence, matching the contract
        // that the wizard always sends "answers" (including []) while legacy forms never do.
        let validatedAnswersAuth: any[] | null = null;
        if (Object.prototype.hasOwnProperty.call(req.body, "answers")) {
          let parsedAnswers: any = null;
          try { parsedAnswers = JSON.parse(req.body.answers); } catch (_) { /* ignore */ }

          const jobQuestionsForAuth: any[] = (job as any).applicationQuestions || [];
          if (jobQuestionsForAuth.length > 0) {
            const aMap = new Map<string, string>();
            if (Array.isArray(parsedAnswers)) {
              for (const a of parsedAnswers) {
                if (a?.questionId) aMap.set(String(a.questionId), String(a.answer ?? "").trim());
              }
            }
            const norm: any[] = [];
            for (const q of jobQuestionsForAuth) {
              const ans = aMap.get(q.id) ?? "";
              if (q.required && !ans) {
                return res.status(400).json({ error: "missing_required_answers", message: `An answer is required for: "${q.label}"` });
              }
              if (ans) {
                if (q.type === "yes_no" && !["Yes", "No"].includes(ans)) {
                  return res.status(400).json({ error: "invalid_answer", message: `Answer must be Yes or No for: "${q.label}"` });
                }
                if (q.type === "single_select" && Array.isArray(q.options) && !q.options.includes(ans)) {
                  return res.status(400).json({ error: "invalid_answer", message: `Invalid option selected for: "${q.label}"` });
                }
                if (q.type === "number" && isNaN(Number(ans))) {
                  return res.status(400).json({ error: "invalid_answer", message: `Answer must be a number for: "${q.label}"` });
                }
              }
              norm.push({ questionId: q.id, question: q.label, answer: ans });
            }
            validatedAnswersAuth = norm;
            // If no configured questions, discard any submitted payload (store null)
          }
        }

        // Insert directly linked — no continuation token needed
        const result = await query(
          `INSERT INTO job_submissions
             (id, job_id, client_id, first_name, last_name, applicant_name, email, phone, cover_letter,
              resume_url, resume_file_name,
              video_introduction_url, video_introduction_file_name,
             status, registration_status, talent_id, is_repeat_application, answers,
             proposed_rate, proposed_budget, estimated_duration)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'new', 'linked', $13, $14, $15, $16, $17, $18)
           RETURNING id`,
          [
            jobId, job.clientId || null,
            firstName.trim(), lastName.trim(), `${firstName.trim()} ${lastName.trim()}`,
            normalizedEmail,
            phone.trim(),
            coverLetter?.trim() || null,
            cvResumeUrl,
            cvResumeFileName,
            videoIntroUrl,
            videoIntroFileName,
            authedUser.id,
            isRepeat,
            validatedAnswersAuth !== null ? JSON.stringify(validatedAnswersAuth) : null,
            proposedRate,
            proposedBudget,
            estimatedDuration,
          ],
        );

        // Non-blocking: seed the CV onto the linked candidate profile if they don't have one yet
        if (cvResumeUrl) {
          query(
            `UPDATE candidates SET resume_url = $1, resume_file_name = $2
             WHERE LOWER(email) = $3 AND (resume_url IS NULL OR resume_url = '')`,
            [cvResumeUrl, cvResumeFileName, normalizedEmail],
          ).catch((e: any) => console.warn("Non-fatal: could not seed CV onto candidate profile:", e?.message));
        }

        // Non-blocking: fire application-received email — must not affect response
        fireAutoApplicationEmail(result.rows[0].id);
        await notifyClientOfJobApplication({
          submissionId: result.rows[0].id,
          clientUserId: job.clientId,
          applicantDisplayName: `${firstName.trim()} ${lastName.trim()}`,
          jobTitle: job.title,
        });

        return res.status(201).json({
          success: true,
          accountAction: "already_authenticated",
          applicationId: result.rows[0].id,
          isRepeatApplication: isRepeat,
          nextUrl: "/find-work/jobs",
        });
      }

      // ── Unauthenticated applicant flow ────────────────────────────────────────
      // Repeat-application indicator — same job + same email already on record
      const priorByEmail = await query(
        `SELECT COUNT(*) FROM job_submissions WHERE job_id = $1 AND lower(email) = $2`,
        [jobId, normalizedEmail],
      );
      const isRepeat = parseInt(priorByEmail.rows[0].count, 10) > 0;

      // Determine account action by checking whether the email belongs to an existing user.
      // The application is ALWAYS saved regardless of this check.
      const userCheck = await query(
        `SELECT id, email, role FROM users WHERE lower(email) = $1 LIMIT 1`,
        [normalizedEmail],
      );
      const existingUser = userCheck.rows[0] || null;

      let registrationStatus: string;
      let accountAction: string;
      let maskedEmail: string | undefined;

      if (existingUser?.role === "talent") {
        // Email belongs to a known Talent — save and prompt sign-in to link
        registrationStatus = "pending_login";
        accountAction = "sign_in_required";
        const [localPart, domain] = normalizedEmail.split("@");
        maskedEmail = `${localPart[0]}***@${domain}`;
      } else if (existingUser) {
        // Email belongs to a Client or Admin — save but flag conflict
        registrationStatus = "pending_account";
        accountAction = "account_conflict";
      } else {
        // Brand-new email — save and redirect to account creation
        registrationStatus = "pending_account";
        accountAction = "create_account";
      }

      // Parse and validate answers — only when the caller explicitly submitted an answers payload.
      // Legacy talent forms (no Portal session) never post answers, so they must not be blocked.
      // The 1-Click Apply wizard always posts answers (even [] when no questions are configured).
      let validatedAnswersUnauth: any[] | null = null;
      if (Object.prototype.hasOwnProperty.call(req.body, "answers")) {
        let unauthParsedAnswers: any = null;
        try { unauthParsedAnswers = JSON.parse(req.body.answers); } catch (_) { /* ignore */ }

        const jobQuestionsUnauth: any[] = (job as any).applicationQuestions || [];
        if (jobQuestionsUnauth.length > 0) {
          const aMap2 = new Map<string, string>();
          if (Array.isArray(unauthParsedAnswers)) {
            for (const a of unauthParsedAnswers) {
              if (a?.questionId) aMap2.set(String(a.questionId), String(a.answer ?? "").trim());
            }
          }
          const norm2: any[] = [];
          for (const q of jobQuestionsUnauth) {
            const ans = aMap2.get(q.id) ?? "";
            if (q.required && !ans) {
              return res.status(400).json({ error: "missing_required_answers", message: `An answer is required for: "${q.label}"` });
            }
            if (ans) {
              if (q.type === "yes_no" && !["Yes", "No"].includes(ans)) {
                return res.status(400).json({ error: "invalid_answer", message: `Answer must be Yes or No for: "${q.label}"` });
              }
              if (q.type === "single_select" && Array.isArray(q.options) && !q.options.includes(ans)) {
                return res.status(400).json({ error: "invalid_answer", message: `Invalid option selected for: "${q.label}"` });
              }
              if (q.type === "number" && isNaN(Number(ans))) {
                return res.status(400).json({ error: "invalid_answer", message: `Answer must be a number for: "${q.label}"` });
              }
            }
            norm2.push({ questionId: q.id, question: q.label, answer: ans });
          }
          validatedAnswersUnauth = norm2;
          // If no configured questions, store null (discard any submitted payload)
        }
      }

      // Always insert the application first
      const applicantName = `${firstName.trim()} ${lastName.trim()}`;
      const insertResult = await query(
        `INSERT INTO job_submissions
           (id, job_id, client_id, first_name, last_name, applicant_name, email, phone, cover_letter,
            resume_url, resume_file_name,
            video_introduction_url, video_introduction_file_name,
            status, registration_status, is_repeat_application, answers,
            proposed_rate, proposed_budget, estimated_duration)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'new', $13, $14, $15, $16, $17, $18)
         RETURNING id`,
        [
          jobId, job.clientId || null,
          firstName.trim(), lastName.trim(), applicantName,
          normalizedEmail,
          phone.trim(),
          coverLetter?.trim() || null,
          cvResumeUrl,
          cvResumeFileName,
          videoIntroUrl,
          videoIntroFileName,
          registrationStatus,
          isRepeat,
          validatedAnswersUnauth !== null ? JSON.stringify(validatedAnswersUnauth) : null,
          proposedRate,
          proposedBudget,
          estimatedDuration,
        ],
      );
      const submissionId = insertResult.rows[0].id;

      // Non-blocking: fire application-received email — must not affect response
      fireAutoApplicationEmail(submissionId);
        await notifyClientOfJobApplication({
          submissionId,
          clientUserId: job.clientId,
          applicantDisplayName: `${firstName.trim()} ${lastName.trim()}`,
          jobTitle: job.title,
        });

      // Generate a continuation token (base64url, 32 bytes) — 24 h TTL
      const rawToken = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await query(
        `INSERT INTO application_tokens (id, submission_id, token_hash, expires_at)
         VALUES (gen_random_uuid(), $1, $2, $3)`,
        [submissionId, tokenHash, expiresAt],
      );

      const responseBody: Record<string, any> = {
        success: true,
        applicationId: submissionId,
        accountAction,
        continuationToken: rawToken,
        isRepeatApplication: isRepeat,
      };
      if (accountAction === "sign_in_required") {
        responseBody.message = "An OnSpot Talent account already exists with this email.";
        responseBody.maskedEmail = maskedEmail;
      } else if (accountAction === "account_conflict") {
        responseBody.message = "This email is already associated with another OnSpot account type. Please use a different email or contact support.";
      }

      return res.status(201).json(responseBody);
    } catch (err: any) {
      console.error("POST /api/jobs/:jobId/apply error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/job-applications/continue/:token — resolve token → prefill data
  app.get("/api/job-applications/continue/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      if (!token || token.length > 128) return res.status(400).json({ error: "Invalid token" });
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const r = await query(
        `SELECT at.id AS token_id, at.submission_id, at.expires_at, at.used_at,
                js.first_name, js.last_name, js.email, js.phone, js.job_id,
                j.title AS job_title
         FROM application_tokens at
         JOIN job_submissions js ON js.id = at.submission_id
         JOIN jobs j ON j.id = js.job_id
         WHERE at.token_hash = $1`,
        [tokenHash],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Token not found" });
      const row = r.rows[0];
      if (row.used_at) return res.status(410).json({ error: "Token already used" });
      if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: "Token expired" });
      return res.json({
        submissionId: row.submission_id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        jobTitle: row.job_title,
      });
    } catch (err: any) {
      console.error("GET /api/job-applications/continue error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/job-applications/refresh-token — issue a new token for an expired (unused) submission
  app.post("/api/job-applications/refresh-token", async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== "string" || token.length > 128) {
        return res.status(400).json({ error: "Invalid token" });
      }
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const r = await query(
        `SELECT at.id AS token_id, at.submission_id, at.used_at, at.expires_at, js.talent_id
         FROM application_tokens at
         JOIN job_submissions js ON js.id = at.submission_id
         WHERE at.token_hash = $1`,
        [tokenHash],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Token not found" });
      const row = r.rows[0];
      // Cannot refresh a token that was already used (account already created)
      if (row.used_at) return res.status(410).json({ error: "Token already used" });
      // Cannot refresh if submission is already linked to an account
      if (row.talent_id) return res.status(409).json({ error: "Submission already linked to an account" });

      // Invalidate all existing tokens for this submission and issue a fresh one
      await query(`DELETE FROM application_tokens WHERE submission_id = $1`, [row.submission_id]);
      const newRawToken = randomBytes(32).toString("base64url");
      const newHash = createHash("sha256").update(newRawToken).digest("hex");
      const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await query(
        `INSERT INTO application_tokens (id, submission_id, token_hash, expires_at)
         VALUES (gen_random_uuid(), $1, $2, $3)`,
        [row.submission_id, newHash, newExpiry],
      );
      return res.json({ success: true, continuationToken: newRawToken });
    } catch (err: any) {
      console.error("POST /api/job-applications/refresh-token error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/job-applications/link-by-token — link a pending_login application after
  // a Talent signs in via the existing-email prompt (requires JWT).
  // Validates that the authenticated user's email matches the saved application email.
  // TODO: Restore full production hardening (rate-limiting, audit log) before launch.
  app.post("/api/job-applications/link-by-token", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) return res.status(401).json({ error: "Unauthorized" });
      const { token } = req.body;
      if (!token || typeof token !== "string" || token.length > 128) {
        return res.status(400).json({ error: "token is required" });
      }

      const tokenHash = createHash("sha256").update(token).digest("hex");
      const r = await query(
        `SELECT at.id AS token_id, at.expires_at, at.used_at,
                js.id AS submission_id, js.email, js.talent_id
         FROM application_tokens at
         JOIN job_submissions js ON js.id = at.submission_id
         WHERE at.token_hash = $1`,
        [tokenHash],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Token not found" });
      const row = r.rows[0];
      if (row.used_at) return res.status(410).json({ error: "Token already used" });
      if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: "Token expired" });
      if (row.talent_id) return res.status(409).json({ error: "Submission already linked to an account" });

      // Verify the authenticated user's email matches the application email
      if (user.email.toLowerCase() !== row.email.toLowerCase()) {
        return res.status(409).json({
          error: "email_mismatch",
          message: "The signed-in account email does not match the application email.",
        });
      }

      // Mark token used and link application to the talent
      await query(`UPDATE application_tokens SET used_at = NOW() WHERE id = $1`, [row.token_id]);
      await query(
        `UPDATE job_submissions SET talent_id = $1, registration_status = 'linked', updated_at = NOW()
         WHERE id = $2`,
        [user.id, row.submission_id],
      );
      return res.json({ success: true, redirectTo: "/find-work/jobs" });
    } catch (err: any) {
      console.error("POST /api/job-applications/link-by-token error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/job-applications/link — link a talent account to a submission (requires JWT)
  app.post("/api/job-applications/link", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) return res.status(401).json({ error: "Unauthorized" });
      const { submissionId, token } = req.body;
      if (!submissionId || !token) return res.status(400).json({ error: "submissionId and token are required" });

      const tokenHash = createHash("sha256").update(token).digest("hex");
      const r = await query(
        `SELECT at.id AS token_id, at.expires_at, at.used_at, js.talent_id
         FROM application_tokens at
         JOIN job_submissions js ON js.id = at.submission_id
         WHERE at.token_hash = $1 AND at.submission_id = $2`,
        [tokenHash, submissionId],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Token not found" });
      const row = r.rows[0];
      if (row.used_at) return res.status(410).json({ error: "Token already used" });
      if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: "Token expired" });
      if (row.talent_id) return res.status(409).json({ error: "Submission already linked to an account" });

      // Mark token used and link talent
      await query(`UPDATE application_tokens SET used_at = NOW() WHERE id = $1`, [row.token_id]);
      await query(
        `UPDATE job_submissions SET talent_id = $1, registration_status = 'registered', updated_at = NOW()
         WHERE id = $2`,
        [user.id, submissionId],
      );

      // Non-blocking: seed the application's CV onto the candidate profile if the profile has none
      try {
        const subResume = await query(
          `SELECT resume_url, resume_file_name FROM job_submissions WHERE id = $1`,
          [submissionId],
        );
        if (subResume.rows[0]?.resume_url) {
          await query(
            `UPDATE candidates
             SET resume_url = $1, resume_file_name = $2, updated_at = NOW()
             WHERE LOWER(email) = LOWER($3) AND (resume_url IS NULL OR resume_url = '')`,
            [subResume.rows[0].resume_url, subResume.rows[0].resume_file_name, user.email],
          );
        }
      } catch (seedErr: any) {
        console.warn("Non-fatal: could not seed application CV onto candidate profile:", seedErr?.message);
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error("POST /api/job-applications/link error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Temporary admin-auth bypass ────────────────────────────────────────────
  // Set BYPASS_ADMIN_AUTH=true in the environment to skip admin auth on all
  // job-application endpoints. Intended for development/testing ONLY.
  // To restore full protection, remove the env var or set it to false.
  const BYPASS_ADMIN_AUTH = process.env.BYPASS_ADMIN_AUTH === "true";
  const maybeAuthenticateAdmin = BYPASS_ADMIN_AUTH
    ? (_req: Request, _res: Response, next: NextFunction) => next()
    : authenticateAdminFlexible;
  // Sub-role enforcement paired with maybeAuthenticateAdmin:
  // when the dev bypass is active, also skip sub-role checks so the bypass is self-consistent.
  const maybeRequireTalentSubRole = BYPASS_ADMIN_AUTH
    ? (_req: Request, _res: Response, next: NextFunction) => next()
    : requireAdminSubRole(["talent_acquisition"]);
  if (BYPASS_ADMIN_AUTH) {
    console.warn("⚠️  BYPASS_ADMIN_AUTH=true — admin job-application endpoints are UNPROTECTED");
  }

  // Log Microsoft Graph email service configuration status at startup
  {
    const { isEmailServiceConfigured } = await import("./services/microsoftGraphEmailService.ts");
    const senderAddr =
      process.env.MICROSOFT_SENDER_EMAIL || process.env.APPLICATION_EMAIL_FROM || "(not set)";
    if (isEmailServiceConfigured()) {
      console.log(`✅ Microsoft Graph email service configured — sender: ${senderAddr}`);
    } else {
      const missing: string[] = [];
      if (!process.env.MICROSOFT_TENANT_ID) missing.push("MICROSOFT_TENANT_ID");
      if (!process.env.MICROSOFT_CLIENT_ID) missing.push("MICROSOFT_CLIENT_ID");
      if (!process.env.MICROSOFT_CLIENT_SECRET) missing.push("MICROSOFT_CLIENT_SECRET");
      if (!process.env.MICROSOFT_SENDER_EMAIL && !process.env.APPLICATION_EMAIL_FROM)
        missing.push("MICROSOFT_SENDER_EMAIL");
      console.warn(`⚠️  Microsoft Graph email NOT configured — missing: ${missing.join(", ")}`);
    }
  }

  // GET /api/admin/job-applications/summary — status counts (admin only)
  // NOTE: must be registered BEFORE the :applicationId route to avoid Express
  //       matching the literal string "summary" as a URL parameter.
  app.get("/api/admin/job-applications/summary", maybeAuthenticateAdmin, maybeRequireTalentSubRole, async (req: Request, res: Response) => {
    try {

      const [byStatus, byReg, total] = await Promise.all([
        query(`SELECT status, COUNT(*) AS count FROM job_submissions WHERE ${SHORTLIST_EXCLUSION_PREDICATE} GROUP BY status`),
        query(`SELECT registration_status, COUNT(*) AS count FROM job_submissions WHERE ${SHORTLIST_EXCLUSION_PREDICATE} GROUP BY registration_status`),
        query(`SELECT COUNT(*) AS count FROM job_submissions WHERE ${SHORTLIST_EXCLUSION_PREDICATE}`),
      ]);

      const byStatusMap: Record<string, number> = {};
      for (const row of byStatus.rows) {
        const key = row.status === "new" ? "submitted" : row.status;
        byStatusMap[key] = (byStatusMap[key] ?? 0) + parseInt(row.count, 10);
      }
      const byRegMap: Record<string, number> = {};
      for (const row of byReg.rows) byRegMap[row.registration_status] = parseInt(row.count, 10);

      return res.json({
        total: parseInt(total.rows[0].count, 10),
        byStatus: byStatusMap,
        byRegStatus: byRegMap,
      });
    } catch (err: any) {
      console.error("GET /api/admin/job-applications/summary error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/admin/job-applications — paginated list with search/filter/sort (admin only)
  app.get("/api/admin/job-applications", maybeAuthenticateAdmin, maybeRequireTalentSubRole, async (req: Request, res: Response) => {
    try {

      const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"),   10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
      const offset = (page - 1) * limit;

      const statusFilter           = req.query.status             as string | undefined;
      const jobId                  = req.query.jobId              as string | undefined;
      const registrationStatus     = req.query.registrationStatus as string | undefined;
      const searchRaw              = req.query.search             as string | undefined;
      const dateFrom               = req.query.dateFrom           as string | undefined;
      const dateTo                 = req.query.dateTo             as string | undefined;
      const initiatedBy            = req.query.initiatedBy        as string | undefined;
      const sortBy                 = (req.query.sortBy as string) ?? "submittedAt";
      const sortOrder              = (req.query.sortOrder as string)?.toUpperCase() === "ASC" ? "ASC" : "DESC";

      const SORT_COLS: Record<string, string> = {
        submittedAt: "js.submitted_at",
        firstName:   "js.first_name",
        lastName:    "js.last_name",
        email:       "js.email",
        status:      "js.status",
      };
      const orderCol = SORT_COLS[sortBy] ?? "js.submitted_at";

      const conditions: string[] = [`js.${SHORTLIST_EXCLUSION_PREDICATE}`];
      const params: any[] = [];

      if (statusFilter) {
        // Treat 'submitted' as also matching legacy 'new'
        if (statusFilter === "submitted") {
          params.push("submitted", "new");
          conditions.push(`js.status = ANY(ARRAY[$${params.length - 1}, $${params.length}])`);
        } else {
          params.push(statusFilter);
          conditions.push(`js.status = $${params.length}`);
        }
      }
      if (jobId)              { params.push(jobId);              conditions.push(`js.job_id              = $${params.length}`); }
      if (registrationStatus) { params.push(registrationStatus); conditions.push(`js.registration_status = $${params.length}`); }
      if (initiatedBy)        { params.push(initiatedBy);        conditions.push(`js.initiated_by        = $${params.length}`); }
      if (dateFrom)           { params.push(dateFrom);           conditions.push(`js.submitted_at        >= $${params.length}::date`); }
      if (dateTo)             { params.push(dateTo);             conditions.push(`js.submitted_at        <  ($${params.length}::date + INTERVAL '1 day')`); }
      if (searchRaw?.trim()) {
        const term = `%${searchRaw.trim().toLowerCase()}%`;
        params.push(term);
        const n = params.length;
        conditions.push(
          `(lower(js.first_name) LIKE $${n} OR lower(js.last_name) LIKE $${n}
             OR lower(COALESCE(js.first_name,'') || ' ' || COALESCE(js.last_name,'')) LIKE $${n}
             OR lower(js.applicant_name) LIKE $${n}
             OR lower(js.email)          LIKE $${n}
             OR lower(js.phone)          LIKE $${n}
             OR lower(j.title)           LIKE $${n})`,
        );
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const countParams = [...params];
      params.push(limit, offset);

      const [countResult, rowsResult] = await Promise.all([
        query(
          `SELECT COUNT(*) FROM job_submissions js
           JOIN jobs j ON j.id = js.job_id
           ${where}`,
          countParams,
        ),
        query(
          `SELECT js.id, js.job_id AS "jobId", js.first_name AS "firstName", js.last_name AS "lastName",
                  js.applicant_name AS "applicantName", js.email, js.phone,
                  js.status, js.registration_status AS "registrationStatus",
                  js.talent_id AS "talentId", js.submitted_at AS "submittedAt", js.updated_at AS "updatedAt",
                  js.is_repeat_application AS "isRepeatApplication",
                  js.initiated_by AS "initiatedBy",
                  j.title AS "jobTitle", j.company AS "jobCompany",
                  u.first_name AS "talentFirstName", u.last_name AS "talentLastName"
           FROM job_submissions js
           JOIN jobs j ON j.id = js.job_id
           LEFT JOIN users u ON u.id = js.talent_id
           ${where}
           ORDER BY ${orderCol} ${sortOrder}, js.id ${sortOrder}
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        ),
      ]);

      return res.json({
        items: rowsResult.rows,
        total: parseInt(countResult.rows[0].count, 10),
        page,
        limit,
      });
    } catch (err: any) {
      console.error("GET /api/admin/job-applications error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/admin/job-applications/:applicationId — full detail with history (admin only)
  app.get("/api/admin/job-applications/:applicationId", maybeAuthenticateAdmin, maybeRequireTalentSubRole, async (req: Request, res: Response) => {
    try {

      const { applicationId } = req.params;
      const [appResult, histResult] = await Promise.all([
        query(
          `SELECT js.id, js.job_id AS "jobId", js.first_name AS "firstName", js.last_name AS "lastName",
                  js.applicant_name AS "applicantName", js.email, js.phone, js.cover_letter AS "coverLetter",
                  js.status, js.registration_status AS "registrationStatus",
                  js.talent_id AS "talentId", js.submitted_at AS "submittedAt", js.updated_at AS "updatedAt",
                  js.is_repeat_application AS "isRepeatApplication",
                  js.initiated_by AS "initiatedBy",
                  js.resume_url AS "appResumeUrl", js.resume_file_name AS "appResumeFileName",
                  js.video_introduction_url AS "videoIntroductionUrl",
                  js.video_introduction_file_name AS "videoIntroductionFileName",
                  j.title AS "jobTitle", j.company AS "jobCompany",
                  u.first_name AS "talentFirstName", u.last_name AS "talentLastName",
                  c.id AS "candidateId",
                  c.resume_url AS "candidateResumeUrl", c.resume_file_name AS "candidateResumeFileName",
                  accepted_offer.id AS "acceptedOfferId"
           FROM job_submissions js
           JOIN jobs j ON j.id = js.job_id
           LEFT JOIN users u ON u.id = js.talent_id
           LEFT JOIN LATERAL (
             SELECT id
             FROM offers
             WHERE submission_id = js.id
               AND status IN ('accepted', 'offer_accepted')
             ORDER BY created_at DESC
             LIMIT 1
           ) accepted_offer ON true
           -- Candidate lookup: prefer user-linked email, fall back to application email (covers pending_login).
           -- LATERAL + LIMIT 1 avoids duplicate rows when multiple candidate rows share an email;
           -- profile_completed DESC picks the most complete profile deterministically.
           LEFT JOIN LATERAL (
             SELECT id, resume_url, resume_file_name
             FROM candidates
             WHERE COALESCE(u.email, js.email) IS NOT NULL
               AND LOWER(email) = LOWER(COALESCE(u.email, js.email))
             ORDER BY profile_completed DESC NULLS LAST, updated_at DESC NULLS LAST
             LIMIT 1
           ) c ON true
           WHERE js.id = $1 AND js.${SHORTLIST_EXCLUSION_PREDICATE}`,
          [applicationId],
        ),
        query(
          `SELECT h.id, h.previous_status AS "previousStatus", h.new_status AS "newStatus",
                  h.note, h.changed_by AS "changedBy",
                  COALESCE(u.first_name || ' ' || u.last_name, u.email) AS "changedByName",
                  h.created_at AS "createdAt"
           FROM job_application_status_history h
           LEFT JOIN users u ON u.id = h.changed_by
           WHERE h.application_id = $1
           ORDER BY h.created_at DESC`,
          [applicationId],
        ),
      ]);

      if (appResult.rows.length === 0) return res.status(404).json({ error: "Application not found" });

      // Resolve resume with priority: (1) application's own resume → (2) linked candidate profile resume → (3) none
      const row = appResult.rows[0];
      const resumeUrl: string | null = row.appResumeUrl || row.candidateResumeUrl || null;
      const resumeFileName: string | null = row.appResumeUrl
        ? row.appResumeFileName
        : (row.candidateResumeUrl ? row.candidateResumeFileName : null);
      const resumeSource: "application" | "talent_profile" | null = row.appResumeUrl
        ? "application"
        : (row.candidateResumeUrl ? "talent_profile" : null);

      // Omit internal intermediate fields from the response
      const { appResumeUrl, appResumeFileName, candidateResumeUrl, candidateResumeFileName, ...baseRow } = row;
      return res.json({
        ...baseRow,
        resumeUrl,
        resumeFileName,
        resumeSource,
        videoIntroductionUrl: row.videoIntroductionUrl || null,
        videoIntroductionFileName: row.videoIntroductionFileName || null,
        history: histResult.rows,
      });
    } catch (err: any) {
      console.error("GET /api/admin/job-applications/:id error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/admin/job-applications/:applicationId/resume — proxy CV from object storage (admin only)
  app.get("/api/admin/job-applications/:applicationId/resume", maybeAuthenticateAdmin, maybeRequireTalentSubRole, async (req: Request, res: Response) => {
    try {
      const { applicationId } = req.params;
      const disposition = (req.query.download === "1") ? "attachment" : "inline";

      // Find the resume: application-specific first, then fall back to linked candidate profile
      const result = await query(
        `SELECT js.resume_url AS "appResumeUrl", js.resume_file_name AS "appResumeFileName",
                c.resume_url AS "candidateResumeUrl", c.resume_file_name AS "candidateResumeFileName"
         FROM job_submissions js
         LEFT JOIN users u ON u.id = js.talent_id
         -- Same LATERAL pattern: email fallback for pending_login applications, deduplicated.
         LEFT JOIN LATERAL (
           SELECT resume_url, resume_file_name
           FROM candidates
           WHERE COALESCE(u.email, js.email) IS NOT NULL
             AND LOWER(email) = LOWER(COALESCE(u.email, js.email))
           ORDER BY profile_completed DESC NULLS LAST, updated_at DESC NULLS LAST
           LIMIT 1
         ) c ON true
         WHERE js.id = $1`,
        [applicationId],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Application not found" });

      const row = result.rows[0];
      const resumeUrl: string | null = row.appResumeUrl || row.candidateResumeUrl || null;
      const resumeFileName: string = row.appResumeUrl
        ? (row.appResumeFileName || "resume")
        : (row.candidateResumeFileName || "resume");

      if (!resumeUrl) return res.status(404).json({ error: "No CV attached to this application" });

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(resumeUrl);
      res.setHeader("Content-Disposition", `${disposition}; filename="${resumeFileName.replace(/"/g, "")}"`);
      await objectStorageService.downloadObject(objectFile, res, 0); // no-cache for admin access
    } catch (err: any) {
      console.error("GET /api/admin/job-applications/:id/resume error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to serve CV" });
    }
  });

  // GET /api/admin/job-applications/:applicationId/video — proxy video introduction from object storage (admin only)
  app.get("/api/admin/job-applications/:applicationId/video", maybeAuthenticateAdmin, maybeRequireTalentSubRole, async (req: Request, res: Response) => {
    try {
      const { applicationId } = req.params;
      const disposition = (req.query.download === "1") ? "attachment" : "inline";

      const result = await query(
        `SELECT video_introduction_url AS "videoUrl", video_introduction_file_name AS "videoFileName"
         FROM job_submissions WHERE id = $1`,
        [applicationId],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Application not found" });

      const { videoUrl, videoFileName } = result.rows[0];
      if (!videoUrl) return res.status(404).json({ error: "No video introduction attached to this application" });

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(videoUrl);
      const safeFileName = (videoFileName || "video-intro").replace(/"/g, "");
      res.setHeader("Content-Disposition", `${disposition}; filename="${safeFileName}"`);
      await objectStorageService.downloadObject(objectFile, res, 0);
    } catch (err: any) {
      console.error("GET /api/admin/job-applications/:id/video error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to serve video" });
    }
  });

  // POST /api/admin/job-applications/:applicationId/resume — upload a CV on behalf of an application (admin only)
  // Used when an application was submitted before CV upload was required and resume_url is NULL.
  app.post("/api/admin/job-applications/:applicationId/resume", maybeAuthenticateAdmin, maybeRequireTalentSubRole, upload.single("resume"), async (req: any, res: Response) => {
    try {
      const { applicationId } = req.params;

      // Verify application exists and fetch email so we can resolve the candidate owner
      const existing = await query(
        `SELECT id, email FROM job_submissions WHERE id = $1`,
        [applicationId],
      );
      if (existing.rows.length === 0) return res.status(404).json({ error: "Application not found" });

      // Resolve the candidate's user_id — the file should be owned by the candidate,
      // not the admin, so the candidate can later retrieve their own document.
      const appEmail = existing.rows[0].email as string | null;
      let candidateOwnerId: string | undefined;
      if (appEmail) {
        const ownerRow = await query(
          `SELECT user_id FROM candidates WHERE LOWER(email) = LOWER($1) AND user_id IS NOT NULL LIMIT 1`,
          [appEmail],
        );
        candidateOwnerId = ownerRow.rows[0]?.user_id ?? undefined;
      }

      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      const allowedMimes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowedMimes.includes(file.mimetype)) {
        return res.status(400).json({ error: "Only PDF or Word documents are allowed" });
      }
      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "File too large — max 10 MB" });
      }

      // Upload to private object storage under the application-resumes prefix
      const objectStorageService = new ObjectStorageService();
      const objectId = randomUUID();
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const fullPath = `${privateObjectDir}/application-resumes/${objectId}`;
      const parts = fullPath.split("/").filter((p: string) => p);
      const bucketName = parts[0];
      const objectName = parts.slice(1).join("/");

      const bucket = objectStorageClient.bucket(bucketName);
      const objectFile = bucket.file(objectName);
      await objectFile.save(file.buffer, {
        metadata: { contentType: file.mimetype, metadata: { originalName: file.originalname } },
      });
      await setObjectAclPolicy(objectFile, {
        visibility: "private",
        ...(candidateOwnerId ? { owner: candidateOwnerId } : {}),
      });

      const resumeUrl = `/objects/application-resumes/${objectId}`;
      await query(
        `UPDATE job_submissions SET resume_url = $1, resume_file_name = $2, updated_at = NOW() WHERE id = $3`,
        [resumeUrl, file.originalname, applicationId],
      );

      return res.json({ success: true, resumeUrl, resumeFileName: file.originalname });
    } catch (err: any) {
      console.error("POST /api/admin/job-applications/:id/resume error:", err);
      return res.status(500).json({ error: "Failed to upload CV" });
    }
  });

  // PATCH /api/admin/job-applications/:applicationId/status — update status + record history (admin only)
  app.patch("/api/admin/job-applications/:applicationId/status", maybeAuthenticateAdmin, maybeRequireTalentSubRole, async (req: Request, res: Response) => {
    try {
      // Normal Admin status changes must go through the authenticated
      // email/send workflow so a status can never be committed without a
      // successful applicant email.
      return res.status(409).json({
        error: "status_email_required",
        message: "Admin application status changes must be sent through the Email Applicant workflow.",
      });
      /*
      const changedBy: string | null = (req as any).user?.id ?? null;

      const { applicationId } = req.params;
      const { status: rawStatus, note } = req.body ?? {};

      // Canonical statuses only (see shared/submissionStatuses.ts) — the DB CHECK
      // constraint rejects legacy values, so map old UI aliases to canonical first.
      const LEGACY_STATUS_ALIASES: Record<string, string> = {
        submitted: "new",
        interview: "interviewing",
        offered: "offer_extended",
      };
      const status = LEGACY_STATUS_ALIASES[rawStatus] ?? rawStatus;
      const { ADMIN_SETTABLE_STATUSES } = await import("../shared/submissionStatuses");
      if (!status || !ADMIN_SETTABLE_STATUSES.includes(status as any)) {
        return res.status(400).json({ error: `Invalid status. Valid values: ${ADMIN_SETTABLE_STATUSES.join(", ")}` });
      }

      // Fetch existing application (confirm it exists and get current status)
      const existing = await query(
        `SELECT js.id, js.status, js.talent_id, js.email, j.title AS job_title
         FROM job_submissions js
         JOIN jobs j ON j.id = js.job_id
         WHERE js.id = $1`,
        [applicationId],
      );
      if (existing.rows.length === 0) return res.status(404).json({ error: "Application not found" });
      const previousStatus = existing.rows[0].status;

      // Transactional update + history record
      await query("BEGIN");
      try {
        const updated = await query(
          `UPDATE job_submissions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
          [status, applicationId],
        );
        await query(
          `INSERT INTO job_application_status_history
             (application_id, previous_status, new_status, note, changed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [applicationId, previousStatus, status, note?.trim() || null, changedBy],
        );
        await query("COMMIT");
        await notifyTalentOfApplicationStatusChange({
          submissionId: applicationId,
          talentUserId: existing.rows[0].talent_id,
          applicantEmail: existing.rows[0].email,
          jobTitle: existing.rows[0].job_title,
          previousStatus,
          newStatus: status,
        });
        return res.json({ success: true, application: updated.rows[0] });
      } catch (txErr) {
        await query("ROLLBACK");
        throw txErr;
      }
      */
    } catch (err: any) {
      console.error("PATCH /api/admin/job-applications/:id/status error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/admin/job-applications/:applicationId — delete a single application submission (admin only)
  app.delete("/api/admin/job-applications/:applicationId", maybeAuthenticateAdmin, maybeRequireTalentSubRole, async (req: Request, res: Response) => {
    try {
      const { applicationId } = req.params;
      if (!applicationId) return res.status(400).json({ error: "applicationId is required" });

      // Confirm the application exists
      const existing = await query(
        `SELECT id FROM job_submissions WHERE id = $1 AND ${SHORTLIST_EXCLUSION_PREDICATE}`,
        [applicationId],
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Transactional delete: child rows first, then the application itself
      await query("BEGIN");
      try {
        await query(
          `DELETE FROM job_application_emails WHERE application_id = $1`,
          [applicationId],
        );
        await query(
          `DELETE FROM job_application_status_history WHERE application_id = $1`,
          [applicationId],
        );
        await query(
          `DELETE FROM job_submissions WHERE id = $1`,
          [applicationId],
        );
        await query("COMMIT");
        return res.json({ success: true, message: "Application deleted successfully" });
      } catch (txErr) {
        await query("ROLLBACK");
        throw txErr;
      }
    } catch (err: any) {
      console.error("DELETE /api/admin/job-applications/:id error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/admin/job-applications/:id — update application status (admin only)
  app.patch("/api/admin/job-applications/:id", authenticateJWT, requireAdmin, maybeRequireTalentSubRole, async (req: Request, res: Response) => {
    try {
      // Keep the legacy endpoint from bypassing the email-before-status
      // invariant. The UI uses /email/send for coordinated changes.
      return res.status(409).json({
        error: "status_email_required",
        message: "Admin application status changes must be sent through the Email Applicant workflow.",
      });
      /*
      const user = (req as any).user;
      if (!user?.id || user.role !== "admin") return res.status(403).json({ error: "Forbidden" });

      const { id } = req.params;
      const { status } = req.body;
      const { ADMIN_SETTABLE_STATUSES } = await import("../shared/submissionStatuses");
      if (!status || !ADMIN_SETTABLE_STATUSES.includes(status as any)) {
        return res.status(400).json({ error: "Invalid status", allowed: ADMIN_SETTABLE_STATUSES });
      }

      const existing = await query(
        `SELECT js.status, js.talent_id, js.email, j.title AS job_title
         FROM job_submissions js
         JOIN jobs j ON j.id = js.job_id
         WHERE js.id = $1`,
        [id],
      );
      if (existing.rows.length === 0) return res.status(404).json({ error: "Application not found" });

      const result = await query(
        `UPDATE job_submissions SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, id],
      );
      await notifyTalentOfApplicationStatusChange({
        submissionId: id,
        talentUserId: existing.rows[0].talent_id,
        applicantEmail: existing.rows[0].email,
        jobTitle: existing.rows[0].job_title,
        previousStatus: existing.rows[0].status,
        newStatus: status,
      });
      return res.json(result.rows[0]);
      */
    } catch (err: any) {
      console.error("PATCH /api/admin/job-applications/:id error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Shared helpers for client submission endpoints ───────────────────────────

  /**
   * Ordered list of statuses used to compute the name-reveal threshold.
   * Only post-acceptance statuses are listed; 'invited' and 'declined' are
   * deliberately absent so pre-acceptance client-invited talent stay anonymous.
   * The threshold is admin-configurable via platform_settings('name_reveal_threshold').
   */
  const SUBMISSION_STATUS_ORDER = [
    "new",            // accepted invitation or self-applied (was 'submitted' before canonical rename)
    "under_review",   // client actively reviewing
    "reviewed",       // client completed review
    "shortlisted",    // client shortlisted
    "interviewing",   // interview scheduled (Phase 1)
    "offer_extended", // offer sent (Phase 2)
    "offer_accepted", // talent accepted offer
    "offer_declined", // talent declined offer — name still visible; relationship was active
    "contract_sent",  // contract sent (Phase 3)
    "hired",          // terminal success
    "rejected",       // client or outcome rejected — name still visible; review already happened
    "withdrawn",      // talent withdrew — name still visible if post-acceptance
  ] as const;

  /**
   * Returns the set of statuses at which identity is revealed for a given threshold.
   * e.g. threshold "shortlisted" → Set{"shortlisted","hired"}
   */
  const revealedStatusesForThreshold = (threshold: string): Set<string> => {
    const idx = SUBMISSION_STATUS_ORDER.indexOf(threshold as (typeof SUBMISSION_STATUS_ORDER)[number]);
    const startAt = idx === -1 ? 0 : idx;
    return new Set(SUBMISSION_STATUS_ORDER.slice(startAt));
  };

  /**
   * Fetch the name-reveal threshold from platform_settings.
   * Falls back to "hired" (most restrictive) on error so PII is never accidentally
   * exposed when the settings table is unreachable.
   */
  const getNameRevealThreshold = async (): Promise<string> => {
    try {
      const result = await query(
        `SELECT value FROM platform_settings WHERE key = 'name_reveal_threshold' LIMIT 1`
      );
      return result.rows[0]?.value ?? "submitted";
    } catch {
      // Fail closed: never reveal names if we cannot read the configured threshold.
      return "hired";
    }
  };

  /**
   * Mask a name string for a pending/declined client invitation.
   * Returns "Talent Profile" for empty names, "J••••" for single words,
   * or the canonical "Jane D." format for multi-word names.
   */
  const maskInviteName = (
    raw: string | null,
    firstName: string | null | undefined,
    lastName: string | null | undefined,
  ): string => maskClientTalentName({ fullName: raw, firstName, lastName });

  /**
   * Apply server-side PII masking to a client submission row.
   *
   * For client-invited talent whose status has not yet reached the configured
   * threshold, this returns a minimal allowlist shape — no real name, no contact
   * info, no documents/links/free-text.
   *
   * "invited" (pending) and "declined" rows are always masked regardless of threshold.
   * Self-applied submissions (initiated_by !== "client") are returned as-is.
   *
   * @param revealedStatuses — computed once per request from getNameRevealThreshold()
   *
   * Field policy (independent axes, do not conflate):
   *   - Name (applicantName, firstName, lastName): controlled by the configurable threshold.
   *   - Contact (email, phone): always null — never returned to clients at any status
   *     (policy set by tasks #182/#187, separate from name reveal).
   *   - Documents & links (resumeUrl, portfolioUrl, coverLetter): always null through
   *     the client API — clients access resumes via the /api/job-resumes/:id endpoint.
   *   - Other fields (location, expectedSalary, availability): revealed alongside name.
   */
  const sanitizeClientSubmissionRow = (row: any, revealedStatuses: Set<string>): any => {
    // Name reveals once talent's status meets or exceeds the configured threshold.
    // For self-applied candidates (initiated_by !== "client") names are always shown.
    const combinedInviteReveal = Boolean(row.combined_invite_reveal ?? row.combinedInviteReveal);
    const combinedInterviewConfirmed = Boolean(row.combined_interview_confirmed ?? row.combinedInterviewConfirmed);
    const combinedInterviewBlocked =
      row.initiated_by === "client" &&
      combinedInviteReveal &&
      !combinedInterviewConfirmed;
    const nameRevealed =
      !combinedInterviewBlocked &&
      (row.initiated_by !== "client" || revealedStatuses.has(row.status));

    const rawName = row.applicantName ?? row.applicant_name ?? null;
    const displayName = nameRevealed
      ? rawName
      : maskInviteName(
          rawName,
          row.firstName ?? row.first_name,
          row.lastName ?? row.last_name,
        );

    // Always return an explicit allowlist — never spread raw DB rows to avoid
    // accidentally leaking new columns added in future migrations.
    return {
      id:           row.id,
      jobId:        row.jobId        ?? row.job_id,
      clientId:     row.clientId     ?? row.client_id,
      talentId:     row.talentId     ?? row.talent_id,
      status:       row.status,
      workflowType: row.workflowType ?? row.workflow_type ?? "application",
      initiated_by: row.initiated_by,
      submittedAt:  row.submittedAt  ?? row.submitted_at,
      updatedAt:    row.updatedAt    ?? row.updated_at,
      createdAt:    row.createdAt    ?? row.created_at,
      jobTitle:     row.jobTitle,
      jobCompany:   row.jobCompany,
      registrationStatus: row.registrationStatus ?? row.registration_status ?? null,
      combinedInviteReveal: Boolean(row.combined_invite_reveal ?? row.combinedInviteReveal),
      combinedInterviewConfirmed: Boolean(row.combined_interview_confirmed ?? row.combinedInterviewConfirmed),
      interviewId: row.interviewId ?? row.interview_id ?? null,
      interviewStatus: row.interviewStatus ?? row.interview_status ?? null,
      proposedTimes: row.proposedTimes ?? row.proposed_times ?? [],
       confirmedTime: row.confirmedTime ?? row.confirmed_time ?? null,
       confirmedTimeZone: row.confirmedTimeZone ?? row.confirmed_time_zone ?? "UTC",
      currentProposalOwner: row.currentProposalOwner ?? row.current_proposal_owner ?? null,
      meetingLink: nameRevealed ? (row.meetingLink ?? row.meeting_link ?? null) : null,
      proposalExchangeCount: Number(row.proposalExchangeCount ?? row.proposal_exchange_count ?? 0),
      interviewNudge: Number(row.proposalExchangeCount ?? row.proposal_exchange_count ?? 0) >= 3 &&
        !["confirmed", "cancelled", "completed"].includes(row.interviewStatus ?? row.interview_status ?? ""),

      // Identity — controlled by the configurable name-reveal threshold.
      applicantName:  displayName,
      applicant_name: displayName,
      firstName: nameRevealed ? (row.firstName ?? row.first_name ?? null) : null,
      lastName:  nameRevealed ? (row.lastName  ?? row.last_name  ?? null) : null,
      location:  nameRevealed ? (row.location  ?? null)                   : null,

      // Contact — always null; independent of name threshold (policy: never expose
      // via client API regardless of status — platform messaging is the channel).
      email: null,
      phone: null,

      // Documents & external links — always null through client API at any status.
      resumeUrl:      null,
      resumeFileName: null,
      portfolioUrl:   null,
      coverLetter:    null,

      // Non-PII application fields — revealed alongside name.
      expectedSalary: nameRevealed ? (row.expectedSalary ?? row.expected_salary ?? null) : null,
      proposedRate: nameRevealed ? (row.proposedRate ?? row.proposed_rate ?? null) : null,
      proposedBudget: nameRevealed ? (row.proposedBudget ?? row.proposed_budget ?? null) : null,
      estimatedDuration: nameRevealed ? (row.estimatedDuration ?? row.estimated_duration ?? null) : null,
      availability:   nameRevealed ? (row.availability   ?? null)                         : null,
    };
  }

  // Explicit camelCase projection shared by both submission GET endpoints.
  const CLIENT_SUBMISSION_SELECT = `
    SELECT
      js.id,
      js.job_id                   AS "jobId",
      js.client_id                AS "clientId",
      js.talent_id                AS "talentId",
      js.applicant_name           AS "applicantName",
      js.first_name               AS "firstName",
      js.last_name                AS "lastName",
      js.email,
      js.phone,
      js.location,
      js.resume_url               AS "resumeUrl",
      js.resume_file_name         AS "resumeFileName",
      js.portfolio_url            AS "portfolioUrl",
      js.cover_letter             AS "coverLetter",
      js.expected_salary          AS "expectedSalary",
      js.proposed_rate            AS "proposedRate",
      js.proposed_budget          AS "proposedBudget",
      js.estimated_duration       AS "estimatedDuration",
      js.availability,
      js.status,
      js.workflow_type            AS "workflowType",
      js.submitted_at             AS "submittedAt",
      js.updated_at               AS "updatedAt",
      js.created_at               AS "createdAt",
      js.initiated_by,
      js.registration_status      AS "registrationStatus",
      j.title                     AS "jobTitle",
      j.company                   AS "jobCompany",
      j.engagement_type           AS "jobEngagementType"
      ,j.status                   AS "jobStatus"
      ,j.approval_status          AS "approvalStatus"
      ,js.combined_invite_reveal  AS "combinedInviteReveal"
      ,EXISTS (
        SELECT 1 FROM interviews ci
         WHERE ci.submission_id = js.id AND ci.status = 'confirmed'
      ) AS "combinedInterviewConfirmed"
      ,(
        SELECT ci.id FROM interviews ci
         WHERE ci.submission_id = js.id
         ORDER BY ci.created_at DESC LIMIT 1
      ) AS "interviewId"
      ,(
        SELECT ci.status FROM interviews ci
         WHERE ci.submission_id = js.id
         ORDER BY ci.created_at DESC LIMIT 1
      ) AS "interviewStatus"
      ,(
        SELECT ci.proposed_times FROM interviews ci
         WHERE ci.submission_id = js.id
         ORDER BY ci.created_at DESC LIMIT 1
      ) AS "proposedTimes"
      ,(
        SELECT ci.confirmed_time FROM interviews ci
         WHERE ci.submission_id = js.id
         ORDER BY ci.created_at DESC LIMIT 1
      ) AS "confirmedTime"
       ,(
         SELECT ci.confirmed_time_zone FROM interviews ci
          WHERE ci.submission_id = js.id
          ORDER BY ci.created_at DESC LIMIT 1
       ) AS "confirmedTimeZone"
      ,(
        SELECT ci.current_proposal_owner FROM interviews ci
         WHERE ci.submission_id = js.id
         ORDER BY ci.created_at DESC LIMIT 1
      ) AS "currentProposalOwner"
      ,(
        SELECT ci.meeting_link FROM interviews ci
         WHERE ci.submission_id = js.id
         ORDER BY ci.created_at DESC LIMIT 1
      ) AS "meetingLink"
      ,(
        SELECT ci.proposal_exchange_count FROM interviews ci
         WHERE ci.submission_id = js.id
         ORDER BY ci.created_at DESC LIMIT 1
      ) AS "proposalExchangeCount"
    FROM job_submissions js
    JOIN jobs j ON j.id = js.job_id
  `;

  // GET /api/client/job-submissions — list submissions for all jobs posted by the authenticated client
  app.get("/api/client/job-submissions", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const [result, threshold] = await Promise.all([
        query(
          `${CLIENT_SUBMISSION_SELECT}
           WHERE js.client_id = $1
             AND js.${SHORTLIST_EXCLUSION_PREDICATE}
           ORDER BY js.submitted_at DESC`,
          [userId],
        ),
        getNameRevealThreshold(),
      ]);
      const revealed = revealedStatusesForThreshold(threshold);
      return res.json(result.rows.map((row) => sanitizeClientSubmissionRow(row, revealed)));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/client/job-submissions/:id — single submission detail
  app.get("/api/client/job-submissions/:id", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;
      const [result, threshold] = await Promise.all([
        query(
          `${CLIENT_SUBMISSION_SELECT}
           WHERE js.id = $1 AND js.client_id = $2
             AND js.${SHORTLIST_EXCLUSION_PREDICATE}`,
          [id, userId],
        ),
        getNameRevealThreshold(),
      ]);
      if (result.rows.length === 0) return res.status(404).json({ error: "Submission not found" });
      const revealed = revealedStatusesForThreshold(threshold);
      return res.json(sanitizeClientSubmissionRow(result.rows[0], revealed));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/client/job-submissions/:id/status — update submission status
  // Uses the canonical CLIENT_SETTABLE_STATUSES list from shared/submissionStatuses.ts.
  // Pipeline-driven statuses (interviewing, offer_extended, etc.) are set as side
  // effects of creating interview/offer/contract records — never directly via this endpoint.
  app.patch("/api/client/job-submissions/:id/status", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      return res.status(403).json({
        error: "status_email_required",
        message: "Clients must request an Admin-approved status change.",
      });
      /*
      const { id } = req.params;
      const { status } = req.body;
      const { CLIENT_SETTABLE_STATUSES, submissionStatusLabel } =
        await import("../shared/submissionStatuses");
      if (!status || !CLIENT_SETTABLE_STATUSES.includes(status as any)) {
        return res.status(400).json({
          error: "Invalid status",
          allowed: CLIENT_SETTABLE_STATUSES,
        });
      }

      client = await getClient();
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [`client-status:${id}`],
      );

      // Lock only the canonical submission row. Optional relations must not be
      // part of a SELECT ... FOR UPDATE because PostgreSQL rejects locking the
      // nullable side of an outer join.
      const current = await client.query(
        `SELECT js.status, js.initiated_by, js.talent_id, js.email,
                js.first_name, js.last_name, js.applicant_name,
                 js.job_id, js.client_id
           FROM job_submissions js
          WHERE js.id = $1 AND js.client_id = $2
          FOR UPDATE`,
        [id, userId],
      );
      if (current.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Submission not found or forbidden" });
      }
      const currentRow = current.rows[0];
      const [jobResult, clientUserResult] = await Promise.all([
        client.query(
          `SELECT title FROM jobs WHERE id = $1 LIMIT 1`,
          [currentRow.job_id],
        ),
        client.query(
          `SELECT first_name, last_name, company
             FROM users
            WHERE id = $1
            LIMIT 1`,
          [currentRow.client_id],
        ),
      ]);
      currentRow.job_title = jobResult.rows[0]?.title ?? null;
      currentRow.client_first_name = clientUserResult.rows[0]?.first_name ?? null;
      currentRow.client_last_name = clientUserResult.rows[0]?.last_name ?? null;
      currentRow.client_company = clientUserResult.rows[0]?.company ?? null;
      const currentStatus: string = currentRow.status;
      const initiatedBy: string | null = currentRow.initiated_by;
      if (initiatedBy === "client" && (currentStatus === "invited" || currentStatus === "declined")) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "cannot_update_pending_invitation",
          message:
            currentStatus === "invited"
              ? "This invitation is awaiting the talent's response. Status can only change once the talent accepts or declines."
              : "This invitation was declined by the talent and its status cannot be changed.",
        });
      }

      if (currentStatus === status) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "status_already_set",
          message: "This application already has the requested status.",
        });
      }

      await client.query(
        `UPDATE job_submissions
            SET status = $1, updated_at = NOW()
          WHERE id = $2 AND client_id = $3 AND status = $4`,
        [status, id, userId, currentStatus],
      );

      await client.query(
        `INSERT INTO job_application_status_history
           (application_id, previous_status, new_status, note, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, currentStatus, status, "Status updated by Client", userId],
      );

      const talentUser = await client.query(
        `SELECT id
           FROM users
          WHERE role = 'talent'
            AND (id = $1 OR lower(email) = lower($2))
          LIMIT 1`,
        [currentRow.talent_id, currentRow.email],
      );
      if (talentUser.rows.length > 0) {
        const talentMessage =
          status === "rejected"
            ? `Your application for ${currentRow.job_title || "your application"} was not selected.`
            : `Your application for ${currentRow.job_title || "your application"} is now ${submissionStatusLabel(status)}.`;
        await client.query(
          `INSERT INTO notifications
             (user_id, type, title, message, related_id, related_type)
           SELECT $1, 'job_application_status_changed', 'Application update', $2, $3, 'job_submission'
            WHERE NOT EXISTS (
              SELECT 1
                FROM notifications
               WHERE user_id = $1
                 AND type = 'job_application_status_changed'
                   AND related_id = $4
                 AND message = $2
            )`,
            [talentUser.rows[0].id, talentMessage, id, id],
        );
      }

      const clientName =
        [currentRow.client_first_name, currentRow.client_last_name]
          .filter(Boolean)
          .join(" ") ||
        currentRow.client_company ||
        "A Client";
      const talentName =
        [currentRow.first_name, currentRow.last_name]
          .filter(Boolean)
          .join(" ") ||
        currentRow.applicant_name ||
        "a Talent";
      const adminMessage =
        `${clientName} changed ${talentName}'s application for ` +
        `${currentRow.job_title || "a job"} to ${submissionStatusLabel(status)}.`;
      await client.query(
        `INSERT INTO notifications
           (user_id, type, title, message, related_id, related_type)
         SELECT u.id, 'client_application_status_changed',
                'Client updated application', $1, $2, 'job_submission'
           FROM users u
          WHERE u.role = 'admin'
            AND NOT EXISTS (
              SELECT 1
                FROM notifications n
               WHERE n.user_id = u.id
                 AND n.type = 'client_application_status_changed'
                   AND n.related_id = $3
                 AND n.message = $1
            )`,
        [adminMessage, id, id],
      );
      await client.query("COMMIT");

      // Re-fetch via canonical projection (same as GET endpoints) so the response
      // shape is consistent and no raw DB columns bypass the sanitizer.
      const [updated, threshold] = await Promise.all([
        query(
          `${CLIENT_SUBMISSION_SELECT}
           WHERE js.id = $1 AND js.client_id = $2`,
          [id, userId],
        ),
        getNameRevealThreshold(),
      ]);
      if (updated.rows.length === 0) return res.status(404).json({ error: "Submission not found or forbidden" });
      const revealed = revealedStatusesForThreshold(threshold);
      return res.json(sanitizeClientSubmissionRow(updated.rows[0], revealed));
      */
    } catch (err: any) {
      console.error("Client application status update failed:", err);
      return res.status(500).json({ error: "Failed to update application status" });
    }
  });

  // ── Phase 1: Interview Scheduling (client-driven) ────────────────────────────
  //
  // Ownership rule: every endpoint below verifies that the authenticated client's
  // user ID matches job_submissions.client_id — same pattern as job deletion and
  // invitation endpoints. A client can only act on their own submissions.

  // POST /api/client/interviews — schedule a new interview round
  app.post("/api/client/interviews", pipelineMutationLimiter, authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { submissionId, interviewType = "initial", proposedTimes, candidateNotes, internalNotes, durationMinutes, meetingLink } = req.body;
      if (!submissionId) return res.status(400).json({ error: "submissionId is required" });
      if (!Array.isArray(proposedTimes) || proposedTimes.length === 0) {
        return res.status(400).json({ error: "proposedTimes must be a non-empty array of time slots" });
      }
      const normalizedProposedTimes = normalizeInterviewTimes(proposedTimes);
      if (!normalizedProposedTimes) {
        return res.status(400).json({ error: "proposedTimes must contain one to ten valid time slots" });
      }
      const validTypes = ["initial", "technical", "final", "culture", "other"];
      if (!validTypes.includes(interviewType)) {
        return res.status(400).json({ error: "interviewType must be one of: " + validTypes.join(", ") });
      }
      // Validate optional duration (15–240 minutes for new interviews)
      let parsedDuration: number | null = null;
      if (durationMinutes !== undefined && durationMinutes !== null) {
        parsedDuration = Number(durationMinutes);
        if (!Number.isInteger(parsedDuration) || parsedDuration < 15 || parsedDuration > 240) {
          return res.status(400).json({ error: "durationMinutes must be an integer between 15 and 240" });
        }
      }
      // Validate optional meeting link
      let normalizedClientMeetingLink: string | null | undefined;
      if (meetingLink !== undefined) {
        normalizedClientMeetingLink = normalizeMeetingLink(meetingLink);
        if (normalizedClientMeetingLink === undefined) {
          return res.status(400).json({ error: "meetingLink must be a valid http(s) URL no longer than 2048 characters" });
        }
      }

      // Ownership: submission must belong to this client (formal pipeline guard)
      const subGuard = await loadClientFormalSubmission(submissionId, userId, {
        extraCols: ", j.title AS job_title",
        joinClause: "JOIN jobs j ON j.id = js.job_id",
      });
      if (!subGuard.ok) return res.status(subGuard.status).json({ error: subGuard.error });
      const submission = subGuard.row;

      // Guard: can only schedule interviews for submissions that are in a scheduleable state
      const scheduleable = ["shortlisted", "reviewed", "under_review", "interviewing"];
      if (!scheduleable.includes(submission.status)) {
        return res.status(409).json({
          error: "cannot_schedule_interview",
          message: `Submission status '${submission.status}' does not allow scheduling an interview. ` +
            `Submission must be shortlisted, reviewed, under_review, or already interviewing.`,
        });
      }

      // Note: no conflict check on proposed times — the talent may accept any of the
      // offered slots later. Conflict enforcement happens at the moment of confirmation
      // (talent accept → PATCH /api/talent/interviews/:id/respond, or admin direct-confirm).

      // Determine next round number
      const roundResult = await query(
        `SELECT COALESCE(MAX(round_number), 0) + 1 AS next_round FROM interviews WHERE submission_id = $1`,
        [submissionId],
      );
      const roundNumber = roundResult.rows[0].next_round;

      // Create the interview row (duration_minutes and meeting_link nullable for backward compat)
       const insert = await query(
         `INSERT INTO interviews
            (submission_id, round_number, interview_type, status, proposed_times,
             current_proposal_owner, proposal_exchange_count,
             candidate_notes, internal_notes, created_by, duration_minutes, meeting_link)
          VALUES ($1, $2, $3, 'proposed', $4, 'talent', 0, $5, $6, $7, $8, $9)
         RETURNING *`,
        [submissionId, roundNumber, interviewType, JSON.stringify(normalizedProposedTimes),
         candidateNotes ?? null, internalNotes ?? null, userId, parsedDuration,
         normalizedClientMeetingLink ?? null],
      );
      const interview = insert.rows[0];
       await query(
         `INSERT INTO interview_proposals
            (interview_id, proposer_id, proposer_role, action, proposed_times)
          VALUES ($1, $2, 'client', 'initial', $3)`,
         [interview.id, userId, JSON.stringify(normalizedProposedTimes)],
       );

      // Side-effect: advance submission to 'interviewing' if not already there
      if (submission.status !== "interviewing") {
        await query(
          `UPDATE job_submissions SET status = 'interviewing', updated_at = NOW() WHERE id = $1`,
          [submissionId],
        );
        // Audit trail
        await query(
          `INSERT INTO job_application_status_history
             (application_id, previous_status, new_status, note, changed_by)
           VALUES ($1, $2, 'interviewing', $3, $4)`,
          [submissionId, submission.status,
           `Round ${roundNumber} interview scheduled (type: ${interviewType})`, userId],
        );
        await notifyTalentOfApplicationStatusChange({
          submissionId,
          talentUserId: submission.talent_id,
          applicantEmail: submission.email,
          jobTitle: submission.job_title,
          previousStatus: submission.status,
          newStatus: "interviewing",
        });
      }
      // Idempotent interview_proposed notification to talent (fire-and-forget)
      if (submission.talent_id) {
        storage.createNotification({
          userId: submission.talent_id as string,
          type: "interview_proposed",
          title: "Interview proposed",
          message: `A ${interviewType} interview has been proposed for "${submission.job_title}". Please review the suggested times.`,
          relatedId: String(interview.id),
          relatedType: "interview",
        }).catch((notifyErr: any) => console.error("interview_proposed notification failed:", notifyErr));

        // Transactional email to talent (fire-and-forget — failure never rolls back the scheduling)
        sendInterviewProposalEmail({
          talentUserId: submission.talent_id as string,
          jobTitle: submission.job_title,
          proposedTimes: normalizedProposedTimes,
          durationMinutes: parsedDuration,
          candidateNotes: candidateNotes ?? null,
          interviewType,
          roundNumber: interview.round_number ?? null,
          proposerRole: "client",
        }).catch((emailErr: any) => console.error("client interview proposal email failed:", emailErr));
      }

      return res.status(201).json(interview);
    } catch (err: any) {
      console.error("POST /api/client/interviews error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/client/interviews — two modes:
  //   ?submissionId=xxx  → existing submission-scoped listing (backward compatible)
  //   (no params)        → calendar-wide listing of all this client's interviews
  app.get("/api/client/interviews", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { submissionId } = req.query as { submissionId?: string };

      if (submissionId) {
        // ── Existing submission-scoped behavior (unchanged) ──────────────────
        const ownerCheck = await loadClientFormalSubmission(submissionId, userId);
        if (!ownerCheck.ok) return res.status(ownerCheck.status).json({ error: ownerCheck.error });

        const result = await query(
          `SELECT * FROM interviews WHERE submission_id = $1 ORDER BY round_number ASC, created_at ASC`,
          [submissionId],
        );
        return res.json(result.rows);
      }

      // ── Calendar-wide listing (new, no submissionId) ─────────────────────
      // Returns all interviews across this client's formal-pipeline submissions,
      // enriched with job/talent display data for calendar cards.
      const result = await query(
        `SELECT i.*,
                j.title     AS job_title,
                j.company   AS job_company,
                c.full_name AS talent_full_name
           FROM interviews i
           JOIN job_submissions js ON js.id = i.submission_id
              AND js.client_id = $1
              AND js.${FORMAL_PIPELINE_PREDICATE}
           JOIN jobs j ON j.id = js.job_id
           LEFT JOIN candidates c ON c.id = (
             SELECT cand.id FROM candidates cand
              WHERE cand.user_id = js.talent_id
              LIMIT 1
           )
          ORDER BY
            CASE WHEN i.confirmed_time IS NOT NULL THEN i.confirmed_time
                 ELSE i.created_at END DESC`,
        [userId],
      );
      return res.json(result.rows);
    } catch (err: any) {
      console.error("GET /api/client/interviews error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/client/interviews/:id — confirm, reschedule, or cancel an interview
  // Body: { status, confirmedTime?, proposedTimes?, candidateNotes?, internalNotes?,
  //         meetingLink?, cancellationReason?, durationMinutes? }
  app.patch("/api/client/interviews/:id", pipelineMutationLimiter, authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;
       const { status, confirmedTime, proposedTimes, candidateNotes, internalNotes, meetingLink, cancellationReason, durationMinutes } = req.body;

      const txClient = await pool.connect();
      let transactionClosed = false;
      try {
        await txClient.query("BEGIN");
        // Lock the interview before checking ownership/turn so two responses
        // cannot confirm or counter the same proposal at once.
        const interviewResult = await txClient.query(
          `SELECT i.*, js.client_id, js.talent_id, js.status AS submission_status, js.id AS js_id
           FROM interviews i
           JOIN job_submissions js ON js.id = i.submission_id
           WHERE i.id = $1 AND js.client_id = $2
             AND js.${FORMAL_PIPELINE_PREDICATE}
           FOR UPDATE OF i`,
          [id, userId],
        );
        if (interviewResult.rows.length === 0) {
          await txClient.query("ROLLBACK");
          return res.status(404).json({ error: "Interview not found or forbidden" });
        }
        const interview = interviewResult.rows[0];

      const validTransitions: Record<string, string[]> = {
        proposed:     ["confirmed", "cancelled"],
        confirmed:    ["rescheduled", "cancelled"],
        rescheduled:  ["confirmed", "cancelled"],
      };
      const allowed = validTransitions[interview.status] ?? [];

      // Build update payload
      const updates: Record<string, any> = { updated_at: "NOW()" };
      const params: any[] = [];
      let proposalTimesForHistory: Array<{ start: string; end?: string; timezone: string }> | null = null;
      let confirmedTimeForHistory: string | null = null;
      let confirmedTimeZoneForHistory: string | null = null;

      if (status) {
        if (!allowed.includes(status)) {
          await txClient.query("ROLLBACK");
          transactionClosed = true;
          return res.status(409).json({
            error: "invalid_transition",
            message: `Cannot transition from '${interview.status}' to '${status}'. ` +
              `Allowed transitions: ${allowed.join(", ") || "none"}.`,
          });
        }
        if (status === "confirmed") {
          if (!confirmedTime) {
            await txClient.query("ROLLBACK");
            return res.status(400).json({ error: "confirmedTime is required when confirming an interview" });
          }
          if (interview.current_proposal_owner !== "client") {
            await txClient.query("ROLLBACK");
            return res.status(409).json({ error: "It is not the client's turn to confirm this interview proposal" });
          }
          const confirmedTimestamp = parseInterviewTimestamp(confirmedTime);
          const selectedSlot = Array.isArray(interview.proposed_times)
            ? interview.proposed_times.find((slot: any) =>
                typeof slot?.start === "string" && parseInterviewTimestamp(slot.start) === confirmedTimestamp)
            : undefined;
          if (Number.isNaN(confirmedTimestamp) || !selectedSlot) {
            await txClient.query("ROLLBACK");
            return res.status(400).json({ error: "confirmedTime must match one of the proposed interview slots" });
          }
          confirmedTimeForHistory = new Date(confirmedTimestamp).toISOString();
          confirmedTimeZoneForHistory = normalizeInterviewTimeZone(selectedSlot.timezone) ?? "UTC";

          // Serialize with per-talent lock — same key used by talent accept and admin confirm
          if (interview.talent_id) {
            await txClient.query(
              `SELECT pg_advisory_xact_lock(hashtext($1 || ':interview_confirm'))`,
              [interview.talent_id],
            );
            // Overlap check: no other confirmed interview for the same talent overlaps this slot
            const effectiveDuration = (durationMinutes !== undefined ? Number(durationMinutes) : null)
              ?? interview.duration_minutes ?? 60;
            const slotEnd = new Date(confirmedTimestamp + effectiveDuration * 60_000).toISOString();
            const talentConflict = await txClient.query(
              `SELECT 1 FROM interviews i2
                 JOIN job_submissions js ON js.id = i2.submission_id
                WHERE js.talent_id = $1
                  AND i2.id != $2
                  AND i2.status = 'confirmed'
                  AND i2.confirmed_time IS NOT NULL
                  AND i2.confirmed_time < $4::timestamptz
                  AND (i2.confirmed_time + INTERVAL '1 minute' * COALESCE(i2.duration_minutes, 60)) > $3::timestamptz
                LIMIT 1`,
              [interview.talent_id, interview.id, confirmedTimeForHistory, slotEnd],
            );
            if (talentConflict.rows.length > 0) {
              await txClient.query("ROLLBACK");
              return res.status(409).json({
                error: "interview_time_conflict",
                message: "That time overlaps another scheduled interview for this talent.",
              });
            }
          }

          params.push(confirmedTimeForHistory);
          updates.confirmed_time = `$${params.length}`;
          params.push(confirmedTimeZoneForHistory);
          updates.confirmed_time_zone = `$${params.length}`;
          updates.current_proposal_owner = "NULL";
        }
        if (status === "rescheduled") {
          if (!Array.isArray(proposedTimes) || proposedTimes.length === 0) {
            await txClient.query("ROLLBACK");
            return res.status(400).json({ error: "proposedTimes is required when rescheduling" });
          }
          const normalizedTimes = normalizeInterviewTimes(proposedTimes);
          if (!normalizedTimes) {
            await txClient.query("ROLLBACK");
            return res.status(400).json({ error: "proposedTimes must contain one to ten valid time slots" });
          }
          params.push(JSON.stringify(normalizedTimes));
          updates.proposed_times = `$${params.length}`;
          proposalTimesForHistory = normalizedTimes;
          updates.confirmed_time = "NULL";
          updates.confirmed_time_zone = "NULL";
        }
        if (status === "cancelled") {
          updates.confirmed_time = "NULL";
          updates.confirmed_time_zone = "NULL";
          updates.cancelled_at = "NOW()";
          if (cancellationReason !== undefined && typeof cancellationReason === "string") {
            params.push(cancellationReason.slice(0, 2000));
            updates.cancellation_reason = `$${params.length}`;
          }
        }
        params.push(status);
        updates.status = `$${params.length}`;
      }

      // Optional duration update (15–240 for new values; null preserved for legacy rows)
      if (durationMinutes !== undefined && durationMinutes !== null) {
        const dur = Number(durationMinutes);
        if (!Number.isInteger(dur) || dur < 15 || dur > 240) {
          await txClient.query("ROLLBACK");
          transactionClosed = true;
          return res.status(400).json({ error: "durationMinutes must be an integer between 15 and 240" });
        }
        params.push(dur);
        updates.duration_minutes = `$${params.length}`;
      }

      if (candidateNotes !== undefined) {
        if (typeof candidateNotes !== "string" || candidateNotes.length > 5000) {
          await txClient.query("ROLLBACK");
          return res.status(400).json({ error: "candidateNotes must be no longer than 5000 characters" });
        }
        params.push(candidateNotes);
        updates.candidate_notes = `$${params.length}`;
      }
      if (internalNotes !== undefined) {
        if (typeof internalNotes !== "string" || internalNotes.length > 5000) {
          await txClient.query("ROLLBACK");
          return res.status(400).json({ error: "internalNotes must be no longer than 5000 characters" });
        }
        params.push(internalNotes);
        updates.internal_notes = `$${params.length}`;
      }
       if (meetingLink !== undefined) {
         const normalizedMeetingLink = normalizeMeetingLink(meetingLink);
         if (normalizedMeetingLink === undefined) {
           await txClient.query("ROLLBACK");
           transactionClosed = true;
           return res.status(400).json({ error: "meetingLink must be a valid http(s) URL no longer than 2048 characters" });
         }
         params.push(normalizedMeetingLink);
         updates.meeting_link = `$${params.length}`;
       }
      if (proposedTimes !== undefined && status !== "rescheduled") {
        if (interview.current_proposal_owner !== "client") {
          await txClient.query("ROLLBACK");
          transactionClosed = true;
          return res.status(409).json({ error: "It is not the client's turn to propose new interview times" });
        }
        const normalizedTimes = normalizeInterviewTimes(proposedTimes);
        if (!normalizedTimes) {
          await txClient.query("ROLLBACK");
          transactionClosed = true;
          return res.status(400).json({ error: "proposedTimes must contain one to ten valid time slots" });
        }
        params.push(JSON.stringify(normalizedTimes));
        updates.proposed_times = `$${params.length}`;
        proposalTimesForHistory = normalizedTimes;
      }

      if (Object.keys(updates).length === 1) {
        await txClient.query("ROLLBACK");
        return res.status(400).json({ error: "No updatable fields provided" });
      }

      const setClauses = Object.entries(updates)
        .map(([col, val]) => `${col} = ${val === "NOW()" || val === "NULL" ? val : val}`)
        .join(", ");
      params.push(id);
      const updated = await txClient.query(
        `UPDATE interviews SET ${setClauses} WHERE id = $${params.length} RETURNING *`,
        params,
      );

       // Client proposals are recorded separately from interview stages so
       // negotiation can continue indefinitely without changing round_number.
       if (proposedTimes !== undefined || status === "rescheduled") {
         const nextCount = Number(interview.proposal_exchange_count ?? 0) + 1;
          await txClient.query(
           `UPDATE interviews
               SET current_proposal_owner = 'talent',
                   proposal_exchange_count = $1,
                   updated_at = NOW()
             WHERE id = $2`,
           [nextCount, id],
         );
          await txClient.query(
           `INSERT INTO interview_proposals
              (interview_id, proposer_id, proposer_role, action, proposed_times)
            VALUES ($1, $2, 'client', 'counter', $3)`,
            [id, userId, JSON.stringify(proposalTimesForHistory ?? interview.proposed_times ?? [])],
         );
       }
       if (status === "confirmed") {
          await txClient.query(
           `INSERT INTO interview_proposals
             (interview_id, proposer_id, proposer_role, action, proposed_times, selected_time, selected_time_zone)
           VALUES ($1, $2, 'client', 'accepted', $3, $4, $5)`,
           [id, userId, JSON.stringify(interview.proposed_times ?? []), confirmedTimeForHistory, confirmedTimeZoneForHistory],
         );
         if (interview.submission_status !== "interviewing") {
           await txClient.query(
             `UPDATE job_submissions SET status = 'interviewing', updated_at = NOW() WHERE id = $1`,
             [interview.submission_id],
           );
           await txClient.query(
             `INSERT INTO job_application_status_history
                (application_id, previous_status, new_status, note, changed_by)
              VALUES ($1, $2, 'interviewing', 'Client confirmed an interview time', $3)`,
             [interview.submission_id, interview.submission_status, userId],
           );
         }
       }

       await txClient.query("COMMIT");
       transactionClosed = true;
        const finalResult = await query(`SELECT * FROM interviews WHERE id = $1`, [id]);

       // ── Post-commit notifications (idempotent side effects) ──────────────
       // Look up the talent user id from the submission for notifications
       const subRow = await query(
         `SELECT js.talent_id, j.title AS job_title
            FROM job_submissions js
            JOIN jobs j ON j.id = js.job_id
           WHERE js.id = $1`,
         [interview.submission_id],
       ).catch(() => ({ rows: [] as any[] }));
       const talentUserId = subRow.rows[0]?.talent_id;
       const jobTitle = subRow.rows[0]?.job_title ?? "the position";

       if (status === "confirmed" && talentUserId) {
         storage.createNotification({
           userId: talentUserId,
           type: "interview_confirmed",
           title: "Interview confirmed",
           message: `Your interview for "${jobTitle}" has been confirmed.`,
           relatedId: String(id),
           relatedType: "interview",
         }).catch((e: any) => console.error("interview_confirmed notification failed:", e));
       } else if (status === "rescheduled" && talentUserId) {
         storage.createNotification({
           userId: talentUserId,
           type: "interview_rescheduled",
           title: "Interview rescheduled",
           message: `New interview times have been proposed for "${jobTitle}". Please review.`,
           relatedId: String(id),
           relatedType: "interview",
         }).catch((e: any) => console.error("interview_rescheduled notification failed:", e));
       } else if (status === "cancelled" && talentUserId) {
         storage.createNotification({
           userId: talentUserId,
           type: "interview_cancelled",
           title: "Interview cancelled",
           message: `Your scheduled interview for "${jobTitle}" has been cancelled.`,
           relatedId: String(id),
           relatedType: "interview",
         }).catch((e: any) => console.error("interview_cancelled notification failed:", e));
       }

       return res.json(finalResult.rows[0] ?? updated.rows[0]);
      } catch (txErr) {
        if (!transactionClosed) {
          await txClient.query("ROLLBACK").catch(() => {});
          transactionClosed = true;
        }
        throw txErr;
      } finally {
        if (!transactionClosed) await txClient.query("ROLLBACK").catch(() => {});
        txClient.release();
      }
    } catch (err: any) {
      console.error("PATCH /api/client/interviews/:id error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/client/interviews/:id/proposals", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
       const result = await query(
         `SELECT ip.id, ip.action, ip.proposer_role, ip.proposed_times,
                 ip.selected_time AS "selectedTime",
                 ip.selected_time_zone AS "selectedTimeZone",
                 ip.created_at
           FROM interview_proposals ip
           JOIN interviews i ON i.id = ip.interview_id
           JOIN job_submissions js ON js.id = i.submission_id
          WHERE ip.interview_id = $1 AND js.client_id = $2
            AND js.${FORMAL_PIPELINE_PREDICATE}
          ORDER BY ip.created_at ASC`,
        [req.params.id, userId],
      );
      return res.json(result.rows);
    } catch (err: any) {
      console.error("GET /api/client/interviews/:id/proposals error:", err);
      return res.status(500).json({ error: "Failed to load interview proposal history" });
    }
  });

  // PATCH /api/client/interviews/:id/outcome — record the outcome of a completed interview
  // Body: { outcome: 'advance' | 'reject' | 'pending', internalNotes? }
  // Sets interview.status = 'completed'. If outcome = 'reject', also sets
  // job_submissions.status = 'rejected' with an audit trail entry.
  app.patch("/api/client/interviews/:id/outcome", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;
      const { outcome, internalNotes } = req.body;

      const validOutcomes = ["advance", "reject", "pending"];
      if (!outcome || !validOutcomes.includes(outcome)) {
        return res.status(400).json({ error: "outcome must be one of: " + validOutcomes.join(", ") });
      }

      // Load interview + verify ownership (formal pipeline guard)
      const interviewResult = await query(
        `SELECT i.*, js.client_id, js.status AS submission_status, js.id AS js_id
         FROM interviews i
         JOIN job_submissions js ON js.id = i.submission_id
         WHERE i.id = $1 AND js.client_id = $2
           AND js.${FORMAL_PIPELINE_PREDICATE}`,
        [id, userId],
      );
      if (interviewResult.rows.length === 0) {
        return res.status(404).json({ error: "Interview not found or forbidden" });
      }
      const interview = interviewResult.rows[0];

      if (interview.status === "cancelled") {
        return res.status(409).json({ error: "Cannot record outcome for a cancelled interview" });
      }
      if (interview.status === "completed") {
        return res.status(409).json({ error: "Outcome already recorded for this interview" });
      }

      // Mark interview completed (completed_at records the instant it was logged)
      const updatedInterview = await query(
        `UPDATE interviews
         SET status = 'completed', outcome = $1, internal_notes = COALESCE($2, internal_notes),
             completed_at = NOW(), updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [outcome, internalNotes ?? null, id],
      );

      // Side-effect: if rejected, advance submission to 'rejected'
      if (outcome === "reject" && interview.submission_status !== "rejected") {
        await query(
          `UPDATE job_submissions SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
          [interview.js_id],
        );
        await query(
          `INSERT INTO job_application_status_history
             (application_id, previous_status, new_status, note, changed_by)
           VALUES ($1, $2, 'rejected', $3, $4)`,
          [interview.js_id, interview.submission_status,
           `Rejected after interview round ${interview.round_number}`, userId],
        );
      }

      return res.json(updatedInterview.rows[0]);
    } catch (err: any) {
      console.error("PATCH /api/client/interviews/:id/outcome error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Phase 2: Offer Flow (client extends, talent responds) ────────────────────
  //
  // Ownership rules:
  //   - Client endpoints verify job_submissions.client_id = authenticated user id.
  //   - Talent endpoints use the talent JWT (type:"candidate") and verify ownership
  //     via job_submissions.talent_id (linked users.id) or legacy email match.
  //
  // Rate-mismatch flag rules (rate_below_expectation / rate_delta):
  //   set ONLY when offer currency === talent's expected currency AND
  //   offer engagement type === talent's expected engagement type AND
  //   the talent has an expectation recorded. Otherwise both stay NULL.
  //   Never fake FX conversion.

  // POST /api/client/offers — client creates a formal offer for a submission
  // Body: { submissionId, rate, rateCurrency?, proposedStartDate?, expiresAt?, notes? }
  // engagement_type is snapshotted from the jobs row — NOT accepted from the body.
  app.post("/api/client/offers", pipelineMutationLimiter, authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { submissionId, rate, rateCurrency = "PHP", proposedStartDate, expiresAt, notes } = req.body;
      if (!submissionId) return res.status(400).json({ error: "submissionId is required" });
      const rateNum = Number(rate);
      if (rate === undefined || rate === null || Number.isNaN(rateNum) || rateNum <= 0) {
        return res.status(400).json({ error: "rate must be a positive number" });
      }
      if (typeof rateCurrency !== "string" || !/^[A-Z]{3}$/.test(rateCurrency)) {
        return res.status(400).json({ error: "rateCurrency must be a 3-letter uppercase currency code" });
      }

      // Ownership + submission state (formal pipeline guard)
      const subGuard = await loadClientFormalSubmission(submissionId, userId, {
        extraCols: ", j.engagement_type AS job_engagement_type",
        joinClause: "JOIN jobs j ON j.id = js.job_id",
      });
      if (!subGuard.ok) return res.status(subGuard.status).json({ error: subGuard.error });
      const submission = subGuard.row;

      // Guard: offer only from states where an offer makes sense.
      // offer_declined allows a re-offer (new row).
      const offerable = ["shortlisted", "reviewed", "under_review", "interviewing", "offer_declined"];
      if (!offerable.includes(submission.status)) {
        return res.status(409).json({
          error: "cannot_extend_offer",
          message: `Submission status '${submission.status}' does not allow extending an offer. ` +
            `Submission must be one of: ${offerable.join(", ")}.`,
        });
      }

      // Guard: no second live offer while one is pending
      const pending = await query(
        `SELECT id FROM offers WHERE submission_id = $1 AND status = 'sent' LIMIT 1`,
        [submissionId],
      );
      if (pending.rows.length > 0) {
        return res.status(409).json({
          error: "offer_already_pending",
          message: "An offer is already awaiting the talent's response for this submission.",
        });
      }

      // Snapshot engagement_type from the jobs row — the DB CHECK only accepts
      // 'Lite' | 'Standard'; legacy jobs with NULL/other values cannot get offers.
      const engagementType: string | null = submission.job_engagement_type;
      if (engagementType !== "Lite" && engagementType !== "Standard") {
        return res.status(409).json({
          error: "job_missing_engagement_type",
          message: "The job for this submission has no valid engagement type (Lite or Standard). " +
            "Update the job before extending an offer.",
        });
      }

      // Snapshot the talent's rate expectation at offer creation time.
      // Source of truth: candidates.preferences (rateAmount / rateCurrency / rateEngagementType),
      // resolved via candidates.user_id = talent_id, falling back to email match.
      let talentExpectedRate: string | null = null;
      let talentExpectedCurrency: string | null = null;
      let talentExpectedEngagement: string | null = null;
      const candResult = await query(
        `SELECT preferences FROM candidates
         WHERE ($1::text IS NOT NULL AND user_id = $1::text)
            OR (lower(email) = lower($2))
         ORDER BY (user_id = $1::text) DESC NULLS LAST
         LIMIT 1`,
        [submission.talent_id ?? null, submission.email],
      );
      if (candResult.rows.length > 0) {
        const prefs = candResult.rows[0].preferences || {};
        const amt = Number(prefs.rateAmount);
        if (prefs.rateAmount != null && !Number.isNaN(amt) && amt > 0) {
          talentExpectedRate = String(prefs.rateAmount);
          talentExpectedCurrency = prefs.rateCurrency ? String(prefs.rateCurrency) : null;
          talentExpectedEngagement = prefs.rateEngagementType ? String(prefs.rateEngagementType) : null;
        }
      }

      // Mismatch flag: computed ONLY when currencies AND engagement types both match.
      let rateBelowExpectation: boolean | null = null;
      let rateDelta: string | null = null;
      if (
        talentExpectedRate !== null &&
        talentExpectedCurrency !== null &&
        talentExpectedCurrency === rateCurrency &&
        talentExpectedEngagement !== null &&
        talentExpectedEngagement === engagementType
      ) {
        const expected = Number(talentExpectedRate);
        rateBelowExpectation = rateNum < expected;
        rateDelta = (rateNum - expected).toFixed(2);
      }

      // Insert offer + submission status side-effect in ONE transaction.
      // The partial unique index uq_offers_one_pending_per_submission is the
      // authoritative single-pending-offer guard — concurrent creates lose with
      // a unique violation, mapped to 409 offer_already_pending.
      const txClient = await pool.connect();
      let offer: any;
      try {
        await txClient.query("BEGIN");
        const insert = await txClient.query(
          `INSERT INTO offers
             (submission_id, engagement_type, rate, rate_currency, proposed_start_date,
              status, talent_expected_rate, talent_expected_currency, talent_expected_engagement,
              rate_below_expectation, rate_delta, expires_at, notes)
           VALUES ($1, $2, $3, $4, $5, 'sent', $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [submissionId, engagementType, rateNum.toFixed(2), rateCurrency,
           proposedStartDate ?? null, talentExpectedRate, talentExpectedCurrency,
           talentExpectedEngagement, rateBelowExpectation, rateDelta,
           expiresAt ?? null, notes ?? null],
        );
        offer = insert.rows[0];

        // Side-effect: submission → 'offer_extended' with audit trail
        if (submission.status !== "offer_extended") {
          await txClient.query(
            `UPDATE job_submissions SET status = 'offer_extended', updated_at = NOW() WHERE id = $1`,
            [submissionId],
          );
          await txClient.query(
            `INSERT INTO job_application_status_history
               (application_id, previous_status, new_status, note, changed_by)
             VALUES ($1, $2, 'offer_extended', $3, $4)`,
            [submissionId, submission.status,
             `Offer extended (${rateCurrency} ${rateNum.toFixed(2)}, ${engagementType})`, userId],
          );
        }
        await txClient.query("COMMIT");
      } catch (txErr: any) {
        await txClient.query("ROLLBACK").catch(() => {});
        if (txErr?.code === "23505") {
          return res.status(409).json({
            error: "offer_already_pending",
            message: "An offer is already awaiting the talent's response for this submission.",
          });
        }
        throw txErr;
      } finally {
        txClient.release();
      }

      // Fire-and-forget: notify the talent that they have received an offer.
      // Prefer submission.talent_id (the talent's users.id); fall back to email
      // lookup for legacy rows where talent_id is NULL (email-matched candidates).
      // No PII is included in the notification message.
      (async () => {
        try {
          let talentUserId: string | null = submission.talent_id ?? null;
          if (!talentUserId && submission.email) {
            const userLookup = await query(
              `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
              [submission.email],
            );
            talentUserId = userLookup.rows[0]?.id ?? null;
          }
          if (talentUserId) {
            await storage.createNotification({
              userId: talentUserId,
              type: "offer_received",
              title: "You have a new offer",
              message: "A client has extended an offer for one of your applications. Review it in your portal.",
              relatedId: String(offer.id),
              relatedType: "offer",
            });
          }
        } catch (notifyErr: any) {
          console.error("POST /api/client/offers — failed to create talent notification:", notifyErr);
        }

        // Also send an email so the talent is alerted even when not in the portal.
        try {
          const talentEmail: string | null = submission.email ?? null;
          if (!talentEmail) return;

          const { sendApplicantEmail, isEmailServiceConfigured } =
            await import("./services/microsoftGraphEmailService.ts");
          const { buildEmailContext, renderApplicantEmail, renderBrandedEmailLayout } =
            await import("./services/emailVariableResolver.ts");
          if (!isEmailServiceConfigured()) {
            console.warn("POST /api/client/offers — email service not configured; skipping offer email");
            return;
          }

          const subject = "You have a new offer — review it in your portal";
          const contentHtml = `
  <h2 style="color:#1a1a2e;margin-bottom:8px;">You have a new offer</h2>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    A client has extended a formal offer for one of your applications.
  </p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    Log in to your portal to review the offer details and respond before it expires.
  </p>
  <p style="margin:24px 0;">
    <a href="{{portal_url}}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:15px;display:inline-block;">
      Review Offer
    </a>
  </p>
  <p style="color:#888;font-size:13px;">
    You can accept or decline the offer from your
    <a href="{{portal_url}}" style="color:#4f46e5;">My Applications</a> page.
  </p>
`.trim();
          const rendered = renderApplicantEmail(
            { subject, bodyHtml: renderBrandedEmailLayout(contentHtml) },
            buildEmailContext({
              firstName: submission.first_name,
              lastName: submission.last_name,
              applicantName: submission.applicant_name,
              email: talentEmail,
              jobTitle: submission.job_title,
            }),
          );
          if (rendered.unresolvedKeys.length > 0) {
            console.warn(
              `POST /api/client/offers — blocked offer email for ${offer.id}; unresolved variables: ${rendered.unresolvedKeys.join(", ")}`,
            );
            return;
          }

          const result = await sendApplicantEmail({
            to: talentEmail,
            subject: rendered.subject,
            bodyHtml: rendered.bodyHtml,
          });
          if (result.success) {
            console.log(`✅ Offer notification email sent to ${talentEmail} for offer ${offer.id}`);
          } else {
            console.warn(`POST /api/client/offers — offer email failed for ${talentEmail}:`, result.error);
          }
        } catch (emailErr: any) {
          console.error("POST /api/client/offers — unexpected error sending offer email:", emailErr);
        }
      })();

      return res.status(201).json(offer);
    } catch (err: any) {
      console.error("POST /api/client/offers error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/client/offers?submissionId= — list offers for a submission (client view)
  app.get("/api/client/offers", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { submissionId } = req.query as { submissionId?: string };
      if (!submissionId) return res.status(400).json({ error: "submissionId query param is required" });

      // Ownership check (formal pipeline guard)
      const ownerCheck = await loadClientFormalSubmission(submissionId, userId);
      if (!ownerCheck.ok) return res.status(ownerCheck.status).json({ error: ownerCheck.error });

      const result = await query(
        `SELECT o.* FROM offers o
         JOIN job_submissions js ON js.id = o.submission_id
         WHERE o.submission_id = $1 AND js.${FORMAL_PIPELINE_PREDICATE}
         ORDER BY o.sent_at DESC, o.created_at DESC`,
        [submissionId],
      );
      return res.json(result.rows);
    } catch (err: any) {
      console.error("GET /api/client/offers error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/client/offers/:id/respond — client responds to a talent counter.
  // Counter rows are immutable proposals; accepting/declining closes the row,
  // while another counter creates a new child owned by the client.
  app.patch("/api/client/offers/:id/respond", pipelineMutationLimiter, authenticateJWT, async (req: Request, res: Response) => {
    try {
      const clientId = (req as any).user?.id;
      const { action, counterRate, counterRateCurrency, proposedStartDate, notes } = req.body ?? {};
      if (!clientId) return res.status(401).json({ error: "Unauthorized" });
      if (!["accept", "decline", "counter"].includes(action)) {
        return res.status(400).json({ error: "action must be 'accept', 'decline', or 'counter'" });
      }
      const counterRateNum = Number(counterRate);
      if (action === "counter" &&
          (counterRate === undefined || counterRate === null || Number.isNaN(counterRateNum) || counterRateNum <= 0)) {
        return res.status(400).json({ error: "counterRate must be a positive number" });
      }
      const counterCurrency = counterRateCurrency ?? "PHP";
      if (action === "counter" && (typeof counterCurrency !== "string" || !/^[A-Z]{3}$/.test(counterCurrency))) {
        return res.status(400).json({ error: "counterRateCurrency must be a 3-letter uppercase currency code" });
      }
      if (action === "counter" && notes !== undefined &&
          (typeof notes !== "string" || notes.length > 5000)) {
        return res.status(400).json({ error: "notes must be no longer than 5000 characters" });
      }
      if (action === "counter" && proposedStartDate !== undefined &&
          proposedStartDate !== null &&
          (typeof proposedStartDate !== "string" || Number.isNaN(Date.parse(proposedStartDate)))) {
        return res.status(400).json({ error: "proposedStartDate must be a valid date" });
      }

      const loaded = await query(
        `SELECT o.*, js.status AS submission_status, js.talent_id, js.id AS js_id
           FROM offers o
           JOIN job_submissions js ON js.id = o.submission_id
          WHERE o.id = $1
            AND js.client_id = $2
            AND js.${FORMAL_PIPELINE_PREDICATE}
            AND o.status = 'sent'
            AND o.proposer_role = 'talent'
            AND o.parent_offer_id IS NOT NULL`,
        [req.params.id, clientId],
      );
      if (!loaded.rows.length) return res.status(404).json({ error: "Talent counter offer not found" });
      const offer = loaded.rows[0];
      const txClient = await pool.connect();
      let responseOffer: any;
      try {
        await txClient.query("BEGIN");
        const locked = await txClient.query(
          `SELECT id, status, expires_at FROM offers WHERE id = $1 FOR UPDATE`,
          [offer.id],
        );
        if (!locked.rows.length || locked.rows[0].status !== "sent") {
          await txClient.query("ROLLBACK");
          return res.status(409).json({ error: "offer_not_pending", message: "This counter offer is no longer pending." });
        }
        if (locked.rows[0].expires_at && new Date(locked.rows[0].expires_at) < new Date()) {
          await txClient.query("ROLLBACK");
          return res.status(409).json({ error: "offer_expired", message: "This counter offer has expired." });
        }
        if (action === "counter") {
          await txClient.query(
            `UPDATE offers SET status = 'countered', responded_at = NOW(), updated_at = NOW()
              WHERE id = $1`,
            [offer.id],
          );
          const expectedRate = offer.talent_expected_rate;
          const expectedCurrency = offer.talent_expected_currency;
          const expectedEngagement = offer.talent_expected_engagement;
          const mismatchApplies = expectedRate !== null &&
            expectedCurrency !== null &&
            expectedCurrency === counterCurrency &&
            expectedEngagement !== null &&
            expectedEngagement === offer.engagement_type;
          const below = mismatchApplies ? counterRateNum < Number(expectedRate) : null;
          const delta = mismatchApplies ? (counterRateNum - Number(expectedRate)).toFixed(2) : null;
          const counter = await txClient.query(
            `INSERT INTO offers
               (submission_id, engagement_type, rate, rate_currency, proposed_start_date,
                status, parent_offer_id, proposer_role, talent_expected_rate,
                talent_expected_currency, talent_expected_engagement, rate_below_expectation,
                rate_delta, expires_at, notes)
             VALUES ($1, $2, $3, $4, $5, 'sent', $6, 'client', $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
              offer.js_id, offer.engagement_type, counterRateNum.toFixed(2), counterCurrency,
              proposedStartDate ?? offer.proposed_start_date ?? null, offer.id,
              expectedRate, expectedCurrency, expectedEngagement, below, delta,
              offer.expires_at ?? null, notes ?? null,
            ],
          );
          responseOffer = counter.rows[0];
        } else {
          const nextStatus = action === "accept" ? "accepted" : "declined";
          const nextSubmissionStatus = action === "accept" ? "offer_accepted" : "offer_declined";
          const updated = await txClient.query(
            `UPDATE offers SET status = $1, responded_at = NOW(), updated_at = NOW()
              WHERE id = $2 AND status = 'sent'
              RETURNING *`,
            [nextStatus, offer.id],
          );
          if (!updated.rows.length) {
            await txClient.query("ROLLBACK");
            return res.status(409).json({ error: "offer_not_pending", message: "This counter offer is no longer pending." });
          }
          responseOffer = updated.rows[0];
          await txClient.query(
            `UPDATE job_submissions SET status = $1, updated_at = NOW() WHERE id = $2`,
            [nextSubmissionStatus, offer.js_id],
          );
          await txClient.query(
            `INSERT INTO job_application_status_history
               (application_id, previous_status, new_status, note, changed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [offer.js_id, offer.submission_status, nextSubmissionStatus,
             `Client ${action === "accept" ? "accepted" : "declined"} the talent counter offer`, clientId],
          );
        }
        await txClient.query("COMMIT");
      } catch (txErr) {
        await txClient.query("ROLLBACK").catch(() => {});
        throw txErr;
      } finally {
        txClient.release();
      }

      if (offer.talent_id) {
        const actionLabel = action === "accept" ? "accepted" : action === "counter" ? "countered" : "declined";
        storage.createNotification({
          userId: offer.talent_id,
          type: action === "accept" ? "offer_accepted" : action === "counter" ? "offer_countered" : "offer_declined",
          title: `Offer ${actionLabel}`,
          message: `A client has ${actionLabel} your counter offer.`,
          relatedId: String(offer.id),
          relatedType: "offer",
        }).catch((notifyErr: any) => {
          console.error("PATCH /api/client/offers/:id/respond — notification failed:", notifyErr);
        });
      }
      return res.json(responseOffer);
    } catch (err: any) {
      console.error("PATCH /api/client/offers/:id/respond error:", err);
      return res.status(500).json({ error: "Failed to respond to counter offer" });
    }
  });

  // Helper: load an offer + verify the authenticated talent owns its submission.
  // Ownership: job_submissions.talent_id = candidate's linked users.id, or
  // (legacy rows) talent_id IS NULL and submission email matches candidate email.
  // Returns { offer, linkedUserId } or null (a 4xx has already been sent).
  async function loadTalentOwnedOffer(req: Request, res: Response): Promise<{ offer: any; linkedUserId: string | null } | null> {
    const { candidateId } = (req as any).talentAuth;
    const { id } = req.params;

    const candRow = await query(
      `SELECT id, email FROM candidates WHERE id = $1 LIMIT 1`,
      [candidateId],
    );
    if (!candRow.rows.length) {
      res.status(404).json({ error: "Candidate not found" });
      return null;
    }
    const candidateEmail = candRow.rows[0].email as string;
    const userRow = await query(
      `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [candidateEmail],
    );
    const linkedUserId: string | null = userRow.rows[0]?.id ?? null;

    const offerResult = await query(
      `SELECT o.*, js.status AS submission_status, js.id AS js_id,
              js.client_id AS js_client_id,
              j.title AS job_title, j.location AS job_location, j.company AS job_company
       FROM offers o
       JOIN job_submissions js ON js.id = o.submission_id
       JOIN jobs j ON j.id = js.job_id
       WHERE o.id = $1
         AND (
           ($2::text IS NOT NULL AND js.talent_id = $2::text)
           OR (js.talent_id IS NULL AND lower(js.email) = lower($3))
         )`,
      [id, linkedUserId, candidateEmail],
    );
    if (offerResult.rows.length === 0) {
      res.status(404).json({ error: "Offer not found" });
      return null;
    }
    return { offer: offerResult.rows[0], linkedUserId };
  }

  // GET /api/talent/offers — list all offers for the authenticated talent, newest first.
  app.get("/api/talent/offers", authenticateTalentJWT, async (req: Request, res: Response) => {
    try {
      const { candidateId } = (req as any).talentAuth;

      const candRow = await query(
        `SELECT id, email FROM candidates WHERE id = $1 LIMIT 1`,
        [candidateId],
      );
      if (!candRow.rows.length) {
        return res.status(404).json({ error: "Candidate not found" });
      }
      const candidateEmail = candRow.rows[0].email as string;
      const userRow = await query(
        `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
        [candidateEmail],
      );
      const linkedUserId: string | null = userRow.rows[0]?.id ?? null;

       const result = await query(
          `SELECT o.id, o.submission_id, o.engagement_type, o.rate, o.rate_currency,
                  o.parent_offer_id, o.proposer_role,
                o.proposed_start_date, o.status,
                o.talent_expected_rate, o.talent_expected_currency, o.talent_expected_engagement,
                o.rate_below_expectation, o.rate_delta,
                o.sent_at, o.responded_at, o.expires_at, o.notes,
                j.title AS job_title, j.location AS job_location, j.company AS job_company
         FROM offers o
         JOIN job_submissions js ON js.id = o.submission_id
         JOIN jobs j ON j.id = js.job_id
         WHERE (
           ($1::text IS NOT NULL AND js.talent_id = $1::text)
           OR (js.talent_id IS NULL AND lower(js.email) = lower($2))
         )
         AND js.${FORMAL_PIPELINE_PREDICATE}
         ORDER BY o.sent_at DESC NULLS LAST`,
        [linkedUserId, candidateEmail],
      );

      return res.json(
        result.rows.map((o) => ({
          id: o.id,
          submissionId: o.submission_id,
          job: {
            title: o.job_title,
            company: o.job_company || "OnSpot",
            location: o.job_location || undefined,
          },
          engagementType: o.engagement_type,
          rate: o.rate,
          rateCurrency: o.rate_currency,
          proposedStartDate: o.proposed_start_date,
          status: o.status,
           parentOfferId: o.parent_offer_id,
           proposerRole: o.proposer_role,
          talentExpectedRate: o.talent_expected_rate,
          talentExpectedCurrency: o.talent_expected_currency,
          talentExpectedEngagement: o.talent_expected_engagement,
          rateBelowExpectation: o.rate_below_expectation,
          rateDelta: o.rate_delta,
          sentAt: o.sent_at,
          respondedAt: o.responded_at,
          expiresAt: o.expires_at,
          notes: o.notes,
        })),
      );
    } catch (err: any) {
      console.error("GET /api/talent/offers error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/talent/offers/:id — talent view of a specific offer.
  // Rate-sensitive fields shown are the talent's OWN snapshotted expectation;
  // no client-internal fields or contact PII are exposed.
  app.get("/api/talent/offers/:id", authenticateTalentJWT, async (req: Request, res: Response) => {
    try {
      const loaded = await loadTalentOwnedOffer(req, res);
      if (!loaded) return;
      const o = loaded.offer;
      return res.json({
        id: o.id,
        submissionId: o.submission_id,
        job: {
          title: o.job_title,
          company: o.job_company || "OnSpot",
          location: o.job_location || undefined,
        },
        engagementType: o.engagement_type,
        rate: o.rate,
        rateCurrency: o.rate_currency,
        proposedStartDate: o.proposed_start_date,
        status: o.status,
         parentOfferId: o.parent_offer_id,
        talentExpectedRate: o.talent_expected_rate,
        talentExpectedCurrency: o.talent_expected_currency,
        talentExpectedEngagement: o.talent_expected_engagement,
        rateBelowExpectation: o.rate_below_expectation,
        rateDelta: o.rate_delta,
        sentAt: o.sent_at,
        respondedAt: o.responded_at,
        expiresAt: o.expires_at,
        notes: o.notes,
      });
    } catch (err: any) {
      console.error("GET /api/talent/offers/:id error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/talent/offers/:id/respond — talent accepts, declines, or
  // counters an offer. A counter creates a new immutable linked offer row.
  // Body: { action: 'accept' | 'decline' | 'counter', counterRate?,
  //         counterRateCurrency?, proposedStartDate?, notes? }
  app.patch("/api/talent/offers/:id/respond", pipelineMutationLimiter, authenticateTalentJWT, async (req: Request, res: Response) => {
    try {
      const { action, counterRate, counterRateCurrency, proposedStartDate, notes } = req.body ?? {};
      if (!["accept", "decline", "counter"].includes(action)) {
        return res.status(400).json({ error: "action must be 'accept', 'decline', or 'counter'" });
      }
      const counterRateNum = Number(counterRate);
      if (action === "counter" &&
        (counterRate === undefined || counterRate === null || Number.isNaN(counterRateNum) || counterRateNum <= 0)) {
        return res.status(400).json({ error: "counterRate must be a positive number" });
      }
      const counterCurrency = counterRateCurrency ?? "PHP";
      if (action === "counter" && (typeof counterCurrency !== "string" || !/^[A-Z]{3}$/.test(counterCurrency))) {
        return res.status(400).json({ error: "counterRateCurrency must be a 3-letter uppercase currency code" });
      }
      if (action === "counter" && notes !== undefined &&
          (typeof notes !== "string" || notes.length > 5000)) {
        return res.status(400).json({ error: "notes must be no longer than 5000 characters" });
      }
      if (action === "counter" && proposedStartDate !== undefined &&
          proposedStartDate !== null &&
          (typeof proposedStartDate !== "string" || Number.isNaN(Date.parse(proposedStartDate)))) {
        return res.status(400).json({ error: "proposedStartDate must be a valid date" });
      }

      const loaded = await loadTalentOwnedOffer(req, res);
      if (!loaded) return;
      const { offer, linkedUserId } = loaded;
      if (offer.proposer_role === "talent") {
        return res.status(409).json({
          error: "offer_waiting_for_client",
          message: "This is your counter offer and is waiting for the client's response.",
        });
      }

      if (offer.expires_at && new Date(offer.expires_at) < new Date()) {
        return res.status(409).json({ error: "offer_expired", message: "This offer has expired." });
      }

      const newOfferStatus = action === "accept" ? "accepted" : "declined";
      const newSubmissionStatus = action === "accept" ? "offer_accepted" : "offer_declined";

      // Atomic transition + submission side-effect in ONE transaction: only flips
      // if still 'sent' — concurrent accept/decline requests cannot both win.
      const txClient = await pool.connect();
      let respondedOffer: any;
      try {
        await txClient.query("BEGIN");
        const updated = await txClient.query(
          `UPDATE offers
           SET status = $1, responded_at = NOW(), updated_at = NOW()
           WHERE id = $2 AND status = 'sent'
           RETURNING *`,
          [action === "counter" ? "countered" : newOfferStatus, offer.id],
        );
        if (updated.rows.length === 0) {
          await txClient.query("ROLLBACK");
          return res.status(409).json({
            error: "offer_not_pending",
            message: `This offer is no longer pending (current status: ${offer.status}).`,
          });
        }
        respondedOffer = updated.rows[0];

        if (action === "counter") {
          const expectedRate = offer.talent_expected_rate;
          const expectedCurrency = offer.talent_expected_currency;
          const expectedEngagement = offer.talent_expected_engagement;
          const mismatchApplies =
            expectedRate !== null &&
            expectedCurrency !== null &&
            expectedCurrency === counterCurrency &&
            expectedEngagement !== null &&
            expectedEngagement === offer.engagement_type;
          const below = mismatchApplies ? counterRateNum < Number(expectedRate) : null;
          const delta = mismatchApplies ? (counterRateNum - Number(expectedRate)).toFixed(2) : null;
          const counter = await txClient.query(
            `INSERT INTO offers
               (submission_id, engagement_type, rate, rate_currency, proposed_start_date,
                status, parent_offer_id, proposer_role, talent_expected_rate, talent_expected_currency,
                talent_expected_engagement, rate_below_expectation, rate_delta,
                expires_at, notes)
             VALUES ($1, $2, $3, $4, $5, 'sent', $6, 'talent', $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
              offer.js_id, offer.engagement_type, counterRateNum.toFixed(2), counterCurrency,
              proposedStartDate ?? offer.proposed_start_date ?? null, offer.id,
              expectedRate, expectedCurrency, expectedEngagement, below, delta,
              offer.expires_at ?? null, notes ?? null,
            ],
          );
          respondedOffer = counter.rows[0];
        } else {
          // Side-effect: submission status + audit trail
          await txClient.query(
            `UPDATE job_submissions SET status = $1, updated_at = NOW() WHERE id = $2`,
            [newSubmissionStatus, offer.js_id],
          );
          await txClient.query(
            `INSERT INTO job_application_status_history
               (application_id, previous_status, new_status, note, changed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [offer.js_id, offer.submission_status, newSubmissionStatus,
             `Talent ${action === "accept" ? "accepted" : "declined"} the offer`,
             linkedUserId],
          );
        }
        await txClient.query("COMMIT");
      } catch (txErr: any) {
        await txClient.query("ROLLBACK").catch(() => {});
        throw txErr;
      } finally {
        txClient.release();
      }

      // Fire-and-forget: notify the client that the talent has responded to their offer.
      // offer.js_client_id is the client user's ID from job_submissions; no PII in message.
      const clientUserId = offer.js_client_id;
      if (clientUserId) {
        const actionLabel = action === "accept" ? "accepted" : action === "counter" ? "countered" : "declined";
        storage.createNotification({
          userId: clientUserId,
          type: action === "accept" ? "offer_accepted" : action === "counter" ? "offer_countered" : "offer_declined",
          title: `Offer ${actionLabel}`,
          message: `A talent has ${actionLabel} your offer. View the hiring pipeline for next steps.`,
          relatedId: String(offer.id),
          relatedType: "offer",
        }).catch((notifyErr: any) => {
          console.error("PATCH /api/talent/offers/:id/respond — failed to create client notification:", notifyErr);
        });

        // Fire-and-forget: send the client an email about the talent's response.
        (async () => {
          try {
            const clientUserRow = await query(
              `SELECT email, first_name FROM users WHERE id = $1 LIMIT 1`,
              [clientUserId],
            );
            const clientEmail: string | null = clientUserRow.rows[0]?.email ?? null;
            if (!clientEmail) return;

            const { sendApplicantEmail, isEmailServiceConfigured } =
              await import("./services/microsoftGraphEmailService.ts");
            if (!isEmailServiceConfigured()) {
              console.warn("PATCH /api/talent/offers/:id/respond — email service not configured; skipping client email");
              return;
            }

            const rawBase =
              process.env.PUBLIC_APP_URL ??
              process.env.APP_URL ??
              process.env.PUBLIC_BASE_URL ??
              (process.env.REPLIT_DOMAINS
                ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
                : null);
            if (!rawBase) {
              console.warn("PATCH /api/talent/offers/:id/respond — no base URL configured; skipping client email");
              return;
            }
            const baseUrl = rawBase.replace(/\/$/, "");
            const pipelineUrl = `${baseUrl}/hiring-pipeline`;

            const jobTitle: string = offer.job_title ?? "the role";
            const decisionVerb = action === "accept" ? "accepted" : action === "counter" ? "countered" : "declined";
            const subject = `Your offer has been ${decisionVerb}`;
            const bodyHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#1a1a2e;margin-bottom:8px;">Offer ${decisionVerb}</h2>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    A talent has <strong>${decisionVerb}</strong> your offer for <strong>${jobTitle}</strong>.
  </p>
  <p style="color:#444;font-size:15px;margin:12px 0;">
    Log in to your portal to view the updated status and take any next steps.
  </p>
  <p style="margin:24px 0;">
    <a href="${pipelineUrl}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:15px;display:inline-block;">
      View Hiring Pipeline
    </a>
  </p>
</div>`.trim();

            const result = await sendApplicantEmail({ to: clientEmail, subject, bodyHtml });
            if (result.success) {
              console.log(`✅ Offer-response email (${decisionVerb}) sent to client ${clientEmail} for offer ${offer.id}`);
            } else {
              console.warn(`PATCH /api/talent/offers/:id/respond — offer-response email failed for ${clientEmail}:`, result.error);
            }
          } catch (emailErr: any) {
            console.error("PATCH /api/talent/offers/:id/respond — unexpected error sending client email:", emailErr);
          }
        })();
      }

      return res.json(respondedOffer);
    } catch (err: any) {
      console.error("PATCH /api/talent/offers/:id/respond error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Phase 3: Contract Flow ───────────────────────────────────────────────────
  // ── Admin billing ledger operations (Phase 2) ────────────────────────────
  // These routes intentionally derive all client/talent identities from the
  // contract and submission. No ledger party is accepted from request bodies.
  app.get("/api/admin/billing-contracts", authenticateAdminFlexible, requireAdmin, async (_req: Request, res: Response) => {
    try {
      const result = await query(
        `SELECT hc.id AS hiring_contract_id, hc.status AS contract_status,
                hc.onspot_signed_at, o.engagement_type, o.rate AS talent_rate,
                o.rate_currency AS talent_rate_currency,
                COALESCE(NULLIF(TRIM(CONCAT(client.first_name, ' ', client.last_name)), ''), client.email) AS client_name,
                client.email AS client_email,
                COALESCE(NULLIF(TRIM(CONCAT(talent.first_name, ' ', talent.last_name)), ''), talent.email) AS talent_name,
                talent.email AS talent_email,
                j.title AS job_title,
                COUNT(ip.id)::int AS period_count,
                MAX(ip.period_end) AS last_period_end,
                sd.id AS deposit_id, sd.status AS deposit_status,
                sd.amount AS deposit_amount, sd.currency AS deposit_currency
           FROM hiring_contracts hc
           JOIN offers o ON o.id = hc.offer_id
           JOIN job_submissions js ON js.id = hc.submission_id
           LEFT JOIN jobs j ON j.id = js.job_id
           LEFT JOIN users client ON client.id = js.client_id
           LEFT JOIN users talent ON talent.id = js.talent_id
           LEFT JOIN invoice_periods ip ON ip.hiring_contract_id = hc.id
           LEFT JOIN security_deposits sd ON sd.hiring_contract_id = hc.id
          WHERE hc.status = 'signed'
          GROUP BY hc.id, o.id, client.id, talent.id, j.id, sd.id
          ORDER BY hc.onspot_signed_at DESC NULLS LAST, hc.created_at DESC`,
      );
      return res.json(result.rows);
    } catch (err: any) {
      console.error("GET billing contracts error:", err);
      return res.status(500).json({ error: "Unable to load signed contracts" });
    }
  });

  app.post("/api/admin/contracts/:hcId/billing-periods", authenticateAdminFlexible, requireAdmin, async (req: Request, res: Response) => {
    try {
      const periodStart = parseLedgerDate(req.body.periodStart ?? req.body.period_start, "periodStart");
      const periodEnd = parseLedgerDate(req.body.periodEnd ?? req.body.period_end, "periodEnd");
      if (periodEnd < periodStart) {
        return res.status(422).json({ error: "periodEnd must be on or after periodStart" });
      }

      const extendedHours = parseLedgerNumber(req.body.extendedHours ?? req.body.extended_hours ?? 0, "extendedHours", { min: 0 });
      const deductionHours = parseLedgerNumber(req.body.deductionHours ?? req.body.deduction_hours ?? 0, "deductionHours", { min: 0 });
      const commissionInput = req.body.commissionRate ?? req.body.commission_rate;
      const commissionRate = commissionInput === undefined
        ? undefined
        : parseLedgerNumber(commissionInput, "commissionRate", { min: 0 });
      if (commissionRate !== undefined && commissionRate > 1) {
        return res.status(422).json({ error: "commissionRate must be between 0 and 1" });
      }

      const contract = await query(
        `SELECT hc.id, hc.offer_id, hc.status AS contract_status,
                o.rate, o.rate_currency, o.engagement_type
           FROM hiring_contracts hc
           JOIN offers o ON o.id = hc.offer_id
          WHERE hc.id = $1`,
        [req.params.hcId],
      );
      if (contract.rows.length === 0) return res.status(404).json({ error: "Hiring contract not found" });
      const linked = contract.rows[0];
      if (linked.contract_status !== "signed") {
        return res.status(409).json({ error: "contract_not_active", message: "Billing periods can only be created for signed contracts." });
      }
      if (linked.engagement_type !== "Lite" && linked.engagement_type !== "Standard") {
        return res.status(422).json({ error: "invalid_engagement_type", message: "The linked offer does not have a supported engagement type." });
      }

      const talentRate = parseLedgerNumber(linked.rate, "offer rate", { min: 0 });
      const amounts = commissionRate === undefined
        ? computePeriodAmounts(talentRate, linked.engagement_type as EngagementType, extendedHours, deductionHours)
        : computePeriodAmounts(talentRate, linked.engagement_type as EngagementType, extendedHours, deductionHours, commissionRate);

      const inserted = await withLedgerTransaction(async (client) => {
        const duplicate = await client.query(
          `SELECT id FROM invoice_periods
            WHERE hiring_contract_id = $1 AND period_start = $2 AND period_end = $3
            LIMIT 1
            FOR UPDATE`,
          [linked.id, periodStart.toISOString().slice(0, 10), periodEnd.toISOString().slice(0, 10)],
        );
        if (duplicate.rows.length > 0) {
          const error = new Error("billing_period_exists");
          Object.assign(error, { status: 409, periodId: duplicate.rows[0].id });
          throw error;
        }

        return (await client.query(
          `INSERT INTO invoice_periods
             (hiring_contract_id, offer_id, period_start, period_end,
              talent_rate, talent_rate_currency, standard_period_hours,
              extended_hours, deduction_hours, hourly_equivalent,
              adjusted_talent_payout, commission_rate, client_invoice_amount,
              commission_earned, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft', $15)
           RETURNING *`,
          [
            linked.id, linked.offer_id, periodStart.toISOString().slice(0, 10),
            periodEnd.toISOString().slice(0, 10), talentRate.toFixed(2),
            linked.rate_currency || "PHP", amounts.standardPeriodHours,
            extendedHours.toFixed(2), deductionHours.toFixed(2),
            amounts.hourlyEquivalent.toFixed(4), amounts.adjustedTalentPayout.toFixed(2),
            amounts.commissionRate.toFixed(4), amounts.clientInvoiceAmount.toFixed(2),
            amounts.commissionEarned.toFixed(2), req.body.notes?.trim() || null,
          ],
        )).rows[0];
      });
      return res.status(201).json(inserted);
    } catch (err: any) {
      const status = err.status || (err.code === "23505" ? 409 : err.code === "22P02" ? 422 : 500);
      console.error("POST billing period error:", err);
      return res.status(status).json({
        error: err.code === "23505" ? "billing_period_exists" : status === 500 ? "Unable to create billing period" : err.message,
        ...(err.periodId ? { periodId: err.periodId } : {}),
      });
    }
  });

  app.post("/api/admin/billing-periods/:id/invoices", authenticateAdminFlexible, requireAdmin, async (req: Request, res: Response) => {
    try {
      const invoice = await withLedgerTransaction(async (client) => {
        const periodResult = await client.query(
          `SELECT ip.*, hc.submission_id, js.client_id
             FROM invoice_periods ip
             JOIN hiring_contracts hc ON hc.id = ip.hiring_contract_id
             JOIN job_submissions js ON js.id = hc.submission_id
            WHERE ip.id = $1
            FOR UPDATE`,
          [req.params.id],
        );
        if (periodResult.rows.length === 0) {
          const error = new Error("Billing period not found");
          Object.assign(error, { status: 404 });
          throw error;
        }
        const period = periodResult.rows[0];
        if (!period.client_id) {
          const error = new Error("The linked submission has no client account");
          Object.assign(error, { status: 422 });
          throw error;
        }
        if (!["draft", "ready"].includes(period.status)) {
          const error = new Error(`Only draft or ready periods can be invoiced (current status: ${period.status})`);
          Object.assign(error, { status: 409 });
          throw error;
        }
        const existing = await client.query(
          `SELECT id FROM invoices WHERE period_id = $1 AND status <> 'void' LIMIT 1`,
          [period.id],
        );
        if (existing.rows.length > 0) {
          const error = new Error("An invoice already exists for this billing period");
          Object.assign(error, { status: 409 });
          throw error;
        }

        const dueDate = req.body.dueDate ?? req.body.due_date;
        const dueAt = dueDate ? parseLedgerDate(dueDate, "dueDate") : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const numberResult = await client.query(
          `SELECT 'INV-' || to_char(CURRENT_DATE, 'YYYY') || '-' ||
                  lpad(nextval('invoice_number_seq')::text, 4, '0') AS invoice_number`,
        );
        const inserted = await client.query(
          `INSERT INTO invoices
             (period_id, hiring_contract_id, client_id, invoice_number, amount,
              currency, commission_rate, status, issued_at, due_date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', NOW(), $8, $9)
           RETURNING *`,
          [
            period.id, period.hiring_contract_id, period.client_id,
            numberResult.rows[0].invoice_number, period.client_invoice_amount,
            period.talent_rate_currency, period.commission_rate, dueAt,
            req.body.notes?.trim() || null,
          ],
        );
        await client.query(
          `UPDATE invoice_periods SET status = 'invoiced', updated_at = NOW() WHERE id = $1`,
          [period.id],
        );
        return inserted.rows[0];
      });
      return res.status(201).json(invoice);
    } catch (err: any) {
      console.error("POST invoice error:", err);
      return res.status(err.status || 500).json({ error: err.status ? err.message : "Unable to issue invoice" });
    }
  });

  app.patch("/api/admin/invoices/:id", authenticateAdminFlexible, requireAdmin, async (req: Request, res: Response) => {
    try {
      const action = String(req.body.action ?? req.body.status ?? "").toLowerCase();
      if (action !== "paid" && action !== "void") {
        return res.status(422).json({ error: "status must be paid or void" });
      }
      const updated = await withLedgerTransaction(async (client) => {
        const existing = await client.query(`SELECT * FROM invoices WHERE id = $1 FOR UPDATE`, [req.params.id]);
        if (existing.rows.length === 0) {
          const error = new Error("Invoice not found");
          Object.assign(error, { status: 404 });
          throw error;
        }
        const invoice = existing.rows[0];
        if (action === "paid") {
          if (!["sent", "overdue"].includes(invoice.status)) {
            const error = new Error(`Only sent or overdue invoices can be marked paid (current status: ${invoice.status})`);
            Object.assign(error, { status: 409 });
            throw error;
          }
          const paymentMethod = String(req.body.paymentMethod ?? req.body.payment_method ?? "");
          if (!["wire", "credit_card"].includes(paymentMethod)) {
            const error = new Error("paymentMethod must be wire or credit_card");
            Object.assign(error, { status: 422 });
            throw error;
          }
          if (!String(req.body.externalRef ?? req.body.external_ref ?? "").trim()) {
            const error = new Error("externalRef is required when marking an invoice paid");
            Object.assign(error, { status: 422 });
            throw error;
          }
          const result = await client.query(
            `UPDATE invoices
                SET status = 'paid', payment_method = $1, external_ref = $2,
                    paid_at = NOW(), updated_at = NOW()
              WHERE id = $3 RETURNING *`,
            [paymentMethod, String(req.body.externalRef ?? req.body.external_ref).trim(), invoice.id],
          );
          await refreshInvoicePeriodStatus(client, invoice.period_id);
          return result.rows[0];
        }
        if (["paid", "void"].includes(invoice.status)) {
          const error = new Error(`A ${invoice.status} invoice cannot be voided`);
          Object.assign(error, { status: 409 });
          throw error;
        }
        const result = await client.query(
          `UPDATE invoices SET status = 'void', voided_at = NOW(), updated_at = NOW()
            WHERE id = $1 RETURNING *`,
          [invoice.id],
        );
        await client.query(
          `UPDATE invoice_periods SET status = 'ready', updated_at = NOW() WHERE id = $1`,
          [invoice.period_id],
        );
        return result.rows[0];
      });
      return res.json(updated);
    } catch (err: any) {
      console.error("PATCH invoice error:", err);
      return res.status(err.status || 500).json({ error: err.status ? err.message : "Unable to update invoice" });
    }
  });

  app.post("/api/admin/billing-periods/:id/payouts", authenticateAdminFlexible, requireAdmin, async (req: Request, res: Response) => {
    try {
      const payout = await withLedgerTransaction(async (client) => {
        const periodResult = await client.query(
          `SELECT ip.*, hc.submission_id, js.talent_id
             FROM invoice_periods ip
             JOIN hiring_contracts hc ON hc.id = ip.hiring_contract_id
             JOIN job_submissions js ON js.id = hc.submission_id
            WHERE ip.id = $1
            FOR UPDATE`,
          [req.params.id],
        );
        if (periodResult.rows.length === 0) {
          const error = new Error("Billing period not found");
          Object.assign(error, { status: 404 });
          throw error;
        }
        const period = periodResult.rows[0];
        if (!period.talent_id) {
          const error = new Error("The linked submission has no talent account");
          Object.assign(error, { status: 422 });
          throw error;
        }
        const invoiceResult = await client.query(
          `SELECT status FROM invoices
            WHERE period_id = $1
            ORDER BY created_at DESC
            LIMIT 1`,
          [period.id],
        );
        if (invoiceResult.rows[0]?.status !== "paid") {
          const error = new Error("The client invoice must be paid before a talent payout can be scheduled");
          Object.assign(error, { status: 409 });
          throw error;
        }
        if (["closed"].includes(period.status)) {
          const error = new Error("A closed billing period cannot receive another payout");
          Object.assign(error, { status: 409 });
          throw error;
        }
        const existing = await client.query(`SELECT id FROM payouts WHERE period_id = $1 LIMIT 1`, [period.id]);
        if (existing.rows.length > 0) {
          const error = new Error("A payout already exists for this billing period");
          Object.assign(error, { status: 409 });
          throw error;
        }

        const region = String(req.body.payoutRegion ?? req.body.payout_region ?? "");
        const regionResult = region
          ? await client.query(`SELECT * FROM payout_region_configs WHERE region_code = $1`, [region])
          : await client.query(`SELECT * FROM payout_region_configs ORDER BY region_code LIMIT 1`);
        if (regionResult.rows.length === 0) {
          const error = new Error("No payout region is configured");
          Object.assign(error, { status: 422 });
          throw error;
        }
        const regionConfig = regionResult.rows[0];
        const payoutMethod = String(req.body.payoutMethod ?? req.body.payout_method ?? regionConfig.default_method);
        if (!regionConfig.available_methods.includes(payoutMethod)) {
          const error = new Error(`payoutMethod is not available in region ${regionConfig.region_code}`);
          Object.assign(error, { status: 422 });
          throw error;
        }
        const scheduledAtValue = req.body.scheduledAt ?? req.body.scheduled_at;
        const scheduledAt = scheduledAtValue ? parseLedgerDate(scheduledAtValue, "scheduledAt") : new Date();
        const inserted = await client.query(
          `INSERT INTO payouts
             (period_id, hiring_contract_id, talent_id, amount, currency,
              payout_region, payout_method, status, scheduled_at, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9)
           RETURNING *`,
          [
            period.id, period.hiring_contract_id, period.talent_id,
            period.adjusted_talent_payout, period.talent_rate_currency,
            regionConfig.region_code, payoutMethod, scheduledAt,
            req.body.notes?.trim() || null,
          ],
        );
        await client.query(
          `UPDATE invoice_periods SET status = 'payout_scheduled', updated_at = NOW() WHERE id = $1`,
          [period.id],
        );
        return inserted.rows[0];
      });
      return res.status(201).json(payout);
    } catch (err: any) {
      console.error("POST payout error:", err);
      return res.status(err.status || 500).json({ error: err.status ? err.message : "Unable to create payout" });
    }
  });

  app.patch("/api/admin/payouts/:id", authenticateAdminFlexible, requireAdmin, async (req: Request, res: Response) => {
    try {
      const action = String(req.body.action ?? req.body.status ?? "").toLowerCase();
      if (action !== "disbursed" && action !== "failed") {
        return res.status(422).json({ error: "status must be disbursed or failed" });
      }
      const updated = await withLedgerTransaction(async (client) => {
        const existing = await client.query(`SELECT * FROM payouts WHERE id = $1 FOR UPDATE`, [req.params.id]);
        if (existing.rows.length === 0) {
          const error = new Error("Payout not found");
          Object.assign(error, { status: 404 });
          throw error;
        }
        const payout = existing.rows[0];
        if (!["pending", "scheduled"].includes(payout.status)) {
          const error = new Error(`Only pending or scheduled payouts can be updated (current status: ${payout.status})`);
          Object.assign(error, { status: 409 });
          throw error;
        }
        let result;
        if (action === "disbursed") {
          const invoiceResult = await client.query(
            `SELECT status FROM invoices
              WHERE period_id = $1
              ORDER BY created_at DESC
              LIMIT 1`,
            [payout.period_id],
          );
          if (invoiceResult.rows[0]?.status !== "paid") {
            const error = new Error("The client invoice must be paid before a talent payout can be disbursed");
            Object.assign(error, { status: 409 });
            throw error;
          }
          const externalRef = String(req.body.externalRef ?? req.body.external_ref ?? "").trim();
          if (!externalRef) {
            const error = new Error("externalRef is required when marking a payout disbursed");
            Object.assign(error, { status: 422 });
            throw error;
          }
          result = await client.query(
            `UPDATE payouts SET status = 'disbursed', external_ref = $1,
                    disbursed_at = NOW(), updated_at = NOW()
              WHERE id = $2 RETURNING *`,
            [externalRef, payout.id],
          );
        } else {
          const reason = String(req.body.failedReason ?? req.body.failed_reason ?? "").trim();
          if (!reason) {
            const error = new Error("failedReason is required when marking a payout failed");
            Object.assign(error, { status: 422 });
            throw error;
          }
          result = await client.query(
            `UPDATE payouts SET status = 'failed', failed_reason = $1, updated_at = NOW()
              WHERE id = $2 RETURNING *`,
            [reason, payout.id],
          );
        }
        await refreshInvoicePeriodStatus(client, payout.period_id);
        return result.rows[0];
      });
      return res.json(updated);
    } catch (err: any) {
      console.error("PATCH payout error:", err);
      return res.status(err.status || 500).json({ error: err.status ? err.message : "Unable to update payout" });
    }
  });

  app.post("/api/admin/contracts/:hcId/security-deposit", authenticateAdminFlexible, requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await withLedgerTransaction(async (client) => {
        const contract = await client.query(
          `SELECT hc.id, hc.status, o.rate, o.rate_currency
             FROM hiring_contracts hc JOIN offers o ON o.id = hc.offer_id
            WHERE hc.id = $1 FOR UPDATE`,
          [req.params.hcId],
        );
        if (contract.rows.length === 0) {
          const error = new Error("Hiring contract not found");
          Object.assign(error, { status: 404 });
          throw error;
        }
        const linked = contract.rows[0];
        if (linked.status !== "signed") {
          const error = new Error("A security deposit can only be collected for an active signed contract");
          Object.assign(error, { status: 409 });
          throw error;
        }
        const amount = computeDepositAmount(parseLedgerNumber(linked.rate, "offer rate", { min: 0 })).toFixed(2);
        const existing = await client.query(`SELECT * FROM security_deposits WHERE hiring_contract_id = $1 FOR UPDATE`, [linked.id]);
        if (existing.rows.length === 0) {
          const inserted = await client.query(
            `INSERT INTO security_deposits
               (hiring_contract_id, amount, currency, status, held_at)
             VALUES ($1, $2, $3, 'held', NOW()) RETURNING *`,
            [linked.id, amount, linked.rate_currency || "PHP"],
          );
          return inserted.rows[0];
        }
        if (existing.rows[0].status === "pending") {
          const updated = await client.query(
            `UPDATE security_deposits SET status = 'held', held_at = NOW(), updated_at = NOW()
              WHERE id = $1 RETURNING *`,
            [existing.rows[0].id],
          );
          return updated.rows[0];
        }
        if (existing.rows[0].status !== "held") {
          const error = new Error(`Deposit cannot be collected from its current status: ${existing.rows[0].status}`);
          Object.assign(error, { status: 409 });
          throw error;
        }
        return existing.rows[0];
      });
      return res.status(201).json(result);
    } catch (err: any) {
      console.error("POST security deposit error:", err);
      return res.status(err.status || 500).json({ error: err.status ? err.message : "Unable to record security deposit" });
    }
  });

  app.patch("/api/admin/security-deposits/:id", authenticateAdminFlexible, requireAdmin, async (req: Request, res: Response) => {
    try {
      const requested = String(req.body.action ?? req.body.status ?? "").toLowerCase();
      const target = requested === "draw"
        ? "drawn"
        : requested === "suspend"
          ? "suspended"
          : requested === "cure"
            ? "held"
            : requested;
      const allowedTargets = ["held", "drawn", "replenishment_pending", "suspended", "applied", "forfeited"];
      if (!allowedTargets.includes(target)) {
        return res.status(422).json({ error: "status must be cure, draw, replenishment_pending, suspend, apply, or forfeit" });
      }

      const result = await withLedgerTransaction(async (client) => {
        const existing = await client.query(`SELECT * FROM security_deposits WHERE id = $1 FOR UPDATE`, [req.params.id]);
        if (existing.rows.length === 0) {
          const error = new Error("Security deposit not found");
          Object.assign(error, { status: 404 });
          throw error;
        }
        const deposit = existing.rows[0];
        const transitions: Record<string, string[]> = {
          pending: ["held"],
          held: ["drawn", "applied"],
          drawn: ["replenishment_pending"],
          replenishment_pending: ["suspended"],
          suspended: ["held", "forfeited"],
        };
        if (!(transitions[deposit.status] || []).includes(target)) {
          const error = new Error(`Cannot advance a ${deposit.status} deposit to ${target}`);
          Object.assign(error, { status: 409 });
          throw error;
        }
        const sets: string[] = ["status = $1", "updated_at = NOW()"];
        const params: any[] = [target];
        let p = 2;
        if (target === "held") {
          sets.push(`held_at = NOW()`, `cure_deadline_at = NULL`);
        } else if (target === "drawn") {
          sets.push(`drawn_at = NOW()`, `drawn_reason = $${p++}`, `replenishment_due_at = $${p++}`);
          params.push(String(req.body.drawnReason ?? req.body.drawn_reason ?? "client payment shortfall").trim());
          params.push(computeReplenishmentDeadline(new Date()));
        } else if (target === "suspended") {
          const setting = await client.query(
            `SELECT value FROM platform_settings WHERE key = 'deposit_cure_period_days' LIMIT 1`,
          );
          const cureDays = Number(setting.rows[0]?.value ?? 5);
          sets.push(`suspended_at = NOW()`, `cure_deadline_at = $${p++}`);
          params.push(computeCureDeadline(new Date(), Number.isFinite(cureDays) ? cureDays : 5));
        } else if (target === "applied") {
          const terminalReason = String(req.body.terminalReason ?? req.body.terminal_reason ?? "").trim();
          if (!["normal_termination", "mutual_end"].includes(terminalReason)) {
            const error = new Error("terminalReason must be normal_termination or mutual_end when applying a deposit");
            Object.assign(error, { status: 422 });
            throw error;
          }
          sets.push(`applied_at = NOW()`, `terminal_reason = $${p++}`);
          params.push(terminalReason);
          if (req.body.appliedToInvoiceId ?? req.body.applied_to_invoice_id) {
            const appliedInvoiceId = req.body.appliedToInvoiceId ?? req.body.applied_to_invoice_id;
            const invoice = await client.query(
              `SELECT id FROM invoices
                WHERE id = $1 AND hiring_contract_id = $2
                LIMIT 1`,
              [appliedInvoiceId, deposit.hiring_contract_id],
            );
            if (invoice.rows.length === 0) {
              const error = new Error("appliedToInvoiceId must belong to the deposit's hiring contract");
              Object.assign(error, { status: 422 });
              throw error;
            }
            sets.push(`applied_to_invoice_id = $${p++}`);
            params.push(appliedInvoiceId);
          }
        } else if (target === "forfeited") {
          const terminalReason = String(req.body.terminalReason ?? req.body.terminal_reason ?? "").trim();
          if (terminalReason !== "nonpayment_breach") {
            return Promise.reject(Object.assign(new Error("Forfeiture requires terminalReason = nonpayment_breach"), { status: 422 }));
          }
          sets.push(`forfeited_at = NOW()`, `terminal_reason = $${p++}`);
          params.push(terminalReason);
        }
        const updated = await client.query(
          `UPDATE security_deposits SET ${sets.join(", ")} WHERE id = $${p} RETURNING *`,
          [...params, deposit.id],
        );
        return updated.rows[0];
      });
      return res.json(result);
    } catch (err: any) {
      console.error("PATCH security deposit error:", err);
      return res.status(err.status || 500).json({ error: err.status ? err.message : "Unable to update security deposit" });
    }
  });

  app.get("/api/admin/ledger", authenticateAdminFlexible, requireAdmin, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? req.query.pageSize) || 25));
      const offset = (page - 1) * limit;
      const status = typeof req.query.status === "string" && req.query.status !== "all" ? req.query.status : null;
      const filter = status ? "WHERE ip.status = $1" : "";
      const filterParams = status ? [status] : [];
      const count = await query(`SELECT COUNT(*)::int AS total FROM invoice_periods ip ${filter}`, filterParams);
      const summary = await query(
        `SELECT
           COALESCE(SUM(ip.client_invoice_amount), 0)::numeric AS gtv,
           COALESCE(SUM(CASE
             WHEN inv.status IS NULL OR inv.status IN ('draft','sent','overdue')
             THEN COALESCE(inv.amount, ip.client_invoice_amount) ELSE 0 END), 0)::numeric AS outstanding_invoices,
           COALESCE(SUM(CASE WHEN p.status IN ('pending','scheduled') THEN p.amount ELSE 0 END), 0)::numeric AS pending_payouts,
           COUNT(DISTINCT sd.id) FILTER (WHERE sd.status IN ('drawn','suspended'))::int AS deposits_at_risk
         FROM invoice_periods ip
         LEFT JOIN LATERAL (SELECT status, amount FROM invoices WHERE period_id = ip.id ORDER BY created_at DESC LIMIT 1) inv ON true
         LEFT JOIN LATERAL (SELECT status, amount FROM payouts WHERE period_id = ip.id ORDER BY created_at DESC LIMIT 1) p ON true
         LEFT JOIN security_deposits sd ON sd.hiring_contract_id = ip.hiring_contract_id
         ${filter}`,
        filterParams,
      );
      const rows = await query(
        `SELECT ip.id, ip.hiring_contract_id, ip.period_start, ip.period_end, ip.status,
                ip.talent_rate, ip.talent_rate_currency, ip.adjusted_talent_payout,
                ip.commission_rate, ip.client_invoice_amount, ip.commission_earned,
                hc.submission_id,
                COALESCE(NULLIF(TRIM(CONCAT(client.first_name, ' ', client.last_name)), ''), client.email) AS client_name,
                client.email AS client_email,
                COALESCE(NULLIF(TRIM(CONCAT(talent.first_name, ' ', talent.last_name)), ''), talent.email) AS talent_name,
                talent.email AS talent_email,
                inv.id AS invoice_id, inv.invoice_number, inv.status AS invoice_status,
                inv.amount AS invoice_amount, inv.currency AS invoice_currency,
                inv.due_date, inv.paid_at,
                p.id AS payout_id, p.status AS payout_status, p.amount AS payout_amount,
                p.currency AS payout_currency, p.payout_method, p.external_ref AS payout_external_ref,
                p.scheduled_at, p.disbursed_at, p.failed_reason,
                sd.id AS deposit_id, sd.status AS deposit_status, sd.amount AS deposit_amount,
                sd.currency AS deposit_currency, sd.replenishment_due_at, sd.cure_deadline_at,
                CASE
                  WHEN inv.status IS NULL OR inv.status IN ('draft','sent','overdue')
                    THEN COALESCE(inv.amount, ip.client_invoice_amount)
                  ELSE 0
                END AS outstanding_invoice_amount,
                CASE WHEN p.status IN ('pending','scheduled') THEN p.amount ELSE 0 END AS outstanding_payout_amount
           FROM invoice_periods ip
           JOIN hiring_contracts hc ON hc.id = ip.hiring_contract_id
           JOIN job_submissions js ON js.id = hc.submission_id
           LEFT JOIN users client ON client.id = js.client_id
           LEFT JOIN users talent ON talent.id = js.talent_id
           LEFT JOIN LATERAL (SELECT * FROM invoices WHERE period_id = ip.id ORDER BY created_at DESC LIMIT 1) inv ON true
           LEFT JOIN LATERAL (SELECT * FROM payouts WHERE period_id = ip.id ORDER BY created_at DESC LIMIT 1) p ON true
           LEFT JOIN security_deposits sd ON sd.hiring_contract_id = ip.hiring_contract_id
           ${filter}
          ORDER BY ip.period_start DESC, ip.created_at DESC
          LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
        [...filterParams, limit, offset],
      );
      const total = count.rows[0]?.total ?? 0;
      return res.json({
        page, limit, total, pages: Math.max(1, Math.ceil(total / limit)),
        summary: summary.rows[0] ?? { gtv: "0", outstanding_invoices: "0", pending_payouts: "0", deposits_at_risk: 0 },
        items: rows.rows,
      });
    } catch (err: any) {
      console.error("GET admin ledger error:", err);
      return res.status(500).json({ error: "Unable to load billing ledger" });
    }
  });

  // ── Phase 3: client invoice view + talent payout history ──────────────────

  /**
   * GET /api/client/invoices
   * Returns paginated invoices for the authenticated client, newest first.
   * Includes period dates, engagement type, and talent name for each row.
   */
  app.get("/api/client/invoices", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id || user.role !== "client") {
        return res.status(403).json({ error: "Client access required" });
      }
      const clientId: string = user.id;
      const page  = Math.max(1, Number(req.query.page)  || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const countResult = await query(
        `SELECT COUNT(*)::int AS total FROM invoices WHERE client_id = $1`,
        [clientId],
      );
      const rows = await query(
        `SELECT
           inv.id, inv.invoice_number, inv.amount, inv.currency, inv.status,
           inv.payment_method, inv.issued_at, inv.due_date, inv.paid_at,
           inv.commission_rate, inv.external_ref,
           ip.period_start, ip.period_end, ip.standard_period_hours,
           ip.extended_hours, ip.adjusted_talent_payout,
           ip.talent_rate, ip.talent_rate_currency, ip.client_invoice_amount,
           o.engagement_type,
           COALESCE(NULLIF(TRIM(CONCAT(talent.first_name,' ',talent.last_name)),''), talent.email) AS talent_name
         FROM invoices inv
         JOIN invoice_periods   ip  ON ip.id  = inv.period_id
         JOIN hiring_contracts  hc  ON hc.id  = inv.hiring_contract_id
         JOIN job_submissions   js  ON js.id  = hc.submission_id
         JOIN offers            o   ON o.id   = hc.offer_id
         LEFT JOIN users talent ON talent.id = js.talent_id
         WHERE inv.client_id = $1
         ORDER BY inv.issued_at DESC NULLS LAST, inv.created_at DESC
         LIMIT $2 OFFSET $3`,
        [clientId, limit, offset],
      );
      const total = countResult.rows[0]?.total ?? 0;
      return res.json({
        page, limit, total,
        pages: Math.max(1, Math.ceil(total / limit)),
        items: rows.rows,
      });
    } catch (err: any) {
      console.error("GET /api/client/invoices error:", err);
      return res.status(500).json({ error: "Unable to load invoices" });
    }
  });

  /**
   * GET /api/talent/payouts
   * Returns paginated payouts for the authenticated talent user, newest first.
   * Includes period dates, engagement type, and client name for context.
   * Auth: standard JWT (talent users authenticated via main auth system).
   */
  app.get("/api/talent/payouts", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const talentId: string = user.id;
      const page  = Math.max(1, Number(req.query.page)  || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const countResult = await query(
        `SELECT COUNT(*)::int AS total FROM payouts WHERE talent_id = $1`,
        [talentId],
      );
      const rows = await query(
        `SELECT
           p.id, p.amount, p.currency, p.status, p.payout_region,
           p.payout_method, p.external_ref, p.failed_reason,
           p.scheduled_at, p.disbursed_at, p.created_at,
           ip.period_start, ip.period_end, ip.standard_period_hours,
           ip.extended_hours, ip.talent_rate, ip.talent_rate_currency,
           ip.client_invoice_amount,
           o.engagement_type,
           COALESCE(NULLIF(TRIM(CONCAT(client.first_name,' ',client.last_name)),''), client.email) AS client_name
         FROM payouts p
         JOIN invoice_periods   ip  ON ip.id  = p.period_id
         JOIN hiring_contracts  hc  ON hc.id  = p.hiring_contract_id
         JOIN job_submissions   js  ON js.id  = hc.submission_id
         JOIN offers            o   ON o.id   = hc.offer_id
         LEFT JOIN users client ON client.id = js.client_id
         WHERE p.talent_id = $1
         ORDER BY ip.period_start DESC, p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [talentId, limit, offset],
      );
      const total = countResult.rows[0]?.total ?? 0;
      return res.json({
        page, limit, total,
        pages: Math.max(1, Math.ceil(total / limit)),
        items: rows.rows,
      });
    } catch (err: any) {
      console.error("GET /api/talent/payouts error:", err);
      return res.status(500).json({ error: "Unable to load payout history" });
    }
  });

  //
  // Admin/OnSpot-driven: admin creates the contract from an accepted offer, records
  // signatures, and voids if needed. Talent-signed_at is informational; OnSpot
  // countersign is the execution trigger that advances the submission to 'hired'.
  //
  // Auth: all /api/admin/hiring-contracts routes require authenticateJWT + role=admin.
  //       BYPASS_ADMIN_AUTH does NOT apply here (consistent with PATCH /api/admin/job-applications/:id).

  // POST /api/admin/hiring-contracts — create & send a contract from an accepted offer
  app.post("/api/admin/hiring-contracts", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { offerId, templateRef, documentPath, notes } = req.body;
      if (!offerId) return res.status(400).json({ error: "offerId is required" });

      const contract = await createHiringContract({
        offerId,
        templateRef: templateRef ?? null,
        documentPath: documentPath ?? null,
        adminId: user.id,
      });
      return res.status(201).json(contract);
    } catch (err: any) {
      if (err instanceof ContractError) {
        return res.status(err.status).json(err.body);
      }
      console.error("POST /api/admin/hiring-contracts error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/hiring-contracts?submissionId= — list contracts for a submission (admin)
  app.get("/api/admin/hiring-contracts", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { submissionId } = req.query as { submissionId?: string };
      if (!submissionId) return res.status(400).json({ error: "submissionId query param is required" });

      const result = await query(
        `SELECT hc.*, o.rate, o.rate_currency, o.engagement_type
         FROM hiring_contracts hc
         JOIN offers o ON o.id = hc.offer_id
         JOIN job_submissions js ON js.id = hc.submission_id
         WHERE hc.submission_id = $1
           AND js.${FORMAL_PIPELINE_PREDICATE}
         ORDER BY hc.created_at DESC`,
        [submissionId],
      );
      return res.json(result.rows);
    } catch (err: any) {
      console.error("GET /api/admin/hiring-contracts error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/admin/hiring-contracts/:id — update a contract and/or record signatures.
  // Keep this service-backed path for the admin workflow.
  app.patch("/api/admin/hiring-contracts/:id", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const result = await updateHiringContract(req.params.id, {
        ...req.body,
        actorRole: "admin",
        adminId: user.id,
      });
      return res.json(result);
    } catch (err: any) {
      if (err instanceof ContractError) {
        return res.status(err.status).json(err.body);
      }
      console.error("PATCH /api/admin/hiring-contracts/:id error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/admin/hiring-contracts/:id/sign — record the OnSpot signature.
  // Body: { signerType: 'onspot', signedAt?: ISO date string }
  // The contract is executed only when both signature timestamps are present.
  app.patch("/api/admin/hiring-contracts/:id/sign", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { id } = req.params;
      const { signerType, signedAt } = req.body;

      if (signerType !== "onspot") {
        return res.status(403).json({
          error: "talent_signature_forbidden",
          message: "Only the authenticated talent can record the talent signature.",
        });
      }

      const signTs = signedAt ? new Date(signedAt) : new Date();
      if (isNaN(signTs.getTime())) {
        return res.status(400).json({ error: "signedAt must be a valid ISO date string" });
      }

      const result = await updateHiringContract(id, {
        onspotSigned: signerType === "onspot",
        talentSigned: signerType === "talent",
        onspotSignedAt: signerType === "onspot" ? signTs : undefined,
        talentSignedAt: signerType === "talent" ? signTs : undefined,
        actorRole: "admin",
        adminId: user.id,
      });
      return res.json(result);
    } catch (err: any) {
      if (err instanceof ContractError) {
        return res.status(err.status).json(err.body);
      }
      console.error("PATCH /api/admin/hiring-contracts/:id/sign error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/admin/hiring-contracts/:id/void — admin voids a contract
  // Body: { reason: string }
  // Submission status is NOT automatically reverted — admin must adjust manually.
  app.patch("/api/admin/hiring-contracts/:id/void", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason?.trim()) {
        return res.status(400).json({ error: "reason is required to void a contract" });
      }

      const result = await voidHiringContract(id, reason.trim(), user.id);
      return res.json(result);
    } catch (err: any) {
      if (err instanceof ContractError) {
        return res.status(err.status).json(err.body);
      }
      console.error("PATCH /api/admin/hiring-contracts/:id/void error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/talent/hiring-contracts?submissionId= — talent view of their own contract
  // Returns non-sensitive fields only (no admin notes or signing entity internals).
  app.get("/api/talent/hiring-contracts", authenticateTalentJWT, async (req: Request, res: Response) => {
    try {
      const candidateId = (req as any).talentAuth?.candidateId;
      const talentUserResult = await query(
        `SELECT COALESCE(c.user_id, u.id) AS user_id
           FROM candidates c
           LEFT JOIN users u ON lower(u.email) = lower(c.email)
          WHERE c.id = $1
          LIMIT 1`,
        [candidateId],
      );
      const userId = talentUserResult.rows[0]?.user_id;
      if (!userId) return res.status(404).json({ error: "Talent profile not found" });
      const { submissionId } = req.query as { submissionId?: string };
      if (!submissionId) return res.status(400).json({ error: "submissionId query param is required" });

      // Ownership: submission.talent_id must match the authenticated user
      const ownerCheck = await query(
        `SELECT id FROM job_submissions WHERE id = $1 AND talent_id = $2`,
        [submissionId, userId],
      );
      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ error: "Submission not found or forbidden" });
      }

      const result = await query(
        `SELECT hc.id, hc.submission_id, hc.status,
                hc.document_path, hc.document_version,
                hc.talent_signed_at, hc.onspot_signed_at,
                hc.signing_entity, hc.created_at,
                o.engagement_type, o.rate, o.rate_currency, o.proposed_start_date
         FROM hiring_contracts hc
         JOIN offers o ON o.id = hc.offer_id
         WHERE hc.submission_id = $1 AND hc.status NOT IN ('void', 'voided')
         ORDER BY hc.created_at DESC`,
        [submissionId],
      );
      return res.json(result.rows);
    } catch (err: any) {
      console.error("GET /api/talent/hiring-contracts error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/talent/hiring-contracts/:id/sign — talent records their signature.
  // OnSpot's signature remains admin-only; the shared service executes the
  // contract only after both signatures are present.
  app.patch("/api/talent/hiring-contracts/:id/sign", pipelineMutationLimiter, authenticateTalentJWT, async (req: Request, res: Response) => {
    try {
      const candidateId = (req as any).talentAuth?.candidateId;
      const talentUserResult = await query(
        `SELECT COALESCE(c.user_id, u.id) AS user_id
           FROM candidates c
           LEFT JOIN users u ON lower(u.email) = lower(c.email)
          WHERE c.id = $1
          LIMIT 1`,
        [candidateId],
      );
      const userId = talentUserResult.rows[0]?.user_id;
      if (!userId) return res.status(404).json({ error: "Talent profile not found" });

      const owned = await query(
        `SELECT hc.id
           FROM hiring_contracts hc
           JOIN job_submissions js ON js.id = hc.submission_id
          WHERE hc.id = $1 AND js.talent_id = $2`,
        [req.params.id, userId],
      );
      if (!owned.rows.length) return res.status(404).json({ error: "Contract not found" });

      const result = await updateHiringContract(req.params.id, {
        talentSigned: true,
        talentSignedAt: new Date(),
        actorRole: "talent",
        adminId: userId,
      });
      return res.json(result);
    } catch (err: any) {
      if (err instanceof ContractError) {
        return res.status(err.status).json(err.body);
      }
      console.error("PATCH /api/talent/hiring-contracts/:id/sign error:", err);
      return res.status(500).json({ error: "Unable to sign contract" });
    }
  });

  // GET /api/job-resumes/:resumeId — serve job submission resume (client auth required)
  app.get("/api/job-resumes/:resumeId", authenticateJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const { resumeId } = req.params;
      const check = await query(
        `SELECT js.resume_file_name FROM job_submissions js
         WHERE js.resume_url = $1 AND js.client_id = $2`,
        [`/objects/job-resumes/${resumeId}`, userId],
      );
      if (check.rows.length === 0) return res.status(403).json({ error: "Forbidden" });
      const objectStorageService = new ObjectStorageService();
      const canonicalPath = `/objects/job-resumes/${resumeId}`;
      const objectFile = await objectStorageService.getObjectEntityFile(canonicalPath);
      const fileName = check.rows[0].resume_file_name || "resume.pdf";
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      await objectStorageService.downloadObject(objectFile, res, 3600);
    } catch (err: any) {
      console.error("GET /api/job-resumes error:", err);
      res.status(500).send("Error serving resume");
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DEV ONLY: Temporary password reset endpoint for testing accounts.
  // Enabled when NODE_ENV !== "production" OR ENABLE_DEV_PASSWORD_RESET=true.
  //
  // SECURITY NOTE — replace before going to production with:
  //   - One-time reset token (UUID stored in DB with expiry)
  //   - Email delivery / verification
  //   - Token expiration (15–60 min)
  //   - Rate limiting per email address
  //   - No user enumeration (return 200 regardless of email existence)
  // ─────────────────────────────────────────────────────────────────────────
  app.post("/api/dev/reset-password", authResetLimiter, async (req: Request, res: Response) => {
    const isEnabled =
      process.env.NODE_ENV !== "production" ||
      process.env.ENABLE_DEV_PASSWORD_RESET === "true";

    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        message: "Password reset is disabled in this environment.",
      });
    }

    try {
      const { email: rawResetEmail, newPassword } = req.body;

      if (!rawResetEmail || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Email and newPassword are required.",
        });
      }

      // Normalize email identically to signup and login
      const email = rawResetEmail.trim().toLowerCase();

      if (!validateEmail(email)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address.",
        });
      }

      const strengthCheck = validatePasswordStrength(newPassword);
      if (!strengthCheck.isValid) {
        return res.status(400).json({
          success: false,
          message: `Password requirements not met: ${strengthCheck.errors.join(", ")}`,
        });
      }

      const userResult = await query(
        "SELECT id, email FROM users WHERE email = $1",
        [email]
      );

      // Also check candidates table for talent portal
      const candidateForReset = await storage.getCandidateByEmail(email);

      if (userResult.rows.length === 0 && !candidateForReset) {
        return res.status(404).json({
          success: false,
          message: "No account found with that email address.",
        });
      }

      const newHash = await hashPassword(newPassword);

      // Update users table if matched
      if (userResult.rows.length > 0) {
        await query(
          'UPDATE users SET "password_hash" = $1, "updated_at" = NOW() WHERE email = $2',
          [newHash, email]
        );
      }

      // Update candidates table if matched (talent portal)
      if (candidateForReset) {
        await storage.updateCandidate(candidateForReset.id, { passwordHash: newHash } as any);
      }

      console.log(`🔑 [DEV] Password reset for: ***@${email.split("@")[1]}`);

      return res.json({
        success: true,
        message:
          "Password reset successfully. You can now sign in with your new password.",
      });
    } catch (error) {
      console.error("[DEV] Reset password error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while resetting the password.",
      });
    }
  });

  // ── Email Templates — CRUD + publish/archive/duplicate ──────────────────────

  // GET /api/admin/email-templates — list all (non-archived by default)
  app.get("/api/admin/email-templates", authenticateJWT, requireAnyRole, async (req: any, res: Response) => {
    try {
      const isClient = req.user?.role === "client";
      const includeArchived = !isClient && req.query.archived === "true";
      const result = await query(
        `SELECT id, name, subject, category, stage, is_published AS "isPublished",
                is_default AS "isDefault", is_archived AS "isArchived",
                variables, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM applicant_email_templates
         ${isClient ? "WHERE is_archived = false AND is_published = true" : includeArchived ? "" : "WHERE is_archived = false"}
         ORDER BY is_default DESC, category, name`,
        [],
      );
      return res.json(result.rows);
    } catch (err: any) {
      console.error("GET /api/admin/email-templates error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/admin/email-templates/:id — get single template
  app.get("/api/admin/email-templates/:id", authenticateJWT, requireAnyRole, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT id, name, subject, body_html AS "bodyHtml", category, stage,
                is_published AS "isPublished", is_default AS "isDefault",
                is_archived AS "isArchived", variables,
                created_at AS "createdAt", updated_at AS "updatedAt"
          FROM applicant_email_templates
          WHERE id = $1
            AND ($2 <> 'client' OR (is_archived = false AND is_published = true))`,
        [id, req.user?.role ?? ""],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Template not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("GET /api/admin/email-templates/:id error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/admin/email-templates — create template
  app.post("/api/admin/email-templates", authenticateAdminFlexible, requireAdmin, async (req: any, res: Response) => {
    try {
      const { name, subject, bodyHtml, category, stage, isPublished, isDefault, variables } = req.body;
      if (!name?.trim() || !subject?.trim() || !bodyHtml?.trim() || !category?.trim()) {
        return res.status(400).json({ error: "name, subject, bodyHtml, and category are required" });
      }
      const result = await query(
        `INSERT INTO applicant_email_templates
           (name, subject, body_html, category, stage, is_published, is_default, variables)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, subject, category, stage, is_published AS "isPublished",
                   is_default AS "isDefault", is_archived AS "isArchived",
                   created_at AS "createdAt"`,
        [
          name.trim(), subject.trim(), bodyHtml, category.trim(),
          stage ?? null, !!isPublished, !!isDefault,
          JSON.stringify(variables ?? []),
        ],
      );
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error("POST /api/admin/email-templates error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/admin/email-templates/:id — update template
  app.patch("/api/admin/email-templates/:id", authenticateAdminFlexible, requireAdmin, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const existing = await query(
        `SELECT id FROM applicant_email_templates WHERE id = $1`, [id],
      );
      if (existing.rows.length === 0) return res.status(404).json({ error: "Template not found" });

      const { name, subject, bodyHtml, category, stage, isPublished, isDefault, variables } = req.body;
      const result = await query(
        `UPDATE applicant_email_templates SET
           name = COALESCE($1, name),
           subject = COALESCE($2, subject),
           body_html = COALESCE($3, body_html),
           category = COALESCE($4, category),
           stage = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE stage END,
           is_published = COALESCE($6, is_published),
           is_default = COALESCE($7, is_default),
           variables = COALESCE($8, variables),
           updated_at = NOW()
         WHERE id = $9
         RETURNING id, name, subject, category, stage,
                   is_published AS "isPublished", is_default AS "isDefault",
                   is_archived AS "isArchived", updated_at AS "updatedAt"`,
        [
          name?.trim() ?? null,
          subject?.trim() ?? null,
          bodyHtml ?? null,
          category?.trim() ?? null,
          stage !== undefined ? (stage ?? null) : null,
          isPublished !== undefined ? !!isPublished : null,
          isDefault !== undefined ? !!isDefault : null,
          variables !== undefined ? JSON.stringify(variables) : null,
          id,
        ],
      );
      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("PATCH /api/admin/email-templates/:id error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/admin/email-templates/:id — delete template
  app.delete("/api/admin/email-templates/:id", authenticateAdminFlexible, requireAdmin, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const existing = await query(
        `SELECT id FROM applicant_email_templates WHERE id = $1`, [id],
      );
      if (existing.rows.length === 0) return res.status(404).json({ error: "Template not found" });
      await query(`DELETE FROM applicant_email_templates WHERE id = $1`, [id]);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/admin/email-templates/:id error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/admin/email-templates/:id/publish — toggle published status
  app.post("/api/admin/email-templates/:id/publish", authenticateAdminFlexible, requireAdmin, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const result = await query(
        `UPDATE applicant_email_templates
         SET is_published = NOT is_published, updated_at = NOW()
         WHERE id = $1
         RETURNING id, is_published AS "isPublished"`,
        [id],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Template not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("POST /api/admin/email-templates/:id/publish error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/admin/email-templates/:id/archive — toggle archived status
  app.post("/api/admin/email-templates/:id/archive", authenticateAdminFlexible, requireAdmin, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const result = await query(
        `UPDATE applicant_email_templates
         SET is_archived = NOT is_archived, is_published = false, updated_at = NOW()
         WHERE id = $1
         RETURNING id, is_archived AS "isArchived", is_published AS "isPublished"`,
        [id],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Template not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("POST /api/admin/email-templates/:id/archive error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/admin/email-templates/:id/duplicate — copy template with new name
  app.post("/api/admin/email-templates/:id/duplicate", authenticateAdminFlexible, requireAdmin, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const src = await query(
        `SELECT * FROM applicant_email_templates WHERE id = $1`, [id],
      );
      if (src.rows.length === 0) return res.status(404).json({ error: "Template not found" });
      const t = src.rows[0];
      const result = await query(
        `INSERT INTO applicant_email_templates
           (name, subject, body_html, category, stage, is_published, is_default, variables)
         VALUES ($1, $2, $3, $4, $5, false, false, $6)
         RETURNING id, name, subject, category, stage,
                   is_published AS "isPublished", is_default AS "isDefault",
                   created_at AS "createdAt"`,
        [
          `${t.name} (Copy)`, t.subject, t.body_html,
          t.category, t.stage, t.variables ?? "[]",
        ],
      );
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error("POST /api/admin/email-templates/:id/duplicate error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/admin/email-templates/variables — list supported template variables
  app.get("/api/admin/email-template-variables", authenticateAdminFlexible, requireAdmin, async (_req: any, res: Response) => {
    try {
      const { SUPPORTED_VARIABLES } = await import("./services/emailVariableResolver.ts");
      return res.json(SUPPORTED_VARIABLES);
    } catch (err: any) {
      console.error("GET /api/admin/email-template-variables error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Client status-change approval requests ─────────────────────────────────────
  // These routes never mutate job_submissions.status. The actual transition is
  // performed by the Admin email workflow below after delivery succeeds.
  app.get("/api/client/job-submissions/:id/status-change-request", authenticateJWT, requireClient, async (req: any, res: Response) => {
    const result = await query(
      `SELECT r.id, r.current_status AS "currentStatus", r.requested_status AS "requestedStatus",
              r.status, r.reason, r.admin_note AS "adminNote", r.created_at AS "createdAt"
       FROM application_status_change_requests r
       JOIN job_submissions js ON js.id = r.application_id
       JOIN jobs j ON j.id = js.job_id
       WHERE r.application_id = $1 AND j.client_id = $2
         AND js.${SHORTLIST_EXCLUSION_PREDICATE}
         AND r.status = 'pending'
       LIMIT 1`,
      [req.params.id, req.user.id],
    );
    return res.json(result.rows[0] ?? null);
  });

  app.post("/api/client/job-submissions/:id/status-change-requests", authenticateJWT, requireClient, async (req: any, res: Response) => {
    const { requestedStatus, reason } = req.body ?? {};
    const { CLIENT_SETTABLE_STATUSES, submissionStatusLabel } = await import("../shared/submissionStatuses");
    if (!CLIENT_SETTABLE_STATUSES.includes(requestedStatus)) {
      return res.status(400).json({ error: "This status cannot be requested through the approval workflow." });
    }
    const dbClient = await getClient();
    try {
      await dbClient.query("BEGIN");
      await dbClient.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`status-request:${req.params.id}`]);
      const appResult = await dbClient.query(
        `SELECT js.id, js.job_id, js.status, js.talent_id, js.first_name, js.last_name, js.applicant_name,
                j.title AS job_title
         FROM job_submissions js JOIN jobs j ON j.id = js.job_id
         WHERE js.id = $1 AND j.client_id = $2
           AND js.${SHORTLIST_EXCLUSION_PREDICATE}
         FOR UPDATE OF js`,
        [req.params.id, req.user.id],
      );
      if (!appResult.rows[0]) { await dbClient.query("ROLLBACK"); return res.status(403).json({ error: "Application not found or not owned by you." }); }
      const application = appResult.rows[0];
      if (application.status === requestedStatus) { await dbClient.query("ROLLBACK"); return res.status(409).json({ error: "Application already has that status." }); }
      const inserted = await dbClient.query(
        `INSERT INTO application_status_change_requests
           (application_id, requested_by_user_id, requested_by_role, current_status, requested_status, reason)
         VALUES ($1, $2, 'client', $3, $4, $5)
         RETURNING id, current_status AS "currentStatus", requested_status AS "requestedStatus", status, created_at AS "createdAt"`,
        [application.id, req.user.id, application.status, requestedStatus, reason?.trim() || null],
      );
      const requester = await dbClient.query(`SELECT first_name, last_name, company FROM users WHERE id = $1`, [req.user.id]);
      const name = [requester.rows[0]?.first_name, requester.rows[0]?.last_name].filter(Boolean).join(" ") || requester.rows[0]?.company || "A Client";
      const talent = [application.first_name, application.last_name].filter(Boolean).join(" ") || application.applicant_name || "a Talent";
      const message = `${name} requested to change ${talent}'s application for ${application.job_title || "a job"} from ${submissionStatusLabel(application.status)} to ${submissionStatusLabel(requestedStatus)}.`;
      await dbClient.query(
        `INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
         SELECT u.id, 'application_status_change_requested', 'Application status change requested', $1, $2, 'application_status_change_request'
         FROM users u WHERE u.role = 'admin'`,
        [message, inserted.rows[0].id],
      );
      await dbClient.query("COMMIT");
      return res.status(201).json(inserted.rows[0]);
    } catch (err: any) {
      await dbClient.query("ROLLBACK").catch(() => {});
      if (err?.code === "23505") return res.status(409).json({ error: "A status change request is already pending for this application." });
      console.error("Create status change request failed:", err);
      return res.status(500).json({ error: "Unable to create status change request." });
    } finally { dbClient.release(); }
  });

  app.patch("/api/client/status-change-requests/:id/cancel", authenticateJWT, requireClient, async (req: any, res: Response) => {
    const result = await query(
      `UPDATE application_status_change_requests r SET status = 'cancelled', updated_at = NOW()
       FROM job_submissions js JOIN jobs j ON j.id = js.job_id
       WHERE r.id = $1 AND r.application_id = js.id AND j.client_id = $2 AND r.status = 'pending'
       RETURNING r.id`,
      [req.params.id, req.user.id],
    );
    if (!result.rows[0]) return res.status(409).json({ error: "This request can no longer be cancelled." });
    return res.json({ success: true });
  });

  app.get("/api/admin/status-change-requests", maybeAuthenticateAdmin, maybeRequireTalentSubRole, async (_req: any, res: Response) => {
    const result = await query(
      `SELECT r.id, r.application_id AS "applicationId", r.current_status AS "currentStatus",
              r.requested_status AS "requestedStatus", r.reason, r.created_at AS "createdAt",
              js.email, js.first_name AS "firstName", js.last_name AS "lastName", js.applicant_name AS "applicantName",
              js.status AS "actualStatus", j.title AS "jobTitle",
               COALESCE(u.first_name || ' ' || u.last_name, u.company, u.email) AS "clientName",
               EXISTS (
                 SELECT 1
                   FROM job_application_emails e
                  WHERE e.application_id = r.application_id
                    AND e.status = 'sent'
                    AND e.is_test = false
                    AND e.status_update = r.requested_status
                    AND e.status_previous = r.current_status
               ) AS "emailAlreadySent"
       FROM application_status_change_requests r
       JOIN job_submissions js ON js.id = r.application_id
       JOIN jobs j ON j.id = js.job_id
       JOIN users u ON u.id = r.requested_by_user_id
       WHERE r.status = 'pending'
         AND js.${SHORTLIST_EXCLUSION_PREDICATE}
       ORDER BY r.created_at DESC`,
    );
    return res.json(result.rows);
  });

  app.post("/api/admin/status-change-requests/:id/reject", maybeAuthenticateAdmin, maybeRequireTalentSubRole, async (req: any, res: Response) => {
    const dbClient = await getClient();
    try {
      await dbClient.query("BEGIN");
      const result = await dbClient.query(
        `UPDATE application_status_change_requests
         SET status = 'rejected', reviewed_by_user_id = $1, reviewed_at = NOW(), admin_note = $2, updated_at = NOW()
         WHERE id = $3 AND status = 'pending'
         RETURNING application_id, requested_by_user_id, current_status, requested_status`,
        [req.user.id, req.body?.adminNote?.trim() || null, req.params.id],
      );
      if (!result.rows[0]) { await dbClient.query("ROLLBACK"); return res.status(409).json({ error: "This request is no longer pending." }); }
      const r = result.rows[0];
      await dbClient.query(
        `INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
         VALUES ($1, 'application_status_change_rejected', 'Status change request declined',
                 'Your application status change request was declined.', $2, 'application_status_change_request')`,
        [r.requested_by_user_id, req.params.id],
      );
      await dbClient.query("COMMIT");
      return res.json({ success: true });
    } catch (err) { await dbClient.query("ROLLBACK").catch(() => {}); return res.status(500).json({ error: "Unable to reject request." }); }
    finally { dbClient.release(); }
  });

  // Finalizes a request whose matching applicant email was already delivered by
  // an earlier attempt that could not commit its database transaction. This
  // path intentionally never sends email.
  app.post(
    "/api/admin/status-change-requests/:id/finalize",
    authenticateAdminFlexible,
    requireAdmin,
    requireAdminSubRole(["talent_acquisition"]),
    async (req: any, res: Response) => {
      const dbClient = await getClient();
      let step = "lock_status_request";
      try {
        const { CLIENT_SETTABLE_STATUSES, submissionStatusLabel } =
          await import("../shared/submissionStatuses");
        await dbClient.query("BEGIN");

        const requestResult = await dbClient.query(
          `SELECT id, application_id, requested_by_user_id, current_status, requested_status, status
             FROM application_status_change_requests
            WHERE id = $1
            FOR UPDATE`,
          [req.params.id],
        );
        const request = requestResult.rows[0];
        if (!request || request.status !== "pending") {
          await dbClient.query("ROLLBACK");
          return res.status(409).json({ error: "This request is no longer pending." });
        }
        if (!CLIENT_SETTABLE_STATUSES.includes(request.requested_status)) {
          await dbClient.query("ROLLBACK");
          return res.status(400).json({ error: "This request has an invalid target status." });
        }

        step = "lock_application";
        const applicationResult = await dbClient.query(
          `SELECT id, job_id, talent_id, first_name, last_name, applicant_name, email, status
             FROM job_submissions
            WHERE id = $1
            FOR UPDATE`,
          [request.application_id],
        );
        const application = applicationResult.rows[0];
        if (!application) {
          throw new Error(`Application ${request.application_id} is missing`);
        }
        if (application.status !== request.current_status) {
          await dbClient.query(
            `UPDATE application_status_change_requests
                SET status = 'cancelled',
                    admin_note = 'Application status changed before approval could be finalized.',
                    reviewed_by_user_id = $1,
                    reviewed_at = NOW(),
                    updated_at = NOW()
              WHERE id = $2 AND status = 'pending'`,
            [req.user.id, request.id],
          );
          await dbClient.query("COMMIT");
          return res.status(409).json({ error: "The request is stale because the application status has changed." });
        }

        step = "verify_sent_email";
        const sentEmail = await dbClient.query(
          `SELECT id
             FROM job_application_emails
            WHERE application_id = $1
              AND status = 'sent'
              AND is_test = false
              AND status_update = $2
              AND status_previous = $3
            ORDER BY sent_at DESC
            LIMIT 1`,
          [application.id, request.requested_status, request.current_status],
        );
        if (!sentEmail.rows[0]) {
          await dbClient.query("ROLLBACK");
          return res.status(409).json({
            error: "No delivered applicant email matches this pending request. Send an approval email instead.",
          });
        }

        step = "load_job";
        const jobResult = await dbClient.query(
          `SELECT title FROM jobs WHERE id = $1`,
          [application.job_id],
        );
        const jobTitle = jobResult.rows[0]?.title || "a job";
        let statusHistoryId: string | null = null;

        step = "update_application";
        const applicationUpdate = await dbClient.query(
          `UPDATE job_submissions
              SET status = $1, updated_at = NOW()
            WHERE id = $2 AND status = $3
          RETURNING *`,
          [request.requested_status, application.id, request.current_status],
        );
        if (applicationUpdate.rows.length !== 1) {
          throw new Error(`Application ${application.id} did not update from ${request.current_status}`);
        }

        const historyNote = `Client status request ${request.id}: Finalized after previously delivered applicant email`;
        step = "write_status_history";
        const historyResult = await dbClient.query(
          `INSERT INTO job_application_status_history
             (application_id, previous_status, new_status, note, changed_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            application.id,
            request.current_status,
            request.requested_status,
            historyNote,
            req.user.id,
          ],
        );
        statusHistoryId = historyResult.rows[0]?.id ?? null;
        if (!statusHistoryId) {
          throw new Error(`Status history was not recorded for application ${application.id}`);
        }

        step = "approve_status_request";
        const requestUpdate = await dbClient.query(
          `UPDATE application_status_change_requests
              SET status = 'approved',
                  reviewed_by_user_id = $1,
                  reviewed_at = NOW(),
                  admin_note = 'Finalized after previously delivered applicant email.',
                  updated_at = NOW()
            WHERE id = $2 AND status = 'pending'`,
          [req.user.id, request.id],
        );
        if (requestUpdate.rowCount !== 1) {
          throw new Error(`Status request ${request.id} was not marked approved`);
        }

        step = "create_client_notification";
        const talentName = [application.first_name, application.last_name].filter(Boolean).join(" ") ||
          application.applicant_name || "the Talent";
        await dbClient.query(
          `INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
           SELECT $1::varchar, 'application_status_change_approved', 'Status change request approved',
                  $2::text, $3::varchar, 'application_status_change_request'
            WHERE NOT EXISTS (
              SELECT 1 FROM notifications
               WHERE user_id = $4::varchar
                 AND type = 'application_status_change_approved'
                 AND related_id = $5::varchar
            )`,
          [
            request.requested_by_user_id,
            `Your request to change ${talentName}'s application for ${jobTitle} to ${submissionStatusLabel(request.requested_status)} was approved.`,
            request.id,
            request.requested_by_user_id,
            request.id,
          ],
        );
        await dbClient.query("COMMIT");
        await notifyTalentOfApplicationStatusChange({
          submissionId: application.id,
          talentUserId: application.talent_id,
          applicantEmail: application.email,
          jobTitle,
          previousStatus: request.current_status,
          newStatus: request.requested_status,
          eventKey: `job-application-status-history:${statusHistoryId}`,
        });
        return res.json({ success: true, application: applicationUpdate.rows[0], finalizedEmailId: sentEmail.rows[0].id });
      } catch (err: any) {
        await dbClient.query("ROLLBACK").catch(() => {});
        console.error(`POST /api/admin/status-change-requests/:id/finalize failed (APPROVAL_COMMIT_STEP=${step}):`, err);
        return res.status(500).json({ error: "Unable to finalize the approved status request." });
      } finally {
        dbClient.release();
      }
    },
  );

  // ── Application Email Routes ──────────────────────────────────────────────────
  // TODO: Protect all application email routes with admin authorization before production.

  // POST /api/admin/job-applications/:id/email/preview — resolve variables, return HTML
  app.post("/api/admin/job-applications/:id/email/preview", authenticateAdminFlexible, requireAdmin, requireAdminSubRole(["talent_acquisition"]), async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { templateId, subject, bodyHtml, newStatus, previousStatus } = req.body;

      // Load application + job
      const appRow = await query(
        `SELECT js.first_name, js.last_name, js.applicant_name, js.email, js.phone,
                js.status, js.submitted_at, js.job_id,
                j.title AS job_title, j.company AS job_company, j.location AS job_location
         FROM job_submissions js
         JOIN jobs j ON j.id = js.job_id
         WHERE js.id = $1`,
        [id],
      );
      if (appRow.rows.length === 0) return res.status(404).json({ error: "Application not found" });
      const app_ = appRow.rows[0];

      let subjectRaw = subject;
      let bodyRaw = bodyHtml;

      // Load from template if requested
      if (templateId && (!subjectRaw || !bodyRaw)) {
        const tpl = await query(
          `SELECT subject, body_html FROM applicant_email_templates WHERE id = $1`, [templateId],
        );
        if (tpl.rows.length > 0) {
          subjectRaw = subjectRaw ?? tpl.rows[0].subject;
          bodyRaw = bodyRaw ?? tpl.rows[0].body_html;
        }
      }

      if (!bodyRaw) return res.status(400).json({ error: "bodyHtml or templateId is required" });

      const { buildEmailContext, renderApplicantEmail } = await import("./services/emailVariableResolver.ts");
      const ctx = buildEmailContext({
        firstName: app_.first_name, lastName: app_.last_name,
        applicantName: app_.applicant_name, email: app_.email, phone: app_.phone,
        jobTitle: app_.job_title, jobCompany: app_.job_company, jobLocation: app_.job_location,
        status: newStatus ?? app_.status,
        previousStatus: previousStatus ?? null,
        newStatus: newStatus ?? null,
        applicationId: id,
        jobPostingId: app_.job_id,
        submittedAt: app_.submitted_at,
      });

      const rendered = renderApplicantEmail({
        subject: subjectRaw ?? "",
        bodyHtml: bodyRaw,
      }, ctx);

      return res.json({
        subject: rendered.subject,
        bodyHtml: rendered.bodyHtml,
        unresolvedKeys: rendered.unresolvedKeys,
      });
    } catch (err: any) {
      console.error("POST /api/admin/job-applications/:id/email/preview error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/admin/job-applications/:id/email/test — send a test email (prefixes subject with [TEST])
  app.post("/api/admin/job-applications/:id/email/test", maybeAuthenticateAdmin, maybeRequireTalentSubRole, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { templateId, subject, bodyHtml, testRecipient, newStatus, previousStatus } = req.body;
      if (!testRecipient?.trim()) return res.status(400).json({ error: "testRecipient is required for test sends" });

      const appRow = await query(
        `SELECT js.first_name, js.last_name, js.applicant_name, js.email, js.phone,
                js.status, js.submitted_at, js.job_id,
                j.title AS job_title, j.company AS job_company, j.location AS job_location
         FROM job_submissions js
         JOIN jobs j ON j.id = js.job_id
         WHERE js.id = $1`,
        [id],
      );
      if (appRow.rows.length === 0) return res.status(404).json({ error: "Application not found" });
      const app_ = appRow.rows[0];

      let subjectRaw = subject;
      let bodyRaw = bodyHtml;
      if (templateId && (!subjectRaw || !bodyRaw)) {
        const tpl = await query(
          `SELECT subject, body_html FROM applicant_email_templates WHERE id = $1`, [templateId],
        );
        if (tpl.rows.length > 0) {
          subjectRaw = subjectRaw ?? tpl.rows[0].subject;
          bodyRaw = bodyRaw ?? tpl.rows[0].body_html;
        }
      }
      if (!bodyRaw) return res.status(400).json({ error: "bodyHtml or templateId is required" });

      const { buildEmailContext, renderApplicantEmail } = await import("./services/emailVariableResolver.ts");
      const ctx = buildEmailContext({
        firstName: app_.first_name, lastName: app_.last_name,
        applicantName: app_.applicant_name, email: app_.email, phone: app_.phone,
        jobTitle: app_.job_title, jobCompany: app_.job_company, jobLocation: app_.job_location,
        status: newStatus ?? app_.status,
        previousStatus: previousStatus ?? null,
        newStatus: newStatus ?? null,
        applicationId: id,
        jobPostingId: app_.job_id,
        submittedAt: app_.submitted_at,
      });
      const rendered = renderApplicantEmail({
        subject: subjectRaw ?? "",
        bodyHtml: bodyRaw,
      }, ctx);
      if (rendered.unresolvedKeys.length > 0) {
        console.error(
          `POST /api/admin/job-applications/${id}/email/test blocked unresolved variables: ${rendered.unresolvedKeys.join(", ")}`,
        );
        return res.status(422).json({
          error: "Email was not sent because its template has unresolved variables.",
          unresolvedKeys: rendered.unresolvedKeys,
        });
      }

      const { sendApplicantEmail } = await import("./services/microsoftGraphEmailService.ts");
      const sendResult = await sendApplicantEmail({
        to: testRecipient.trim(),
        subject: `[TEST] ${rendered.subject}`,
        bodyHtml: rendered.bodyHtml,
      });

      if (!sendResult.success) {
        return res.status(502).json({ error: `Email send failed: ${sendResult.error}` });
      }
      return res.json({ success: true, sentTo: testRecipient.trim() });
    } catch (err: any) {
      console.error("POST /api/admin/job-applications/:id/email/test error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Shared application-status-with-email workflow. Admin and Client wrappers
  // below use this same handler; only authorization and recipient policy differ.
  const handleApplicationStatusEmail = async (req: any, res: Response) => {
    const { id } = req.params;
    const {
      templateId,
      subject,
      bodyHtml,
      updateStage: rawUpdateStage,
      note,
      senderEmail: rawSenderEmail,
      statusChangeRequestId,
    } = req.body ?? {};
    const sentBy: string | null = req.user?.id ?? null;
    const dbClient = await getClient();
    let emailDelivered = false;
    let approvalCommitStep = "validate_request";
    let deliveredEmailRecord: {
      templateId: string | null;
      subject: string;
      bodyHtml: string;
      sentTo: string;
      statusUpdate: string | null;
      statusPrevious: string | null;
      statusNote: string | null;
      senderEmail: string;
      senderName: string;
    } | null = null;

    const rollbackQuietly = async () => {
      try {
        await dbClient.query("ROLLBACK");
      } catch {
        // Preserve the original error/response.
      }
    };

    try {
      const { ADMIN_SETTABLE_STATUSES, CLIENT_SETTABLE_STATUSES, submissionStatusLabel } =
        await import("../shared/submissionStatuses");
      const isClientActor = false;
      const LEGACY_STATUS_ALIASES: Record<string, string> = {
        submitted: "new",
        interview: "interviewing",
        offered: "offer_extended",
      };
      let updateStage = rawUpdateStage
        ? LEGACY_STATUS_ALIASES[rawUpdateStage] ?? rawUpdateStage
        : null;

      // These statuses are owned by the interview/offer/contract/withdrawal
      // workflows. They must not be repackaged as a generic Admin
      // status-with-email transition.
      const GENERIC_ADMIN_EMAIL_STATUSES = [
        "new",
        "under_review",
        "reviewed",
        "shortlisted",
        "rejected",
      ];
      const allowedStatuses = isClientActor
        ? CLIENT_SETTABLE_STATUSES
        : GENERIC_ADMIN_EMAIL_STATUSES;
      if (updateStage && !allowedStatuses.includes(updateStage as any)) {
        return res.status(400).json({
          error: "Invalid status transition",
          message: `This status is managed by its dedicated workflow. Email status changes support: ${allowedStatuses.join(", ")}`,
        });
      }

      const { ALLOWED_SENDERS: SENDER_ALLOWLIST } =
        await import("./services/microsoftGraphEmailService.ts");
      const resolvedSenderEmail: string =
        rawSenderEmail && SENDER_ALLOWLIST[rawSenderEmail]
          ? rawSenderEmail
          : "careers@onspotglobal.com";
      const resolvedSenderName =
        SENDER_ALLOWLIST[resolvedSenderEmail] ?? "OnSpot Careers";

      await dbClient.query("BEGIN");
      // Serialize status-with-email requests for the same application. This
      // prevents a rapid retry from sending a second email after the first
      // request has already committed the requested status.
      await dbClient.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [`admin-status-email:${id}`],
      );

      // Lock the request independently before the submission. This avoids
      // nullable joins in FOR UPDATE and gives the approval its event identity.
      let approvedRequest: any = null;
      if (statusChangeRequestId) {
        approvalCommitStep = "lock_status_request";
        const requestRow = await dbClient.query(
          `SELECT id, application_id, requested_by_user_id, current_status, requested_status, status
             FROM application_status_change_requests
            WHERE id = $1
            FOR UPDATE`,
          [statusChangeRequestId],
        );
        if (!requestRow.rows[0] || requestRow.rows[0].application_id !== id || requestRow.rows[0].status !== "pending") {
          await rollbackQuietly();
          return res.status(409).json({ error: "This status change request is no longer pending." });
        }
        approvedRequest = requestRow.rows[0];
        updateStage = LEGACY_STATUS_ALIASES[approvedRequest.requested_status] ?? approvedRequest.requested_status;
        if (!GENERIC_ADMIN_EMAIL_STATUSES.includes(updateStage)) {
          await rollbackQuietly();
          return res.status(400).json({ error: "The requested status is not valid for the approval workflow." });
        }
      }

      approvalCommitStep = "lock_application";
      const appRow = await dbClient.query(
        `SELECT js.id, js.job_id, js.client_id, js.first_name, js.last_name,
                js.applicant_name, js.email, js.phone, js.talent_id,
                js.status, js.submitted_at
           FROM job_submissions js
          WHERE js.id = $1
          FOR UPDATE`,
        [id],
      );
      if (appRow.rows.length === 0) {
        await rollbackQuietly();
        return res.status(404).json({ error: "Application not found" });
      }
      const app_ = appRow.rows[0];
      if (isClientActor && app_.client_id !== req.user.id) {
        await rollbackQuietly();
        return res.status(403).json({ error: "You do not own this application" });
      }
      const jobRow = await dbClient.query(
        `SELECT title, company, location FROM jobs WHERE id = $1 LIMIT 1`,
        [app_.job_id],
      );
      if (jobRow.rows.length === 0) {
        await rollbackQuietly();
        return res.status(404).json({ error: "Application job not found" });
      }
      app_.job_title = jobRow.rows[0].title;
      app_.job_company = jobRow.rows[0].company;
      app_.job_location = jobRow.rows[0].location;

      if (approvedRequest) {
        if (app_.status !== approvedRequest.current_status) {
          approvalCommitStep = "cancel_stale_request";
          await dbClient.query(
            `UPDATE application_status_change_requests
             SET status = 'cancelled', admin_note = 'Application status changed before approval.',
                 reviewed_by_user_id = $1, reviewed_at = NOW(), updated_at = NOW()
             WHERE id = $2`,
            [sentBy, statusChangeRequestId],
          );
          await dbClient.query("COMMIT");
          return res.status(409).json({
            error: "stale_status_change_request",
            message: "This request can no longer be approved because the application's status has changed since it was submitted.",
          });
        }
      }

      if (updateStage && updateStage === app_.status) {
        await rollbackQuietly();
        return res.status(409).json({
          error: "status_already_set",
          message: "This application already has the requested status.",
        });
      }

      if (!app_.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(app_.email)) {
        await rollbackQuietly();
        return res.status(400).json({
          error: "Applicant does not have a valid email address. Status was not changed.",
        });
      }

      let subjectRaw = subject;
      let bodyRaw = bodyHtml;
      const resolvedTemplateId = templateId ?? null;
      if (templateId && (!subjectRaw || !bodyRaw)) {
        const tpl = await dbClient.query(
          `SELECT subject, body_html
             FROM applicant_email_templates
            WHERE id = $1`,
          [templateId],
        );
        if (tpl.rows.length > 0) {
          subjectRaw = subjectRaw ?? tpl.rows[0].subject;
          bodyRaw = bodyRaw ?? tpl.rows[0].body_html;
        }
      }
      if (!bodyRaw) {
        await rollbackQuietly();
        return res.status(400).json({ error: "bodyHtml or templateId is required" });
      }
      if (!subjectRaw) {
        await rollbackQuietly();
        return res.status(400).json({ error: "subject is required" });
      }

      const { buildEmailContext, renderApplicantEmail } =
        await import("./services/emailVariableResolver.ts");
      const ctx = buildEmailContext({
        firstName: app_.first_name,
        lastName: app_.last_name,
        applicantName: app_.applicant_name,
        email: app_.email,
        phone: app_.phone,
        jobTitle: app_.job_title,
        jobCompany: app_.job_company,
        jobLocation: app_.job_location,
        status: updateStage ?? app_.status,
        previousStatus: updateStage ? app_.status : null,
        newStatus: updateStage ?? null,
        applicationId: app_.id,
        jobPostingId: app_.job_id,
        submittedAt: app_.submitted_at,
      });
      const rendered = renderApplicantEmail({
        subject: subjectRaw,
        bodyHtml: bodyRaw,
      }, ctx);
      if (rendered.unresolvedKeys.length > 0) {
        await rollbackQuietly();
        console.error(
          `POST /api/admin/job-applications/${id}/email/send blocked template ${resolvedTemplateId ?? "custom"}; unresolved variables: ${rendered.unresolvedKeys.join(", ")}`,
        );
        return res.status(422).json({
          error: "Email was not sent because its template has unresolved variables.",
          unresolvedKeys: rendered.unresolvedKeys,
        });
      }
      const resolvedSubject = rendered.subject;
      const resolvedBody = rendered.bodyHtml;

      const { sendApplicantEmail } =
        await import("./services/microsoftGraphEmailService.ts");
      const sendResult = await sendApplicantEmail({
        to: app_.email,
        subject: resolvedSubject,
        bodyHtml: resolvedBody,
        senderEmail: resolvedSenderEmail,
      });

      if (!sendResult.success) {
        await rollbackQuietly();
        await query(
          `INSERT INTO job_application_emails
             (application_id, template_id, subject, body_html, sent_to, sent_by,
              sender_email, sender_name, status, error_message, is_test,
              status_update, status_previous, status_note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'failed', $9, false, $10, $11, $12)`,
          [
            id,
            resolvedTemplateId,
            resolvedSubject,
            resolvedBody,
            app_.email,
            sentBy,
            resolvedSenderEmail,
            resolvedSenderName,
            sendResult.error ?? "Email delivery failed",
            updateStage,
            updateStage ? app_.status : null,
            updateStage ? (note?.trim() || "Status updated with applicant email sent") : null,
          ],
        );
        return res.status(502).json({
          error: `Email delivery failed: ${sendResult.error ?? "Unknown provider error"}`,
        });
      }
      emailDelivered = true;
      // If a later transactional write fails, the catch block persists this
      // evidence after rollback so Admin can finalize without sending again.
      deliveredEmailRecord = {
        templateId: resolvedTemplateId,
        subject: resolvedSubject,
        bodyHtml: resolvedBody,
        sentTo: app_.email,
        statusUpdate: updateStage,
        statusPrevious: updateStage ? app_.status : null,
        statusNote: updateStage ? (note?.trim() || "Status updated with applicant email sent") : null,
        senderEmail: resolvedSenderEmail,
        senderName: resolvedSenderName,
      };

      await dbClient.query(
        `INSERT INTO job_application_emails
           (application_id, template_id, subject, body_html, sent_to, sent_by,
            sender_email, sender_name, status, error_message, is_test,
            status_update, status_previous, status_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent', NULL, false, $9, $10, $11)`,
        [
          id,
          resolvedTemplateId,
          resolvedSubject,
          resolvedBody,
          app_.email,
          sentBy,
          resolvedSenderEmail,
          resolvedSenderName,
          updateStage,
          updateStage ? app_.status : null,
          updateStage ? (note?.trim() || "Status updated with applicant email sent") : null,
        ],
      );

      let updatedApplication = app_;
      let statusHistoryId: string | null = null;
      if (updateStage) {
        approvalCommitStep = "update_application";
        const updated = await dbClient.query(
          `UPDATE job_submissions
              SET status = $1, updated_at = NOW()
            WHERE id = $2 AND status = $3
          RETURNING *`,
          [updateStage, id, app_.status],
        );
        if (updated.rows.length === 0) {
          throw new Error("Application status changed while the email was being sent");
        }
        updatedApplication = updated.rows[0];

        approvalCommitStep = "write_status_history";
        const historyNote = approvedRequest
          ? `Client status request ${approvedRequest.id}: ${note?.trim() || "Approved after applicant email delivery"}`
          : note?.trim() || "Status updated with applicant email sent";
        const historyResult = await dbClient.query(
          `INSERT INTO job_application_status_history
             (application_id, previous_status, new_status, note, changed_by)
            VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            id,
            app_.status,
            updateStage,
            historyNote,
            sentBy,
          ],
        );
        statusHistoryId = historyResult.rows[0]?.id ?? null;
        if (!statusHistoryId) {
          throw new Error(`Status history was not recorded for application ${id}`);
        }

        if (isClientActor) {
          const clientNameResult = await dbClient.query(
            `SELECT first_name, last_name, company FROM users WHERE id = $1 LIMIT 1`,
            [app_.client_id],
          );
          const clientUser = clientNameResult.rows[0];
          const clientName =
            [clientUser?.first_name, clientUser?.last_name].filter(Boolean).join(" ") ||
            clientUser?.company ||
            "A Client";
          const talentName =
            [app_.first_name, app_.last_name].filter(Boolean).join(" ") ||
            app_.applicant_name ||
            "a Talent";
          const adminMessage =
            `${clientName} changed ${talentName}'s application for ` +
            `${app_.job_title || "a job"} to ${submissionStatusLabel(updateStage)}.`;
          await dbClient.query(
            `INSERT INTO notifications
               (user_id, type, title, message, related_id, related_type)
             SELECT u.id, 'client_application_status_changed',
                    'Client updated application', $1, $2, 'job_submission'
               FROM users u
              WHERE u.role = 'admin'
                AND NOT EXISTS (
                  SELECT 1 FROM notifications n
                   WHERE n.user_id = u.id
                     AND n.type = 'client_application_status_changed'
                     AND n.related_id = $3
                     AND n.message = $1
                )`,
            [adminMessage, id, id],
          );
        }
        if (approvedRequest) {
          approvalCommitStep = "approve_status_request";
          const requestUpdate = await dbClient.query(
            `UPDATE application_status_change_requests
             SET status = 'approved', reviewed_by_user_id = $1, reviewed_at = NOW(),
                 admin_note = $2, updated_at = NOW()
             WHERE id = $3 AND status = 'pending'`,
            [sentBy, note?.trim() || null, approvedRequest.id],
          );
          if (requestUpdate.rowCount !== 1) {
            throw new Error(`Status request ${approvedRequest.id} was not marked approved`);
          }
          approvalCommitStep = "create_client_notification";
          await dbClient.query(
            `INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
             SELECT $1::varchar, 'application_status_change_approved', 'Status change request approved',
                    $2::text, $3::varchar, 'application_status_change_request'
              WHERE NOT EXISTS (
                SELECT 1 FROM notifications
                 WHERE user_id = $4::varchar
                   AND type = 'application_status_change_approved'
                   AND related_id = $5::varchar
              )`,
            [
              approvedRequest.requested_by_user_id,
              `Your request to change ${[app_.first_name, app_.last_name].filter(Boolean).join(" ") || app_.applicant_name || "the Talent"}'s application for ${app_.job_title || "a job"} to ${submissionStatusLabel(updateStage)} was approved.`,
              approvedRequest.id,
              approvedRequest.requested_by_user_id,
              approvedRequest.id,
            ],
          );
        }
      }

      approvalCommitStep = "commit";
      await dbClient.query("COMMIT");
      if (updateStage) {
        await notifyTalentOfApplicationStatusChange({
          submissionId: id,
          talentUserId: app_.talent_id,
          applicantEmail: app_.email,
          jobTitle: app_.job_title,
          companyName: app_.job_company,
          previousStatus: app_.status,
          newStatus: updateStage,
          eventKey: `job-application-status-history:${statusHistoryId}`,
        });
      }
      return res.json({
        success: true,
        sentTo: app_.email,
        application: updatedApplication,
      });
    } catch (err: any) {
      await rollbackQuietly();
      if (emailDelivered) {
        console.error(
          `[CRITICAL] APPROVAL_COMMIT_STEP=${approvalCommitStep}; applicant email delivered but status transaction failed for ${id}:`,
          err,
        );
        if (deliveredEmailRecord) {
          try {
            await query(
              `INSERT INTO job_application_emails
                 (application_id, template_id, subject, body_html, sent_to, sent_by,
                  sender_email, sender_name, status, error_message, is_test,
                  status_update, status_previous, status_note)
               SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'sent',
                      'Status transaction failed after provider delivery; finalize the pending approval without resending.',
                      false, $9, $10, $11
                WHERE NOT EXISTS (
                  SELECT 1
                    FROM job_application_emails
                   WHERE application_id = $1
                     AND status = 'sent'
                     AND is_test = false
                     AND subject = $3
                     AND status_update IS NOT DISTINCT FROM $9
                     AND status_previous IS NOT DISTINCT FROM $10
                )`,
              [
                id,
                deliveredEmailRecord.templateId,
                deliveredEmailRecord.subject,
                deliveredEmailRecord.bodyHtml,
                deliveredEmailRecord.sentTo,
                sentBy,
                deliveredEmailRecord.senderEmail,
                deliveredEmailRecord.senderName,
                deliveredEmailRecord.statusUpdate,
                deliveredEmailRecord.statusPrevious,
                deliveredEmailRecord.statusNote,
              ],
            );
          } catch (recordErr: any) {
            console.error(
              `[CRITICAL] Could not persist recovery evidence for delivered applicant email on ${id}:`,
              recordErr,
            );
          }
        }
      } else {
        console.error(`POST /api/admin/job-applications/:id/email/send error (APPROVAL_COMMIT_STEP=${approvalCommitStep}):`, err);
      }
      return res.status(emailDelivered ? 500 : 500).json({
        error: emailDelivered
          ? "Email was delivered, but the application update could not be committed. Contact an administrator before retrying."
          : "Internal server error",
      });
    } finally {
      dbClient.release();
    }
  };

  app.post(
    "/api/admin/job-applications/:id/email/send",
    authenticateAdminFlexible,
    requireAdmin,
    requireAdminSubRole(["talent_acquisition"]),
    handleApplicationStatusEmail,
  );

  // GET /api/admin/job-applications/:id/email/history — list sent emails for an application
  app.get("/api/admin/job-applications/:id/email/history", maybeAuthenticateAdmin, maybeRequireTalentSubRole, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT jae.id, jae.subject, jae.sent_to AS "sentTo",
                jae.status, jae.error_message AS "errorMessage",
                jae.is_test AS "isTest", jae.sent_at AS "sentAt",
                jae.sender_email AS "senderEmail", jae.sender_name AS "senderName",
                aet.name AS "templateName",
                u.first_name AS "senderFirstName", u.last_name AS "senderLastName"
         FROM job_application_emails jae
         LEFT JOIN applicant_email_templates aet ON aet.id = jae.template_id
         LEFT JOIN users u ON u.id = jae.sent_by
         WHERE jae.application_id = $1
         ORDER BY jae.sent_at DESC`,
        [id],
      );
      return res.json(result.rows);
    } catch (err: any) {
      console.error("GET /api/admin/job-applications/:id/email/history error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/admin/job-applications/:id/email/:emailId/retry — retry a failed email
  app.post("/api/admin/job-applications/:id/email/:emailId/retry", authenticateAdminFlexible, requireAdmin, requireAdminSubRole(["talent_acquisition"]), async (req: any, res: Response) => {
    const { id, emailId } = req.params;
    const dbClient = await getClient();
    let emailDelivered = false;
    const rollbackQuietly = async () => {
      try {
        await dbClient.query("ROLLBACK");
      } catch {
        // Preserve the original response.
      }
    };

    try {
      const { submissionStatusLabel } =
        await import("../shared/submissionStatuses");
      const GENERIC_ADMIN_EMAIL_STATUSES = [
        "new",
        "under_review",
        "reviewed",
        "shortlisted",
        "rejected",
      ];

      await dbClient.query("BEGIN");
      await dbClient.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [`admin-status-email-retry:${id}`],
      );
      const emailRow = await dbClient.query(
        `SELECT *
           FROM job_application_emails
          WHERE id = $1 AND application_id = $2
          FOR UPDATE`,
        [emailId, id],
      );
      if (emailRow.rows.length === 0) {
        await rollbackQuietly();
        return res.status(404).json({ error: "Email record not found" });
      }
      const prev = emailRow.rows[0];
      if (prev.is_test) {
        await rollbackQuietly();
        return res.status(400).json({ error: "Test emails cannot be retried from applicant history" });
      }
      if (prev.status !== "failed") {
        await rollbackQuietly();
        return res.status(409).json({
          error: "email_already_processed",
          message: "Only failed applicant emails can be retried.",
        });
      }

      // Reload the recipient and current status from the canonical application.
      const appRow = await dbClient.query(
        `SELECT js.id, js.email, js.status, js.talent_id,
                j.title AS job_title
           FROM job_submissions js
           JOIN jobs j ON j.id = js.job_id
          WHERE js.id = $1
          FOR UPDATE`,
        [id],
      );
      if (appRow.rows.length === 0) {
        await rollbackQuietly();
        return res.status(404).json({ error: "Application not found" });
      }
      const app_ = appRow.rows[0];
      const pendingStatus = prev.status_update as string | null;
      if (pendingStatus) {
        if (
          !GENERIC_ADMIN_EMAIL_STATUSES.includes(pendingStatus) ||
          !prev.status_previous ||
          app_.status !== prev.status_previous
        ) {
          await rollbackQuietly();
          return res.status(409).json({
            error: "status_transition_no_longer_available",
            message: "The saved status transition is no longer valid for this application. Start a new status email.",
          });
        }
      }

      const { ALLOWED_SENDERS: SENDER_ALLOWLIST } =
        await import("./services/microsoftGraphEmailService.ts");
      const senderEmail =
        prev.sender_email && SENDER_ALLOWLIST[prev.sender_email]
          ? prev.sender_email
          : "careers@onspotglobal.com";

      const { findUnresolvedTemplateVariables } = await import("./services/emailVariableResolver.ts");
      const unresolvedKeys = Array.from(new Set([
        ...findUnresolvedTemplateVariables(prev.subject),
        ...findUnresolvedTemplateVariables(prev.body_html),
      ]));
      if (unresolvedKeys.length > 0) {
        await rollbackQuietly();
        console.error(
          `POST /api/admin/job-applications/${id}/email/${emailId}/retry blocked unresolved variables: ${unresolvedKeys.join(", ")}`,
        );
        return res.status(409).json({
          error: "This failed email contains unresolved template variables. Create a new email from a corrected template instead of retrying it.",
          unresolvedKeys,
        });
      }

      const { sendApplicantEmail } = await import("./services/microsoftGraphEmailService.ts");
      const sendResult = await sendApplicantEmail({
        to: app_.email,
        subject: prev.subject,
        bodyHtml: prev.body_html,
        senderEmail,
      });

      if (!sendResult.success) {
        await rollbackQuietly();
        await query(
          `UPDATE job_application_emails
              SET status = 'failed', error_message = $1, sent_to = $2,
                  sender_email = $3, sender_name = COALESCE(sender_name, $4),
                  sent_at = NOW()
            WHERE id = $5 AND status = 'failed'`,
          [
            sendResult.error ?? "Email delivery failed",
            app_.email,
            senderEmail,
            SENDER_ALLOWLIST[senderEmail] ?? "OnSpot Careers",
            emailId,
          ],
        );
        return res.status(502).json({ error: `Retry failed: ${sendResult.error}` });
      }
      emailDelivered = true;

      await dbClient.query(
        `UPDATE job_application_emails
            SET status = 'sent', error_message = NULL, sent_to = $1,
                sender_email = $2, sender_name = COALESCE(sender_name, $3),
                sent_at = NOW()
          WHERE id = $4 AND status = 'failed'`,
        [
          app_.email,
          senderEmail,
          SENDER_ALLOWLIST[senderEmail] ?? "OnSpot Careers",
          emailId,
        ],
      );

      let statusHistoryId: string | null = null;
      if (pendingStatus) {
        const updated = await dbClient.query(
          `UPDATE job_submissions
              SET status = $1, updated_at = NOW()
            WHERE id = $2 AND status = $3
          RETURNING id`,
          [pendingStatus, id, prev.status_previous],
        );
        if (updated.rows.length === 0) {
          throw new Error("Application status changed while the retry email was being sent");
        }

        const historyResult = await dbClient.query(
          `INSERT INTO job_application_status_history
             (application_id, previous_status, new_status, note, changed_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [id, prev.status_previous, pendingStatus, prev.status_note, prev.sent_by],
        );
        statusHistoryId = historyResult.rows[0]?.id ?? null;
        if (!statusHistoryId) {
          throw new Error(`Status history was not recorded for application ${id}`);
        }

      }

      await dbClient.query("COMMIT");
      if (pendingStatus) {
        await notifyTalentOfApplicationStatusChange({
          submissionId: id,
          talentUserId: app_.talent_id,
          applicantEmail: app_.email,
          jobTitle: app_.job_title,
          previousStatus: prev.status_previous,
          newStatus: pendingStatus,
          eventKey: `job-application-status-history:${statusHistoryId}`,
        });
      }
      return res.json({ success: true, statusUpdated: !!pendingStatus });
    } catch (err: any) {
      await rollbackQuietly();
      if (emailDelivered) {
        console.error(
          `[CRITICAL] Applicant retry email delivered but status transaction failed for ${emailId}:`,
          err,
        );
      }
      console.error("POST /api/admin/job-applications/:id/email/:emailId/retry error:", err);
      return res.status(500).json({ error: "Internal server error" });
    } finally {
      dbClient.release();
    }
  });

  // GET /api/admin/email/connection-test — verify Graph auth + mailbox access without sending
  app.get("/api/admin/email/connection-test", maybeAuthenticateAdmin, async (_req: Request, res: Response) => {
    try {
      const { testGraphAuth, isEmailServiceConfigured } = await import("./services/microsoftGraphEmailService.ts");
      if (!isEmailServiceConfigured()) {
        const missing: string[] = [];
        if (!process.env.MICROSOFT_TENANT_ID) missing.push("MICROSOFT_TENANT_ID");
        if (!process.env.MICROSOFT_CLIENT_ID) missing.push("MICROSOFT_CLIENT_ID");
        if (!process.env.MICROSOFT_CLIENT_SECRET) missing.push("MICROSOFT_CLIENT_SECRET");
        if (!process.env.MICROSOFT_SENDER_EMAIL && !process.env.APPLICATION_EMAIL_FROM)
          missing.push("MICROSOFT_SENDER_EMAIL");
        return res.status(503).json({
          success: false,
          error: `Email service not configured — missing env vars: ${missing.join(", ")}`,
          missingVars: missing,
        });
      }
      const result = await testGraphAuth();
      if (!result.success) {
        return res.status(502).json({
          success: false,
          graphStatus: result.graphStatus,
          senderAddress: result.senderAddress,
          error: result.error,
        });
      }
      return res.json({
        success: true,
        senderAddress: result.senderAddress,
        graphStatus: result.graphStatus,
        message: "Microsoft Graph authentication and mailbox access verified.",
      });
    } catch (err: any) {
      console.error("GET /api/admin/email/connection-test error:", err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // ── Dynamic sitemap ───────────────────────────────────────────────────────────
  // Registered here (inside registerRoutes) so it takes precedence over the
  // express.static(public/) middleware that would otherwise serve the static
  // public/sitemap.xml.  This dynamic version includes published blog posts and
  // open job listings in addition to all static marketing routes.
  app.get("/sitemap.xml", async (_req: Request, res: Response) => {
    try {
      const { generateSitemapXml } = await import("./sitemapService");
      const xml = await generateSitemapXml();
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600"); // 1-hour cache
      res.status(200).send(xml);
    } catch (err) {
      console.error("[sitemap] Generation failed, falling back to static file:", err);
      res.status(500).send("<?xml version=\"1.0\"?><error>Sitemap temporarily unavailable</error>");
    }
  });

  // ── Crawl preview / SEO validation endpoint ───────────────────────────────────
  // Shows exactly what a web crawler receives for any route.
  // Usage: GET /api/crawl-preview?path=/hire-talent
  // Usage: GET /api/crawl-preview?path=/jobs/<uuid>
  app.get("/api/crawl-preview", async (req: Request, res: Response) => {
    const targetPath = (req.query.path as string) || "/";
    if (!targetPath.startsWith("/")) {
      return res.status(400).json({ error: "path must start with /" });
    }
    // Strip private routes from preview
    const BLOCKED = ["/admin", "/talent-portal", "/api/"];
    if (BLOCKED.some((p) => targetPath.startsWith(p))) {
      return res.status(403).json({ error: "Cannot preview private routes" });
    }
    try {
      const { resolveOGMeta } = await import("./ogMiddleware");
      const meta = await resolveOGMeta(targetPath, req.query as Record<string, string>);
      return res.json({
        path: targetPath,
        crawlerReceives: {
          title: meta.title,
          description: meta.description,
          canonical: meta.url,
          ogType: meta.ogType,
          ogImage: meta.image,
          hasPageContent: !!meta.pageContent,
          pageContentPreview: meta.pageContent
            ? meta.pageContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)
            : null,
        },
        note: "In production, serveStatic injects these tags into the SPA shell for ALL visitors. Detected crawlers (social, AI, SEO) additionally receive structured HTML body content.",
      });
    } catch (err) {
      console.error("[crawl-preview] Error:", err);
      return res.status(500).json({ error: "Failed to resolve metadata" });
    }
  });

  // ── POST /api/internal/promote-to-admin ──────────────────────────────────────
  // Protected endpoint for promoting an existing @onspotglobal.com account to
  // admin role. Requires X-Bootstrap-Token header matching BOOTSTRAP_SECRET env var.
  // Use case: bootstrapping shared admin account (admin@onspotglobal.com) after
  // signup, and any future one-offs before the invite-based provisioning tool ships.
  // Domain rule enforced — non-@onspotglobal.com addresses are rejected outright.
  app.post("/api/internal/promote-to-admin", async (req: Request, res: Response) => {
    try {
      const secret = process.env.BOOTSTRAP_SECRET;
      if (!secret) {
        return res.status(503).json({ error: "Endpoint not configured — BOOTSTRAP_SECRET env var not set" });
      }
      const provided = req.headers["x-bootstrap-token"];
      if (!provided || provided !== secret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { email, notes } = req.body ?? {};
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "email is required in request body" });
      }
      // Enforce domain rule before touching DB
      assertAdminEmailDomain(email.trim(), "admin");
      const row = await query(
        `SELECT id, email, role FROM users WHERE lower(email) = lower($1) LIMIT 1`,
        [email.trim()]
      );
      if (row.rows.length === 0) {
        return res.status(404).json({ error: `No account found for ${email}` });
      }
      const { id, email: canonEmail, role: prevRole } = row.rows[0];
      if (prevRole === "admin") {
        return res.status(200).json({ message: `${canonEmail} is already admin — no change made` });
      }
      await query(`UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = $1`, [id]);
      await query(
        `INSERT INTO admin_role_changes (user_id, email, previous_role, new_role, mechanism, changed_by, notes)
         VALUES ($1, $2, $3, 'admin', 'internal_promote_endpoint', 'system', $4)`,
        [id, canonEmail, prevRole, notes ?? null]
      );
      console.log(`✅ promote-to-admin: ${canonEmail} elevated ${prevRole} → admin`);
      return res.status(200).json({
        success: true,
        userId: id,
        email: canonEmail,
        previousRole: prevRole,
        newRole: "admin",
      });
    } catch (err: any) {
      if (err.statusCode === 403) {
        return res.status(403).json({ error: err.message });
      }
      console.error("promote-to-admin error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  return httpServer;
}


// Helper function for resume parsing
function parseResumeText(resumeText: string): any {
  const lines = resumeText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const parsedData = {
    personalInfo: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      title: "",
      location: "",
    },
    summary: "",
    skills: [] as string[],
    experience: [] as Array<{
      title: string;
      company: string;
      duration: string;
      description: string;
    }>,
    education: [] as Array<{
      degree: string;
      institution: string;
      year: string;
    }>,
    certifications: [] as Array<{
      name: string;
      issuer: string;
      year: string;
    }>,
  };

  let currentSection = "";
  let nameFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();

    // Extract name (usually first non-empty line)
    if (
      !nameFound &&
      line.length > 2 &&
      !line.includes("@") &&
      !line.includes("http")
    ) {
      const nameParts = line.split(" ").filter((part) => part.length > 1);
      if (nameParts.length >= 2) {
        parsedData.personalInfo.firstName = nameParts[0];
        parsedData.personalInfo.lastName = nameParts.slice(1).join(" ");
        nameFound = true;
        continue;
      }
    }

    // Extract email
    const emailMatch = line.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    );
    if (emailMatch) {
      parsedData.personalInfo.email = emailMatch[0];
      continue;
    }

    // Extract phone
    const phoneMatch = line.match(/[\+]?[1-9]?[\d\s\-\(\)]{8,}/);
    if (phoneMatch && line.length < 20) {
      parsedData.personalInfo.phone = phoneMatch[0];
      continue;
    }

    // Extract location/address — look for city/province/country patterns
    // e.g. "Cebu City, Cebu", "Makati, Metro Manila", "123 Main St, Quezon City"
    if (!parsedData.personalInfo.location && !emailMatch && line.length < 100) {
      const isAddress =
        // Street address: starts with number
        /^\d+\s+[A-Za-z]/.test(line) ||
        // City, Province/Region pattern
        /^[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+(,\s*Philippines?)?\.?$/.test(line) ||
        // Known PH cities/regions
        /\b(Cebu|Manila|Makati|Quezon City|Taguig|Pasig|Pasay|Davao|Cagayan de Oro|Iloilo|Baguio|Bacolod|Zamboanga|Metro Manila)\b/i.test(line);
      if (
        isAddress &&
        !line.includes("@") &&
        !line.includes("http") &&
        !line.includes("|") &&
        line.split(/\s+/).length <= 10
      ) {
        parsedData.personalInfo.location = line.trim();
        continue;
      }
    }

    // Detect sections
    if (
      upperLine.includes("EXPERIENCE") ||
      upperLine.includes("WORK") ||
      upperLine.includes("EMPLOYMENT")
    ) {
      currentSection = "experience";
      continue;
    }
    if (upperLine.includes("EDUCATION") || upperLine.includes("ACADEMIC")) {
      currentSection = "education";
      continue;
    }
    if (upperLine.includes("SKILL") || upperLine.includes("TECHNICAL")) {
      currentSection = "skills";
      continue;
    }
    if (
      upperLine.includes("CERTIFICATION") ||
      upperLine.includes("CERTIFICATE")
    ) {
      currentSection = "certifications";
      continue;
    }
    if (
      upperLine.includes("SUMMARY") ||
      upperLine.includes("PROFILE") ||
      upperLine.includes("OBJECTIVE")
    ) {
      currentSection = "summary";
      continue;
    }

    // Extract title (look for common professional titles)
    if (
      !parsedData.personalInfo.title &&
      (upperLine.includes("DEVELOPER") ||
        upperLine.includes("ENGINEER") ||
        upperLine.includes("MANAGER") ||
        upperLine.includes("ANALYST") ||
        upperLine.includes("DESIGNER") ||
        upperLine.includes("CONSULTANT"))
    ) {
      parsedData.personalInfo.title = line;
      continue;
    }

    // Process content based on current section
    if (currentSection === "skills" && line.length > 2) {
      // Split skills by common delimiters
      const skillsInLine = line
        .split(/[,•·|]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1);
      parsedData.skills.push(...skillsInLine);
    } else if (currentSection === "summary" && line.length > 10) {
      parsedData.summary += (parsedData.summary ? " " : "") + line;
    } else if (currentSection === "experience" && line.length > 3) {
      // Simple experience parsing - look for job titles and companies
      if (
        upperLine.includes("DEVELOPER") ||
        upperLine.includes("ENGINEER") ||
        upperLine.includes("MANAGER")
      ) {
        parsedData.experience.push({
          title: line,
          company: "",
          duration: "",
          description: "",
        });
      }
    }
  }

  // Clean up and deduplicate skills
  parsedData.skills = Array.from(new Set(parsedData.skills))
    .filter((skill) => skill.length > 1 && skill.length < 30)
    .slice(0, 20); // Limit to 20 skills

  return parsedData;
}

/**
 * requireSuperAdmin — allows only admins whose admin_sub_role IS NULL in the DB.
 * NULL sub-role = super-admin (unrestricted). Restricted sub-roles are rejected
 * so they cannot assign or escalate roles.
 * Must run AFTER authenticateAdminFlexible or authenticateJWT + requireAdmin.
 */
const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  try {
    const result = await query(
      "SELECT admin_sub_role FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );
    if (result.rows.length === 0) return res.status(403).json({ error: "Forbidden" });
    const adminSubRole: string | null = result.rows[0].admin_sub_role ?? null;
    if (adminSubRole !== null) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: "Only super-admins (no sub-role) may manage admin role assignments.",
      });
    }
    next();
  } catch (err: any) {
    console.error("requireSuperAdmin error:", err);
    return res.status(500).json({ error: "Authorization check failed" });
  }
};
