import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import * as Sentry from "@sentry/node";
import { v4 as uuidv4 } from "uuid";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./replitAuth";
import { query, initializeDatabase } from "./db";

// Extend Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

// Environment validation and logging function
async function validateEnvironmentAndLog(): Promise<void> {
  console.log('🔍 Environment Configuration Validation Starting...');
  console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'not set (defaulting to development)'}`);
  console.log(`🖥️  Running in ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);

  // Critical environment variables validation
  const criticalEnvVars = {
    'DATABASE_URL': process.env.DATABASE_URL,
    'JWT_SECRET': process.env.JWT_SECRET,
    'PORT': process.env.PORT
  };

  const optionalEnvVars = {
    'SENTRY_DSN': process.env.SENTRY_DSN,
    'PUBLIC_BASE_URL': process.env.PUBLIC_BASE_URL,
    'VITE_API_BASE': process.env.VITE_API_BASE,
    'REPLIT_DEV_DOMAIN': process.env.REPLIT_DEV_DOMAIN
  };

  // Validate critical environment variables
  let hasAllCriticalVars = true;
  for (const [key, value] of Object.entries(criticalEnvVars)) {
    if (!value) {
      console.error(`❌ CRITICAL: ${key} is not set!`);
      hasAllCriticalVars = false;
    } else {
      if (key === 'JWT_SECRET') {
        if (process.env.NODE_ENV === 'production' && value === 'development-fallback-secret-not-for-production') {
          console.error('❌ CRITICAL: Using development JWT_SECRET in production!');
          hasAllCriticalVars = false;
        } else {
          console.log(`✅ ${key}: configured (${value.length} characters)`);
        }
      } else if (key === 'DATABASE_URL') {
        const maskedUrl = value.replace(/(\/\/[^:]+:)([^@]+)(@)/, '$1***$3');
        console.log(`✅ ${key}: ${maskedUrl}`);
      } else {
        console.log(`✅ ${key}: ${value}`);
      }
    }
  }

  // Log optional environment variables
  console.log('\n📋 Optional Environment Variables:');
  for (const [key, value] of Object.entries(optionalEnvVars)) {
    if (value) {
      console.log(`✅ ${key}: ${value}`);
    } else {
      console.log(`⚠️  ${key}: not set`);
    }
  }

  // JWT Secret validation and fallback handling
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ CRITICAL: JWT_SECRET must be set in production!');
      process.exit(1);
    } else {
      console.warn('⚠️  JWT_SECRET not set, using development fallback');
      process.env.JWT_SECRET = 'development-fallback-secret-not-for-production';
    }
  }

  // Database connection verification with proper initialization
  console.log('\n🗄️  Database Connection Verification:');
  try {
    // Initialize database connection first
    initializeDatabase();
    
    const dbTestResult = await query('SELECT 1 as test, current_database() as database_name, version() as version');
    const dbInfo = dbTestResult.rows[0];
    console.log(`✅ Database connection successful`);
    console.log(`📊 Database: ${dbInfo.database_name}`);
    console.log(`🔧 Version: ${dbInfo.version.split(' ')[0]} ${dbInfo.version.split(' ')[1]}`);
    
    // Check if we're using the right database environment
    const isProductionDb = dbInfo.database_name?.includes('prod') || 
                          process.env.DATABASE_URL?.includes('prod') ||
                          process.env.DATABASE_URL?.includes('production');
    
    if (process.env.NODE_ENV === 'production' && !isProductionDb) {
      console.warn('⚠️  WARNING: Running in production mode but database appears to be non-production');
    }
    if (process.env.NODE_ENV !== 'production' && isProductionDb) {
      console.warn('⚠️  WARNING: Running in development mode but database appears to be production');
    }
    
    console.log(`🏷️  Database Environment: ${isProductionDb ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ CRITICAL: Database connection is required in production');
      process.exit(1);
    } else {
      console.warn('⚠️  Database connection failed in development, some features may not work');
    }
  }

  // Production-specific validations
  if (process.env.NODE_ENV === 'production') {
    console.log('\n🔒 Production Environment Checks:');
    
    if (!process.env.PUBLIC_BASE_URL) {
      console.error('❌ CRITICAL: PUBLIC_BASE_URL must be set in production');
      hasAllCriticalVars = false;
    }
    
    if (!process.env.SENTRY_DSN) {
      console.warn('⚠️  SENTRY_DSN not set - error tracking disabled');
    }
  }

  // Exit if critical variables are missing in production
  if (process.env.NODE_ENV === 'production' && !hasAllCriticalVars) {
    console.error('❌ CRITICAL: Missing required environment variables for production');
    process.exit(1);
  }

  console.log('\n✅ Environment validation completed successfully');
  console.log('─'.repeat(60));
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

// Apply rate limiting to all authentication endpoints for security
app.use('/api/auth', authLimiter);
app.use('/api/dev/login', authLimiter); // Also apply to development login
app.use('/api/login', authLimiter); // Apply to main login endpoint
app.use('/api/signup', authLimiter); // Apply to main signup endpoint

// CORS configuration with credentials support
app.use(cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Allow all replit.dev domains, localhost for development, and production domain
    const allowedOrigins = [
      process.env.PUBLIC_BASE_URL,
      'https://connect.onspotglobal.com', // Production domain
      /\.replit\.dev$/,
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/.*\.onspotglobal\.com$/,
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
  // Validate environment variables and log configuration
  await validateEnvironmentAndLog();
  
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
