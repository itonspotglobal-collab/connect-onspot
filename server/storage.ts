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
  type Document, type InsertDocument,
  type VanessaLog, type InsertVanessaLog,
  type Feedback, type InsertFeedback,
  leadIntakes,
  vanessaLogs,
  feedbacks
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, gte, ilike, desc, asc, sql as sqlOp } from "drizzle-orm";

// Type for creating user with password
export interface CreateUserData {
  email: string;
  password: string; // Will be hashed before storing as passwordHash
  firstName: string;
  lastName: string;
  role: "client" | "talent";
  company?: string; // Optional for clients
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
    contractType?: string;
    experienceLevel?: string;
    minBudget?: number;
    maxBudget?: number;
    skills?: string[];
    status?: string;
  }): Promise<Job[]>;
  listJobsByClient(clientId: string): Promise<Job[]>;

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
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  listMessagesByThread(threadId: string): Promise<Message[]>;
  markMessagesAsRead(threadId: string, userId: string): Promise<void>;

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
  listNotificationsByUser(userId: string, unreadOnly?: boolean): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<boolean>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  // Enhanced job methods with skills
  getJobWithSkills(jobId: string): Promise<(Job & { skills: string[] }) | undefined>;
  searchJobsWithSkills(filters: {
    category?: string;
    contractType?: string;
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
    contractType?: string;
    category?: string;
    experienceLevel?: string;
  }): Promise<Array<{
    job: Job & { skills: string[] };
    score: number;
    overlapSkills: string[];
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

  // Documents
  getDocument(id: string): Promise<Document | undefined>;
  getUserDocuments(userId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;

  // Vanessa AI Conversation Logs
  createVanessaLog(log: InsertVanessaLog): Promise<VanessaLog>;
  getVanessaLogsByThread(threadId: string): Promise<VanessaLog[]>;
  getAllVanessaThreads(): Promise<{ threadId: string; firstMessage: string; lastMessage: string; messageCount: number; createdAt: Date; updatedAt: Date }[]>;
  searchVanessaLogs(query: string): Promise<VanessaLog[]>;

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
  private documents: Map<string, Document>;
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
    this.documents = new Map();
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
        timezone: "Asia/Manila",
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
      timezone: insertProfile.timezone ?? "Asia/Manila",
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
    const job: Job = {
      ...insertJob,
      id,
      budget: insertJob.budget ?? null,
      budgetCurrency: insertJob.budgetCurrency ?? "USD",
      hourlyRateMin: insertJob.hourlyRateMin ?? null,
      hourlyRateMax: insertJob.hourlyRateMax ?? null,
      duration: insertJob.duration ?? null,
      status: insertJob.status ?? "open",
      proposalCount: 0,
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(id, job);
    return job;
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
    contractType?: string;
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

    if (filters.contractType) {
      jobs = jobs.filter(j => j.contractType === filters.contractType);
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

    // Add text search support
    if (filters.q) {
      const searchQuery = filters.q.toLowerCase();
      jobs = jobs.filter(job => 
        job.title.toLowerCase().includes(searchQuery) ||
        job.description.toLowerCase().includes(searchQuery) ||
        job.category.toLowerCase().includes(searchQuery)
      );
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
    contractType?: string;
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
  async calculateJobMatches(talentId: string, filters?: {
    skills?: string[];
    minRate?: number;
    maxRate?: number;
    timezone?: string;
    contractType?: string;
    category?: string;
    experienceLevel?: string;
  }): Promise<Array<{
    job: Job & { skills: string[] };
    score: number;
    overlapSkills: string[];
  }>> {
    // Get talent's skills if not provided in filters
    let talentSkills: string[] = [];
    if (filters?.skills) {
      talentSkills = filters.skills;
    } else {
      const userSkills = await this.getUserSkillsWithNames(talentId);
      talentSkills = userSkills.map(us => us.skill?.name || '').filter(Boolean);
    }

    // Get talent's profile for rate and timezone matching
    const talentProfile = await this.getProfileByUserId(talentId);
    
    // Search for all available jobs with enhanced skills
    const allJobs = await this.searchJobsWithSkills({
      status: 'open',
      ...(filters?.contractType && { contractType: filters.contractType }),
      ...(filters?.category && { category: filters.category }),
      ...(filters?.experienceLevel && { experienceLevel: filters.experienceLevel }),
      ...(filters?.minRate && { minBudget: filters.minRate }),
      ...(filters?.maxRate && { maxBudget: filters.maxRate }),
    });

    // Calculate matches with scoring
    const jobMatches: Array<{
      job: Job & { skills: string[] };
      score: number;
      overlapSkills: string[];
    }> = [];

    for (const job of allJobs) {
      // Skills intersection filter - only include jobs with ≥1 overlapping skill
      const overlapSkills = job.skills.filter(jobSkill => 
        talentSkills.some(talentSkill => 
          talentSkill.toLowerCase().includes(jobSkill.toLowerCase()) ||
          jobSkill.toLowerCase().includes(talentSkill.toLowerCase())
        )
      );

      if (overlapSkills.length === 0 && talentSkills.length > 0) {
        continue; // Skip jobs with no skill overlap
      }

      // Calculate Jaccard similarity score
      const skillsUnion = Array.from(new Set([...talentSkills, ...job.skills]));
      const jaccardScore = skillsUnion.length > 0 ? overlapSkills.length / skillsUnion.length : 0;

      let totalScore = jaccardScore * 100; // Base score from skills similarity (0-100)

      // Rate overlap bonus
      if (talentProfile?.hourlyRate && job.hourlyRateMin && job.hourlyRateMax) {
        const talentRate = parseFloat(talentProfile.hourlyRate);
        const jobMinRate = parseFloat(job.hourlyRateMin);
        const jobMaxRate = parseFloat(job.hourlyRateMax);
        
        if (talentRate >= jobMinRate && talentRate <= jobMaxRate) {
          totalScore += 20; // Perfect rate match bonus
        } else if (Math.abs(talentRate - jobMinRate) <= 10 || Math.abs(talentRate - jobMaxRate) <= 10) {
          totalScore += 10; // Close rate match bonus
        }
      }

      // Timezone soft-match bonus
      if (talentProfile?.timezone && filters?.timezone) {
        const talentTz = talentProfile.timezone.toLowerCase();
        const filterTz = filters.timezone.toLowerCase();
        
        // Same timezone
        if (talentTz === filterTz) {
          totalScore += 15;
        }
        // Same region (rough approximation)
        else if (
          (talentTz.includes('america') && filterTz.includes('america')) ||
          (talentTz.includes('europe') && filterTz.includes('europe')) ||
          (talentTz.includes('asia') && filterTz.includes('asia'))
        ) {
          totalScore += 5;
        }
      }

      // Recent job bonus
      if (job.createdAt) {
        const daysSincePosted = (Date.now() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePosted <= 3) {
          totalScore += 10;
        } else if (daysSincePosted <= 7) {
          totalScore += 5;
        }
      }

      jobMatches.push({
        job,
        score: Math.round(totalScore),
        overlapSkills
      });
    }

    // Sort by score and ensure we have at least 3 results
    jobMatches.sort((a, b) => b.score - a.score);
    
    // If we have less than 3 matches after skill filtering, add top jobs by Jaccard
    if (jobMatches.length < 3) {
      const additionalJobs = allJobs
        .filter(job => !jobMatches.some(match => match.job.id === job.id))
        .map(job => {
          const skillsUnion = Array.from(new Set([...talentSkills, ...job.skills]));
          const overlapSkills = job.skills.filter(jobSkill => 
            talentSkills.some(talentSkill => 
              talentSkill.toLowerCase().includes(jobSkill.toLowerCase()) ||
              jobSkill.toLowerCase().includes(talentSkill.toLowerCase())
            )
          );
          const jaccardScore = skillsUnion.length > 0 ? overlapSkills.length / skillsUnion.length : 0;
          
          return {
            job,
            score: Math.round(jaccardScore * 50), // Lower score for fallback jobs
            overlapSkills
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3 - jobMatches.length);
      
      jobMatches.push(...additionalJobs);
    }

    return jobMatches.slice(0, 3); // Return top 3 matches
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
      if (message.readBy && !message.readBy.includes(userId)) {
        message.readBy.push(userId);
        this.messages.set(message.id, message);
      }
    }
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
      isRead: false,
      createdAt: new Date()
    };
    this.notifications.set(id, notification);
    return notification;
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
      const user: InsertUser = {
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        role: "talent",
      };

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
        timezone: row.timezone || "Asia/Manila",
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
      const user: InsertUser = {
        email: csvRow.email,
        firstName: csvRow.firstName,
        lastName: csvRow.lastName,
        role: "talent",
      };

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
        timezone: csvRow.timezone || "Asia/Manila",
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
  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(doc => doc.userId === userId);
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const document: Document = {
      id,
      ...insertDocument,
      isPublic: insertDocument.isPublic ?? false,
      isPrimary: insertDocument.isPrimary ?? false,
      fileSize: insertDocument.fileSize ?? null,
      mimeType: insertDocument.mimeType ?? null,
      extractedText: insertDocument.extractedText ?? null,
      createdAt: new Date(),
    };
    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;

    const updatedDocument: Document = { ...document, ...updates };
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

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
    for (const log of this.vanessaLogs.values()) {
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
}

// DbStorage class: Extends MemStorage but uses PostgreSQL for Vanessa logs
export class DbStorage extends MemStorage {
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
}

export const storage = new DbStorage();
