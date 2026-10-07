import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, json, jsonb, serial, uniqueIndex, unique, index, uuid, date, check, pgSequence, primaryKey, AnyPgColumn } from "drizzle-orm/pg-core";
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

// Public investor enquiries are stored before attempting notification delivery.
export const investorRequests = pgTable("investor_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  firm: text("firm").notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  requestType: text("request_type").notNull(),
  message: text("message"),
  notificationStatus: text("notification_status").notNull().default("pending"),
  notificationError: text("notification_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  notificationSentAt: timestamp("notification_sent_at", { withTimezone: true }),
}, (table) => [
  index("idx_investor_requests_created_at").on(table.createdAt),
]);

// User storage table for Replit Auth integration
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique(), // Now optional for Replit Auth
  email: varchar("email").unique(), // From Replit Auth
  firstName: varchar("first_name"), // From Replit Auth
  lastName: varchar("last_name"), // From Replit Auth  
  profileImageUrl: varchar("profile_image_url"), // From Replit Auth
  passwordHash: text("password_hash"), // For email/password auth (nullable for OAuth users)
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  emailVerifiedEmail: text("email_verified_email"),
  emailVerificationRequired: boolean("email_verification_required").notNull().default(true),
  company: text("company"), // Company name for clients and potentially talents
  role: text("role").notNull().default("client"), // client, talent, admin
  replitId: text("replit_id").unique(), // For Replit Auth integration
  stripeAccountId: text("stripe_account_id"), // For talent payouts
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_role").on(table.role),
  index("idx_users_created_at").on(table.createdAt),
]);

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
  rateCurrency: text("rate_currency").default("USD"), // New rates are USD; retain historical currencies.
  availability: text("availability").default("available"), // available, busy, offline
  profilePicture: text("profile_picture"),
  phoneNumber: text("phone_number"),
  languages: text("languages").array().default(["English"]),
  timezone: text("timezone").default("UTC"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  totalEarnings: decimal("total_earnings", { precision: 12, scale: 2 }).default("0"),
  jobSuccessScore: integer("job_success_score").default(0), // 0-100
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_profiles_location").on(table.location),
  index("idx_profiles_availability").on(table.availability),
  index("idx_profiles_created_at").on(table.createdAt),
]);

// Client Profiles — company/hiring details for users with role = "client"
export const clientProfiles = pgTable("client_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  companyName: text("company_name"),
  contactPerson: text("contact_person"),
  email: varchar("email"),
  phoneNumber: text("phone_number"),
  website: text("website"),
  industry: text("industry"),
  companySize: text("company_size"),
  location: text("location"),
  about: text("about"),
  hiringNeeds: text("hiring_needs"),
  preferredRoles: text("preferred_roles").array().default([]),
  timezone: text("timezone"),
  msaAcceptedAt: timestamp("msa_accepted_at"),
  msaVersion: text("msa_version"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_profiles_industry").on(table.industry),
  index("idx_client_profiles_created_at").on(table.createdAt),
]);

export const insertClientProfileSchema = createInsertSchema(clientProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClientProfile = z.infer<typeof insertClientProfileSchema>;
export type ClientProfile = typeof clientProfiles.$inferSelect;

// Client organizations/workspaces. Organizations are additive to the existing
// individual Client account model; users may continue without one.
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  website: text("website"),
  industry: text("industry"),
  companySize: text("company_size"),
  location: text("location"),
  about: text("about"),
  timezone: text("timezone"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Deletion lifecycle — set when an owner schedules deletion; cleared on cancel;
  // rows whose delete_due_at has passed are permanently removed by scheduled cleanup.
  deleteRequestedAt: timestamp("delete_requested_at"),
  deleteRequestedBy: varchar("delete_requested_by").references(() => users.id),
  deleteDueAt: timestamp("delete_due_at"),
}, (table) => [
  index("idx_organizations_created_by").on(table.createdBy),
  index("idx_organizations_created_at").on(table.createdAt),
  index("idx_organizations_delete_due_at").on(table.deleteDueAt),
]);

export const organizationMembers = pgTable("organization_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner | member
  status: text("status").notNull().default("active"), // active | invited | suspended
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("organization_members_org_user_unique").on(table.organizationId, table.userId),
  index("idx_organization_members_user_id").on(table.userId),
  index("idx_organization_members_organization_id").on(table.organizationId),
  index("idx_organization_members_status").on(table.status),
]);

export const organizationInvitations = pgTable("organization_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: varchar("email").notNull(),
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // pending | accepted | declined | revoked | expired
  emailStatus: text("email_status").notNull().default("pending"), // pending | sent | failed
  emailError: text("email_error"),
  emailSentAt: timestamp("email_sent_at"),
  acceptedBy: varchar("accepted_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull().default(sql`NOW() + INTERVAL '30 days'`),
  respondedAt: timestamp("responded_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
  // SHA-256 hash of the raw token embedded in invitation URLs; raw token is never stored.
  tokenHash: text("token_hash"),
}, (table) => [
  index("idx_organization_invitations_organization_id").on(table.organizationId),
  index("idx_organization_invitations_email").on(table.email),
  index("idx_organization_invitations_status").on(table.status),
  index("idx_organization_invitations_expires_at").on(table.expiresAt),
]);

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
}, (table) => [
  index("idx_user_skills_user_id").on(table.userId),
  index("idx_user_skills_skill_id").on(table.skillId),
]);

// Jobs/Projects
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  // Role taxonomy (v2) — keeps title/category in sync for backward compat
  professionalRoleName: text("professional_role_name"),
  originalRoleName: text("original_role_name"),
  jobFunction: text("job_function"),
  otherFunction: text("other_function"),
  description: text("description").notNull(),
  company: text("company").default("OnSpot"),
  location: text("location").default("Remote"),
  category: text("category").notNull(),
  engagementType: text("engagement_type"), // Lite | Standard (nullable: unreviewed legacy rows stay NULL)
  billingMode: text("billing_mode"), // tracked | guaranteed; NULL means legacy/unclassified
  budget: decimal("budget", { precision: 10, scale: 2 }),
  budgetCurrency: text("budget_currency").default("USD"), // New pricing is USD; retain historical currencies.
  customCurrencyCode: text("custom_currency_code"), // 3-letter code when budgetCurrency = 'OTHER'
  salaryDisplay: text("salary_display"), // Free-text salary shown publicly, e.g. "$800 - $1,200/month"
  duration: text("duration"), // Less than 1 month, 1-3 months, etc.
  experienceLevel: text("experience_level").notNull(), // entry, intermediate, expert
  minimumEducation: text("minimum_education"),
  requiredSkills: jsonb("required_skills").$type<Array<{ name: string; years: string }>>().default([]),
  requiresUsTimezoneOverlap: boolean("requires_us_timezone_overlap").notNull().default(false),
  requiresFluentEnglish: boolean("requires_fluent_english").notNull().default(false),
  compensationDisplayType: text("compensation_display_type").default("range"),
  contractorEngagementConfirmed: boolean("contractor_engagement_confirmed").notNull().default(false),
  responsibilities: text("responsibilities").array(),
  requirements: text("requirements").array(),
  skillTags: text("skill_tags").array(),
  culturalFit: text("cultural_fit").array(),
  // Role profile identifiers
  reportingTo: text("reporting_to"),
  division: text("division"),
  jobCode: text("job_code"),
  jobGrade: text("job_grade"),
  jobLevel: text("job_level"),
  // Job Success Profile content sections (rich text / plain text)
  companyOverview: text("company_overview"),
  roleMission: text("role_mission"),
  keyOutcomes: text("key_outcomes"),
  keyResponsibilities: text("key_responsibilities"),
  skillsAndCompetencies: text("skills_and_competencies"),
  behavioralTraits: text("behavioral_traits"),
  kpis: text("kpis"),
  trainingAndSupport: text("training_and_support"),
  growthPath: text("growth_path"),
  // Public card preview summary (separate from full description)
  jobSummary: text("job_summary"),
  // System requirements
  minimumInternetSpeed: text("minimum_internet_speed"),
  systemRequirements: text("system_requirements"),
  requiredToolsSoftware: text("required_tools_software"),
  otherEquipmentRequirements: text("other_equipment_requirements"),
  // Work schedule
  workDays: text("work_days"),
  timeZone: text("time_zone"),
  // Preferred qualifications
  preferredQualifications: text("preferred_qualifications"),
  // Compensation extras
  compensationNotes: text("compensation_notes"),
  // What We Offer (rich text list)
  whatWeOffer: text("what_we_offer"),
  // Application link / method (per-job — admin + client controlled)
  applyLink: text("apply_link"),
  applicationMethod: text("application_method").default("built_in_form"), // external_link | built_in_form
  status: text("status").notNull().default("open"), // draft, open, in_progress, completed, cancelled
  draftStep: integer("draft_step"),
  // Approval workflow
  approvalStatus: text("approval_status").notNull().default("pending"), // pending | approved | rejected | linked_to_existing
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  isClientSubmitted: boolean("is_client_submitted").notNull().default(false),
  existingJobId: varchar("existing_job_id"), // set when approvalStatus = linked_to_existing
  urgentlyHiring: boolean("urgently_hiring").notNull().default(false),
  benefits: text("benefits"),
  hasCommission: boolean("has_commission").notNull().default(false),
  hasEquity: boolean("has_equity").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  isCompanyConfidential: boolean("is_company_confidential").notNull().default(false),
  requiresResume: boolean("requires_resume").notNull().default(false),
  requiresVideoIntro: boolean("requires_video_intro").notNull().default(false),
  applicationQuestions: jsonb("application_questions"), // [{ id, label, type, required, options? }]
  confidentialClientOverview: text("confidential_client_overview"), // public-safe description shown when isCompanyConfidential = true
  proposalCount: integer("proposal_count").default(0),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  postedAt: timestamp("posted_at"),
  originalPostedAt: timestamp("original_posted_at"),
  lastRefreshedAt: timestamp("last_refreshed_at"),
  // Distinguishes auto-created search-scaffold jobs from real postings.
  // 'manual' = intentionally created by admin or client
  // 'search_scaffold' = auto-created to back a Client search-to-shortlist session
  createdVia: text("created_via").notNull().default("manual"), // manual | search_scaffold
}, (table) => [
  index("idx_jobs_client_id").on(table.clientId),
  index("idx_jobs_status").on(table.status),
  index("idx_jobs_approval_status").on(table.approvalStatus),
  index("idx_jobs_category").on(table.category),
  index("idx_jobs_created_at").on(table.createdAt),
  index("idx_jobs_posted_at").on(table.postedAt),
  index("idx_jobs_status_approval").on(table.status, table.approvalStatus),
  check("jobs_billing_mode_check", sql`${table.billingMode} IS NULL OR ${table.billingMode} IN ('tracked', 'guaranteed')`),
]);

// Private Client bookmarks. Favorites intentionally have no job or submission
// relationship: saving a talent here must never enter the hiring pipeline.
export const clientTalentFavorites = pgTable("client_talent_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  talentId: varchar("talent_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("client_talent_favorites_client_talent_unique").on(table.clientId, table.talentId),
  index("idx_client_talent_favorites_client_id").on(table.clientId),
  index("idx_client_talent_favorites_talent_id").on(table.talentId),
]);

// Legacy freelance marketplace schema — retained temporarily to keep Publish
// additive-only. Application routes do not use these models; they remain here
// solely so existing production data and relationships are never scheduled for
// removal until a separately reviewed migration is approved.
export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  talentId: varchar("talent_id").notNull().references(() => users.id),
  coverLetter: text("cover_letter").notNull(),
  proposedRate: decimal("proposed_rate", { precision: 8, scale: 2 }),
  proposedBudget: decimal("proposed_budget", { precision: 10, scale: 2 }),
  estimatedDuration: text("estimated_duration"),
  status: text("status").notNull().default("submitted"),
  clientResponse: text("client_response"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("proposals_job_talent_unique").on(table.jobId, table.talentId),
  index("idx_proposals_job_id").on(table.jobId),
  index("idx_proposals_talent_id").on(table.talentId),
  index("idx_proposals_status").on(table.status),
]);

// Job Skills (normalized for better querying)
export const jobSkills = pgTable("job_skills", {
  id: serial("id").primaryKey(),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  skillId: integer("skill_id").notNull().references(() => skills.id),
  required: boolean("required").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_job_skills_job_id").on(table.jobId),
  index("idx_job_skills_skill_id").on(table.skillId),
]);

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
}, (table) => [
  index("idx_lead_intakes_status").on(table.status),
  index("idx_lead_intakes_synced_to_ghl").on(table.syncedToGhl),
  index("idx_lead_intakes_created_at").on(table.createdAt),
]);

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
}, (table) => [
  index("idx_waitlist_synced_to_ghl").on(table.syncedToGhl),
  index("idx_waitlist_created_at").on(table.createdAt),
]);

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  proposalId: varchar("proposal_id").notNull().references(() => proposals.id),
  clientId: varchar("client_id").notNull().references(() => users.id),
  talentId: varchar("talent_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  contractType: text("contract_type").notNull(),
  rate: decimal("rate", { precision: 8, scale: 2 }),
  totalBudget: decimal("total_budget", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("active"),
  terms: text("terms"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id),
  title: text("title").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("pending"),
  submissionNote: text("submission_note"),
  approvalNote: text("approval_note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const timeEntries = pgTable("time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id),
  talentId: varchar("talent_id").notNull().references(() => users.id),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"),
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("logged"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id),
  milestoneId: varchar("milestone_id").references(() => milestones.id),
  payerId: varchar("payer_id").notNull().references(() => users.id),
  payeeId: varchar("payee_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  fees: decimal("fees", { precision: 12, scale: 2 }).default("0"),
  currency: text("currency").default("USD"),
  paymentMethod: text("payment_method"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("pending"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const disputes = pgTable("disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id),
  raisedById: varchar("raised_by_id").notNull().references(() => users.id),
  disputeType: text("dispute_type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence").array(),
  status: text("status").notNull().default("open"),
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
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
  flaggedForReview: boolean("flagged_for_review").default(false), // Admin-only; set when content matches PII patterns
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
  eventKey: text("event_key").unique(), // immutable idempotency key for status events
  messageCount: integer("message_count").notNull().default(1),
  isRead: boolean("is_read").default(false),
  popupPresentedAt: timestamp("popup_presented_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Blog Posts for Insights page
export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  coverImageUrl: text("cover_image_url"),
  category: text("category").notNull(),
  author: text("author").notNull(),
  isFeatured: boolean("is_featured").default(false),
  showOnHomepage: boolean("show_on_homepage").default(false),
  homepageOrder: integer("homepage_order"),
  status: text("status").notNull().default("draft"), // draft | published
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  readTime: text("read_time"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas and types
// Dedicated pending identity state. None of these records are usable accounts.
export const pendingRegistrations = pgTable("pending_registrations", {
  id: uuid("id").primaryKey(),
  capabilityHash: text("capability_hash").notNull(),
  email: text("email").notNull(), role: text("role").notNull(), purpose: text("purpose").notNull(),
  firstName: text("first_name").notNull(), lastName: text("last_name").notNull(),
  username: text("username").notNull(), company: text("company"), passwordHash: text("password_hash"),
  context: jsonb("context").notNull().default({}),
  codeHmac: text("code_hmac").notNull(), generation: integer("generation").notNull().default(1),
  incorrectAttempts: integer("incorrect_attempts").notNull().default(0),
  codeExpiresAt: timestamp("code_expires_at", { withTimezone: true }).notNull(),
  resendAvailableAt: timestamp("resend_available_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  deliveryStatus: text("delivery_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
}, t => [
  index("pending_registrations_capability_idx").on(t.capabilityHash, t.createdAt.desc()),
  index("pending_registrations_expiry_idx").on(t.expiresAt),
  index("pending_registrations_email_idx").on(t.email),
  check("pending_registrations_role_check", sql`${t.role} IN ('client','talent')`),
  check("pending_registrations_purpose_check", sql`${t.purpose} IN ('signup','talent_claim','provider')`),
  check("pending_registrations_incorrect_attempts_check", sql`${t.incorrectAttempts} BETWEEN 0 AND 5`),
  check("pending_registrations_delivery_status_check", sql`${t.deliveryStatus} IN ('sending','accepted','failed')`),
]);
export const signupVerificationLimits = pgTable("signup_verification_limits", {
  bucket: text("bucket").primaryKey(), used: integer("used").notNull().default(0),
  resetsAt: timestamp("resets_at", { withTimezone: true }).notNull(),
});
export const authProviderLinks = pgTable("auth_provider_links", {
  provider: text("provider").notNull(), subject: text("subject").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
}, t => [
  primaryKey({ columns: [t.provider, t.subject] }),
  check("auth_provider_links_provider_check", sql`${t.provider} IN ('google','linkedin','replit')`),
]);

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
  requiredSkills: true,
}).extend({
  otherFunction: z.string().trim().max(120).nullable().optional(),
  requiredSkills: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        years: z.enum(["any", "1", "2", "3", "5"]),
      }),
    )
    .optional(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;
export type OrganizationMember = typeof organizationMembers.$inferSelect;

export const insertOrganizationInvitationSchema = createInsertSchema(organizationInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrganizationInvitation = z.infer<typeof insertOrganizationInvitationSchema>;
export type OrganizationInvitation = typeof organizationInvitations.$inferSelect;

// Job Submissions — built-in application form submissions
export const jobSubmissions = pgTable("job_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  clientId: varchar("client_id").references(() => users.id),  // nullable for public submissions
  // firstName / lastName replace the legacy applicantName for new public submissions
  firstName: text("first_name"),
  lastName: text("last_name"),
  applicantName: text("applicant_name"),  // kept for backward-compat with old rows
  email: text("email").notNull(),
  phone: text("phone"),
  location: text("location"),
  resumeUrl: text("resume_url"),
  resumeFileName: text("resume_file_name"),
  videoIntroductionUrl: text("video_introduction_url"),
  videoIntroductionFileName: text("video_introduction_file_name"),
  portfolioUrl: text("portfolio_url"),
  coverLetter: text("cover_letter"),
  proposedRate: decimal("proposed_rate", { precision: 12, scale: 2 }),
  proposedBudget: decimal("proposed_budget", { precision: 12, scale: 2 }),
  estimatedDuration: text("estimated_duration"),
  expectedSalary: text("expected_salary"),
  availability: text("availability"),
  status: text("status").notNull().default("new"), // new, reviewed, shortlisted, rejected, hired, invited
  // Who initiated this submission. Survives status changes (e.g. invited→submitted).
  // 'talent' = talent applied themselves; 'client' = client invited the talent
  initiatedBy: text("initiated_by").notNull().default("talent"), // talent | client
  // Separates lightweight client shortlists from formal invitations and applications.
  workflowType: text("workflow_type").notNull().default("application"), // application | client_shortlist | client_invitation
  talentId: varchar("talent_id").references(() => users.id),
  registrationStatus: text("registration_status").notNull().default("pending_account"),
  isRepeatApplication: boolean("is_repeat_application").notNull().default(false),
  // Client invitations that include an initial interview keep identity masked
  // until the interview itself reaches confirmed.
  combinedInviteReveal: boolean("combined_invite_reveal").notNull().default(false),
  answers: jsonb("answers"), // [{ questionId, question, answer }]
  submittedAt: timestamp("submitted_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const applicationTokens = pgTable("application_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: varchar("submission_id").notNull().references(() => jobSubmissions.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const jobApplicationStatusHistory = pgTable(
  "job_application_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: varchar("application_id").notNull().references(() => jobSubmissions.id, { onDelete: "cascade" }),
    previousStatus: text("previous_status"),
    newStatus: text("new_status").notNull(),
    note: text("note"),
    changedBy: varchar("changed_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_jash_application_id").on(table.applicationId),
    index("idx_jash_changed_by").on(table.changedBy),
    index("idx_jash_created_at").on(table.createdAt),
  ],
);

// Client-initiated approval requests. This is deliberately not an application
// status: Admin approval and successful applicant email are required before the
// canonical job_submissions.status changes.
export const applicationStatusChangeRequests = pgTable(
  "application_status_change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: varchar("application_id").notNull().references(() => jobSubmissions.id, { onDelete: "cascade" }),
    requestedByUserId: varchar("requested_by_user_id").notNull().references(() => users.id),
    requestedByRole: text("requested_by_role").notNull(),
    currentStatus: text("current_status").notNull(),
    requestedStatus: text("requested_status").notNull(),
    reason: text("reason"),
    status: text("status").notNull().default("pending"),
    reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    adminNote: text("admin_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_ascr_application_id").on(table.applicationId),
    index("idx_ascr_requested_by").on(table.requestedByUserId),
    index("idx_ascr_status_created_at").on(table.status, table.createdAt),
  ],
);

export const insertJobSubmissionSchema = createInsertSchema(jobSubmissions).omit({
  id: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJobSubmission = z.infer<typeof insertJobSubmissionSchema>;
export type JobSubmission = typeof jobSubmissions.$inferSelect;
export type ApplicationToken = typeof applicationTokens.$inferSelect;
export type JobApplicationStatusHistory = typeof jobApplicationStatusHistory.$inferSelect;

export const insertMessageThreadSchema = createInsertSchema(messageThreads).omit({
  id: true,
  lastMessageAt: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  readBy: true,
  flaggedForReview: true,
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
  messageCount: true,
  isRead: true,
  createdAt: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  views: true,
  likes: true,
  createdAt: true,
  updatedAt: true,
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

export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

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
  rateCurrency: z.literal("USD").default("USD").optional(),
  availability: z.enum(["available", "busy", "offline"]).default("available").optional(),
  phoneNumber: z.string().optional(),
  languages: z.string().transform((val) => {
    if (!val) return ["English"];
    return val.split(',').map(lang => lang.trim()).filter(lang => lang.length > 0);
  }).default("English").optional(),
  timezone: z.string().default("UTC").optional(),
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

// Vanessa Feedbacks - User feedback on chat responses
export const feedbacks = pgTable("feedbacks", {
  id: serial("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  messageId: text("message_id").notNull(),
  userMessage: text("user_message"),
  assistantResponse: text("assistant_response"),
  rating: varchar("rating", { length: 10 }).notNull(), // 'up' or 'down'
  comment: text("comment"),
  topic: text("topic"), // Extracted keyword/topic for similarity detection
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    threadIdIndex: index("feedbacks_thread_id_idx").on(table.threadId),
    topicIndex: index("feedbacks_topic_idx").on(table.topic),
    createdAtIndex: index("feedbacks_created_at_idx").on(table.createdAt),
  };
});

export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({
  id: true,
  createdAt: true,
});
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbacks.$inferSelect;

// Admin Corrections - Admin-only training data for Vanessa
export const corrections = pgTable("corrections", {
  id: serial("id").primaryKey(),
  logId: integer("log_id").references(() => vanessaLogs.id),
  topic: text("topic"),
  correctedText: text("corrected_text").notNull(),
  adminId: text("admin_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    logIdIndex: index("corrections_log_id_idx").on(table.logId),
    topicIndex: index("corrections_topic_idx").on(table.topic),
    createdAtIndex: index("corrections_created_at_idx").on(table.createdAt),
  };
});

export const insertCorrectionSchema = createInsertSchema(corrections).omit({
  id: true,
  createdAt: true,
});
export type InsertCorrection = z.infer<typeof insertCorrectionSchema>;
export type Correction = typeof corrections.$inferSelect;

// Training Logs - Admin-only conversational training sessions with Vanessa
export const trainingLogs = pgTable("training_logs", {
  id: serial("id").primaryKey(),
  adminId: text("admin_id").notNull(),
  userMessage: text("user_message").notNull(),
  aiResponse: text("ai_response").notNull(),
  isCorrection: boolean("is_correction").default(false), // True if message was detected as a correction
  topic: text("topic"), // Extracted topic if it's a correction
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    adminIdIndex: index("training_logs_admin_id_idx").on(table.adminId),
    topicIndex: index("training_logs_topic_idx").on(table.topic),
    createdAtIndex: index("training_logs_created_at_idx").on(table.createdAt),
  };
});

export const insertTrainingLogSchema = createInsertSchema(trainingLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertTrainingLog = z.infer<typeof insertTrainingLogSchema>;
export type TrainingLog = typeof trainingLogs.$inferSelect;

// LegalOps Trial Signups - High-converting LegalOps landing page trials
export const legalOpsTrials = pgTable("legal_ops_trials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  firmName: text("firm_name").notNull(),
  email: varchar("email").notNull(),
  phone: text("phone"),
  tier: text("tier").notNull(), // 'launch' or 'executive'
  fteCount: integer("fte_count").notNull().default(1),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCustomerId: text("stripe_customer_id"),
  status: text("status").notNull().default("pending"), // pending, card_captured, active, cancelled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    emailIndex: index("legal_ops_trials_email_idx").on(table.email),
    statusIndex: index("legal_ops_trials_status_idx").on(table.status),
    createdAtIndex: index("legal_ops_trials_created_at_idx").on(table.createdAt),
  };
});

export const insertLegalOpsTrialSchema = createInsertSchema(legalOpsTrials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLegalOpsTrial = z.infer<typeof insertLegalOpsTrialSchema>;
export type LegalOpsTrial = typeof legalOpsTrials.$inferSelect;

export const hotSearches = pgTable("hot_searches", {
  id: serial("id").primaryKey(),
  term: text("term").notNull(),
  searchedAt: timestamp("searched_at").defaultNow().notNull(),
}, (table) => ({
  termIndex: index("hot_searches_term_idx").on(table.term),
  searchedAtIndex: index("hot_searches_searched_at_idx").on(table.searchedAt),
}));

export const insertHotSearchSchema = createInsertSchema(hotSearches).omit({
  id: true,
  searchedAt: true,
});
export type InsertHotSearch = z.infer<typeof insertHotSearchSchema>;
export type HotSearch = typeof hotSearches.$inferSelect;

// Candidates — Find Best Matches flow (no auth required)
export const candidates = pgTable("candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Stable FK to users — added to survive email changes without breaking photo sync.
  // Nullable for legacy rows created before this column existed; backfilled at startup.
  userId: varchar("user_id").references(() => users.id),
  fullName: text("full_name").notNull().default(""),
  // Separate given / family name — added to support multi-word first names.
  // Nullable so existing rows without the split are handled gracefully via legacyNameFallback().
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  location: text("location"),
  targetPosition: text("target_position").notNull().default(""),
  category: text("category").notNull().default(""),
  experienceYears: text("experience_years"),
  seniority: text("seniority"),
  coreSkills: text("core_skills").array().default([]),
  secondarySkills: text("secondary_skills").array().default([]),
  workHistory: jsonb("work_history").default([]),
  preferences: jsonb("preferences").default({}),
  summary: text("summary"),
  // Long-form personal/professional information — shown publicly, optional
  moreAboutMe: text("more_about_me"),
  profileCompleted: boolean("profile_completed").default(false),
  accountCreated: boolean("account_created").default(false),
  cultureScore: integer("culture_score"),
  // Profile photo & media
  profilePhotoUrl: text("profile_photo_url"),
  // Resume
  resumeUrl: text("resume_url"),
  resumeFileName: text("resume_file_name"),
  // Video introduction
  videoIntroUrl: text("video_intro_url"),
  videoIntroFileName: text("video_intro_file_name"),
  // Professional headline
  headline: text("headline"),
  // Portfolio / Social links
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),
  websiteUrl: text("website_url"),
  // Availability
  availability: text("availability"),
  // Education & Certifications (jsonb arrays)
  education: jsonb("education").default([]),
  certifications: jsonb("certifications").default([]),
  // Public-facing display name (can differ from registered fullName)
  displayName: text("display_name"),
  // Auth — bcrypt hash, nullable until candidate sets a password
  passwordHash: text("password_hash"),
  // Candidate-only authentication: ignored whenever userId is non-null.
  // users is the ONLY ownership authority for linked Talent.
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  emailVerifiedEmail: text("email_verified_email"),
  emailVerificationRequired: boolean("email_verification_required").notNull().default(true),
  // Verified status — admin-confirmed identity and certifications (prerequisite for Vetted).
  // Canonical three-tier model: No Classification → Verified → Vetted.
  // Mechanism values: 'manual_admin' | 'grandfathered_pre_verified'
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: text("verified_by"),                          // admin user_id who confirmed
  verifiedByMechanism: text("verified_by_mechanism"),       // 'manual_admin' | 'grandfathered_pre_verified'
  verificationNotes: text("verification_notes"),            // optional admin note on confirm
  verificationStatus: text("verification_status"),          // 'pending' | 'rejected' | null
  verificationDocUrl: text("verification_doc_url"),         // cleared after any decision
  verificationDocName: text("verification_doc_name"),       // cleared after any decision
  verificationRejectionReason: text("verification_rejection_reason"), // set on reject, cleared on resubmit

  // Vetted status — admin-granted; shows a visible "Vetted" badge on the profile.
  // Eligibility paths: manual admin grant, proactive OnSpot selection, or automatic
  // milestone (threshold configured in platform_settings.vetted_auto_hire_threshold).
  // Requires is_verified = true as a prerequisite.
  isVetted: boolean("is_vetted").notNull().default(false),
  vettedAt: timestamp("vetted_at"),
  // Discriminates how the badge was granted: 'manual_admin' | 'automatic_milestone'
  vettedByMechanism: text("vetted_by_mechanism"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_candidates_user_id").on(table.userId),
  index("idx_candidates_email").on(table.email),
  index("idx_candidates_category").on(table.category),
  index("idx_candidates_created_at").on(table.createdAt),
  index("idx_candidates_profile_completed").on(table.profileCompleted),
]);

export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  createdAt: true,
  passwordHash: true,
  userId: true,
  emailVerifiedAt: true,
  emailVerifiedEmail: true,
  emailVerificationRequired: true,
});
// Internal writers can set auth fields; the public validator above cannot.
export type InsertCandidate = z.infer<typeof insertCandidateSchema> & Partial<Pick<Candidate,
  "passwordHash" | "userId" | "emailVerifiedAt" | "emailVerifiedEmail" | "emailVerificationRequired">>;
export type Candidate = typeof candidates.$inferSelect;

// Inquiries — client service inquiry + payment flow
// status: pending_endorsement | endorsed | rejected | payment_pending | paid | completed
export const inquiries = pgTable("inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceNumber: text("reference_number").notNull().unique(), // INQ-2026-XXXX
  fullName: text("full_name").notNull(),
  email: varchar("email").notNull(),
  phoneNumber: text("phone_number"),
  company: text("company"),
  serviceNeeded: text("service_needed").notNull(),
  details: text("details"),
  estimatedBudget: decimal("estimated_budget", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("pending_endorsement"),
  paymentMethod: text("payment_method"), // stripe | manual
  paymentAmount: decimal("payment_amount", { precision: 12, scale: 2 }),
  transactionReference: text("transaction_reference"),
  receiptUrl: text("receipt_url"),
  adminNotes: text("admin_notes"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paidAt: timestamp("paid_at"),
  refundPolicyAccepted: boolean("refund_policy_accepted").notNull().default(false),
  refundPolicyAcceptedAt: timestamp("refund_policy_accepted_at"),
  // QR payment confirmation fields
  paymentStatus: text("payment_status"), // pending_verification | verified | rejected
  paymentReferenceNumber: text("payment_reference_number"),
  paymentProofUrl: text("payment_proof_url"),
  paymentProofFilename: text("payment_proof_filename"),
  paymentNotes: text("payment_notes"),
  paymentConfirmationSubmittedAt: timestamp("payment_confirmation_submitted_at"),
  paymentVerifiedAt: timestamp("payment_verified_at"),
  paymentRejectedAt: timestamp("payment_rejected_at"),
  adminPaymentNotes: text("admin_payment_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInquirySchema = createInsertSchema(inquiries).omit({
  id: true,
  referenceNumber: true,
  status: true,
  paymentMethod: true,
  paymentAmount: true,
  transactionReference: true,
  receiptUrl: true,
  adminNotes: true,
  stripePaymentIntentId: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type Inquiry = typeof inquiries.$inferSelect;

// Candidate Culture Evaluations — persisted assessment linked to a candidate
export const candidateCultureEvaluations = pgTable(
  "candidate_culture_evaluations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    candidateId: varchar("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),
    // Raw answers: { [questionId]: optionId }
    answers: jsonb("answers").notNull().default({}),
    // Per-value breakdown: { value, score, trait }[]
    valueScores: jsonb("value_scores").notNull().default([]),
    // 0–100 overall alignment percentage
    overallScore: integer("overall_score").notNull().default(0),
    // "Strong" | "Solid" | "Growing" | "Developing"
    alignmentLevel: text("alignment_level").notNull().default(""),
    summary: text("summary").notNull().default(""),
    traits: text("traits").array().default([]),
    completedAt: timestamp("completed_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
);

export const insertCultureEvaluationSchema = createInsertSchema(
  candidateCultureEvaluations,
).omit({ id: true, createdAt: true });
export type InsertCultureEvaluation = z.infer<
  typeof insertCultureEvaluationSchema
>;
export type CultureEvaluation =
  typeof candidateCultureEvaluations.$inferSelect;

// ── Applicant Email Templates ─────────────────────────────────────────────────

export const applicantEmailTemplates = pgTable("applicant_email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  category: text("category").notNull(),
  stage: text("stage"),
  isPublished: boolean("is_published").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  variables: jsonb("variables").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_aet_category").on(table.category),
  index("idx_aet_stage").on(table.stage),
  index("idx_aet_is_published").on(table.isPublished),
]);

export const jobApplicationEmails = pgTable("job_application_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: varchar("application_id").notNull().references(() => jobSubmissions.id, { onDelete: "cascade" }),
  templateId: uuid("template_id").references(() => applicantEmailTemplates.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  sentTo: text("sent_to").notNull(),
  sentBy: varchar("sent_by").references(() => users.id),
  senderEmail: text("sender_email"),
  senderName: text("sender_name"),
  status: text("status").notNull().default("sent"),
  errorMessage: text("error_message"),
  isTest: boolean("is_test").notNull().default(false),
  statusUpdate: text("status_update"),
  statusPrevious: text("status_previous"),
  statusNote: text("status_note"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_jae_application_id").on(table.applicationId),
  index("idx_jae_sent_at").on(table.sentAt),
]);

export const insertApplicantEmailTemplateSchema = createInsertSchema(applicantEmailTemplates).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertApplicantEmailTemplate = z.infer<typeof insertApplicantEmailTemplateSchema>;
export type ApplicantEmailTemplate = typeof applicantEmailTemplates.$inferSelect;

export const insertJobApplicationEmailSchema = createInsertSchema(jobApplicationEmails).omit({
  id: true, sentAt: true, createdAt: true,
});
export type InsertJobApplicationEmail = z.infer<typeof insertJobApplicationEmailSchema>;
export type JobApplicationEmail = typeof jobApplicationEmails.$inferSelect;

// ── Job Matches ────────────────────────────────────────────────────────────────
// Persisted match scores between a candidate and a job.
// Recomputed on: (a) talent profile/preferences save, (b) new job published,
// (c) nightly drift-correction batch.
// Recompute strategy: event-driven dual-trigger (Option C) — see ADR in memory.
export const jobMatches = pgTable("job_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Keyed to candidates.id — the authoritative talent identity.
  talentId: varchar("talent_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  // Raw unbounded score (Jaccard * 100 + bonuses). Display layer caps at 100.
  compatibilityScore: integer("compatibility_score").notNull(),
  // Structured reasons: { skillOverlap, engagementMatch, rateMatch, rateRatio,
  //   timezoneMatch, categoryMatch, experienceMatch, factors[] }
  matchReasons: jsonb("match_reasons").notNull().default({}),
  computedAt: timestamp("computed_at").defaultNow(),
  // Set once the talent has been notified of this match (prevents repeat notifications).
  notifiedAt: timestamp("notified_at"),
}, (table) => [
  index("idx_job_matches_talent_id").on(table.talentId),
  index("idx_job_matches_job_id").on(table.jobId),
  index("idx_job_matches_score").on(table.compatibilityScore),
  uniqueIndex("uq_job_matches_talent_job").on(table.talentId, table.jobId),
]);

export const insertJobMatchSchema = createInsertSchema(jobMatches).omit({
  id: true,
  computedAt: true,
});
export type InsertJobMatch = z.infer<typeof insertJobMatchSchema>;
export type JobMatch = typeof jobMatches.$inferSelect;

// ── Hiring Pipeline — Phase 1: Interviews ────────────────────────────────────
// One row per interview round per job_submission.
// Multiple rounds are supported via round_number (1, 2, 3…).
// Client-driven: all write endpoints key to job_submissions.client_id.
export const interviews = pgTable("interviews", {
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId:   varchar("submission_id").notNull().references(() => jobSubmissions.id, { onDelete: "cascade" }),
  roundNumber:    integer("round_number").notNull().default(1),
  // 'initial' | 'technical' | 'final' | 'culture' | 'other'
  interviewType:  text("interview_type").notNull().default("initial"),
  // 'proposed' → 'confirmed' → 'completed' | 'cancelled' | 'rescheduled'
  status:         text("status").notNull().default("proposed"),
  // null until status = 'completed': 'advance' | 'reject' | 'pending'
  outcome:        text("outcome"),
  // [{start: ISO8601, end: ISO8601, timezone: string}, ...]
  proposedTimes:  jsonb("proposed_times").notNull().default([]),
  // Populated when either party confirms one of the proposed slots. The
  // timestamp is an instant; the companion zone preserves the timezone used
  // to display the selected slot.
  confirmedTime:  timestamp("confirmed_time", { withTimezone: true }),
  confirmedTimeZone: text("confirmed_time_zone"),
  // 'client' | 'talent' | null when no proposal is pending.
  currentProposalOwner: text("current_proposal_owner"),
  meetingLink: text("meeting_link"),
  calendarEventId: text("calendar_event_id"),
  calendarManaged: boolean("calendar_managed").notNull().default(false),
  calendarInterviewerId: text("calendar_interviewer_id"),
  proposalExchangeCount: integer("proposal_exchange_count").notNull().default(0),
  // Client user who created this interview row (must match submission's client_id)
  createdBy:      varchar("created_by").notNull().references(() => users.id),
  // Shown to the candidate (instructions, location, video link, etc.)
  candidateNotes: text("candidate_notes"),
  // Internal notes — not shown to talent
  internalNotes:  text("internal_notes"),
  // V1 scheduling metadata — nullable for backward compatibility with legacy rows
  durationMinutes: integer("duration_minutes"),
  cancelledAt:    timestamp("cancelled_at", { withTimezone: true }),
  cancellationReason: text("cancellation_reason"),
  completedAt:    timestamp("completed_at", { withTimezone: true }),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_interviews_submission_id").on(table.submissionId),
  index("idx_interviews_status").on(table.status),
]);

export const insertInterviewSchema = createInsertSchema(interviews).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type Interview = typeof interviews.$inferSelect;

// Immutable history for every interview proposal/response. Negotiation does
// not consume interview round numbers.
export const interviewProposals = pgTable("interview_proposals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  interviewId: uuid("interview_id").notNull().references(() => interviews.id, { onDelete: "cascade" }),
  proposerId: varchar("proposer_id").notNull().references(() => users.id),
  proposerRole: text("proposer_role").notNull(),
  action: text("action").notNull(),
  proposedTimes: jsonb("proposed_times").notNull().default([]),
  selectedTime: timestamp("selected_time", { withTimezone: true }),
  selectedTimeZone: text("selected_time_zone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_interview_proposals_interview_id").on(table.interviewId),
  index("idx_interview_proposals_created_at").on(table.createdAt),
]);

export const insertInterviewProposalSchema = createInsertSchema(interviewProposals).omit({
  id: true, createdAt: true,
});
export type InsertInterviewProposal = z.infer<typeof insertInterviewProposalSchema>;
export type InterviewProposal = typeof interviewProposals.$inferSelect;

// ── Hiring Pipeline — Phase 2: Offers ────────────────────────────────────────
// One row per offer per job_submission (re-offers after decline create a new row).
// Client-driven: client creates the offer; talent responds.
export const offers = pgTable("offers", {
  id:                        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId:              varchar("submission_id").notNull().references(() => jobSubmissions.id, { onDelete: "cascade" }),
  // Snapshotted from jobs.engagement_type at offer creation — NOT freely settable.
  engagementType:            text("engagement_type").notNull(),
  billingMode:               text("billing_mode"),
  rate:                      decimal("rate", { precision: 12, scale: 2 }).notNull(),
  rateCurrency:              text("rate_currency").notNull().default("USD"),
  proposedStartDate:         timestamp("proposed_start_date"),
  // 'sent' → 'accepted' | 'declined' | 'countered' | 'withdrawn' | 'expired'
  status:                    text("status").notNull().default("sent"),
  // A counter closes the current immutable row and creates a linked child.
  parentOfferId:             uuid("parent_offer_id"),
  // The side that created this immutable proposal; the other side owns the response turn.
  proposerRole:              text("proposer_role").notNull().default("client"),
  // Snapshots of talent's rate expectation AT offer creation time (non-retroactive)
  talentExpectedRate:        decimal("talent_expected_rate", { precision: 12, scale: 2 }),
  talentExpectedCurrency:    text("talent_expected_currency"),
  talentExpectedEngagement:  text("talent_expected_engagement"),
  // Mismatch flag — set by application code at INSERT
  // TRUE  = offer below expectation (same currency + same engagement type)
  // FALSE = at or above expectation
  // NULL  = currencies differ | engagement types differ | no expectation recorded
  rateBelowExpectation:      boolean("rate_below_expectation"),
  rateDelta:                 decimal("rate_delta", { precision: 12, scale: 2 }),
  sentAt:                    timestamp("sent_at").notNull().defaultNow(),
  respondedAt:               timestamp("responded_at"),
  acceptedAt:                timestamp("accepted_at", { withTimezone: true }),
  declinedAt:                timestamp("declined_at", { withTimezone: true }),
  respondedBy:               varchar("responded_by").references(() => users.id),
  expiresAt:                 timestamp("expires_at"),
  // Stamped only after a confirmed successful reminder email delivery.
  // NULL = reminder not yet sent (or send failed — eligible for retry).
  expiryReminderSentAt:      timestamp("expiry_reminder_sent_at"),
  notes:                     text("notes"),
  createdAt:                 timestamp("created_at").notNull().defaultNow(),
  updatedAt:                 timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_offers_submission_id").on(table.submissionId),
  index("idx_offers_status").on(table.status),
  check("offers_billing_mode_check", sql`${table.billingMode} IS NULL OR ${table.billingMode} IN ('tracked', 'guaranteed')`),
]);

export const insertOfferSchema = createInsertSchema(offers).omit({
  id: true, sentAt: true, createdAt: true, updatedAt: true,
});
export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type Offer = typeof offers.$inferSelect;

// ── Hiring Pipeline — Phase 3: Hiring Contracts ───────────────────────────────
// One row per contract per offer. Admin/OnSpot-driven.
// signing_entity is snapshotted from platform_settings at creation time.
export const hiringContracts = pgTable("hiring_contracts", {
  id:              uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  offerId:         uuid("offer_id").notNull().references(() => offers.id, { onDelete: "restrict" }),
  // Denormalised for direct lookups without joining through offers
  submissionId:    varchar("submission_id").notNull().references(() => jobSubmissions.id),
  templateRef:     text("template_ref"),
  documentPath:    text("document_path"),
  documentVersion: integer("document_version").notNull().default(1),
  partyType: text("party_type").notNull().default("onspot"),
  organizationId: varchar("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
  preparedBy: varchar("prepared_by").references(() => users.id, { onDelete: "restrict" }),
  title: text("title"),
  talentMessage: text("talent_message"),
  documentManaged: boolean("document_managed").notNull().default(false),
  // 'draft' → 'sent' → 'signed' | 'void'
  status:          text("status").notNull().default("draft"),
  // Snapshotted from platform_settings('contract_signing_entity') at row creation
  signingEntity:   text("signing_entity").notNull().default("OnSpot Technologies Inc."),
  billingMode:     text("billing_mode"),
  effectiveStartDate: date("effective_start_date"),
  effectiveEndDate: date("effective_end_date"),
  terminationReason: text("termination_reason"),
  terminatedBy: varchar("terminated_by").references(() => users.id, { onDelete: "restrict" }),
  terminatedAt: timestamp("terminated_at", { withTimezone: true }),
  billingActivatedAt: timestamp("billing_activated_at", { withTimezone: true }),
  // Reserved for a future e-signature provider; current signing remains admin-controlled.
  signatureProvider: text("signature_provider"),
  signatureEnvelopeId: text("signature_envelope_id"),
  talentSignedAt:  timestamp("talent_signed_at"),
  onspotSignedAt:  timestamp("onspot_signed_at"),
  voidedAt:        timestamp("voided_at"),
  voidedReason:    text("voided_reason"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_hiring_contracts_offer_id").on(table.offerId),
  index("idx_hiring_contracts_submission_id").on(table.submissionId),
  index("idx_hiring_contracts_status").on(table.status),
  check("hiring_contracts_billing_mode_check", sql`${table.billingMode} IS NULL OR ${table.billingMode} IN ('tracked', 'guaranteed')`),
  check("hiring_contracts_termination_snapshot_check", sql`
    (${table.effectiveEndDate} IS NULL AND ${table.terminationReason} IS NULL
      AND ${table.terminatedBy} IS NULL AND ${table.terminatedAt} IS NULL)
    OR
    (${table.effectiveEndDate} IS NOT NULL AND ${table.billingMode} IN ('tracked', 'guaranteed')
      AND ${table.terminationReason} IS NOT NULL AND btrim(${table.terminationReason}) <> ''
      AND ${table.terminatedBy} IS NOT NULL AND ${table.terminatedAt} IS NOT NULL
      AND (${table.effectiveStartDate} IS NULL OR ${table.effectiveEndDate} >= ${table.effectiveStartDate}))
  `),
]);

export const offerExpirationHistory = pgTable("offer_expiration_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  offerId: uuid("offer_id").notNull().references(()=>offers.id),
  actorUserId: varchar("actor_user_id").notNull().references(()=>users.id),
  previousExpiresAt: timestamp("previous_expires_at",{withTimezone:true}),
  newExpiresAt: timestamp("new_expires_at",{withTimezone:true}).notNull(),
  changedAt: timestamp("changed_at",{withTimezone:true}).notNull().defaultNow(),
});
export const contractAttachments = pgTable("contract_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  hiringContractId: uuid("hiring_contract_id").notNull().references(()=>hiringContracts.id),
  objectKey:text("object_key").notNull().unique(), originalFilename:text("original_filename").notNull(),
  fileSize:integer("file_size").notNull(), sha256:text("sha256").notNull(), version:integer("version").notNull(),
  status:text("status").notNull().default("draft"), uploadedBy:varchar("uploaded_by").notNull().references(()=>users.id),
  uploadedAt:timestamp("uploaded_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[uniqueIndex("contract_attachments_contract_version").on(table.hiringContractId,table.version),
  check("contract_attachments_status_check",sql`${table.status} IN ('draft','frozen','removed')`),
  check("contract_attachments_size_check",sql`${table.fileSize} BETWEEN 1 AND 10485760`)]);
export const contractDocuments = pgTable("contract_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id),
  objectKey: text("object_key").notNull().unique(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(), fileSize: integer("file_size").notNull(),
  sha256: text("sha256").notNull(), version: integer("version").notNull(),
  status: text("status").notNull().default("draft"),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  executedObjectKey: text("executed_object_key"),
  executedSha256: text("executed_sha256"),
}, table => [
  uniqueIndex("contract_documents_version").on(table.hiringContractId, table.version),
  uniqueIndex("contract_documents_current").on(table.hiringContractId).where(sql`${table.status} NOT IN ('superseded','voided','declined')`),
  check("contract_documents_size_check", sql`${table.fileSize}>0 AND ${table.fileSize}<=10485760`),
  check("contract_documents_hash_check", sql`${table.sha256} ~ '^[a-f0-9]{64}$'`),
  check("contract_documents_mime_check", sql`${table.mimeType}='application/pdf'`),
  check("contract_documents_status_check", sql`${table.status} IN ('draft','sent_for_signature','talent_signed','countersigned','executed','voided','declined','superseded')`),
]);
export const contractDocumentReviews = pgTable("contract_document_reviews", {
  documentId: uuid("document_id").notNull().references(() => contractDocuments.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  sha256: text("sha256").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.documentId, table.userId] })]);
export const contractSignatures = pgTable("contract_signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => contractDocuments.id),
  signerUserId: varchar("signer_user_id").notNull().references(() => users.id),
  signerRole: text("signer_role").notNull(), legalName: text("legal_name").notNull(),
  signatureMethod: text("signature_method").notNull().default("typed_name_consent"),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
  documentVersion: integer("document_version").notNull(),
  documentSha256: text("document_sha256").notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id),
  authorityContext: text("authority_context").notNull(),
  auditMetadata: jsonb("audit_metadata").notNull().default({}),
}, table => [
  uniqueIndex("contract_signatures_role").on(table.documentId, table.signerRole),
  check("contract_signatures_role_check", sql`${table.signerRole} IN ('talent','client','organization','onspot')`),
]);
export const contractDocumentEvents = pgTable("contract_document_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id),
  documentId: uuid("document_id").references(() => contractDocuments.id),
  actorUserId: varchar("actor_user_id").notNull().references(() => users.id),
  action: text("action").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const contractDeliveryEvents = pgTable("contract_delivery_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => contractDocuments.id),
  eventType: text("event_type").notNull(),
  recipientUserId: varchar("recipient_user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), attempts: integer("attempts").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("contract_delivery_event_recipient").on(table.documentId, table.eventType, table.recipientUserId)]);

export const hiringContractTerminationRequests = pgTable("hiring_contract_termination_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id, { onDelete: "restrict" }),
  requesterId: varchar("requester_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  requesterRole: text("requester_role").notNull(),
  requestedEffectiveEndDate: date("requested_effective_end_date").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  decisionReason: text("decision_reason"),
  decidedBy: varchar("decided_by").references(() => users.id, { onDelete: "restrict" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  approvedEffectiveEndDate: date("approved_effective_end_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("hiring_contract_termination_requests_status_idx").on(table.status, table.createdAt),
  uniqueIndex("hiring_contract_termination_one_open_request_idx").on(table.hiringContractId)
    .where(sql`${table.status} = 'open'`),
  uniqueIndex("hiring_contract_termination_one_approval_idx").on(table.hiringContractId)
    .where(sql`${table.status} = 'approved'`),
  check("hiring_contract_termination_requests_requester_role_check", sql`${table.requesterRole} IN ('client', 'talent', 'admin')`),
  check("hiring_contract_termination_requests_reason_check", sql`btrim(${table.reason}) <> ''`),
  check("hiring_contract_termination_requests_status_check", sql`${table.status} IN ('open', 'approved', 'rejected')`),
  check("hiring_contract_termination_requests_check", sql`
    (${table.status} = 'open' AND ${table.decisionReason} IS NULL AND ${table.decidedBy} IS NULL
      AND ${table.decidedAt} IS NULL AND ${table.approvedEffectiveEndDate} IS NULL)
    OR
    (${table.status} = 'approved' AND ${table.decisionReason} IS NOT NULL AND btrim(${table.decisionReason}) <> ''
      AND ${table.decidedBy} IS NOT NULL AND ${table.decidedAt} IS NOT NULL
      AND ${table.approvedEffectiveEndDate} IS NOT NULL)
    OR
    (${table.status} = 'rejected' AND ${table.decisionReason} IS NOT NULL AND btrim(${table.decisionReason}) <> ''
      AND ${table.decidedBy} IS NOT NULL AND ${table.decidedAt} IS NOT NULL
      AND ${table.approvedEffectiveEndDate} IS NULL)
  `),
  check("hiring_contract_termination_requests_approved_date_check", sql`
    ${table.approvedEffectiveEndDate} IS NULL
    OR ${table.approvedEffectiveEndDate} >= ${table.requestedEffectiveEndDate}
  `),
]);

// Clock-first work sessions. Raw startedAt/endedAt are server-captured events;
// approved missing-out corrections are stored separately for auditability.
export const clockSessions = pgTable("clock_sessions", {
  id:                 uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hiringContractId:   uuid("hiring_contract_id").notNull().references(() => hiringContracts.id, { onDelete: "restrict" }),
  talentId:           varchar("talent_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  startedAt:          timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt:            timestamp("ended_at", { withTimezone: true }),
  exceptionType:      text("exception_type"),
  exceptionDetectedAt: timestamp("exception_detected_at", { withTimezone: true }),
  exceptionStatus:    text("exception_status"),
  proposedEndAt:      timestamp("proposed_end_at", { withTimezone: true }),
  proposalReason:     text("proposal_reason"),
  approvedEndAt:      timestamp("approved_end_at", { withTimezone: true }),
  resolvedBy:         varchar("resolved_by").references(() => users.id, { onDelete: "restrict" }),
  resolvedAt:         timestamp("resolved_at", { withTimezone: true }),
  resolutionReason:   text("resolution_reason"),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("clock_sessions_one_open_per_talent").on(table.talentId)
    .where(sql`${table.endedAt} IS NULL AND ${table.exceptionStatus} IS DISTINCT FROM 'approved'`),
  index("clock_sessions_talent_recent").on(table.talentId, table.startedAt.desc()),
  check("clock_sessions_exception_type_check", sql`${table.exceptionType} IS NULL OR ${table.exceptionType} IN ('missed_out')`),
  check("clock_sessions_exception_status_check", sql`${table.exceptionStatus} IS NULL OR ${table.exceptionStatus} IN ('detected', 'pending', 'approved', 'rejected')`),
  check("clock_sessions_exception_pair_check", sql`(${table.exceptionStatus} IS NULL) = (${table.exceptionType} IS NULL)`),
  check("clock_sessions_exception_state_check", sql`
    (${table.exceptionStatus} IS NULL AND ${table.proposedEndAt} IS NULL AND ${table.proposalReason} IS NULL
      AND ${table.approvedEndAt} IS NULL AND ${table.resolvedBy} IS NULL AND ${table.resolvedAt} IS NULL
      AND ${table.resolutionReason} IS NULL)
    OR (${table.exceptionStatus} = 'detected' AND ${table.exceptionType} IS NOT NULL
      AND ${table.proposedEndAt} IS NULL AND ${table.proposalReason} IS NULL AND ${table.approvedEndAt} IS NULL
      AND ${table.resolvedBy} IS NULL AND ${table.resolvedAt} IS NULL AND ${table.resolutionReason} IS NULL)
    OR (${table.exceptionStatus} = 'pending' AND ${table.exceptionType} IS NOT NULL
      AND ${table.proposedEndAt} IS NOT NULL AND ${table.proposalReason} IS NOT NULL AND ${table.approvedEndAt} IS NULL
      AND ${table.resolvedBy} IS NULL AND ${table.resolvedAt} IS NULL AND ${table.resolutionReason} IS NULL)
    OR (${table.exceptionStatus} = 'approved' AND ${table.exceptionType} IS NOT NULL
      AND ${table.proposedEndAt} IS NOT NULL AND ${table.proposalReason} IS NOT NULL AND ${table.approvedEndAt} IS NOT NULL
      AND ${table.resolvedBy} IS NOT NULL AND ${table.resolvedAt} IS NOT NULL AND ${table.resolutionReason} IS NOT NULL)
    OR (${table.exceptionStatus} = 'rejected' AND ${table.exceptionType} IS NOT NULL
      AND ${table.proposedEndAt} IS NOT NULL AND ${table.proposalReason} IS NOT NULL AND ${table.approvedEndAt} IS NULL
      AND ${table.resolvedBy} IS NOT NULL AND ${table.resolvedAt} IS NOT NULL AND ${table.resolutionReason} IS NOT NULL)
  `),
]);

export const clockExceptionReviews = pgTable("clock_exception_reviews", {
  id:              uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clockSessionId:  uuid("clock_session_id").notNull().references(() => clockSessions.id, { onDelete: "cascade" }),
  action:          text("action").notNull(),
  actorId:         varchar("actor_id").references(() => users.id, { onDelete: "restrict" }),
  reviewerId:      varchar("reviewer_id").references(() => users.id, { onDelete: "restrict" }),
  proposedEndAt:   timestamp("proposed_end_at", { withTimezone: true }),
  proposalReason:  text("proposal_reason"),
  decisionReason:  text("decision_reason"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("clock_exception_reviews_session_history").on(table.clockSessionId, table.createdAt, table.id),
  check("clock_exception_reviews_action_check", sql`${table.action} IN ('detected', 'proposed', 'approved', 'rejected')`),
  check("clock_exception_reviews_state_check", sql`
    (${table.action} = 'detected' AND ${table.actorId} IS NULL AND ${table.reviewerId} IS NULL
      AND ${table.proposedEndAt} IS NULL AND ${table.proposalReason} IS NULL AND ${table.decisionReason} IS NULL)
    OR (${table.action} = 'proposed' AND ${table.actorId} IS NOT NULL AND ${table.reviewerId} IS NULL
      AND ${table.proposedEndAt} IS NOT NULL AND ${table.proposalReason} IS NOT NULL AND ${table.decisionReason} IS NULL)
    OR (${table.action} IN ('approved', 'rejected') AND ${table.actorId} IS NULL AND ${table.reviewerId} IS NOT NULL
      AND ${table.proposedEndAt} IS NOT NULL AND ${table.proposalReason} IS NOT NULL AND ${table.decisionReason} IS NOT NULL)
  `),
]);

export const timesheetPeriods = pgTable("timesheet_periods", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id, { onDelete: "restrict" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  workTimezone: text("work_timezone"),
  status: text("status").notNull().default("open"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedRevisionId: uuid("approved_revision_id").references(
    (): AnyPgColumn => timesheetRevisions.id,
    { onDelete: "restrict" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("timesheet_periods_contract_start_end").on(table.hiringContractId, table.periodStart, table.periodEnd),
  index("timesheet_periods_contract_period").on(table.hiringContractId, table.periodStart.desc()),
  check("timesheet_periods_status_check", sql`${table.status} IN ('open', 'submitted', 'approved', 'disputed', 'rejected')`),
  check("timesheet_periods_dates_check", sql`${table.periodStart} <= ${table.periodEnd}`),
]);

export const timesheetRevisions = pgTable("timesheet_revisions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  timesheetPeriodId: uuid("timesheet_period_id").notNull().references(() => timesheetPeriods.id, { onDelete: "restrict" }),
  version: integer("version").notNull(),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "restrict" }),
  decisionReason: text("decision_reason").notNull(),
  exceptionApproved: boolean("exception_approved").notNull().default(false),
  workTimezone: text("work_timezone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("timesheet_revisions_period_version").on(table.timesheetPeriodId, table.version),
]);

export const timesheetRevisionSessions = pgTable("timesheet_revision_sessions", {
  revisionId: uuid("revision_id").notNull().references(() => timesheetRevisions.id, { onDelete: "restrict" }),
  clockSessionId: uuid("clock_session_id").notNull().references(() => clockSessions.id, { onDelete: "restrict" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  effectiveEndAt: timestamp("effective_end_at", { withTimezone: true }).notNull(),
  source: text("source").notNull(),
}, (table) => [
  primaryKey({ columns: [table.revisionId, table.clockSessionId] }),
  check("timesheet_revision_sessions_source_check", sql`${table.source} IN ('clock', 'approved_exception', 'admin_correction')`),
  check("timesheet_revision_sessions_time_check", sql`${table.effectiveEndAt} > ${table.startedAt}`),
]);

export const timesheetCorrectionProposals = pgTable("timesheet_correction_proposals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  timesheetPeriodId: uuid("timesheet_period_id").notNull().references(() => timesheetPeriods.id, { onDelete: "restrict" }),
  clockSessionId: uuid("clock_session_id").notNull().references(() => clockSessions.id, { onDelete: "restrict" }),
  requestedBy: varchar("requested_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  requestedStartedAt: timestamp("requested_started_at", { withTimezone: true }),
  requestedEndAt: timestamp("requested_end_at", { withTimezone: true }),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  decidedBy: varchar("decided_by").references(() => users.id, { onDelete: "restrict" }),
  decisionReason: text("decision_reason"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("timesheet_corrections_period").on(table.timesheetPeriodId, table.createdAt),
  check("timesheet_correction_proposals_status_check", sql`${table.status} IN ('pending', 'approved', 'rejected')`),
  check("timesheet_correction_proposals_requested_time_check", sql`${table.requestedStartedAt} IS NOT NULL OR ${table.requestedEndAt} IS NOT NULL`),
]);

export const timesheetDisputes = pgTable("timesheet_disputes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  timesheetPeriodId: uuid("timesheet_period_id").notNull().references(() => timesheetPeriods.id, { onDelete: "restrict" }),
  clientId: varchar("client_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "restrict" }),
  resolutionReason: text("resolution_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  index("timesheet_disputes_period").on(table.timesheetPeriodId, table.createdAt),
  check("timesheet_disputes_status_check", sql`${table.status} IN ('open', 'resolved')`),
]);

export const timesheetAudit = pgTable("timesheet_audit", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  timesheetPeriodId: uuid("timesheet_period_id").notNull().references(() => timesheetPeriods.id, { onDelete: "restrict" }),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  reason: text("reason"),
  details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("timesheet_audit_period").on(table.timesheetPeriodId, table.createdAt),
  check("timesheet_audit_action_check", sql`${table.action} IN ('submitted', 'correction_requested', 'disputed', 'review_approved', 'review_rejected', 'review_exception', 'correction_decided')`),
]);

// ── Billing engine — additive schema ─────────────────────────────────────────
// These tables are distinct from the preserved legacy payments/contracts models.
// They are the current ledger for the OnSpot hiring-contract workflow.
export const invoiceNumberSeq = pgSequence("invoice_number_seq", { startWith: 1 });

export const payoutRegionConfigs = pgTable("payout_region_configs", {
  regionCode: text("region_code").primaryKey(),
  availableMethods: text("available_methods").array().notNull().default([]),
  defaultMethod: text("default_method").notNull(),
  currency: text("currency").notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoicePeriods = pgTable("invoice_periods", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id, { onDelete: "restrict" }),
  offerId: uuid("offer_id").notNull().references(() => offers.id, { onDelete: "restrict" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  talentRate: decimal("talent_rate", { precision: 12, scale: 2 }).notNull(),
  talentRateCurrency: text("talent_rate_currency").notNull().default("USD"),
  standardPeriodHours: integer("standard_period_hours").notNull(),
  extendedHours: decimal("extended_hours", { precision: 8, scale: 2 }).notNull().default("0"),
  deductionHours: decimal("deduction_hours", { precision: 8, scale: 2 }).notNull().default("0"),
  hourlyEquivalent: decimal("hourly_equivalent", { precision: 12, scale: 4 }).notNull(),
  adjustedTalentPayout: decimal("adjusted_talent_payout", { precision: 12, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).notNull(),
  clientInvoiceAmount: decimal("client_invoice_amount", { precision: 12, scale: 2 }).notNull(),
  commissionEarned: decimal("commission_earned", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_invoice_periods_contract").on(table.hiringContractId),
  index("idx_invoice_periods_status").on(table.status),
  uniqueIndex("idx_invoice_periods_contract_dates_unique").on(table.hiringContractId, table.periodStart, table.periodEnd),
  check("invoice_periods_status_check", sql`${table.status} IN ('draft', 'ready', 'invoiced', 'payout_scheduled', 'closed')`),
]);

// Current provider connection for a Client or Talent user; missing row means
// not_connected. Provider credentials and banking details are never stored here.
export const paymentProviderAccounts = pgTable("payment_provider_accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerType: text("owner_type").notNull(),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerName: text("provider_name"),
  externalAccountId: text("external_account_id"),
  status: text("status").notNull().default("not_connected"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("payment_provider_accounts_owner_unique").on(table.ownerType, table.ownerId),
  uniqueIndex("payment_provider_accounts_external_unique").on(table.providerName, table.externalAccountId)
    .where(sql`${table.providerName} IS NOT NULL AND ${table.externalAccountId} IS NOT NULL`),
  check("payment_provider_accounts_owner_type_check", sql`${table.ownerType} IN ('client', 'talent')`),
  check("payment_provider_accounts_status_check", sql`${table.status} IN ('not_connected', 'pending', 'active', 'restricted')`),
]);

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  periodId: uuid("period_id").references(() => invoicePeriods.id, { onDelete: "restrict" }),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id, { onDelete: "restrict" }),
  clientId: varchar("client_id").notNull().references(() => users.id),
  invoiceNumber: text("invoice_number").unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).notNull(),
  paymentMethod: text("payment_method"),
  externalRef: text("external_ref"),
  paymentProvider: text("payment_provider"),
  externalChargeId: text("external_charge_id"),
  status: text("status").notNull().default("draft"),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  paymentInstructions: text("payment_instructions"),
  cardPaymentUrl: text("card_payment_url"),
}, (table) => [
  index("idx_invoices_contract").on(table.hiringContractId),
  index("idx_invoices_status").on(table.status),
  index("idx_invoices_client").on(table.clientId),
  check("invoices_payment_method_check", sql`${table.paymentMethod} IN ('wire', 'credit_card')`),
  check("invoices_status_check", sql`${table.status} IN ('draft', 'sent', 'paid', 'overdue', 'void')`),
]);

export const payouts = pgTable("payouts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  periodId: uuid("period_id").references(() => invoicePeriods.id, { onDelete: "restrict" }),
  talentInvoiceId: uuid("talent_invoice_id"),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id, { onDelete: "restrict" }),
  talentId: varchar("talent_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  payoutRegion: text("payout_region").references(() => payoutRegionConfigs.regionCode),
  payoutMethod: text("payout_method"),
  externalRef: text("external_ref"),
  paymentProvider: text("payment_provider"),
  externalTransferId: text("external_transfer_id"),
  status: text("status").notNull().default("pending"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  payoutDueOn: date("payout_due_on"),
  disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
  failedReason: text("failed_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_payouts_contract").on(table.hiringContractId),
  index("idx_payouts_talent").on(table.talentId),
  index("idx_payouts_status").on(table.status),
  uniqueIndex("payouts_talent_invoice_unique").on(table.talentInvoiceId)
    .where(sql`${table.talentInvoiceId} IS NOT NULL`),
  check("payouts_status_check", sql`${table.status} IN ('pending', 'scheduled', 'disbursed', 'failed')`),
]);

// Phase 3B Talent-facing invoices are isolated from the historical Client
// invoice ledger above. Client monthly invoices contain all-in line amounts.
export const talentInvoices = pgTable("talent_invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id, { onDelete: "restrict" }),
  offerId: uuid("offer_id").notNull().references(() => offers.id, { onDelete: "restrict" }),
  talentId: varchar("talent_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  clientId: varchar("client_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  billingMode: text("billing_mode").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  currency: text("currency").notNull().default("USD"),
  monthlyRate: decimal("monthly_rate", { precision: 12, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  baseAmount: decimal("base_amount", { precision: 12, scale: 2 }).notNull(),
  creditAmount: decimal("credit_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  hours: decimal("hours", { precision: 10, scale: 4 }),
  standardHours: decimal("standard_hours", { precision: 10, scale: 4 }),
  hourlyEquivalent: decimal("hourly_equivalent", { precision: 12, scale: 4 }),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).notNull().default("0.2000"),
  timesheetRevisionId: uuid("timesheet_revision_id").references(() => timesheetRevisions.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("draft"),
  draftedAt: timestamp("drafted_at", { withTimezone: true }).notNull().defaultNow(),
  autoSendAt: timestamp("auto_send_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  payoutDueOn: date("payout_due_on").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("talent_invoices_contract_period_unique").on(table.hiringContractId, table.periodStart, table.periodEnd),
  index("talent_invoices_talent_status_idx").on(table.talentId, table.status),
  index("talent_invoices_period_idx").on(table.periodStart, table.periodEnd),
  check("talent_invoices_billing_mode_check", sql`${table.billingMode} IN ('tracked', 'guaranteed')`),
  check("talent_invoices_status_check", sql`${table.status} IN ('draft', 'sent', 'void')`),
]);

export const guaranteedNonperformanceClaims = pgTable("guaranteed_nonperformance_claims", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  talentInvoiceId: uuid("talent_invoice_id").unique().references(() => talentInvoices.id, { onDelete: "restrict" }),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id, { onDelete: "restrict" }),
  clientId: varchar("client_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  decisionReason: text("decision_reason"),
  decidedBy: varchar("decided_by").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
}, (table) => [
  index("guaranteed_claims_status_idx").on(table.status),
  unique("guaranteed_nonperformance_claims_hiring_contract_id_period_start_period_end_key")
    .on(table.hiringContractId, table.periodStart, table.periodEnd),
  check("guaranteed_nonperformance_claims_status_check", sql`${table.status} IN ('open', 'approved', 'rejected')`),
]);

export const talentCreditMemos = pgTable("talent_credit_memos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  originalInvoiceId: uuid("original_invoice_id").notNull().references(() => talentInvoices.id, { onDelete: "restrict" }),
  correctedRevisionId: uuid("corrected_revision_id").notNull().references(() => timesheetRevisions.id, { onDelete: "restrict" }),
  talentId: varchar("talent_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id, { onDelete: "restrict" }),
  currency: text("currency").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("talent_credit_memos_invoice_revision_idx").on(table.originalInvoiceId, table.correctedRevisionId),
  index("talent_credit_memos_talent_idx").on(table.talentId, table.createdAt),
]);

export const talentCreditMemoApplications = pgTable("talent_credit_memo_applications", {
  creditMemoId: uuid("credit_memo_id").notNull().references(() => talentCreditMemos.id, { onDelete: "restrict" }),
  talentInvoiceId: uuid("talent_invoice_id").notNull().references(() => talentInvoices.id, { onDelete: "restrict" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.creditMemoId, table.talentInvoiceId] })]);

export const talentCreditMemoApplicationsV2 = pgTable("talent_credit_memo_applications_v2", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  creditMemoId: uuid("credit_memo_id").notNull().references(() => talentCreditMemos.id, { onDelete: "restrict" }),
  talentInvoiceId: uuid("talent_invoice_id").notNull().references(() => talentInvoices.id, { onDelete: "restrict" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("talent_credit_memo_apps_v2_invoice_idx").on(table.talentInvoiceId),
  index("talent_credit_memo_apps_v2_memo_idx").on(table.creditMemoId),
  check("talent_credit_memo_applications_v2_amount_check", sql`${table.amount} <> 0`),
]);

export const securityDepositReplenishments = pgTable("security_deposit_replenishments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id, { onDelete: "restrict" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  recordedBy: varchar("recorded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("security_deposit_replenishments_contract_idx").on(table.hiringContractId, table.createdAt),
  check("security_deposit_replenishments_amount_check", sql`${table.amount} > 0`),
]);

export const clientMonthlyInvoices = pgTable("client_monthly_invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  invoiceMonth: date("invoice_month").notNull(),
  currency: text("currency").notNull().default("USD"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("sent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("client_monthly_invoices_owner_month_currency").on(table.clientId, table.invoiceMonth, table.currency),
  check("client_monthly_invoices_status_check", sql`${table.status} IN ('draft', 'sent')`),
]);

export const clientMonthlyInvoiceLines = pgTable("client_monthly_invoice_lines", {
  clientMonthlyInvoiceId: uuid("client_monthly_invoice_id").notNull().references(() => clientMonthlyInvoices.id, { onDelete: "restrict" }),
  talentInvoiceId: uuid("talent_invoice_id").notNull().unique().references(() => talentInvoices.id, { onDelete: "restrict" }),
  talentAmount: decimal("talent_amount", { precision: 12, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).notNull(),
  clientAmount: decimal("client_amount", { precision: 12, scale: 2 }).notNull(),
}, (table) => [primaryKey({ columns: [table.clientMonthlyInvoiceId, table.talentInvoiceId] })]);

// Late Guaranteed Client claims and their credit applications are an isolated
// ledger: they never mutate a sent Talent invoice or a sent Client statement.
export const clientLateGuaranteedClaims = pgTable("client_late_guaranteed_claims", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id, { onDelete: "restrict" }),
  originalTalentInvoiceId: uuid("original_talent_invoice_id").notNull().unique().references(() => talentInvoices.id, { onDelete: "restrict" }),
  clientId: varchar("client_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  decisionReason: text("decision_reason"),
  decidedBy: varchar("decided_by").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("client_late_claim_contract_period_unique").on(table.hiringContractId, table.periodStart, table.periodEnd),
  index("client_late_guaranteed_claims_status_idx").on(table.status, table.createdAt),
  check("client_late_guaranteed_claims_status_check", sql`${table.status} IN ('open', 'approved', 'rejected')`),
]);

export const clientCreditMemos = pgTable("client_credit_memos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  lateClaimId: uuid("late_claim_id").notNull().unique().references(() => clientLateGuaranteedClaims.id, { onDelete: "restrict" }),
  hiringContractId: uuid("hiring_contract_id").notNull().references(() => hiringContracts.id, { onDelete: "restrict" }),
  originalTalentInvoiceId: uuid("original_talent_invoice_id").notNull().unique().references(() => talentInvoices.id, { onDelete: "restrict" }),
  clientId: varchar("client_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  currency: text("currency").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  allInAmount: decimal("all_in_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("client_credit_memos_client_currency_idx").on(table.clientId, table.currency, table.periodStart, table.createdAt),
  check("client_credit_memos_all_in_amount_check", sql`${table.allInAmount} > 0`),
]);

export const clientCreditApplications = pgTable("client_credit_applications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientCreditMemoId: uuid("client_credit_memo_id").notNull().references(() => clientCreditMemos.id, { onDelete: "restrict" }),
  clientMonthlyInvoiceId: uuid("client_monthly_invoice_id").notNull().references(() => clientMonthlyInvoices.id, { onDelete: "restrict" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("client_credit_memo_statement_unique").on(table.clientCreditMemoId, table.clientMonthlyInvoiceId),
  index("client_credit_applications_invoice_idx").on(table.clientMonthlyInvoiceId),
  index("client_credit_applications_memo_idx").on(table.clientCreditMemoId),
  check("client_credit_applications_amount_check", sql`${table.amount} > 0`),
]);

export const securityDeposits = pgTable("security_deposits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hiringContractId: uuid("hiring_contract_id").notNull().unique().references(() => hiringContracts.id, { onDelete: "restrict" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"),
  heldAt: timestamp("held_at", { withTimezone: true }),
  drawnAt: timestamp("drawn_at", { withTimezone: true }),
  drawnReason: text("drawn_reason"),
  replenishmentDueAt: timestamp("replenishment_due_at", { withTimezone: true }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  cureDeadlineAt: timestamp("cure_deadline_at", { withTimezone: true }),
  terminalReason: text("terminal_reason"),
  noticeGivenAt: timestamp("notice_given_at", { withTimezone: true }),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  appliedToInvoiceId: uuid("applied_to_invoice_id").references(() => invoices.id),
  forfeitedAt: timestamp("forfeited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_security_deposits_contract").on(table.hiringContractId),
  index("idx_security_deposits_status").on(table.status),
  check("security_deposits_status_check", sql`${table.status} IN ('pending', 'held', 'drawn', 'replenishment_pending', 'suspended', 'forfeited', 'applied', 'void')`),
]);

export const insertHiringContractSchema = createInsertSchema(hiringContracts).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertHiringContract = z.infer<typeof insertHiringContractSchema>;
export type HiringContract = typeof hiringContracts.$inferSelect;

// ── Admin Interviewers ────────────────────────────────────────────────────────
// Self-service interviewer configuration managed from the Admin dashboard.
// Replaces the ONSPOT_INTERVIEWERS_JSON Replit Secret for new entries.
// The calendarEmail is the M365 UPN used to query Graph free/busy data.
export const adminInterviewers = pgTable("admin_interviewers", {
  id:            uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name:          text("name").notNull(),
  title:         text("title").notNull().default(""),
  calendarEmail: text("calendar_email").notNull().default(""),
  sortOrder:     integer("sort_order").notNull().default(0),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_admin_interviewers_sort_order").on(table.sortOrder),
]);

export const insertAdminInterviewerSchema = createInsertSchema(adminInterviewers).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertAdminInterviewer = z.infer<typeof insertAdminInterviewerSchema>;
export type AdminInterviewer = typeof adminInterviewers.$inferSelect;
