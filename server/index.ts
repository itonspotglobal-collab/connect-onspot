import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import * as Sentry from "@sentry/node";
import { v4 as uuidv4 } from "uuid";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./replitAuth";

// Extend Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const app = express();

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

// Configure payload limits for file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));

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
    console.log(`🔐 JWT_SECRET configured: ***${jwtSecret.slice(-4)}`);
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚠️  JWT_SECRET not set, using development fallback`);
    } else {
      console.error('❌ JWT_SECRET not configured for production!');
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
          body: req.body
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
