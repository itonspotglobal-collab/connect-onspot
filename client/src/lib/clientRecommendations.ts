import type { Candidate } from "@shared/schema";

interface ClientProfile {
  companyName?: string | null;
  industry?: string | null;
  about?: string | null;
  hiringNeeds?: string | null;
  preferredRoles?: string[] | null;
}

interface JobPost {
  title?: string | null;
  category?: string | null;
  description?: string | null;
  skillTags?: string[] | null;
  requirements?: string[] | null;
  responsibilities?: string[] | null;
  roleMission?: string | null;
  skillsAndCompetencies?: string | null;
}

const GENERIC_TERMS = new Set([
  "hiring", "looking", "company", "team", "work", "responsible",
  "passionate", "motivated", "excellent", "good", "great", "strong",
  "communication", "experience", "experienced", "seeking", "join",
  "ability", "professional", "our", "the", "and", "for", "with",
  "that", "will", "are", "you", "must", "have", "from", "this",
  "responsibilities", "requirements", "role", "position", "candidate",
  "skills", "knowledge", "including", "related", "working", "able",
  "preferred", "ideally", "basic", "general",
]);

export interface ClientRecProfile {
  keywords: string[];
  hasEnoughData: boolean;
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s,;/|•\-–—]+/)
    .map((t) => t.replace(/[^a-zA-Z0-9+#.]/g, "").trim())
    .filter((t) => t.length > 2 && !GENERIC_TERMS.has(t.toLowerCase()));
}

export function buildClientRecProfile(
  clientProfile: ClientProfile | null | undefined,
  jobs: JobPost[],
): ClientRecProfile {
  const terms = new Map<string, number>(); // term → weight (higher = more important)

  function add(term: string, weight: number) {
    const key = term.trim().toLowerCase();
    if (!key || key.length < 2 || GENERIC_TERMS.has(key)) return;
    terms.set(term.trim(), (terms.get(term.trim()) ?? 0) + weight);
  }

  // ── Job postings (highest signal) ─────────────────────────────────────────
  for (const job of jobs) {
    if (job.title?.trim()) add(job.title.trim(), 10);
    if (job.category?.trim()) add(job.category.trim(), 8);

    (job.skillTags ?? []).forEach((s) => { if (s?.trim()) add(s.trim(), 8); });

    tokenize(job.requirements?.join(" ") ?? "").forEach((t) => add(t, 5));
    tokenize(job.skillsAndCompetencies ?? "").forEach((t) => add(t, 5));
    tokenize(job.roleMission ?? "").forEach((t) => add(t, 4));
    tokenize(job.responsibilities?.join(" ") ?? "").forEach((t) => add(t, 3));
    tokenize(job.description ?? "").forEach((t) => add(t, 2));
  }

  // ── Client profile (medium signal) ────────────────────────────────────────
  if (clientProfile?.industry?.trim()) add(clientProfile.industry.trim(), 6);
  (clientProfile?.preferredRoles ?? []).forEach((r) => { if (r?.trim()) add(r.trim(), 5); });
  tokenize(clientProfile?.hiringNeeds ?? "").forEach((t) => add(t, 4));
  tokenize(clientProfile?.about ?? "").forEach((t) => add(t, 2));

  // Sort by weight descending, take top 25 most relevant terms
  const keywords = Array.from(terms.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
    .slice(0, 25);

  return {
    keywords,
    hasEnoughData: keywords.length >= 1,
  };
}

interface WorkEntry {
  jobTitle?: string;
  title?: string;
  position?: string;
  responsibilities?: string;
  company?: string;
}

export function scoreTalentForClient(
  candidate: Candidate,
  keywords: string[],
): { score: number; matchedSkills: string[] } {
  if (keywords.length === 0) return { score: 0, matchedSkills: [] };

  const titleLower = (candidate.targetPosition ?? candidate.headline ?? "").toLowerCase();
  const catLower = (candidate.category ?? "").toLowerCase();
  const summaryLower = (candidate.summary ?? "").toLowerCase();
  const allSkills = [...(candidate.coreSkills ?? []), ...(candidate.secondarySkills ?? [])];
  const skillsLower = allSkills.map((s) => s.toLowerCase());
  const workHistory = (candidate.workHistory ?? []) as WorkEntry[];
  const workTitles = workHistory
    .map((e) => (e?.jobTitle || e?.title || e?.position || "").toLowerCase())
    .filter(Boolean);
  const workResponsibilities = workHistory
    .map((e) => (e?.responsibilities ?? "").toLowerCase())
    .join(" ");

  const portfolioLinks = [
    candidate.linkedinUrl ?? "",
    candidate.githubUrl ?? "",
    candidate.portfolioUrl ?? "",
  ].join(" ").toLowerCase();

  let score = 0;
  const matchedSkillSet = new Set<string>();

  for (const kw of keywords) {
    if (!kw?.trim()) continue;
    const kwLower = kw.toLowerCase();

    // Title match — highest weight
    if (titleLower === kwLower) {
      score += 9;
    } else if (titleLower.includes(kwLower)) {
      score += 6;
    }

    // Skills match — very high weight
    for (let i = 0; i < skillsLower.length; i++) {
      if (skillsLower[i].includes(kwLower) || kwLower.includes(skillsLower[i])) {
        score += 6;
        matchedSkillSet.add(allSkills[i]);
      }
    }

    // Work history title match — high weight
    if (workTitles.some((t) => t.includes(kwLower))) score += 5;

    // Category match — medium-high weight
    if (catLower.includes(kwLower)) score += 4;

    // Portfolio/project tags — medium weight
    if (portfolioLinks.includes(kwLower)) score += 3;

    // Summary/bio — low weight
    if (summaryLower.includes(kwLower)) score += 2;

    // Work responsibilities — low weight
    if (workResponsibilities.includes(kwLower)) score += 2;
  }

  return {
    score,
    matchedSkills: Array.from(matchedSkillSet).slice(0, 4),
  };
}
