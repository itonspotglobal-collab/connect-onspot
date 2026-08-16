import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import * as Sentry from "@sentry/node";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./replitAuth";
import { ogMiddleware } from "./ogMiddleware";
import { query } from "./db";

// Extend Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const app = express();

// Trust the first proxy in Replit's deployment chain so req.ip resolves
// correctly for rate-limiting (Replit sits behind a load-balancer / reverse proxy).
app.set('trust proxy', 1);

// ── Permanent page redirects (must be FIRST — before all other middleware) ──
// /talent-portal/applications is the old URL; /my-applications is the correct one.
app.get("/talent-portal/applications", (_req: Request, res: Response) => {
  res.redirect(301, "/my-applications");
});
app.get("/talent-portal/applications/*", (_req: Request, res: Response) => {
  res.redirect(301, "/my-applications");
});

// Initialize Sentry early (conditional on DSN availability)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration()
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Filter out certain errors if needed
      if (event.exception) {
        const error = event.exception.values?.[0];
        if (error?.value?.includes('Not authenticated') || error?.value?.includes('401')) {
          return null; // Don't send auth errors to Sentry
        }
      }
      return event;
    }
  });
  console.log('✅ Sentry initialized for error tracking');
} else {
  console.log('⚠️  Sentry not configured - set SENTRY_DSN environment variable to enable error tracking');
}

// Set up environment variables with fallbacks
if (!process.env.PUBLIC_BASE_URL && process.env.REPLIT_DEV_DOMAIN) {
  process.env.PUBLIC_BASE_URL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
}
if (!process.env.VITE_API_BASE) {
  process.env.VITE_API_BASE = "";
}

// Request ID middleware for better debugging and tracing
app.use((req: Request, res: Response, next: NextFunction) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Sentry request handler middleware will be set up later after routes

// Authentication rate limiting middleware
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 authentication requests per windowMs
  message: {
    error: "Too many authentication attempts from this IP",
    message: "Please try again after 15 minutes",
    retryAfter: 900, // 15 minutes in seconds
    requestId: undefined // Will be set by the handler
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    const response = {
      error: "Too many authentication attempts from this IP",
      message: "Please try again after 15 minutes",
      retryAfter: 900,
      requestId: req.requestId
    };
    console.warn(`🚫 Rate limit exceeded for IP: ${req.ip} [RequestID: ${req.requestId}]`);
    
    // Send to Sentry if configured
    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage('Authentication rate limit exceeded', {
        level: 'warning',
        tags: { 
          requestId: req.requestId,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
    }
    
    res.status(429).json(response);
  }
});

// Apply rate limiting to authentication endpoints only
app.use('/api/auth', authLimiter);
app.use('/api/dev/login', authLimiter); // Also apply to development login

// ---------- Per-route rate limiters ----------
// Values are environment-configurable so staging/prod can differ.

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_SIGNUP || '20', 10),
  message: { error: 'Too many signup attempts. Try again later.', retryAfter: 3600 },
  standardHeaders: true,
  legacyHeaders: false,
});

const publicSearchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_SEARCH || '60', 10),
  message: { error: 'Too many search requests. Please slow down.', retryAfter: 60 },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_UPLOAD || '20', 10),
  message: { error: 'Too many upload requests. Please wait.', retryAfter: 60 },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_AI_CHAT || '30', 10),
  message: { error: 'Too many AI requests. Please wait a moment.', retryAfter: 60 },
  standardHeaders: true,
  legacyHeaders: false,
});

const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_WAITLIST || '10', 10),
  message: { error: 'Too many form submissions. Try again later.', retryAfter: 3600 },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply per-route limiters
// NOTE: /api/signup is rate-limited inside routes.ts (signupLimiter) — do NOT add it here again.
app.use('/api/talent-auth', authLimiter);
app.use('/api/profiles/search', publicSearchLimiter);
app.use('/api/jobs', publicSearchLimiter);
app.use('/api/candidates/search', publicSearchLimiter);
app.use('/api/storage/upload-url', uploadLimiter);
app.use('/api/vanessa', aiChatLimiter);
app.use('/api/rag', aiChatLimiter);
app.use('/api/waitlist', waitlistLimiter);
app.use('/api/lead-intake', waitlistLimiter);
// -----------------------------------------------

// CORS configuration with credentials support
app.use(cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Allow all replit.dev domains and localhost for development
    const allowedOrigins = [
      process.env.PUBLIC_BASE_URL,
      /\.replit\.dev$/,
      /^https?:\/\/localhost(:\d+)?$/,
    ].filter(Boolean);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') return origin === allowed;
      if (allowed instanceof RegExp) return allowed.test(origin);
      return false;
    });
    
    callback(null, isAllowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Small JSON limit by default. Upload routes use object storage directly —
// never base64 inside JSON. The 50 MB legacy value was a DoS risk.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ limit: process.env.JSON_BODY_LIMIT || '1mb', extended: false }));

// Log database connection info on startup for debugging
const logDatabaseConnection = () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not configured!');
    return;
  }
  // Extract host without credentials so the tier is immediately obvious.
  // Format: "🔗 DB: helium/heliumdb [LOCAL DEV]" or "ep-xxx.neon.tech [NEON CLOUD]"
  let host = '(unknown)';
  try {
    const u = new URL(dbUrl);
    host = `${u.hostname}${u.pathname}`;
  } catch {
    // Non-standard URL — fall back to a safe excerpt
    const m = dbUrl.match(/@([^/?]+)/);
    if (m) host = m[1];
  }
  const tier =
    /neon\.tech|neondb/.test(host) ? 'NEON CLOUD' :
    /helium|localhost|127\.0\.0\.1/.test(host) ? 'LOCAL DEV' :
    'UNKNOWN HOST — verify before running migrations';
  console.log(`🔗 DB: ${host} [${tier}]`);

};

// Log JWT configuration on startup for debugging  
const logJWTConfiguration = () => {
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    console.log(`✅ JWT_SECRET loaded`);
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚠️  JWT_SECRET not set, using development fallback`);
    } else {
      console.error('❌ JWT_SECRET not configured for production!');
      // Fail fast in production if JWT_SECRET is missing
      process.exit(1);
    }
  }
};

// Enhanced logging middleware with request ID tracking
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
    const requestId = req.requestId;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms [${requestId}]`;
      
      // Add additional context for errors or slow requests
      if (res.statusCode >= 400) {
        logLine += ` ⚠️ ERROR`;
      } else if (duration > 1000) {
        logLine += ` 🐌 SLOW`;
      }
      
      if (capturedJsonResponse && res.statusCode >= 400) {
        // Only log response body for errors to avoid logging sensitive data
        const errorInfo = typeof capturedJsonResponse === 'object' && capturedJsonResponse.error 
          ? capturedJsonResponse.error 
          : 'Unknown error';
        logLine += ` :: ${errorInfo}`;
      }

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 119) + "…";
      }

      log(logLine);
      
      // Send slow requests to Sentry as performance issues
      if (process.env.SENTRY_DSN && duration > 5000) {
        Sentry.captureMessage('Slow API response', {
          level: 'warning',
          tags: {
            endpoint: path,
            method: req.method,
            requestId: requestId,
            duration: duration
          }
        });
      }
    }
  });

  next();
});

(async () => {
  // Log database connection on startup
  logDatabaseConnection();
  logJWTConfiguration();

  // ── One-time migrations: candidates table ────────────────────────────────
  // 1. Ensure the user_id FK column exists (safe to run repeatedly).
  // 2. Backfill user_id for legacy rows that predate the column.
  // 3. Sync profilePicture → profilePhotoUrl for rows that are still null.
  // All three are idempotent — they are no-ops once fully applied.
  try {
    // Ensure the FK column exists (added in task-77; no-op if already present)
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS user_id varchar REFERENCES users(id)`);
    // Video intro columns — no-op once present
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS video_intro_url text`);
    await query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS video_intro_file_name text`);

    // Backfill user_id on legacy rows that were created before this column
    await query(`
      UPDATE candidates c
      SET    user_id = u.id
      FROM   users u
      WHERE  lower(c.email) = lower(u.email)
        AND  u.role = 'talent'
        AND  c.user_id IS NULL
    `);

    // Backfill profilePhotoUrl — prefer joining on user_id (stable), fall back
    // to email for any row that still has user_id NULL after the step above.
    const backfillResult = await query(`
      UPDATE candidates c
      SET    profile_photo_url = '/api/profile-picture/' || u.id
      FROM   users u
      JOIN   profiles p ON p.user_id = u.id
      WHERE  (c.user_id = u.id OR lower(c.email) = lower(u.email))
        AND  p.profile_picture IS NOT NULL
        AND  c.profile_photo_url IS NULL
    `);
    const updated = backfillResult.rowCount ?? 0;
    if (updated > 0) {
      console.log(`✅ Backfill: synced profile photos for ${updated} candidate(s)`);
    } else {
      console.log('✅ Backfill: no candidates needed profile photo sync');
    }
  } catch (err: any) {
    // Non-fatal — don't block startup if the backfill fails
    console.error('⚠️  Backfill: profile photo sync failed (non-fatal):', err.message);
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Setup authentication first before routes
  await setupAuth(app);

  // ─── Health & readiness endpoints ────────────────────────────────────────
  // /api/health — lightweight liveness check (no DB)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // /api/ready — verifies required dependencies are reachable
  app.get('/api/ready', async (_req, res) => {
    try {
      const { pool } = await import('./db');
      await pool.query('SELECT 1');
      res.json({ status: 'ready', db: 'ok', timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(503).json({ status: 'not ready', db: 'error', timestamp: new Date().toISOString() });
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

  // Background jobs are guarded by RUN_BACKGROUND_JOBS=true so that
  // multiple Replit instances don't all run crons simultaneously.
  // In production set this on exactly one worker dyno/instance.
  // Default: enabled in development, disabled when the env var is explicitly "false".
  const runBgJobs = process.env.RUN_BACKGROUND_JOBS !== 'false';

  if (runBgJobs) {
    // Start GHL sync service (automatic sync every 15 minutes)
    const { ghlSyncService } = await import('./services/ghlSyncService');
    ghlSyncService.startCronJob();

    // Start site crawler service (automatic crawl daily at 3:00 AM)
    const { siteCrawlerService } = await import('./services/siteCrawlerService');

    try {
    const { query: dbQuery } = await import('./db');
      const autoApproveResult = await dbQuery(
        `UPDATE jobs
           SET approval_status = 'approved',
               status          = 'open',
               updated_at      = NOW()
         WHERE is_client_submitted = false
           AND approval_status    = 'pending'
           AND engagement_type IN ('Half-Day', 'Full-Time')`
      );
      if ((autoApproveResult.rowCount ?? 0) > 0) {
        console.log(`✅ Auto-approved ${autoApproveResult.rowCount} admin-created job(s) that were pending`);
      }
    } catch (autoApproveErr: any) {
      console.warn('⚠️  Auto-approve migration skipped:', autoApproveErr.message);
    }
  }

  // Seed posts from legacy static content to database
  // NOTE: This migration is idempotent - uses slug uniqueness to prevent duplicates
  // Safe to remove once production content is fully managed via admin UI
  const { seedPosts } = await import('./seeds/seedPosts');
  const { storage } = await import('./storage');
  await seedPosts(storage);

  // Run email table migrations before seeding so the tables exist on a fresh DB
  try {
    const { query: dbQuery } = await import('./db');
    await dbQuery(`
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
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_aet_category     ON applicant_email_templates(category)`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_aet_stage        ON applicant_email_templates(stage)`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_aet_is_published ON applicant_email_templates(is_published)`);
    await dbQuery(`
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
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_jae_application_id ON job_application_emails(application_id)`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_jae_sent_at         ON job_application_emails(sent_at)`);
  } catch (migErr: any) {
    console.warn("⚠️  Email tables early migration skipped:", migErr.message);
  }

  // job_matches — persisted AI match scores (Option C event-driven scorer).
  // Created here because the table was bootstrapped via raw SQL rather than
  // drizzle-kit push (db:push hung on an unrelated interactive prompt).
  // This block is the authoritative idempotent creation path so the table
  // always exists on a clean DB and any future `drizzle-kit push` run will
  // see an already-matching schema and produce no diff.
  try {
    const { query: jmQuery } = await import('./db');
    await jmQuery(`
      CREATE TABLE IF NOT EXISTS job_matches (
        id                  VARCHAR   PRIMARY KEY DEFAULT gen_random_uuid(),
        talent_id           VARCHAR   NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        job_id              VARCHAR   NOT NULL REFERENCES jobs(id)       ON DELETE CASCADE,
        compatibility_score INTEGER   NOT NULL DEFAULT 0,
        match_reasons       JSONB     NOT NULL DEFAULT '{}',
        computed_at         TIMESTAMP DEFAULT NOW(),
        notified_at         TIMESTAMP
      )
    `);
    await jmQuery(`CREATE INDEX  IF NOT EXISTS idx_job_matches_talent_id ON job_matches(talent_id)`);
    await jmQuery(`CREATE INDEX  IF NOT EXISTS idx_job_matches_job_id    ON job_matches(job_id)`);
    await jmQuery(`CREATE INDEX  IF NOT EXISTS idx_job_matches_score      ON job_matches(compatibility_score)`);
    await jmQuery(`CREATE UNIQUE INDEX IF NOT EXISTS uq_job_matches_talent_job ON job_matches(talent_id, job_id)`);
    console.log("✅ Migration: job_matches table ready");
  } catch (jmErr: any) {
    console.warn("⚠️  job_matches migration skipped:", jmErr.message);
  }

  // jobs.created_via — distinguishes auto-created search-scaffold jobs from real postings
  try {
    const { query: migrateQuery } = await import('./db');
    await migrateQuery(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'manual'`);
    console.log("✅ Migration: jobs.created_via column ready");
  } catch (err: any) {
    console.warn("⚠️  jobs.created_via migration skipped:", err.message);
  }

  // job_submissions.initiated_by — durable record of who originated the submission
  // Survives status changes (e.g. invited → submitted) so client-initiated invites
  // are never confused with talent-initiated applications after status flips.
  try {
    const { query: migrateQuery } = await import('./db');
    await migrateQuery(`ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS initiated_by text NOT NULL DEFAULT 'talent'`);
    console.log("✅ Migration: job_submissions.initiated_by column ready");
  } catch (err: any) {
    console.warn("⚠️  job_submissions.initiated_by migration skipped:", err.message);
  }

  // Seed default applicant email templates (idempotent — name-based deduplication)
  const { seedEmailTemplates } = await import('./seeds/seedEmailTemplates');
  await seedEmailTemplates();
  
  const server = await registerRoutes(app);

  // ── Scaffold-job TTL cleanup ────────────────────────────────────────────────
  // Removes search_scaffold rows older than 7 days that have no job_submissions
  // (i.e. the client searched but never invited anyone). Scaffold rows that have
  // at least one invitation are kept for audit. Runs once 5 s after startup so
  // any rows that aged out while the server was offline are swept immediately,
  // then repeats hourly. Admin can also trigger an on-demand pass via
  // POST /api/admin/scaffold-jobs/cleanup.
  const SCAFFOLD_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  // Alert threshold: if this many orphaned scaffold jobs remain after a cleanup pass,
  // something is likely broken (DB errors, missed deletes, etc.).
  const DEFAULT_SCAFFOLD_ORPHAN_ALERT_THRESHOLD = 50;
  const parsedThreshold = parseInt(process.env.SCAFFOLD_ORPHAN_ALERT_THRESHOLD || '', 10);
  const SCAFFOLD_ORPHAN_ALERT_THRESHOLD =
    Number.isFinite(parsedThreshold) && parsedThreshold >= 0
      ? parsedThreshold
      : DEFAULT_SCAFFOLD_ORPHAN_ALERT_THRESHOLD;
  if (process.env.SCAFFOLD_ORPHAN_ALERT_THRESHOLD && !Number.isFinite(parsedThreshold)) {
    console.warn(
      `⚠️  SCAFFOLD_ORPHAN_ALERT_THRESHOLD env var is not a valid integer ("${process.env.SCAFFOLD_ORPHAN_ALERT_THRESHOLD}"); using default of ${DEFAULT_SCAFFOLD_ORPHAN_ALERT_THRESHOLD}`,
    );
  }
  const runScaffoldCleanup = async () => {
    try {
      const { storage: st } = await import('./storage');
      const deleted = await st.cleanupOrphanedScaffoldJobs();
      if (deleted > 0) {
        console.log(`🧹 Scaffold cleanup: removed ${deleted} orphaned search_scaffold job(s)`);
      } else {
        console.log('🧹 Scaffold cleanup: no orphaned jobs to remove');
      }

      // Post-cleanup health check: alert if too many orphans remain
      const remaining = await st.countOrphanedScaffoldJobs();
      if (remaining > SCAFFOLD_ORPHAN_ALERT_THRESHOLD) {
        const msg = `Scaffold job accumulation detected: ${remaining} orphaned search_scaffold jobs older than 7 days remain after cleanup (threshold: ${SCAFFOLD_ORPHAN_ALERT_THRESHOLD}). Cleanup may be failing silently.`;
        console.error(`🚨 ${msg}`);
        if (process.env.SENTRY_DSN) {
          Sentry.captureMessage(msg, {
            level: 'error',
            tags: { subsystem: 'scaffold-cleanup', remainingCount: remaining },
          });
        }
      }
    } catch (err: any) {
      console.warn('⚠️  Scaffold cleanup error (non-fatal):', err.message);
    }
  };
  // Run once shortly after startup, then on the hourly interval
  setTimeout(runScaffoldCleanup, 5000);
  setInterval(runScaffoldCleanup, SCAFFOLD_CLEANUP_INTERVAL_MS);
  console.log('⏰ Scaffold cleanup scheduled: startup pass in 5 s, then every 1 h');

  // Enhanced global error handler with Sentry integration
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const requestId = req.requestId;

    // Log error with request ID for better debugging
    console.error(`🚨 Server Error [${requestId}]:`, {
      message: err.message,
      stack: err.stack,
      statusCode: status,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Send to Sentry if configured and it's a server error
    if (process.env.SENTRY_DSN && status >= 500) {
      // Redact sensitive fields from request body before sending to Sentry
      const sanitizedBody = req.body ? { ...req.body } : {};
      if (sanitizedBody.password) delete sanitizedBody.password;
      if (sanitizedBody.token) delete sanitizedBody.token;
      if (sanitizedBody.secret) delete sanitizedBody.secret;
      
      Sentry.captureException(err, {
        tags: {
          requestId: requestId,
          endpoint: req.path,
          method: req.method,
          statusCode: status
        },
        user: {
          ip_address: req.ip
        },
        extra: {
          userAgent: req.get('User-Agent'),
          body: sanitizedBody
        }
      });
    }

    res.status(status).json({ 
      error: status >= 500 ? "Internal Server Error" : message,
      message: status >= 500 ? "An unexpected error occurred. Please try again later." : message,
      requestId: requestId
    });
  });

  // Sentry error handler middleware (conditional, must be after all other middleware)
  if (process.env.SENTRY_DSN) {
    app.use(Sentry.expressErrorHandler());
  }

  // Log environment info on startup
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 Frontend baseURL: ${process.env.VITE_API_BASE || 'relative URLs'}`);

  // API 404 guard — must come AFTER all /api/* routes and BEFORE the Vite/static catch-all.
  // Prevents unmatched /api/* requests from falling through to index.html (which returns HTML
  // with a 200 status, confusing JSON-expecting clients with "Unexpected token '<'" errors).
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: "API endpoint not found" });
  });

  // Serve static files from public folder (for Open Graph images, robots.txt, etc.)
  // This must come BEFORE Vite setup to prevent the catch-all route from intercepting static files
  const publicPath = path.resolve(import.meta.dirname, "..", "public");
  app.use(express.static(publicPath));
  console.log(`📁 Serving static files from: ${publicPath}`);

  // Social media crawler middleware — intercepts known bots before Vite/static catch-all
  // and serves a lightweight HTML page with correct Open Graph tags per route.
  // Regular browsers pass through untouched.
  app.use(ogMiddleware);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
