import {
  type User, type InsertUser,
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
  type Notification, type InsertNotification
} from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;

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

  // Counter for auto-incrementing IDs
  private skillIdCounter: number = 1;
  private userSkillIdCounter: number = 1;
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
      ...insertUser,
      id,
      role: insertUser.role || "client",
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

    if (filters.skills && filters.skills.length > 0) {
      jobs = jobs.filter(job => {
        const jobSkills = Array.from(this.jobSkills.values())
          .filter(js => js.jobId === job.id);
        const jobSkillIds = jobSkills.map(js => js.skillId);
        const jobSkillNames = jobSkillIds.map(id => this.skills.get(id)?.name).filter(Boolean);
        
        return filters.skills!.some(skillName => 
          jobSkillNames.some(jobSkill => 
            jobSkill?.toLowerCase().includes(skillName.toLowerCase())
          )
        );
      });
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

    return jobs.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
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
}

export const storage = new MemStorage();
