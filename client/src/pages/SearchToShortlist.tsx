import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
import { isInvitableJob, type InvitationPickerJob, type InvitationReadiness } from "@/lib/invitationReadiness";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Check, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { TopNavigation } from "@/components/TopNavigation";
import { ClientTalentShortlistDialog } from "@/components/ClientTalentShortlistDialog";
import type { ClientTalentInviteTarget } from "@/components/ClientTalentInviteDialog";
import { useClientShortlists } from "@/hooks/useClientShortlists";
import { useAuth } from "@/contexts/AuthContext";
import { getPrivacySafeTalentDisplayName } from "@/lib/formatPublicTalentName";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TalentResult {
  candidateId: string;
  userId: string;
  score: number;
  overlapSkills: string[];
  matchReasons: Record<string, any>;
  candidate: {
    maskedName?: string | null;
    fullName?: string | null;
    full_name?: string | null;
    firstName?: string | null;
    first_name?: string | null;
    lastName?: string | null;
    last_name?: string | null;
    targetPosition?: string;
    target_position?: string;
    location?: string;
    seniority?: string;
    coreSkills?: string[];
    core_skills?: string[];
    secondarySkills?: string[];
    secondary_skills?: string[];
    category?: string;
    isVetted?: boolean;
    isVerified?: boolean;
  };
}

interface SearchResults {
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

function getResultName(candidate: TalentResult["candidate"]): string {
  return getPrivacySafeTalentDisplayName(candidate);
}

// ─── Result Row ───────────────────────────────────────────────────────────────

function ResultRow({
  result,
  isInvited,
  isInviting,
  onInvite,
  isShortlisted,
  onShortlist,
}: {
  result: TalentResult;
  isInvited: boolean;
  isInviting: boolean;
  onInvite: () => void;
  isShortlisted: boolean;
  onShortlist: () => void;
}) {
  const { candidate } = result;

  const name = getResultName(candidate);
  const position = candidate.targetPosition ?? candidate.target_position;

  // Availability — use seniority as proxy; most talent is available
  const isAvailable = !candidate.seniority?.toLowerCase().includes("unavailable");

  const signal = isAvailable
    ? `Available now · ${result.score}% match`
    : `${result.score}% match`;

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
            {name}
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

      {/* Verified / Vetted badges */}
      {candidate.isVerified && (
        <span className="shrink-0 inline-flex items-center gap-[4px] rounded-full bg-green-500/10 px-2.5 py-[4px] text-[11.5px] font-semibold text-green-700 border border-green-500/20">
          <CheckCircle2 className="h-3 w-3" />
          Verified
        </span>
      )}
      {candidate.isVetted && (
        <span className="shrink-0 inline-flex items-center gap-[4px] rounded-full bg-[#474ead]/10 px-2.5 py-[4px] text-[11.5px] font-semibold text-[#474ead] border border-[#474ead]/20">
          <ShieldCheck className="h-3 w-3" />
          Vetted
        </span>
      )}

      {/* Separate shortlist and interview actions */}
      <button
        disabled={isInvited || isInviting}
        onClick={onShortlist}
        className={cn(
          "shrink-0 rounded-[10px] px-4 py-[7px] text-[13.5px] font-semibold border transition-colors duration-150",
          isInvited || isShortlisted
            ? "border-emerald-400 text-emerald-600 cursor-default"
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
        ) : isShortlisted ? (
          <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Shortlisted</span>
        ) : (
          "Shortlist"
        )}
      </button>
      {!isInvited && (
        <button onClick={onInvite} disabled={isInviting} className="shrink-0 rounded-[10px] bg-[#474ead] px-4 py-[7px] text-[13.5px] font-semibold text-white disabled:opacity-60">
          Interview
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ENGAGEMENT_OPTIONS = ["All", "Standard", "Lite"] as const;
type EngagementFilter = (typeof ENGAGEMENT_OPTIONS)[number];

export default function SearchToShortlist() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isClient = user?.role === "client";
  const [shortlistTarget, setShortlistTarget] = useState<ClientTalentInviteTarget | null>(null);
  const { shortlists } = useClientShortlists(isClient);
  const shortlistedIds = useMemo(
    () => new Set(shortlists.flatMap((item) => [item.talentId, item.candidateId].filter(Boolean) as string[])),
    [shortlists],
  );

  // ── Stage ─────────────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<"initial" | "active">("initial");
  const isInitial = stage === "initial";

  // ── Search inputs ─────────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState("");
  const [engagementType, setEngagementType] = useState<"Standard" | "Lite">("Standard");

  // ── Post-search filters (client-side) ─────────────────────────────────────────
  const [categoryFilter, setCategoryFilter] = useState<TalentBrowseCategory | null>(null);
  const [engagementFilter, setEngagementFilter] = useState<EngagementFilter>("All");

  // ── Refine panel toggle ───────────────────────────────────────────────────────
  const [refineOpen, setRefineOpen] = useState(false);

  // ── Results ───────────────────────────────────────────────────────────────────
  const [baseResults, setBaseResults] = useState<SearchResults | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);

  // ── Job picker ────────────────────────────────────────────────────────────────
  const [pickerTarget, setPickerTarget] = useState<{ talentUserId: string; talentName: string } | null>(null);
  const [pickerJobs, setPickerJobs] = useState<InvitationPickerJob[]>([]);
  const [pickerReadiness, setPickerReadiness] = useState<InvitationReadiness | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSelectedJobId, setPickerSelectedJobId] = useState<string | null>(null);
  const [pickerSending, setPickerSending] = useState(false);
  const [inviteDateTime, setInviteDateTime] = useState("");

  // ── Dynamic suggestion chips ──────────────────────────────────────────────────
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
        phrase:
          TALENT_CATEGORY_PHRASES[s.category as TalentBrowseCategory] ?? s.category,
      })),
    [suggestions],
  );

  // ── Search mutation ───────────────────────────────────────────────────────────
  const searchMutation = useMutation({
    mutationFn: async ({
      text,
      engType,
      isBaseSearch,
    }: {
      text: string;
      engType: "Standard" | "Lite";
      isBaseSearch: boolean;
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
      return { data: (await res.json()) as SearchResults, isBaseSearch };
    },
    onSuccess: ({ data, isBaseSearch }) => {
      setSearchResults(data);
      if (isBaseSearch) {
        setBaseResults(data);
        setCategoryFilter(null);
        setEngagementFilter("All");
      }
    },
    onError: (err: any) => {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    },
  });

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
  function runSearch(text?: string, engType?: "Standard" | "Lite", isBaseSearch = true) {
    const q = (text ?? searchText).trim();
    if (!q) { toast({ title: "Enter a search term" }); return; }
    const et = engType ?? engagementType;
    setSearchText(q);
    setEngagementType(et);
    setStage("active");
    searchMutation.mutate({ text: q, engType: et, isBaseSearch });
  }

  // ── Job picker — open, confirm, close ─────────────────────────────────────────
  function closePicker() {
    setPickerTarget(null);
    setPickerJobs([]);
    setPickerReadiness(null);
    setPickerError(null);
    setPickerSelectedJobId(null);
    setInviteDateTime("");
  }

  async function handleInvite(talentUserId: string, talentName?: string) {
    // Open picker — fetch client's open jobs and let them choose which role to invite to.
    const name = talentName ?? (searchResults
      ? getResultName(searchResults.results.find((r) => r.userId === talentUserId)?.candidate ?? {})
      : "Talent");
    setPickerTarget({ talentUserId, talentName: name });
    setPickerLoading(true);
    setPickerError(null);
    setPickerReadiness(null);
    setPickerSelectedJobId(null);
    try {
      const res = await apiRequest("GET", "/api/client/invitation-readiness");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.jobs) || !data.summary || !data.msa) {
        throw new Error(data.message || data.error || "Could not load your job postings");
      }
      setPickerReadiness(data as InvitationReadiness);
      setPickerJobs(data.jobs.filter(isInvitableJob));
    } catch (err: any) {
      setPickerJobs([]);
      setPickerError(err.message || "Could not load your job postings");
    } finally {
      setPickerLoading(false);
    }
  }

  async function confirmInvite(jobId: string) {
    if (!pickerTarget) return;
    if (!inviteDateTime) {
      toast({ title: "Choose an interview time", description: "Every new invitation includes an initial interview proposal.", variant: "destructive" });
      return;
    }
    const { talentUserId } = pickerTarget;
    setPickerSending(true);
    setInvitingId(talentUserId);
    try {
      const payload = {
        jobId,
        talentUserId,
        proposedTimes: [{ start: new Date(inviteDateTime).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }],
      };
      let res = await apiRequest("POST", "/api/client/invitations", payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "already_invited") {
          setInvitedIds((p) => new Set(p).add(talentUserId));
          closePicker();
          return;
        }
        if (body.error === "msa_required") {
          window.open(body.termsUrl || "/terms-and-conditions", "_blank", "noopener,noreferrer");
          const accepted = window.confirm("Please review the Terms of Service in the opened tab. Press OK only if you accept them to send this invitation.");
          if (!accepted) return;
          const msaRes = await apiRequest("POST", "/api/client/msa-acceptance", { accepted: true });
          if (!msaRes.ok) throw new Error("Please accept the Terms of Service before inviting talent.");
          res = await apiRequest("POST", "/api/client/invitations", payload);
        }
        if (!res.ok) {
          const retryBody = await res.json().catch(() => ({}));
          throw new Error(retryBody.message || retryBody.error || "Failed to send invitation");
        }
      }
      setInvitedIds((p) => new Set(p).add(talentUserId));
      toast({ title: "Invitation sent", description: "The talent will see your invitation on their dashboard." });
      closePicker();
    } catch (err: any) {
      toast({ title: "Could not send invitation", description: err.message, variant: "destructive" });
    } finally {
      setPickerSending(false);
      setInvitingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const pickerState = pickerReadiness?.summary.state;
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
            {/* Results header — heading + Refine toggle on one line */}
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

                {/* Engagement type filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] text-slate-400 font-semibold">Engagement:</span>
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
                    isInvited={invitedIds.has(r.userId)}
                    isInviting={invitingId === r.userId}
                    isShortlisted={shortlistedIds.has(r.userId)}
                    onShortlist={() => {
                      if (!isClient) {
                        toast({ title: "Sign in as a client to shortlist talent" });
                        return;
                      }
                      setShortlistTarget({
                        id: r.userId,
                        idType: "talentUser",
                        name: getResultName(r.candidate),
                      });
                    }}
                    onInvite={() => handleInvite(r.userId, getResultName(r.candidate))}
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

            {/* Assist line — plain text, no background treatment */}
            {!searchMutation.isPending && searchResults && (
              <p className="mt-8 text-center text-[13.5px] text-slate-400 dark:text-slate-500">
                Don't see the right fit?{" "}
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

      {/* ── Job picker modal ─────────────────────────────────────────────────
          Branches on open approved job count: 0 = post-first, 1 = confirm, 2+ = pick.
          Cancel clears state with no network call.
      ────────────────────────────────────────────────────────────────────── */}
      {pickerTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={closePicker}
          >
            <div
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {pickerLoading ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#474ead]" />
                  <p className="text-sm text-slate-500">Loading job postings…</p>
                </div>
              ) : pickerError ? (
                <div className="p-6">
                  <h3 className="text-[17px] font-bold text-slate-900 dark:text-white mb-2">
                    We couldn’t load your job postings
                  </h3>
                  <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mb-5">
                    {pickerError}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={closePicker}
                      className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13.5px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => pickerTarget && handleInvite(pickerTarget.talentUserId, pickerTarget.talentName)}
                      className="rounded-[10px] bg-[#474ead] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#363c87] transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : pickerJobs.length === 0 ? (
                <div className="p-6">
                  {pickerReadiness?.msa.required && (
                    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/20">
                      <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-300">
                        Terms acceptance required for your first invitation
                      </p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800/80 dark:text-amber-400/80">
                        <a href={pickerReadiness.msa.termsUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Read the Terms of Service</a>. Acceptance is recorded when you send your first invitation.
                      </p>
                    </div>
                  )}
                  <h3 className="text-[17px] font-bold text-slate-900 dark:text-white mb-2">
                    {pickerState === "pending_approval"
                      ? "Your job is awaiting approval"
                      : pickerState === "closed_jobs"
                        ? "Your job postings are closed"
                        : pickerState === "scaffold_only"
                          ? "Create a real job posting to invite talent"
                          : pickerState === "not_ready"
                            ? "Your job posting isn’t ready yet"
                          : "No job postings yet"}
                  </h3>
                  <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mb-5">
                    {pickerState === "pending_approval"
                      ? <>Your job posting is being reviewed. You don’t need to create another one — we’ll let you know when it is approved and ready for an invitation to <span className="font-semibold text-slate-700 dark:text-slate-300">{pickerTarget.talentName}</span>.</>
                      : pickerState === "closed_jobs"
                        ? <>Your job postings are closed. Reopen an approved posting before inviting <span className="font-semibold text-slate-700 dark:text-slate-300">{pickerTarget.talentName}</span>.</>
                        : pickerState === "scaffold_only"
                          ? <>Your search has a saved placeholder, but invitations require a real approved job posting for <span className="font-semibold text-slate-700 dark:text-slate-300">{pickerTarget.talentName}</span>.</>
                          : pickerState === "not_ready"
                            ? <>Your job posting must be open and approved before you can invite <span className="font-semibold text-slate-700 dark:text-slate-300">{pickerTarget.talentName}</span>.</>
                          : <>You need an active, approved job posting to invite <span className="font-semibold text-slate-700 dark:text-slate-300">{pickerTarget.talentName}</span>. Create one first, then come back to send the invitation.</>}
                  </p>
                  <div className="flex justify-end">
                    <button
                      onClick={closePicker}
                      className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13.5px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Close
                    </button>
                    <a
                      href="/client-profile"
                      className="rounded-[10px] bg-[#474ead] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#363c87] transition-colors"
                    >
                      {pickerState === "pending_approval" || pickerState === "closed_jobs" || pickerState === "not_ready"
                        ? "View job postings →"
                        : "Post a Job →"}
                    </a>
                  </div>
                </div>
              ) : pickerJobs.length === 1 ? (
                <div className="p-6">
                  {pickerReadiness?.msa.required && (
                    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/20">
                      <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-300">
                        Terms acceptance required for your first invitation
                      </p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800/80 dark:text-amber-400/80">
                        <a href={pickerReadiness.msa.termsUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Read the Terms of Service</a>. When you send this invitation, you’ll be asked to confirm acceptance so we can record it.
                      </p>
                    </div>
                  )}
                  <h3 className="text-[17px] font-bold text-slate-900 dark:text-white mb-1">
                    Invite {pickerTarget.talentName}?
                  </h3>
                  <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mb-5">
                    They'll be invited to:{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{pickerJobs[0].title}</span>
                    {pickerJobs[0].engagementType && (
                      <span className="ml-1 text-slate-400">· {pickerJobs[0].engagementType}</span>
                    )}
                  </p>
                   <label className="block mb-5">
                     <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Propose an initial interview time</span>
                     <input type="datetime-local" value={inviteDateTime} onChange={(e) => setInviteDateTime(e.target.value)} className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#474ead] focus:ring-2 focus:ring-[#474ead]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" required />
                   </label>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={closePicker}
                      disabled={pickerSending || !inviteDateTime}
                      className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13.5px] font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => confirmInvite(pickerJobs[0].id)}
                      disabled={pickerSending || !inviteDateTime}
                      className="rounded-[10px] bg-[#474ead] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#363c87] transition-colors disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {pickerSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send invitation"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  {pickerReadiness?.msa.required && (
                    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/20">
                      <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-300">
                        Terms acceptance required for your first invitation
                      </p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800/80 dark:text-amber-400/80">
                        <a href={pickerReadiness.msa.termsUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Read the Terms of Service</a>. When you send this invitation, you’ll be asked to confirm acceptance so we can record it.
                      </p>
                    </div>
                  )}
                  <h3 className="text-[17px] font-bold text-slate-900 dark:text-white mb-1">
                    Invite {pickerTarget.talentName} to which role?
                  </h3>
                  <p className="text-[13.5px] text-slate-400 mb-4">Select a job posting.</p>
                   <label className="block mb-4">
                     <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Propose an initial interview time</span>
                     <input type="datetime-local" value={inviteDateTime} onChange={(e) => setInviteDateTime(e.target.value)} className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#474ead] focus:ring-2 focus:ring-[#474ead]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" required />
                   </label>
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-5 pr-1">
                    {pickerJobs.map((job) => (
                      <button
                        key={job.id}
                        onClick={() => setPickerSelectedJobId(job.id)}
                        className={cn(
                          "text-left rounded-[10px] px-4 py-3 border text-[13.5px] font-semibold transition-colors duration-150",
                          pickerSelectedJobId === job.id
                            ? "border-[#474ead] bg-[#EFEFFA] text-[#474ead]"
                            : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#474ead] hover:text-[#474ead]",
                        )}
                      >
                        {job.title}
                        {job.engagementType && (
                          <span className="ml-2 text-[12px] font-normal text-slate-400">{job.engagementType}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={closePicker}
                      disabled={pickerSending}
                      className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13.5px] font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => pickerSelectedJobId && confirmInvite(pickerSelectedJobId)}
                      disabled={!pickerSelectedJobId || !inviteDateTime || pickerSending}
                      className="rounded-[10px] bg-[#474ead] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#363c87] transition-colors disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {pickerSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send invitation"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
      <ClientTalentShortlistDialog
        target={shortlistTarget}
        onClose={() => setShortlistTarget(null)}
      />
    </div>
  );
}
