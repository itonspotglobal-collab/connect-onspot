import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import * as Sentry from "@sentry/node";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { ghlService } from "./services/ghlService";
import {
  insertUserSchema, insertProfileSchema, insertSkillSchema, insertUserSkillSchema,
  insertJobSchema, insertJobSkillSchema, insertProposalSchema, insertContractSchema,
  insertMilestoneSchema, insertTimeEntrySchema, insertMessageThreadSchema, insertMessageSchema,
  insertReviewSchema, insertPortfolioItemSchema, insertCertificationSchema, insertPaymentSchema,
  insertDisputeSchema, insertNotificationSchema, insertLeadIntakeSchema
} from "@shared/schema";
import { z } from "zod";

// Enhanced validation middleware factory
const validateRequest = (schema: z.ZodSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = target === 'body' ? req.body : 
                            target === 'query' ? req.query : 
                            req.params;
      
      schema.parse(dataToValidate);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        console.warn(`🚨 Validation Error [${(req as any).requestId}]:`, {
          endpoint: req.path,
          method: req.method,
          target: target,
          errors: validationErrors
        });

        return res.status(400).json({
          error: "Validation failed",
          message: `Invalid ${target} data provided`,
          details: validationErrors,
          requestId: (req as any).requestId
        });
      }
      next(error);
    }
  };
};

// Enhanced error handler utility
const handleRouteError = (error: any, req: Request, res: Response, operation: string, statusCode: number = 500) => {
  const requestId = (req as any).requestId;
  const userId = (req as any).user?.user?.id || (req as any).user?.claims?.sub;
  
  console.error(`🚨 ${operation} Error [${requestId}]:`, {
    error: error.message,
    stack: error.stack,
    userId: userId,
    endpoint: req.path,
    method: req.method
  });

  // Send to Sentry if configured and it's a server error
  if (process.env.SENTRY_DSN && statusCode >= 500) {
    Sentry.captureException(error, {
      tags: {
        operation: operation,
        requestId: requestId,
        endpoint: req.path,
        method: req.method,
        userId: userId
      },
      user: {
        id: userId,
        ip_address: req.ip
      },
      extra: {
        userAgent: req.get('User-Agent')
      }
    });
  }

  // Return appropriate error message
  const isServerError = statusCode >= 500;
  res.status(statusCode).json({
    error: isServerError ? "Internal server error" : error.message || "Operation failed",
    message: isServerError ? "An unexpected error occurred. Please try again later." : error.message || `Failed to ${operation.toLowerCase()}`,
    requestId: requestId
  });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes - Updated for OAuth compatibility with enhanced error handling
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ 
          error: "Not authenticated",
          message: "Please log in to access this resource",
          requestId: req.requestId
        });
      }

      let user;
      
      // Handle OAuth users (Google/LinkedIn/Dev)
      if (req.user && req.user.user) {
        user = req.user.user;
        const provider = req.user.provider || 'unknown';
        console.log(`✅ ${provider.toUpperCase()} user authenticated [${req.requestId}]:`, { 
          id: user.id, 
          email: user.email, 
          provider: provider 
        });
        
        // For dev login, make sure user exists in storage
        if (provider === 'dev') {
          try {
            const storedUser = await storage.getUser(user.id);
            if (!storedUser) {
              console.warn(`⚠️ Dev user not found in storage, creating: ${user.id}`);
              await storage.upsertUser(user);
            }
          } catch (error) {
            console.error(`❌ Error checking/creating dev user [${req.requestId}]:`, error);
          }
        }
      } 
      // Handle Replit Auth users
      else if (req.user && req.user.claims) {
        const userId = req.user.claims.sub;
        user = await storage.getUser(userId);
        console.log(`✅ Replit Auth user authenticated [${req.requestId}]:`, { id: userId });
      }
      else {
        console.error(`❌ Unknown user type in session [${req.requestId}]:`, req.user);
        return res.status(401).json({ 
          error: "Invalid session",
          message: "Session format not recognized",
          requestId: req.requestId
        });
      }

      if (!user) {
        return res.status(404).json({ 
          error: "User not found",
          message: "User account not found in database",
          requestId: req.requestId
        });
      }

      // Return user data with auth provider info
      res.json({
        ...user,
        authProvider: (req.user as any).provider || 'replit'
      });
    } catch (error) {
      handleRouteError(error, req, res, "Get current user", 500);
    }
  });

  // Alternative endpoint name for better frontend compatibility
  app.get('/api/me', async (req: any, res) => {
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
      }
      else {
        return res.status(401).json({ message: "Invalid session" });
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        ...user,
        authProvider: (req.user as any).provider || 'replit'
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // OAuth error handling route
  app.get('/api/auth/error', (req, res) => {
    const { error, provider, message } = req.query;
    res.json({
      error: error || 'oauth_error',
      provider: provider || 'unknown',
      message: message || 'Authentication failed. Please try again.',
      support: 'Contact support@onspotglobal.com for assistance',
      retry: true
    });
  });

  // Health check route for OAuth testing
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      authenticated: req.isAuthenticated(),
      user: req.isAuthenticated() ? ((req.user as any)?.user?.id || (req.user as any)?.claims?.sub || 'unknown') : null,
      provider: req.isAuthenticated() ? ((req.user as any)?.provider || 'replit') : null
    });
  });

  // Enhanced development login endpoint with validation and monitoring
  app.post('/api/dev/login', 
    validateRequest(z.object({
      email: z.string().email("Valid email address required"),
      userType: z.enum(['talent', 'client']).optional().default('talent')
    })),
    async (req: any, res) => {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        console.warn(`🚫 Production dev login attempt blocked [${req.requestId}]`, {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return res.status(403).json({ 
          error: 'Development login not available in production',
          requestId: req.requestId
        });
      }

      try {
        const { email, userType } = req.body;

        // Create or get mock user for development
        const mockUserId = `dev_${email.replace('@', '_').replace('.', '_')}`;
        const mockUser = {
          id: mockUserId,
          email: email,
          firstName: email.split('@')[0],
          lastName: 'DevUser',
          role: userType || 'talent',
          profileImageUrl: null,
        };

        // Store user in database
        await storage.upsertUser(mockUser);

        // CRITICAL: Use req.login() to establish proper server session
        req.login({ user: mockUser, provider: 'dev' }, (err: any) => {
          if (err) {
            console.error(`🚨 Dev login session error [${req.requestId}]:`, err);
            
            // Log session creation failure for monitoring
            if (process.env.SENTRY_DSN) {
              Sentry.captureException(err, {
                tags: {
                  operation: 'dev_login_session',
                  requestId: req.requestId,
                  userId: mockUserId
                }
              });
            }
            
            return res.status(500).json({ 
              error: 'Failed to create session',
              requestId: req.requestId
            });
          }
          
          console.log(`✅ Dev login successful [${req.requestId}]:`, { 
            email, 
            userId: mockUserId, 
            userType 
          });
          
          res.json({
            success: true,
            user: mockUser,
            message: 'Development login successful',
            sessionEstablished: true
          });
        });
      } catch (error) {
        handleRouteError(error, req, res, "Development login", 500);
      }
    }
  );

  // SECURITY FIX: Protected Object Storage Upload URL - Generate presigned URL for file uploads
  app.post('/api/object-storage/upload-url', async (req: any, res) => {
    // CRITICAL: Add authentication guard
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required for file uploads' });
    }
    try {
      const { fileName, contentType } = req.body;
      
      if (!fileName || !contentType) {
        return res.status(400).json({ error: 'fileName and contentType required' });
      }

      // Generate unique file path in private directory
      const fileKey = `${process.env.PRIVATE_OBJECT_DIR}/${Date.now()}-${fileName}`;
      
      // For Replit object storage, return the upload URL and file URL
      const uploadUrl = `${process.env.PUBLIC_BASE_URL}/api/objects/${encodeURIComponent(fileKey)}`;
      const fileUrl = uploadUrl;
      
      res.json({
        method: 'PUT',
        url: uploadUrl,
        fields: {},
        headers: {
          'Content-Type': contentType
        },
        fileUrl
      });
    } catch (error) {
      console.error('Object storage upload URL error:', error);
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  });

  // SECURITY FIX: Protected Object Storage Direct Upload Handler
  app.put('/api/objects/*', (req: any, res) => {
    // CRITICAL: Add authentication guard
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required for file uploads' });
    }

    try {
      // For demo purposes, simulate successful upload
      // In production, this would be handled by actual object storage
      const filePath = req.params[0];
      const fileUrl = `${process.env.PUBLIC_BASE_URL}/api/objects/${filePath}`;
      
      console.log('✅ Authenticated file upload:', { 
        userId: (req.user as any)?.user?.id || (req.user as any)?.claims?.sub, 
        filePath 
      });
      
      res.json({
        success: true,
        fileUrl,
        message: 'File uploaded successfully'
      });
    } catch (error) {
      console.error('Object upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // Object Storage File Retrieval
  app.get('/api/objects/*', (req, res) => {
    // For demo, return a placeholder response
    // In production, this would serve the actual file from object storage
    res.status(200).json({ 
      message: 'File access simulated', 
      path: (req.params as any)[0] 
    });
  });

  // PHASE 1 PRIORITY ROUTES

  // ==================== USERS ====================
  app.get("/api/users/:id", 
    validateRequest(z.object({ id: z.string().min(1, "User ID required") }), 'params'),
    async (req: any, res) => {
      try {
        console.log(`🔍 Fetching user [${req.requestId}]:`, { userId: req.params.id });
        const user = await storage.getUser(req.params.id);
        if (!user) {
          return res.status(404).json({ 
            error: "User not found", 
            message: "No user exists with the provided ID",
            requestId: req.requestId
          });
        }
        res.json(user);
      } catch (error) {
        handleRouteError(error, req, res, "Get user by ID", 500);
      }
    }
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

  app.post("/api/users", 
    validateRequest(insertUserSchema),
    async (req: any, res) => {
      try {
        console.log(`👤 Creating new user [${req.requestId}]:`, { 
          email: req.body.email,
          role: req.body.role 
        });
        const validated = insertUserSchema.parse(req.body);
        const user = await storage.createUser(validated);
        
        console.log(`✅ User created successfully [${req.requestId}]:`, { userId: user.id });
        res.status(201).json(user);
      } catch (error) {
        handleRouteError(error, req, res, "Create user", 500);
      }
    }
  );

  app.patch("/api/users/:id", 
    validateRequest(z.object({ id: z.string().min(1) }), 'params'),
    validateRequest(insertUserSchema.partial()),
    async (req: any, res) => {
      try {
        console.log(`✏️ Updating user [${req.requestId}]:`, { 
          userId: req.params.id,
          updateFields: Object.keys(req.body)
        });
        
        const updates = insertUserSchema.partial().parse(req.body);
        const user = await storage.updateUser(req.params.id, updates);
        
        if (!user) {
          return res.status(404).json({ 
            error: "User not found",
            message: "No user exists with the provided ID",
            requestId: req.requestId
          });
        }
        
        console.log(`✅ User updated successfully [${req.requestId}]:`, { userId: user.id });
        res.json(user);
      } catch (error) {
        handleRouteError(error, req, res, "Update user", 500);
      }
    }
  );

  // ==================== PROFILES ====================
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

  app.get("/api/profiles/user/:userId", async (req, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.params.userId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  app.post("/api/profiles", 
    isAuthenticated,
    async (req: any, res) => {
      try {
        const user = req.user?.user || req.user;
        const userId = user?.id;
        
        if (!userId) {
          return res.status(401).json({ error: 'unauthorized' });
        }

        console.log(`👤 Creating new profile [${req.requestId}]:`, { 
          userId: userId 
        });
        
        // Add userId from authenticated session to the request body
        const dataWithUserId = {
          ...req.body,
          userId: userId
        };
        
        // Now validate the complete data including userId
        const validated = insertProfileSchema.parse(dataWithUserId);
        const profile = await storage.createProfile(validated);
        
        console.log(`✅ Profile created successfully [${req.requestId}]:`, { profileId: profile.id });
        res.status(201).json({ profile });
      } catch (error) {
        handleRouteError(error, req, res, "Create profile", 500);
      }
    }
  );

  app.patch("/api/profiles/:id", 
    validateRequest(z.object({ id: z.string().min(1) }), 'params'),
    validateRequest(insertProfileSchema.partial()),
    async (req: any, res) => {
      try {
        console.log(`📝 Updating profile [${req.requestId}]:`, { 
          profileId: req.params.id,
          updateFields: Object.keys(req.body)
        });
        
        const updates = insertProfileSchema.partial().parse(req.body);
        const profile = await storage.updateProfile(req.params.id, updates);
        
        if (!profile) {
          return res.status(404).json({ 
            error: "Profile not found",
            message: "No profile exists with the provided ID",
            requestId: req.requestId
          });
        }
        
        console.log(`✅ Profile updated successfully [${req.requestId}]:`, { profileId: profile.id });
        res.json(profile);
      } catch (error) {
        handleRouteError(error, req, res, "Update profile", 500);
      }
    }
  );

  // Advanced Profile Search - Critical for talent discovery
  app.get("/api/profiles/search", async (req, res) => {
    try {
      const filters = {
        location: req.query.location as string,
        skills: req.query.skills ? (req.query.skills as string).split(',') : undefined,
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
  app.post("/api/lead-intake", 
    validateRequest(insertLeadIntakeSchema), 
    async (req, res) => {
      try {
        console.log(`📝 Lead intake submission started [${(req as any).requestId}]:`, {
          email: req.body.email,
          company: req.body.companyName,
          serviceType: req.body.serviceType,
          urgencyLevel: req.body.urgencyLevel,
          budgetRange: req.body.budgetRange
        });

        // Create lead intake with automatic scoring
        const leadIntake = await storage.createLeadIntake(req.body);
        
        console.log(`✅ Lead intake created successfully [${(req as any).requestId}]:`, { 
          leadId: leadIntake.id,
          leadScore: leadIntake.leadScore,
          status: leadIntake.status
        });

        // Send lead to Go-High-Level CRM
        const ghlResult = await ghlService.sendLeadToGHL(leadIntake);
        if (ghlResult.success && ghlResult.ghlContactId) {
          console.log(`🎯 Lead successfully sent to GHL: Contact ID ${ghlResult.ghlContactId}`);
          // Optionally update the lead with GHL contact ID
          await storage.updateLeadIntake(leadIntake.id, {
            internalNotes: `GHL Contact ID: ${ghlResult.ghlContactId}`
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
          message: "Thank you for your interest! We'll contact you within 24 hours.",
          nextSteps: "Our team will reach out to schedule a discovery call to discuss your specific needs."
        });
        
      } catch (error) {
        handleRouteError(error, req, res, "Create lead intake", 500);
      }
    }
  );

  app.get("/api/lead-intake/:id", async (req, res) => {
    try {
      const leadIntake = await storage.getLeadIntake(req.params.id);
      if (!leadIntake) {
        return res.status(404).json({ 
          error: "Lead intake not found",
          requestId: (req as any).requestId
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
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create skill" });
    }
  });

  // ==================== USER SKILLS ====================
  app.get("/api/users/:userId/skills", async (req, res) => {
    try {
      const includeNames = req.query.includeNames === 'true';
      const userSkills = includeNames 
        ? await storage.getUserSkillsWithNames(req.params.userId)
        : await storage.getUserSkills(req.params.userId);
      res.json(userSkills);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user skills" });
    }
  });

  app.post("/api/users/:userId/skills", async (req, res) => {
    try {
      const validated = insertUserSkillSchema.parse({
        ...req.body,
        userId: req.params.userId
      });
      const userSkill = await storage.createUserSkill(validated);
      res.status(201).json(userSkill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create user skill" });
    }
  });

  app.patch("/api/user-skills/:id", async (req, res) => {
    try {
      const updates = insertUserSkillSchema.partial().parse(req.body);
      const userSkill = await storage.updateUserSkill(Number(req.params.id), updates);
      if (!userSkill) {
        return res.status(404).json({ error: "User skill not found" });
      }
      res.json(userSkill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update user skill" });
    }
  });

  app.delete("/api/user-skills/:id", async (req, res) => {
    try {
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
        minBudget: req.query.minBudget ? Number(req.query.minBudget) : undefined,
        maxBudget: req.query.maxBudget ? Number(req.query.maxBudget) : undefined,
        skills: req.query.skills ? (req.query.skills as string).split(',') : undefined,
        status: req.query.status as string || 'open',
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

  app.post("/api/jobs", async (req, res) => {
    try {
      const validated = insertJobSchema.parse(req.body);
      const job = await storage.createJob(validated);
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create job" });
    }
  });

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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
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
        jobId: req.params.jobId
      });
      const jobSkill = await storage.createJobSkill(validated);
      res.status(201).json(jobSkill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
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
        skills: req.query.skills ? (req.query.skills as string).split(',') : undefined,
        minRate: req.query.minRate ? Number(req.query.minRate) : undefined,
        maxRate: req.query.maxRate ? Number(req.query.maxRate) : undefined,
        timezone: req.query.timezone as string,
        contractType: req.query.contractType as string,
        category: req.query.category as string,
        experienceLevel: req.query.experienceLevel as string,
      };

      console.log(`🎯 Calculating job matches for user ${userId} with filters:`, filters);
      
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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      // Handle unique constraint violation for duplicate proposals
      if (error instanceof Error && error.message.includes('unique') && error.message.includes('proposals_job_talent')) {
        return res.status(409).json({ error: "You have already submitted a proposal for this job" });
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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
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

  app.get("/api/talents/:talentId/proposals", isAuthenticated, async (req: any, res) => {
    try {
      // SECURITY: Use authenticated user ID from session, not URL parameter
      // This prevents user enumeration and unauthorized access to proposals
      const authenticatedUserId = req.user.claims.sub;
      
      if (!authenticatedUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Only return proposals for the authenticated user (ignore URL parameter)
      const proposals = await storage.listProposalsByTalent(authenticatedUserId);
      res.json(proposals);
    } catch (error) {
      res.status(500).json({ error: "Failed to get talent proposals" });
    }
  });

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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update contract" });
    }
  });

  app.get("/api/clients/:clientId/contracts", async (req, res) => {
    try {
      const contracts = await storage.listContractsByClient(req.params.clientId);
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get client contracts" });
    }
  });

  app.get("/api/talents/:talentId/contracts", async (req, res) => {
    try {
      const contracts = await storage.listContractsByTalent(req.params.talentId);
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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
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
      const milestones = await storage.listMilestonesByContract(req.params.contractId);
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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create milestone" });
    }
  });

  // Time Entries
  app.get("/api/contracts/:contractId/time-entries", async (req, res) => {
    try {
      const entries = await storage.listTimeEntriesByContract(req.params.contractId);
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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create time entry" });
    }
  });

  // Reviews
  app.get("/api/users/:userId/reviews", async (req, res) => {
    try {
      const asReviewer = req.query.as_reviewer === 'true';
      const reviews = await storage.listReviewsByUser(req.params.userId, asReviewer);
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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  // Portfolio
  app.get("/api/talents/:talentId/portfolio", async (req, res) => {
    try {
      const items = await storage.listPortfolioItemsByTalent(req.params.talentId);
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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
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
      const unreadOnly = req.query.unread_only === 'true';
      const notifications = await storage.listNotificationsByUser(req.params.userId, unreadOnly);
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
        return res.status(400).json({ error: "Validation failed", details: error.errors });
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
          linkedinProfile: existingProfile
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
          skills: ["JavaScript", "React", "Node.js"]
        }
      };

      const createdProfile = await storage.createLinkedinProfile(linkedinProfile);
      
      res.json({
        status: "connected",
        linkedinProfile: createdProfile
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
        return res.status(404).json({ error: "LinkedIn profile not found or not connected" });
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
        languages: ["English"]
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
          timezone: "Asia/Manila"
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
              category: "Technical"
            });
          }

          // Add user skill if not already exists
          const existingUserSkills = await storage.getUserSkills(userId);
          const hasSkill = existingUserSkills.some(us => us.skillId === skill!.id);
          
          if (!hasSkill) {
            await storage.createUserSkill({
              userId,
              skillId: skill.id,
              level: "intermediate",
              yearsExperience: 2
            });
          }
        }
      }

      // Update LinkedIn profile sync timestamp
      await storage.updateLinkedinProfile(linkedinProfile.id, {
        lastSync: new Date()
      });

      res.json({
        status: "imported",
        profile,
        importedData: {
          personalInfo: !!profileData.firstName,
          skills: profileData.skills?.length || 0,
          experience: profileData.experience?.length || 0,
          education: profileData.education?.length || 0
        }
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
        return res.status(400).json({ error: "Resume text and user ID required" });
      }

      // Simple resume parsing logic (can be enhanced with NLP)
      const parsedData = parseResumeText(resumeText);
      
      res.json({
        status: "parsed",
        parsedData
      });
    } catch (error) {
      console.error("Resume parsing error:", error);
      res.status(500).json({ error: "Failed to parse resume" });
    }
  });

  // Get LinkedIn connection status
  app.get("/api/linkedin/status/:userId", async (req, res) => {
    try {
      const linkedinProfile = await storage.getLinkedinProfileByUserId(req.params.userId);
      
      res.json({
        isConnected: !!linkedinProfile,
        lastSync: linkedinProfile?.lastSync || null,
        profileUrl: linkedinProfile?.profileUrl || null
      });
    } catch (error) {
      console.error("LinkedIn status error:", error);
      res.status(500).json({ error: "Failed to get LinkedIn status" });
    }
  });

  // Vanessa AI Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      
      if (!process.env.OPENAI_API_KEY) {
        return res.status(401).json({ 
          error: "Service not configured. Please add your OPENAI_API_KEY to continue using your virtual assistant." 
        });
      }

      // Import OpenAI dynamically
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // System prompt for Vanessa
      const systemMessage = {
        role: "system" as const,
        content: `You are Vanessa, and you work at OnSpot helping people understand how outsourcing can transform their business. You're talking to someone who's exploring OnSpot's services.

About OnSpot (share naturally in conversation):
- We help businesses get premium Filipino teams that cut costs by up to 70% and fuel serious growth
- Our 4-stage process: Let's Implement → Build Your Team → Start Operations → We Innovate Together  
- We offer Resourced (you manage), Managed (we handle everything), and Enterprise solutions
- We've helped 85+ clients deploy 500+ team members with $50M+ in value delivered
- Jake Wainberg leads from New York, Nur Laminero runs operations in Manila
- We specialize in customer support, technical support, virtual assistants, back-office work, and more
- Usually get teams deployed in about 21 days
- 96% of our clients are happy, 94% stick with us

Your personality:
- Talk like a real person who genuinely cares about helping
- Be enthusiastic but not pushy - you love what OnSpot does
- Share insights from your experience working with different businesses
- Ask questions to understand what they really need
- Use casual, conversational language - contractions, natural flow
- Be encouraging and supportive about their business challenges
- When discussing numbers/ROI, speak from experience not like you're reciting facts

Keep it conversational and natural. Ask follow-up questions that show you're listening and want to help them find the right solution.`
      };

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [systemMessage, ...messages],
        max_tokens: 250,
        temperature: 0.7,
      });

      const assistantMessage = completion.choices[0]?.message?.content || "Sorry, I'm having a bit of trouble right now! Give me another try in just a sec.";

      res.json({ message: assistantMessage });
    } catch (error) {
      console.error('Chat API error:', error);
      res.status(500).json({ 
        error: "Hmm, something's not quite right on my end. Give me a moment and try again!" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function for resume parsing
function parseResumeText(resumeText: string): any {
  const lines = resumeText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const parsedData = {
    personalInfo: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      title: "",
      location: ""
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
    }>
  };

  let currentSection = "";
  let nameFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();

    // Extract name (usually first non-empty line)
    if (!nameFound && line.length > 2 && !line.includes('@') && !line.includes('http')) {
      const nameParts = line.split(' ').filter(part => part.length > 1);
      if (nameParts.length >= 2) {
        parsedData.personalInfo.firstName = nameParts[0];
        parsedData.personalInfo.lastName = nameParts.slice(1).join(' ');
        nameFound = true;
        continue;
      }
    }

    // Extract email
    const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
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
    if (upperLine.includes('EXPERIENCE') || upperLine.includes('WORK') || upperLine.includes('EMPLOYMENT')) {
      currentSection = "experience";
      continue;
    }
    if (upperLine.includes('EDUCATION') || upperLine.includes('ACADEMIC')) {
      currentSection = "education";
      continue;
    }
    if (upperLine.includes('SKILL') || upperLine.includes('TECHNICAL')) {
      currentSection = "skills";
      continue;
    }
    if (upperLine.includes('CERTIFICATION') || upperLine.includes('CERTIFICATE')) {
      currentSection = "certifications";
      continue;
    }
    if (upperLine.includes('SUMMARY') || upperLine.includes('PROFILE') || upperLine.includes('OBJECTIVE')) {
      currentSection = "summary";
      continue;
    }

    // Extract title (look for common professional titles)
    if (!parsedData.personalInfo.title && (
      upperLine.includes('DEVELOPER') || upperLine.includes('ENGINEER') || 
      upperLine.includes('MANAGER') || upperLine.includes('ANALYST') ||
      upperLine.includes('DESIGNER') || upperLine.includes('CONSULTANT')
    )) {
      parsedData.personalInfo.title = line;
      continue;
    }

    // Process content based on current section
    if (currentSection === "skills" && line.length > 2) {
      // Split skills by common delimiters
      const skillsInLine = line.split(/[,•·|]/).map(s => s.trim()).filter(s => s.length > 1);
      parsedData.skills.push(...skillsInLine);
    } else if (currentSection === "summary" && line.length > 10) {
      parsedData.summary += (parsedData.summary ? " " : "") + line;
    } else if (currentSection === "experience" && line.length > 3) {
      // Simple experience parsing - look for job titles and companies
      if (upperLine.includes('DEVELOPER') || upperLine.includes('ENGINEER') || upperLine.includes('MANAGER')) {
        parsedData.experience.push({
          title: line,
          company: "",
          duration: "",
          description: ""
        });
      }
    }
  }

  // Clean up and deduplicate skills
  parsedData.skills = Array.from(new Set(parsedData.skills))
    .filter(skill => skill.length > 1 && skill.length < 30)
    .slice(0, 20); // Limit to 20 skills

  return parsedData;
}
