import type { Express, Request, Response, NextFunction } from "express";
import { registerCandidateMediaRoutes } from "./routes/candidateMedia.js";
import { parsePagination, pageSlice } from "./lib/paginate";
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
import { ingestKnowledgeFiles, runLearningLoop } from "./services/learningLoop";
import * as dbManager from "./services/db_manager";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import multer from "multer";
import Papa from "papaparse";
import jwt from "jsonwebtoken";
import { query, db } from "./db.ts";
import { eq, desc, sql as sqlOp } from "drizzle-orm";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";
import { setObjectAclPolicy } from "./objectAcl";
import { v4 as uuidv4 } from "uuid";
import { randomUUID, randomBytes, createHash } from "crypto";
import {
  insertUserSchema,
  insertProfileSchema,
  insertSkillSchema,
  insertUserSkillSchema,
  profiles,
  insertJobSchema,
  insertJobSkillSchema,
  insertProposalSchema,
  insertContractSchema,
  insertMilestoneSchema,
  insertTimeEntrySchema,
  insertMessageThreadSchema,
  insertMessageSchema,
  insertReviewSchema,
  insertPortfolioItemSchema,
  insertCertificationSchema,
  insertPaymentSchema,
  insertDisputeSchema,
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
import { z } from "zod";

// JWT Authentication Types
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
    return `login:${ipKeyGenerator(req)}:${email}`;
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
  keyGenerator: (req) => `signup:${ipKeyGenerator(req)}`,
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
  keyGenerator: (req) => `reset:${ipKeyGenerator(req)}`,
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
  keyGenerator: (req) => `apply:${ipKeyGenerator(req)}`,
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

    const { buildEmailContext, resolveVariables } = await import("./services/emailVariableResolver.ts");
    const ctx = buildEmailContext({
      firstName: row.first_name, lastName: row.last_name,
      applicantName: row.applicant_name, email: row.email, phone: row.phone,
      jobTitle: row.job_title, jobCompany: row.job_company, jobLocation: row.job_location,
      status: row.status, submittedAt: row.submitted_at,
    });
    const resolvedSubject = resolveVariables(tpl.rows[0].subject, ctx).resolved;
    const resolvedBody = resolveVariables(tpl.rows[0].body_html, ctx).resolved;

    const { sendApplicantEmail } = await import("./services/microsoftGraphEmailService.ts");
    const sendResult = await sendApplicantEmail({ to: row.email, subject: resolvedSubject, bodyHtml: resolvedBody });

    await query(
      `INSERT INTO job_application_emails
         (application_id, template_id, subject, body_html, sent_to, status, error_message, is_test)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
      [
        submissionId, tpl.rows[0].id,
        resolvedSubject, resolvedBody, row.email,
        sendResult.success ? "sent" : "failed",
        sendResult.success ? null : sendResult.error,
      ],
    );
  } catch (e: any) {
    console.warn("fireAutoApplicationEmail (non-fatal):", e?.message);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
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

  // ── One-time safe migration: add compensation_type column to jobs table ───────
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS compensation_type text`);
    console.log("✅ Migration: jobs.compensation_type column ready");
  } catch (migErr: any) {
    console.warn("⚠️  compensation_type migration skipped:", migErr.message);
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
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS weekly_hours text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule_flexibility text`);
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_frequency text`);
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

  // ── One-time safe migration: email sender tracking fields ────────────────
  try {
    await query(`ALTER TABLE job_application_emails ADD COLUMN IF NOT EXISTS sender_email text`);
    await query(`ALTER TABLE job_application_emails ADD COLUMN IF NOT EXISTS sender_name text`);
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

  // ── One-time safe migration: 1-Click Apply — application_questions + answers ──
  try {
    await query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_questions jsonb`);
    await query(`ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS answers jsonb`);
    console.log("✅ Migration: jobs.application_questions + job_submissions.answers columns ready");
  } catch (migErr: any) {
    console.warn("⚠️  1-click apply migration skipped:", migErr.message);
  }

  // Protected Dashboard Routes with Role-Based Access Control
  // These routes serve the dashboard content with server-side validation
  app.get(
    "/client-dashboard",
    authenticateJWT,
    requireClient,
    (req: Request, res: Response) => {
      console.log(`🏠 Client dashboard access [${(req as any).requestId}]:`, {
        userId: (req as any).user?.id,
        role: (req as any).user?.role,
      });
      // In a production app, this would render the client dashboard or return appropriate data
      res.json({
        success: true,
        message: "Client dashboard access granted",
        userRole: (req as any).user?.role,
        userId: (req as any).user?.id,
      });
    },
  );

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
  // TODO: Re-add [authenticateJWT, requireAdmin] once the admin login/auth system is complete.
  // Temporarily open to all environments while the login flow is being built.
  const trainCorrectMiddleware: any[] = [];
  
  app.post(
    "/api/train/correct",
    ...trainCorrectMiddleware,
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
  // TODO: Re-add [authenticateJWT, requireAdmin] once the admin login/auth system is complete.
  // Temporarily open to all environments while the login flow is being built.
  const trainChatStreamMiddleware: any[] = [];
  
  app.post(
    "/api/train/chat/stream",
    ...trainChatStreamMiddleware,
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
  // TODO: Re-add [authenticateJWT, requireAdmin] once the admin login/auth system is complete.
  // Temporarily open to all environments while the login flow is being built.
  // NOTE: This triggers a site crawl which is low-risk but should still be protected eventually.
  const siteReindexMiddleware: any[] = [];
  
  app.post("/api/site/reindex", ...siteReindexMiddleware, async (req: any, res) => {
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
        pages: [...pageMap.values()].sort((a, b) => a.url.localeCompare(b.url)),
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
        if (rawHourlyRate || rawRateEngagementType) {
          const prefPatch: Record<string, string> = {};
          if (rawHourlyRate) prefPatch.rateAmount = rawHourlyRate;
          if (rawRateEngagementType) prefPatch.rateEngagementType = rawRateEngagementType;
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
  app.get("/api/talent/applications", authenticateTalentJWT, async (req: any, res) => {
    try {
      const { candidateId, email: jwtEmail } = req.talentAuth;

      // Resolve the candidate's email (authoritative source: candidates table)
      const candRow = await query(
        `SELECT id, email FROM candidates WHERE id = $1 LIMIT 1`,
        [candidateId],
      );
      if (!candRow.rows.length) return res.status(404).json({ error: "Candidate not found" });
      const candidateEmail = candRow.rows[0].email as string;

      // Resolve the linked users.id (talent_id in job_submissions stores users.id)
      const userRow = await query(
        `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
        [candidateEmail],
      );
      const linkedUserId: string | null = userRow.rows[0]?.id ?? null;

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
  app.get("/api/talent/applications/:id/resume", authenticateTalentJWT, async (req: any, res) => {
    try {
      const { candidateId, email: jwtEmail } = req.talentAuth;
      const applicationId = req.params.id;

      // Resolve canonical email from candidates table
      const candRow = await query(
        `SELECT id, email FROM candidates WHERE id = $1 LIMIT 1`,
        [candidateId],
      );
      if (!candRow.rows.length) return res.status(404).json({ error: "Candidate not found" });
      const candidateEmail = candRow.rows[0].email as string;

      // Resolve linked users.id
      const userRow = await query(
        `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
        [candidateEmail],
      );
      const linkedUserId: string | null = userRow.rows[0]?.id ?? null;

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
  app.patch("/api/talent/applications/:id/withdraw", authenticateTalentJWT, async (req: any, res) => {
    try {
      const { candidateId, email: jwtEmail } = req.talentAuth;
      const applicationId = req.params.id;

      // Resolve the candidate's email
      const candRow = await query(
        `SELECT id, email FROM candidates WHERE id = $1 LIMIT 1`,
        [candidateId],
      );
      if (!candRow.rows.length) return res.status(404).json({ error: "Candidate not found" });
      const candidateEmail = candRow.rows[0].email as string;

      // Resolve linked users.id
      const userRow = await query(
        `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
        [candidateEmail],
      );
      const linkedUserId: string | null = userRow.rows[0]?.id ?? null;

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

      console.log(`✅ Talent ${candidateEmail} withdrew application ${applicationId}`);
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

  // Mask a combined name string to "FirstName LastInitial." for public display.
  // "Maria Eubhe Regine Tantog" → "Maria T."
  // "John Smith" → "John S."
  // "Cher" → "Cher"
  function maskPublicName(name: string | null | undefined): string {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    const first = parts[0];
    if (parts.length === 1) return first;
    const lastToken = parts[parts.length - 1];
    const initial = lastToken.replace(/\./g, "").charAt(0).toUpperCase();
    return initial ? `${first} ${initial}.` : first;
  }

  // Public-safe candidate: strips contact fields and masks the name.
  // Used whenever the requester is NOT the owner or an admin/TA.
  function publicSanitizeCandidate(c: any) {
    const { passwordHash: _ph, email: _e, phone: _ph2, userId: _uid, ...safe } = c;
    const rawName = (c.displayName?.trim() || c.fullName?.trim() || "");
    const maskedName = maskPublicName(rawName);
    return {
      ...safe,
      fullName: maskedName,
      displayName: maskedName,
      firstName: maskedName ? maskedName.split(" ")[0] : "",
      lastName: "",   // never expose surname to non-privileged viewers
      email: null,    // explicitly null so UI never tries to render it
      phone: null,
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
      // Internal staff
      if (decoded.userId && ["admin", "talent_acquisition"].includes(decoded.role)) return true;
      // Candidate JWT owner
      if (decoded.type === "candidate" && decoded.candidateId === candidateId) return true;
      // Talent user JWT owner (email match)
      if (decoded.role === "talent" && decoded.email && candidateEmail) {
        return decoded.email.toLowerCase() === candidateEmail.toLowerCase();
      }
    } catch { /* invalid/expired token → not privileged */ }
    return false;
  }

  app.get("/api/candidates", async (req: any, res) => {
    try {
      const { page, pageSize } = parsePagination(req.query);
      const all = await storage.getCandidates();
      // Admin/TA get full data; everyone else gets public-safe records
      const token = (req.headers["authorization"] ?? "").split(" ")[1];
      let callerIsPrivileged = false;
      if (token) {
        try {
          const jwtSecret = process.env.JWT_SECRET || "dev-fallback-secret";
          const decoded: any = jwt.verify(token, jwtSecret);
          callerIsPrivileged = decoded.userId && ["admin", "talent_acquisition"].includes(decoded.role);
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

  app.get("/api/candidates/:id", async (req: any, res) => {
    try {
      const candidate = await storage.getCandidate(req.params.id);
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });
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
      const isStaffUser = decoded.userId && ["admin", "talent_acquisition", "client"].includes(decoded.role);

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
      if (body.summary        !== undefined) candidateUpdates.summary        = body.summary        || null;
      if (body.moreAboutMe    !== undefined) candidateUpdates.moreAboutMe    = body.moreAboutMe    || null;
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

  // GET /api/candidates/me — find the candidate record for the authenticated talent user by email.
  // Returns the same full DTO as GET /api/candidates/:id so all pages compute an identical
  // completion percentage regardless of which endpoint they use.
  app.get("/api/candidates/me", authenticateJWT, async (req: any, res) => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail) return res.status(400).json({ error: "No email on authenticated user" });
      const result = await query(
        `SELECT id,
                display_name        AS "displayName",
                full_name           AS "fullName",
                first_name          AS "firstName",
                last_name           AS "lastName",
                email, phone, location,
                target_position     AS "targetPosition",
                headline,
                category,
                experience_years    AS "experienceYears",
                seniority,
                core_skills         AS "coreSkills",
                secondary_skills    AS "secondarySkills",
                work_history        AS "workHistory",
                education,
                preferences,
                summary,
                profile_photo_url   AS "profilePhotoUrl",
                resume_url          AS "resumeUrl",
                resume_file_name    AS "resumeFileName",
                linkedin_url        AS "linkedinUrl",
                portfolio_url       AS "portfolioUrl",
                profile_completed   AS "profileCompleted",
                culture_score       AS "cultureScore",
                availability,
                values_answers      AS "valuesAnswers",
                created_at          AS "createdAt",
                updated_at          AS "updatedAt"
         FROM candidates WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [userEmail],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "No candidate profile found" });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("GET /api/candidates/me error:", error);
      res.status(500).json({ error: "Failed to fetch candidate" });
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
      } else if (decoded.role === "admin" || decoded.role === "talent_acquisition") {
        // admins can access any resume
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
      } else if (decoded.role === "admin" || decoded.role === "talent_acquisition") {
        // Admins/talent_acquisition can view any candidate video
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
         WHERE status = 'open' AND approval_status = 'approved'
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
      // Only publicly expose approved + open/published jobs
      const approval = (jobWithSkills as any).approvalStatus;
      const isApproved = approval === "approved" || approval == null;
      const isOpen = jobWithSkills.status === "open" || jobWithSkills.status === "published";
      if (!isApproved || !isOpen) {
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
        // Guard: published jobs must have a valid engagement type
        const effectiveStatus = req.body.status ?? "open";
        if (["open", "published"].includes(effectiveStatus) && !["Half-Day", "Full-Time"].includes(req.body.engagementType)) {
          return res.status(400).json({
            error: "Engagement Type required",
            message: "An Engagement Type (Half-Day or Full-Time) must be set before publishing a job.",
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

      // Guard: published jobs must have a valid engagement type
      const existingJob = await storage.getJob(req.params.id);
      const effectiveStatus = updates.status ?? existingJob?.status;
      const effectiveEngagementType =
        "engagementType" in updates ? updates.engagementType : existingJob?.engagementType;
      if (
        ["open", "published"].includes(effectiveStatus as string) &&
        !["Half-Day", "Full-Time"].includes(effectiveEngagementType as string)
      ) {
        return res.status(400).json({
          error: "Engagement Type required",
          message: "An Engagement Type (Half-Day or Full-Time) must be set before publishing a job.",
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
  app.get("/api/admin/jobs", async (req: Request, res: Response) => {
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
  app.get("/api/admin/jobs/options", async (req: Request, res: Response) => {
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

  app.post("/api/admin/jobs", async (req: Request, res: Response) => {
    try {
      // Find an admin user to use as the clientId (avoids FK constraint violation)
      const adminUsers = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.role, "admin"))
        .limit(1);

      let clientId: string | undefined =
        adminUsers.length > 0 ? adminUsers[0].id : undefined;

      // Fall back to any existing user if no admin user found
      if (!clientId) {
        const anyUser = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .limit(1);
        clientId = anyUser.length > 0 ? anyUser[0].id : undefined;
      }

      if (!clientId) {
        return res.status(500).json({
          error: "Job creation failed",
          message: "No users found in database. At least one user is required to create a job.",
        });
      }

      // Admin-created jobs start as pending and require approval before going public
      const body = { ...req.body, clientId, approvalStatus: "pending" };
      console.log("Admin job create - request body:", JSON.stringify(body));

      // Guard: published jobs must have a valid engagement type
      const effectiveStatus = body.status ?? "open";
      if (["open", "published"].includes(effectiveStatus) && !["Half-Day", "Full-Time"].includes(body.engagementType)) {
        return res.status(400).json({
          error: "Engagement Type required",
          message: "An Engagement Type (Half-Day or Full-Time) must be set before publishing a job.",
        });
      }

      const validated = insertJobSchema.parse(body);
      const job = await storage.createJob(validated);
      res.status(201).json(job);
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

  app.patch("/api/admin/jobs/:id", async (req: Request, res: Response) => {
    try {
      const { clientId, ...rest } = req.body;
      const updates = insertJobSchema.partial().parse(rest);

      // Guard: published jobs must have a valid engagement type
      const existingJob = await storage.getJob(req.params.id);
      const effectiveStatus = updates.status ?? existingJob?.status;
      const effectiveEngagementType =
        "engagementType" in updates ? updates.engagementType : existingJob?.engagementType;
      if (
        ["open", "published"].includes(effectiveStatus as string) &&
        !["Half-Day", "Full-Time"].includes(effectiveEngagementType as string)
      ) {
        return res.status(400).json({
          error: "Engagement Type required",
          message: "An Engagement Type (Half-Day or Full-Time) must be set before publishing a job.",
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

  app.patch("/api/admin/jobs/:id/status", async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!status || !["open", "closed", "cancelled"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be 'open', 'closed', or 'cancelled'" });
      }
      // Guard: published jobs must have a valid engagement type
      if (["open", "published"].includes(status)) {
        const existingJob = await storage.getJob(req.params.id);
        if (!existingJob || !["Half-Day", "Full-Time"].includes(existingJob.engagementType as string)) {
          return res.status(400).json({
            error: "Engagement Type required",
            message: "An Engagement Type (Half-Day or Full-Time) must be set before publishing a job.",
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

  app.post("/api/admin/jobs/:id/refresh", async (req: Request, res: Response) => {
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

  app.delete("/api/admin/jobs/:id", async (req: Request, res: Response) => {
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
  // No auth guard yet — spec: anyone with /admin/find-work access may approve.
  // Structured for future approvedBy/approvedAt multi-admin tracking (fields already in schema).
  app.post("/api/admin/jobs/:id/approve", async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.id;
      // Guard: published jobs must have a valid engagement type
      const jobToApprove = await storage.getJob(req.params.id);
      if (!jobToApprove) return res.status(404).json({ error: "Job not found" });
      if (!["Half-Day", "Full-Time"].includes(jobToApprove.engagementType as string)) {
        return res.status(400).json({
          error: "Engagement Type required",
          message: "An Engagement Type (Half-Day or Full-Time) must be set before approving a job.",
        });
      }
      const result = await query(
        `UPDATE jobs SET
          approval_status = 'approved',
          status = 'open',
          approved_by = $1,
          approved_at = NOW(),
          posted_at = COALESCE(posted_at, NOW()),
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [adminId, req.params.id],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Job not found" });
      res.json(result.rows[0]);
      import("./services/ragService")
        .then(({ indexJobListings }) => indexJobListings())
        .catch((err: any) => console.error("❌ Background job reindex failed:", err.message));
    } catch (error) {
      console.error("Admin job approve error:", error);
      res.status(500).json({ error: "Failed to approve job" });
    }
  });

  // ─── Admin: Reject a job posting ──────────────────────────────────────────
  // No auth guard yet — spec: anyone with /admin/find-work access may decline.
  app.post("/api/admin/jobs/:id/reject", async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.id;
      const { rejectionReason } = req.body;
      const result = await query(
        `UPDATE jobs SET
          approval_status = 'rejected',
          rejected_by = $1,
          rejected_at = NOW(),
          rejection_reason = $2,
          approved_by = NULL,
          approved_at = NULL,
          updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [adminId, rejectionReason || null, req.params.id],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Job not found" });
      res.json(result.rows[0]);
      import("./services/ragService")
        .then(({ indexJobListings }) => indexJobListings())
        .catch((err: any) => console.error("❌ Background job reindex failed:", err.message));
    } catch (error) {
      console.error("Admin job reject error:", error);
      res.status(500).json({ error: "Failed to reject job" });
    }
  });

  // ─── Admin: Link a client job to an existing approved job ────────────────
  // No auth guard yet — consistent with approve/reject policy above.
  app.post("/api/admin/jobs/:id/link", async (req: Request, res: Response) => {
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

  // ─── Admin: Move approved/rejected job back to pending ────────────────────
  // No auth guard yet — consistent with approve/reject policy above.
  app.post("/api/admin/jobs/:id/pending", async (req: Request, res: Response) => {
    try {
      const result = await query(
        `UPDATE jobs SET
          approval_status = 'pending',
          approved_by = NULL,
          approved_at = NULL,
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [req.params.id],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Job not found" });
      res.json(result.rows[0]);
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

  // ====== PROPOSALS ======
  app.get("/api/proposals/:id", async (req, res) => {
    try {
      const proposal = await storage.getProposal(req.params.id);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      res.json(proposal);
    } catch (error) {
      res.status(500).json({ error: "Failed to get proposal" });
    }
  });

  app.post("/api/proposals", isAuthenticated, async (req: any, res) => {
    try {
      // Get authenticated user ID from trusted session
      const talentId = req.user.claims.sub;

      if (!talentId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Create proposal data with server-derived talentId (ignore any client-supplied talentId)
      const proposalData = {
        ...req.body,
        talentId, // Override any client-supplied talentId with server-derived value
      };

      const validated = insertProposalSchema.parse(proposalData);
      const proposal = await storage.createProposal(validated);
      res.status(201).json(proposal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      // Handle unique constraint violation for duplicate proposals
      if (
        error instanceof Error &&
        error.message.includes("unique") &&
        error.message.includes("proposals_job_talent")
      ) {
        return res
          .status(409)
          .json({
            error: "You have already submitted a proposal for this job",
          });
      }
      res.status(500).json({ error: "Failed to create proposal" });
    }
  });

  app.patch("/api/proposals/:id", async (req, res) => {
    try {
      const updates = insertProposalSchema.partial().parse(req.body);
      const proposal = await storage.updateProposal(req.params.id, updates);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      res.json(proposal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update proposal" });
    }
  });

  app.get("/api/jobs/:jobId/proposals", async (req, res) => {
    try {
      const proposals = await storage.listProposalsByJob(req.params.jobId);
      res.json(proposals);
    } catch (error) {
      res.status(500).json({ error: "Failed to get job proposals" });
    }
  });

  app.get(
    "/api/talents/:talentId/proposals",
    isAuthenticated,
    async (req: any, res) => {
      try {
        // SECURITY: Use authenticated user ID from session, not URL parameter
        // This prevents user enumeration and unauthorized access to proposals
        const authenticatedUserId = req.user.claims.sub;

        if (!authenticatedUserId) {
          return res.status(401).json({ error: "Authentication required" });
        }

        // Only return proposals for the authenticated user (ignore URL parameter)
        const proposals =
          await storage.listProposalsByTalent(authenticatedUserId);
        res.json(proposals);
      } catch (error) {
        res.status(500).json({ error: "Failed to get talent proposals" });
      }
    },
  );

  // ====== CONTRACTS (Phase 2 Priority) ======
  app.get("/api/contracts/:id", async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      res.status(500).json({ error: "Failed to get contract" });
    }
  });

  app.post("/api/contracts", async (req, res) => {
    try {
      const validated = insertContractSchema.parse(req.body);
      const contract = await storage.createContract(validated);
      res.status(201).json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create contract" });
    }
  });

  app.patch("/api/contracts/:id", async (req, res) => {
    try {
      const updates = insertContractSchema.partial().parse(req.body);
      const contract = await storage.updateContract(req.params.id, updates);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update contract" });
    }
  });

  app.get("/api/clients/:clientId/contracts", async (req, res) => {
    try {
      const contracts = await storage.listContractsByClient(
        req.params.clientId,
      );
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get client contracts" });
    }
  });

  app.get("/api/talents/:talentId/contracts", async (req, res) => {
    try {
      const contracts = await storage.listContractsByTalent(
        req.params.talentId,
      );
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get talent contracts" });
    }
  });

  // ====== MESSAGES (Phase 1 Priority) ======
  app.get("/api/message-threads/:id", async (req, res) => {
    try {
      const thread = await storage.getMessageThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      res.json(thread);
    } catch (error) {
      res.status(500).json({ error: "Failed to get message thread" });
    }
  });

  app.post("/api/message-threads", async (req, res) => {
    try {
      const validated = insertMessageThreadSchema.parse(req.body);
      const thread = await storage.createMessageThread(validated);
      res.status(201).json(thread);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create message thread" });
    }
  });

  app.get("/api/users/:userId/message-threads", async (req, res) => {
    try {
      const threads = await storage.listMessageThreadsByUser(req.params.userId);
      res.json(threads);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user message threads" });
    }
  });

  app.get("/api/message-threads/:threadId/messages", async (req, res) => {
    try {
      const messages = await storage.listMessagesByThread(req.params.threadId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to get thread messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const validated = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(validated);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  app.post("/api/message-threads/:threadId/mark-read", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }
      await storage.markMessagesAsRead(req.params.threadId, userId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  // ====== ADDITIONAL ROUTES (Stubs for Phase 2+) ======

  // Milestones
  app.get("/api/contracts/:contractId/milestones", async (req, res) => {
    try {
      const milestones = await storage.listMilestonesByContract(
        req.params.contractId,
      );
      res.json(milestones);
    } catch (error) {
      res.status(500).json({ error: "Failed to get contract milestones" });
    }
  });

  app.post("/api/milestones", async (req, res) => {
    try {
      const validated = insertMilestoneSchema.parse(req.body);
      const milestone = await storage.createMilestone(validated);
      res.status(201).json(milestone);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create milestone" });
    }
  });

  // Time Entries
  app.get("/api/contracts/:contractId/time-entries", async (req, res) => {
    try {
      const entries = await storage.listTimeEntriesByContract(
        req.params.contractId,
      );
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to get time entries" });
    }
  });

  app.post("/api/time-entries", async (req, res) => {
    try {
      const validated = insertTimeEntrySchema.parse(req.body);
      const entry = await storage.createTimeEntry(validated);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create time entry" });
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

  // Notifications
  app.get("/api/users/:userId/notifications", async (req, res) => {
    try {
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

  app.post("/api/notifications", async (req, res) => {
    try {
      const validated = insertNotificationSchema.parse(req.body);
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

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const success = await storage.markNotificationAsRead(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
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
  app.get("/api/admin/posts", async (req: Request, res: Response) => {
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
  app.post("/api/admin/posts", async (req: Request, res: Response) => {
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
  app.get("/api/admin/posts/:id", async (req: Request, res: Response) => {
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
  app.put("/api/admin/posts/:id", async (req: Request, res: Response) => {
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
  app.delete("/api/admin/posts/:id", async (req: Request, res: Response) => {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  app.get("/api/client-profile/me", authenticateJWT, async (req: Request, res: Response) => {
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

  app.put("/api/client-profile/me", authenticateJWT, async (req: Request, res: Response) => {
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
  app.get("/api/client/jobs", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const r = await query(
        `SELECT j.*,
          j.proposal_count AS "proposalCount"
         FROM jobs j
         WHERE j.client_id = $1
         ORDER BY j.created_at DESC`,
        [userId],
      );
      return res.json(r.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/client/jobs", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      // Client-created jobs always start as pending approval
      const body = { ...req.body, clientId: userId, approvalStatus: "pending", isClientSubmitted: true };

      // Guard: published jobs must have a valid engagement type
      const effectiveStatus = body.status ?? "open";
      if (["open", "published"].includes(effectiveStatus) && !["Half-Day", "Full-Time"].includes(body.engagementType)) {
        return res.status(400).json({
          error: "Engagement Type required",
          message: "An Engagement Type (Half-Day or Full-Time) must be set before publishing a job.",
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

  app.patch("/api/client/jobs/:jobId", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { jobId } = req.params;
      // Ownership check
      const check = await query("SELECT id, approval_status FROM jobs WHERE id = $1 AND client_id = $2", [jobId, userId]);
      if (check.rows.length === 0) return res.status(403).json({ error: "Forbidden" });
      const { clientId: _strip, ...rest } = req.body;
      const updates = insertJobSchema.partial().parse(rest);

      // Guard: published jobs must have a valid engagement type
      const existingJob = await storage.getJob(jobId);
      const effectiveStatus = updates.status ?? existingJob?.status;
      const effectiveEngagementType =
        "engagementType" in updates ? updates.engagementType : existingJob?.engagementType;
      if (
        ["open", "published"].includes(effectiveStatus as string) &&
        !["Half-Day", "Full-Time"].includes(effectiveEngagementType as string)
      ) {
        return res.status(400).json({
          error: "Engagement Type required",
          message: "An Engagement Type (Half-Day or Full-Time) must be set before publishing a job.",
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

  app.patch("/api/client/jobs/:jobId/status", authenticateJWT, async (req: Request, res: Response) => {
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
        if (!existingJob || !["Half-Day", "Full-Time"].includes(existingJob.engagementType as string)) {
          return res.status(400).json({
            error: "Engagement Type required",
            message: "An Engagement Type (Half-Day or Full-Time) must be set before publishing a job.",
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

  app.delete("/api/client/jobs/:jobId", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { jobId } = req.params;
      const r = await query(
        "UPDATE jobs SET status = 'closed', updated_at = NOW() WHERE id = $1 AND client_id = $2 RETURNING id",
        [jobId, userId],
      );
      if (r.rows.length === 0) return res.status(403).json({ error: "Forbidden" });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
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
          await setObjectAclPolicy(objectFile, { visibility: "private" });
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
          await setObjectAclPolicy(objectVideoFile, { visibility: "private" });
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
              status, registration_status, talent_id, is_repeat_application, answers)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'submitted', 'linked', $13, $14, $15)
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
            status, registration_status, is_repeat_application, answers)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'submitted', $13, $14, $15)
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
        ],
      );
      const submissionId = insertResult.rows[0].id;

      // Non-blocking: fire application-received email — must not affect response
      fireAutoApplicationEmail(submissionId);

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
  app.get("/api/admin/job-applications/summary", maybeAuthenticateAdmin, async (req: Request, res: Response) => {
    try {

      const [byStatus, byReg, total] = await Promise.all([
        query(`SELECT status, COUNT(*) AS count FROM job_submissions GROUP BY status`),
        query(`SELECT registration_status, COUNT(*) AS count FROM job_submissions GROUP BY registration_status`),
        query(`SELECT COUNT(*) AS count FROM job_submissions`),
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
  app.get("/api/admin/job-applications", maybeAuthenticateAdmin, async (req: Request, res: Response) => {
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

      const conditions: string[] = [];
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
  app.get("/api/admin/job-applications/:applicationId", maybeAuthenticateAdmin, async (req: Request, res: Response) => {
    try {

      const { applicationId } = req.params;
      const [appResult, histResult] = await Promise.all([
        query(
          `SELECT js.id, js.job_id AS "jobId", js.first_name AS "firstName", js.last_name AS "lastName",
                  js.applicant_name AS "applicantName", js.email, js.phone, js.cover_letter AS "coverLetter",
                  js.status, js.registration_status AS "registrationStatus",
                  js.talent_id AS "talentId", js.submitted_at AS "submittedAt", js.updated_at AS "updatedAt",
                  js.is_repeat_application AS "isRepeatApplication",
                  js.resume_url AS "appResumeUrl", js.resume_file_name AS "appResumeFileName",
                  js.video_introduction_url AS "videoIntroductionUrl",
                  js.video_introduction_file_name AS "videoIntroductionFileName",
                  j.title AS "jobTitle", j.company AS "jobCompany",
                  u.first_name AS "talentFirstName", u.last_name AS "talentLastName",
                  c.id AS "candidateId",
                  c.resume_url AS "candidateResumeUrl", c.resume_file_name AS "candidateResumeFileName"
           FROM job_submissions js
           JOIN jobs j ON j.id = js.job_id
           LEFT JOIN users u ON u.id = js.talent_id
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
           WHERE js.id = $1`,
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
  app.get("/api/admin/job-applications/:applicationId/resume", maybeAuthenticateAdmin, async (req: Request, res: Response) => {
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
  app.get("/api/admin/job-applications/:applicationId/video", maybeAuthenticateAdmin, async (req: Request, res: Response) => {
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
  app.post("/api/admin/job-applications/:applicationId/resume", maybeAuthenticateAdmin, upload.single("resume"), async (req: any, res: Response) => {
    try {
      const { applicationId } = req.params;

      // Verify application exists
      const existing = await query(`SELECT id FROM job_submissions WHERE id = $1`, [applicationId]);
      if (existing.rows.length === 0) return res.status(404).json({ error: "Application not found" });

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
      await setObjectAclPolicy(objectFile, { visibility: "private" });

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
  app.patch("/api/admin/job-applications/:applicationId/status", maybeAuthenticateAdmin, async (req: Request, res: Response) => {
    try {
      const changedBy: string | null = (req as any).user?.id ?? null;

      const { applicationId } = req.params;
      const { status, note } = req.body ?? {};

      const VALID_STATUSES = ["submitted", "under_review", "shortlisted", "interview", "offered", "hired", "rejected", "withdrawn"];
      if (!status || !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Valid values: ${VALID_STATUSES.join(", ")}` });
      }

      // Fetch existing application (confirm it exists and get current status)
      const existing = await query(`SELECT id, status FROM job_submissions WHERE id = $1`, [applicationId]);
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
        return res.json({ success: true, application: updated.rows[0] });
      } catch (txErr) {
        await query("ROLLBACK");
        throw txErr;
      }
    } catch (err: any) {
      console.error("PATCH /api/admin/job-applications/:id/status error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/admin/job-applications/:applicationId — delete a single application submission (admin only)
  app.delete("/api/admin/job-applications/:applicationId", maybeAuthenticateAdmin, async (req: Request, res: Response) => {
    try {
      const { applicationId } = req.params;
      if (!applicationId) return res.status(400).json({ error: "applicationId is required" });

      // Confirm the application exists
      const existing = await query(
        `SELECT id FROM job_submissions WHERE id = $1`,
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
  app.patch("/api/admin/job-applications/:id", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id || user.role !== "admin") return res.status(403).json({ error: "Forbidden" });

      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ["new", "reviewed", "shortlisted", "rejected", "hired"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be one of: new, reviewed, shortlisted, rejected, hired" });
      }

      const result = await query(
        `UPDATE job_submissions SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, id],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Application not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("PATCH /api/admin/job-applications/:id error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/client/job-submissions — list submissions for all jobs posted by the authenticated client
  app.get("/api/client/job-submissions", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const result = await query(
        `SELECT js.*, j.title AS "jobTitle", j.company AS "jobCompany"
         FROM job_submissions js
         JOIN jobs j ON j.id = js.job_id
         WHERE js.client_id = $1
         ORDER BY js.submitted_at DESC`,
        [userId],
      );
      return res.json(result.rows);
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
      const result = await query(
        `SELECT js.*, j.title AS "jobTitle", j.company AS "jobCompany"
         FROM job_submissions js
         JOIN jobs j ON j.id = js.job_id
         WHERE js.id = $1 AND js.client_id = $2`,
        [id, userId],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Submission not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/client/job-submissions/:id/status — update submission status
  app.patch("/api/client/job-submissions/:id/status", authenticateJWT, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ["new", "reviewed", "shortlisted", "rejected", "hired"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be: new, reviewed, shortlisted, rejected, hired" });
      }
      const result = await query(
        `UPDATE job_submissions SET status = $1, updated_at = NOW()
         WHERE id = $2 AND client_id = $3
         RETURNING *`,
        [status, id, userId],
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Submission not found or forbidden" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
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

  const httpServer = createServer(app);
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
  app.get("/api/admin/email-templates", authenticateAdminFlexible, requireAdmin, async (req: any, res: Response) => {
    try {
      const includeArchived = req.query.archived === "true";
      const result = await query(
        `SELECT id, name, subject, category, stage, is_published AS "isPublished",
                is_default AS "isDefault", is_archived AS "isArchived",
                variables, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM applicant_email_templates
         ${includeArchived ? "" : "WHERE is_archived = false"}
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
  app.get("/api/admin/email-templates/:id", authenticateAdminFlexible, requireAdmin, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT id, name, subject, body_html AS "bodyHtml", category, stage,
                is_published AS "isPublished", is_default AS "isDefault",
                is_archived AS "isArchived", variables,
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM applicant_email_templates WHERE id = $1`,
        [id],
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

  // ── Application Email Routes ──────────────────────────────────────────────────
  // TODO: Protect all application email routes with admin authorization before production.

  // POST /api/admin/job-applications/:id/email/preview — resolve variables, return HTML
  app.post("/api/admin/job-applications/:id/email/preview", authenticateAdminFlexible, requireAdmin, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { templateId, subject, bodyHtml } = req.body;

      // Load application + job
      const appRow = await query(
        `SELECT js.first_name, js.last_name, js.applicant_name, js.email, js.phone,
                js.status, js.submitted_at,
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

      const { buildEmailContext, resolveVariables } = await import("./services/emailVariableResolver.ts");
      const ctx = buildEmailContext({
        firstName: app_.first_name, lastName: app_.last_name,
        applicantName: app_.applicant_name, email: app_.email, phone: app_.phone,
        jobTitle: app_.job_title, jobCompany: app_.job_company, jobLocation: app_.job_location,
        status: app_.status, submittedAt: app_.submitted_at,
      });

      const subjectResult = resolveVariables(subjectRaw ?? "", ctx);
      const bodyResult = resolveVariables(bodyRaw, ctx);

      return res.json({
        subject: subjectResult.resolved,
        bodyHtml: bodyResult.resolved,
        unresolvedKeys: [...new Set([...subjectResult.unresolvedKeys, ...bodyResult.unresolvedKeys])],
      });
    } catch (err: any) {
      console.error("POST /api/admin/job-applications/:id/email/preview error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/admin/job-applications/:id/email/test — send a test email (prefixes subject with [TEST])
  app.post("/api/admin/job-applications/:id/email/test", maybeAuthenticateAdmin, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { templateId, subject, bodyHtml, testRecipient } = req.body;
      if (!testRecipient?.trim()) return res.status(400).json({ error: "testRecipient is required for test sends" });

      const appRow = await query(
        `SELECT js.first_name, js.last_name, js.applicant_name, js.email, js.phone,
                js.status, js.submitted_at,
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

      const { buildEmailContext, resolveVariables } = await import("./services/emailVariableResolver.ts");
      const ctx = buildEmailContext({
        firstName: app_.first_name, lastName: app_.last_name,
        applicantName: app_.applicant_name, email: app_.email, phone: app_.phone,
        jobTitle: app_.job_title, jobCompany: app_.job_company, jobLocation: app_.job_location,
        status: app_.status, submittedAt: app_.submitted_at,
      });
      const resolvedSubject = `[TEST] ${resolveVariables(subjectRaw ?? "", ctx).resolved}`;
      const resolvedBody = resolveVariables(bodyRaw, ctx).resolved;

      const { sendApplicantEmail } = await import("./services/microsoftGraphEmailService.ts");
      const sendResult = await sendApplicantEmail({
        to: testRecipient.trim(),
        subject: resolvedSubject,
        bodyHtml: resolvedBody,
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

  // POST /api/admin/job-applications/:id/email/send — send email + optionally update stage
  // TODO: Protect with admin authorization before production.
  app.post("/api/admin/job-applications/:id/email/send", maybeAuthenticateAdmin, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { templateId, subject, bodyHtml, updateStage, senderEmail: rawSenderEmail } = req.body;
      // Derive sentBy from the authenticated admin — never trust the request body for audit integrity
      const sentBy: string | null = req.user?.id ?? null;

      // Validate senderEmail against server-side allowlist — backend is the source of truth
      const { ALLOWED_SENDERS: SENDER_ALLOWLIST } = await import("./services/microsoftGraphEmailService.ts");
      const resolvedSenderEmail: string =
        rawSenderEmail && SENDER_ALLOWLIST[rawSenderEmail]
          ? rawSenderEmail
          : "careers@onspotglobal.com";
      const resolvedSenderName: string = SENDER_ALLOWLIST[resolvedSenderEmail] ?? "OnSpot Careers";

      console.log(`[send-email] Request reached send-email endpoint — applicationId=${id} sender=${resolvedSenderEmail} updateStage=${updateStage ?? "none"} bypass=${BYPASS_ADMIN_AUTH}`);

      // Always load email from DB — never trust browser-supplied recipient
      const appRow = await query(
        `SELECT js.id, js.first_name, js.last_name, js.applicant_name, js.email, js.phone,
                js.status, js.submitted_at,
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
      let resolvedTemplateId = templateId ?? null;

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
      if (!subjectRaw) return res.status(400).json({ error: "subject is required" });

      const { buildEmailContext, resolveVariables } = await import("./services/emailVariableResolver.ts");
      const ctx = buildEmailContext({
        firstName: app_.first_name, lastName: app_.last_name,
        applicantName: app_.applicant_name, email: app_.email, phone: app_.phone,
        jobTitle: app_.job_title, jobCompany: app_.job_company, jobLocation: app_.job_location,
        status: app_.status, submittedAt: app_.submitted_at,
      });
      const resolvedSubject = resolveVariables(subjectRaw, ctx).resolved;
      const resolvedBody = resolveVariables(bodyRaw, ctx).resolved;

      const { sendApplicantEmail } = await import("./services/microsoftGraphEmailService.ts");
      console.log(`[send-email] Email provider request started — to=${app_.email} from=${resolvedSenderEmail} subject="${resolvedSubject.slice(0, 60)}"`);
      const sendResult = await sendApplicantEmail({
        to: app_.email,
        subject: resolvedSubject,
        bodyHtml: resolvedBody,
        senderEmail: resolvedSenderEmail,
      });
      console.log(`[send-email] Email provider response — success=${sendResult.success}${sendResult.error ? ` error="${sendResult.error}"` : ""}`);

      const emailStatus = sendResult.success ? "sent" : "failed";
      const emailErr = sendResult.success ? null : sendResult.error;

      // Log the email attempt
      await query(
        `INSERT INTO job_application_emails
           (application_id, template_id, subject, body_html, sent_to, sent_by, sender_email, sender_name, status, error_message, is_test)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)`,
        [id, resolvedTemplateId, resolvedSubject, resolvedBody, app_.email, sentBy ?? null, resolvedSenderEmail, resolvedSenderName, emailStatus, emailErr],
      );

      // Optionally update application stage — failure here must not block email response
      if (updateStage && sendResult.success) {
        try {
          await query(
            `UPDATE job_submissions SET status = $1, updated_at = NOW() WHERE id = $2`,
            [updateStage, id],
          );
          await query(
            `INSERT INTO job_application_status_history
               (application_id, previous_status, new_status, note, changed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, app_.status, updateStage, "Stage updated via email send", sentBy ?? null],
          );
        } catch (stageErr: any) {
          console.warn("Email send: stage update failed (non-fatal):", stageErr.message);
        }
      }

      if (!sendResult.success) {
        return res.status(502).json({ error: `Email delivery failed: ${sendResult.error}` });
      }
      return res.json({ success: true, sentTo: app_.email });
    } catch (err: any) {
      console.error("POST /api/admin/job-applications/:id/email/send error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/admin/job-applications/:id/email/history — list sent emails for an application
  app.get("/api/admin/job-applications/:id/email/history", maybeAuthenticateAdmin, async (req: any, res: Response) => {
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
  app.post("/api/admin/job-applications/:id/email/:emailId/retry", maybeAuthenticateAdmin, async (req: any, res: Response) => {
    try {
      const { id, emailId } = req.params;
      const emailRow = await query(
        `SELECT * FROM job_application_emails WHERE id = $1 AND application_id = $2`,
        [emailId, id],
      );
      if (emailRow.rows.length === 0) return res.status(404).json({ error: "Email record not found" });
      const prev = emailRow.rows[0];

      // Reload recipient from DB
      const appRow = await query(
        `SELECT email FROM job_submissions WHERE id = $1`, [id],
      );
      if (appRow.rows.length === 0) return res.status(404).json({ error: "Application not found" });

      const { sendApplicantEmail } = await import("./services/microsoftGraphEmailService.ts");
      const sendResult = await sendApplicantEmail({
        to: appRow.rows[0].email,
        subject: prev.subject,
        bodyHtml: prev.body_html,
        senderEmail: prev.sender_email ?? undefined,
      });

      const newStatus = sendResult.success ? "sent" : "failed";
      await query(
        `INSERT INTO job_application_emails
           (application_id, template_id, subject, body_html, sent_to, sent_by, sender_email, sender_name, status, error_message, is_test)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)`,
        [id, prev.template_id, prev.subject, prev.body_html,
         appRow.rows[0].email, prev.sent_by,
         prev.sender_email ?? null, prev.sender_name ?? null,
         newStatus, sendResult.success ? null : sendResult.error],
      );

      if (!sendResult.success) {
        return res.status(502).json({ error: `Retry failed: ${sendResult.error}` });
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.error("POST /api/admin/job-applications/:id/email/:emailId/retry error:", err);
      return res.status(500).json({ error: "Internal server error" });
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
    const BLOCKED = ["/admin", "/client-dashboard", "/talent-portal", "/api/"];
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
