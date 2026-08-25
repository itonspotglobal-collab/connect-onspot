/**
 * Shared utilities and default data for the Job Form (create / edit).
 * Shared by the guided Admin and Client job pages so step components can
 * remain independent of routing and role-specific API behavior.
 */
import type { Job } from "@shared/schema";

export interface RequiredSkillRequirement {
  name: string;
  years: "any" | "1" | "2" | "3" | "5";
}

const SKILL_EXPERIENCE_VALUES = new Set<RequiredSkillRequirement["years"]>([
  "any",
  "1",
  "2",
  "3",
  "5",
]);

function normalizeRequiredSkills(value: unknown, legacySkillTags: unknown): RequiredSkillRequirement[] {
  if (Array.isArray(value)) {
    const structured = value
      .filter((skill): skill is { name?: unknown; years?: unknown } => !!skill && typeof skill === "object")
      .map((skill) => ({
        name: typeof skill.name === "string" ? skill.name.trim() : "",
        years: SKILL_EXPERIENCE_VALUES.has(skill.years as RequiredSkillRequirement["years"])
          ? (skill.years as RequiredSkillRequirement["years"])
          : "any",
      }))
      .filter((skill) => skill.name);
    if (structured.length > 0) return structured;
  }

  return Array.isArray(legacySkillTags)
    ? legacySkillTags
        .filter((skill): skill is string => typeof skill === "string" && Boolean(skill.trim()))
        .map((name) => ({ name: name.trim(), years: "any" as const }))
    : [];
}

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
  company: "",
  location: "",
  professionalRoleName: "",
  originalRoleName: "",
  jobFunction: "",
  category: "",
  engagementType: "",
  experienceLevel: "entry",
  minimumEducation: "",
  requiredSkills: [] as RequiredSkillRequirement[],
  requiresUsTimezoneOverlap: false,
  requiresFluentEnglish: false,
  compensationDisplayType: "range",
  contractorEngagementConfirmed: false,
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
  // Preferred qualifications (rich text)
  preferredQualifications: "",
  // Compensation extras
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
  // Resume requirement
  requiresResume: false,
  // Require video introduction from applicants
  requiresVideoIntro: false,
  // Company visibility
  isCompanyConfidential: false,
  confidentialClientOverview: "",
  // Benefits / HMO
  benefits: "",
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
  const requiredSkills = normalizeRequiredSkills(
    (job as any).requiredSkills,
    (job as any).skillTags,
  );

  return {
    title: job.title || "",
    company: job.company || "",
    location: job.location || "",
    professionalRoleName: (job as any).professionalRoleName || job.title || "",
    originalRoleName: (job as any).originalRoleName || "",
    jobFunction: (job as any).jobFunction || job.category || "",
    category: job.category || "",
    engagementType: (job as any).engagementType || "",
    experienceLevel: job.experienceLevel || "entry",
    minimumEducation: (job as any).minimumEducation || "",
    requiredSkills,
    requiresUsTimezoneOverlap: (job as any).requiresUsTimezoneOverlap ?? false,
    requiresFluentEnglish: (job as any).requiresFluentEnglish ?? false,
    compensationDisplayType: (job as any).compensationDisplayType || "range",
    contractorEngagementConfirmed: (job as any).contractorEngagementConfirmed ?? false,
    jobSummary: (job as any).jobSummary || "",
    description: job.description || "",
    salaryDisplay: (job as any).salaryDisplay || "",
    duration: job.duration || "",
    status: job.status || "open",
    responsibilities: toQuillHtml(job.responsibilities as string[]),
    requirements: toQuillHtml(job.requirements as string[]),
    skillTags: requiredSkills.length > 0
      ? requiredSkills.map((skill) => skill.name).join(", ")
      : Array.isArray(job.skillTags)
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
    // Preferred qualifications
    preferredQualifications: (job as any).preferredQualifications || "",
    // Compensation extras
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
    // Resume requirement
    requiresResume: (job as any).requiresResume ?? false,
    // Require video introduction from applicants
    requiresVideoIntro: (job as any).requiresVideoIntro ?? false,
    // Company visibility
    isCompanyConfidential: (job as any).isCompanyConfidential ?? false,
    confidentialClientOverview: (job as any).confidentialClientOverview || "",
    // Benefits / HMO
    benefits: (job as any).benefits || "",
    // Additional compensation benefits
    hasCommission: (job as any).hasCommission ?? false,
    hasEquity: (job as any).hasEquity ?? false,
    // Currency
    currency: (job as any).budgetCurrency || "PHP",
    customCurrencyCode: (job as any).customCurrencyCode || "",
  };
}
