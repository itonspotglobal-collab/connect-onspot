/**
 * Shared utilities and default data for the Job Form (create / edit).
 * Extracted from JobFormModal so steps can import without pulling in the
 * full modal component and its Dialog dependencies.
 */
import { COMPENSATION_TYPE } from "@/lib/jobConstants";
import type { Job } from "@shared/schema";

// ─── Quill helpers ────────────────────────────────────────────────────────────
export const toQuillHtml = (arr: string[] | null | undefined): string => {
  if (!arr || arr.length === 0) return "";
  if (arr.length === 1 && arr[0].trim().startsWith("<")) return arr[0];
  return "<ul>" + arr.map((item) => `<li>${item}</li>`).join("") + "</ul>";
};

export const isEmptyQuill = (html: string) =>
  !html || html === "<p><br></p>" || html.trim() === "";

// ─── Default / reset state ────────────────────────────────────────────────────
export const defaultFormData = {
  title: "",
  company: "OnSpot",
  location: "Remote",
  professionalRoleName: "",
  originalRoleName: "",
  jobFunction: "",
  category: "",
  engagementType: "",
  experienceLevel: "entry",
  jobSummary: "",
  description: "",
  salaryDisplay: "",
  duration: "",
  status: "open",
  responsibilities: "",
  requirements: "",
  skillTags: "",
  culturalFit: "",
  // Role details
  reportingTo: "",
  division: "",
  jobCode: "",
  jobGrade: "",
  jobLevel: "",
  // Job Success Profile sections
  companyOverview: "",
  roleMission: "",
  keyOutcomes: "",
  keyResponsibilities: "",
  skillsAndCompetencies: "",
  behavioralTraits: "",
  kpis: "",
  trainingAndSupport: "",
  growthPath: "",
  // System requirements
  minimumInternetSpeed: "",
  systemRequirements: "",
  requiredToolsSoftware: "",
  otherEquipmentRequirements: "",
  // Work schedule
  workDays: "",
  timeZone: "",
  weeklyHours: "",
  scheduleFlexibility: "",
  // Preferred qualifications (rich text)
  preferredQualifications: "",
  // Compensation extras
  paymentFrequency: "",
  compensationNotes: "",
  // What We Offer (rich text)
  whatWeOffer: "",
  // Application link / method
  applicationMethod: "built_in_form",
  applyLink: "",
  // Featured job flag
  isFeatured: false,
  // Urgently Hiring flag (manual, not auto-calculated)
  urgentlyHiring: false,
  // Require video introduction from applicants
  requiresVideoIntro: false,
  // Company visibility
  isCompanyConfidential: false,
  confidentialClientOverview: "",
  // Benefits / HMO
  benefits: "",
  // Compensation type — locked to monthly for all new/edited jobs
  compensationType: COMPENSATION_TYPE as "monthly",
  // Additional compensation benefits
  hasCommission: false,
  hasEquity: false,
  // Currency
  currency: "PHP",
  customCurrencyCode: "",
};

export type JobFormData = typeof defaultFormData;

// ─── Helper: seed form from an existing job ───────────────────────────────────
export function jobToFormData(job: Job): JobFormData {
  return {
    title: job.title || "",
    company: job.company || "OnSpot",
    location: job.location || "Remote",
    professionalRoleName: (job as any).professionalRoleName || job.title || "",
    originalRoleName: (job as any).originalRoleName || "",
    jobFunction: (job as any).jobFunction || job.category || "",
    category: job.category || "",
    engagementType: (job as any).engagementType || "",
    experienceLevel: job.experienceLevel || "entry",
    jobSummary: (job as any).jobSummary || "",
    description: job.description || "",
    salaryDisplay: (job as any).salaryDisplay || "",
    duration: job.duration || "",
    status: job.status || "open",
    responsibilities: toQuillHtml(job.responsibilities as string[]),
    requirements: toQuillHtml(job.requirements as string[]),
    skillTags: Array.isArray(job.skillTags)
      ? (job.skillTags as string[]).join(", ")
      : "",
    culturalFit: toQuillHtml(job.culturalFit as string[]),
    // Role details
    reportingTo: (job as any).reportingTo || "",
    division: (job as any).division || "",
    jobCode: (job as any).jobCode || "",
    jobGrade: (job as any).jobGrade || "",
    jobLevel: (job as any).jobLevel || "",
    // JSP sections
    companyOverview: (job as any).companyOverview || "",
    roleMission: (job as any).roleMission || "",
    keyOutcomes: (job as any).keyOutcomes || "",
    keyResponsibilities: (job as any).keyResponsibilities || "",
    skillsAndCompetencies: (job as any).skillsAndCompetencies || "",
    behavioralTraits: (job as any).behavioralTraits || "",
    kpis: (job as any).kpis || "",
    trainingAndSupport: (job as any).trainingAndSupport || "",
    growthPath: (job as any).growthPath || "",
    // System requirements
    minimumInternetSpeed: (job as any).minimumInternetSpeed || "",
    systemRequirements: (job as any).systemRequirements || "",
    requiredToolsSoftware: (job as any).requiredToolsSoftware || "",
    otherEquipmentRequirements: (job as any).otherEquipmentRequirements || "",
    // Work schedule
    workDays: (job as any).workDays || "",
    timeZone: (job as any).timeZone || "",
    weeklyHours: (job as any).weeklyHours || "",
    scheduleFlexibility: (job as any).scheduleFlexibility || "",
    // Preferred qualifications
    preferredQualifications: (job as any).preferredQualifications || "",
    // Compensation extras
    paymentFrequency: (job as any).paymentFrequency || "",
    compensationNotes: (job as any).compensationNotes || "",
    // What We Offer
    whatWeOffer: (job as any).whatWeOffer || "",
    // Application link / method
    applicationMethod: (job as any).applicationMethod || "built_in_form",
    applyLink: (job as any).applyLink || "",
    // Featured job flag
    isFeatured: (job as any).isFeatured ?? false,
    // Urgently Hiring flag
    urgentlyHiring: (job as any).urgentlyHiring ?? false,
    // Require video introduction from applicants
    requiresVideoIntro: (job as any).requiresVideoIntro ?? false,
    // Company visibility
    isCompanyConfidential: (job as any).isCompanyConfidential ?? false,
    confidentialClientOverview: (job as any).confidentialClientOverview || "",
    // Benefits / HMO
    benefits: (job as any).benefits || "",
    // Compensation type — always "monthly" for edited jobs going forward
    compensationType: COMPENSATION_TYPE,
    // Additional compensation benefits
    hasCommission: (job as any).hasCommission ?? false,
    hasEquity: (job as any).hasEquity ?? false,
    // Currency
    currency: (job as any).budgetCurrency || "PHP",
    customCurrencyCode: (job as any).customCurrencyCode || "",
  };
}
