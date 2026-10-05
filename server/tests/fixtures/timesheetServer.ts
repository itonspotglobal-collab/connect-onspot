import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { Express, RequestHandler } from "express";
import pg from "pg";
import jwt from "jsonwebtoken";
import { registerTimesheetRoutes } from "../../routes/timesheets";

const url = process.env.TIMESHEET_TEST_DATABASE_URL;
if (!url) throw new Error("Run timesheet tests with: node scripts/test-timesheets-isolated.mjs");
const parsed = new URL(url);
if (parsed.hostname !== "127.0.0.1" || parsed.username !== "timesheet_fixture"
  || parsed.pathname !== "/onspot_timesheet_fixture") {
  throw new Error("Timesheet tests require the explicitly owned disposable PostgreSQL fixture");
}
const pool = new pg.Pool({ connectionString: url });
export const query = (sql: string, params?: any[]) => pool.query(sql, params);
export const closeFixture = () => pool.end();

export async function initializeFixture() {
  await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
    CREATE TABLE users (id varchar PRIMARY KEY, email text UNIQUE, role text,
      first_name text, last_name text, company text, profile_image_url text);
    CREATE TABLE jobs (id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text, client_id varchar REFERENCES users,
      title text, description text, category text, experience_level text, status text,
      engagement_type text, billing_mode text, time_zone text, division text);
    CREATE TABLE job_submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id varchar REFERENCES jobs,
      client_id varchar REFERENCES users, talent_id varchar REFERENCES users, email text,
      applicant_name text, status text, initiated_by text, workflow_type text);
    CREATE TABLE offers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid REFERENCES job_submissions,
      engagement_type text, billing_mode text, rate numeric, rate_currency text, status text, proposed_start_date date);
    CREATE TABLE hiring_contracts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_id uuid REFERENCES offers,
      submission_id uuid REFERENCES job_submissions, status text, talent_signed_at timestamptz,
      onspot_signed_at timestamptz, billing_mode text, effective_start_date date, effective_end_date date,
      created_at timestamptz DEFAULT now());
    CREATE TABLE organizations (id varchar PRIMARY KEY, name text);
    CREATE TABLE organization_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id varchar REFERENCES organizations, user_id varchar REFERENCES users,
      role text, status text, UNIQUE(organization_id, user_id));
    CREATE TABLE profiles (user_id varchar UNIQUE REFERENCES users, first_name text, last_name text,
      profile_picture text, title text, availability text, timezone text, rating numeric);
    CREATE TABLE contracts (id varchar PRIMARY KEY, client_id varchar, talent_id varchar, job_id varchar,
      title text, contract_type text, rate numeric, start_date date, end_date date, status text);
    CREATE TABLE time_entries (contract_id varchar, status text, start_time timestamptz, end_time timestamptz, duration numeric);
    CREATE TABLE invoice_periods (id uuid PRIMARY KEY);
    CREATE TABLE invoices (period_id uuid, hiring_contract_id uuid, currency text, amount numeric, status text);
    CREATE TABLE payments (contract_id varchar, currency text, amount numeric, status text);`);
  // Real Timesheet/Clock DDL, including append-only history triggers.
  const files = ["scripts/migration-reconciliation.sql", "migrations/0019_clock_sessions.sql",
    "migrations/0020_clock_exception_reviews.sql", "migrations/0021_timesheets.sql",
    "migrations/0022_timesheet_revision_timezone.sql"];
  const sql = await Promise.all(files.map((path) => readFile(path, "utf8")));
  const client = await pool.connect();
  try { await client.query(sql.join("\n")); } finally { client.release(); }
}

export async function registerRoutes(app: Express) {
  const authenticateJWT: RequestHandler = (req: any, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer /, "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-fallback-secret") as any;
      req.user = { id: payload.userId, role: payload.role };
      next();
    } catch { res.status(401).json({ error: "Unauthorized" }); }
  };
  const requireRole = (role: string): RequestHandler => (req: any, res, next) =>
    req.user?.role === role ? next() : res.status(403).json({ error: "Forbidden" });
  registerTimesheetRoutes(app, {
    authenticateJWT, requireTalent: requireRole("talent"), requireClient: requireRole("client"),
    requireAdmin: requireRole("admin"), requireAdminSubRole: () => requireRole("admin"),
    getTalentBillingUserId: async (req) => req.user.id,
    query, getClient: () => pool.connect(),
  });
  return createServer(app);
}
