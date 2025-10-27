import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, json, jsonb, serial, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth integration
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique(), // Now optional for Replit Auth
  email: varchar("email").unique(), // From Replit Auth
  firstName: varchar("first_name"), // From Replit Auth
  lastName: varchar("last_name"), // From Replit Auth  
  profileImageUrl: varchar("profile_image_url"), // From Replit Auth
  passwordHash: text("password_hash"), // For email/password auth (nullable for OAuth users)
  company: text("company"), // Company name for clients and potentially talents
  role: text("role").notNull().default("client"), // client, talent, admin
  replitId: text("replit_id").unique(), // For Replit Auth integration
  stripeAccountId: text("stripe_account_id"), // For talent payouts
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Profiles
export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id), // 1:1 relationship
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  title: text("title"), // Professional title
  bio: text("bio"),
  location: text("location").default("Global"),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  rateCurrency: text("rate_currency").default("USD"), // USD or PHP
  availability: text("availability").default("available"), // available, busy, offline
  profilePicture: text("profile_picture"),
  phoneNumber: text("phone_number"),
  languages: text("languages").array().default(["English"]),
  timezone: text("timezone").default("Asia/Manila"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  totalEarnings: decimal("total_earnings", { precision: 12, scale: 2 }).default("0"),
  jobSuccessScore: integer("job_success_score").default(0), // 0-100
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Skills
export const skills = pgTable("skills", {
  id: serial("id").primaryKey(), // Keep serial for consistency with existing pattern
  name: text("name").notNull().unique(),
  category: text("category").notNull(), // Technical, Creative, Admin, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// User Skills (many-to-many)
export const userSkills = pgTable("user_skills", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  skillId: integer("skill_id").notNull().references(() => skills.id), // References serial skills.id
  level: text("level").notNull().default("intermediate"), // beginner, intermediate, expert
  yearsExperience: integer("years_experience").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Jobs/Projects
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  contractType: text("contract_type").notNull(), // hourly, fixed
  budget: decimal("budget", { precision: 10, scale: 2 }),
  budgetCurrency: text("budget_currency").default("USD"), // USD or PHP
  hourlyRateMin: decimal("hourly_rate_min", { precision: 8, scale: 2 }),
  hourlyRateMax: decimal("hourly_rate_max", { precision: 8, scale: 2 }),
  duration: text("duration"), // Less than 1 month, 1-3 months, etc.
  experienceLevel: text("experience_level").notNull(), // entry, intermediate, expert
  status: text("status").notNull().default("open"), // open, in_progress, completed, cancelled
  proposalCount: integer("proposal_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposals
export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  talentId: varchar("talent_id").notNull().references(() => users.id),
  coverLetter: text("cover_letter").notNull(),
  proposedRate: decimal("proposed_rate", { precision: 8, scale: 2 }),
  proposedBudget: decimal("proposed_budget", { precision: 10, scale: 2 }),
  estimatedDuration: text("estimated_duration"),
  status: text("status").notNull().default("submitted"), // submitted, shortlisted, accepted, rejected, withdrawn
  clientResponse: text("client_response"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    proposalsJobTalentUnique: uniqueIndex("proposals_job_talent_unique").on(table.jobId, table.talentId),
  }
});

// Job Skills (normalized for better querying)
export const jobSkills = pgTable("job_skills", {
  id: serial("id").primaryKey(),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  skillId: integer("skill_id").notNull().references(() => skills.id),
  required: boolean("required").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Lead Intake - BPO Industry Lead Generation
export const leadIntakes = pgTable("lead_intakes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Contact Information
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: varchar("email").notNull(),
  phoneNumber: text("phone_number"),
  jobTitle: text("job_title"), // CEO, Operations Manager, etc.
  
  // Company Information
  companyName: text("company_name").notNull(),
  companySize: text("company_size").notNull(), // 1-10, 11-50, 51-200, 200+
  industry: text("industry").notNull(),
  companyWebsite: text("company_website"),
  
  // Service Requirements
  serviceType: text("service_type").notNull(), // customer_support, virtual_assistant, technical_support, etc.
  serviceVolume: text("service_volume"), // hours per week, calls per day, etc.
  currentChallenges: text("current_challenges").notNull(),
  requiredSkills: text("required_skills").array().default([]),
  
  // Project Scope
  urgencyLevel: text("urgency_level").notNull(), // immediate, within_month, within_quarter, planning
  budgetRange: text("budget_range").notNull(), // <$5k, $5k-20k, $20k-50k, $50k+
  expectedStartDate: text("expected_start_date"),
  serviceHours: text("service_hours"), // timezone requirements
  teamSize: text("team_size"), // number of resources needed
  
  // Qualification
  hasCurrentProvider: boolean("has_current_provider").default(false),
  currentProviderDetails: text("current_provider_details"),
  decisionMakerStatus: text("decision_maker_status").notNull(), // decision_maker, influencer, evaluator
  implementationTimeline: text("implementation_timeline"),
  
  // Lead Status
  status: text("status").notNull().default("new"), // new, qualified, scheduled, contacted, converted, lost
  leadScore: integer("lead_score").default(0), // 0-100 scoring
  
  // Calendar Integration
  appointmentScheduled: boolean("appointment_scheduled").default(false),
  appointmentDateTime: timestamp("appointment_date_time"),
  appointmentType: text("appointment_type"), // discovery_call, demo, consultation
  calendarEventId: text("calendar_event_id"), // For Outlook integration
  
  // UTM and Source Tracking
  source: text("source").default("website"), // website, referral, social, ads
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  referringPage: text("referring_page"),
  
  // Additional Notes
  additionalNotes: text("additional_notes"),
  internalNotes: text("internal_notes"), // For sales team use
  
  // GHL Integration
  syncedToGhl: boolean("synced_to_ghl").default(false),
  ghlContactId: text("ghl_contact_id"),
  ghlOpportunityId: text("ghl_opportunity_id"),
  ghlSyncedAt: timestamp("ghl_synced_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  scheduledAt: timestamp("scheduled_at"), // When appointment was scheduled
});

// Waitlist - Contact form submissions from Access Portal
export const waitlist = pgTable("waitlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  fullName: text("full_name").notNull(),
  businessName: text("business_name"),
  phone: text("phone"),
  status: text("status").notNull().default("new"), // new, contacted, converted
  
  // GHL Integration
  syncedToGhl: boolean("synced_to_ghl").default(false),
  ghlContactId: text("ghl_contact_id"),
  ghlSyncedAt: timestamp("ghl_synced_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Contracts
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  proposalId: varchar("proposal_id").notNull().references(() => proposals.id),
  clientId: varchar("client_id").notNull().references(() => users.id),
  talentId: varchar("talent_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  contractType: text("contract_type").notNull(), // hourly, fixed
  rate: decimal("rate", { precision: 8, scale: 2 }),
  totalBudget: decimal("total_budget", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("active"), // active, paused, completed, cancelled
  terms: text("terms"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Milestones (for fixed contracts)
export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id),
  title: text("title").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("pending"), // pending, funded, in_progress, submitted, approved, paid
  submissionNote: text("submission_note"),
  approvalNote: text("approval_note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Time Entries (for hourly contracts)
export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id),
  talentId: varchar("talent_id").notNull().references(() => users.id),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // minutes
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("logged"), // logged, submitted, approved, paid
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages & Communication
export const messageThreads = pgTable("message_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  participants: text("participants").array().notNull(), // Array of user IDs
  subject: text("subject"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => messageThreads.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  attachments: text("attachments").array(), // File URLs
  messageType: text("message_type").default("text"), // text, file, system
  readBy: text("read_by").array().default([]), // Array of user IDs who read
  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews & Ratings
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id),
  reviewerId: varchar("reviewer_id").notNull().references(() => users.id),
  revieweeId: varchar("reviewee_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(), // 1-5 stars
  title: text("title"),
  comment: text("comment"),
  skills: json("skills"), // Skill ratings
  isPublic: boolean("is_public").default(true),
  response: text("response"), // Reviewee response
  createdAt: timestamp("created_at").defaultNow(),
});

// Portfolio Items
export const portfolioItems = pgTable("portfolio_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  talentId: varchar("talent_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  projectUrl: text("project_url"),
  imageUrls: text("image_urls").array(),
  skills: text("skills").array(),
  completionDate: timestamp("completion_date"),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Certifications
export const certifications = pgTable("certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  talentId: varchar("talent_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  issuingOrganization: text("issuing_organization").notNull(),
  credentialId: text("credential_id"),
  credentialUrl: text("credential_url"),
  issueDate: timestamp("issue_date"),
  expiryDate: timestamp("expiry_date"),
  skills: text("skills").array(),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Skills Tests  
export const skillsTests = pgTable("skills_tests", {
  id: serial("id").primaryKey(),
  skillId: integer("skill_id").notNull().references(() => skills.id),
  title: text("title").notNull(),
  description: text("description"),
  questions: json("questions").notNull(), // Array of questions with multiple choice
  duration: integer("duration").notNull(), // minutes
  passingScore: integer("passing_score").default(70),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const testAttempts = pgTable("test_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: integer("test_id").notNull().references(() => skillsTests.id),
  talentId: varchar("talent_id").notNull().references(() => users.id),
  score: integer("score"),
  passed: boolean("passed").default(false),
  answers: json("answers"), // User answers
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Payment & Financial
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id),
  milestoneId: varchar("milestone_id").references(() => milestones.id),
  payerId: varchar("payer_id").notNull().references(() => users.id),
  payeeId: varchar("payee_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  fees: decimal("fees", { precision: 12, scale: 2 }).default("0"),
  currency: text("currency").default("USD"),
  paymentMethod: text("payment_method"), // stripe_card, bank_transfer, etc.
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed, refunded
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Disputes
export const disputes = pgTable("disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id),
  raisedById: varchar("raised_by_id").notNull().references(() => users.id),
  disputeType: text("dispute_type").notNull(), // payment, quality, deadline, other
  title: text("title").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence").array(), // File URLs
  status: text("status").notNull().default("open"), // open, in_review, resolved, closed
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// LinkedIn Integration
export const linkedinProfiles = pgTable("linkedin_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  linkedinId: text("linkedin_id").unique(),
  profileUrl: text("profile_url"),
  accessToken: text("access_token"), // Encrypted
  refreshToken: text("refresh_token"), // Encrypted
  isVerified: boolean("is_verified").default(false),
  lastSync: timestamp("last_sync"),
  profileData: json("profile_data"), // Cached LinkedIn profile data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Resume and Document Management
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // resume, cover_letter, portfolio_file, video_intro
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(), // Object storage URL
  fileSize: integer("file_size"), // in bytes
  mimeType: text("mime_type"),
  isPublic: boolean("is_public").default(false),
  isPrimary: boolean("is_primary").default(false), // Primary resume/video
  extractedText: text("extracted_text"), // For resume parsing
  createdAt: timestamp("created_at").defaultNow(),
});

// Assessments and Tests
export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // writing, disc, technical, behavioral
  title: text("title").notNull(),
  description: text("description"),
  questions: json("questions").notNull(), // Array of questions
  scoringRubric: json("scoring_rubric").notNull(),
  duration: integer("duration").notNull(), // minutes
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assessmentResults = pgTable("assessment_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: integer("assessment_id").notNull().references(() => assessments.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  answers: json("answers").notNull(),
  score: decimal("score", { precision: 5, scale: 2 }), // Overall score
  results: json("results"), // Detailed results/analysis
  timeSpent: integer("time_spent"), // minutes
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Job Application Tracking
export const jobApplications = pgTable("job_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  jobId: varchar("job_id").references(() => jobs.id), // Can be null for external jobs
  externalJobTitle: text("external_job_title"), // For non-platform jobs
  externalJobCompany: text("external_job_company"),
  externalJobUrl: text("external_job_url"),
  status: text("status").notNull().default("applied"), // applied, under_review, interviewed, rejected, hired
  appliedAt: timestamp("applied_at").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  notes: text("notes"),
  interviewDate: timestamp("interview_date"),
  salary: decimal("salary", { precision: 10, scale: 2 }),
  salaryCurrency: text("salary_currency").default("USD"),
});

// Smart Matching Profile
export const matchingProfiles = pgTable("matching_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  workStylePreferences: json("work_style_preferences"), // Remote, hybrid, schedule preferences
  compensationExpectations: json("compensation_expectations"), // Min/max rates, benefits
  projectTypePreferences: json("project_type_preferences"), // Long-term, short-term, contract types
  industryPreferences: text("industry_preferences").array(),
  availabilityCalendar: json("availability_calendar"), // Weekly availability schedule
  communicationStyle: json("communication_style"), // From DISC results
  careerGoals: text("career_goals"),
  dealBreakers: text("deal_breakers").array(), // What they won't accept
  matchingScore: decimal("matching_score", { precision: 5, scale: 2 }), // AI-calculated overall score
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // proposal_received, contract_created, payment_completed, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: varchar("related_id"), // ID of related entity (job, contract, etc.)
  relatedType: text("related_type"), // job, contract, payment, etc.
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas and types
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  role: true,
  replitId: true,
  stripeAccountId: true,
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSkillSchema = createInsertSchema(skills).omit({
  id: true,
  createdAt: true,
});

export const insertUserSkillSchema = createInsertSchema(userSkills).omit({
  id: true,
  createdAt: true,
});

export const insertJobSkillSchema = createInsertSchema(jobSkills).omit({
  id: true,
  createdAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  proposalCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMilestoneSchema = createInsertSchema(milestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
});

export const insertMessageThreadSchema = createInsertSchema(messageThreads).omit({
  id: true,
  lastMessageAt: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  readBy: true,
  createdAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export const insertPortfolioItemSchema = createInsertSchema(portfolioItems).omit({
  id: true,
  createdAt: true,
});

export const insertCertificationSchema = createInsertSchema(certifications).omit({
  id: true,
  verified: true,
  createdAt: true,
});

export const insertSkillsTestSchema = createInsertSchema(skillsTests).omit({
  id: true,
  createdAt: true,
});

export const insertTestAttemptSchema = createInsertSchema(testAttempts).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  fees: true,
  createdAt: true,
  completedAt: true,
});

export const insertDisputeSchema = createInsertSchema(disputes).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export const insertLinkedinProfileSchema = createInsertSchema(linkedinProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({
  id: true,
  createdAt: true,
});

export const insertAssessmentResultSchema = createInsertSchema(assessmentResults).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertJobApplicationSchema = createInsertSchema(jobApplications).omit({
  id: true,
  appliedAt: true,
  lastUpdated: true,
});

export const insertMatchingProfileSchema = createInsertSchema(matchingProfiles).omit({
  id: true,
  matchingScore: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  isRead: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Skill = typeof skills.$inferSelect;

export type InsertUserSkill = z.infer<typeof insertUserSkillSchema>;
export type UserSkill = typeof userSkills.$inferSelect;

export type InsertJobSkill = z.infer<typeof insertJobSkillSchema>;
export type JobSkill = typeof jobSkills.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;

export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;

export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestones.$inferSelect;

export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;

export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>;
export type MessageThread = typeof messageThreads.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

export type InsertPortfolioItem = z.infer<typeof insertPortfolioItemSchema>;
export type PortfolioItem = typeof portfolioItems.$inferSelect;

export type InsertCertification = z.infer<typeof insertCertificationSchema>;
export type Certification = typeof certifications.$inferSelect;

export type InsertSkillsTest = z.infer<typeof insertSkillsTestSchema>;
export type SkillsTest = typeof skillsTests.$inferSelect;

export type InsertTestAttempt = z.infer<typeof insertTestAttemptSchema>;
export type TestAttempt = typeof testAttempts.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export type InsertDispute = z.infer<typeof insertDisputeSchema>;
export type Dispute = typeof disputes.$inferSelect;

export type InsertLinkedinProfile = z.infer<typeof insertLinkedinProfileSchema>;
export type LinkedinProfile = typeof linkedinProfiles.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export const insertLeadIntakeSchema = createInsertSchema(leadIntakes).omit({
  id: true,
  status: true,
  leadScore: true,
  createdAt: true,
  updatedAt: true,
  scheduledAt: true,
});

export type InsertLeadIntake = z.infer<typeof insertLeadIntakeSchema>;
export type LeadIntake = typeof leadIntakes.$inferSelect;

export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessments.$inferSelect;

export type InsertAssessmentResult = z.infer<typeof insertAssessmentResultSchema>;
export type AssessmentResult = typeof assessmentResults.$inferSelect;

export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;
export type JobApplication = typeof jobApplications.$inferSelect;

export type InsertMatchingProfile = z.infer<typeof insertMatchingProfileSchema>;
export type MatchingProfile = typeof matchingProfiles.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Replit Auth types for user management
export type UpsertUser = typeof users.$inferInsert;

// CSV Talent Import Schemas
export const csvTalentRowSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Valid email address required"),
  title: z.string().min(1, "Professional title is required").max(200),
  bio: z.string().min(10, "Bio must be at least 10 characters").max(2000),
  location: z.string().default("Global").optional(),
  hourlyRate: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val.replace(/[^\d.-]/g, '')) : val;
    return isNaN(num) ? undefined : num;
  }).optional(),
  rateCurrency: z.enum(["USD", "PHP"]).default("USD").optional(),
  availability: z.enum(["available", "busy", "offline"]).default("available").optional(),
  phoneNumber: z.string().optional(),
  languages: z.string().transform((val) => {
    if (!val) return ["English"];
    return val.split(',').map(lang => lang.trim()).filter(lang => lang.length > 0);
  }).default("English").optional(),
  timezone: z.string().default("Asia/Manila").optional(),
  skills: z.string().transform((val) => {
    if (!val) return [];
    return val.split(',').map(skill => skill.trim()).filter(skill => skill.length > 0);
  }).default("").optional(),
});

export const csvBulkImportSchema = z.object({
  rows: z.array(csvTalentRowSchema).min(1, "At least one talent row is required"),
  validateOnly: z.boolean().default(false),
  skipDuplicateEmails: z.boolean().default(true),
});

export const csvImportResultSchema = z.object({
  success: z.boolean(),
  totalRows: z.number(),
  successfulRows: z.number(),
  failedRows: z.number(),
  results: z.array(z.object({
    rowIndex: z.number(),
    email: z.string(),
    success: z.boolean(),
    userId: z.string().optional(),
    profileId: z.string().optional(),
    error: z.string().optional(),
    warnings: z.array(z.string()).default([]),
  })),
  duplicateEmails: z.array(z.string()).default([]),
  skillsCreated: z.array(z.string()).default([]),
  summary: z.object({
    usersCreated: z.number(),
    profilesCreated: z.number(),
    skillsLinked: z.number(),
    duplicatesSkipped: z.number(),
    errors: z.number(),
  }),
});

export const csvTemplateSchema = z.object({
  headers: z.array(z.string()),
  sampleData: z.array(z.record(z.string())),
  fieldDescriptions: z.record(z.string()),
  requiredFields: z.array(z.string()),
  optionalFields: z.array(z.string()),
});

// CSV Import Types
export type CsvTalentRow = z.infer<typeof csvTalentRowSchema>;
export type CsvBulkImport = z.infer<typeof csvBulkImportSchema>;
export type CsvImportResult = z.infer<typeof csvImportResultSchema>;
export type CsvTemplate = z.infer<typeof csvTemplateSchema>;

// Bulk talent creation helper type
export type BulkTalentData = {
  user: InsertUser;
  profile: Omit<InsertProfile, 'userId'>;
  skills: string[];
};

// Vanessa AI Conversation Logs
export const vanessaLogs = pgTable("vanessa_logs", {
  id: serial("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  userMessage: text("user_message").notNull(),
  assistantResponse: text("assistant_response").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    threadIdIndex: index("vanessa_logs_thread_id_idx").on(table.threadId),
    createdAtIndex: index("vanessa_logs_created_at_idx").on(table.createdAt),
  };
});

export const insertVanessaLogSchema = createInsertSchema(vanessaLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertVanessaLog = z.infer<typeof insertVanessaLogSchema>;
export type VanessaLog = typeof vanessaLogs.$inferSelect;
