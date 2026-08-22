import { applySearchFilter } from "./lib/jobSearchFilter.js";
import {
  type User, type InsertUser, type UpsertUser,
  type Profile, type InsertProfile,
  type Skill, type InsertSkill,
  type UserSkill, type InsertUserSkill,
  type Job, type InsertJob,
  type JobSkill, type InsertJobSkill,
  type Proposal, type InsertProposal,
  type Contract, type InsertContract,
  type Milestone, type InsertMilestone,
  type TimeEntry, type InsertTimeEntry,
  type MessageThread, type InsertMessageThread,
  type Message, type InsertMessage,
  type Review, type InsertReview,
  type PortfolioItem, type InsertPortfolioItem,
  type Certification, type InsertCertification,
  type Payment, type InsertPayment,
  type Dispute, type InsertDispute,
  type Notification, type InsertNotification,
  type LeadIntake, type InsertLeadIntake,
  type CsvTalentRow, type CsvBulkImport, type CsvImportResult, type CsvTemplate, type BulkTalentData,
  type VanessaLog, type InsertVanessaLog,
  type Feedback, type InsertFeedback,
  type Correction, type InsertCorrection,
  type TrainingLog, type InsertTrainingLog,
  type LegalOpsTrial, type InsertLegalOpsTrial,
  type Post, type InsertPost,
  type HotSearch, type InsertHotSearch,
  type Candidate, type InsertCandidate,
  type CultureEvaluation, type InsertCultureEvaluation,
  leadIntakes,
  vanessaLogs,
  feedbacks,
  corrections,
  trainingLogs,
  legalOpsTrials,
  posts,
  hotSearches,
  jobs as jobsTable,
  candidates as candidatesTable,
  candidateCultureEvaluations as cultureEvaluationsTable,
  messageThreads as messageThreadsTable,
  messages as messagesTable,
  certifications as certificationsTable,
  notifications as notificationsTable,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db, pool, query as dbQuery } from "./db";
import { eq, ne, and, or, gte, ilike, desc, asc, sql as sqlOp } from "drizzle-orm";

// Type for creating user with password
export interface CreateUserData {
  email: string;
  password: string; // Will be hashed before storing as passwordHash
  firstName: string;
  lastName: string;
  role: "client" | "talent";
  company?: string; // Optional for clients
}

export interface MessageNotificationInput {
  recipientId: string;
  threadId: string;
  senderName: string;
  messageId?: string;
}

function messageNotificationCopy(senderName: string, count: number): {
  title: string;
  message: string;
} {
  const safeSenderName = senderName.trim() || "A participant";
  if (count === 1) {
    return {
      title: `New message from ${safeSenderName}`,
      message: `${safeSenderName} sent you a new message.`,
    };
  }
  return {
    title: `${count} new messages from ${safeSenderName}`,
    message: `${safeSenderName} sent you ${count} new messages.`,
  };
}

function messageNotificationSenderName(notification: Pick<Notification, "title" | "message">): string {
  const title = notification.title?.trim() ?? "";
  const titleMatch = title.match(/^(?:New message from|\d+ new messages from)\s+(.+)$/i);
  if (titleMatch?.[1]?.trim()) {
    return titleMatch[1].trim();
  }

  const message = notification.message?.trim() ?? "";
  const messageMatch = message.match(/^(.+?) sent you (?:a new message|\d+ new messages)\.?$/i);
  return messageMatch?.[1]?.trim() || "A participant";
}
function notificationFromRow(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedId: row.related_id ?? null,
    relatedType: row.related_type ?? null,
    eventKey: row.event_key ?? null,
    messageCount: Number(row.message_count ?? 1),
    isRead: row.is_read ?? false,
    createdAt: row.created_at ?? null,
  };
}

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createUserWithPassword(userData: CreateUserData): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  
  // Replit Auth user management
  upsertUser(user: UpsertUser): Promise<User>;

  // Profiles
  getProfile(id: string): Promise<Profile | undefined>;
  getProfileByUserId(userId: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(id: string, updates: Partial<InsertProfile>): Promise<Profile | undefined>;
  searchProfiles(filters: {
    location?: string;
    skills?: string[];
    availability?: string;
    minRate?: number;
    maxRate?: number;
    rating?: number;
  }): Promise<Profile[]>;

  // Skills
  getSkill(id: number): Promise<Skill | undefined>;
  getSkillByName(name: string): Promise<Skill | undefined>;
  createSkill(skill: InsertSkill): Promise<Skill>;
  listSkills(category?: string): Promise<Skill[]>;
  searchSkills(query: string): Promise<Skill[]>;

  // User Skills
  getUserSkill(id: number): Promise<UserSkill | undefined>;
  getUserSkills(userId: string): Promise<UserSkill[]>;
  getUserSkillsWithNames(userId: string): Promise<(UserSkill & { skill: { name: string; category: string } | null })[]>;
  createUserSkill(userSkill: InsertUserSkill): Promise<UserSkill>;
  updateUserSkill(id: number, updates: Partial<InsertUserSkill>): Promise<UserSkill | undefined>;
  deleteUserSkill(id: number): Promise<boolean>;

  // Jobs
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<InsertJob>): Promise<Job | undefined>;
  searchJobs(filters: {
    category?: string;
    engagementType?: string;
    experienceLevel?: string;
    minBudget?: number;
    maxBudget?: number;
    skills?: string[];
    status?: string;
  }): Promise<Job[]>;
  listJobsByClient(clientId: string): Promise<Job[]>;
  listAllJobs(): Promise<Job[]>;

  // Job Skills
  getJobSkills(jobId: string): Promise<JobSkill[]>;
  createJobSkill(jobSkill: InsertJobSkill): Promise<JobSkill>;
  deleteJobSkill(id: number): Promise<boolean>;

  // Proposals
  getProposal(id: string): Promise<Proposal | undefined>;
  createProposal(proposal: InsertProposal): Promise<Proposal>;
  updateProposal(id: string, updates: Partial<InsertProposal>): Promise<Proposal | undefined>;
  listProposalsByJob(jobId: string): Promise<Proposal[]>;
  listProposalsByTalent(talentId: string): Promise<Proposal[]>;

  // Contracts
  getContract(id: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, updates: Partial<InsertContract>): Promise<Contract | undefined>;
  listContractsByClient(clientId: string): Promise<Contract[]>;
  listContractsByTalent(talentId: string): Promise<Contract[]>;

  // Milestones
  getMilestone(id: string): Promise<Milestone | undefined>;
  createMilestone(milestone: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: string, updates: Partial<InsertMilestone>): Promise<Milestone | undefined>;
  listMilestonesByContract(contractId: string): Promise<Milestone[]>;

  // Time Entries
  getTimeEntry(id: string): Promise<TimeEntry | undefined>;
  createTimeEntry(timeEntry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: string, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  listTimeEntriesByContract(contractId: string): Promise<TimeEntry[]>;
  listTimeEntriesByTalent(talentId: string, startDate?: Date, endDate?: Date): Promise<TimeEntry[]>;

  // Messages
  getMessageThread(id: string): Promise<MessageThread | undefined>;
  createMessageThread(thread: InsertMessageThread): Promise<MessageThread>;
  listMessageThreadsByUser(userId: string): Promise<MessageThread[]>;
  listMessageThreadsByUserWithUnread(userId: string): Promise<Array<MessageThread & {
    unreadCount: number;
    latestMessageAt: Date | null;
  }>>;
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  listMessagesByThread(threadId: string): Promise<Message[]>;
  markMessagesAsRead(threadId: string, userId: string): Promise<void>;
  flagMessageForReview(messageId: string): Promise<void>;
  listFlaggedMessages(): Promise<Array<Message & { thread: MessageThread | null }>>;
  clearMessageFlag(messageId: string): Promise<void>;

  // Reviews
  getReview(id: string): Promise<Review | undefined>;
  createReview(review: InsertReview): Promise<Review>;
  listReviewsByUser(userId: string, asReviewer?: boolean): Promise<Review[]>;
  listReviewsByContract(contractId: string): Promise<Review[]>;

  // Portfolio
  getPortfolioItem(id: string): Promise<PortfolioItem | undefined>;
  createPortfolioItem(item: InsertPortfolioItem): Promise<PortfolioItem>;
  updatePortfolioItem(id: string, updates: Partial<InsertPortfolioItem>): Promise<PortfolioItem | undefined>;
  listPortfolioItemsByTalent(talentId: string): Promise<PortfolioItem[]>;
  deletePortfolioItem(id: string): Promise<boolean>;

  // Certifications
  getCertification(id: string): Promise<Certification | undefined>;
  createCertification(cert: InsertCertification): Promise<Certification>;
  listCertificationsByTalent(talentId: string): Promise<Certification[]>;
  updateCertification(id: string, updates: Partial<InsertCertification>): Promise<Certification | undefined>;
  deleteCertification(id: string): Promise<boolean>;

  // Payments
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment | undefined>;
  listPaymentsByUser(userId: string, asPayer?: boolean): Promise<Payment[]>;

  // Disputes
  getDispute(id: string): Promise<Dispute | undefined>;
  createDispute(dispute: InsertDispute): Promise<Dispute>;
  updateDispute(id: string, updates: Partial<InsertDispute>): Promise<Dispute | undefined>;
  listDisputesByUser(userId: string): Promise<Dispute[]>;
  listOpenDisputes(): Promise<Dispute[]>;

  // Notifications
  getNotification(id: string): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  upsertMessageNotification(input: MessageNotificationInput): Promise<Notification | undefined>;
  consolidateUnreadMessageNotifications(): Promise<number>;
  listNotificationsByUser(userId: string, unreadOnly?: boolean): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<boolean>;
  markMessageNotificationsAsRead(userId: string, threadId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  // Enhanced job methods with skills
  getJobWithSkills(jobId: string): Promise<(Job & { skills: string[] }) | undefined>;
  searchJobsWithSkills(filters: {
    category?: string;
    engagementType?: string;
    experienceLevel?: string;
    minBudget?: number;
    maxBudget?: number;
    skills?: string[];
    status?: string;
    q?: string;
  }): Promise<(Job & { skills: string[] })[]>;

  // Job matching algorithm
  calculateJobMatches(talentId: string, filters?: {
    skills?: string[];
    minRate?: number;
    maxRate?: number;
    timezone?: string;
    engagementType?: string;
    category?: string;
    experienceLevel?: string;
  }, candidateOverride?: Candidate): Promise<Array<{
    job: Job & { skills: string[] };
    score: number;
    overlapSkills: string[];
  }>>;

  rankTalentForJob(jobId: string, limit?: number): Promise<Array<{
    candidateId: string;
    userId: string;
    score: number;
    overlapSkills: string[];
    matchReasons: Record<string, any>;
    candidate: Record<string, any>;
  }>>;

  /**
   * Score all candidates against a set of search parameters WITHOUT writing
   * any row to the database. Used for the public anonymous search endpoint.
   */
  rankTalentByParams(params: {
    title: string;
    category: string;
    engagementType: string;
  }, limit?: number): Promise<Array<{
    candidateId: string;
    userId: string;
    score: number;
    overlapSkills: string[];
    matchReasons: Record<string, any>;
    candidate: Record<string, any>;
  }>>;

  // LinkedIn Integration
  getLinkedinProfile(id: string): Promise<any | undefined>;
  getLinkedinProfileByUserId(userId: string): Promise<any | undefined>;
  createLinkedinProfile(profile: any): Promise<any>;
  updateLinkedinProfile(id: string, updates: Partial<any>): Promise<any | undefined>;
  deleteLinkedinProfile(id: string): Promise<boolean>;

  // Lead Intake
  createLeadIntake(leadIntake: InsertLeadIntake): Promise<LeadIntake>;
  getLeadIntake(id: string): Promise<LeadIntake | undefined>;
  updateLeadIntake(id: string, updates: Partial<InsertLeadIntake>): Promise<LeadIntake | undefined>;
  searchLeadIntakes(filters: { status?: string; email?: string; createdAfter?: Date }): Promise<LeadIntake[]>;
  listLeadIntakesByStatus(status: string): Promise<LeadIntake[]>;

  // CSV Bulk Talent Import
  bulkCreateTalents(talentData: BulkTalentData[]): Promise<CsvImportResult>;
  validateCsvTalentRows(rows: CsvTalentRow[]): Promise<{
    validRows: BulkTalentData[];
    errors: Array<{ rowIndex: number; email: string; errors: string[]; }>;
    duplicateEmails: string[];
  }>;
  createTalentFromCsvRow(csvRow: CsvTalentRow, rowIndex: number): Promise<{
    success: boolean;
    userId?: string;
    profileId?: string;
    error?: string;
    warnings: string[];
  }>;
  ensureSkillsExist(skillNames: string[]): Promise<Skill[]>;
  getUserByEmail(email: string): Promise<User | undefined>;

  // Vanessa AI Conversation Logs
  createVanessaLog(log: InsertVanessaLog): Promise<VanessaLog>;
  getVanessaLogsByThread(threadId: string): Promise<VanessaLog[]>;
  getAllVanessaThreads(): Promise<{ threadId: string; firstMessage: string; lastMessage: string; messageCount: number; createdAt: Date; updatedAt: Date }[]>;
  searchVanessaLogs(query: string): Promise<VanessaLog[]>;
  deleteVanessaThread(threadId: string): Promise<boolean>;

  // Vanessa Feedbacks
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  getFeedbacksByTopic(topic: string): Promise<Feedback[]>;
  getFeedbackCountByTopic(topic: string): Promise<number>;
  getAllFeedbacks(): Promise<Feedback[]>;
  getFeedbackStats(): Promise<{
    totalCount: number;
    positiveCount: number;
    negativeCount: number;
    recentFeedback: Feedback[];
  }>;

  // Admin Corrections for Vanessa Training
  createCorrection(correction: InsertCorrection): Promise<Correction>;
  getVanessaLog(logId: number): Promise<VanessaLog | undefined>;
  getAllCorrections(): Promise<Correction[]>;
  getCorrectionsByTopic(topic: string): Promise<Correction[]>;

  // Training Logs - Admin conversational training with Vanessa
  createTrainingLog(trainingLog: InsertTrainingLog): Promise<TrainingLog>;
  getTrainingLogsByAdmin(adminId: string): Promise<TrainingLog[]>;
  getAllTrainingLogs(): Promise<TrainingLog[]>;

  // LegalOps Trial Signups
  createLegalOpsTrial(trial: InsertLegalOpsTrial): Promise<LegalOpsTrial>;
  getLegalOpsTrialByEmail(email: string): Promise<LegalOpsTrial | undefined>;
  getAllLegalOpsTrials(): Promise<LegalOpsTrial[]>;

  // Blog Posts (Insights page)
  getPost(id: string): Promise<Post | undefined>;
  getPostBySlug(slug: string): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: string, updates: Partial<InsertPost>): Promise<Post | undefined>;
  deletePost(id: string): Promise<boolean>;
  listPublishedPosts(options?: { category?: string; featured?: boolean }): Promise<Post[]>;
  listAllPosts(): Promise<Post[]>;
  listHomepagePosts(): Promise<Post[]>;
  incrementPostViews(id: string): Promise<number>;
  incrementPostLikes(id: string): Promise<number>;

  // Hot Searches
  trackHotSearch(term: string): Promise<HotSearch>;
  getHotSearches(range: "daily" | "weekly"): Promise<{ term: string; count: number }[]>;

  // Candidates
  createCandidate(data: InsertCandidate): Promise<Candidate>;
  getCandidate(id: string): Promise<Candidate | undefined>;
  getCandidateByEmail(email: string): Promise<Candidate | undefined>;
  getCandidateByUserId(userId: string): Promise<Candidate | undefined>;
  getCandidates(): Promise<Candidate[]>;
  updateCandidate(id: string, updates: Partial<InsertCandidate>): Promise<Candidate | undefined>;

  // Culture Evaluations
  upsertCultureEvaluation(candidateId: string, data: Omit<InsertCultureEvaluation, "candidateId">): Promise<CultureEvaluation>;
  getCultureEvaluationByCandidate(candidateId: string): Promise<CultureEvaluation | undefined>;

  // Scaffold job maintenance
  cleanupOrphanedScaffoldJobs(): Promise<number>;
  countOrphanedScaffoldJobs(): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  private profiles: Map<string, Profile>;

  private skills: Map<number, Skill>;

  private userSkills: Map<number, UserSkill>;

  private jobs: Map<string, Job>;

  private jobSkills: Map<number, JobSkill>;

  private proposals: Map<string, Proposal>;

  private contracts: Map<string, Contract>;

  private milestones: Map<string, Milestone>;

  private timeEntries: Map<string, TimeEntry>;

  private messageThreads: Map<string, MessageThread>;

  private messages: Map<string, Message>;

  private reviews: Map<string, Review>;

  private portfolioItems: Map<string, PortfolioItem>;

  private certifications: Map<string, Certification>;

  private payments: Map<string, Payment>;

  private disputes: Map<string, Dispute>;

  private notifications: Map<string, Notification>;

  private linkedinProfiles: Map<string, any>;

  private leadIntakes: Map<string, LeadIntake>;

  private vanessaLogs: Map<number, VanessaLog>;

  // Counter for auto-incrementing IDs
  private skillIdCounter: number = 1;

  private userSkillIdCounter: number = 1;

  private vanessaLogIdCounter: number = 1;

  private jobSkillIdCounter: number = 1;

  constructor() {
    this.users = new Map();
    this.profiles = new Map();
    this.skills = new Map();
    this.userSkills = new Map();
    this.jobs = new Map();
    this.jobSkills = new Map();
    this.proposals = new Map();
    this.contracts = new Map();
    this.milestones = new Map();
    this.timeEntries = new Map();
    this.messageThreads = new Map();
    this.messages = new Map();
    this.reviews = new Map();
    this.portfolioItems = new Map();
    this.certifications = new Map();
    this.payments = new Map();
    this.disputes = new Map();
    this.notifications = new Map();
    this.linkedinProfiles = new Map();
    this.leadIntakes = new Map();
    this.vanessaLogs = new Map();

    // Seed default skills for OnSpot marketplace
    this.seedDefaultSkills();
  }

  private seedDefaultSkills(): void {
    const defaultSkills = [
      // Technical Skills
      { name: "JavaScript", category: "Technical" },
      { name: "Python", category: "Technical" },
      { name: "React", category: "Technical" },
      { name: "Node.js", category: "Technical" },
      { name: "PHP", category: "Technical" },
      { name: "WordPress", category: "Technical" },
      { name: "HTML/CSS", category: "Technical" },
      { name: "Java", category: "Technical" },
      { name: "C#", category: "Technical" },
      { name: "Database Administration", category: "Technical" },
      { name: "DevOps", category: "Technical" },
      { name: "Mobile App Development", category: "Technical" },

      // Creative Skills
      { name: "Graphic Design", category: "Creative" },
      { name: "Logo Design", category: "Creative" },
      { name: "UI/UX Design", category: "Creative" },
      { name: "Video Editing", category: "Creative" },
      { name: "Content Writing", category: "Creative" },
      { name: "Copywriting", category: "Creative" },
      { name: "Social Media Management", category: "Creative" },
      { name: "Digital Marketing", category: "Creative" },
      { name: "SEO", category: "Creative" },
      { name: "Photography", category: "Creative" },

      // Administrative Skills
      { name: "Virtual Assistant", category: "Administrative" },
      { name: "Data Entry", category: "Administrative" },
      { name: "Customer Service", category: "Administrative" },
      { name: "Project Management", category: "Administrative" },
      { name: "Accounting", category: "Administrative" },
      { name: "Bookkeeping", category: "Administrative" },
      { name: "Translation", category: "Administrative" },
      { name: "Transcription", category: "Administrative" },
      { name: "Lead Generation", category: "Administrative" },
      { name: "Research", category: "Administrative" },

      // Specialized Skills
      { name: "Call Center", category: "Specialized" },
      { name: "Technical Support", category: "Specialized" },
      { name: "Sales", category: "Specialized" },
      { name: "Nursing", category: "Specialized" },
      { name: "Teaching/Tutoring", category: "Specialized" },
      { name: "Legal Services", category: "Specialized" },
      { name: "Engineering", category: "Specialized" },
      { name: "Architecture", category: "Specialized" }
    ];

    for (const skillData of defaultSkills) {
      const skill: Skill = {
        id: this.skillIdCounter++,
        name: skillData.name,
        category: skillData.category,
        createdAt: new Date()
      };
      this.skills.set(skill.id, skill);
    }
  }

  // User Methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = {
      id,
      role: insertUser.role || "client",
      email: insertUser.email || null,
      username: insertUser.username || null,
      company: null,
      firstName: (insertUser as any).firstName || null,
      lastName: (insertUser as any).lastName || null,
      profileImageUrl: (insertUser as any).profileImageUrl || null,
      passwordHash: (insertUser as any).passwordHash || null,
      replitId: insertUser.replitId || null,
      stripeAccountId: insertUser.stripeAccountId || null,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = this.users.get(userData.id!);
    const now = new Date();
    
    if (existingUser) {
      // Update existing user
      const updatedUser: User = {
        ...existingUser,
        ...userData,
        updatedAt: now,
      };
      this.users.set(userData.id!, updatedUser);
      return updatedUser;
    } else {
      // Create new user
      const newUser: User = {
        id: userData.id || randomUUID(),
        username: userData.username || null,
        email: userData.email || null,
        company: null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        profileImageUrl: userData.profileImageUrl || null,
        passwordHash: null, // OAuth users don't have passwords
        role: userData.role || "client",
        replitId: userData.replitId || null,
        stripeAccountId: userData.stripeAccountId || null,
        createdAt: now,
        updatedAt: now,
      };
      this.users.set(newUser.id, newUser);
      return newUser;
    }
  }

  async createUserWithPassword(userData: CreateUserData): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    
    // Create user with hashed password
    const user: User = {
      id,
      username: null, // Not required for email/password auth
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      profileImageUrl: null,
      passwordHash: userData.password, // Password is already hashed by caller
      company: userData.company || null, // Store company field for clients
      role: userData.role,
      replitId: null, // Only for OAuth users
      stripeAccountId: null,
      createdAt: now,
      updatedAt: now,
    };
    
    this.users.set(id, user);
    
    // Auto-create profile for talent users
    if (userData.role === "talent") {
      const profile: Profile = {
        id: randomUUID(),
        userId: user.id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        title: null,
        bio: null,
        location: "Global",
        hourlyRate: null,
        rateCurrency: "USD",
        availability: "available",
        profilePicture: null,
        phoneNumber: null,
        languages: ["English"],
        timezone: "UTC",
        rating: "0",
        totalEarnings: "0",
        jobSuccessScore: 0,
        createdAt: now,
        updatedAt: now,
      };
      this.profiles.set(profile.id, profile);
    }
    
    return user;
  }

  // Profile Methods
  async getProfile(id: string): Promise<Profile | undefined> {
    return this.profiles.get(id);
  }

  async getProfileByUserId(userId: string): Promise<Profile | undefined> {
    return Array.from(this.profiles.values()).find(profile => profile.userId === userId);
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const id = randomUUID();
    const now = new Date();
    const profile: Profile = {
      ...insertProfile,
      id,
      location: insertProfile.location ?? "Global",
      rateCurrency: insertProfile.rateCurrency ?? "USD",
      availability: insertProfile.availability ?? "available",
      languages: insertProfile.languages ?? ["English"],
      timezone: insertProfile.timezone ?? "UTC",
      rating: insertProfile.rating ?? "0",
      totalEarnings: insertProfile.totalEarnings ?? "0",
      jobSuccessScore: insertProfile.jobSuccessScore ?? 0,
      title: insertProfile.title ?? null,
      bio: insertProfile.bio ?? null,
      hourlyRate: insertProfile.hourlyRate ?? null,
      profilePicture: insertProfile.profilePicture ?? null,
      phoneNumber: insertProfile.phoneNumber ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.profiles.set(id, profile);
    return profile;
  }

  async updateProfile(id: string, updates: Partial<InsertProfile>): Promise<Profile | undefined> {
    const profile = this.profiles.get(id);
    if (!profile) return undefined;

    const updatedProfile: Profile = {
      ...profile,
      ...updates,
      updatedAt: new Date()
    };
    this.profiles.set(id, updatedProfile);
    return updatedProfile;
  }

  async searchProfiles(filters: {
    location?: string;
    skills?: string[];
    availability?: string;
    minRate?: number;
    maxRate?: number;
    rating?: number;
  }): Promise<Profile[]> {
    let profiles = Array.from(this.profiles.values());

    if (filters.location) {
      profiles = profiles.filter(p => 
        p.location?.toLowerCase().includes(filters.location!.toLowerCase())
      );
    }

    if (filters.availability) {
      profiles = profiles.filter(p => p.availability === filters.availability);
    }

    if (filters.minRate !== undefined) {
      profiles = profiles.filter(p => 
        p.hourlyRate && parseFloat(p.hourlyRate) >= filters.minRate!
      );
    }

    if (filters.maxRate !== undefined) {
      profiles = profiles.filter(p => 
        p.hourlyRate && parseFloat(p.hourlyRate) <= filters.maxRate!
      );
    }

    if (filters.rating !== undefined) {
      profiles = profiles.filter(p => 
        p.rating && parseFloat(p.rating) >= filters.rating!
      );
    }

    if (filters.skills && filters.skills.length > 0) {
      // Filter by user skills
      profiles = profiles.filter(profile => {
        const userSkills = Array.from(this.userSkills.values())
          .filter(us => us.userId === profile.userId);
        const userSkillIds = userSkills.map(us => us.skillId);
        const userSkillNames = userSkillIds.map(id => this.skills.get(id)?.name).filter(Boolean);
        
        return filters.skills!.some(skillName => 
          userSkillNames.some(userSkill => 
            userSkill?.toLowerCase().includes(skillName.toLowerCase())
          )
        );
      });
    }

    return profiles;
  }

  // Skill Methods
  async getSkill(id: number): Promise<Skill | undefined> {
    return this.skills.get(id);
  }

  async getSkillByName(name: string): Promise<Skill | undefined> {
    return Array.from(this.skills.values()).find(skill => 
      skill.name.toLowerCase() === name.toLowerCase()
    );
  }

  async createSkill(insertSkill: InsertSkill): Promise<Skill> {
    const id = this.skillIdCounter++;
    const skill: Skill = {
      ...insertSkill,
      id,
      createdAt: new Date()
    };
    this.skills.set(id, skill);
    return skill;
  }

  async listSkills(category?: string): Promise<Skill[]> {
    let skills = Array.from(this.skills.values());
    if (category) {
      skills = skills.filter(skill => skill.category === category);
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  async searchSkills(query: string): Promise<Skill[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.skills.values()).filter(skill =>
      skill.name.toLowerCase().includes(searchTerm) ||
      skill.category.toLowerCase().includes(searchTerm)
    );
  }

  // User Skill Methods
  async getUserSkill(id: number): Promise<UserSkill | undefined> {
    return Array.from(this.userSkills.values()).find(us => us.id === id);
  }

  async getUserSkills(userId: string): Promise<UserSkill[]> {
    return Array.from(this.userSkills.values()).filter(us => us.userId === userId);
  }

  // Enhanced getUserSkills that includes skill names for better client-side processing
  async getUserSkillsWithNames(userId: string): Promise<(UserSkill & { skill: { name: string; category: string } | null })[]> {
    const userSkills = Array.from(this.userSkills.values()).filter(us => us.userId === userId);
    
    return userSkills.map(userSkill => ({
      ...userSkill,
      skill: this.skills.get(userSkill.skillId) || null
    }));
  }

  async createUserSkill(insertUserSkill: InsertUserSkill): Promise<UserSkill> {
    const id = this.userSkillIdCounter++;
    const userSkill: UserSkill = {
      ...insertUserSkill,
      id,
      level: insertUserSkill.level || "intermediate",
      yearsExperience: insertUserSkill.yearsExperience || 0,
      createdAt: new Date()
    };
    this.userSkills.set(id, userSkill);
    return userSkill;
  }

  async updateUserSkill(id: number, updates: Partial<InsertUserSkill>): Promise<UserSkill | undefined> {
    const userSkill = this.userSkills.get(id);
    if (!userSkill) return undefined;

    const updatedUserSkill: UserSkill = {
      ...userSkill,
      ...updates
    };
    this.userSkills.set(id, updatedUserSkill);
    return updatedUserSkill;
  }

  async deleteUserSkill(id: number): Promise<boolean> {
    return this.userSkills.delete(id);
  }

  // Job Methods
  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const now = new Date();
    const job = {
      ...insertJob,
      id,
      company: insertJob.company ?? "OnSpot",
      location: insertJob.location ?? "Remote",
      budget: insertJob.budget ?? null,
      budgetCurrency: insertJob.budgetCurrency ?? "USD",
      duration: insertJob.duration ?? null,
      status: insertJob.status ?? "open",
      proposalCount: 0,
      createdAt: now,
      updatedAt: now,
    } as Job;
    this.jobs.set(id, job);
    return job;
  }

  async listAllJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values()).sort((a, b) => 
      (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    );
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    const updatedJob: Job = {
      ...job,
      ...updates,
      updatedAt: new Date()
    };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  // Enhanced job with computed skills array
  async getJobWithSkills(jobId: string): Promise<(Job & { skills: string[] }) | undefined> {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    const jobSkills = Array.from(this.jobSkills.values())
      .filter(js => js.jobId === jobId);
    const skillIds = jobSkills.map(js => js.skillId);
    const skillNames = skillIds.map(id => this.skills.get(id)?.name).filter(Boolean) as string[];

    return {
      ...job,
      skills: skillNames
    };
  }

  // Enhanced search with computed skills arrays
  async searchJobsWithSkills(filters: {
    category?: string;
    engagementType?: string;
    experienceLevel?: string;
    minBudget?: number;
    maxBudget?: number;
    skills?: string[];
    status?: string;
    q?: string; // Text search query
  }): Promise<(Job & { skills: string[] })[]> {
    let jobs = Array.from(this.jobs.values());

    if (filters.category) {
      jobs = jobs.filter(j => j.category === filters.category);
    }

    if (filters.engagementType) {
      jobs = jobs.filter(j => j.engagementType === filters.engagementType);
    }

    if (filters.experienceLevel) {
      jobs = jobs.filter(j => j.experienceLevel === filters.experienceLevel);
    }

    if (filters.status) {
      jobs = jobs.filter(j => j.status === filters.status);
    }

    if (filters.minBudget !== undefined) {
      jobs = jobs.filter(j => 
        j.budget && parseFloat(j.budget) >= filters.minBudget!
      );
    }

    if (filters.maxBudget !== undefined) {
      jobs = jobs.filter(j => 
        j.budget && parseFloat(j.budget) <= filters.maxBudget!
      );
    }

    // Add text search support — applySearchFilter imported from ./lib/jobSearchFilter
    if (filters.q) {
      jobs = applySearchFilter(jobs as any[], filters.q) as typeof jobs;
    }

    // Enhance jobs with skills arrays
    const enhancedJobs: (Job & { skills: string[] })[] = jobs.map(job => {
      const jobSkills = Array.from(this.jobSkills.values())
        .filter(js => js.jobId === job.id);
      const skillIds = jobSkills.map(js => js.skillId);
      const skillNames = skillIds.map(id => this.skills.get(id)?.name).filter(Boolean) as string[];
      
      return {
        ...job,
        skills: skillNames
      };
    });

    // Apply skills filter after enhancement
    let filteredJobs = enhancedJobs;
    if (filters.skills && filters.skills.length > 0) {
      filteredJobs = enhancedJobs.filter(job => {
        return filters.skills!.some(skillName => 
          job.skills.some(jobSkill => 
            jobSkill?.toLowerCase().includes(skillName.toLowerCase())
          )
        );
      });
    }

    return filteredJobs.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  // Keep original method for backward compatibility but delegate to enhanced version
  async searchJobs(filters: {
    category?: string;
    engagementType?: string;
    experienceLevel?: string;
    minBudget?: number;
    maxBudget?: number;
    skills?: string[];
    status?: string;
    q?: string; // Text search query
  }): Promise<Job[]> {
    const enhancedJobs = await this.searchJobsWithSkills(filters);
    return enhancedJobs.map(({ skills, ...job }) => job);
  }

  async listJobsByClient(clientId: string): Promise<Job[]> {
    return Array.from(this.jobs.values())
      .filter(job => job.clientId === clientId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  // Job Skill Methods
  async getJobSkills(jobId: string): Promise<JobSkill[]> {
    return Array.from(this.jobSkills.values()).filter(js => js.jobId === jobId);
  }

  async createJobSkill(insertJobSkill: InsertJobSkill): Promise<JobSkill> {
    const id = this.jobSkillIdCounter++;
    const jobSkill: JobSkill = {
      ...insertJobSkill,
      id,
      required: insertJobSkill.required ?? true,
      createdAt: new Date()
    };
    this.jobSkills.set(id, jobSkill);
    return jobSkill;
  }

  async deleteJobSkill(id: number): Promise<boolean> {
    return this.jobSkills.delete(id);
  }

  // Job matching algorithm implementation
  // ── Shared scoring helper ─────────────────────────────────────────────────
  // Pure function — no DB calls. Call this from calculateJobMatches and
  // recomputeMatchesForJob to score a single candidate × job pair.
  private scoreJobForCandidate(
    talentSkills: string[],
    talentProfile: any | null,
    talentCandidate: any | null,
    job: any & { skills: string[] },
  ): { job: any; score: number; overlapSkills: string[]; matchReasons: Record<string, any> } {
    const blank = {
      skillOverlap: [] as string[], engagementMatch: false, rateMatch: false,
      rateRatio: null as number | null, timezoneMatch: 'none' as string,
      categoryMatch: false, experienceMatch: false, factors: [] as string[],
    };

    const overlapSkills = job.skills.filter((js: string) =>
      talentSkills.some(ts =>
        ts.toLowerCase().includes(js.toLowerCase()) ||
        js.toLowerCase().includes(ts.toLowerCase())
      )
    );

    if (overlapSkills.length === 0 && talentSkills.length > 0) {
      return { job, score: 0, overlapSkills: [], matchReasons: blank };
    }

    const skillsUnion = Array.from(new Set([...talentSkills, ...job.skills]));
    const jaccardScore = skillsUnion.length > 0 ? overlapSkills.length / skillsUnion.length : 0;
    let totalScore = jaccardScore * 100;

    const reasons = { ...blank, skillOverlap: overlapSkills };
    if (overlapSkills.length > 0) {
      reasons.factors.push(`Skills: ${overlapSkills.slice(0, 3).join(', ')}`);
    }

    // Engagement type: +20
    if (job.engagementType) {
      const prefs = (talentCandidate?.preferences ?? {}) as Record<string, unknown>;
      const candEngagement = prefs.rateEngagementType as string | undefined;
      if (candEngagement && candEngagement.toLowerCase() === job.engagementType.toLowerCase()) {
        totalScore += 20;
        reasons.engagementMatch = true;
        reasons.factors.push(`Availability: ${job.engagementType}`);
      }

      // Rate: +10 — ratio [0.8, 1.2] + same currency (see ADR for why not simple ≤)
      const candRateRaw = prefs.rateAmount;
      const candRate = candRateRaw != null ? parseFloat(String(candRateRaw)) : null;
      const candCurrency = (prefs.rateCurrency as string | undefined)?.toUpperCase() ?? 'USD';
      const jobCurrency = (job.budgetCurrency ?? 'PHP').toUpperCase();
      if (candRate != null && candRate > 0 && job.budget != null && candCurrency === jobCurrency) {
        const jobBudget = parseFloat(String(job.budget));
        if (jobBudget > 0) {
          const ratio = candRate / jobBudget;
          reasons.rateRatio = ratio;
          if (ratio >= 0.8 && ratio <= 1.2) {
            totalScore += 10;
            reasons.rateMatch = true;
            reasons.factors.push('Rate: within range');
          }
        }
      }
    }

    // Category/industry: +10
    if (talentCandidate?.category && job.category &&
        talentCandidate.category.toLowerCase() === job.category.toLowerCase()) {
      totalScore += 10;
      reasons.categoryMatch = true;
      reasons.factors.push(`Industry: ${job.category}`);
    }

    // Experience level: +10 if within ±1 tier
    const expYears = talentCandidate?.experienceYears as string | undefined;
    const seniority = talentCandidate?.seniority as string | undefined;
    const jobLevel = job.experienceLevel as string | undefined;
    if (jobLevel && (expYears || seniority)) {
      const yearsToTier = (y: string) => {
        const n = parseFloat(y); if (isNaN(n)) return -1;
        if (n < 1) return 0; if (n < 4) return 1; if (n < 8) return 2;
        if (n < 13) return 3; return 4;
      };
      const senToTier = (s: string) => {
        const sl = s.toLowerCase();
        if (/entry|intern|fresh/.test(sl)) return 0;
        if (/junior|jr/.test(sl)) return 1;
        if (/\bmid\b|associate/.test(sl)) return 2;
        if (/senior|sr|lead/.test(sl)) return 3;
        if (/principal|staff|director|executive|vp|chief/.test(sl)) return 4;
        return -1;
      };
      const levelToTier = (l: string) => {
        const ll = l.toLowerCase();
        if (ll.includes('entry')) return 0; if (/junior|jr/.test(ll)) return 1;
        if (ll.includes('mid')) return 2;
        if (/senior|sr|lead/.test(ll)) return 3;
        if (/principal|director|executive/.test(ll)) return 4;
        return 1;
      };
      const candTier = expYears ? yearsToTier(expYears) : (seniority ? senToTier(seniority) : -1);
      const jobTier = levelToTier(jobLevel);
      if (candTier >= 0 && Math.abs(candTier - jobTier) <= 1) {
        totalScore += 10;
        reasons.experienceMatch = true;
        reasons.factors.push(`Experience: ${jobLevel}`);
      }
    }

    // Timezone: FIXED — compare talent timezone vs job.timeZone, not a caller-supplied filter.
    // The old implementation gated on filters?.timezone which was never passed by any caller,
    // meaning this bonus never fired and would have produced wrong explainability copy.
    if (talentProfile?.timezone && job.timeZone) {
      const talentTz = (talentProfile.timezone as string).toLowerCase();
      const jobTz = (job.timeZone as string).toLowerCase();
      if (talentTz === jobTz) {
        totalScore += 15;
        reasons.timezoneMatch = 'exact';
        reasons.factors.push('Timezone: exact match');
      } else if (
        (talentTz.includes('america') && jobTz.includes('america')) ||
        (talentTz.includes('europe') && jobTz.includes('europe')) ||
        (talentTz.includes('asia') && jobTz.includes('asia'))
      ) {
        totalScore += 5;
        reasons.timezoneMatch = 'region';
      }
    }

    // Recency: +10/+5
    if (job.createdAt) {
      const days = (Date.now() - new Date(job.createdAt).getTime()) / 86400000;
      if (days <= 3) totalScore += 10;
      else if (days <= 7) totalScore += 5;
    }

    return { job, score: Math.round(totalScore), overlapSkills, matchReasons: reasons };
  }

  async calculateJobMatches(talentId: string, filters?: {
    skills?: string[];
    minRate?: number;
    maxRate?: number;
    timezone?: string;
    engagementType?: string;
    category?: string;
    experienceLevel?: string;
  }, candidateOverride?: Candidate): Promise<Array<{
    job: Job & { skills: string[] };
    score: number;
    overlapSkills: string[];
    matchReasons: Record<string, any>;
  }>> {
    let talentSkills: string[] = [];
    if (filters?.skills) {
      talentSkills = filters.skills;
    } else {
      const userSkills = await this.getUserSkillsWithNames(talentId);
      talentSkills = userSkills.map(us => us.skill?.name || '').filter(Boolean);
    }

    const talentProfile = await this.getProfileByUserId(talentId);
    // When the caller already resolved the candidate (e.g. Talent JWT auth), use it directly —
    // legacy candidates may have no linked users row, so getCandidateByUserId would miss them.
    const talentCandidate = candidateOverride ?? await this.getCandidateByUserId(talentId);

    // Legacy candidates keep their skills on the candidate record rather than user_skills
    if (talentSkills.length === 0 && talentCandidate) {
      talentSkills = [
        ...(talentCandidate.coreSkills ?? []),
        ...(talentCandidate.secondarySkills ?? []),
      ].filter(Boolean);
    }

    const allJobs = await this.searchJobsWithSkills({
      status: 'open',
      ...(filters?.engagementType && { engagementType: filters.engagementType }),
      ...(filters?.category && { category: filters.category }),
      ...(filters?.experienceLevel && { experienceLevel: filters.experienceLevel }),
      ...(filters?.minRate && { minBudget: filters.minRate }),
      ...(filters?.maxRate && { maxBudget: filters.maxRate }),
    });

    const jobMatches: Array<{
      job: Job & { skills: string[] };
      score: number;
      overlapSkills: string[];
      matchReasons: Record<string, any>;
      factors: { skillOverlapCount: number; engagementMatch: boolean; rateMatch: boolean };
    }> = [];

    for (const job of allJobs) {
      const result = this.scoreJobForCandidate(talentSkills, talentProfile, talentCandidate, job);
      if (result.overlapSkills.length > 0 || talentSkills.length === 0) {
        jobMatches.push({
          ...result,
          factors: {
            skillOverlapCount: result.overlapSkills.length,
            engagementMatch: !!(result.matchReasons as any).engagementMatch,
            rateMatch:        !!(result.matchReasons as any).rateMatch,
          },
        });
      }
    }

    jobMatches.sort((a, b) => b.score - a.score);

    // Persist all scored matches (upsert) — await so callers can immediately query
    // the job_matches table after calculateJobMatches returns.
    if (talentCandidate?.id) {
      try {
        await this.persistMatchResults(talentCandidate.id, jobMatches.map(m => ({
          jobId: m.job.id, score: m.score, matchReasons: m.matchReasons,
        })));
      } catch (err) {
        console.error('❌ persistMatchResults failed:', err);
      }
    }

    // Pad to at least 3 with Jaccard fallback (lower score bracket)
    if (jobMatches.length < 3) {
      const existingIds = new Set(jobMatches.map(m => m.job.id));
      const fallbacks = allJobs
        .filter(j => !existingIds.has(j.id))
        .map(job => {
          const skillsUnion = Array.from(new Set([...talentSkills, ...job.skills]));
          const overlap = job.skills.filter(js =>
            talentSkills.some(ts =>
              ts.toLowerCase().includes(js.toLowerCase()) ||
              js.toLowerCase().includes(ts.toLowerCase())
            )
          );
          const jacc = skillsUnion.length > 0 ? overlap.length / skillsUnion.length : 0;
          return {
            job, score: Math.round(jacc * 50), overlapSkills: overlap,
            matchReasons: { skillOverlap: overlap, engagementMatch: false, rateMatch: false, rateRatio: null, timezoneMatch: 'none', categoryMatch: false, experienceMatch: false, factors: [] },
            factors: { skillOverlapCount: 0, engagementMatch: false, rateMatch: false },
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3 - jobMatches.length);
      jobMatches.push(...fallbacks);
    }

    return jobMatches.slice(0, 3);
  }

  // ── Persistence & retrieval for job_matches table ─────────────────────────
  // NOTIFICATION THRESHOLD: raw score ≥ 70 (see ADR: requires strong skill
  // signal OR medium skills + at least one preference factor aligned).
  private readonly MATCH_NOTIFY_THRESHOLD = 70;

  private async persistMatchResults(
    candidateId: string,
    results: Array<{ jobId: string; score: number; matchReasons: Record<string, any> }>,
  ): Promise<void> {
    if (results.length === 0) return;

    // Read previous scores to detect newly-qualifying matches for notifications
    const prevRes = await dbQuery(
      `SELECT job_id, compatibility_score, notified_at FROM job_matches WHERE talent_id = $1`,
      [candidateId],
    );
    const prevMap = new Map<string, { score: number; notifiedAt: Date | null }>(
      prevRes.rows.map((r: any) => [r.job_id as string, {
        score: Number(r.compatibility_score),
        notifiedAt: r.notified_at ?? null,
      }]),
    );

    // Upsert all results
    for (const r of results) {
      await dbQuery(`
        INSERT INTO job_matches (talent_id, job_id, compatibility_score, match_reasons, computed_at)
        VALUES ($1, $2, $3, $4::jsonb, NOW())
        ON CONFLICT (talent_id, job_id) DO UPDATE SET
          compatibility_score = EXCLUDED.compatibility_score,
          match_reasons       = EXCLUDED.match_reasons,
          computed_at         = NOW()
      `, [candidateId, r.jobId, r.score, JSON.stringify(r.matchReasons)]);
    }

    // In-app notifications for new high-score matches
    const candRow = await dbQuery(`SELECT email FROM candidates WHERE id = $1`, [candidateId]);
    const candEmail = candRow.rows[0]?.email as string | undefined;
    if (!candEmail) return;

    const userRow = await dbQuery(
      `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`, [candEmail],
    );
    const linkedUserId = userRow.rows[0]?.id as string | undefined;
    if (!linkedUserId) return;

    for (const r of results) {
      if (r.score < this.MATCH_NOTIFY_THRESHOLD) continue;
      const prev = prevMap.get(r.jobId);
      if (prev?.notifiedAt != null || (prev && prev.score >= this.MATCH_NOTIFY_THRESHOLD)) continue;

      const jobRow = await dbQuery(`SELECT title FROM jobs WHERE id = $1`, [r.jobId]);
      const jobTitle = jobRow.rows[0]?.title ?? 'A new role';
      const displayScore = Math.min(100, r.score);
      try {
        await this.createNotification({
          userId: linkedUserId,
          type: 'job_match',
          title: 'New job match!',
          message: `${jobTitle} is a ${displayScore}% match for you based on your skills and preferences.`,
          relatedId: r.jobId,
          relatedType: 'job',
        });
        await dbQuery(
          `UPDATE job_matches SET notified_at = NOW() WHERE talent_id = $1 AND job_id = $2`,
          [candidateId, r.jobId],
        );
        console.log(`🔔 Match notification sent: candidate=${candidateId} job=${r.jobId} score=${r.score}`);
      } catch (err) {
        console.error('❌ Match notification failed:', err);
      }
    }
  }

  async getJobMatchesForTalent(candidateId: string): Promise<Array<{
    job: Job & { skills: string[] };
    score: number;
    matchReasons: Record<string, any>;
    computedAt: Date;
  }>> {
    const result = await dbQuery(`
      SELECT
        jm.compatibility_score         AS score,
        jm.match_reasons               AS "matchReasons",
        jm.computed_at                 AS "computedAt",
        j.id, j.title, j.company, j.location, j.description,
        j.budget, j.budget_currency    AS "budgetCurrency",
        j.engagement_type              AS "engagementType",
        j.category, j.experience_level AS "experienceLevel",
        j.status, j.created_at         AS "createdAt",
        j.time_zone                    AS "timeZone",
        j.skill_tags                   AS "skillTags"
      FROM job_matches jm
      JOIN jobs j ON j.id = jm.job_id
      WHERE jm.talent_id = $1
        AND j.status = 'open'
        AND j.created_via != 'search_scaffold'
      ORDER BY jm.compatibility_score DESC
      LIMIT 20
    `, [candidateId]);

    return result.rows.map((row: any) => ({
      job: {
        id: row.id, title: row.title, company: row.company ?? null,
        location: row.location ?? null, description: row.description ?? null,
        budget: row.budget ?? null, budgetCurrency: row.budgetCurrency ?? null,
        engagementType: row.engagementType ?? null, category: row.category ?? null,
        experienceLevel: row.experienceLevel ?? null, status: row.status,
        createdAt: row.createdAt, timeZone: row.timeZone ?? null,
        skills: Array.isArray(row.skillTags) ? row.skillTags : [],
      } as Job & { skills: string[] },
      score: Number(row.score),
      matchReasons: row.matchReasons ?? {},
      computedAt: row.computedAt,
    }));
  }

  // Trigger A: call after talent updates profile or preferences.
  async recomputeMatchesForTalent(candidateId: string): Promise<void> {
    const candRow = await dbQuery(
      `SELECT user_id FROM candidates WHERE id = $1`, [candidateId],
    );
    const userId = candRow.rows[0]?.user_id as string | undefined;
    if (!userId) {
      console.log(`⚠️ recomputeMatchesForTalent: no user_id for candidate ${candidateId}`);
      return;
    }
    await this.calculateJobMatches(userId);
  }

  // Trigger B: call after a new job is published (fan-out: 1 job × N candidates).
  // At current scale (16 candidates) this is fast; queue it when candidates > 1,000.
  async recomputeMatchesForJob(jobId: string): Promise<void> {
    const allOpenJobs = await this.searchJobsWithSkills({ status: 'open' });
    const job = allOpenJobs.find(j => j.id === jobId);
    if (!job) {
      console.log(`⚠️ recomputeMatchesForJob: job ${jobId} not open or not found`);
      return;
    }

    const candidatesRes = await dbQuery(
      `SELECT id, user_id FROM candidates WHERE user_id IS NOT NULL`,
    );

    for (const row of candidatesRes.rows as Array<{ id: string; user_id: string }>) {
      try {
        const [userSkills, profile, candidate] = await Promise.all([
          this.getUserSkillsWithNames(row.user_id),
          this.getProfileByUserId(row.user_id),
          this.getCandidateByUserId(row.user_id),
        ]);
        const talentSkills = (userSkills as any[]).map(us => us.skill?.name || '').filter(Boolean);
        const { score, matchReasons } = this.scoreJobForCandidate(talentSkills, profile, candidate, job);
        if (score > 0 || talentSkills.length === 0) {
          await this.persistMatchResults(row.id, [{ jobId: job.id, score, matchReasons }]);
        }
      } catch (err) {
        console.error(`❌ recomputeMatchesForJob failed for candidate ${row.id}:`, err);
      }
    }
    console.log(`✅ recomputeMatchesForJob complete: job=${jobId} candidates=${candidatesRes.rows.length}`);
  }

  /**
   * Reverse-match: given a job (including draft/scaffold jobs), rank all talent
   * by how well they fit the role. Used by the client Search-to-Shortlist feature.
   * Includes the same coreSkills/secondarySkills fallback as calculateJobMatches
   * for parity with talent-facing match scores.
   */
  async rankTalentForJob(jobId: string, limit = 50): Promise<Array<{
    candidateId: string;
    userId: string;
    score: number;
    overlapSkills: string[];
    matchReasons: Record<string, any>;
    candidate: Record<string, any>;
  }>> {
    // Works with any job status (including 'draft' scaffold jobs)
    const job = await this.getJobWithSkills(jobId);
    if (!job) {
      console.warn(`⚠️  rankTalentForJob: job ${jobId} not found`);
      return [];
    }

    const candidatesRes = await dbQuery(
      `SELECT id, user_id FROM candidates WHERE user_id IS NOT NULL`,
    );

    const results: Array<{
      candidateId: string;
      userId: string;
      score: number;
      overlapSkills: string[];
      matchReasons: Record<string, any>;
      candidate: Record<string, any>;
    }> = [];

    for (const row of candidatesRes.rows as Array<{ id: string; user_id: string }>) {
      try {
        const [userSkills, profile, candidate] = await Promise.all([
          this.getUserSkillsWithNames(row.user_id),
          this.getProfileByUserId(row.user_id),
          this.getCandidateByUserId(row.user_id),
        ]);
        // Parity fix: fall back to candidate.coreSkills/secondarySkills when user_skills is empty
        let talentSkills = (userSkills as any[]).map(us => us.skill?.name || '').filter(Boolean);
        if (talentSkills.length === 0 && candidate) {
          talentSkills = [
            ...((candidate.coreSkills as string[]) ?? []),
            ...((candidate.secondarySkills as string[]) ?? []),
          ].filter(Boolean);
        }
        const { score, overlapSkills, matchReasons } = this.scoreJobForCandidate(talentSkills, profile, candidate, job);
        results.push({
          candidateId: row.id,
          userId: row.user_id,
          score,
          overlapSkills,
          matchReasons,
          candidate: (candidate ?? {}) as Record<string, any>,
        });
      } catch (err) {
        console.error(`❌ rankTalentForJob failed for candidate ${row.id}:`, err);
      }
    }

    console.log(`✅ rankTalentForJob: job=${jobId} scored ${results.length} candidates`);
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Score all candidates against search parameters without persisting any DB row.
   * Used by the public anonymous search endpoint — no writes, no auth required.
   */
  async rankTalentByParams(
    params: { title: string; category: string; engagementType: string },
    limit = 30,
  ): Promise<Array<{
    candidateId: string;
    userId: string;
    score: number;
    overlapSkills: string[];
    matchReasons: Record<string, any>;
    candidate: Record<string, any>;
  }>> {
    // Derive skill keywords from title — same stop-word extraction used by the route.
    const STOP_WORDS = new Set([
      'a','an','the','and','or','of','in','for','with','to','on','at','is','are',
      'be','as','by','i','we','you','they','it','this','that','looking','need',
      'experience','who','has','have','their','our','your','role','position','job',
      'senior','junior','mid','level','developer','engineer','manager','specialist',
      'consultant','lead','team','strong','good','great','excellent','proficient',
    ]);
    const skillTags = Array.from(new Set(
      params.title
        .split(/[\s,/+|&()\-]+/)
        .map((t) => t.replace(/[^a-zA-Z0-9#+.]/g, '').trim())
        .filter((t) => t.length >= 2 && !STOP_WORDS.has(t.toLowerCase()))
        .slice(0, 10),
    ));

    // Virtual job object — same shape expected by scoreJobForCandidate.
    // No id, no DB row: scoring is pure in-memory.
    const virtualJob: any = {
      id: `virtual-${Date.now()}`,
      title: params.title,
      category: params.category,
      engagementType: params.engagementType,
      experienceLevel: 'Mid-level',
      skills: skillTags,
      budget: null,
      budgetCurrency: 'PHP',
      timeZone: null,
      createdAt: new Date(),
      status: 'draft',
    };

    const candidatesRes = await dbQuery(
      `SELECT id, user_id FROM candidates WHERE user_id IS NOT NULL`,
    );

    const results: Array<{
      candidateId: string;
      userId: string;
      score: number;
      overlapSkills: string[];
      matchReasons: Record<string, any>;
      candidate: Record<string, any>;
    }> = [];

    for (const row of candidatesRes.rows as Array<{ id: string; user_id: string }>) {
      try {
        const [userSkills, profile, candidate] = await Promise.all([
          this.getUserSkillsWithNames(row.user_id),
          this.getProfileByUserId(row.user_id),
          this.getCandidateByUserId(row.user_id),
        ]);
        let talentSkills = (userSkills as any[]).map((us) => us.skill?.name || '').filter(Boolean);
        if (talentSkills.length === 0 && candidate) {
          talentSkills = [
            ...((candidate.coreSkills as string[]) ?? []),
            ...((candidate.secondarySkills as string[]) ?? []),
          ].filter(Boolean);
        }
        const { score, overlapSkills, matchReasons } = this.scoreJobForCandidate(
          talentSkills, profile, candidate, virtualJob,
        );
        results.push({
          candidateId: row.id,
          userId: row.user_id,
          score,
          overlapSkills,
          matchReasons,
          candidate: (candidate ?? {}) as Record<string, any>,
        });
      } catch (err) {
        console.error(`❌ rankTalentByParams failed for candidate ${row.id}:`, err);
      }
    }

    console.log(`✅ rankTalentByParams: scored ${results.length} candidates for "${params.title}"`);
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // Proposal Methods
  async getProposal(id: string): Promise<Proposal | undefined> {
    return this.proposals.get(id);
  }

  async createProposal(insertProposal: InsertProposal): Promise<Proposal> {
    const id = randomUUID();
    const now = new Date();
    const proposal: Proposal = {
      ...insertProposal,
      id,
      proposedRate: insertProposal.proposedRate ?? null,
      proposedBudget: insertProposal.proposedBudget ?? null,
      estimatedDuration: insertProposal.estimatedDuration ?? null,
      clientResponse: insertProposal.clientResponse ?? null,
      status: insertProposal.status ?? "submitted",
      createdAt: now,
      updatedAt: now
    };
    this.proposals.set(id, proposal);

    // Increment proposal count on job
    const job = this.jobs.get(insertProposal.jobId);
    if (job) {
      job.proposalCount = (job.proposalCount || 0) + 1;
      this.jobs.set(job.id, job);
    }

    return proposal;
  }

  async updateProposal(id: string, updates: Partial<InsertProposal>): Promise<Proposal | undefined> {
    const proposal = this.proposals.get(id);
    if (!proposal) return undefined;

    const updatedProposal: Proposal = {
      ...proposal,
      ...updates,
      updatedAt: new Date()
    };
    this.proposals.set(id, updatedProposal);
    return updatedProposal;
  }

  async listProposalsByJob(jobId: string): Promise<Proposal[]> {
    return Array.from(this.proposals.values())
      .filter(proposal => proposal.jobId === jobId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async listProposalsByTalent(talentId: string): Promise<Proposal[]> {
    return Array.from(this.proposals.values())
      .filter(proposal => proposal.talentId === talentId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  // Contract Methods
  async getContract(id: string): Promise<Contract | undefined> {
    return this.contracts.get(id);
  }

  async createContract(insertContract: InsertContract): Promise<Contract> {
    const id = randomUUID();
    const now = new Date();
    const contract: Contract = {
      ...insertContract,
      id,
      description: insertContract.description ?? null,
      rate: insertContract.rate ?? null,
      totalBudget: insertContract.totalBudget ?? null,
      startDate: insertContract.startDate ?? null,
      endDate: insertContract.endDate ?? null,
      terms: insertContract.terms ?? null,
      status: insertContract.status ?? "active",
      createdAt: now,
      updatedAt: now
    };
    this.contracts.set(id, contract);
    return contract;
  }

  async updateContract(id: string, updates: Partial<InsertContract>): Promise<Contract | undefined> {
    const contract = this.contracts.get(id);
    if (!contract) return undefined;

    const updatedContract: Contract = {
      ...contract,
      ...updates,
      updatedAt: new Date()
    };
    this.contracts.set(id, updatedContract);
    return updatedContract;
  }

  async listContractsByClient(clientId: string): Promise<Contract[]> {
    return Array.from(this.contracts.values())
      .filter(contract => contract.clientId === clientId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async listContractsByTalent(talentId: string): Promise<Contract[]> {
    return Array.from(this.contracts.values())
      .filter(contract => contract.talentId === talentId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  // Milestone Methods
  async getMilestone(id: string): Promise<Milestone | undefined> {
    return this.milestones.get(id);
  }

  async createMilestone(insertMilestone: InsertMilestone): Promise<Milestone> {
    const id = randomUUID();
    const now = new Date();
    const milestone: Milestone = {
      ...insertMilestone,
      id,
      description: insertMilestone.description ?? null,
      dueDate: insertMilestone.dueDate ?? null,
      submissionNote: insertMilestone.submissionNote ?? null,
      approvalNote: insertMilestone.approvalNote ?? null,
      status: insertMilestone.status ?? "pending",
      createdAt: now,
      updatedAt: now
    };
    this.milestones.set(id, milestone);
    return milestone;
  }

  async updateMilestone(id: string, updates: Partial<InsertMilestone>): Promise<Milestone | undefined> {
    const milestone = this.milestones.get(id);
    if (!milestone) return undefined;

    const updatedMilestone: Milestone = {
      ...milestone,
      ...updates,
      updatedAt: new Date()
    };
    this.milestones.set(id, updatedMilestone);
    return updatedMilestone;
  }

  async listMilestonesByContract(contractId: string): Promise<Milestone[]> {
    return Array.from(this.milestones.values())
      .filter(milestone => milestone.contractId === contractId)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  // Time Entry Methods
  async getTimeEntry(id: string): Promise<TimeEntry | undefined> {
    return this.timeEntries.get(id);
  }

  async createTimeEntry(insertTimeEntry: InsertTimeEntry): Promise<TimeEntry> {
    const id = randomUUID();
    const timeEntry: TimeEntry = {
      ...insertTimeEntry,
      id,
      description: insertTimeEntry.description ?? null,
      endTime: insertTimeEntry.endTime ?? null,
      duration: insertTimeEntry.duration ?? null,
      amount: insertTimeEntry.amount ?? null,
      status: insertTimeEntry.status ?? "logged",
      createdAt: new Date()
    };
    this.timeEntries.set(id, timeEntry);
    return timeEntry;
  }

  async updateTimeEntry(id: string, updates: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const timeEntry = this.timeEntries.get(id);
    if (!timeEntry) return undefined;

    const updatedTimeEntry: TimeEntry = {
      ...timeEntry,
      ...updates
    };
    this.timeEntries.set(id, updatedTimeEntry);
    return updatedTimeEntry;
  }

  async listTimeEntriesByContract(contractId: string): Promise<TimeEntry[]> {
    return Array.from(this.timeEntries.values())
      .filter(entry => entry.contractId === contractId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  async listTimeEntriesByTalent(talentId: string, startDate?: Date, endDate?: Date): Promise<TimeEntry[]> {
    let entries = Array.from(this.timeEntries.values())
      .filter(entry => entry.talentId === talentId);

    if (startDate) {
      entries = entries.filter(entry => entry.startTime >= startDate);
    }

    if (endDate) {
      entries = entries.filter(entry => entry.startTime <= endDate);
    }

    return entries.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  // Message Methods
  async getMessageThread(id: string): Promise<MessageThread | undefined> {
    return this.messageThreads.get(id);
  }

  async createMessageThread(insertThread: InsertMessageThread): Promise<MessageThread> {
    const id = randomUUID();
    const now = new Date();
    const thread: MessageThread = {
      ...insertThread,
      id,
      jobId: insertThread.jobId ?? null,
      contractId: insertThread.contractId ?? null,
      subject: insertThread.subject ?? null,
      lastMessageAt: now,
      createdAt: now
    };
    this.messageThreads.set(id, thread);
    return thread;
  }

  async listMessageThreadsByUser(userId: string): Promise<MessageThread[]> {
    return Array.from(this.messageThreads.values())
      .filter(thread => thread.participants.includes(userId))
      .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0));
  }

  async listMessageThreadsByUserWithUnread(userId: string): Promise<Array<MessageThread & {
    unreadCount: number;
    latestMessageAt: Date | null;
  }>> {
    return (await this.listMessageThreadsByUser(userId)).map((thread) => {
      const threadMessages = Array.from(this.messages.values())
        .filter((message) => message.threadId === thread.id);
      return {
        ...thread,
        unreadCount: threadMessages.filter((message) =>
          message.senderId !== userId && !(message.readBy ?? []).includes(userId),
        ).length,
        latestMessageAt: threadMessages.reduce<Date | null>(
          (latest, message) =>
            !latest || (message.createdAt && message.createdAt > latest)
              ? message.createdAt
              : latest,
          thread.lastMessageAt,
        ),
      };
    });
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      attachments: insertMessage.attachments ?? null,
      messageType: insertMessage.messageType ?? "text",
      readBy: [],
      flaggedForReview: false,
      createdAt: new Date()
    };
    this.messages.set(id, message);

    // Update thread last message time
    const thread = this.messageThreads.get(insertMessage.threadId);
    if (thread) {
      thread.lastMessageAt = message.createdAt;
      this.messageThreads.set(thread.id, thread);
    }

    return message;
  }

  async listMessagesByThread(threadId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.threadId === threadId)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  async markMessagesAsRead(threadId: string, userId: string): Promise<void> {
    const messages = Array.from(this.messages.values())
      .filter(message => message.threadId === threadId);

    for (const message of messages) {
      if (message.senderId !== userId && message.readBy && !message.readBy.includes(userId)) {
        message.readBy.push(userId);
        this.messages.set(message.id, message);
      }
    }
  }

  async flagMessageForReview(messageId: string): Promise<void> {
    const msg = this.messages.get(messageId);
    if (msg) this.messages.set(messageId, { ...msg, flaggedForReview: true });
  }

  async listFlaggedMessages(): Promise<Array<Message & { thread: MessageThread | null }>> {
    return Array.from(this.messages.values())
      .filter((m) => m.flaggedForReview)
      .map((m) => ({ ...m, thread: this.messageThreads.get(m.threadId) ?? null }));
  }

  async clearMessageFlag(messageId: string): Promise<void> {
    const msg = this.messages.get(messageId);
    if (msg) this.messages.set(messageId, { ...msg, flaggedForReview: false });
  }

  // Review Methods
  async getReview(id: string): Promise<Review | undefined> {
    return this.reviews.get(id);
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const id = randomUUID();
    const review: Review = {
      ...insertReview,
      id,
      title: insertReview.title ?? null,
      comment: insertReview.comment ?? null,
      skills: insertReview.skills ?? null,
      response: insertReview.response ?? null,
      isPublic: insertReview.isPublic ?? true,
      createdAt: new Date()
    };
    this.reviews.set(id, review);
    return review;
  }

  async listReviewsByUser(userId: string, asReviewer?: boolean): Promise<Review[]> {
    const field = asReviewer ? 'reviewerId' : 'revieweeId';
    return Array.from(this.reviews.values())
      .filter(review => review[field] === userId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async listReviewsByContract(contractId: string): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter(review => review.contractId === contractId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  // Portfolio Methods
  async getPortfolioItem(id: string): Promise<PortfolioItem | undefined> {
    return this.portfolioItems.get(id);
  }

  async createPortfolioItem(insertItem: InsertPortfolioItem): Promise<PortfolioItem> {
    const id = randomUUID();
    const item: PortfolioItem = {
      ...insertItem,
      id,
      description: insertItem.description ?? null,
      projectUrl: insertItem.projectUrl ?? null,
      imageUrls: insertItem.imageUrls ?? null,
      skills: insertItem.skills ?? null,
      completionDate: insertItem.completionDate ?? null,
      isPublic: insertItem.isPublic ?? true,
      createdAt: new Date()
    };
    this.portfolioItems.set(id, item);
    return item;
  }

  async updatePortfolioItem(id: string, updates: Partial<InsertPortfolioItem>): Promise<PortfolioItem | undefined> {
    const item = this.portfolioItems.get(id);
    if (!item) return undefined;

    const updatedItem: PortfolioItem = {
      ...item,
      ...updates
    };
    this.portfolioItems.set(id, updatedItem);
    return updatedItem;
  }

  async listPortfolioItemsByTalent(talentId: string): Promise<PortfolioItem[]> {
    return Array.from(this.portfolioItems.values())
      .filter(item => item.talentId === talentId && item.isPublic)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async deletePortfolioItem(id: string): Promise<boolean> {
    return this.portfolioItems.delete(id);
  }

  // Certification Methods
  async getCertification(id: string): Promise<Certification | undefined> {
    return this.certifications.get(id);
  }

  async createCertification(insertCert: InsertCertification): Promise<Certification> {
    const id = randomUUID();
    const cert: Certification = {
      ...insertCert,
      id,
      credentialId: insertCert.credentialId ?? null,
      credentialUrl: insertCert.credentialUrl ?? null,
      issueDate: insertCert.issueDate ?? null,
      expiryDate: insertCert.expiryDate ?? null,
      skills: insertCert.skills ?? null,
      verified: false,
      createdAt: new Date()
    };
    this.certifications.set(id, cert);
    return cert;
  }

  async listCertificationsByTalent(talentId: string): Promise<Certification[]> {
    return Array.from(this.certifications.values())
      .filter(cert => cert.talentId === talentId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async updateCertification(id: string, updates: Partial<InsertCertification>): Promise<Certification | undefined> {
    const existing = this.certifications.get(id);
    if (!existing) return undefined;
    const updated: Certification = { ...existing, ...updates };
    this.certifications.set(id, updated);
    return updated;
  }

  async deleteCertification(id: string): Promise<boolean> {
    return this.certifications.delete(id);
  }

  // Payment Methods
  async getPayment(id: string): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const payment: Payment = {
      ...insertPayment,
      id,
      contractId: insertPayment.contractId ?? null,
      milestoneId: insertPayment.milestoneId ?? null,
      paymentMethod: insertPayment.paymentMethod ?? null,
      stripePaymentIntentId: insertPayment.stripePaymentIntentId ?? null,
      description: insertPayment.description ?? null,
      fees: "0",
      currency: insertPayment.currency ?? "USD",
      status: insertPayment.status ?? "pending",
      createdAt: new Date(),
      completedAt: null
    };
    this.payments.set(id, payment);
    return payment;
  }

  async updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment | undefined> {
    const payment = this.payments.get(id);
    if (!payment) return undefined;

    const updatedPayment: Payment = {
      ...payment,
      ...updates
    };
    this.payments.set(id, updatedPayment);
    return updatedPayment;
  }

  async listPaymentsByUser(userId: string, asPayer?: boolean): Promise<Payment[]> {
    const field = asPayer ? 'payerId' : 'payeeId';
    return Array.from(this.payments.values())
      .filter(payment => payment[field] === userId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  // Dispute Methods
  async getDispute(id: string): Promise<Dispute | undefined> {
    return this.disputes.get(id);
  }

  async createDispute(insertDispute: InsertDispute): Promise<Dispute> {
    const id = randomUUID();
    const dispute: Dispute = {
      ...insertDispute,
      id,
      evidence: insertDispute.evidence ?? null,
      resolution: insertDispute.resolution ?? null,
      resolvedBy: insertDispute.resolvedBy ?? null,
      status: insertDispute.status ?? "open",
      createdAt: new Date(),
      resolvedAt: null
    };
    this.disputes.set(id, dispute);
    return dispute;
  }

  async updateDispute(id: string, updates: Partial<InsertDispute>): Promise<Dispute | undefined> {
    const dispute = this.disputes.get(id);
    if (!dispute) return undefined;

    const updatedDispute: Dispute = {
      ...dispute,
      ...updates
    };
    this.disputes.set(id, updatedDispute);
    return updatedDispute;
  }

  async listDisputesByUser(userId: string): Promise<Dispute[]> {
    return Array.from(this.disputes.values())
      .filter(dispute => dispute.raisedById === userId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async listOpenDisputes(): Promise<Dispute[]> {
    return Array.from(this.disputes.values())
      .filter(dispute => dispute.status === "open")
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  // Notification Methods
  async getNotification(id: string): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = {
      ...insertNotification,
      id,
      relatedId: insertNotification.relatedId ?? null,
      relatedType: insertNotification.relatedType ?? null,
      eventKey: insertNotification.eventKey ?? null,
      messageCount: 1,
      isRead: false,
      createdAt: new Date()
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async upsertMessageNotification(input: MessageNotificationInput): Promise<Notification | undefined> {
    if (input.messageId) {
      const message = this.messages.get(input.messageId);
      if (message?.readBy?.includes(input.recipientId)) return undefined;
    }

    const existing = Array.from(this.notifications.values())
      .filter((notification) =>
        notification.userId === input.recipientId &&
        notification.type === "new_message" &&
        notification.relatedId === input.threadId &&
        !notification.isRead,
      )
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];
    const messageCount = (existing?.messageCount ?? 0) + 1;
    const copy = messageNotificationCopy(input.senderName, messageCount);
    if (existing) {
      existing.messageCount = messageCount;
      existing.title = copy.title;
      existing.message = copy.message;
      existing.createdAt = new Date();
      this.notifications.set(existing.id, existing);
      return existing;
    }
    return this.createNotification({
      userId: input.recipientId,
      type: "new_message",
      title: copy.title,
      message: copy.message,
      relatedId: input.threadId,
      relatedType: "message_thread",
    });
  }

  async consolidateUnreadMessageNotifications(): Promise<number> {
    const groups = new Map<string, Notification[]>();
    for (const notification of Array.from(this.notifications.values())) {
      if (
        notification.type !== "new_message" ||
        notification.isRead ||
        !notification.relatedId
      ) {
        continue;
      }

      const key = `${notification.userId}\u0000${notification.relatedId}`;
      const group = groups.get(key) ?? [];
      group.push(notification);
      groups.set(key, group);
    }

    let removed = 0;
    for (const group of Array.from(groups.values())) {
      group.sort((a: Notification, b: Notification) =>
        (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
      const keeper = group[0];
      const messageCount = group.reduce(
        (total: number, notification: Notification) =>
          total + messageNotificationCount(notification),
        0,
      );
      const copy = messageNotificationCopy(
        messageNotificationSenderName(keeper),
        messageCount,
      );

      keeper.title = copy.title;
      keeper.message = copy.message;
      keeper.messageCount = messageCount;
      keeper.relatedType = "message_thread";
      this.notifications.set(keeper.id, keeper);

      for (const duplicate of group.slice(1)) {
        this.notifications.delete(duplicate.id);
        removed += 1;
      }
    }

    return removed;
  }

  async listNotificationsByUser(userId: string, unreadOnly?: boolean): Promise<Notification[]> {
    let notifications = Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId);

    if (unreadOnly) {
      notifications = notifications.filter(n => !n.isRead);
    }

    return notifications.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const notification = this.notifications.get(id);
    if (!notification) return false;

    notification.isRead = true;
    this.notifications.set(id, notification);
    return true;
  }

  async markMessageNotificationsAsRead(userId: string, threadId: string): Promise<void> {
    for (const notification of Array.from(this.notifications.values())) {
      if (
        notification.userId === userId &&
        notification.type === "new_message" &&
        notification.relatedId === threadId &&
        !notification.isRead
      ) {
        notification.isRead = true;
        this.notifications.set(notification.id, notification);
      }
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const userNotifications = Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId);

    for (const notification of userNotifications) {
      notification.isRead = true;
      this.notifications.set(notification.id, notification);
    }
  }

  // LinkedIn Profile Methods
  async getLinkedinProfile(id: string): Promise<any | undefined> {
    return this.linkedinProfiles.get(id);
  }

  async getLinkedinProfileByUserId(userId: string): Promise<any | undefined> {
    for (const profile of Array.from(this.linkedinProfiles.values())) {
      if (profile.userId === userId) {
        return profile;
      }
    }
    return undefined;
  }

  async createLinkedinProfile(profile: any): Promise<any> {
    const newProfile = {
      id: randomUUID(),
      ...profile,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.linkedinProfiles.set(newProfile.id, newProfile);
    return newProfile;
  }

  async updateLinkedinProfile(id: string, updates: Partial<any>): Promise<any | undefined> {
    const profile = this.linkedinProfiles.get(id);
    if (!profile) return undefined;

    const updatedProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date()
    };
    this.linkedinProfiles.set(id, updatedProfile);
    return updatedProfile;
  }

  async deleteLinkedinProfile(id: string): Promise<boolean> {
    return this.linkedinProfiles.delete(id);
  }

  // Lead Intake Methods
  async createLeadIntake(leadIntake: InsertLeadIntake): Promise<LeadIntake> {
    const leadScore = this.calculateLeadScore(leadIntake);
    
    const newLeadIntake = {
      ...leadIntake,
      leadScore,
      status: "new" as const,
      source: leadIntake.source || "website",
    };
    
    const [result] = await db.insert(leadIntakes).values(newLeadIntake).returning();
    return result;
  }

  async getLeadIntake(id: string): Promise<LeadIntake | undefined> {
    const result = await db.select().from(leadIntakes).where(eq(leadIntakes.id, id));
    return result[0];
  }

  async updateLeadIntake(id: string, updates: Partial<InsertLeadIntake>): Promise<LeadIntake | undefined> {
    const [result] = await db
      .update(leadIntakes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leadIntakes.id, id))
      .returning();
    return result;
  }

  async searchLeadIntakes(filters: { status?: string; email?: string; createdAfter?: Date }): Promise<LeadIntake[]> {
    const conditions = [];
    
    if (filters.status) {
      conditions.push(eq(leadIntakes.status, filters.status));
    }
    if (filters.email) {
      conditions.push(eq(leadIntakes.email, filters.email));
    }
    if (filters.createdAfter) {
      conditions.push(gte(leadIntakes.createdAt, filters.createdAfter));
    }
    
    if (conditions.length === 0) {
      return await db.select().from(leadIntakes);
    }
    
    return await db.select().from(leadIntakes).where(and(...conditions));
  }

  async listLeadIntakesByStatus(status: string): Promise<LeadIntake[]> {
    return await db.select().from(leadIntakes).where(eq(leadIntakes.status, status));
  }

  private calculateLeadScore(leadIntake: InsertLeadIntake): number {
    let score = 0;

    // Decision maker status scoring
    if (leadIntake.decisionMakerStatus === "decision_maker") score += 30;
    else if (leadIntake.decisionMakerStatus === "influencer") score += 20;
    else if (leadIntake.decisionMakerStatus === "evaluator") score += 10;

    // Urgency scoring
    if (leadIntake.urgencyLevel === "immediate") score += 20;
    else if (leadIntake.urgencyLevel === "within_month") score += 15;
    else if (leadIntake.urgencyLevel === "within_quarter") score += 10;
    else if (leadIntake.urgencyLevel === "planning") score += 5;

    // Budget range scoring
    if (leadIntake.budgetRange === "50k+") score += 25;
    else if (leadIntake.budgetRange === "20k-50k") score += 20;
    else if (leadIntake.budgetRange === "5k-20k") score += 15;
    else if (leadIntake.budgetRange === "<5k") score += 10;

    // Company size scoring (larger companies typically have more resources)
    if (leadIntake.companySize === "500+") score += 15;
    else if (leadIntake.companySize === "201-500") score += 12;
    else if (leadIntake.companySize === "51-200") score += 10;
    else if (leadIntake.companySize === "11-50") score += 8;
    else if (leadIntake.companySize === "1-10") score += 5;

    // Current provider status (shows they're already outsourcing)
    if (leadIntake.hasCurrentProvider) score += 10;

    // Service type scoring (some services have higher conversion rates)
    const highValueServices = ['customer_support', 'technical_support', 'back_office'];
    if (leadIntake.serviceType && highValueServices.includes(leadIntake.serviceType)) {
      score += 8;
    }

    return Math.min(100, score); // Cap at 100
  }

  // CSV Bulk Talent Import Methods
  async bulkCreateTalents(talentData: BulkTalentData[]): Promise<CsvImportResult> {
    const results: CsvImportResult['results'] = [];
    const duplicateEmails: string[] = [];
    const skillsCreatedSet = new Set<string>();
    let usersCreated = 0;
    let profilesCreated = 0;
    let skillsLinked = 0;
    let duplicatesSkipped = 0;
    let errors = 0;

    for (let i = 0; i < talentData.length; i++) {
      const talent = talentData[i];
      try {
        // Check for duplicate email
        const existingUser = await this.getUserByEmail(talent.user.email!);
        if (existingUser) {
          duplicateEmails.push(talent.user.email!);
          duplicatesSkipped++;
          results.push({
            rowIndex: i,
            email: talent.user.email!,
            success: false,
            error: "Email already exists",
            warnings: [],
          });
          continue;
        }

        // Create user
        const newUser = await this.createUser(talent.user);
        usersCreated++;

        // Create profile
        const profileData = { ...talent.profile, userId: newUser.id };
        const newProfile = await this.createProfile(profileData);
        profilesCreated++;

        // Handle skills if provided
        if (talent.skills && talent.skills.length > 0) {
          const skillObjects = await this.ensureSkillsExist(talent.skills);
          
          // Create user skills associations
          for (const skill of skillObjects) {
            skillsCreatedSet.add(skill.name);
            await this.createUserSkill({
              userId: newUser.id,
              skillId: skill.id,
              level: "intermediate",
              yearsExperience: 0,
            });
            skillsLinked++;
          }
        }

        results.push({
          rowIndex: i,
          email: talent.user.email!,
          success: true,
          userId: newUser.id,
          profileId: newProfile.id,
          warnings: [],
        });

      } catch (error) {
        errors++;
        results.push({
          rowIndex: i,
          email: talent.user.email!,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          warnings: [],
        });
      }
    }

    return {
      success: errors === 0,
      totalRows: talentData.length,
      successfulRows: usersCreated,
      failedRows: errors,
      results,
      duplicateEmails,
      skillsCreated: Array.from(skillsCreatedSet),
      summary: {
        usersCreated,
        profilesCreated,
        skillsLinked,
        duplicatesSkipped,
        errors,
      },
    };
  }

  async validateCsvTalentRows(rows: CsvTalentRow[]): Promise<{
    validRows: BulkTalentData[];
    errors: Array<{ rowIndex: number; email: string; errors: string[]; }>;
    duplicateEmails: string[];
  }> {
    const validRows: BulkTalentData[] = [];
    const errors: Array<{ rowIndex: number; email: string; errors: string[]; }> = [];
    const duplicateEmails: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowErrors: string[] = [];

      // Check for duplicate email
      const existingUser = await this.getUserByEmail(row.email);
      if (existingUser) {
        duplicateEmails.push(row.email);
        rowErrors.push("Email already exists");
      }

      // Validate required fields
      if (!row.firstName || row.firstName.trim().length === 0) {
        rowErrors.push("First name is required");
      }
      if (!row.lastName || row.lastName.trim().length === 0) {
        rowErrors.push("Last name is required");
      }
      if (!row.title || row.title.trim().length === 0) {
        rowErrors.push("Professional title is required");
      }
      if (!row.bio || row.bio.trim().length < 10) {
        rowErrors.push("Bio must be at least 10 characters");
      }

      if (rowErrors.length > 0) {
        errors.push({ rowIndex: i, email: row.email, errors: rowErrors });
        continue;
      }

      // Create valid BulkTalentData
      const user = {
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        role: "talent",
      } as any as InsertUser;

      const profile: Omit<InsertProfile, 'userId'> = {
        firstName: row.firstName,
        lastName: row.lastName,
        title: row.title,
        bio: row.bio,
        location: row.location || "Global",
        hourlyRate: row.hourlyRate?.toString(),
        rateCurrency: row.rateCurrency || "USD",
        availability: row.availability || "available",
        phoneNumber: row.phoneNumber,
        languages: row.languages || ["English"],
        timezone: row.timezone || "UTC",
      };

      validRows.push({
        user,
        profile,
        skills: row.skills || [],
      });
    }

    return { validRows, errors, duplicateEmails };
  }

  async createTalentFromCsvRow(csvRow: CsvTalentRow, rowIndex: number): Promise<{
    success: boolean;
    userId?: string;
    profileId?: string;
    error?: string;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    try {
      // Check for duplicate email
      const existingUser = await this.getUserByEmail(csvRow.email);
      if (existingUser) {
        return {
          success: false,
          error: "Email already exists",
          warnings,
        };
      }

      // Create user
      const user = {
        email: csvRow.email,
        firstName: csvRow.firstName,
        lastName: csvRow.lastName,
        role: "talent",
      } as any as InsertUser;

      const newUser = await this.createUser(user);

      // Create profile
      const profile: InsertProfile = {
        userId: newUser.id,
        firstName: csvRow.firstName,
        lastName: csvRow.lastName,
        title: csvRow.title,
        bio: csvRow.bio,
        location: csvRow.location || "Global",
        hourlyRate: csvRow.hourlyRate?.toString(),
        rateCurrency: csvRow.rateCurrency || "USD",
        availability: csvRow.availability || "available",
        phoneNumber: csvRow.phoneNumber,
        languages: csvRow.languages || ["English"],
        timezone: csvRow.timezone || "UTC",
      };

      const newProfile = await this.createProfile(profile);

      // Handle skills if provided
      if (csvRow.skills && csvRow.skills.length > 0) {
        try {
          const skillObjects = await this.ensureSkillsExist(csvRow.skills);
          
          for (const skill of skillObjects) {
            await this.createUserSkill({
              userId: newUser.id,
              skillId: skill.id,
              level: "intermediate",
              yearsExperience: 0,
            });
          }
          
          if (skillObjects.length !== csvRow.skills.length) {
            warnings.push(`Some skills could not be processed`);
          }
        } catch (skillError) {
          warnings.push(`Error processing skills: ${skillError instanceof Error ? skillError.message : 'Unknown error'}`);
        }
      }

      return {
        success: true,
        userId: newUser.id,
        profileId: newProfile.id,
        warnings,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        warnings,
      };
    }
  }

  async ensureSkillsExist(skillNames: string[]): Promise<Skill[]> {
    const skills: Skill[] = [];

    for (const skillName of skillNames) {
      const normalizedName = skillName.trim();
      if (normalizedName.length === 0) continue;

      // Check if skill already exists
      let existingSkill = await this.getSkillByName(normalizedName);
      
      if (!existingSkill) {
        // Create new skill with default category
        const newSkill = await this.createSkill({
          name: normalizedName,
          category: "Technical", // Default category, could be improved with categorization logic
        });
        skills.push(newSkill);
      } else {
        skills.push(existingSkill);
      }
    }

    return skills;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const allUsers = Array.from(this.users.values());
    return allUsers.find(user => user.email === email);
  }

  // Document Methods
  // Vanessa AI Conversation Logs
  async createVanessaLog(log: InsertVanessaLog): Promise<VanessaLog> {
    const id = this.vanessaLogIdCounter++;
    const newLog: VanessaLog = {
      id,
      threadId: log.threadId,
      userMessage: log.userMessage,
      assistantResponse: log.assistantResponse,
      createdAt: new Date(),
    };
    this.vanessaLogs.set(id, newLog);
    return newLog;
  }

  async getVanessaLogsByThread(threadId: string): Promise<VanessaLog[]> {
    return Array.from(this.vanessaLogs.values())
      .filter((log) => log.threadId === threadId)
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
  }

  async getAllVanessaThreads(): Promise<{ threadId: string; firstMessage: string; lastMessage: string; messageCount: number; createdAt: Date; updatedAt: Date }[]> {
    const threadMap = new Map<string, VanessaLog[]>();
    
    // Group logs by thread
    for (const log of Array.from(this.vanessaLogs.values())) {
      if (!threadMap.has(log.threadId)) {
        threadMap.set(log.threadId, []);
      }
      threadMap.get(log.threadId)!.push(log);
    }

    // Convert to thread summaries
    const threads = Array.from(threadMap.entries()).map(([threadId, logs]) => {
      const sortedLogs = logs.sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
      const firstLog = sortedLogs[0];
      const lastLog = sortedLogs[sortedLogs.length - 1];
      
      return {
        threadId,
        firstMessage: firstLog.userMessage,
        lastMessage: lastLog.assistantResponse,
        messageCount: logs.length,
        createdAt: firstLog.createdAt!,
        updatedAt: lastLog.createdAt!,
      };
    });

    // Sort by most recent activity
    return threads.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async searchVanessaLogs(query: string): Promise<VanessaLog[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.vanessaLogs.values())
      .filter((log) =>
        log.userMessage.toLowerCase().includes(lowerQuery) ||
        log.assistantResponse.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async deleteVanessaThread(threadId: string): Promise<boolean> {
    const logsToDelete = Array.from(this.vanessaLogs.entries())
      .filter(([_, log]) => log.threadId === threadId)
      .map(([id, _]) => id);
    
    if (logsToDelete.length === 0) {
      return false; // Thread not found
    }
    
    // Delete all logs in this thread
    logsToDelete.forEach(id => this.vanessaLogs.delete(id));
    return true;
  }

  // Vanessa Feedbacks (in-memory implementation)
  private feedbacks: Map<number, Feedback> = new Map();

  private feedbackIdCounter: number = 1;

  async createFeedback(feedback: InsertFeedback): Promise<Feedback> {
    const id = this.feedbackIdCounter++;
    const newFeedback: Feedback = {
      id,
      threadId: feedback.threadId,
      messageId: feedback.messageId,
      userMessage: feedback.userMessage || null,
      assistantResponse: feedback.assistantResponse || null,
      rating: feedback.rating,
      comment: feedback.comment || null,
      topic: feedback.topic || null,
      createdAt: new Date(),
    };
    this.feedbacks.set(id, newFeedback);
    return newFeedback;
  }

  async getFeedbacksByTopic(topic: string): Promise<Feedback[]> {
    return Array.from(this.feedbacks.values())
      .filter((f) => f.topic === topic)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getFeedbackCountByTopic(topic: string): Promise<number> {
    return Array.from(this.feedbacks.values()).filter((f) => f.topic === topic).length;
  }

  async getAllFeedbacks(): Promise<Feedback[]> {
    return Array.from(this.feedbacks.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getFeedbackStats(): Promise<{
    totalCount: number;
    positiveCount: number;
    negativeCount: number;
    recentFeedback: Feedback[];
  }> {
    const allFeedbacks = await this.getAllFeedbacks();
    return {
      totalCount: allFeedbacks.length,
      positiveCount: allFeedbacks.filter((f) => f.rating === "up").length,
      negativeCount: allFeedbacks.filter((f) => f.rating === "down").length,
      recentFeedback: allFeedbacks.slice(0, 10),
    };
  }

  // Admin Corrections (in-memory implementation)
  private correctionsMap: Map<number, Correction> = new Map();

  private correctionIdCounter: number = 1;

  async createCorrection(correction: InsertCorrection): Promise<Correction> {
    const id = this.correctionIdCounter++;
    const newCorrection: Correction = {
      id,
      logId: correction.logId || null,
      topic: correction.topic || null,
      correctedText: correction.correctedText,
      adminId: correction.adminId,
      createdAt: new Date(),
    };
    this.correctionsMap.set(id, newCorrection);
    return newCorrection;
  }

  async getVanessaLog(logId: number): Promise<VanessaLog | undefined> {
    return this.vanessaLogs.get(logId);
  }

  async getAllCorrections(): Promise<Correction[]> {
    return Array.from(this.correctionsMap.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getCorrectionsByTopic(topic: string): Promise<Correction[]> {
    return Array.from(this.correctionsMap.values())
      .filter((c) => c.topic === topic)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  // Training Logs (in-memory implementation)
  private trainingLogsMap: Map<number, TrainingLog> = new Map();

  private trainingLogIdCounter: number = 1;

  async createTrainingLog(trainingLog: InsertTrainingLog): Promise<TrainingLog> {
    const id = this.trainingLogIdCounter++;
    const newTrainingLog: TrainingLog = {
      id,
      adminId: trainingLog.adminId,
      userMessage: trainingLog.userMessage,
      aiResponse: trainingLog.aiResponse,
      isCorrection: trainingLog.isCorrection || false,
      topic: trainingLog.topic || null,
      createdAt: new Date(),
    };
    this.trainingLogsMap.set(id, newTrainingLog);
    return newTrainingLog;
  }

  async getTrainingLogsByAdmin(adminId: string): Promise<TrainingLog[]> {
    return Array.from(this.trainingLogsMap.values())
      .filter((log) => log.adminId === adminId)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getAllTrainingLogs(): Promise<TrainingLog[]> {
    return Array.from(this.trainingLogsMap.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  // LegalOps Trial Signups (in-memory implementation)
  private legalOpsTrialsMap: Map<string, LegalOpsTrial> = new Map();

  async createLegalOpsTrial(trial: InsertLegalOpsTrial): Promise<LegalOpsTrial> {
    const id = randomUUID();
    const newTrial: LegalOpsTrial = {
      id,
      fullName: trial.fullName,
      firmName: trial.firmName,
      email: trial.email,
      phone: trial.phone || null,
      tier: trial.tier,
      fteCount: trial.fteCount || 1,
      stripePaymentIntentId: trial.stripePaymentIntentId || null,
      stripeCustomerId: trial.stripeCustomerId || null,
      status: trial.status || "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.legalOpsTrialsMap.set(id, newTrial);
    return newTrial;
  }

  async getLegalOpsTrialByEmail(email: string): Promise<LegalOpsTrial | undefined> {
    return Array.from(this.legalOpsTrialsMap.values())
      .find((trial) => trial.email === email);
  }

  async getAllLegalOpsTrials(): Promise<LegalOpsTrial[]> {
    return Array.from(this.legalOpsTrialsMap.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  // Blog Posts stubs (overridden by DbStorage)
  private postsMap: Map<string, Post> = new Map();

  async getPost(id: string): Promise<Post | undefined> {
    return this.postsMap.get(id);
  }

  async getPostBySlug(slug: string): Promise<Post | undefined> {
    return Array.from(this.postsMap.values()).find((p) => p.slug === slug);
  }

  async createPost(post: InsertPost): Promise<Post> {
    const id = randomUUID();
    const newPost: Post = {
      id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      coverImageUrl: post.coverImageUrl || null,
      category: post.category,
      author: post.author,
      isFeatured: post.isFeatured ?? false,
      showOnHomepage: post.showOnHomepage ?? false,
      homepageOrder: post.homepageOrder ?? null,
      status: post.status || "draft",
      readTime: post.readTime || null,
      publishedAt: post.publishedAt || null,
      views: 0,
      likes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.postsMap.set(id, newPost);
    return newPost;
  }

  async updatePost(id: string, updates: Partial<InsertPost>): Promise<Post | undefined> {
    const post = this.postsMap.get(id);
    if (!post) return undefined;
    const updated = { ...post, ...updates, updatedAt: new Date() };
    this.postsMap.set(id, updated);
    return updated;
  }

  async deletePost(id: string): Promise<boolean> {
    return this.postsMap.delete(id);
  }

  async listPublishedPosts(options?: { category?: string; featured?: boolean }): Promise<Post[]> {
    let posts = Array.from(this.postsMap.values()).filter((p) => p.status === "published");
    if (options?.category) {
      posts = posts.filter((p) => p.category === options.category);
    }
    if (options?.featured !== undefined) {
      posts = posts.filter((p) => p.isFeatured === options.featured);
    }
    return posts.sort((a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0));
  }

  async listAllPosts(): Promise<Post[]> {
    return Array.from(this.postsMap.values()).sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async listHomepagePosts(): Promise<Post[]> {
    return Array.from(this.postsMap.values())
      .filter((p) => p.showOnHomepage && p.status === "published")
      .sort((a, b) => (a.homepageOrder ?? 99) - (b.homepageOrder ?? 99))
      .slice(0, 3);
  }

  async incrementPostViews(id: string): Promise<number> {
    const post = this.postsMap.get(id);
    if (!post) return 0;
    const newViews = (post.views || 0) + 1;
    post.views = newViews;
    this.postsMap.set(id, post);
    return newViews;
  }

  async incrementPostLikes(id: string): Promise<number> {
    const post = this.postsMap.get(id);
    if (!post) return 0;
    const newLikes = (post.likes || 0) + 1;
    post.likes = newLikes;
    this.postsMap.set(id, post);
    return newLikes;
  }

  // Hot Searches (in-memory stubs, overridden by DbStorage)
  private hotSearchList: HotSearch[] = [];

  async trackHotSearch(term: string): Promise<HotSearch> {
    const entry: HotSearch = { id: this.hotSearchList.length + 1, term, searchedAt: new Date() };
    this.hotSearchList.push(entry);
    return entry;
  }

  async getHotSearches(range: "daily" | "weekly"): Promise<{ term: string; count: number }[]> {
    const rangeMs = range === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - rangeMs);
    const filtered = this.hotSearchList.filter(s => s.searchedAt >= cutoff);
    const counts: Record<string, number> = {};
    for (const s of filtered) {
      const key = s.term.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  async createCandidate(data: InsertCandidate): Promise<Candidate> {
    const id = randomUUID();
    const candidate: Candidate = { ...data, id, createdAt: new Date() } as Candidate;
    return candidate;
  }

  async getCandidate(_id: string): Promise<Candidate | undefined> { return undefined; }

  async getCandidateByEmail(_email: string): Promise<Candidate | undefined> { return undefined; }

  async getCandidateByUserId(_userId: string): Promise<Candidate | undefined> { return undefined; }

  async getCandidates(): Promise<Candidate[]> { return []; }

  async updateCandidate(_id: string, _updates: Partial<InsertCandidate>): Promise<Candidate | undefined> { return undefined; }

  async upsertCultureEvaluation(_candidateId: string, _data: Omit<InsertCultureEvaluation, "candidateId">): Promise<CultureEvaluation> {
    throw new Error("Not implemented in MemStorage");
  }

  async getCultureEvaluationByCandidate(_candidateId: string): Promise<CultureEvaluation | undefined> { return undefined; }

  async cleanupOrphanedScaffoldJobs(): Promise<number> { return 0; }
  async countOrphanedScaffoldJobs(): Promise<number> { return 0; }
}

// DbStorage class: Extends MemStorage but uses PostgreSQL for Vanessa logs
export class DbStorage extends MemStorage {
  /**
   * Injectable query function — defaults to the real `dbQuery` from ./db.
   * Pass a stub in tests to exercise `searchProfiles` without a live database.
   */
  readonly _queryFn: (sql: string, params: (string | number)[]) => Promise<{ rows: any[] }>;

  constructor(
    queryFn?: (sql: string, params: (string | number)[]) => Promise<{ rows: any[] }>,
  ) {
    super();
    this._queryFn = queryFn ?? dbQuery;
  }

  // Override Vanessa log methods to use database instead of memory

  async createVanessaLog(log: InsertVanessaLog): Promise<VanessaLog> {
    const [newLog] = await db.insert(vanessaLogs).values(log).returning();
    return newLog;
  }

  async getVanessaLogsByThread(threadId: string): Promise<VanessaLog[]> {
    return await db
      .select()
      .from(vanessaLogs)
      .where(eq(vanessaLogs.threadId, threadId))
      .orderBy(asc(vanessaLogs.createdAt));
  }

  async getAllVanessaThreads(): Promise<{ threadId: string; firstMessage: string; lastMessage: string; messageCount: number; createdAt: Date; updatedAt: Date }[]> {
    // Use window functions to get thread summaries with first/last messages in a single query
    // This avoids N+1 query problem by using DISTINCT ON in PostgreSQL
    const results = await db.execute<{
      thread_id: string;
      first_message: string;
      last_message: string;
      message_count: string;
      created_at: Date;
      updated_at: Date;
    }>(sqlOp`
      WITH thread_stats AS (
        SELECT 
          thread_id,
          COUNT(*) as message_count,
          MIN(created_at) as created_at,
          MAX(created_at) as updated_at
        FROM vanessa_logs
        GROUP BY thread_id
      ),
      first_messages AS (
        SELECT DISTINCT ON (thread_id)
          thread_id,
          user_message as first_message
        FROM vanessa_logs
        ORDER BY thread_id, created_at ASC
      ),
      last_messages AS (
        SELECT DISTINCT ON (thread_id)
          thread_id,
          assistant_response as last_message
        FROM vanessa_logs
        ORDER BY thread_id, created_at DESC
      )
      SELECT 
        ts.thread_id,
        fm.first_message,
        lm.last_message,
        ts.message_count,
        ts.created_at,
        ts.updated_at
      FROM thread_stats ts
      JOIN first_messages fm ON ts.thread_id = fm.thread_id
      JOIN last_messages lm ON ts.thread_id = lm.thread_id
      ORDER BY ts.updated_at DESC
      LIMIT 500
    `);

    return results.rows.map(row => ({
      threadId: row.thread_id,
      firstMessage: row.first_message,
      lastMessage: row.last_message,
      messageCount: parseInt(row.message_count),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async searchVanessaLogs(query: string): Promise<VanessaLog[]> {
    return await db
      .select()
      .from(vanessaLogs)
      .where(
        sqlOp`${vanessaLogs.userMessage} ILIKE ${'%' + query + '%'} OR ${vanessaLogs.assistantResponse} ILIKE ${'%' + query + '%'}`
      )
      .orderBy(desc(vanessaLogs.createdAt))
      .limit(100); // Limit to 100 most recent matching results
  }

  async deleteVanessaThread(threadId: string): Promise<boolean> {
    const result = await db
      .delete(vanessaLogs)
      .where(eq(vanessaLogs.threadId, threadId))
      .returning({ id: vanessaLogs.id });
    
    return result.length > 0; // Returns true if any logs were deleted
  }

  // Override Feedback methods to use PostgreSQL database
  async createFeedback(feedback: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db.insert(feedbacks).values(feedback).returning();
    return newFeedback;
  }

  async getFeedbacksByTopic(topic: string): Promise<Feedback[]> {
    return await db
      .select()
      .from(feedbacks)
      .where(eq(feedbacks.topic, topic))
      .orderBy(desc(feedbacks.createdAt));
  }

  async getFeedbackCountByTopic(topic: string): Promise<number> {
    const result = await db
      .select({ count: sqlOp<number>`count(*)::int` })
      .from(feedbacks)
      .where(eq(feedbacks.topic, topic));
    return result[0]?.count || 0;
  }

  async getAllFeedbacks(): Promise<Feedback[]> {
    return await db
      .select()
      .from(feedbacks)
      .orderBy(desc(feedbacks.createdAt))
      .limit(1000);
  }

  async getFeedbackStats(): Promise<{
    totalCount: number;
    positiveCount: number;
    negativeCount: number;
    recentFeedback: Feedback[];
  }> {
    const allFeedbacks = await this.getAllFeedbacks();
    return {
      totalCount: allFeedbacks.length,
      positiveCount: allFeedbacks.filter((f) => f.rating === "up").length,
      negativeCount: allFeedbacks.filter((f) => f.rating === "down").length,
      recentFeedback: allFeedbacks.slice(0, 10),
    };
  }

  // Override Correction methods to use PostgreSQL database
  async createCorrection(correction: InsertCorrection): Promise<Correction> {
    const [newCorrection] = await db.insert(corrections).values(correction).returning();
    return newCorrection;
  }

  async getVanessaLog(logId: number): Promise<VanessaLog | undefined> {
    const result = await db
      .select()
      .from(vanessaLogs)
      .where(eq(vanessaLogs.id, logId))
      .limit(1);
    return result[0];
  }

  async getAllCorrections(): Promise<Correction[]> {
    return await db
      .select()
      .from(corrections)
      .orderBy(desc(corrections.createdAt))
      .limit(1000);
  }

  async getCorrectionsByTopic(topic: string): Promise<Correction[]> {
    return await db
      .select()
      .from(corrections)
      .where(eq(corrections.topic, topic))
      .orderBy(desc(corrections.createdAt));
  }

  // Override Training Log methods to use PostgreSQL database
  async createTrainingLog(trainingLog: InsertTrainingLog): Promise<TrainingLog> {
    const [newTrainingLog] = await db.insert(trainingLogs).values(trainingLog).returning();
    return newTrainingLog;
  }

  async getTrainingLogsByAdmin(adminId: string): Promise<TrainingLog[]> {
    return await db
      .select()
      .from(trainingLogs)
      .where(eq(trainingLogs.adminId, adminId))
      .orderBy(desc(trainingLogs.createdAt))
      .limit(1000);
  }

  async getAllTrainingLogs(): Promise<TrainingLog[]> {
    return await db
      .select()
      .from(trainingLogs)
      .orderBy(desc(trainingLogs.createdAt))
      .limit(1000);
  }

  // Override LegalOps Trial methods to use PostgreSQL database
  async createLegalOpsTrial(trial: InsertLegalOpsTrial): Promise<LegalOpsTrial> {
    const [newTrial] = await db.insert(legalOpsTrials).values(trial).returning();
    return newTrial;
  }

  async getLegalOpsTrialByEmail(email: string): Promise<LegalOpsTrial | undefined> {
    const results = await db
      .select()
      .from(legalOpsTrials)
      .where(eq(legalOpsTrials.email, email))
      .limit(1);
    return results[0];
  }

  async getAllLegalOpsTrials(): Promise<LegalOpsTrial[]> {
    return await db
      .select()
      .from(legalOpsTrials)
      .orderBy(desc(legalOpsTrials.createdAt))
      .limit(1000);
  }

  // Blog Posts (Insights page) - CRUD operations
  async getPost(id: string): Promise<Post | undefined> {
    const results = await db
      .select()
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1);
    return results[0];
  }

  async getPostBySlug(slug: string): Promise<Post | undefined> {
    const results = await db
      .select()
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1);
    return results[0];
  }

  async createPost(post: InsertPost): Promise<Post> {
    const [newPost] = await db.insert(posts).values(post).returning();
    return newPost;
  }

  async updatePost(id: string, updates: Partial<InsertPost>): Promise<Post | undefined> {
    const [updatedPost] = await db
      .update(posts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    return updatedPost;
  }

  async deletePost(id: string): Promise<boolean> {
    const result = await db
      .delete(posts)
      .where(eq(posts.id, id))
      .returning();
    return result.length > 0;
  }

  async listPublishedPosts(options?: { category?: string; featured?: boolean }): Promise<Post[]> {
    let query = db
      .select()
      .from(posts)
      .where(eq(posts.status, "published"));
    
    const results = await query.orderBy(desc(posts.publishedAt));
    
    let filtered = results;
    if (options?.category) {
      filtered = filtered.filter(p => p.category === options.category);
    }
    if (options?.featured !== undefined) {
      filtered = filtered.filter(p => p.isFeatured === options.featured);
    }
    
    return filtered;
  }

  async listAllPosts(): Promise<Post[]> {
    return await db
      .select()
      .from(posts)
      .orderBy(desc(posts.createdAt))
      .limit(1000);
  }

  async listHomepagePosts(): Promise<Post[]> {
    const results = await db
      .select()
      .from(posts)
      .where(and(eq(posts.status, "published"), eq(posts.showOnHomepage, true)))
      .orderBy(asc(posts.homepageOrder))
      .limit(3);
    return results;
  }

  async incrementPostViews(id: string): Promise<number> {
    const [updated] = await db
      .update(posts)
      .set({ views: sqlOp`COALESCE("views", 0) + 1` })
      .where(eq(posts.id, id))
      .returning({ views: posts.views });
    return updated?.views || 0;
  }

  async incrementPostLikes(id: string): Promise<number> {
    const [updated] = await db
      .update(posts)
      .set({ likes: sqlOp`COALESCE("likes", 0) + 1` })
      .where(eq(posts.id, id))
      .returning({ likes: posts.likes });
    return updated?.likes || 0;
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, id))
      .limit(1);
    return job || undefined;
  }

  async getJobWithSkills(jobId: string): Promise<(Job & { skills: string[] }) | undefined> {
    const job = await this.getJob(jobId);
    if (!job) return undefined;
    return {
      ...job,
      skills: (job.skillTags as string[]) || [],
    };
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobsTable).values(insertJob).returning();
    return job;
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job | undefined> {
    const [job] = await db
      .update(jobsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobsTable.id, id))
      .returning();
    return job || undefined;
  }

  async listAllJobs(): Promise<Job[]> {
    return await db
      .select()
      .from(jobsTable)
      .where(ne(jobsTable.status, "cancelled"))
      .orderBy(desc(jobsTable.createdAt))
      .limit(500);
  }

  async listJobsByClient(clientId: string): Promise<Job[]> {
    return await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.clientId, clientId))
      .orderBy(desc(jobsTable.createdAt));
  }

  async searchJobsWithSkills(filters: {
    category?: string;
    categories?: string[];  // multi-category filter (OR logic); takes precedence over category
    engagementType?: string;
    experienceLevel?: string;
    minBudget?: number;
    maxBudget?: number;
    skills?: string[];
    status?: string;
    q?: string;
    location?: string;     // "Remote" | "Hybrid" | "On-site" — substring match against job.location
  }): Promise<(Job & { skills: string[] })[]> {
    let allDbJobs = await db
      .select()
      .from(jobsTable)
      .orderBy(desc(jobsTable.createdAt))
      .limit(500);

    let jobs = allDbJobs;

    // Normalise a category string the same way the frontend does (normalizeCategory util)
    const normStr = (s: string) =>
      s.trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

    // Multi-category filter (OR): used when nav slug maps to several DB categories.
    if (filters.categories && filters.categories.length > 0) {
      const normCats = filters.categories.map(normStr);
      jobs = jobs.filter(j => {
        const jobCat = normStr((j as any).jobFunction || j.category || "");
        return normCats.some(c => jobCat === c);
      });
    } else if (filters.category) {
      // Single-category filter: try exact normalised match first (frontend sends real DB values),
      // then fall back to keyword-expansion for legacy slug-style callers.
      const cat = normStr(filters.category);
      const categoryKeywords: Record<string, string[]> = {
        development: ["development", "dev", "it", "software", "engineer", "programming", "tech", "administrator"],
        design: ["design", "creative", "ui", "ux", "graphic", "visual"],
        marketing: ["marketing", "sales", "seo", "social media", "advertising"],
        support: ["support", "admin", "assistant", "customer service", "operations"],
        writing: ["writing", "translation", "content", "copywriting", "editor"],
      };
      jobs = jobs.filter(j => {
        const jobCat = normStr((j as any).jobFunction || j.category || "");
        if (jobCat === cat) return true;
        // Keyword expansion for slug-style callers
        const keywords = categoryKeywords[cat];
        if (keywords) return keywords.some(kw => j.title.toLowerCase().includes(kw));
        return false;
      });
    }

    if (filters.engagementType) {
      jobs = jobs.filter(j => j.engagementType === filters.engagementType);
    }
    if (filters.experienceLevel) {
      jobs = jobs.filter(j => j.experienceLevel === filters.experienceLevel);
    }
    if (filters.status) {
      jobs = jobs.filter(j => j.status === filters.status);
    }
    // Public search: only show jobs that are explicitly approved (never pending/rejected/linked)
    // Null is treated as approved for backward compatibility with pre-workflow records
    jobs = jobs.filter(j => {
      const status = (j as any).approvalStatus;
      return status === "approved" || status == null;
    });
    if (filters.minBudget !== undefined) {
      jobs = jobs.filter(j => j.budget && parseFloat(j.budget) >= filters.minBudget!);
    }
    if (filters.maxBudget !== undefined) {
      jobs = jobs.filter(j => j.budget && parseFloat(j.budget) <= filters.maxBudget!);
    }
    if (filters.location) {
      const loc = filters.location.toLowerCase();
      jobs = jobs.filter(j => (j.location ?? "").toLowerCase().includes(loc));
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        j.category.toLowerCase().includes(q) ||
        ((j as any).jobFunction ?? "").toLowerCase().includes(q) ||
        ((j as any).professionalRoleName ?? "").toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q) ||
        ((j as any).skillTags ?? []).some((t: string) => t.toLowerCase().includes(q)) ||
        // SECURITY: Do NOT match company name for confidential jobs — prevents leaking the
        // real employer identity when a candidate searches by company name.
        // Any future change to this search block (e.g. raw SQL / full-text index) MUST
        // preserve this guard. See server/tests/confidential-search.test.ts for the
        // regression test that verifies this behaviour.
        (!(j as any).isCompanyConfidential && j.company && j.company.toLowerCase().includes(q))
      );
    }

    // Populate skills from the job's skillTags (authoritative skill source for DB jobs;
    // the legacy job_skills table is unused). The match scorer depends on this.
    return jobs.map(job => ({ ...job, skills: ((job as any).skillTags ?? []) as string[] }));
  }

  async searchJobs(filters: {
    category?: string;
    engagementType?: string;
    experienceLevel?: string;
    minBudget?: number;
    maxBudget?: number;
    skills?: string[];
    status?: string;
    q?: string;
  }): Promise<Job[]> {
    const enhanced = await this.searchJobsWithSkills(filters);
    return enhanced.map(({ skills, ...job }) => job);
  }

  async trackHotSearch(term: string): Promise<HotSearch> {
    const [entry] = await db.insert(hotSearches).values({ term: term.toLowerCase() }).returning();
    return entry;
  }

  async getHotSearches(range: "daily" | "weekly"): Promise<{ term: string; count: number }[]> {
    const rangeMs = range === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - rangeMs);
    const rows = await db
      .select({
        term: hotSearches.term,
        count: sqlOp<number>`count(*)::int`,
      })
      .from(hotSearches)
      .where(gte(hotSearches.searchedAt, cutoff))
      .groupBy(hotSearches.term)
      .orderBy(desc(sqlOp`count(*)`))
      .limit(5);
    return rows;
  }

  async createCandidate(data: InsertCandidate): Promise<Candidate> {
    const [candidate] = await db.insert(candidatesTable).values(data).returning();
    return candidate;
  }

  async getCandidate(id: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, id));
    return candidate;
  }

  async getCandidateByEmail(email: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidatesTable)
      .where(sqlOp`lower(${candidatesTable.email}) = lower(${email})`);
    return candidate;
  }

  async getCandidateByUserId(userId: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidatesTable)
      .where(eq(candidatesTable.userId, userId));
    return candidate;
  }

  async getCandidates(): Promise<Candidate[]> {
    return await db.select().from(candidatesTable).orderBy(desc(candidatesTable.createdAt));
  }

  async updateCandidate(id: string, updates: Partial<InsertCandidate>): Promise<Candidate | undefined> {
    const [updated] = await db.update(candidatesTable).set(updates).where(eq(candidatesTable.id, id)).returning();
    return updated;
  }

  async upsertCultureEvaluation(
    candidateId: string,
    data: Omit<InsertCultureEvaluation, "candidateId">,
  ): Promise<CultureEvaluation> {
    const existing = await this.getCultureEvaluationByCandidate(candidateId);
    if (existing) {
      const [updated] = await db
        .update(cultureEvaluationsTable)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(cultureEvaluationsTable.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(cultureEvaluationsTable)
      .values({ ...data, candidateId })
      .returning();
    return created;
  }

  async getCultureEvaluationByCandidate(candidateId: string): Promise<CultureEvaluation | undefined> {
    const [row] = await db
      .select()
      .from(cultureEvaluationsTable)
      .where(eq(cultureEvaluationsTable.candidateId, candidateId))
      .orderBy(desc(cultureEvaluationsTable.createdAt))
      .limit(1);
    return row;
  }

  /**
   * This replaces the old searchJobsWithSkills + pageSlice pattern that capped
   * results at .limit(500) before filtering, making meta.total always ≤ 500.
   */
  async searchJobsPaginated(filters: {
    category?: string;
    categories?: string[];
    engagementType?: string;
    experienceLevel?: string;
    minBudget?: number;
    maxBudget?: number;
    minSalary?: number;
    status?: string;
    q?: string;
    location?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: (Job & { skills: string[] })[]; total: number }> {
    const { page, pageSize } = filters;
    const offset = (page - 1) * pageSize;

    // Normalize a category string: lowercase, & → and, collapse non-alnum to space.
    // Must match the normStr used in FindWorkAllJobs.tsx on the frontend.
    const normStr = (s: string) =>
      s.trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

    // SQL expressions that normalise each stored field independently.
    // We check job_function AND category as separate OR branches so that a job
    // with only one field populated (or with a value in only one column) still
    // surfaces when the other column matches.
    // IMPORTANT: lower() must wrap the COALESCE (not the outermost expression) so that
    // uppercase letters like 'E' in "Engineering" are lowercased BEFORE regexp_replace
    // processes them.  The pattern [^a-z0-9]+ only keeps lowercase letters, so capital
    // letters would be stripped if lower() runs after the regex.  This must mirror the
    // JS normStr helper which also lowercases first.
    const normDbJobFunction = sqlOp`trim(regexp_replace(replace(lower(COALESCE(${jobsTable.jobFunction}, '')), '&', 'and'), '[^a-z0-9]+', ' ', 'g'))`;
    const normDbCategory    = sqlOp`trim(regexp_replace(replace(lower(COALESCE(${jobsTable.category},    '')), '&', 'and'), '[^a-z0-9]+', ' ', 'g'))`;

    // ── Build WHERE conditions ─────────────────────────────────────────────────
    const conditions: ReturnType<typeof sqlOp>[] = [];

    // Status (default: open)
    conditions.push(sqlOp`${jobsTable.status} = ${filters.status ?? "open"}`);

    // Approval: only approved (or legacy null-value) jobs are shown publicly
    conditions.push(
      sqlOp`(${jobsTable.approvalStatus} = 'approved' OR ${jobsTable.approvalStatus} IS NULL)`,
    );

    // Structural guard: scaffold jobs are auto-generated scoring artifacts and must never
    // appear in any public or talent-facing listing regardless of their status.
    conditions.push(
      sqlOp`(${jobsTable.createdVia} IS NULL OR ${jobsTable.createdVia} != 'search_scaffold')`,
    );

    // Category filter — checks job_function OR category independently so that
    // legacy jobs with only one field populated still match.
    if (filters.categories && filters.categories.length > 0) {
      // Multi-category (nav-group slug) — OR match across all supplied categories
      const normCats = filters.categories.map(normStr);
      // Build: (normDbJobFunction = c OR normDbCategory = c) for each c, all OR'd together
      const catOrs = normCats.flatMap(c => [
        sqlOp`${normDbJobFunction} = ${c}`,
        sqlOp`${normDbCategory} = ${c}`,
      ]);
      conditions.push(sqlOp`(${sqlOp.join(catOrs, sqlOp` OR `)})`);
    } else if (filters.category) {
      const cat = normStr(filters.category);
      conditions.push(sqlOp`(${normDbJobFunction} = ${cat} OR ${normDbCategory} = ${cat})`);
    }

    // Engagement type — normalized comparison: strips hyphens/spaces/underscores so
    // "Half-Day", "halfday", and "half-day" all resolve to "halfday".
    if (filters.engagementType) {
      const normEngagement = filters.engagementType.toLowerCase().replace(/[^a-z0-9]/g, "");
      conditions.push(sqlOp`regexp_replace(lower(COALESCE(${jobsTable.engagementType}, '')), '[^a-z0-9]', '', 'g') = ${normEngagement}`);
    }

    // Experience level — exact match
    if (filters.experienceLevel) {
      conditions.push(sqlOp`${jobsTable.experienceLevel} = ${filters.experienceLevel}`);
    }

    // Budget range (budget column is stored as text/decimal)
    if (filters.minBudget !== undefined) {
      conditions.push(sqlOp`${jobsTable.budget}::numeric >= ${filters.minBudget}`);
    }
    if (filters.maxBudget !== undefined) {
      conditions.push(sqlOp`${jobsTable.budget}::numeric <= ${filters.maxBudget}`);
    }

    // Minimum salary — server-side, PHP-currency jobs only (non-PHP jobs always pass).
    // All digit sequences are extracted from salary_display (commas/underscores stripped),
    // the MAX is taken, and the budget column is also considered as a numeric fallback.
    // This correctly handles ranges like "30,000 - 50,000" by using the upper bound (50,000).
    if (filters.minSalary !== undefined) {
      conditions.push(sqlOp`(
        upper(COALESCE(${jobsTable.budgetCurrency}, 'PHP')) <> 'PHP'
        OR GREATEST(
          COALESCE((
            SELECT max(m[1]::numeric)
            FROM regexp_matches(
              regexp_replace(COALESCE(${jobsTable.salaryDisplay}, ''), '[,_]', '', 'g'),
              '(\\d+)',
              'g'
            ) AS m
          ), 0),
          COALESCE(${jobsTable.budget}::numeric, 0)
        ) >= ${filters.minSalary}
      )`);
    }

    // Location — normalized comparison so "On-site" matches "Onsite", "on site", etc.
    // Both sides strip all non-alphanumeric characters and lowercase before comparing.
    if (filters.location) {
      const normLoc = filters.location.toLowerCase().replace(/[^a-z0-9]/g, "");
      conditions.push(sqlOp`regexp_replace(lower(COALESCE(${jobsTable.location}, '')), '[^a-z0-9]', '', 'g') = ${normLoc}`);
    }

    // Full-text search — matches title, description, category, function, role name,
    // location, skill tags; company only if NOT confidential.
    if (filters.q) {
      const qLike = "%" + filters.q.toLowerCase() + "%";
      conditions.push(sqlOp`(
        lower(${jobsTable.title}) LIKE ${qLike}
        OR lower(${jobsTable.description}) LIKE ${qLike}
        OR lower(${jobsTable.category}) LIKE ${qLike}
        OR lower(COALESCE(${jobsTable.jobFunction}, '')) LIKE ${qLike}
        OR lower(COALESCE(${jobsTable.professionalRoleName}, '')) LIKE ${qLike}
        OR lower(COALESCE(${jobsTable.location}, '')) LIKE ${qLike}
        OR (${jobsTable.isCompanyConfidential} = false
            AND lower(COALESCE(${jobsTable.company}, '')) LIKE ${qLike})
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(${jobsTable.skillTags}, ARRAY[]::text[])) AS t
          WHERE lower(t) LIKE ${qLike}
        )
      )`);
    }

    // Combine all conditions with AND
    const whereClause = sqlOp`${sqlOp.join(conditions, sqlOp` AND `)}`;

    // ── Query 1: COUNT (no LIMIT/OFFSET) ──────────────────────────────────────
    // This is the total number of matching jobs across ALL pages.
    const [countRow] = await db
      .select({ total: sqlOp<number>`count(*)::int` })
      .from(jobsTable)
      .where(whereClause);

    const total: number = countRow?.total ?? 0;

    // ── Query 2: Page data (LIMIT/OFFSET) ─────────────────────────────────────
    // Priority sort: urgent (2) > featured (1) > normal (0), then newest first, then id.
    // This must happen BEFORE LIMIT/OFFSET so urgent jobs on page 40 bubble to page 1.
    const priorityExpr = sqlOp<number>`
      CASE
        WHEN ${jobsTable.urgentlyHiring} = TRUE AND ${jobsTable.isFeatured} = TRUE THEN 3
        WHEN ${jobsTable.urgentlyHiring} = TRUE THEN 2
        WHEN ${jobsTable.isFeatured}      = TRUE THEN 1
        ELSE 0
      END`;
    const items = await db
      .select()
      .from(jobsTable)
      .where(whereClause)
      .orderBy(desc(priorityExpr), desc(jobsTable.createdAt), desc(jobsTable.id))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map(job => ({ ...job, skills: [] })),
      total,
    };
  }

  /**
   * Override searchProfiles to query PostgreSQL and coalesce rate from both
   * profiles.hourly_rate (legacy JWT onboarding path) and
   * candidates.preferences->>'rateAmount' (Talent Portal Settings path).
   * This ensures talent who set their rate only via Settings appear in
   * admin rate-range searches.
   */
  async searchProfiles(filters: {
    location?: string;
    skills?: string[];
    availability?: string;
    minRate?: number;
    maxRate?: number;
    rating?: number;
  }): Promise<Profile[]> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let idx = 1;

    if (filters.location) {
      conditions.push(`p.location ILIKE $${idx}`);
      params.push(`%${filters.location}%`);
      idx++;
    }

    if (filters.availability) {
      conditions.push(`p.availability = $${idx}`);
      params.push(filters.availability);
      idx++;
    }

    if (filters.rating !== undefined) {
      conditions.push(`p.rating::numeric >= $${idx}`);
      params.push(filters.rating);
      idx++;
    }

    // Coalesce rate: prefer profiles.hourly_rate; fall back to
    // candidates.preferences->>'rateAmount' set via Talent Portal Settings.
    const rateExpr = `COALESCE(
      NULLIF(p.hourly_rate, '')::numeric,
      NULLIF(NULLIF(c.preferences->>'rateAmount', ''), 'null')::numeric
    )`;

    if (filters.minRate !== undefined) {
      conditions.push(`${rateExpr} >= $${idx}`);
      params.push(filters.minRate);
      idx++;
    }

    if (filters.maxRate !== undefined) {
      conditions.push(`${rateExpr} <= $${idx}`);
      params.push(filters.maxRate);
      idx++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const sql = `
      SELECT p.*
      FROM profiles p
      LEFT JOIN candidates c ON p.user_id = c.user_id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT 500
    `;

    const result = await this._queryFn(sql, params);
    // Map snake_case DB columns to camelCase Profile fields
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      title: row.title,
      bio: row.bio,
      location: row.location,
      hourlyRate: row.hourly_rate,
      rateCurrency: row.rate_currency,
      availability: row.availability,
      profilePicture: row.profile_picture,
      phoneNumber: row.phone_number,
      languages: row.languages,
      timezone: row.timezone,
      rating: row.rating,
      totalEarnings: row.total_earnings,
      jobSuccessScore: row.job_success_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Delete search_scaffold jobs older than 7 days that have no associated
   * job_submissions rows (i.e. the client searched but never invited anyone).
   * Scaffold jobs that have at least one invitation are kept for audit purposes.
   */
  async cleanupOrphanedScaffoldJobs(): Promise<number> {
    const result = await dbQuery(
      `DELETE FROM jobs
       WHERE created_via = 'search_scaffold'
         AND created_at < NOW() - INTERVAL '7 days'
         AND id NOT IN (
           SELECT DISTINCT job_id FROM job_submissions WHERE job_id IS NOT NULL
         )`,
    );
    return result.rowCount ?? 0;
  }

  /**
   * Count search_scaffold jobs older than 7 days that have no associated
   * job_submissions rows. Called after cleanup to detect stuck/accumulating rows.
   */
  async countOrphanedScaffoldJobs(): Promise<number> {
    const result = await dbQuery(
      `SELECT COUNT(*)::int AS cnt
       FROM jobs
       WHERE created_via = 'search_scaffold'
         AND created_at < NOW() - INTERVAL '7 days'
         AND id NOT IN (
           SELECT DISTINCT job_id FROM job_submissions WHERE job_id IS NOT NULL
         )`,
    );
    return result.rows[0]?.cnt ?? 0;
  }

  /**
   * List all search_scaffold jobs for admin visibility, including age and
   * whether they have any associated job_submissions (invitations).
   */
  async listScaffoldJobs(): Promise<Array<{
    id: string;
    title: string;
    clientId: string;
    clientEmail: string | null;
    companyName: string | null;
    createdAt: Date;
    ageHours: number;
    invitationCount: number;
    skillTags: string[];
    engagementType: string | null;
  }>> {
    const result = await dbQuery(
      `SELECT
         j.id,
         j.title,
         j.client_id       AS "clientId",
         u.email           AS "clientEmail",
         cp.company_name   AS "companyName",
         j.created_at      AS "createdAt",
         EXTRACT(EPOCH FROM (NOW() - j.created_at)) / 3600 AS "ageHours",
         COUNT(js.id)      AS "invitationCount",
         j.skill_tags      AS "skillTags",
         j.engagement_type AS "engagementType"
       FROM jobs j
       LEFT JOIN users u  ON u.id = j.client_id
       LEFT JOIN client_profiles cp ON cp.user_id = j.client_id
       LEFT JOIN job_submissions js ON js.job_id = j.id
       WHERE j.created_via = 'search_scaffold'
       GROUP BY j.id, u.email, cp.company_name
       ORDER BY j.created_at DESC`,
    );
    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      clientId: row.clientId,
      clientEmail: row.clientEmail,
      companyName: row.companyName,
      createdAt: new Date(row.createdAt),
      ageHours: parseFloat(row.ageHours ?? "0"),
      invitationCount: parseInt(row.invitationCount ?? "0", 10),
      skillTags: Array.isArray(row.skillTags) ? row.skillTags : [],
      engagementType: row.engagementType,
    }));
  }

  /**
   * Delete scaffold jobs by explicit ID list.
   * Only deletes rows that are:
   *   - created_via = 'search_scaffold' (safety guard against deleting real jobs)
   *   - have NO associated job_submissions rows (avoids FK violation and protects
   *     talent who already received an invitation)
   * Returns the number of rows deleted.
   */
  async deleteScaffoldJobsByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const placeholders = ids.map((_: any, i: number) => `$${i + 1}`).join(", ");
    const result = await dbQuery(
      `DELETE FROM jobs
       WHERE id IN (${placeholders})
         AND created_via = 'search_scaffold'
         AND id NOT IN (
           SELECT DISTINCT job_id FROM job_submissions WHERE job_id IS NOT NULL
         )`,
      ids,
    );
    return result.rowCount ?? 0;
  }

  // ── Messaging ────────────────────────────────────────────────────────────────

  async getMessageThread(id: string): Promise<MessageThread | undefined> {
    const [thread] = await db
      .select()
      .from(messageThreadsTable)
      .where(eq(messageThreadsTable.id, id))
      .limit(1);
    return thread ?? undefined;
  }

  async createMessageThread(insertThread: InsertMessageThread): Promise<MessageThread> {
    const [thread] = await db
      .insert(messageThreadsTable)
      .values(insertThread)
      .returning();
    return thread;
  }

  async listMessageThreadsByUser(userId: string): Promise<MessageThread[]> {
    return db
      .select()
      .from(messageThreadsTable)
      .where(sqlOp`${messageThreadsTable.participants} @> ARRAY[${userId}]::text[]`)
      .orderBy(desc(messageThreadsTable.lastMessageAt));
  }

  async listMessageThreadsByUserWithUnread(userId: string): Promise<Array<MessageThread & {
    unreadCount: number;
    latestMessageAt: Date | null;
  }>> {
    const result = await dbQuery(
      `SELECT
         mt.id,
         mt.job_id AS "jobId",
         mt.contract_id AS "contractId",
         mt.participants,
         mt.subject,
         mt.last_message_at AS "lastMessageAt",
         mt.created_at AS "createdAt",
         COALESCE(stats.unread_count, 0)::int AS "unreadCount",
         COALESCE(stats.latest_message_at, mt.last_message_at) AS "latestMessageAt"
       FROM message_threads mt
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*) FILTER (
             WHERE m.sender_id <> $1
               AND NOT ($1 = ANY(COALESCE(m.read_by, '{}'::text[])))
           ) AS unread_count,
           MAX(m.created_at) AS latest_message_at
         FROM messages m
         WHERE m.thread_id = mt.id
       ) stats ON TRUE
       WHERE $1 = ANY(mt.participants)
       ORDER BY COALESCE(stats.latest_message_at, mt.last_message_at) DESC NULLS LAST`,
      [userId],
    );
    return result.rows as Array<MessageThread & {
      unreadCount: number;
      latestMessageAt: Date | null;
    }>;
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const [msg] = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, id))
      .limit(1);
    return msg ?? undefined;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [msg] = await db
      .insert(messagesTable)
      .values(insertMessage)
      .returning();
    // Update thread lastMessageAt in-place
    await db
      .update(messageThreadsTable)
      .set({ lastMessageAt: new Date() })
      .where(eq(messageThreadsTable.id, msg.threadId));
    return msg;
  }

  async flagMessage(messageId: string): Promise<void> {
    await db
      .update(messagesTable)
      .set({ flaggedForReview: true })
      .where(eq(messagesTable.id, messageId));
  }

  async listMessagesByThread(threadId: string): Promise<Message[]> {
    return db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, threadId))
      .orderBy(asc(messagesTable.createdAt));
  }

  async flagMessageForReview(messageId: string): Promise<void> {
    await db
      .update(messagesTable)
      .set({ flaggedForReview: true })
      .where(eq(messagesTable.id, messageId));
  }

  async markMessagesAsRead(threadId: string, userId: string): Promise<void> {
    // Append only to incoming messages; reading a thread must not mark sent
    // messages as read by their own sender.
    await dbQuery(
      `UPDATE messages
       SET read_by = array_append(read_by, $1)
       WHERE thread_id = $2
         AND sender_id <> $1
         AND NOT ($1 = ANY(COALESCE(read_by, '{}'::text[])))`,
      [userId, threadId],
    );
  }

  async listFlaggedMessages(): Promise<Array<Message & { thread: MessageThread | null }>> {
    const flagged = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.flaggedForReview, true))
      .orderBy(desc(messagesTable.createdAt));

    // Fetch threads for context
    const threadIds = Array.from(new Set(flagged.map((m) => m.threadId)));
    const threads: MessageThread[] = threadIds.length
      ? await db
          .select()
          .from(messageThreadsTable)
          .where(sqlOp`${messageThreadsTable.id} = ANY(${threadIds})`)
      : [];
    const threadMap = new Map(threads.map((t) => [t.id, t]));

    return flagged.map((m) => ({ ...m, thread: threadMap.get(m.threadId) ?? null }));
  }

  async clearMessageFlag(messageId: string): Promise<void> {
    await db
      .update(messagesTable)
      .set({ flaggedForReview: false })
      .where(eq(messagesTable.id, messageId));
  }

  // ── Certifications (DB-backed) ────────────────────────────────────────────

  async getCertification(id: string): Promise<Certification | undefined> {
    const [cert] = await db
      .select()
      .from(certificationsTable)
      .where(eq(certificationsTable.id, id))
      .limit(1);
    return cert ?? undefined;
  }

  async createCertification(insertCert: InsertCertification): Promise<Certification> {
    const [cert] = await db
      .insert(certificationsTable)
      .values({ ...insertCert, verified: false })
      .returning();
    return cert;
  }

  async listCertificationsByTalent(talentId: string): Promise<Certification[]> {
    return db
      .select()
      .from(certificationsTable)
      .where(eq(certificationsTable.talentId, talentId))
      .orderBy(desc(certificationsTable.createdAt));
  }

  async updateCertification(id: string, updates: Partial<InsertCertification>): Promise<Certification | undefined> {
    const [cert] = await db
      .update(certificationsTable)
      .set(updates)
      .where(eq(certificationsTable.id, id))
      .returning();
    return cert ?? undefined;
  }

  async deleteCertification(id: string): Promise<boolean> {
    const result = await db
      .delete(certificationsTable)
      .where(eq(certificationsTable.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Notifications (DB-backed) ─────────────────────────────────────────────
  // These three methods override the MemStorage implementations so notifications
  // are persisted to the database and survive server restarts.

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notificationsTable)
      .values(insertNotification)
      .returning();
    return notification;
  }

  async upsertMessageNotification(input: MessageNotificationInput): Promise<Notification | undefined> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize sends for one recipient/thread without blocking unrelated conversations.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [`new_message:${input.recipientId}:${input.threadId}`],
      );

      if (input.messageId) {
        const messageState = await client.query(
          `SELECT $1 = ANY(COALESCE(read_by, '{}'::text[])) AS is_read
             FROM messages
            WHERE id = $2
            LIMIT 1`,
          [input.recipientId, input.messageId],
        );
        if (messageState.rows[0]?.is_read) {
          await client.query("COMMIT");
          return undefined;
        }
      }

      const existing = await client.query(
        `SELECT id, user_id, type, title, message, related_id, related_type,
                message_count, is_read, created_at
           FROM notifications
          WHERE user_id = $1
            AND type = 'new_message'
            AND related_id = $2
            AND is_read = false
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE`,
        [input.recipientId, input.threadId],
      );

      const messageCount = Number(existing.rows[0]?.message_count ?? 0) + 1;
      const copy = messageNotificationCopy(input.senderName, messageCount);
      const result = existing.rows[0]
        ? await client.query(
            `UPDATE notifications
                SET title = $1,
                    message = $2,
                    message_count = $3,
                    created_at = NOW()
              WHERE id = $4
              RETURNING id, user_id, type, title, message, related_id, related_type,
                        message_count, is_read, created_at`,
            [copy.title, copy.message, messageCount, existing.rows[0].id],
          )
        : await client.query(
            `INSERT INTO notifications
                    (user_id, type, title, message, related_id, related_type, message_count)
             VALUES ($1, 'new_message', $2, $3, $4, 'message_thread', $5)
             RETURNING id, user_id, type, title, message, related_id, related_type,
                       message_count, is_read, created_at`,
            [input.recipientId, copy.title, copy.message, input.threadId, messageCount],
          );

      await client.query("COMMIT");
      return notificationFromRow(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async consolidateUnreadMessageNotifications(): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const groups = await client.query(
        `SELECT DISTINCT user_id, related_id
           FROM notifications
          WHERE type = 'new_message'
            AND is_read = false
            AND related_id IS NOT NULL`,
      );

      let removed = 0;
      for (const group of groups.rows) {
        const userId = String(group.user_id);
        const threadId = String(group.related_id);

        // Use the same per-recipient/thread lock as the live upsert path so a
        // notification cannot be added between selecting and consolidating a group.
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext($1))",
          [`new_message:${userId}:${threadId}`],
        );

        const notifications = await client.query(
          `SELECT id, user_id, type, title, message, related_id, related_type,
                  message_count, is_read, created_at
             FROM notifications
            WHERE user_id = $1
              AND type = 'new_message'
              AND related_id = $2
              AND is_read = false
            ORDER BY created_at DESC NULLS LAST, id DESC
            FOR UPDATE`,
          [userId, threadId],
        );
        if (notifications.rows.length === 0) continue;

        const keeper = notifications.rows[0];
        const messageCount = notifications.rows.reduce(
          (total: number, notification: any) =>
            total + messageNotificationCount({
              messageCount: notification.message_count,
            }),
          0,
        );
        const copy = messageNotificationCopy(
          messageNotificationSenderName({
            title: keeper.title,
            message: keeper.message,
          }),
          messageCount,
        );

        await client.query(
          `UPDATE notifications
              SET title = $1,
                  message = $2,
                  related_type = 'message_thread',
                  message_count = $3
            WHERE id = $4`,
          [copy.title, copy.message, messageCount, keeper.id],
        );

        const duplicateIds = notifications.rows
          .slice(1)
          .map((notification: any) => notification.id);
        if (duplicateIds.length > 0) {
          const deleted = await client.query(
            `DELETE FROM notifications
              WHERE id = ANY($1::varchar[])`,
            [duplicateIds],
          );
          removed += deleted.rowCount ?? 0;
        }
      }

      await client.query("COMMIT");
      return removed;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async listNotificationsByUser(userId: string, unreadOnly?: boolean): Promise<Notification[]> {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        unreadOnly
          ? and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false))
          : eq(notificationsTable.userId, userId),
      )
      .orderBy(desc(notificationsTable.createdAt));
    return rows;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const result = await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async markMessageNotificationsAsRead(userId: string, threadId: string): Promise<void> {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(
        and(
          eq(notificationsTable.userId, userId),
          eq(notificationsTable.type, "new_message"),
          eq(notificationsTable.relatedId, threadId),
          eq(notificationsTable.isRead, false),
        ),
      );
  }
}

export const storage = new DbStorage();

function messageNotificationCount(notification: Pick<Notification, "messageCount">): number {
  const count = Number(notification.messageCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
}
