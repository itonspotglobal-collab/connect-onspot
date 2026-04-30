// ─── User Activity Memory ─────────────────────────────────────────────────────
// Tracks visitor interactions in localStorage to build a lightweight interest
// profile used for job/talent recommendations. No login required.
// Falls back silently if localStorage is unavailable (SSR, private mode, etc.).

const STORAGE_KEY = "userActivityMemory";
const MAX_ACTIVITIES = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityType =
  | "JobSearch"
  | "TalentSearch"
  | "JobClick"
  | "JobView"
  | "TalentView"
  | "ArticleView"
  | "CategoryClick"
  | "FilterClick"
  | "SavedJob"
  | "AppliedJob";

export interface UserActivity {
  activityType: ActivityType;
  keyword?: string;
  title?: string;
  category?: string;
  tags?: string[];
  skills?: string[];
  referenceId?: string | number;
  page?: string;
  createdAt: string;
}

// ─── Weights ──────────────────────────────────────────────────────────────────

const ACTIVITY_WEIGHTS: Record<ActivityType, number> = {
  JobSearch: 5,
  TalentSearch: 5,
  JobClick: 4,
  JobView: 4,
  TalentView: 4,
  ArticleView: 2,
  CategoryClick: 3,
  FilterClick: 3,
  SavedJob: 7,
  AppliedJob: 8,
};

// ─── Recency ──────────────────────────────────────────────────────────────────

function getRecencyMultiplier(createdAt: string): number {
  try {
    const created = new Date(createdAt).getTime();
    if (!created) return 0.5;
    const ageMs = Date.now() - created;
    const oneDay = 24 * 60 * 60 * 1000;
    if (ageMs <= oneDay) return 1;
    if (ageMs <= 7 * oneDay) return 0.75;
    return 0.5;
  } catch {
    return 0.5;
  }
}

// ─── Normalise ────────────────────────────────────────────────────────────────

function normalizeTerm(term: unknown): string {
  if (!term || typeof term !== "string") return "";
  return term.trim().toLowerCase();
}

function extractTerms(activity: UserActivity): string[] {
  const raw: unknown[] = [
    activity.keyword,
    activity.title,
    activity.category,
    ...(Array.isArray(activity.tags) ? activity.tags : []),
    ...(Array.isArray(activity.skills) ? activity.skills : []),
  ];
  return [...new Set(raw.map(normalizeTerm).filter(Boolean))];
}

// ─── Core CRUD ────────────────────────────────────────────────────────────────

export function getUserActivities(): UserActivity[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserActivity(activity: Omit<UserActivity, "createdAt"> & { createdAt?: string }): void {
  try {
    if (typeof window === "undefined") return;

    const activities = getUserActivities();
    const newActivity: UserActivity = {
      ...activity,
      createdAt: activity.createdAt ?? new Date().toISOString(),
    };

    // Deduplicate: skip if same type + same reference or keyword within 1 minute
    const isDuplicate = activities.some((existing) => {
      if (existing.activityType !== newActivity.activityType) return false;
      const sameRef =
        existing.referenceId != null &&
        newActivity.referenceId != null &&
        String(existing.referenceId) === String(newActivity.referenceId);
      const sameKw =
        existing.keyword &&
        newActivity.keyword &&
        normalizeTerm(existing.keyword) === normalizeTerm(newActivity.keyword);
      const withinMinute =
        Math.abs(
          new Date(existing.createdAt).getTime() -
            new Date(newActivity.createdAt).getTime(),
        ) < 60_000;
      return withinMinute && (sameRef || sameKw);
    });

    if (isDuplicate) return;

    const updated = [newActivity, ...activities].slice(0, MAX_ACTIVITIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("userActivityMemory: unable to save", err);
  }
}

export function clearUserActivities(): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("userActivityMemory: unable to clear", err);
  }
}

// ─── Interest Profile ─────────────────────────────────────────────────────────

export interface InterestEntry {
  term: string;
  score: number;
}

export function getUserInterestProfile(): InterestEntry[] {
  const activities = getUserActivities();
  const profile: Record<string, number> = {};

  for (const activity of activities) {
    const weight = ACTIVITY_WEIGHTS[activity.activityType] ?? 1;
    const recency = getRecencyMultiplier(activity.createdAt);
    const score = weight * recency;
    for (const term of extractTerms(activity)) {
      profile[term] = (profile[term] ?? 0) + score;
    }
  }

  return Object.entries(profile)
    .sort((a, b) => b[1] - a[1])
    .map(([term, score]) => ({ term, score }));
}

export function getTopUserInterests(limit = 5): string[] {
  return getUserInterestProfile()
    .slice(0, limit)
    .map((e) => e.term);
}

export function getRecommendedSearchTerms(limit = 3): string {
  return getTopUserInterests(limit).join(" ");
}

// ─── Job Recommendation Scoring ───────────────────────────────────────────────
// Scores a job against the stored interest profile without touching the
// FindBestMatches flow. Higher = better match.

export interface ScoredJob {
  id: string;
  score: number;
}

export function scoreJobsAgainstInterests<
  T extends {
    id: string;
    title?: string | null;
    category?: string | null;
    description?: string | null;
    skillTags?: string[] | null;
  },
>(jobs: T[], topN = 5): T[] {
  const interests = getTopUserInterests(topN);
  if (interests.length === 0) return [];

  const scored = jobs
    .map((job) => {
      const haystack = [
        job.title ?? "",
        job.category ?? "",
        job.description ?? "",
        ...(job.skillTags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      const score = interests.reduce((acc, term) => {
        return acc + (haystack.includes(term) ? 1 : 0);
      }, 0);

      return { job, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ job }) => job);
}
