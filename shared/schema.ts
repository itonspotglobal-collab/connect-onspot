import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, json, serial, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
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
  location: text("location").default("Philippines"),
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

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
