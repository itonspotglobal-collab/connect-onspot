import { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Check, Loader2, AlertCircle } from "lucide-react";
import { TopNavigation } from "@/components/TopNavigation";
import { SignUpDialog } from "@/components/SignUpDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TalentResult {
  candidateId: string;
  userId: string;
  score: number;
  overlapSkills: string[];
  matchReasons: Record<string, any>;
  candidate: {
    // Sanitizer returns fullName (masked "Jane S." or "Talent Profile")
    fullName?: string | null;
    full_name?: string | null;
    targetPosition?: string;
    target_position?: string;
    location?: string;
    seniority?: string;
    coreSkills?: string[];
    core_skills?: string[];
    secondarySkills?: string[];
    secondary_skills?: string[];
    category?: string;
    availability?: string;
  };
}

interface SearchResults {
  jobId?: string; // only present for authenticated client searches
  results: TalentResult[];
}

interface Suggestion {
  category: string;
}

interface PendingSearchState {
  query: string;
  engagementType: string;
  pendingTalentId: string | null;
  pendingTalentName: string | null;
}

const STORAGE_KEY = "onspot_pending_search";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name?: string | null): string {
  if (!name || name.toLowerCase() === "talent profile") return "TA";
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "TA"
  );
}

// ─── Result Row ───────────────────────────────────────────────────────────────

function ResultRow({
  result,
  isInvited,
  isInviting,
  isAnonymous,
  onShortlist,
}: {
  result: TalentResult;
  isInvited: boolean;
  isInviting: boolean;
  isAnonymous: boolean;
  onShortlist: () => void;
}) {
  const { candidate } = result;

  // sanitizeSearchCandidate returns fullName (server-masked to "Jane S." or "Talent Profile")
  const name = candidate.fullName ?? candidate.full_name ?? null;
  const position = candidate.targetPosition ?? candidate.target_position;

  const isAvailable = !candidate.seniority?.toLowerCase().includes("unavailable");

  const signal = isAvailable
    ? `Available now · ${result.score}% AI-matched profile`
    : `${result.score}% AI-matched profile`;

  const desc = candidate.category
    ? `${resolveBrowseCategory(candidate.category) ?? candidate.category} specialist`
    : position
      ? `Experienced ${position.toLowerCase()}`
      : "Experienced professional available for remote work.";

  return (
    <div className="flex items-center gap-4 py-5 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0 rounded-[10px]">
        <AvatarFallback
          className={cn(
            "rounded-[10px] font-bold text-[13px]",
            isAvailable
              ? "bg-[#EFEFFA] text-[#474ead]"
              : "bg-slate-100 text-slate-400",
          )}
        >
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      {/* Name + signal + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
            {name ?? "Talent Profile"}
          </h3>
          <span
            className={cn(
              "inline-flex items-center gap-[5px] text-[12.5px] font-semibold",
              isAvailable ? "text-[#B8790F]" : "text-slate-400 dark:text-slate-500",
            )}
          >
            {isAvailable && (
              <span className="w-[5px] h-[5px] rounded-full bg-[#F5A623] inline-block shrink-0" />
            )}
            {signal}
          </span>
        </div>
        <p className="text-[13.5px] text-slate-500 dark:text-slate-400 truncate leading-snug">
          {desc}
        </p>
      </div>

      {/* Shortlist button */}
      <button
        disabled={isInvited || isInviting}
        onClick={onShortlist}
        className={cn(
          "shrink-0 rounded-[10px] px-4 py-[7px] text-[13.5px] font-semibold border transition-colors duration-150",
          isInvited
            ? "border-emerald-400 text-emerald-600 cursor-default"
            : isAnonymous
              ? "border-[#474ead] text-[#474ead] hover:bg-[#474ead] hover:text-white"
              : "border-[#474ead] text-[#474ead] hover:bg-[#474ead] hover:text-white",
        )}
      >
        {isInviting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isInvited ? (
          <span className="flex items-center gap-1">
            <Check className="h-3.5 w-3.5" />
            Invited
          </span>
        ) : (
          "Shortlist"
        )}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ENGAGEMENT_OPTIONS = ["All", "Full-Time", "Half-Day"] as const;
type EngagementFilter = (typeof ENGAGEMENT_OPTIONS)[number];

export default function HireTalentPage() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();

  // A visitor is treated as an authenticated client only when they have a
  // client role — talent users should use the anonymous/public path.
  const isClient = isAuthenticated && user?.role === "client";
  const isAnonymous = !isClient;

  // ── Auth modals ───────────────────────────────────────────────────────────────
  const [showSignUp, setShowSignUp] = useState(false);

  // ── Stage ─────────────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<"initial" | "active">("initial");
  const isInitial = stage === "initial";

  // ── Search inputs ─────────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState("");
  const [engagementType, setEngagementType] = useState<"Full-Time" | "Half-Day">("Full-Time");

  // ── Post-search filters (client-side) ─────────────────────────────────────────
  const [categoryFilter, setCategoryFilter] = useState<TalentBrowseCategory | null>(null);
  const [engagementFilter, setEngagementFilter] = useState<EngagementFilter>("All");

  // ── Refine panel ──────────────────────────────────────────────────────────────
  const [refineOpen, setRefineOpen] = useState(false);

  // ── Results ───────────────────────────────────────────────────────────────────
  const [baseResults, setBaseResults] = useState<SearchResults | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);

  // ── Pending invite confirmation (restored after sign-up) ──────────────────────
  const [pendingInvite, setPendingInvite] = useState<{
    talentUserId: string;
    talentName: string;
    query: string;
  } | null>(null);
  const [isConfirmingInvite, setIsConfirmingInvite] = useState(false);

  // ── Suggestion chips ──────────────────────────────────────────────────────────
  // Suggestions endpoint is public — no auth required.
  const { data: suggestions = [] } = useQuery<Suggestion[]>({
    queryKey: ["talent-search-suggestions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client/talent-search/suggestions");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const suggestionChips = useMemo(
    () =>
      suggestions.map((s) => ({
        category: s.category,
        phrase: TALENT_CATEGORY_PHRASES[s.category as TalentBrowseCategory] ?? s.category,
      })),
    [suggestions],
  );

  // ── Search mutation ───────────────────────────────────────────────────────────
  const searchMutation = useMutation({
    mutationFn: async ({
      text,
      engType,
      isBaseSearch,
      pendingTalentId,
      pendingTalentName,
    }: {
      text: string;
      engType: "Full-Time" | "Half-Day";
      isBaseSearch: boolean;
      pendingTalentId?: string | null;
      pendingTalentName?: string | null;
    }) => {
      // Use the public endpoint for anonymous visitors — no DB write.
      // Use the authenticated endpoint for clients — creates scaffold job + returns jobId.
      const endpoint = isClient
        ? "/api/client/talent-search"
        : "/api/talent-search";

      const res = await apiRequest("POST", endpoint, {
        searchText: text,
        category: null,
        engagementType: engType,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Search failed");
      }
      return {
        data: (await res.json()) as SearchResults,
        isBaseSearch,
        pendingTalentId: pendingTalentId ?? null,
        pendingTalentName: pendingTalentName ?? null,
      };
    },
    onSuccess: ({ data, isBaseSearch, pendingTalentId, pendingTalentName }) => {
      setSearchResults(data);
      if (isBaseSearch) {
        setBaseResults(data);
        setCategoryFilter(null);
        setEngagementFilter("All");
      }
      // After auth-restore: if the visitor had clicked Shortlist before signing up,
      // surface a confirmation banner — do NOT auto-fire the invite.
      if (pendingTalentId && pendingTalentName) {
        setPendingInvite({
          talentUserId: pendingTalentId,
          talentName: pendingTalentName,
          query: searchText,
        });
      }
    },
    onError: (err: any) => {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Restore pending search state after authentication ────────────────────────
  // When a visitor clicks Shortlist while logged out, their search params +
  // intended talentId are saved to sessionStorage. After they sign up/log in
  // (same tab), this effect fires, restores the search, and queues a confirmation
  // prompt. sessionStorage.removeItem runs immediately to prevent double-fire.
  useEffect(() => {
    if (isLoading) return;
    if (!isClient) return;

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(STORAGE_KEY);

    try {
      const saved: PendingSearchState = JSON.parse(raw);
      if (!saved.query?.trim()) return;

      const engType =
        saved.engagementType === "Half-Day" ? "Half-Day" : "Full-Time";

      setSearchText(saved.query);
      setEngagementType(engType);
      setStage("active");
      searchMutation.mutate({
        text: saved.query,
        engType,
        isBaseSearch: true,
        pendingTalentId: saved.pendingTalentId,
        pendingTalentName: saved.pendingTalentName,
      });
    } catch {
      // Malformed storage — silently ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, isLoading]);

  // ── Filtered results (client-side category filter) ────────────────────────────
  const filteredResults = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.results.filter((r) => {
      if (categoryFilter) {
        const cat = resolveBrowseCategory(r.candidate.category ?? "");
        if (cat !== categoryFilter && (r.candidate.category ?? "") !== categoryFilter) return false;
      }
      return true;
    });
  }, [searchResults, categoryFilter]);

  // ── Trigger search ────────────────────────────────────────────────────────────
  function runSearch(text?: string, engType?: "Full-Time" | "Half-Day", isBaseSearch = true) {
    const q = (text ?? searchText).trim();
    if (!q) { toast({ title: "Enter a search term" }); return; }
    const et = engType ?? engagementType;
    setSearchText(q);
    setEngagementType(et);
    setStage("active");
    searchMutation.mutate({ text: q, engType: et, isBaseSearch });
  }

  // ── Shortlist handler ─────────────────────────────────────────────────────────
  function handleShortlist(talentUserId: string, talentName: string) {
    if (isAnonymous) {
      // Save search state + intended invite target, then prompt sign-up.
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          query: searchText,
          engagementType,
          pendingTalentId: talentUserId,
          pendingTalentName: talentName,
        } satisfies PendingSearchState),
      );
      setShowSignUp(true);
      return;
    }
    // Authenticated client — send invitation immediately.
    sendInvite(talentUserId);
  }

  // ── Invite API ────────────────────────────────────────────────────────────────
  async function sendInvite(talentUserId: string) {
    if (!searchResults?.jobId) {
      toast({ title: "No active job", description: "Please run a search first.", variant: "destructive" });
      return;
    }
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
      toast({
        title: "Invitation sent",
        description: "The talent will see your invitation on their dashboard.",
      });
    } catch (err: any) {
      toast({ title: "Could not send invitation", description: err.message, variant: "destructive" });
    } finally {
      setInvitingId(null);
    }
  }

  // ── Confirm pending invite (shown after auth restores search) ─────────────────
  async function confirmPendingInvite() {
    if (!pendingInvite) return;
    setIsConfirmingInvite(true);
    await sendInvite(pendingInvite.talentUserId);
    setPendingInvite(null);
    setIsConfirmingInvite(false);
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
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

          {/* Suggestion chips — dynamic from real job volume */}
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
            {/* Pending invite confirmation banner — shown after auth restores search */}
            {pendingInvite && searchResults?.jobId && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#474ead]/30 bg-[#EFEFFA] px-4 py-4">
                <AlertCircle className="h-4 w-4 text-[#474ead] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-slate-800">
                    You were about to invite{" "}
                    <span className="text-[#474ead]">{pendingInvite.talentName}</span>{" "}
                    for &ldquo;{pendingInvite.query}&rdquo; — send now?
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={confirmPendingInvite}
                    disabled={isConfirmingInvite}
                    className="rounded-[8px] bg-[#474ead] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#363c87] transition-colors disabled:opacity-60"
                  >
                    {isConfirmingInvite ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Send invitation"
                    )}
                  </button>
                  <button
                    onClick={() => setPendingInvite(null)}
                    className="rounded-[8px] border border-slate-200 px-3 py-1.5 text-[12.5px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Results header — heading + Refine toggle */}
            <div className="flex items-baseline justify-between mb-5 pb-5 border-b border-slate-200 dark:border-slate-700">
              <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                {searchMutation.isPending
                  ? "Searching…"
                  : searchResults
                    ? `Matches for "${searchText}"`
                    : "Matches"}
              </h1>
              <button
                onClick={() => setRefineOpen((o) => !o)}
                className="text-[13.5px] font-semibold text-slate-500 hover:text-[#474ead] transition-colors duration-150 py-1"
              >
                {refineOpen ? "Refine ▴" : "Refine ▾"}
              </button>
            </div>

            {/* Collapsible filter row */}
            {refineOpen && (
              <div className="flex flex-col gap-3 pb-5 mb-2 border-b border-slate-200 dark:border-slate-700">
                {/* Role / category chips */}
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

                {/* Engagement Type — Half-Day / Full-Time only */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] text-slate-400 font-semibold">Engagement Type:</span>
                  {ENGAGEMENT_OPTIONS.map((et) => (
                    <button
                      key={et}
                      onClick={() => {
                        setEngagementFilter(et);
                        if (et === "All") {
                          if (baseResults) setSearchResults(baseResults);
                        } else {
                          setEngagementType(et);
                          runSearch(searchText, et, false);
                        }
                      }}
                      className={cn(
                        "text-[13.5px] font-semibold rounded-full px-[14px] py-[7px] border transition-colors duration-150",
                        engagementFilter === et
                          ? "bg-[#EFEFFA] text-[#474ead] border-[#EFEFFA]"
                          : "text-slate-500 border-slate-200 dark:border-slate-700 hover:border-[#474ead]",
                      )}
                    >
                      {et}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading */}
            {searchMutation.isPending && (
              <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-[#474ead]" />
                <p className="text-sm">Scoring talent profiles…</p>
              </div>
            )}

            {/* Results list — single column, hairline-separated rows */}
            {!searchMutation.isPending && filteredResults.length > 0 && (
              <div className="flex flex-col">
                {filteredResults.map((r) => (
                  <ResultRow
                    key={r.candidateId}
                    result={r}
                    isAnonymous={isAnonymous}
                    isInvited={invitedIds.has(r.userId)}
                    isInviting={invitingId === r.userId}
                    onShortlist={() =>
                      handleShortlist(
                        r.userId,
                        r.candidate.fullName ?? r.candidate.full_name ?? "Talent Profile",
                      )
                    }
                  />
                ))}
              </div>
            )}

            {/* Empty results */}
            {!searchMutation.isPending && searchResults && filteredResults.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  No matching profiles found
                </p>
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

            {/* Sign-up nudge for anonymous visitors who haven't clicked Shortlist yet */}
            {isAnonymous && !searchMutation.isPending && searchResults && filteredResults.length > 0 && (
              <p className="mt-8 text-center text-[13.5px] text-slate-400 dark:text-slate-500">
                Ready to invite?{" "}
                <button
                  onClick={() => setShowSignUp(true)}
                  className="text-[#474ead] font-semibold hover:underline"
                >
                  Create a free account
                </button>{" "}
                to shortlist and send invitations.
              </p>
            )}

            {/* Assist line for authenticated clients */}
            {!isAnonymous && !searchMutation.isPending && searchResults && (
              <p className="mt-8 text-center text-[13.5px] text-slate-400 dark:text-slate-500">
                Don&apos;t see the right fit?{" "}
                <a
                  href="mailto:careers@onspotglobal.com"
                  className="text-[#474ead] font-semibold hover:underline"
                >
                  Request a shortlist
                </a>{" "}
                — same rate, we do the searching.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Auth modals ── */}
      <SignUpDialog
        open={showSignUp}
        onOpenChange={setShowSignUp}
        hideTrigger
        onSignInInstead={() => { setShowSignUp(false); }}
      />
    </div>
  );
}
