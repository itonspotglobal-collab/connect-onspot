import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import {
  Search,
  Filter,
  ArrowLeft,
  ArrowRight,
  DollarSign,
  MapPin,
  BriefcaseBusiness,
  Layers,
  Zap,
  Users,
  SlidersHorizontal,
  X,
  Star,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Job, Candidate } from "@shared/schema";
import {
  buildRateDisplay,
  buildRateDisplayWithCode,
  getJobBadges,
  getTimeAgo,
  sortJobs,
  getPublicCompanyName,
  type SortOption,
} from "@/lib/jobUtils";
import {
  saveUserActivity,
  getTopUserInterests,
  scoreJobsAgainstInterests,
} from "@/lib/userActivityMemory";
import { PILOT_CONFIG, trackPilotActivity } from "@/lib/pilotConfig";
import { getJobPilotId } from "@/lib/pilotFiltering";
import { BenefitsDisplay } from "@/components/BenefitsDisplay";
import {
  loadTalentAuth,
  saveTalentAuth,
  type TalentAuthState,
} from "@/components/TalentLoginModal";
import {
  buildTalentRecProfile,
  scoreJobForTalent,
} from "@/lib/talentRecommendations";
import { JOB_FUNCTIONS, FILTER_CONTRACT_TYPES } from "@/lib/jobConstants";

// POPULAR_CHIPS replaced by dynamic /api/jobs/popular query

const HOT_SEARCHES = [
  "Customer Support",
  "Virtual Assistant",
  "Bookkeeping",
  "Sales",
  "Social Media",
  "Operations",
  "Marketing",
  "Data Entry",
  "Executive Assistant",
  "Finance",
];

// Normalise a category string for fuzzy filter matching only — never alters saved values.
function normalizeCategory(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Maps nav dropdown slug (?category=<slug>) → matching internal DB category values.
// cats: [] means "All Categories" (no filter).
// search: pre-fills the search bar for slugs with no direct DB category match.
const NAV_SLUG_MAP: Record<
  string,
  { label: string; cats: string[]; search?: string }
> = {
  all: { label: "All Jobs", cats: [] },
  development: {
    label: "Development & IT",
    // canonical names + legacy values for old DB records
    cats: ["Engineering", "Information Technology (IT)", "Development", "Tech support"],
  },
  design: { label: "Design & Creative", cats: ["Design (UI/UX)", "Design"] },
  marketing: { label: "Sales & Marketing", cats: ["Marketing", "Sales"] },
  support: {
    label: "Admin & Support",
    cats: ["Customer Success", "Customer Support", "Operations", "Admin", "Customer success"],
  },
  writing: {
    label: "Writing & Translation",
    cats: [],
    search: "writing translation",
  },
};

// Canonical function list imported from shared constants (same list used in the admin form)
const CATEGORIES = ["All Categories", ...JOB_FUNCTIONS];

const LOCATIONS = ["All Locations", "Remote", "Hybrid", "On-site"];

// CONTRACT_TYPES: shared constants (includes legacy values for backward compat with old DB records)
const CONTRACT_TYPES = FILTER_CONTRACT_TYPES.map((o) => o.value);

// PHP salary ranges — only applied when job currency is PHP (or unset)
const SALARY_RANGES = [
  "Any pay",
  "₱30,000+",
  "₱45,000+",
  "₱60,000+",
  "₱85,000+",
  "₱100,000+",
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recently-posted", label: "Recently Posted" },
  { value: "most-applied", label: "Most Applied" },
  { value: "in-demand", label: "In Demand" },
  { value: "urgently-hiring", label: "Urgently Hiring" },
  { value: "top-remote", label: "Top Remote" },
  { value: "featured", label: "Featured" },
];

// ── Role initials avatar ──────────────────────────────────────────────────────
// Returns page numbers + "…" ellipsis placeholders for compact pagination.
// Always shows first + last page; shows a ±2 window around the current page.
function buildPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) {
    pages.add(i);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "for", "to", "with", "at", "by",
  "from", "on", "as", "is", "be", "its",
]);

function getRoleInitials(title: string): string {
  const words = title
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return "JB";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

// ── Badge palette — semi-transparent, designed to sit on the gradient header ──
const BADGE_STYLES: Record<string, string> = {
  urgent:           "bg-red-100/95     text-red-700",
  "top-paying":     "bg-amber-100/95   text-amber-800",
  "multiple-slots": "bg-indigo-100/95  text-indigo-800",
  remote:           "bg-violet-50      text-violet-700",
  hybrid:           "bg-sky-50         text-sky-700",
  onsite:           "bg-slate-100      text-slate-700",
  "full-time":      "bg-emerald-50     text-emerald-700",
  "part-time":      "bg-cyan-100/95    text-cyan-700",
  contract:         "bg-orange-100/95  text-orange-700",
  pilot:            "bg-white/90       text-indigo-700",
  commission:       "bg-emerald-50     text-emerald-700",
  equity:           "bg-purple-50      text-purple-700",
};
const BADGE_DEFAULT = "bg-white/20 text-white";

function JobCard({
  job,
  onNavigate,
}: {
  job: Job;
  onNavigate: (id: string) => void;
}) {
  const [, navigate] = useLocation();
  const featured = (job as any).isFeatured === true;
  const pay = buildRateDisplayWithCode(job);
  const badges = getJobBadges(job);
  const timeAgo = getTimeAgo((job as any).postedAt || job.createdAt);
  const allTags = (job.skillTags ?? []) as string[];
  const visibleTags = allTags.slice(0, 4);
  const extraTags = allTags.length > 4 ? allTags.length - 4 : 0;
  const pilotId = getJobPilotId(job);
  const jobBenefits = ((job as any).benefits as string | null | undefined)?.trim();

  const compensationType = (job as any).compensationType as string | null | undefined;

  // Strip the trailing suffix that buildRateDisplay appends (e.g. /year, /month, /project, /mo)
  // so the card can render salary and compensation type independently.
  const payClean = pay.replace(/\/(year|month|project|mo)\b/g, "").trim();

  // Small badge label rendered below the salary figure (not as plain text)
  const compensationBadgeLabel: string | null =
    compensationType === "annual"  ? "Annual"        :
    compensationType === "monthly" ? "Monthly"       :
    compensationType === "project" ? "Project Based" :
    compensationType === "hourly"  ? "Hourly"        :
    null;

  // Build header badge list: utility badges first, then location, then contract type
  const cardBadges: { key: string; label: string }[] = [];
  for (const b of badges) cardBadges.push({ key: b.key, label: b.label });
  const locLower = (job.location ?? "").toLowerCase();
  if      (locLower.includes("remote"))                                  cardBadges.push({ key: "remote",    label: "Remote"    });
  else if (locLower.includes("hybrid"))                                  cardBadges.push({ key: "hybrid",    label: "Hybrid"    });
  else if (locLower.includes("on-site") || locLower.includes("onsite")) cardBadges.push({ key: "onsite",    label: "Onsite"    });
  const ctNorm = (job.contractType ?? "").toLowerCase().replace(/-/g, "");
  if      (ctNorm === "fulltime") cardBadges.push({ key: "full-time", label: "Full Time" });
  else if (ctNorm === "parttime") cardBadges.push({ key: "part-time", label: "Part Time" });
  else if (ctNorm === "contract") cardBadges.push({ key: "contract",  label: "Contract"  });

  const initials = getRoleInitials((job as any).professionalRoleName || job.title || "");
  const postedLabel = timeAgo === "Just posted" ? "Just posted" : `Posted ${timeAgo}`;
  // Fallback badge class for featured cards (light bg) vs regular (dark gradient)
  const badgeFallback = featured ? "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300" : BADGE_DEFAULT;

  const commissionEquityBadges = (
    ((job as any).hasCommission || (job as any).hasEquity) && (
      <div className="mt-3 flex flex-wrap gap-1.5 sm:justify-end">
        {(job as any).hasCommission && (
          <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-medium ${BADGE_STYLES.commission}`}>
            + Commission
          </span>
        )}
        {(job as any).hasEquity && (
          <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-medium ${BADGE_STYLES.equity}`}>
            + Equity
          </span>
        )}
      </div>
    )
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <article className={
        featured
          ? "overflow-hidden rounded-2xl border border-amber-400/70 bg-gradient-to-br from-[#151108] via-[#241708] to-[#4a2b05] shadow-[0_0_24px_rgba(245,158,11,0.18)] transition-shadow hover:shadow-[0_0_32px_rgba(245,158,11,0.26)]"
          : "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-white/[0.03]"
      }>

        {featured ? (
          /* ── Featured: dark premium header ───────────────────────────────── */
          <div className="relative px-5 py-5 overflow-hidden">
            {/* Decorative Sparkles cluster — right side, desktop only */}
            <Sparkles
              className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 sm:block h-28 w-28 text-amber-400/20"
              aria-hidden="true"
            />
            <Sparkles
              className="pointer-events-none absolute right-14 top-2 hidden sm:block h-10 w-10 text-orange-400/15"
              aria-hidden="true"
            />

            {/* FEATURED badge */}
            <div className="mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-amber-400/30">
                <Star className="h-3 w-3 fill-amber-300" aria-hidden="true" /> Featured
              </span>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              {/* Left: gold avatar + title + company + badges */}
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-bold text-white shadow-md shadow-orange-900/40"
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold leading-snug text-white md:text-lg">
                    {(job as any).professionalRoleName || job.title}
                  </h3>
                  {(job as any).originalRoleName && (
                    <p className="mt-0.5 text-[11px] italic text-amber-200/50 truncate leading-tight">
                      {(job as any).originalRoleName}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-amber-100/60 md:text-sm">
                    {getPublicCompanyName(job as any)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pilotId && (
                      <span className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-medium md:text-[11px] bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/20">
                        Pilot
                      </span>
                    )}
                    {cardBadges.map((b) => (
                      <span key={b.key} className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-medium md:text-[11px] ${BADGE_STYLES[b.key] ?? badgeFallback}`}>
                        {b.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: salary + compensation badge + posted + commission/equity */}
              <div className="shrink-0 sm:text-right">
                <p className="text-lg font-bold text-white md:text-xl">{payClean}</p>
                {compensationBadgeLabel && (
                  <span className="mt-1.5 inline-flex items-center rounded-md bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-400/20">
                    {compensationBadgeLabel}
                  </span>
                )}
                <p className="mt-1 text-xs text-amber-100/50">{postedLabel}</p>
                {commissionEquityBadges}
              </div>
            </div>
          </div>
        ) : (
          /* ── Regular: purple gradient header ──────────────────────────────── */
          <header className="bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] px-5 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              {/* Left: initials avatar + title + company + badges */}
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sm font-semibold text-white ring-1 ring-white/20"
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold leading-snug text-white md:text-lg">
                    {(job as any).professionalRoleName || job.title}
                  </h3>
                  {(job as any).originalRoleName && (
                    <p className="mt-0.5 text-[11px] italic text-white/55 truncate leading-tight">
                      {(job as any).originalRoleName}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-white/75 md:text-sm">
                    {getPublicCompanyName(job as any)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pilotId && (
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-medium md:text-[11px] ${BADGE_STYLES.pilot}`}>
                        Pilot
                      </span>
                    )}
                    {cardBadges.map((b) => (
                      <span key={b.key} className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-medium md:text-[11px] ${BADGE_STYLES[b.key] ?? BADGE_DEFAULT}`}>
                        {b.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: salary + compensation badge + posted + commission/equity */}
              <div className="shrink-0 sm:text-right">
                <p className="text-lg font-semibold text-white md:text-xl">{payClean}</p>
                {compensationBadgeLabel && (
                  <span className="mt-1.5 inline-flex items-center rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/80 ring-1 ring-white/20">
                    {compensationBadgeLabel}
                  </span>
                )}
                <p className="mt-1 text-xs text-white/70">{postedLabel}</p>
                {commissionEquityBadges}
              </div>
            </div>
          </header>
        )}

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className="px-5 py-4">

          {/* Card preview summary */}
          {(() => {
            const preview = (job as any).jobSummary?.trim() || job.description?.trim();
            return preview ? (
              <p className={`line-clamp-2 text-sm leading-6 ${featured ? "text-amber-100/70" : "text-slate-600 dark:text-slate-300"}`}>
                {preview}
              </p>
            ) : null;
          })()}

          {/* Benefits chips — only when populated */}
          {jobBenefits && (
            <div className="mt-3">
              <BenefitsDisplay benefits={jobBenefits} />
            </div>
          )}

          {/* Skill tags — up to 4 with overflow indicator */}
          {visibleTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className={
                    featured
                      ? "rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200/80"
                      : "rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-slate-300"
                  }
                >
                  {tag}
                </span>
              ))}
              {extraTags > 0 && (
                <span
                  className={
                    featured
                      ? "rounded-full border border-amber-400/15 bg-amber-400/8 px-2.5 py-1 text-xs text-amber-300/50"
                      : "rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-400 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-slate-500"
                  }
                >
                  +{extraTags} more
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              className={
                featured
                  ? "rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 text-white border-0 hover:opacity-90 shadow-md shadow-orange-900/30"
                  : "rounded-full bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] px-5 text-white border-0 hover:opacity-90"
              }
              onClick={() => {
                if ((job as any).applicationMethod === "external_link" && job.applyLink) {
                  window.open(job.applyLink, "_blank", "noopener,noreferrer");
                } else {
                  navigate(`/jobs/${job.id}/apply`);
                }
              }}
            >
              Apply Now
            </Button>
            <button
              onClick={() => onNavigate(job.id)}
              className={
                featured
                  ? "inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-4 py-1.5 text-sm font-medium text-amber-200/80 transition-colors hover:border-amber-400/50 hover:text-amber-200"
                  : "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:text-indigo-400"
              }
            >
              View details <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

        </div>
      </article>
    </motion.div>
  );
}

export default function FindWorkAllJobs() {
  const [, navigate] = useLocation();

  // useSearch() from wouter v3 — reactive to query-string changes on the SAME route.
  // When the user clicks a different nav category while already on /find-work/jobs,
  // wouter does a client-side push (no remount), so useState init runs only once.
  // useSearch() re-renders this component whenever the search string changes.
  const rawSearch = useSearch(); // e.g. "?category=design-creative" or ""
  const navSlug = useMemo(() => {
    try {
      return new URLSearchParams(rawSearch).get("category") ?? "";
    } catch {
      return "";
    }
  }, [rawSearch]);
  const navGroup = useMemo(
    () => (navSlug ? NAV_SLUG_MAP[navSlug] : undefined),
    [navSlug],
  );

  // Search bar text — initialised from nav group on first load
  const [search, setSearch] = useState(() => {
    try {
      const slug =
        new URLSearchParams(window.location.search).get("category") ?? "";
      return NAV_SLUG_MAP[slug]?.search ?? "";
    } catch {
      return "";
    }
  });
  const [category, setCategory] = useState("All Categories");
  const [location, setLocation] = useState("All Locations");
  const [contractType, setContractType] = useState("All Types");
  const [salary, setSalary] = useState("Any pay");
  const [sort, setSort] = useState<SortOption>("recently-posted");
  const [showFilters, setShowFilters] = useState(() => {
    try {
      const slug =
        new URLSearchParams(window.location.search).get("category") ?? "";
      return !!slug && slug !== "all";
    } catch {
      return false;
    }
  });

  // Track pilot activity on mount
  useEffect(() => {
    trackPilotActivity("viewedFindWork");
  }, []);

  // Skip the first render (handled by useState initialisers above);
  // on subsequent navSlug changes (same-page nav), sync dependent state.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSearch(navGroup?.search ?? "");
    setCategory("All Categories"); // reset any manual chip selection
    setShowFilters(!!navSlug && navSlug !== "all");
  }, [navSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const PAGE_SIZE = 25;

  // Current page from URL ?page=N (defaults to 1)
  const currentPage = useMemo(() => {
    try {
      const p = parseInt(new URLSearchParams(rawSearch).get("page") ?? "1", 10);
      return Number.isFinite(p) && p >= 1 ? p : 1;
    } catch { return 1; }
  }, [rawSearch]);

  interface PaginatedJobsResponse {
    items: Job[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }

  const { data: jobsData, isLoading } = useQuery<PaginatedJobsResponse>({
    queryKey: [
      "/api/jobs/search",
      { status: "open", page: currentPage, pageSize: PAGE_SIZE, q: search, category, contractType, location, navSlug },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("status", "open");
      params.set("page", String(currentPage));
      params.set("pageSize", String(PAGE_SIZE));
      if (search.trim()) params.set("q", search.trim());
      if (category !== "All Categories") params.set("category", category);
      if (contractType !== "All Types") params.set("contractType", contractType);
      if (location !== "All Locations") params.set("location", location);
      // navGroup: pass all matching category names so server filters across all pages
      if (navGroup && navGroup.cats.length > 0 && category === "All Categories") {
        params.set("categories", navGroup.cats.join(","));
      }
      const res = await fetch(`/api/jobs/search?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load jobs");
      return res.json();
    },
    placeholderData: (prev: PaginatedJobsResponse | undefined) => prev,
    staleTime: 2 * 60 * 1000,
  });

  const openJobs: Job[] = jobsData?.items ?? [];
  const totalPages = jobsData?.meta?.totalPages ?? 1;
  const totalJobs = jobsData?.meta?.total ?? 0;

  // Popular jobs — top 5 open+approved by view count, fallback to newest
  const { data: popularJobs = [], isLoading: isLoadingPopular } = useQuery<
    { id: string; title: string; professional_role_name: string | null }[]
  >({
    queryKey: ["/api/jobs/popular"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/popular");
      if (!res.ok) throw new Error("Failed to load popular jobs");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Debounced search tracking
  useEffect(() => {
    if (!search.trim()) return;
    const timer = setTimeout(() => {
      saveUserActivity({
        activityType: "JobSearch",
        keyword: search.trim(),
        category: category !== "All Categories" ? category : undefined,
        page: "FindWorkAllJobs",
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [search, category]);

  // Activity-based recommendations — re-read from localStorage whenever activity changes
  const [recInterests, setRecInterests] = useState<string[]>(() =>
    getTopUserInterests(5),
  );
  useEffect(() => {
    const refresh = () => setRecInterests(getTopUserInterests(5));
    // Re-compute on same-tab activity (dispatched by saveUserActivity)
    window.addEventListener("userActivityUpdated", refresh);
    // Also re-compute when the tab regains focus (cross-tab / returning user)
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("userActivityUpdated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const { recommendedJobs, recsArePersonalized } = useMemo<{
    recommendedJobs: Job[];
    recsArePersonalized: boolean;
  }>(() => {
    if (search.trim())
      return { recommendedJobs: [], recsArePersonalized: false };
    // Exclude featured jobs from recommendations — they already appear prominently
    // at the top of the main list, so including them here would show them twice.
    const nonFeatured = openJobs.filter((j) => !(j as any).isFeatured);
    if (recInterests.length > 0) {
      const scored = scoreJobsAgainstInterests(nonFeatured).slice(0, 3) as Job[];
      if (scored.length > 0)
        return { recommendedJobs: scored, recsArePersonalized: true };
    }
    // Fallback: top 3 non-featured open jobs by view count then recency
    const fallback = [...nonFeatured]
      .sort(
        (a, b) =>
          ((b as any).viewCount ?? 0) - ((a as any).viewCount ?? 0) ||
          new Date((b as any).postedAt ?? b.createdAt ?? 0).getTime() -
            new Date((a as any).postedAt ?? a.createdAt ?? 0).getTime(),
      )
      .slice(0, 3);
    return { recommendedJobs: fallback, recsArePersonalized: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recInterests, openJobs, search]);

  // Talent profile-based recommendations
  const [talentAuth, setTalentAuth] = useState<TalentAuthState | null>(null);
  useEffect(() => {
    setTalentAuth(loadTalentAuth());
  }, []);

  const { data: talentProfile, isLoading: isLoadingProfile } =
    useQuery<Candidate>({
      queryKey: ["/api/candidates", talentAuth?.candidateId],
      queryFn: async () => {
        const res = await fetch(`/api/candidates/${talentAuth!.candidateId}`, {
          headers: { Authorization: `Bearer ${talentAuth!.token}` },
        });
        if (!res.ok) throw new Error("Failed to load talent profile");
        return res.json();
      },
      enabled: !!talentAuth?.candidateId,
      staleTime: 5 * 60 * 1000,
    });

  const talentRecs = useMemo(() => {
    if (!talentAuth || !talentProfile) {
      return { jobs: [] as Job[], hasProfile: false, hasEnoughData: false };
    }
    const recProfile = buildTalentRecProfile(talentProfile);
    if (!recProfile.hasEnoughData) {
      return { jobs: [] as Job[], hasProfile: true, hasEnoughData: false };
    }
    // Exclude featured jobs — they already appear at the top of the main list
    const scored = openJobs
      .filter((j) => !(j as any).isFeatured)
      .map((job) => ({
        job,
        score: scoreJobForTalent(job, recProfile.keywords),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ job }) => job);
    return { jobs: scored, hasProfile: true, hasEnoughData: true };
  }, [talentAuth, talentProfile, openJobs]);

  const filtered = useMemo(() => {
    // Search, category, location, and contractType are all server-side now.
    // Only the PHP salary threshold remains client-side (currency-dependent).
    let list = salary === "Any pay"
      ? openJobs
      : openJobs.filter((job) => {
          const jobCurrency = ((job as any).budgetCurrency || "PHP").toUpperCase();
          if (jobCurrency !== "PHP") return true;
          const display: string = (job as any).salaryDisplay || "";
          let max: number;
          if (display) {
            const match = display.replace(/[,_]/g, "").match(/[\d]+/);
            max = match ? parseFloat(match[0]) : 0;
          } else {
            max = parseFloat((job as any).hourlyRateMax ?? (job as any).budget ?? "0");
          }
          if (salary === "₱30,000+") return max >= 30000;
          if (salary === "₱45,000+") return max >= 45000;
          if (salary === "₱60,000+") return max >= 60000;
          if (salary === "₱85,000+") return max >= 85000;
          if (salary === "₱100,000+") return max >= 100000;
          return true;
        });

    const sorted = sortJobs(list, sort);
    const seen = new Set<string>();
    const unique = sorted.filter((j) => {
      if (seen.has(j.id)) return false;
      seen.add(j.id);
      return true;
    });
    const featuredOnes = unique.filter((j) => (j as any).isFeatured === true);
    const regularOnes  = unique.filter((j) => (j as any).isFeatured !== true);
    return [...featuredOnes, ...regularOnes];
  }, [openJobs, salary, sort]);

  function applyHotSearch(term: string) {
    setSearch(term);
    setCategory("All Categories");
  }

  const hasActiveFilters =
    category !== "All Categories" ||
    location !== "All Locations" ||
    contractType !== "All Types" ||
    salary !== "Any pay" ||
    (!!navGroup && navGroup.cats.length > 0);

  function resetFilters() {
    setCategory("All Categories");
    setLocation("All Locations");
    setContractType("All Types");
    setSalary("Any pay");
  }

  // Ref to scroll to the jobs section from the hero
  const jobsSectionRef = useRef<HTMLDivElement>(null);
  const scrollToJobs = useCallback(() => {
    jobsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Navigate to a page — updates URL (preserving other params) and scrolls to results
  const goToPage = useCallback((page: number) => {
    try {
      const params = new URLSearchParams(rawSearch);
      params.set("page", String(page));
      navigate(`/find-work/jobs?${params.toString()}`);
    } catch { /* noop */ }
    setTimeout(() => jobsSectionRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [rawSearch, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // When any filter/sort/navSlug changes, reset to page 1
  const prevFiltersRef = useRef({ search, category, location, contractType, salary, sort, navSlug });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const changed =
      prev.search !== search ||
      prev.category !== category ||
      prev.location !== location ||
      prev.contractType !== contractType ||
      prev.salary !== salary ||
      prev.sort !== sort ||
      prev.navSlug !== navSlug;
    prevFiltersRef.current = { search, category, location, contractType, salary, sort, navSlug };
    if (changed && currentPage !== 1) {
      try {
        const params = new URLSearchParams(rawSearch);
        params.set("page", "1");
        navigate(`/find-work/jobs?${params.toString()}`);
      } catch { /* noop */ }
    }
  }, [search, category, location, contractType, salary, sort, navSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-correct: if current page exceeds total pages (e.g. after deletions), jump to last valid page
  useEffect(() => {
    if (jobsData && currentPage > jobsData.meta.totalPages && jobsData.meta.totalPages > 0) {
      try {
        const params = new URLSearchParams(rawSearch);
        params.set("page", String(jobsData.meta.totalPages));
        navigate(`/find-work/jobs?${params.toString()}`);
      } catch { /* noop */ }
    }
  }, [jobsData]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,78,173,0.10),transparent_30%),linear-gradient(to_bottom,#f8fafc,white)] text-slate-900 dark:bg-[#060816] dark:text-white">
      {/* ── HERO (full-viewport, light) ── */}
      <div
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(120, 92, 255, 0.14) 0%, transparent 48%), linear-gradient(180deg, #f3f1ff 0%, #f8f9fc 55%, #ffffff 100%)",
        }}
      >
        {/* Soft ambient glows — light mode */}
        <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-300/20 blur-[130px]" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-[400px] w-[400px] rounded-full bg-indigo-200/25 blur-[110px]" />
        {/* Centered spotlight */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-400/[0.10] blur-[100px]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 mx-auto w-full max-w-2xl px-6 text-center"
        >
          {/* Brand badge */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            <Badge className="rounded-full bg-[#3F4698]/10 px-4 py-1.5 text-sm text-[#3F4698] hover:bg-[#3F4698]/10">
              {PILOT_CONFIG.brandPromise}
            </Badge>
          </div>

          {/* Headline — two intentional lines */}
          <h1 className="mx-auto max-w-2xl text-center">
            <span className="block text-[clamp(44px,6.5vw,76px)] font-extrabold leading-[1.05] tracking-[-0.045em] text-slate-900">
              Apply Once
            </span>
            <span className="block text-[clamp(28px,4vw,52px)] font-bold leading-[1.1] tracking-[-0.03em] text-slate-800 mt-1">
              Get matched continuously
            </span>
          </h1>

          {/* Supporting description — clearly secondary */}
          <p className="mx-auto mt-5 max-w-[400px] text-[14px] font-normal leading-[1.7] text-slate-400">
            Submit one quick application and we'll keep matching you with
            relevant open roles as they become available.
          </p>

          {/* Search bar — primary action, white card + gradient button */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scrollToJobs();
            }}
            className="mt-9 flex overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-[0_4px_24px_rgba(98,53,232,0.12),0_1px_4px_rgba(0,0,0,0.06)]"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-lg bg-transparent pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none"
                placeholder="Job title, skill, or keyword…"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Gradient button — visually strongest element in the search bar */}
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-gradient-to-r from-[#5B45E8] to-[#7C3AED] px-7 text-sm font-semibold text-white shadow-[0_2px_16px_rgba(98,53,232,0.35)] transition hover:from-[#4f3ad4] hover:to-[#6d31d4]"
            >
              Search
            </button>
          </form>

          {/* Browse all — secondary CTA: clearly subordinate */}
          <div className="mt-6">
            <button
              type="button"
              onClick={scrollToJobs}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              Browse all open roles
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Popular chips — tertiary: subtle pills */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            <span className="mb-2 w-full text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">
              Popular
            </span>
            {isLoadingPopular
              ? Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-[26px] w-24 animate-pulse rounded-full border border-slate-200 bg-slate-100"
                  />
                ))
              : popularJobs.map((job) => {
                  const label = job.professional_role_name || job.title;
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => navigate(`/find-work/job/${job.id}`)}
                      className="rounded-full border border-slate-200 bg-white/70 px-4 py-1 text-[11px] font-medium text-slate-500 transition duration-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                    >
                      {label}
                    </button>
                  );
                })}
          </div>
        </motion.div>
      </div>

      {/* ── FILTERS PANEL (anchored, no duplicate search bar) ── */}
      <div
        ref={jobsSectionRef}
        className="border-b border-slate-200/70 bg-white/80 dark:border-white/10 dark:bg-white/[0.02]"
      >
        <div className="mx-auto max-w-7xl px-6 py-4 md:px-8">
          {/* Filters toggle — compact, only shown when needed */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className={`h-9 rounded-full gap-2 text-sm ${showFilters ? "border-[#474ead]/50 bg-[#474ead]/5 text-[#474ead]" : ""}`}
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#474ead] text-[10px] text-white">
                  !
                </span>
              )}
            </Button>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="mt-5 border-t border-slate-100 pt-5 dark:border-white/10"
            >
              {/* Nav category active banner */}
              {navGroup &&
                navGroup.cats.length > 0 &&
                category === "All Categories" && (
                  <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#474ead]/20 bg-[#474ead]/5 px-4 py-3">
                    <BriefcaseBusiness className="h-4 w-4 shrink-0 text-[#474ead]" />
                    <p className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                      Filtering by{" "}
                      <span className="font-semibold text-[#474ead]">
                        {navGroup.label}
                      </span>
                      . Pick a chip below to narrow further, or{" "}
                      <button
                        className="font-medium text-[#474ead] underline underline-offset-2"
                        onClick={() => navigate("/find-work/jobs")}
                      >
                        clear to see all jobs
                      </button>
                      .
                    </p>
                  </div>
                )}

              <div className="flex flex-wrap gap-6">
                {/* Category */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <BriefcaseBusiness className="h-3 w-3" /> Category
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setCategory(cat);
                          if (cat !== "All Categories") {
                            saveUserActivity({
                              activityType: "CategoryClick",
                              category: cat,
                              page: "FindWorkAllJobs",
                            });
                            setRecInterests(getTopUserInterests(5));
                          }
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs transition ${
                          category === cat
                            ? "bg-[#474ead] text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <MapPin className="h-3 w-3" /> Location
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {LOCATIONS.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => setLocation(loc)}
                        className={`rounded-full px-3 py-1.5 text-xs transition ${
                          location === loc
                            ? "bg-[#474ead] text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contract type */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <Layers className="h-3 w-3" /> Contract type
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CONTRACT_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setContractType(t)}
                        className={`rounded-full px-3 py-1.5 text-xs capitalize transition ${
                          contractType === t
                            ? "bg-[#474ead] text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
                        }`}
                      >
                        {t.replace(/-/g, " ")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Salary */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <DollarSign className="h-3 w-3" /> Min. salary
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SALARY_RANGES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSalary(s)}
                        className={`rounded-full px-3 py-1.5 text-xs transition ${
                          salary === s
                            ? "bg-[#474ead] text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-4 text-xs font-medium text-[#474ead] underline-offset-2 hover:underline"
                >
                  Reset all filters
                </button>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── RESULTS ── */}
      <div className="mx-auto max-w-7xl px-6 py-10 md:px-8 md:py-14">
        {/* Sort + count bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            {isLoading ? (
              <div className="h-5 w-32 animate-pulse rounded bg-slate-100 dark:bg-white/[0.06]" />
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-900 dark:text-white">
                  {totalJobs}
                </span>{" "}
                role{totalJobs !== 1 ? "s" : ""} found
                {search && (
                  <>
                    {" "}
                    for "
                    <span className="font-medium text-[#474ead]">{search}</span>
                    "
                  </>
                )}
                {totalPages > 1 && (
                  <span className="ml-2 text-slate-400">
                    · page {currentPage} of {totalPages}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-500">Sort:</span>
            <div className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    sort === opt.value
                      ? "bg-[#474ead] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="overflow-hidden rounded-2xl border border-slate-100 bg-white dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <div className="h-16 animate-pulse bg-gradient-to-r from-slate-200 to-slate-100 dark:from-white/[0.08] dark:to-white/[0.04]" />
                <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 dark:divide-white/[0.06] dark:border-white/[0.06]">
                  {[1, 2, 3, 4].map((c) => (
                    <div key={c} className="px-4 py-3">
                      <div className="mb-1.5 h-2.5 w-16 animate-pulse rounded bg-slate-100 dark:bg-white/[0.06]" />
                      <div className="h-4 w-20 animate-pulse rounded bg-slate-100 dark:bg-white/[0.06]" />
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 space-y-2">
                  <div className="h-3.5 w-full animate-pulse rounded bg-slate-100 dark:bg-white/[0.06]" />
                  <div className="h-3.5 w-4/5 animate-pulse rounded bg-slate-100 dark:bg-white/[0.06]" />
                  <div className="mt-3 flex gap-2">
                    {[1, 2, 3].map((t) => (
                      <div
                        key={t}
                        className="h-6 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]"
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06]">
              <Search className="h-7 w-7 text-slate-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                No roles found
              </p>
              <p className="mt-1 text-slate-500">
                Try adjusting your search or clearing the filters.
              </p>
            </div>
            {(search || hasActiveFilters) && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setSearch("");
                  resetFilters();
                }}
              >
                Clear all
              </Button>
            )}
          </div>
        )}

        {/* ── Single canonical job list ──────────────────────────────────────
             `filtered` is deduplicated, salary-filtered, and sorted featured-first.
             Search/category/location/contractType filtering is server-side.         */}
        {!isLoading && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onNavigate={(id) => {
                  saveUserActivity({
                    activityType: "JobClick",
                    referenceId: id,
                    title: job.title,
                    category: job.category ?? undefined,
                    tags: job.skillTags ?? undefined,
                    page: "FindWorkAllJobs",
                  });
                  navigate(`/find-work/job/${id}`);
                }}
              />
            ))}
          </div>
        )}

        {/* ── Pagination controls ─────────────────────────────────────────── */}
        {!isLoading && totalPages > 1 && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
            {/* Previous */}
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
              aria-label="Previous page"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Prev
            </button>

            {/* Page numbers with compact ellipsis */}
            {buildPageNumbers(currentPage, totalPages).map((item, i) =>
              item === "…" ? (
                <span
                  key={`ellipsis-${i}`}
                  className="flex h-9 w-5 items-center justify-center text-slate-400"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  onClick={() => goToPage(item as number)}
                  className={`h-9 w-9 rounded-full text-sm font-medium transition ${
                    item === currentPage
                      ? "bg-[#474ead] text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
                  }`}
                  aria-current={item === currentPage ? "page" : undefined}
                  aria-label={`Page ${item}`}
                >
                  {item}
                </button>
              )
            )}

            {/* Next */}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
              aria-label="Next page"
            >
              Next <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
