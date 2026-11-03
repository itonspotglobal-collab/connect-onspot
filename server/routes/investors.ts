import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { investorRequests } from "../../shared/schema.js";
import { escHtml } from "../lib/escHtml.js";
import { ALLOWED_SENDERS, sendApplicantEmail, type SendEmailOptions, type SendEmailResult } from "../services/microsoftGraphEmailService.js";

export const investorPhoneSchema = z.string().trim().min(7).max(20)
  .regex(/^[0-9 +().-]+$/)
  .refine(value => (value.match(/[0-9]/g) || []).length >= 7,
    "Enter a valid contact number, including country code.");

export const investorRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  firm: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  phone: investorPhoneSchema.optional(),
  inquiry: z.string().trim().max(1500).optional(),
  requestType: z.enum(["meeting", "deck", "founder"]),
  message: z.string().trim().max(1500).optional(),
}).strict();

export type InvestorRequest = Omit<z.infer<typeof investorRequestSchema>, "requestType"> & {
  requestType: z.infer<typeof investorRequestSchema>["requestType"] | "valuation";
  source?: "investors-page";
  requestedDocument?: "deck" | "valuation";
};

// A separate input contract preserves the existing firm-required inquiry flow.
// Document leads use the same private ledger and server-assigned created_at.
export const investorDocumentRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  phone: investorPhoneSchema,
  inquiry: z.string().trim().max(1500).optional(),
  requestedDocument: z.enum(["deck", "valuation"]),
  source: z.literal("investors-page"),
  website: z.string().max(0).optional(),
}).strict();

export interface InvestorStats {
  contractorAccounts: number;
  clientAccounts: number;
  asOf: string;
}

type InvestorDependencies = {
  loadStats: () => Promise<InvestorStats>;
  saveRequest: (request: InvestorRequest) => Promise<{ id: string; createdAt?: Date }>;
  notifyFounders: (request: InvestorRequest, saved: { id: string; createdAt: Date }) => Promise<SendEmailResult>;
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
  deck: "Pitch deck",
  founder: "Speak to the Founder",
  valuation: "Valuation summary",
};

export const INVESTOR_NOTIFICATION_RECIPIENTS = [
  { address: "nur@onspotglobal.com", name: "Nur Laminero" },
  { address: "Jake@onspotglobal.com", name: "Jake Wainberg" },
  { address: "Mark.Apostol@onspotglobal.com", name: "Mark Apostol" },
];

export async function notifyFounders(
  request: InvestorRequest,
  saved: { id: string; createdAt: Date },
  send: (options: SendEmailOptions) => Promise<SendEmailResult> = sendApplicantEmail,
): Promise<SendEmailResult> {
  const senderEmail = (process.env.INVESTORS_EMAIL ?? "investors@onspotglobal.com").trim();
  if (!Object.hasOwn(ALLOWED_SENDERS, senderEmail)) {
    console.error("Investor sender mailbox is not allowlisted");
    return { success: false, error: "Investor sender mailbox is not allowlisted" };
  }
  const override = process.env.INVESTOR_NOTIFICATION_TO;
  const recipients = override === undefined ? INVESTOR_NOTIFICATION_RECIPIENTS
    : override.split(",").map(address => ({ address: address.trim() }));
  if (!recipients.length || recipients.some(r => !z.string().email().safeParse(r.address).success)) {
    console.error("Investor notification recipients configuration is invalid");
    return { success: false, error: "Investor notification recipients configuration is invalid" };
  }
  const row = (label: string, html: string) =>
    `<tr><th scope="row" style="text-align:left;vertical-align:top;padding:8px">${escHtml(label)}</th><td style="padding:8px">${html}</td></tr>`;
  const inquiry = request.inquiry || (!request.requestedDocument ? request.message : "") || "None provided";
  const submitted = `${saved.createdAt.toLocaleString("en-GB", {
    timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "long",
  })} (Asia/Manila) / ${saved.createdAt.toISOString()} (UTC)`;
  const details = [
    row("Request", escHtml(REQUEST_LABELS[request.requestType])),
    row("Name", escHtml(request.name)),
    ...(request.firm ? [row("Firm or affiliation", escHtml(request.firm))] : []),
    row("Contact number", request.phone
      ? `<a href="tel:${escHtml(request.phone.replace(/[^0-9+]/g, ""))}">${escHtml(request.phone)}</a>`
      : escHtml("None provided")),
    row("Inquiry", escHtml(inquiry).replace(/\r?\n/g, "<br>")),
    row("Submitted", escHtml(submitted)),
    row("Reference", escHtml(saved.id)),
  ].join("");
  return send({
    to: recipients,
    subject: `Investor request: ${REQUEST_LABELS[request.requestType]} from ${request.name.split(/\s+/)[0]}`,
    bodyHtml: `<p>${escHtml("A new investor request was submitted through the OnSpot Investors page.")}</p><table>${details}</table><p>${escHtml("Reply to this email to respond directly to the investor.")}</p>`,
    replyTo: request.email,
    senderEmail,
  });
}

const databaseDependencies: InvestorDependencies = {
  loadStats: loadStatsFromDatabase,
  saveRequest: async (request) => {
    const [created] = await db.insert(investorRequests).values({
      name: request.name,
      firm: request.firm,
      email: request.email,
      phone: request.phone || null,
      inquiry: request.inquiry || null,
      requestType: request.requestType,
      message: request.message || null,
      source: request.source || null,
      requestedDocument: request.requestedDocument || null,
    }).returning({ id: investorRequests.id, createdAt: investorRequests.createdAt });
    if (!created) throw new Error("Investor request was not saved");
    return created;
  },
  notifyFounders,
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

  const saveAndNotify = async (
    request: InvestorRequest,
    res: import("express").Response,
    documentRequest = false,
  ) => {
    let saved: { id: string; createdAt?: Date };
    try {
      saved = await dependencies.saveRequest(request);
    } catch (error) {
      console.error("Failed to save investor request", error);
      return res.status(503).json({ error: "Request could not be saved. Please try again." });
    }

    let result: SendEmailResult;
    try {
      result = await dependencies.notifyFounders(request, { id: saved.id, createdAt: saved.createdAt ?? new Date() });
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
      ...(documentRequest ? { documentAvailable: false } : {}),
    });
  };

  app.post("/api/public/investor-requests", inquiryLimiter, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const parsed = investorRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Please provide a name, firm, valid email, valid contact number if supplied, and request type." });
    }
    return saveAndNotify(parsed.data, res);
  });

  app.post("/api/public/investor-document-requests", inquiryLimiter, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const parsed = investorDocumentRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Please provide your first name, a valid email, a valid contact number including country code, and a supported document request. Inquiry must be 1500 characters or fewer." });
    }
    const lead = parsed.data;
    // These files have not been supplied. Capture an honest follow-up request,
    // never return a public URL or imply that a download/email has been delivered.
    return saveAndNotify({
      name: lead.firstName,
      email: lead.email,
      phone: lead.phone,
      inquiry: lead.inquiry,
      firm: "",
      requestType: lead.requestedDocument,
      source: "investors-page",
      requestedDocument: lead.requestedDocument,
      message: `Requested document: ${lead.requestedDocument === "deck"
          ? "OnSpot_Seed_Pitch_Deck.pptx"
          : "OnSpot_Seedscope_Valuation_Summary.pdf"}. Source: investors-page.`,
    }, res, true);
  });
}