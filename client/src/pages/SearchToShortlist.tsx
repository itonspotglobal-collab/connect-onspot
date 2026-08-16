import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TALENT_BROWSE_CATEGORIES } from "@/lib/jobConstants";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  Sparkles,
  Users,
  Check,
  Loader2,
  RotateCcw,
} from "lucide-react";
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

function matchBadge(score: number): { label: string; className: string } | null {
  if (score >= 85) return { label: "Best Match", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" };
  if (score >= 70) return { label: "Strong Match", className: "bg-[#474ead]/10 text-[#474ead] dark:text-indigo-400" };
  if (score >= 50) return { label: "Good Match", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" };
  return null;
}

// ─── Talent Card ──────────────────────────────────────────────────────────────

function TalentCard({
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
  const badge = matchBadge(result.score);
  const { candidate } = result;

  // Resolve snake_case or camelCase candidate fields (backend may return either)
  const name = candidate.fullName ?? candidate.full_name;
  const position = candidate.targetPosition ?? candidate.target_position;
  const coreSkills = candidate.coreSkills ?? candidate.core_skills ?? [];
  const secondarySkills = candidate.secondarySkills ?? candidate.secondary_skills ?? [];

  // Highlight overlap skills; fall back to candidate core skills if scorer had none
  const overlapSet = new Set(result.overlapSkills.map((s) => s.toLowerCase()));
  const displaySkills = result.overlapSkills.length > 0
    ? result.overlapSkills.slice(0, 3)
    : coreSkills.slice(0, 3);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 hover:shadow-md transition-shadow flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-gradient-to-br from-[#474ead] to-indigo-400 text-white text-sm font-semibold">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight truncate">
            {maskName(name)}
          </p>
          {position && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{position}</p>
          )}
          {candidate.location && (
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{candidate.location}</p>
          )}
        </div>
        {badge && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Skills */}
      {displaySkills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {displaySkills.map((s) => (
            <span
              key={s}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                overlapSet.has(s.toLowerCase())
                  ? "bg-[#474ead]/10 text-[#474ead] dark:text-indigo-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Score bar + invite button */}
      <div className="flex items-center justify-between gap-3 mt-auto">
        <div className="flex-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#474ead] to-indigo-400 transition-all"
              style={{ width: `${Math.max(result.score, 2)}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-slate-400 shrink-0 tabular-nums">
            {result.score}%
          </span>
        </div>
        <Button
          size="sm"
          variant={isInvited ? "outline" : "default"}
          disabled={isInvited || isInviting}
          onClick={onInvite}
          className={[
            "rounded-full text-xs px-3 h-7 shrink-0",
            isInvited
              ? "border-emerald-400 text-emerald-600 dark:text-emerald-400 cursor-default"
              : "bg-[#474ead] text-white hover:bg-[#3d439c]",
          ].join(" ")}
        >
          {isInviting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isInvited ? (
            <>
              <Check className="mr-1 h-3 w-3" />
              Invited
            </>
          ) : (
            "Invite"
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SearchToShortlist() {
  const { toast } = useToast();

  // Search inputs
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [engagementType, setEngagementType] = useState<"Full-Time" | "Half-Day">("Full-Time");

  // Results
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // ── Search mutation ──────────────────────────────────────────────────────────
  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/client/talent-search", {
        searchText,
        category: selectedCategory,
        engagementType,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Search failed");
      }
      return res.json() as Promise<SearchResults>;
    },
    onSuccess: (data) => {
      setSearchResults(data);
      setInvitedIds(new Set());
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    },
    onError: (err: any) => {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    },
  });

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
          setInvitedIds((prev) => new Set(prev).add(talentUserId));
          return;
        }
        throw new Error(body.message || "Failed to send invitation");
      }
      setInvitedIds((prev) => new Set(prev).add(talentUserId));
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

  function handleSearch() {
    if (!searchText.trim()) {
      toast({
        title: "Enter a search term",
        description: "Describe the role or skills you're looking for.",
      });
      return;
    }
    searchMutation.mutate();
  }

  function handleReset() {
    setSearchResults(null);
    setSelectedCategory(null);
    setSearchText("");
    setInvitedIds(new Set());
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060816]">
      <TopNavigation />

      <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 md:px-6">
        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#474ead]/10 px-3 py-1 text-xs font-semibold text-[#474ead] mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Talent Search
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Find Your Ideal Talent
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto text-sm">
            Describe the role or skills you need. Our AI ranks matching talent profiles by fit — then invite
            the best ones directly from the results.
          </p>
        </div>

        {/* ── Search form ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 mb-8">
          {/* Search bar */}
          <div className="flex gap-2 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                className="pl-9 h-11 rounded-xl text-sm"
                placeholder='e.g. "Customer support agent with Zendesk experience"'
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={searchMutation.isPending}
              className="h-11 px-5 rounded-xl bg-[#474ead] text-white hover:bg-[#3d439c] shrink-0"
            >
              {searchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>

          {/* Category chips */}
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Category <span className="font-normal normal-case">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TALENT_BROWSE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory((prev) => (prev === cat ? null : cat))}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    selectedCategory === cat
                      ? "bg-[#474ead] text-white border-[#474ead]"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#474ead]/40 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                  ].join(" ")}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Engagement type */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Engagement Type
            </p>
            <div className="flex gap-1.5">
              {(["Full-Time", "Half-Day"] as const).map((et) => (
                <button
                  key={et}
                  type="button"
                  onClick={() => setEngagementType(et)}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    engagementType === et
                      ? "bg-[#474ead] text-white border-[#474ead]"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#474ead]/40 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                  ].join(" ")}
                >
                  {et}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Results area ────────────────────────────────────────────────── */}
        <div ref={resultsRef}>
          {/* Loading state */}
          {searchMutation.isPending && (
            <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-[#474ead]" />
              <p className="text-sm">Scoring talent profiles…</p>
            </div>
          )}

          {/* Results */}
          {!searchMutation.isPending && searchResults && (
            <>
              {/* Results header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    {searchResults.results.length} AI-matched profile
                    {searchResults.results.length !== 1 ? "s" : ""}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ranked by fit — skills that matched the search are highlighted in{" "}
                    <span className="text-[#474ead] font-medium">blue</span>.
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  New search
                </button>
              </div>

              {searchResults.results.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
                  <Users className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    No matching profiles found
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Try broadening your search or selecting a different category.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {searchResults.results.map((r) => (
                    <TalentCard
                      key={r.candidateId}
                      result={r}
                      isInvited={invitedIds.has(r.userId)}
                      isInviting={invitingId === r.userId}
                      onInvite={() => handleInvite(r.userId)}
                    />
                  ))}
                </div>
              )}

              {/* Invitation sent summary */}
              {invitedIds.size > 0 && (
                <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    <span className="font-semibold">
                      {invitedIds.size} invitation{invitedIds.size !== 1 ? "s" : ""} sent.
                    </span>{" "}
                    Invited talent can accept or decline directly from their dashboard.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Pre-search prompt */}
          {!searchMutation.isPending && !searchResults && (
            <div className="flex flex-col items-center gap-3 py-16 text-slate-300 dark:text-slate-700">
              <Users className="h-12 w-12" />
              <p className="text-sm text-slate-400">
                Enter a search term above to find AI-matched talent
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
