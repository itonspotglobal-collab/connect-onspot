import type { Express, Request, Response, NextFunction } from "express";
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
import rateLimit from "express-rate-limit";
import multer from "multer";
import Papa from "papaparse";
import jwt from "jsonwebtoken";
import { query, db } from "./db.ts";
import { eq } from "drizzle-orm";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";
import { setObjectAclPolicy } from "./objectAcl";
import { v4 as uuidv4 } from "uuid";
import { randomUUID } from "crypto";
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
  insertDocumentSchema,
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
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Validate JWT payload structure
    if (!decoded.userId || !decoded.email || !decoded.role) {
      console.error(
        `❌ JWT Auth failed: Invalid token payload [${(req as any).requestId}]:`,
        {
          hasUserId: !!decoded.userId,
          hasEmail: !!decoded.email,
          hasRole: !!decoded.role,
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
    const userResult = await query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      console.error(
        `❌ JWT Auth failed: User not found in database [${(req as any).requestId}]: ${decoded.userId}`,
      );
      return res.status(401).json({
        error: "Invalid token",
        message: "User account no longer exists",
        requestId: (req as any).requestId,
      });
    }

    const dbUser = userResult.rows[0];

    // Verify role hasn't changed
    if (dbUser.role !== decoded.role) {
      console.error(
        `❌ JWT Auth failed: Role mismatch [${(req as any).requestId}]:`,
        {
          tokenRole: decoded.role,
          dbRole: dbUser.role,
          userId: decoded.userId,
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
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    console.log(`✅ JWT Auth successful [${(req as any).requestId}]:`, {
      userId: decoded.userId,
      role: decoded.role,
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

// Rate limiting middleware for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: "Too many attempts",
    message: "Too many login/signup attempts. Please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  skipFailedRequests: false, // Count failed requests
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for file uploads (CSV, PDF, videos)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit for videos
    },
  });

  console.log("🔗 Registering API routes...");

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
  app.post("/api/signup", authLimiter, async (req: Request, res: Response) => {
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
          VALUES ($1, $2, $3, $4, 'Global', ARRAY['English'], 'Asia/Manila', NOW(), NOW())
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
      }

      console.log(`✅ User signup successful [${requestId}]:`, {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
      });

      // Return exact format required by specification - ONLY { success:true, userId, email, role }
      res.status(201).json({
        success: true,
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
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
  app.post("/api/login", authLimiter, async (req: Request, res: Response) => {
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

  // ==================== DOCUMENTS ====================
  // GET /api/documents - Get user's documents
  app.get("/api/documents", authenticateJWT, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      console.log(`🔍 Fetching documents [${req.requestId}]:`, { userId });
      const documents = await storage.getUserDocuments(userId);
      res.json(documents);
    } catch (error) {
      handleRouteError(error, req, res, "Get user documents", 500);
    }
  });

  // POST /api/documents - Create new document
  app.post(
    "/api/documents",
    authenticateJWT,
    validateRequest(insertDocumentSchema.omit({ userId: true }), "body"),
    async (req: any, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ error: "Authentication required" });
        }

        console.log(`📄 Creating document [${req.requestId}]:`, {
          userId,
          type: req.body.type,
        });
        const document = await storage.createDocument({
          ...req.body,
          userId,
        });
        res.status(201).json(document);
      } catch (error) {
        handleRouteError(error, req, res, "Create document", 500);
      }
    },
  );

  // PUT /api/documents/:id - Update document
  app.put(
    "/api/documents/:id",
    authenticateJWT,
    validateRequest(z.object({ id: z.string().min(1) }), "params"),
    validateRequest(
      insertDocumentSchema.omit({ userId: true }).partial(),
      "body",
    ),
    async (req: any, res) => {
      try {
        const userId = req.user?.id;
        const { id } = req.params;

        // Check if document exists and belongs to user
        const existingDoc = await storage.getDocument(id);
        if (!existingDoc) {
          return res.status(404).json({ error: "Document not found" });
        }
        if (existingDoc.userId !== userId) {
          return res.status(403).json({ error: "Access denied" });
        }

        // Security: Remove userId from update data to prevent reassignment
        const { userId: _, ...updateData } = req.body;

        console.log(`📝 Updating document [${req.requestId}]:`, {
          userId,
          documentId: id,
        });
        const document = await storage.updateDocument(id, updateData);
        res.json(document);
      } catch (error) {
        handleRouteError(error, req, res, "Update document", 500);
      }
    },
  );

  // DELETE /api/documents/:id - Delete document
  app.delete(
    "/api/documents/:id",
    authenticateJWT,
    validateRequest(z.object({ id: z.string().min(1) }), "params"),
    async (req: any, res) => {
      try {
        const userId = req.user?.id;
        const { id } = req.params;

        // Check if document exists and belongs to user
        const existingDoc = await storage.getDocument(id);
        if (!existingDoc) {
          return res.status(404).json({ error: "Document not found" });
        }
        if (existingDoc.userId !== userId) {
          return res.status(403).json({ error: "Access denied" });
        }

        console.log(`🗑️ Deleting document [${req.requestId}]:`, {
          userId,
          documentId: id,
        });
        const deleted = await storage.deleteDocument(id);
        if (deleted) {
          res.json({ success: true, message: "Document deleted successfully" });
        } else {
          res.status(500).json({ error: "Failed to delete document" });
        }
      } catch (error) {
        handleRouteError(error, req, res, "Delete document", 500);
      }
    },
  );

  // ==================== USERS ====================
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

  // ==================== PROFILES ====================

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
            timezone: "Asia/Manila",
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
          profilePicture: req.body.profilePicture,
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

          // Prepare update data with defaults
          const updateData = {
            firstName: validated.firstName,
            lastName: validated.lastName,
            title: validated.title,
            bio: validated.bio,
            location: validated.location || "Global",
            hourlyRate: validated.hourlyRate,
            rateCurrency: validated.rateCurrency || "USD",
            availability: validated.availability || "available",
            profilePicture: validated.profilePicture,
            phoneNumber: validated.phoneNumber,
            languages: validated.languages || ["English"],
            timezone: validated.timezone || "Asia/Manila",
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

          // Set defaults for required fields
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
            profilePicture: validated.profilePicture,
            phoneNumber: validated.phoneNumber,
            languages: validated.languages || ["English"],
            timezone: validated.timezone || "Asia/Manila",
          };

          const insertedProfiles = await db
            .insert(profiles)
            .values(insertData)
            .returning();
          profile = insertedProfiles[0];
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
            validated.timezone || "Asia/Manila",
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
            validated.timezone || "Asia/Manila",
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

  // ==================== LEAD INTAKE ====================
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
          console.log(
            `🎯 Lead successfully sent to GHL: Contact ID ${ghlResult.ghlContactId}`,
          );
          // Optionally update the lead with GHL contact ID
          await storage.updateLeadIntake(leadIntake.id, {
            internalNotes: `GHL Contact ID: ${ghlResult.ghlContactId}`,
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

  // ==================== SKILLS ====================
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

  // ==================== USER SKILLS ====================
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

  // ==================== JOBS ====================
  // Advanced Job Search - Critical for job discovery (must come before :id route)
  app.get("/api/jobs/search", async (req, res) => {
    try {
      const filters = {
        category: req.query.category as string,
        contractType: req.query.contractType as string,
        experienceLevel: req.query.experienceLevel as string,
        minBudget: req.query.minBudget
          ? Number(req.query.minBudget)
          : undefined,
        maxBudget: req.query.maxBudget
          ? Number(req.query.maxBudget)
          : undefined,
        skills: req.query.skills
          ? (req.query.skills as string).split(",")
          : undefined,
        status: (req.query.status as string) || "open",
        q: req.query.q as string, // Text search query
      };

      // Use enhanced search method that includes skills arrays
      const jobsWithSkills = await storage.searchJobsWithSkills(filters);
      res.json(jobsWithSkills);
    } catch (error) {
      console.error("Job search error:", error);
      res.status(500).json({ error: "Failed to search jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      // Use enhanced method that includes skills array
      const jobWithSkills = await storage.getJobWithSkills(req.params.id);
      if (!jobWithSkills) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(jobWithSkills);
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

  // ==================== JOB SKILLS ====================
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

  // ==================== JOB MATCHING ====================
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
        contractType: req.query.contractType as string,
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

  // ==================== PROPOSALS ====================
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

  // ==================== CONTRACTS (Phase 2 Priority) ====================
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

  // ==================== MESSAGES (Phase 1 Priority) ====================
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

  // ==================== ADDITIONAL ROUTES (Stubs for Phase 2+) ====================

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

  // ==================== LINKEDIN INTEGRATION ====================

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
          timezone: "Asia/Manila",
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
          "hourlyRate",
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
            hourlyRate: "25.00",
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
            hourlyRate: "20.00",
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
          hourlyRate: 'Optional. Numeric hourly rate (e.g., "25.00")',
          rateCurrency:
            'Optional. Currency code: "USD" or "PHP" (default: "USD")',
          availability:
            'Optional. Status: "available", "busy", or "offline" (default: "available")',
          phoneNumber: "Optional. Contact phone number",
          languages: 'Optional. Comma-separated languages (default: "English")',
          timezone: 'Optional. Timezone identifier (default: "Asia/Manila")',
          skills: "Optional. Comma-separated list of skills",
        },
        requiredFields: ["firstName", "lastName", "email", "title", "bio"],
        optionalFields: [
          "location",
          "hourlyRate",
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
        "hourlyRate",
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
        "25.00",
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
  app.post("/login", authLimiter, async (req: Request, res: Response) => {
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
  app.post("/signup", authLimiter, async (req: Request, res: Response) => {
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
          VALUES ($1, $2, $3, $4, 'Global', ARRAY['English'], 'Asia/Manila', NOW(), NOW())
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

  const httpServer = createServer(app);
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
