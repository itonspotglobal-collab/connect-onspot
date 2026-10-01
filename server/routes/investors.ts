import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { investorRequests } from "../../shared/schema.js";
import { escHtml } from "../lib/escHtml.js";
import { sendApplicantEmail, type SendEmailResult } from "../services/microsoftGraphEmailService.js";

export const investorRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  firm: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  requestType: z.enum(["meeting", "deck", "founder"]),
  message: z.string().trim().max(1500).optional(),
}).strict();

export type InvestorRequest = z.infer<typeof investorRequestSchema>;

export interface InvestorStats {
  contractorAccounts: number;
  clientAccounts: number;
  asOf: string;
}

type InvestorDependencies = {
  loadStats: () => Promise<InvestorStats>;
  saveRequest: (request: InvestorRequest) => Promise<{ id: string }>;
  notifyFounder: (request: InvestorRequest) => Promise<SendEmailResult>;
  recordNotification: (id: string, result: SendEmailResult) => Promise<void>;
};

// One query measures individual registered accounts, not profiles, companies,
// filled roles, or paying customers. A candidate-only account must have a
// portal login credential; account_created alone is insufficient. Normalized
// email prevents one person with both talent auth representations counting twice.
// Whole-word markers avoid rejecting legitimate names containing "test".
const accountCountSql = sql`
  WITH identities AS (
    SELECT u.role, lower(btrim(u.email)) AS email, u.id AS source_id,
      coalesce(u.first_name, '') AS first_name,
      coalesce(u.last_name, '') AS last_name
    FROM users u
    WHERE u.role IN ('talent', 'client')

    UNION ALL

    SELECT 'talent' AS role, lower(btrim(c.email)) AS email,
      c.id AS source_id,
      coalesce(c.first_name, c.full_name, '') AS first_name,
      coalesce(c.last_name, '') AS last_name
    FROM candidates c
    WHERE nullif(c.password_hash, '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = c.user_id OR lower(btrim(u.email)) = lower(btrim(c.email))
      )
  ),
  eligible AS (
    SELECT DISTINCT role, email
    FROM identities
    WHERE email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      AND split_part(email, '@', 2) NOT IN ('onspotglobal.com', 'onspotglobal.test')
      AND split_part(email, '@', 2) NOT LIKE '%.onspotglobal.com'
      AND email !~ '@(example[.](com|org|net)|localhost)$'
      AND split_part(email, '@', 2) !~ '[.](test|invalid)$'
      AND split_part(email, '@', 1)
        !~ '(^|[._+-])(test|testing|demo|dummy|sample|seed|fixture|internal|scaffold)([._+-]|[0-9]|$)'
      AND source_id
        !~* '^(ledger-|p3b-|test-|smoke-|fixture-|seed-|perf-|scaffold-)'
      AND concat_ws(' ', first_name, last_name)
        !~* '(^|[[:space:]_.-])(test|testing|demo|dummy|fixture|seed|scaffold)([[:space:]_.-]|[0-9]|$)'
  )
  SELECT COUNT(DISTINCT email) FILTER (WHERE role = 'talent')::integer AS contractor_accounts,
    COUNT(DISTINCT email) FILTER (WHERE role = 'client')::integer AS client_accounts
  FROM eligible
`;

async function loadStatsFromDatabase(): Promise<InvestorStats> {
  const result = await db.execute(accountCountSql);
  const row = result.rows[0] as
    | { contractor_accounts: number; client_accounts: number }
    | undefined;
  if (!row) throw new Error("Investor account totals were not returned");
  const contractorAccounts = Number(row.contractor_accounts);
  const clientAccounts = Number(row.client_accounts);
  if (!Number.isSafeInteger(contractorAccounts) || !Number.isSafeInteger(clientAccounts)) {
    throw new Error("Investor account totals are invalid");
  }
  return { contractorAccounts, clientAccounts, asOf: new Date().toISOString() };
}

const REQUEST_LABELS: Record<InvestorRequest["requestType"], string> = {
  meeting: "Request a Meeting",
  deck: "Request the Pitch Deck",
  founder: "Speak to the Founder",
};

async function notifyFounder(request: InvestorRequest): Promise<SendEmailResult> {
  const details = [
    `<p><strong>Request:</strong> ${escHtml(REQUEST_LABELS[request.requestType])}</p>`,
    `<p><strong>Name:</strong> ${escHtml(request.name)}</p>`,
    `<p><strong>Firm or affiliation:</strong> ${escHtml(request.firm)}</p>`,
    `<p><strong>Email:</strong> ${escHtml(request.email)}</p>`,
    request.message ? `<p><strong>Message:</strong><br>${escHtml(request.message).replace(/\n/g, "<br>")}</p>` : "",
  ].join("");

  return sendApplicantEmail({
    to: "nur@onspotglobal.com",
    toName: "Nur",
    subject: `Investor request: ${REQUEST_LABELS[request.requestType]}`,
    bodyHtml: `<p>An investor submitted a request through the OnSpot Investors page.</p>${details}`,
    replyTo: request.email,
    senderEmail: "careers@onspotglobal.com", // Existing server-side allowlisted mailbox.
  });
}

const databaseDependencies: InvestorDependencies = {
  loadStats: loadStatsFromDatabase,
  saveRequest: async (request) => {
    const [created] = await db.insert(investorRequests).values({
      name: request.name,
      firm: request.firm,
      email: request.email,
      requestType: request.requestType,
      message: request.message || null,
    }).returning({ id: investorRequests.id });
    if (!created) throw new Error("Investor request was not saved");
    return created;
  },
  notifyFounder,
  recordNotification: async (id, result) => {
    await db.update(investorRequests)
      .set({
        notificationStatus: result.success ? "sent" : "failed",
        notificationError: result.success ? null : (result.error || "Email delivery failed").slice(0, 500),
        notificationSentAt: result.success ? new Date() : null,
      })
      .where(eq(investorRequests.id, id));
  },
};

export function createCachedInvestorStatsLoader(
  load: () => Promise<InvestorStats>,
  ttlMs = 60_000,
  now = () => Date.now(),
): () => Promise<InvestorStats> {
  let cached: InvestorStats | null = null;
  let loadedAt = 0;
  let pending: Promise<InvestorStats> | null = null;
  return () => {
    if (cached && now() - loadedAt < ttlMs) return Promise.resolve(cached);
    if (pending) return pending;
    pending = load().then((value) => {
      cached = value;
      loadedAt = now();
      return value;
    }).finally(() => { pending = null; });
    return pending;
  };
}

export function registerInvestorRoutes(app: Express, dependencies: InvestorDependencies = databaseDependencies): void {
  const getStats = createCachedInvestorStatsLoader(dependencies.loadStats);
  const inquiryLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many investor requests. Please try again later." },
  });

  app.get("/api/public/investor-stats", async (_req, res) => {
    // Clients revalidate each minute. Only the server owns the 60-second SQL
    // cache so proxy/browser caches cannot compound it into stale hours.
    res.setHeader("Cache-Control", "no-store");
    try {
      res.json(await getStats());
    } catch (error) {
      console.error("Failed to load investor account totals", error);
      res.status(503).json({ error: "Account totals are temporarily unavailable" });
    }
  });

  app.post("/api/public/investor-requests", inquiryLimiter, async (req, res) => {
    const parsed = investorRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Please provide a name, firm, valid email, and request type." });
    }

    let saved: { id: string };
    try {
      saved = await dependencies.saveRequest(parsed.data);
    } catch (error) {
      console.error("Failed to save investor request", error);
      return res.status(503).json({ error: "Request could not be saved. Please try again." });
    }

    let result: SendEmailResult;
    try {
      result = await dependencies.notifyFounder(parsed.data);
    } catch (error) {
      console.error("Failed to notify founder of investor request", error);
      result = { success: false, error: "Email delivery failed" };
    }

    try {
      await dependencies.recordNotification(saved.id, result);
    } catch (error) {
      // An already-saved request (and possibly delivered email) must not be
      // turned into a client retry that produces a duplicate notification.
      console.error("Failed to record investor notification status", { id: saved.id, error });
    }

    return res.status(201).json({
      id: saved.id,
      notificationStatus: result.success ? "sent" : "failed",
    });
  });
}