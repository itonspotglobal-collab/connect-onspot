import type { Candidate, Job } from "@shared/schema";

interface WorkEntry {
  title?: string;
  jobTitle?: string;
  position?: string;
}

const GENERIC_TERMS = new Set([
  "hardworking", "motivated", "passionate", "team player", "detail-oriented",
  "self-starter", "results-driven", "proactive", "dedicated", "organized",
  "reliable", "flexible", "excellent", "strong", "ability", "professional",
  "experienced", "seeking", "looking", "work", "job", "role",
]);

export interface TalentRecProfile {
  keywords: string[];
  hasEnoughData: boolean;
}

export function buildTalentRecProfile(candidate: Candidate): TalentRecProfile {
  const terms = new Set<string>();

  if (candidate.targetPosition?.trim()) terms.add(candidate.targetPosition.trim());
  if (candidate.headline?.trim()) terms.add(candidate.headline.trim());
  if (candidate.category?.trim()) terms.add(candidate.category.trim());

  (candidate.coreSkills ?? []).forEach((s) => { if (s?.trim()) terms.add(s.trim()); });
  (candidate.secondarySkills ?? []).forEach((s) => { if (s?.trim()) terms.add(s.trim()); });

  const history = (candidate.workHistory ?? []) as WorkEntry[];
  history.forEach((entry) => {
    const t = entry?.title || entry?.jobTitle || entry?.position;
    if (t?.trim()) terms.add(t.trim());
  });

  const keywords = Array.from(terms)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !GENERIC_TERMS.has(t.toLowerCase()))
    .slice(0, 20);

  return { keywords, hasEnoughData: keywords.length >= 1 };
}

export function scoreJobForTalent(job: Job, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  const titleLower = (job.title ?? "").toLowerCase();
  const catLower = (job.category ?? "").toLowerCase();
  const descLower = ((job as any).jobSummary?.trim() || (job.description ?? "")).toLowerCase();
  const jobSkills = (job.skillTags ?? []).map((s) => s.toLowerCase());

  let score = 0;
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    if (!kwLower) continue;
    if (titleLower === kwLower) { score += 8; continue; }
    if (titleLower.includes(kwLower)) score += 5;
    if (catLower.includes(kwLower)) score += 4;
    if (jobSkills.some((s) => s.includes(kwLower) || kwLower.includes(s))) score += 4;
    if (descLower.includes(kwLower)) score += 2;
  }
  return score;
}
