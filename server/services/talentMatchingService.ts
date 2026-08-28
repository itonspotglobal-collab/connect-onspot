import type { Candidate, Job, Profile } from "@shared/schema";

export type TalentMatchingJob = Partial<Job> & {
  skills?: string[];
  requiredSkills?: Array<{ name?: string; years?: string } | string> | null;
  preferredSkills?: string[] | null;
};

export type TalentMatchingProfile = Partial<Profile> & Record<string, unknown>;

export type TalentMatchInput = {
  candidate: Candidate | Record<string, any>;
  profile?: TalentMatchingProfile | null;
  userSkills?: string[];
  userId?: string;
};

export type TalentMatchComponents = {
  skills: number;
  experience: number;
  role: number;
  semantic: number;
  interests: number;
  preferred: number;
  availability?: number;
};

export type TalentMatchResult = {
  score: number;
  matchTier: "excellent" | "strong" | "moderate" | "weak" | "low";
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  aiReason?: string;
  componentScores: TalentMatchComponents;
  overlapSkills: string[];
  matchReasons: Record<string, any>;
};

export type VanessaSemanticResult = {
  semanticScore: number;
  roleAlignment?: number;
  domainAlignment?: number;
  reasons?: string[];
};

export type TalentMatchWithIdentity = TalentMatchResult & {
  candidateId: string;
  userId: string;
  candidate: Record<string, any>;
};

const STOP_WORDS = new Set(
  [
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
    "have", "in", "is", "it", "job", "level", "of", "on", "or", "role",
    "the", "their", "to", "with", "work", "working", "years", "year",
    "looking", "seeking", "strong", "experience", "experienced", "using",
  ],
);

const SKILL_ALIASES: Record<string, string> = {
  "react js": "react",
  "reactjs": "react",
  "node js": "node",
  "nodejs": "node",
  "office 365": "microsoft 365",
  "ms 365": "microsoft 365",
  "microsoft365": "microsoft 365",
  "customer service": "customer support",
  "customer care": "customer support",
  "systems administration": "system administrator",
  "systems administrator": "system administrator",
  "system administration": "system administrator",
  "it administrator": "it administrator",
  "information technology": "it",
  "quality assurance": "qa",
  "search engine optimization": "seo",
  "postgres": "postgresql",
  "amazon web services": "aws",
  "google workspace": "google workspace",
  "g suite": "google workspace",
};

const ROLE_ALIASES: Array<[RegExp, string[]]> = [
  [/it administrator|system administrator|systems administrator|it infrastructure/i, ["it", "administrator"]],
  [/it support|technical support|help ?desk|network support/i, ["it", "support"]],
  [/react developer|frontend developer|front end developer/i, ["developer", "react"]],
  [/software developer|software engineer|full stack|fullstack/i, ["developer", "software"]],
  [/customer service|customer support|customer success/i, ["customer", "support"]],
  [/bookkeeper|accounting|accounts payable|accounts receivable/i, ["accounting", "finance"]],
  [/virtual assistant|administrative assistant/i, ["assistant", "administration"]],
  [/marketing|social media|content strategist/i, ["marketing"]],
];

const aiCache = new Map<string, VanessaSemanticResult>();
const MAX_AI_CACHE = 1000;

function clamp(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, parsed));
}

function clean(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/node\.js/g, "node js")
    .replace(/react\.js/g, "react js")
    .replace(/c\+\+/g, "cpp")
    .replace(/c#/g, "csharp")
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalSkill(value: unknown, context = ""): string {
  let result = clean(value).replace(/\./g, "");
  result = SKILL_ALIASES[result] ?? result;
  // "AD" is ambiguous outside an IT context. Only expand it when nearby
  // evidence confirms that the candidate/job means Active Directory.
  if (result === "ad") {
    const contextText = clean(context);
    if (/(active directory|windows|microsoft|server|network|it support)/.test(contextText)) {
      return "active directory";
    }
  }
  if (result.endsWith("s") && result.length > 4 && !result.endsWith("ss")) {
    result = result.slice(0, -1);
  }
  return result;
}

function skillMatches(left: unknown, right: unknown, context = ""): boolean {
  const a = canonicalSkill(left, context);
  const b = canonicalSkill(right, context);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a === "active directory" && b === "ad") return /active directory|windows|microsoft|server|network|it support/i.test(context);
  if (b === "active directory" && a === "ad") return /active directory|windows|microsoft|server|network|it support/i.test(context);
  // Only allow containment for multi-word phrases or an explicitly known
  // technology alias; this avoids "ad" matching unrelated profile text.
  return (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a)));
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") return item.trim() ? [item.trim()] : [];
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return strings(record.name ?? record.title ?? record.jobTitle ?? record.role);
      }
      return [];
    });
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function normalizedCandidate(value: TalentMatchInput["candidate"]): Record<string, any> {
  const candidate = value as Record<string, any>;
  return {
    ...candidate,
    id: candidate.id,
    fullName: candidate.fullName ?? candidate.full_name,
    targetPosition: candidate.targetPosition ?? candidate.target_position,
    coreSkills: candidate.coreSkills ?? candidate.core_skills,
    secondarySkills: candidate.secondarySkills ?? candidate.secondary_skills,
    experienceYears: candidate.experienceYears ?? candidate.experience_years,
    workHistory: candidate.workHistory ?? candidate.work_history,
    moreAboutMe: candidate.moreAboutMe ?? candidate.more_about_me,
    preferredRoles: candidate.preferredRoles ?? candidate.preferred_roles,
    profilePhotoUrl: candidate.profilePhotoUrl ?? candidate.profile_photo_url,
    isVetted: candidate.isVetted ?? candidate.is_vetted,
    isVerified: candidate.isVerified ?? candidate.is_verified,
    createdAt: candidate.createdAt ?? candidate.created_at,
    updatedAt: candidate.updatedAt ?? candidate.updated_at,
  };
}

function jsonText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(jsonText).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(jsonText).filter(Boolean).join(" ");
  }
  return String(value);
}

function tokens(value: unknown): Set<string> {
  return new Set(
    clean(jsonText(value))
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9+#]/g, ""))
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  );
}

function jaccard(left: unknown, right: unknown): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of Array.from(a)) if (b.has(token)) intersection++;
  return intersection / new Set([...Array.from(a), ...Array.from(b)]).size;
}

function roleSimilarity(jobTitle: string, candidateRole: string): number {
  const job = clean(jobTitle);
  const candidate = clean(candidateRole);
  if (!job || !candidate) return 0;
  if (job === candidate || candidate.includes(job) || job.includes(candidate)) return 100;
  for (const [pattern, concepts] of ROLE_ALIASES) {
    if (pattern.test(job) && pattern.test(candidate)) return 90;
    const jobHasConcept = concepts.some((concept) => job.includes(concept));
    const candidateHasConcept = concepts.some((concept) => candidate.includes(concept));
    if (jobHasConcept && candidateHasConcept) return 70;
  }
  return Math.round(jaccard(job, candidate) * 100);
}

function parseYears(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function levelScore(job: TalentMatchingJob, candidate: Record<string, any>, history: string): number {
  const years = parseYears(candidate.experienceYears ?? candidate.experience_years);
  const jobLevel = clean(job.experienceLevel ?? job.jobLevel);
  const seniority = clean(candidate.seniority);
  let target = jobLevel.includes("entry") || jobLevel.includes("junior") ? 1
    : jobLevel.includes("senior") || jobLevel.includes("expert") || jobLevel.includes("lead") ? 3
      : 2;
  const actual = years == null
    ? (seniority.includes("entry") || seniority.includes("junior") ? 1
      : seniority.includes("senior") || seniority.includes("lead") ? 3 : seniority ? 2 : null)
    : years < 2 ? 1 : years < 5 ? 2 : 3;
  const yearsFit = actual == null ? 0 : Math.max(0, 100 - Math.abs(actual - target) * 35);
  const titleFit = roleSimilarity(String(job.title ?? ""), history);
  if (years == null && !history) return 0;
  if (years == null) return Math.round(titleFit * 0.8);
  return Math.round(yearsFit * 0.55 + titleFit * 0.45);
}

function requiredAndPreferredSkills(job: TalentMatchingJob): { required: string[]; preferred: string[] } {
  const structuredRequired = strings(job.requiredSkills);
  const tags = strings(job.skills ?? job.skillTags);
  const required = structuredRequired.length > 0 ? structuredRequired : tags;
  const preferred = structuredRequired.length > 0
    ? (job.preferredSkills ?? tags).filter((skill) => !required.some((item) => skillMatches(item, skill, jsonText(job))))
    : [];
  return {
    required: Array.from(new Set(required.map((value) => value.trim()).filter(Boolean))),
    preferred: Array.from(new Set(strings(preferred).filter(Boolean))),
  };
}

function candidateInterests(candidate: Record<string, any>): string[] {
  candidate = normalizedCandidate(candidate);
  const preferences = candidate.preferences && typeof candidate.preferences === "object"
    ? candidate.preferences as Record<string, unknown>
    : {};
  return [
    ...strings(candidate.targetPosition),
    ...strings(candidate.preferredRoles ?? candidate.preferred_roles),
    ...strings(preferences.desiredRoles ?? preferences.preferredRoles ?? preferences.targetPosition),
    ...strings(preferences.careerGoals ?? preferences.interests),
  ];
}

function candidateHistory(candidate: Record<string, any>): Array<Record<string, any>> {
  const value = normalizedCandidate(candidate).workHistory;
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function jobCorpus(job: TalentMatchingJob): string {
  return [
    job.title,
    job.professionalRoleName,
    job.description,
    job.roleMission,
    job.jobSummary,
    job.responsibilities,
    job.requirements,
    job.requiredSkills,
    job.skillTags,
    job.preferredQualifications,
    job.requiredToolsSoftware,
    job.category,
    job.jobFunction,
    job.otherFunction,
  ].map(jsonText).filter(Boolean).join(" ");
}

function candidateCorpus(input: TalentMatchInput): string {
  const candidate = normalizedCandidate(input.candidate);
  const profile = input.profile ?? {};
  return [
    candidate.targetPosition,
    candidate.headline,
    candidate.summary,
    candidate.moreAboutMe,
    candidate.category,
    candidate.coreSkills,
    candidate.secondarySkills,
    candidate.workHistory,
    candidate.education,
    candidate.certifications,
    candidate.preferences,
    input.userSkills,
    profile.title,
    profile.bio,
  ].map(jsonText).filter(Boolean).join(" ");
}

function tier(score: number): TalentMatchResult["matchTier"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "strong";
  if (score >= 50) return "moderate";
  if (score >= 30) return "weak";
  return "low";
}

export function matchTalentToJob(job: TalentMatchingJob, input: TalentMatchInput): TalentMatchResult {
  const candidate = normalizedCandidate(input.candidate);
  const context = `${jobCorpus(job)} ${candidateCorpus(input)}`;
  const { required, preferred } = requiredAndPreferredSkills(job);
  const candidateSkills = Array.from(new Set([
    ...strings(candidate.coreSkills ?? candidate.core_skills),
    ...strings(candidate.secondarySkills ?? candidate.secondary_skills),
    ...strings(input.userSkills),
  ]));

  const matchedRequired = required.filter((jobSkill) => candidateSkills.some((candidateSkill) => skillMatches(jobSkill, candidateSkill, context)));
  const matchedPreferred = preferred.filter((jobSkill) => candidateSkills.some((candidateSkill) => skillMatches(jobSkill, candidateSkill, context)));
  const matchedSkills = Array.from(new Set([...matchedRequired, ...matchedPreferred]));
  const missingSkills = required.filter((jobSkill) => !matchedRequired.includes(jobSkill));
  const skills = required.length === 0
    ? 0
    : Math.round((matchedRequired.length / required.length) * 100);

  const history = candidateHistory(candidate);
  const historyTitles = history.map((item) => String(item.jobTitle ?? item.title ?? item.role ?? ""));
  const historyText = history.map((item) => jsonText(item)).join(" ");
  const roleCandidates = [
    candidate.targetPosition,
    candidate.headline,
    ...historyTitles,
  ].filter(Boolean).map(String);
  const role = roleCandidates.length > 0
    ? Math.max(...roleCandidates.map((value) => roleSimilarity(String(job.title ?? job.professionalRoleName ?? ""), value)))
    : 0;
  const experience = levelScore(job, candidate, historyTitles.join(" "));
  const semantic = Math.round(jaccard(jobCorpus(job), candidateCorpus(input)) * 100);
  const interests = candidateInterests(candidate);
  const interestScore = interests.length > 0
    ? Math.max(...interests.map((value) => roleSimilarity(String(job.title ?? ""), value)))
    : 0;
  const preferredScore = preferred.length === 0
    ? 0
    : Math.round((matchedPreferred.length / preferred.length) * 100);

  const languages = strings(candidate.languages ?? input.profile?.languages).join(" ").toLowerCase();
  const timezone = String(candidate.timezone ?? input.profile?.timezone ?? "").toLowerCase();
  const availabilityText = `${candidate.availability ?? ""} ${input.profile?.availability ?? ""}`.toLowerCase();
  let availability: number | undefined;
  let hardPenalty = 0;
  if (job.requiresFluentEnglish) {
    availability = languages.includes("english") ? 100 : languages ? 0 : 50;
    if (availability === 0) hardPenalty += 15;
  }
  if (job.requiresUsTimezoneOverlap) {
    const timezoneFit = /america|eastern|central|mountain|pacific|us\/|new york|chicago|denver|los angeles/.test(timezone);
    availability = Math.min(availability ?? 100, timezoneFit ? 100 : timezone ? 0 : 50);
    if (!timezoneFit && timezone) hardPenalty += 15;
  }
  if (availabilityText.includes("unavailable") || availabilityText.includes("offline")) hardPenalty += 10;

  const componentScores: TalentMatchComponents = {
    skills,
    experience,
    role,
    semantic,
    interests: interestScore,
    preferred: preferredScore,
    ...(availability !== undefined ? { availability } : {}),
  };
  const rawScore =
    skills * 0.35 +
    experience * 0.20 +
    role * 0.15 +
    semantic * 0.15 +
    interestScore * 0.10 +
    preferredScore * 0.05 -
    hardPenalty;
  const score = Math.round(clamp(rawScore));
  const reasons: string[] = [];

  if (required.length > 0 && matchedRequired.length > 0) {
    reasons.push(`${matchedRequired.length} of ${required.length} core skills matched`);
  }
  if (experience >= 65) reasons.push("Relevant experience aligns with this role");
  if (role >= 70) reasons.push("Target role and previous titles align");
  if (interestScore >= 70) reasons.push("Preferred career direction is closely related");
  if (semantic >= 35) reasons.push("Profile context matches the job responsibilities");
  if (hardPenalty > 0) reasons.push("Some stated availability requirements were not confirmed");
  if (reasons.length === 0) reasons.push("Limited profile information");

  const matchReasons = {
    skillOverlap: matchedSkills,
    engagementMatch: false,
    rateMatch: false,
    rateRatio: null,
    timezoneMatch: availability === 100 ? "exact" : "none",
    categoryMatch: Boolean(job.category && candidate.category && clean(job.category) === clean(candidate.category)),
    experienceMatch: experience >= 65,
    factors: reasons,
    missingSkills,
    componentScores,
    matchTier: tier(score),
    historyEvidence: historyText ? true : false,
  };

  return {
    score,
    matchTier: tier(score),
    matchedSkills,
    missingSkills,
    reasons,
    componentScores,
    overlapSkills: matchedSkills,
    matchReasons,
  };
}

function aiCacheKey(job: TalentMatchingJob, input: TalentMatchInput): string {
  const candidate = normalizedCandidate(input.candidate);
  const profile = input.profile ?? {};
  return [
    job.id ?? "virtual",
    job.updatedAt instanceof Date ? job.updatedAt.toISOString() : String(job.updatedAt ?? ""),
    candidate.id ?? input.userId ?? "candidate",
    candidate.updatedAt instanceof Date ? candidate.updatedAt.toISOString() : String(candidate.updatedAt ?? ""),
    JSON.stringify({
      title: job.title,
      skills: job.skills ?? job.skillTags,
      role: candidate.targetPosition,
      summary: candidate.summary,
      coreSkills: candidate.coreSkills,
      history: candidate.workHistory,
      profileTitle: profile.title,
      profileBio: profile.bio,
      profileTimezone: profile.timezone,
      profileLanguages: profile.languages,
      profileUpdatedAt: profile.updatedAt ?? profile.updated_at,
    }),
  ].join(":");
}

async function defaultSemanticReranker(
  job: TalentMatchingJob,
  input: TalentMatchInput,
  timeoutMs: number,
): Promise<VanessaSemanticResult> {
  const candidate = normalizedCandidate(input.candidate);
  const task = (async () => {
    const module = await import("./openaiService.js");
    if (!module.matchTalentSemantically) throw new Error("Vanessa semantic matcher is unavailable");
    return module.matchTalentSemantically({
      job: {
        title: job.title,
        description: job.description,
        responsibilities: job.responsibilities,
        requirements: job.requirements,
        skills: job.skills ?? job.skillTags,
        category: job.category,
      },
      talent: {
        role: candidate.targetPosition,
        headline: candidate.headline,
        summary: candidate.summary,
        skills: [...strings(candidate.coreSkills), ...strings(candidate.secondarySkills), ...strings(input.userSkills)],
        experience: candidate.workHistory,
        interests: candidateInterests(candidate),
      },
    });
  })();
  return Promise.race([
    task,
    new Promise<VanessaSemanticResult>((_, reject) => setTimeout(() => reject(new Error("Vanessa matching timed out")), timeoutMs)),
  ]);
}

export async function enrichTalentMatchesWithVanessa<T extends TalentMatchWithIdentity>(
  job: TalentMatchingJob,
  matches: T[],
  inputs: Map<string, TalentMatchInput>,
  options: {
    enabled?: boolean;
    shortlistSize?: number;
    concurrency?: number;
    timeoutMs?: number;
    reranker?: (job: TalentMatchingJob, input: TalentMatchInput, timeoutMs: number) => Promise<VanessaSemanticResult>;
  } = {},
): Promise<T[]> {
  const enabled = options.enabled ?? (
    process.env.ENABLE_TALENT_MATCH_AI === "true" ||
    (process.env.NODE_ENV === "production" && Boolean(process.env.OPENAI_API_KEY))
  );
  if (!enabled || matches.length === 0) return matches;

  const compareMatches = (left: T, right: T) =>
    right.score - left.score || left.candidateId.localeCompare(right.candidateId);
  // The AI pool must be chosen after deterministic scoring, never from
  // database insertion order. Vanessa enriches the strongest evidence-backed
  // candidates; it does not decide which candidates are eligible for review.
  matches.sort(compareMatches);
  const shortlist = matches.slice(0, options.shortlistSize ?? 25);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, shortlist.length));
  const timeoutMs = options.timeoutMs ?? 4000;
  const reranker = options.reranker ?? defaultSemanticReranker;
  let cursor = 0;

  const worker = async () => {
    while (cursor < shortlist.length) {
      const index = cursor++;
      const match = shortlist[index];
      const input = inputs.get(match.userId) ?? inputs.get(match.candidateId);
      if (!input) continue;
      try {
        const key = aiCacheKey(job, input);
        let ai = aiCache.get(key);
        if (!ai) {
          ai = await reranker(job, input, timeoutMs);
          ai = {
            semanticScore: clamp(ai.semanticScore),
            roleAlignment: clamp(ai.roleAlignment, 0),
            domainAlignment: clamp(ai.domainAlignment, 0),
            reasons: Array.isArray(ai.reasons) ? ai.reasons.filter((reason) => typeof reason === "string").slice(0, 3) : [],
          };
          if (aiCache.size >= MAX_AI_CACHE) aiCache.delete(aiCache.keys().next().value as string);
          aiCache.set(key, ai);
        }
        const aiSignal = (
          ai.semanticScore * 0.6 +
          (ai.roleAlignment ?? ai.semanticScore) * 0.25 +
          (ai.domainAlignment ?? ai.semanticScore) * 0.15
        );
        const score = Math.round(match.score * 0.75 + clamp(aiSignal) * 0.25);
        match.score = score;
        match.matchTier = tier(score);
        match.componentScores.semantic = Math.round((match.componentScores.semantic * 0.5) + (ai.semanticScore * 0.5));
        match.matchReasons = {
          ...match.matchReasons,
          componentScores: match.componentScores,
          matchTier: match.matchTier,
          aiReason: ai.reasons?.[0],
        };
        match.aiReason = ai.reasons?.[0];
        if (ai.reasons?.length) match.reasons = Array.from(new Set([...match.reasons, ...ai.reasons])).slice(0, 5);
      } catch {
        // Deterministic score remains the authoritative fallback.
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  return matches.sort(compareMatches);
}