import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import {
  TALENT_BROWSE_CATEGORIES,
  TALENT_CATEGORY_PHRASES,
  resolveBrowseCategory,
  type TalentBrowseCategory,
} from "@/lib/jobConstants";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Check, Loader2 } from "lucide-react";
import { TopNavigation } from "@/components/TopNavigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TalentResult {
  candidateId: string;
  userId: string;
  score: number;
  overlapSkills: string[];
  matchReasons: Record<string, any>;
  candidate: {
    fullName?: string;
    full_name?: string;
    targetPosition?: string;
    target_position?: string;
    location?: string;
    seniority?: string;
    coreSkills?: string[];
    core_skills?: string[];
    secondarySkills?: string[];
    secondary_skills?: string[];
    category?: string;
  };
}

interface SearchResults {
  jobId: string;
  results: TalentResult[];
}

interface Suggestion {
  category: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name?: string | null): string {
  if (!name || name.toLowerCase().startsWith("candidate ")) return "TA";
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "TA"
  );
}

function maskName(name?: string | null): string {
  if (!name || name.toLowerCase().startsWith("candidate ")) return "Talent Profile";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0] + "•".repeat(4);
  return parts[0] + " " + (parts[1]?.[0] ?? "") + ".";
}

function matchLabel(score: number): { label: string; className: string } | null {
  if (score >= 85) return { label: "Best Match", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" };
  if (score >= 70) return { label: "Strong Match", className: "bg-[#474ead]/10 text-[#474ead] dark:text-indigo-400" };
  if (score >= 50) return { label: "Good Match", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" };
  return null;
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({
  result,
  isInvited,
  isInviting,
  onInvite,
}: {
  result: TalentResult;
  isInvited: boolean;
  isInviting: boolean;
  onInvite: () => void;
}) {
  const badge = matchLabel(result.score);
  const { candidate } = result;

  const name = candidate.fullName ?? candidate.full_name;
  const position = candidate.targetPosition ?? candidate.target_position;
  const coreSkills = candidate.coreSkills ?? candidate.core_skills ?? [];
  const overlapSet = new Set(result.overlapSkills.map((s) => s.toLowerCase()));
  const displaySkills =
    result.overlapSkills.length > 0 ? result.overlapSkills.slice(0, 3) : coreSkills.slice(0, 3);

  // Availability — treat seniority as a proxy for now; most talent is available
  const isAvailableSoon = !candidate.seniority?.toLowerCase().includes("unavailable");

  return (
    <div className="result-card group bg-white border border-slate-200 rounded-2xl p-[22px] hover:shadow-[0_12px_28px_-16px_rgba(20,20,60,0.18)] hover:border-slate-300 transition-[box-shadow,border-color] duration-150 flex flex-col gap-3">
      {/* Avatar row */}
      <div className="flex items-start gap-3 mb-0.5">
        <Avatar className="h-[42px] w-[42px] shrink-0 rounded-[11px]">
          <AvatarFallback
            className={cn(
              "rounded-[11px] font-bold text-[13.5px]",
              badge
                ? "bg-[#EFEFFA] text-[#474ead]"
                : "bg-slate-100 text-slate-400",
            )}
          >
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h3 className="text-[15.5px] font-bold leading-snug text-slate-900 dark:text-white truncate">
            {maskName(name)}
          </h3>
          {position && (
            <p className="text-[12.5px] text-slate-400 mt-0.5 truncate">{position}</p>
          )}
        </div>

        {/* Availability pill */}
        {isAvailableSoon ? (
          <span className="shrink-0 flex items-center gap-1.5 text-[11.5px] font-bold text-[#B8790F] bg-[#FDF1DD] px-2.5 py-1 rounded-full whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623] inline-block" />
            Available now
          </span>
        ) : (
          <span className="shrink-0 text-[11.5px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full whitespace-nowrap">
            Soon
          </span>
        )}
      </div>

      {/* Description / category */}
      <p className="text-[13.5px] text-slate-500 leading-[1.55] min-h-[56px]">
        {candidate.category
          ? `${resolveBrowseCategory(candidate.category) ?? candidate.category} specialist`
          : position
            ? `Experienced ${position.toLowerCase()}`
            : "Experienced professional available for remote work."}
      </p>

      {/* Skill tags */}
      {displaySkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {displaySkills.map((s) => (
            <span
              key={s}
              className={cn(
                "rounded-full px-2.5 py-[5px] text-[11.5px] font-semibold",
                overlapSet.has(s.toLowerCase())
                  ? "bg-[#474ead]/10 text-[#474ead] dark:text-indigo-300"
                  : "bg-slate-100 text-slate-500",
              )}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3.5 mt-auto border-t border-slate-100">
        {/* AI-match indicator */}
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          AI-matched profile
        </span>

        {/* Invite / Shortlist button */}
        <button
          disabled={isInvited || isInviting}
          onClick={onInvite}
          className={cn(
            "rounded-[10px] px-4 py-[7px] text-[13.5px] font-semibold border transition-colors duration-150",
            isInvited
              ? "border-emerald-400 text-emerald-600 cursor-default"
              : "border-[#474ead] text-[#474ead] hover:bg-[#474ead] hover:text-white",
          )}
        >
          {isInviting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isInvited ? (
            <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" />Invited</span>
          ) : (
            "Shortlist"
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ENGAGEMENT_OPTIONS = ["All", "Full-Time", "Half-Day"] as const;
type EngagementFilter = (typeof ENGAGEMENT_OPTIONS)[number];

export default function SearchToShortlist() {
  const { toast } = useToast();

  // ── Stage ────────────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<"initial" | "active">("initial");
  const isInitial = stage === "initial";

  // ── Search inputs ────────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState("");
  const [engagementType, setEngagementType] = useState<"Full-Time" | "Half-Day">("Full-Time");

  // ── Post-search filters (client-side) ────────────────────────────────────────
  const [categoryFilter, setCategoryFilter] = useState<TalentBrowseCategory | null>(null);
  const [engagementFilter, setEngagementFilter] = useState<EngagementFilter>("All");

  // ── Results ──────────────────────────────────────────────────────────────────
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);

  // ── Dynamic suggestion chips ─────────────────────────────────────────────────
  const { data: suggestions = [] } = useQuery<Suggestion[]>({
    queryKey: ["talent-search-suggestions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client/talent-search/suggestions");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Map category → phrase, falling back to the category name itself
  const suggestionChips = useMemo(
    () =>
      suggestions.map((s) => ({
        category: s.category,
        phrase:
          TALENT_CATEGORY_PHRASES[s.category as TalentBrowseCategory] ?? s.category,
      })),
    [suggestions],
  );

  // ── Search mutations ─────────────────────────────────────────────────────────
  // NEW search — creates a scaffold job, resets everything
  const searchMutation = useMutation({
    mutationFn: async ({
      text,
      engType,
    }: {
      text: string;
      engType: "Full-Time" | "Half-Day";
    }) => {
      const res = await apiRequest("POST", "/api/client/talent-search", {
        searchText: text,
        category: null,
        engagementType: engType,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Search failed");
      }
      return res.json() as Promise<SearchResults>;
    },
    onSuccess: (data) => {
      setSearchResults(data);
      setCategoryFilter(null);
      setEngagementFilter("All");
    },
    onError: (err: any) => {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    },
  });

  // RESCORE — updates engagement type on the EXISTING scaffold job; no new job created
  const rescoreMutation = useMutation({
    mutationFn: async ({
      jobId,
      engType,
    }: {
      jobId: string;
      engType: "Full-Time" | "Half-Day";
    }) => {
      const res = await apiRequest("PATCH", `/api/client/talent-search/${jobId}`, {
        engagementType: engType,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Rescore failed");
      }
      return res.json() as Promise<SearchResults>;
    },
    onSuccess: (data) => {
      setSearchResults(data);
      setCategoryFilter(null);
    },
    onError: (err: any) => {
      toast({ title: "Rescore failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Filtered results (client-side category + engagement filter) ──────────────
  const filteredResults = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.results.filter((r) => {
      if (categoryFilter) {
        const cat = resolveBrowseCategory(r.candidate.category ?? r.candidate.category);
        if (cat !== categoryFilter && (r.candidate.category ?? "") !== categoryFilter) return false;
      }
      return true;
    });
  }, [searchResults, categoryFilter]);

  // ── Trigger search ───────────────────────────────────────────────────────────
  // Always creates a new scaffold job (new text or chip click).
  function runSearch(text?: string, engType?: "Full-Time" | "Half-Day") {
    const q = (text ?? searchText).trim();
    if (!q) { toast({ title: "Enter a search term" }); return; }
    const et = engType ?? engagementType;
    setSearchText(q);
    setEngagementType(et);
    setStage("active");
    searchMutation.mutate({ text: q, engType: et });
  }

  // ── Re-score against existing scaffold job (engagement type change only) ─────
  // Calls PATCH instead of POST — avoids creating a duplicate scaffold job.
  function rescore(engType: "Full-Time" | "Half-Day") {
    if (!searchResults?.jobId) {
      // No job yet (shouldn't happen in active stage, but fall back to a new search)
      runSearch(searchText, engType);
      return;
    }
    setEngagementType(engType);
    setEngagementFilter(engType);
    rescoreMutation.mutate({ jobId: searchResults.jobId, engType });
  }

  // ── Invite handler ───────────────────────────────────────────────────────────
  async function handleInvite(talentUserId: string) {
    if (!searchResults?.jobId) return;
    setInvitingId(talentUserId);
    try {
      const res = await apiRequest("POST", "/api/client/invitations", {
        jobId: searchResults.jobId,
        talentUserId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "already_invited") {
          setInvitedIds((p) => new Set(p).add(talentUserId));
          return;
        }
        throw new Error(body.message || "Failed to send invitation");
      }
      setInvitedIds((p) => new Set(p).add(talentUserId));
      toast({ title: "Invitation sent", description: "The talent will see your invitation on their dashboard." });
    } catch (err: any) {
      toast({ title: "Could not send invitation", description: err.message, variant: "destructive" });
    } finally {
      setInvitingId(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F7FA] dark:bg-[#060816]">
      <TopNavigation />

      {/* ── Search zone — transitions from centered to compact strip ── */}
      <div
        className={cn(
          "transition-[padding,background-color,border-color,box-shadow] duration-500 ease-in-out",
          isInitial
            ? "flex items-center justify-center min-h-[calc(100vh-4rem)] py-10"
            : "bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm py-5",
        )}
      >
        <div
          className={cn(
            "w-full transition-[max-width] duration-500 ease-in-out px-5",
            isInitial ? "max-w-2xl" : "max-w-5xl mx-auto",
          )}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2 shadow-[0_8px_24px_-12px_rgba(20,20,60,0.12)]">
            <Search className="h-[18px] w-[18px] text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
              placeholder="Tell us what you need"
              className="flex-1 bg-transparent border-none outline-none text-[15.5px] font-medium text-slate-800 dark:text-white placeholder:text-slate-400 placeholder:font-normal py-2.5"
            />
            <button
              onClick={() => runSearch()}
              disabled={searchMutation.isPending}
              className="bg-[#474ead] hover:bg-[#363c87] text-white font-semibold text-[15px] rounded-[10px] px-[22px] py-[11px] shrink-0 transition-colors disabled:opacity-60 flex items-center gap-2 whitespace-nowrap"
            >
              {searchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Hire Talent →"
              )}
            </button>
          </div>

          {/* Suggestion chips — dynamic, always visible */}
          {suggestionChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {suggestionChips.map(({ category, phrase }) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => runSearch(phrase)}
                  className="text-[13px] font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-[13px] py-[6px] hover:border-[#474ead] hover:text-[#474ead] transition-[border-color,color] duration-150 cursor-pointer"
                >
                  {phrase}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Results — revealed on action ── */}
      <AnimatePresence>
        {stage === "active" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            className="max-w-5xl mx-auto px-5 pt-8 pb-20"
          >
            {/* Results header */}
            <div className="mb-6">
              <h1 className="text-[24px] font-extrabold tracking-tight text-slate-900 dark:text-white mb-1.5">
                {searchMutation.isPending
                  ? "Searching…"
                  : searchResults
                    ? `Matches for "${searchText}"`
                    : "Matches"}
              </h1>
              <p className="text-[14.5px] text-slate-500 dark:text-slate-400">
                Ranked by fit. Skills that matched your search are highlighted in{" "}
                <span className="text-[#474ead] font-semibold">blue</span>.
              </p>
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 mb-6 border-b border-slate-200 dark:border-slate-700">
              {/* Category chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-slate-400 font-semibold mr-0.5">Role:</span>
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={cn(
                    "text-[13.5px] font-semibold rounded-full px-[14px] py-[7px] border transition-colors duration-150",
                    !categoryFilter
                      ? "bg-[#EFEFFA] text-[#474ead] border-[#EFEFFA]"
                      : "text-slate-500 border-slate-200 dark:border-slate-700 hover:border-[#474ead]",
                  )}
                >
                  All roles
                </button>
                {TALENT_BROWSE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter((prev) => (prev === cat ? null : cat))}
                    className={cn(
                      "text-[13.5px] font-semibold rounded-full px-[14px] py-[7px] border transition-colors duration-150",
                      categoryFilter === cat
                        ? "bg-[#EFEFFA] text-[#474ead] border-[#EFEFFA]"
                        : "text-slate-500 border-slate-200 dark:border-slate-700 hover:border-[#474ead]",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Engagement type — rescores against existing scaffold job (no new job created) */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[13px] text-slate-400 font-semibold">Engagement:</span>
                {ENGAGEMENT_OPTIONS.map((et) => (
                  <button
                    key={et}
                    disabled={rescoreMutation.isPending}
                    onClick={() => {
                      if (et === "All") {
                        setEngagementFilter("All");
                        // "All" has no re-score meaning — just clears the active pill
                      } else {
                        rescore(et);
                      }
                    }}
                    className={cn(
                      "text-[13.5px] font-semibold rounded-full px-[14px] py-[7px] border transition-colors duration-150",
                      engagementFilter === et
                        ? "bg-[#EFEFFA] text-[#474ead] border-[#EFEFFA]"
                        : "text-slate-500 border-slate-200 dark:border-slate-700 hover:border-[#474ead]",
                      rescoreMutation.isPending && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {rescoreMutation.isPending && engagementFilter !== et ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />{et}
                      </span>
                    ) : et}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading */}
            {searchMutation.isPending && (
              <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-[#474ead]" />
                <p className="text-sm">Scoring talent profiles…</p>
              </div>
            )}

            {/* Results grid */}
            {!searchMutation.isPending && filteredResults.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredResults.map((r) => (
                  <ResultCard
                    key={r.candidateId}
                    result={r}
                    isInvited={invitedIds.has(r.userId)}
                    isInviting={invitingId === r.userId}
                    onInvite={() => handleInvite(r.userId)}
                  />
                ))}
              </div>
            )}

            {/* Empty results */}
            {!searchMutation.isPending && searchResults && filteredResults.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
                <p className="font-semibold text-slate-700 dark:text-slate-300">No matching profiles found</p>
                <p className="mt-1 text-sm text-slate-400">
                  {categoryFilter
                    ? `No results in "${categoryFilter}" — try All roles or a different category.`
                    : "Try broadening your search."}
                </p>
                {categoryFilter && (
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className="mt-3 text-sm text-[#474ead] font-semibold hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}

            {/* Invited summary */}
            {invitedIds.size > 0 && (
              <div className="mt-8 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  <span className="font-semibold">
                    {invitedIds.size} invitation{invitedIds.size !== 1 ? "s" : ""} sent.
                  </span>{" "}
                  Invited talent can accept or decline directly from their dashboard.
                </p>
              </div>
            )}

            {/* Assist banner */}
            {!searchMutation.isPending && searchResults && (
              <div className="mt-8 text-center text-[14px] text-slate-500 bg-[#EFEFFA] dark:bg-indigo-950/30 rounded-xl px-4 py-[18px]">
                Don't see the right fit?{" "}
                <a href="mailto:careers@onspotglobal.com" className="text-[#474ead] font-bold hover:underline">
                  Request a shortlist
                </a>{" "}
                — same rate, we do the searching.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
