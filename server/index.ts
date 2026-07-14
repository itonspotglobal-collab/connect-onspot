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
app.use('/api/signup', signupLimiter);
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
  if (dbUrl) {
    // Mask credentials for security
    const maskedUrl = dbUrl.replace(/:([^:]+)@/, ':***@');
    console.log(`🔗 Database connected: ${maskedUrl}`);
  } else {
    console.error('❌ DATABASE_URL not configured!');
  }
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
    siteCrawlerService.startCronJob();
  } else {
    console.log('⏸  Background cron jobs disabled (RUN_BACKGROUND_JOBS=false)');
  }

  // Pre-warm the RAG index into memory so the first chat request is instant.
  // This just loads the existing rag_index.json; it does NOT crawl or embed.
  if (process.env.OPENAI_API_KEY) {
    import('./services/ragService')
      .then(({ loadRagIndex }) => loadRagIndex())
      .then((idx) => {
        if (idx) {
          console.log(`🧠 RAG index pre-warmed: ${idx.totalChunks} chunks across ${new Set(idx.chunks.map((c: any) => c.url)).size} pages`);
        } else {
          console.log(`ℹ️  No RAG index found — run POST /api/rag/reindex to build one`);
        }
      })
      .catch((err: any) => console.warn(`⚠️ RAG pre-warm skipped: ${err.message}`));

    // Auto-generate platform knowledge if AUTO_UPDATE_VANESSA_KNOWLEDGE=true
    if (process.env.AUTO_UPDATE_VANESSA_KNOWLEDGE === 'true') {
      import('./services/knowledgeBaseUpdater')
        .then(({ savePlatformKnowledge }) => savePlatformKnowledge())
        .then((result) => {
          if (result.success) {
            console.log(`📚 Platform knowledge auto-updated at startup → ${result.filePath}`);
          } else {
            console.warn(`⚠️ Platform knowledge auto-update failed: ${result.error}`);
          }
        })
        .catch((err: any) => console.warn(`⚠️ Platform knowledge auto-update skipped: ${err.message}`));
    }

    if (runBgJobs) {
      // Index website content (testimonials, people, magazine, team, case studies).
      import('./services/ragService')
        .then(({ indexWebsiteContent }) => indexWebsiteContent())
        .then((result) => {
          console.log(`📄 Website content indexed at startup: ${result.chunksAdded} chunk(s)`);
        })
        .catch((err: any) => console.warn(`⚠️ Startup content indexing skipped: ${err.message}`));

      // Index live job listings from the database so Vanessa can answer job questions.
      import('./services/ragService')
        .then(({ indexJobListings }) => indexJobListings())
        .then((result) => {
          console.log(`💼 Job listings indexed at startup: ${result.jobsIndexed} job(s), ${result.chunksAdded} chunk(s)`);
        })
        .catch((err: any) => console.warn(`⚠️ Startup job indexing skipped: ${err.message}`));
    }
  }
  
  // Auto-approve all admin-created (non-client-submitted) jobs that are still
  // in the default "pending" state. These were created before the approval
  // workflow existed and should be publicly visible immediately.
  // Idempotent: only updates rows that are genuinely still pending.
  try {
    const { query: dbQuery } = await import('./db');
    const autoApproveResult = await dbQuery(
      `UPDATE jobs
         SET approval_status = 'approved',
             status          = 'open',
             updated_at      = NOW()
       WHERE is_client_submitted = false
         AND approval_status    = 'pending'`
    );
    if ((autoApproveResult.rowCount ?? 0) > 0) {
      console.log(`✅ Auto-approved ${autoApproveResult.rowCount} admin-created job(s) that were pending`);
    }
  } catch (autoApproveErr: any) {
    console.warn('⚠️  Auto-approve migration skipped:', autoApproveErr.message);
  }

  // Seed posts from legacy static content to database
  // NOTE: This migration is idempotent - uses slug uniqueness to prevent duplicates
  // Safe to remove once production content is fully managed via admin UI
  const { seedPosts } = await import('./seeds/seedPosts');
  const { storage } = await import('./storage');
  await seedPosts(storage);
  
  const server = await registerRoutes(app);

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
