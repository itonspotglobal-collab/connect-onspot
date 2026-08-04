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
  Clock3,
  SlidersHorizontal,
  X,
  Calendar,
  Code2,
  Heart,
  HeadphonesIcon,
  BarChart2,
  PenLine,
  Settings2,
  ShoppingBag,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Job, Candidate } from "@shared/schema";
import {
  buildRateDisplay,
  getJobBadges,
  getTimeAgo,
  sortJobs,
  type SortOption,
} from "@/lib/jobUtils";
import {
  saveUserActivity,
  getTopUserInterests,
  scoreJobsAgainstInterests,
} from "@/lib/userActivityMemory";
import { PILOT_CONFIG, trackPilotActivity } from "@/lib/pilotConfig";
import { getJobPilotId } from "@/lib/pilotFiltering";
import {
  loadTalentAuth,
  saveTalentAuth,
  type TalentAuthState,
} from "@/components/TalentLoginModal";
import {
  buildTalentRecProfile,
  scoreJobForTalent,
} from "@/lib/talentRecommendations";

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
    cats: ["Development", "Tech support"],
  },
  design: { label: "Design & Creative", cats: ["Design"] },
  marketing: { label: "Sales & Marketing", cats: ["Marketing", "Sales"] },
  support: {
    label: "Admin & Support",
    cats: ["Admin", "Customer success", "Operations"],
  },
  writing: {
    label: "Writing & Translation",
    cats: [],
    search: "writing translation",
  },
};

const CATEGORIES = [
  "All Categories",
  "Admin",
  "Customer success",
  "Marketing",
  "Finance",
  "Tech support",
  "Sales",
  "Operations",
  "Design",
  "Development",
];

const LOCATIONS = ["All Locations", "Remote", "Hybrid", "On-site"];

const CONTRACT_TYPES = [
  "All Types",
  "full-time",
  "part-time",
  "contract",
  "hourly",
  "fixed",
];

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

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  development: Code2,
  "tech support": Code2,
  design: PenLine,
  marketing: BarChart2,
  sales: ShoppingBag,
  admin: Settings2,
  "customer success": HeadphonesIcon,
  operations: Settings2,
  finance: FileText,
};

function getCategoryIcon(category: string | null): React.ElementType {
  const key = (category ?? "").toLowerCase();
  return CATEGORY_ICONS[key] ?? BriefcaseBusiness;
}

function JobCard({
  job,
  onNavigate,
}: {
  job: Job;
  onNavigate: (id: string) => void;
}) {
  const [, navigate] = useLocation();
  const pay = buildRateDisplay(job);
  const badges = getJobBadges(job);
  const timeAgo = getTimeAgo(job.createdAt);
  const tags = (job.skillTags ?? []).slice(0, 5);
  const CategoryIcon = getCategoryIcon(
    (job as any).jobFunction || job.category,
  );
  const contractLabel = (job.contractType ?? "Full-time").replace(/-/g, " ");
  const pilotId = getJobPilotId(job);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-[0_8px_32px_rgba(71,78,173,0.12)] dark:border-white/10 dark:bg-white/[0.03]">
        {/* ── Gradient header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] px-5 py-4">
          {/* Left: icon + title + meta */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <CategoryIcon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <h3 className="text-base font-bold leading-tight text-white truncate">
                  {(job as any).professionalRoleName || job.title}
                </h3>
                {pilotId && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#3F4698]">
                    Pilot
                  </span>
                )}
              </div>
              {(job as any).originalRoleName && (
                <p className="text-[11px] italic text-white/65 truncate leading-tight mb-0.5">
                  {(job as any).originalRoleName}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-white/70">
                  {job.company ?? "OnSpot"}
                </span>
                <span className="text-white/30 text-xs">·</span>
                {badges.length > 0 ? (
                  badges.map((b) => (
                    <span
                      key={b.key}
                      className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white"
                    >
                      {b.label}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white capitalize">
                    {contractLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: pay + posted */}
          <div className="shrink-0 text-right">
            <div className="text-base font-bold text-white">{pay}</div>
            <div className="mt-0.5 text-[11px] text-white/60">
              Job posted {timeAgo}
            </div>
          </div>
        </div>

        {/* ── Metadata row ────────────────────────────────────────────────── */}
        {(() => {
          const jobBenefits = ((job as any).benefits as string | null | undefined)?.trim();
          const metaItems = [
            { icon: Layers, label: "CONTRACT", value: contractLabel },
            { icon: DollarSign, label: "SALARY", value: pay },
            { icon: MapPin, label: "LOCATION", value: job.location ?? "Remote" },
            { icon: Calendar, label: "POSTED", value: timeAgo },
            ...(jobBenefits ? [{ icon: Heart, label: "HMO / BENEFITS", value: jobBenefits }] : []),
          ];
          const cols = metaItems.length === 5 ? "grid-cols-5" : "grid-cols-4";
          return (
            <div className={`grid ${cols} divide-x divide-slate-100 border-b border-slate-100 dark:divide-white/[0.06] dark:border-white/[0.06]`}>
              {metaItems.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col gap-0.5 px-4 py-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    <Icon className="h-3 w-3" />
                    {label}
                  </div>
                  <div className="text-sm font-semibold capitalize text-slate-800 dark:text-white truncate">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          {(() => {
            const preview =
              (job as any).jobSummary?.trim() || job.description?.trim();
            return preview ? (
              <p className="line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {preview}
              </p>
            ) : null;
          })()}

          {/* Skill tags */}
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex items-center gap-3">
            <Button
              className="rounded-full bg-gradient-to-r from-[#3A3AF8] to-[#7F3DF4] px-6 text-white border-0"
              onClick={() => {
                if (
                  (job as any).applicationMethod === "external_link" &&
                  job.applyLink
                ) {
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
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-[#474ead]/30 hover:bg-[#474ead]/5 hover:text-[#474ead] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
            >
              View details <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
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

  const { data: openJobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs/search", { status: "open" }],
    queryFn: async () => {
      const res = await fetch("/api/jobs/search?status=open");
      if (!res.ok) throw new Error("Failed to load jobs");
      const data = await res.json();
      // API now returns paginated { items, meta } — fall back to raw array for safety
      return Array.isArray(data) ? data : (data.items ?? []);
    },
    staleTime: 2 * 60 * 1000,
  });

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
    if (recInterests.length > 0) {
      const scored = scoreJobsAgainstInterests(openJobs).slice(0, 3) as Job[];
      if (scored.length > 0)
        return { recommendedJobs: scored, recsArePersonalized: true };
    }
    // Fallback: top 3 open jobs by view count then recency — shown to anonymous / no-activity users
    const fallback = [...openJobs]
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
    const scored = openJobs
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
    let list = openJobs.filter((job) => {
      const q = search.toLowerCase();
      const queryPass =
        !q ||
        job.title.toLowerCase().includes(q) ||
        ((job as any).professionalRoleName ?? "").toLowerCase().includes(q) ||
        ((job as any).originalRoleName ?? "").toLowerCase().includes(q) ||
        ((job as any).jobFunction ?? "").toLowerCase().includes(q) ||
        (job.description ?? "").toLowerCase().includes(q) ||
        (job.category ?? "").toLowerCase().includes(q) ||
        (job.location ?? "").toLowerCase().includes(q) ||
        (job.skillTags ?? []).some((t) => t.toLowerCase().includes(q));

      // When a nav category group is active (from URL param) it can match
      // multiple internal DB categories (e.g. "support" → Admin + Customer success).
      // If the group is empty (cats: []) it means "All Jobs" — no filter.
      // If the user manually picks a chip, that single-category filter takes precedence.
      const navCatActive =
        !!navGroup && navGroup.cats.length > 0 && category === "All Categories";
      const normJobCat = normalizeCategory(
        (job as any).jobFunction || job.category || "",
      );
      const catPass = navCatActive
        ? navGroup.cats.some((c) => normJobCat === normalizeCategory(c))
        : category === "All Categories" ||
          normJobCat === normalizeCategory(category);

      const locPass =
        location === "All Locations" ||
        (job.location ?? "remote")
          .toLowerCase()
          .includes(location.toLowerCase());

      const typePass =
        contractType === "All Types" ||
        (job.contractType ?? "").toLowerCase() === contractType.toLowerCase();

      const salaryPass = (() => {
        if (salary === "Any pay") return true;
        // PHP salary thresholds only apply to PHP-currency jobs
        const jobCurrency = (
          (job as any).budgetCurrency || "PHP"
        ).toUpperCase();
        if (jobCurrency !== "PHP") return true;
        // Parse a number from salaryDisplay first, fall back to legacy numeric fields
        const display: string = (job as any).salaryDisplay || "";
        let max: number;
        if (display) {
          const match = display.replace(/[,_]/g, "").match(/[\d]+/);
          max = match ? parseFloat(match[0]) : 0;
        } else {
          max = parseFloat(
            (job as any).hourlyRateMax ?? (job as any).budget ?? "0",
          );
        }
        if (salary === "₱30,000+") return max >= 30000;
        if (salary === "₱45,000+") return max >= 45000;
        if (salary === "₱60,000+") return max >= 60000;
        if (salary === "₱85,000+") return max >= 85000;
        if (salary === "₱100,000+") return max >= 100000;
        return true;
      })();

      return queryPass && catPass && locPass && typePass && salaryPass;
    });
    return sortJobs(list, sort);
  }, [
    openJobs,
    search,
    category,
    location,
    contractType,
    salary,
    sort,
    navSlug,
    navGroup,
  ]);

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
                  {filtered.length}
                </span>{" "}
                role{filtered.length !== 1 ? "s" : ""} found
                {search && (
                  <>
                    {" "}
                    for "
                    <span className="font-medium text-[#474ead]">{search}</span>
                    "
                  </>
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

        {/* Talent Profile-Based Recommendations */}
        {!isLoading && !search.trim() && talentAuth && (
          <div className="mb-6">
            {isLoadingProfile ? (
              <div className="flex items-center gap-2 py-2 text-sm text-slate-500 dark:text-slate-400">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#474ead] border-t-transparent" />
                Loading your profile recommendations…
              </div>
            ) : talentRecs.jobs.length > 0 ? (
              <>
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#474ead]">
                  <Users className="h-4 w-4" />
                  Recommended for you — based on your talent profile
                </div>
                <div className="space-y-3">
                  {talentRecs.jobs.map((job) => (
                    <JobCard
                      key={`profile-rec-${job.id}`}
                      job={job}
                      onNavigate={(id) => {
                        saveUserActivity({
                          activityType: "JobClick",
                          referenceId: id,
                          title: job.title,
                          category: job.category ?? undefined,
                          tags: job.skillTags ?? undefined,
                          page: "FindWorkAllJobs-ProfileRec",
                        });
                        navigate(`/find-work/job/${id}`);
                      }}
                    />
                  ))}
                </div>
                <div className="my-6 border-t border-slate-200/60 dark:border-white/[0.07]" />
              </>
            ) : talentProfile && !talentRecs.hasEnoughData ? (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Complete your talent profile to get personalized job
                  recommendations.
                </p>
                <a
                  href={`/talent-profile/${talentAuth.candidateId}`}
                  className="mt-1 inline-block text-xs text-[#474ead] hover:underline dark:text-indigo-400"
                >
                  Update Talent Profile
                </a>
              </div>
            ) : null}
          </div>
        )}

        {/* Recommended for You */}
        {!isLoading && recommendedJobs.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#474ead]">
              <Zap className="h-4 w-4" />
              {recsArePersonalized
                ? "Recommended for you — based on your recent activity"
                : "Trending roles"}
            </div>
            <div className="space-y-3">
              {recommendedJobs.map((job) => (
                <JobCard
                  key={`rec-${job.id}`}
                  job={job}
                  onNavigate={(id) => {
                    saveUserActivity({
                      activityType: "JobClick",
                      referenceId: id,
                      title: job.title,
                      category: job.category ?? undefined,
                      tags: job.skillTags ?? undefined,
                      page: "FindWorkAllJobs-Recommended",
                    });
                    navigate(`/find-work/job/${id}`);
                  }}
                />
              ))}
            </div>
            <div className="my-6 border-t border-slate-200/60 dark:border-white/[0.07]" />
          </div>
        )}

        {/* Job list */}
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
      </div>
    </div>
  );
}
