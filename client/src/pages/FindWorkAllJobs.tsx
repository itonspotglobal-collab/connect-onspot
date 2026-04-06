import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Search, Filter, ArrowLeft, ArrowRight, DollarSign,
  MapPin, BriefcaseBusiness, Layers, Zap, Users, Clock3,
  SlidersHorizontal, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Job } from "@shared/schema";
import { buildRateDisplay, getJobBadges, getTimeAgo, sortJobs, type SortOption } from "@/lib/jobUtils";

const APPLY_URL = "https://api.leadconnectorhq.com/widget/form/36ljnIgIsA1xoBluXvSK?notrack=true";

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

// Maps nav dropdown slug (?category=<slug>) → matching internal DB category values.
// cats: [] means "All Categories" (no filter).
// search: pre-fills the search bar for slugs with no direct DB category match.
const NAV_SLUG_MAP: Record<string, { label: string; cats: string[]; search?: string }> = {
  all:         { label: "All Jobs",              cats: [] },
  development: { label: "Development & IT",      cats: ["Development", "Tech support"] },
  design:      { label: "Design & Creative",     cats: ["Design"] },
  marketing:   { label: "Sales & Marketing",     cats: ["Marketing", "Sales"] },
  support:     { label: "Admin & Support",       cats: ["Admin", "Customer success", "Operations"] },
  writing:     { label: "Writing & Translation", cats: [], search: "writing translation" },
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

function JobCard({ job, onNavigate }: { job: Job; onNavigate: (id: string) => void }) {
  const pay = buildRateDisplay(job);
  const badges = getJobBadges(job);
  const timeAgo = getTimeAgo(job.createdAt);
  const tags = (job.skillTags ?? []).slice(0, 4);

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
      <Card className="flex h-full flex-col rounded-3xl border-slate-200/70 bg-white/90 transition-all hover:border-[#474ead]/25 hover:shadow-[0_16px_48px_rgba(71,78,173,0.10)] dark:border-white/10 dark:bg-white/[0.03]">
        <CardContent className="flex flex-1 flex-col p-6">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <span key={b.key} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${b.className}`}>{b.label}</span>
                ))}
                {badges.length === 0 && (
                  <span className="rounded-full bg-[#474ead]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#474ead]">Open</span>
                )}
              </div>
              <h3 className="text-lg font-semibold leading-snug text-slate-900 dark:text-white">{job.title}</h3>
              <p className="mt-0.5 text-sm text-slate-500">{job.company ?? "OnSpot Global"}</p>
            </div>
            <span className="shrink-0 text-xs text-slate-400">{timeAgo}</span>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><DollarSign className="h-3 w-3" /> Pay</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{pay}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><MapPin className="h-3 w-3" /> Location</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{job.location ?? "Remote"}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><BriefcaseBusiness className="h-3 w-3" /> Category</div>
              <div className="mt-0.5 text-sm font-semibold capitalize text-slate-900 dark:text-white">{job.category}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><Layers className="h-3 w-3" /> Type</div>
              <div className="mt-0.5 text-sm font-semibold capitalize text-slate-900 dark:text-white">
                {(job.contractType ?? "Full-time").replace(/-/g, " ")}
              </div>
            </div>
          </div>

          {/* Description */}
          {job.description && (
            <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{job.description}</p>
          )}

          {/* Skill tags */}
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">{tag}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              className="rounded-full bg-[#474ead] px-5 text-white hover:bg-[#3d439c]"
              onClick={() => window.open(APPLY_URL, "_blank", "noopener,noreferrer")}
            >
              Apply Now
            </Button>
            <button
              onClick={() => onNavigate(job.id)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-[#474ead] dark:text-slate-300"
            >
              View details <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Read ?category= from the URL and return the slug (e.g. "support", "design", "all")
function getNavSlugFromUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get("category") ?? "";
  } catch {
    return "";
  }
}

export default function FindWorkAllJobs() {
  const [, navigate] = useLocation();

  // navSlug is set from the URL once on mount; null means "arrived directly, no nav preset"
  const [navSlug] = useState<string>(getNavSlugFromUrl);
  const navGroup = navSlug ? NAV_SLUG_MAP[navSlug] : undefined;

  // Derive initial search from the nav group's search hint, if any
  const [search, setSearch] = useState(() => navGroup?.search ?? "");
  const [category, setCategory] = useState("All Categories");
  const [location, setLocation] = useState("All Locations");
  const [contractType, setContractType] = useState("All Types");
  const [salary, setSalary] = useState("Any pay");
  const [sort, setSort] = useState<SortOption>("recently-posted");
  // Auto-open the filter panel when arriving from a nav category so the user
  // can see which filter is active and adjust it easily
  const [showFilters, setShowFilters] = useState(() => !!navSlug && navSlug !== "all");

  const { data: allJobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/admin/jobs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/jobs");
      if (!res.ok) throw new Error("Failed to load jobs");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const openJobs = useMemo(() => allJobs.filter((j) => j.status === "open"), [allJobs]);

  const filtered = useMemo(() => {
    let list = openJobs.filter((job) => {
      const q = search.toLowerCase();
      const queryPass =
        !q ||
        job.title.toLowerCase().includes(q) ||
        (job.description ?? "").toLowerCase().includes(q) ||
        (job.category ?? "").toLowerCase().includes(q) ||
        (job.location ?? "").toLowerCase().includes(q) ||
        (job.skillTags ?? []).some((t) => t.toLowerCase().includes(q));

      // When a nav category group is active (from URL param) it can match
      // multiple internal DB categories (e.g. "support" → Admin + Customer success).
      // If the group is empty (cats: []) it means "All Jobs" — no filter.
      // If the user manually picks a chip, that single-category filter takes precedence.
      const navCatActive = !!navGroup && navGroup.cats.length > 0 && category === "All Categories";
      const catPass = navCatActive
        ? navGroup.cats.some(
            (c) => (job.category ?? "").toLowerCase() === c.toLowerCase()
          )
        : category === "All Categories" ||
          (job.category ?? "").toLowerCase() === category.toLowerCase();

      const locPass =
        location === "All Locations" ||
        (job.location ?? "remote").toLowerCase().includes(location.toLowerCase());

      const typePass =
        contractType === "All Types" ||
        (job.contractType ?? "").toLowerCase() === contractType.toLowerCase();

      const salaryPass = (() => {
        if (salary === "Any pay") return true;
        const max = parseFloat(job.hourlyRateMax ?? job.budget ?? "0");
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
  }, [openJobs, search, category, location, contractType, salary, sort]);

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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(71,78,173,0.10),transparent_30%),linear-gradient(to_bottom,#f8fafc,white)] text-slate-900 dark:bg-[#060816] dark:text-white">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#0d0f2d] via-[#141656] to-[#0d0f2d]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#474ead]/20 blur-[80px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-indigo-600/10 blur-[60px]" />

        <div className="relative mx-auto max-w-7xl px-6 pb-12 pt-8 md:px-8 md:pb-16 md:pt-12">
          <button
            onClick={() => navigate("/find-work")}
            className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Find Work
          </button>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Badge className="mb-4 rounded-full bg-[#474ead] text-white hover:bg-[#474ead]">
              {navGroup ? navGroup.label : "All Job Openings"}
            </Badge>
            <h1 className="text-3xl font-bold leading-tight text-white md:text-5xl">
              {navGroup && navSlug !== "all"
                ? `${navGroup.label} roles — open now.`
                : "Discover your next remote opportunity."}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-400">
              {navGroup && navSlug !== "all"
                ? `Showing ${navGroup.label} positions managed by OnSpot Global. Updated in real time — apply before they fill.`
                : "Browse every open role managed by OnSpot Global. Roles are updated in real time — apply before they fill."}
            </p>
          </motion.div>

          {/* Stats */}
          <div className="mt-8 flex flex-wrap gap-4">
            {[
              { icon: Users, label: "Open roles", value: isLoading ? "…" : `${openJobs.length}` },
              { icon: Zap,   label: "Urgently hiring", value: isLoading ? "…" : `${openJobs.filter((j) => (j.proposalCount ?? 0) === 0).length}` },
              { icon: Clock3, label: "Typical time-to-hire", value: "3–14 days" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5">
                <Icon className="h-4 w-4 text-[#474ead]" />
                <div>
                  <div className="text-[10px] text-white/40">{label}</div>
                  <div className="text-sm font-bold text-white">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SEARCH + HOT SEARCHES ── */}
      <div className="border-b border-slate-200/70 bg-white/80 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 py-6 md:px-8">

          {/* Search bar */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 rounded-2xl border-slate-200 bg-white pl-10 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-[#474ead]/40 dark:border-white/10 dark:bg-white/[0.04]"
                placeholder="Search roles, skills, or keywords…"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              className={`h-11 rounded-2xl gap-2 ${showFilters ? "border-[#474ead]/50 bg-[#474ead]/5 text-[#474ead]" : ""}`}
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {hasActiveFilters && <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#474ead] text-[10px] text-white">!</span>}
            </Button>
          </div>

          {/* Hot Searches */}
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-[#474ead]" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Hot Searches</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {HOT_SEARCHES.map((term) => (
                <button
                  key={term}
                  onClick={() => applyHotSearch(term)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                    search.toLowerCase() === term.toLowerCase()
                      ? "border-[#474ead]/50 bg-[#474ead]/10 text-[#474ead]"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#474ead]/30 hover:bg-[#474ead]/5 hover:text-[#474ead] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
                  }`}
                >
                  {term}
                </button>
              ))}
            </div>
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
              {navGroup && navGroup.cats.length > 0 && category === "All Categories" && (
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#474ead]/20 bg-[#474ead]/5 px-4 py-3">
                  <BriefcaseBusiness className="h-4 w-4 shrink-0 text-[#474ead]" />
                  <p className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                    Filtering by <span className="font-semibold text-[#474ead]">{navGroup.label}</span>.
                    Pick a chip below to narrow further, or{" "}
                    <button
                      className="font-medium text-[#474ead] underline underline-offset-2"
                      onClick={() => navigate("/find-work/jobs")}
                    >
                      clear to see all jobs
                    </button>.
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
                        onClick={() => setCategory(cat)}
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
                <button onClick={resetFilters} className="mt-4 text-xs font-medium text-[#474ead] underline-offset-2 hover:underline">
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
                <span className="font-bold text-slate-900 dark:text-white">{filtered.length}</span>{" "}
                role{filtered.length !== 1 ? "s" : ""} found
                {search && <> for "<span className="font-medium text-[#474ead]">{search}</span>"</>}
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
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-72 animate-pulse rounded-3xl bg-slate-100 dark:bg-white/[0.04]" />
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
              <p className="text-lg font-semibold text-slate-900 dark:text-white">No roles found</p>
              <p className="mt-1 text-slate-500">Try adjusting your search or clearing the filters.</p>
            </div>
            {(search || hasActiveFilters) && (
              <Button variant="outline" className="rounded-full" onClick={() => { setSearch(""); resetFilters(); }}>
                Clear all
              </Button>
            )}
          </div>
        )}

        {/* Job grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} onNavigate={(id) => navigate(`/find-work/job/${id}`)} />
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM CTA ── */}
      {!isLoading && (
        <div className="border-t border-slate-200/70 dark:border-white/[0.08]">
          <div className="mx-auto max-w-7xl px-6 py-12 text-center md:px-8">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#474ead]">Still looking?</p>
            <h2 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">Apply once. We'll match you to open roles.</h2>
            <p className="mb-8 text-slate-500">Submit a quick application and our team will reach out when a matching role opens.</p>
            <Button
              className="rounded-full bg-[#474ead] px-10 text-white shadow-[0_8px_32px_rgba(71,78,173,0.25)]"
              onClick={() => window.open(APPLY_URL, "_blank", "noopener,noreferrer")}
            >
              Apply in 30 seconds <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
