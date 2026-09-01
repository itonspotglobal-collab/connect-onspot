import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Eye, Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type SafeCandidate = {
  maskedName: string;
  targetPosition?: string | null;
  location?: string | null;
  availability?: string | null;
  headline?: string | null;
  summary?: string | null;
  coreSkills?: string[];
  secondarySkills?: string[];
  experienceYears?: number | null;
  isVetted?: boolean;
  isVerified?: boolean;
};

type SearchResult = {
  candidateId: string;
  userId: string;
  score: number;
  overlapSkills: string[];
  matchedSkills?: string[];
  missingSkills?: string[];
  matchTier?: string;
  reasons?: string[];
  aiReason?: string;
  componentScores?: Record<string, number>;
  candidate: SafeCandidate;
};

type SearchResponse = {
  results: SearchResult[];
  invitedTalentIds: string[];
};

export interface ClientJobTalentSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: { id: string; title: string } | null;
  mode?: "client" | "admin";
}

export function ClientJobTalentSearchDialog({
  open,
  onOpenChange,
  job,
  mode = "client",
}: ClientJobTalentSearchDialogProps) {
  const { toast } = useToast();
  const canInvite = mode === "client";
  const routePrefix = mode === "admin" ? "/api/admin/jobs" : "/api/client/jobs";
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState<SearchResult | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const inviteTimeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSearchDraft("");
    setAppliedSearch("");
    setProposedTime("");
    setMeetingLink("");
    setInvitedIds(new Set());
    setPreviewing(null);
    setInviteError(null);
  }, [open, job?.id]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setAppliedSearch(searchDraft.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, searchDraft]);

  const search = useQuery<SearchResponse>({
    queryKey: [routePrefix, job?.id, "talent-search", appliedSearch],
    enabled: open && Boolean(job),
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const response = await apiRequest("POST", `${routePrefix}/${job!.id}/talent-search`, {
        searchText: appliedSearch,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || "We couldn't load talent right now. Please try again.");
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (search.data) setInvitedIds(new Set(search.data.invitedTalentIds));
  }, [search.data]);

  const preview = useQuery<SafeCandidate>({
    queryKey: [mode === "admin" ? "/api/admin/talent" : "/api/client/talent-profile", previewing?.userId],
    enabled: Boolean(previewing),
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        mode === "admin"
          ? `/api/admin/talent/${previewing!.userId}`
          : `/api/client/talent-profile/${previewing!.userId}`,
      );
      if (!response.ok) throw new Error("We couldn't load this talent profile right now.");
      const body = await response.json();
      return mode === "admin" ? (body.talent ?? body) : body;
    },
  });

  const invite = useMutation({
    mutationFn: async (talentUserId: string) => {
      if (!job) throw new Error("Choose a job before sending an invitation.");
      if (!proposedTime) throw new Error("Choose an initial interview time before sending an invitation.");
      const start = new Date(proposedTime);
      if (Number.isNaN(start.getTime())) throw new Error("Choose a valid initial interview time.");
      const normalizedMeetingLink = meetingLink.trim();
      if (normalizedMeetingLink) {
        try {
          const parsed = new URL(normalizedMeetingLink);
          if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        } catch {
          throw new Error("Enter a valid http(s) meeting link.");
        }
      }

      const response = await apiRequest("POST", "/api/client/invitations", {
        jobId: job.id,
        talentUserId,
        proposedTimes: [{
          start: start.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }],
        meetingLink: normalizedMeetingLink || undefined,
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 409 && body.error === "already_invited") {
        return { talentUserId, alreadyInvited: true };
      }
      if (!response.ok) throw new Error(body.message || body.error || "Could not send invitation");
      return { talentUserId, alreadyInvited: false };
    },
    onSuccess: ({ talentUserId, alreadyInvited }) => {
      setInvitedIds((current) => new Set(current).add(talentUserId));
      setInviteError(null);
      toast({
        title: alreadyInvited ? "Already invited" : "Invitation sent",
        description: alreadyInvited
          ? "This talent already has an invitation for this job."
          : "The talent can accept this time or suggest an alternative.",
      });
    },
    onError: (error: Error) => {
      setInviteError(error.message);
      if (/interview time/i.test(error.message)) {
        window.requestAnimationFrame(() => inviteTimeRef.current?.focus());
      }
    },
  });

  const results = search.data?.results ?? [];
  const handleInvite = (talentUserId: string) => {
    setInviteError(null);
    invite.mutate(talentUserId);
  };
  const previewSkills = useMemo(
    () => [...(preview.data?.coreSkills ?? []), ...(preview.data?.secondarySkills ?? [])].slice(0, 12),
    [preview.data],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!flex max-h-[calc(100svh-3rem)] max-w-4xl flex-col !overflow-hidden">
          <div className="shrink-0 space-y-3">
            <DialogHeader>
              <DialogTitle>{canInvite ? "Invite Talent to Apply" : "Find Talent for This Job"}</DialogTitle>
              <DialogDescription>
                {job ? <>{canInvite ? "Search and invite talent for" : "Review ranked talent for"} <span className="font-semibold text-foreground"> {job.title}</span>.</> : "Choose a job posting to search talent."}
              </DialogDescription>
            </DialogHeader>

            <div className={`grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03] ${canInvite ? "md:grid-cols-[1fr_250px]" : ""}`}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="talent-search">
                  Search talent
                </label>
                <div className="flex gap-2">
                  <Input
                    id="talent-search"
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        setAppliedSearch(searchDraft.trim());
                      }
                    }}
                    placeholder="Search by role, skill, or experience..."
                  />
                  <Button type="button" variant="outline" onClick={() => setAppliedSearch(searchDraft.trim())}>
                    <Search className="mr-1.5 h-4 w-4" /> Search
                  </Button>
                </div>
              </div>
              {canInvite && <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="invite-time">
                  Suggested first interview time
                  <span className="ml-1 text-red-500" aria-hidden="true">*</span>
                </label>
                <Input
                  ref={inviteTimeRef}
                  id="invite-time"
                  type="datetime-local"
                  required
                  aria-required="true"
                  value={proposedTime}
                  onChange={(event) => {
                    setProposedTime(event.target.value);
                    setInviteError(null);
                  }}
                />
                <p className="mt-1 text-[11px] text-slate-500">Talent can accept this time or suggest alternatives.</p>
              </div>}
            </div>

            {canInvite && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="invite-meeting-link">
                Meeting link <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <Input
                id="invite-meeting-link"
                type="url"
                value={meetingLink}
                onChange={(event) => {
                  setMeetingLink(event.target.value);
                  setInviteError(null);
                }}
                placeholder="https://meet.google.com/…"
              />
              </div>}
            {inviteError && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
              >
                {inviteError}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 pt-3 dark:border-white/10">
            {search.isLoading ? (
              <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching talent...
              </div>
            ) : search.isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                We couldn&apos;t load talent right now. Please try again.
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-7 text-center text-sm text-slate-500 dark:border-white/10">
                No matching talent found. Try another search or adjust the filters.
              </div>
            ) : (
              <div className="relative divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/[0.08] dark:border-white/[0.1]">
                {search.isFetching && (
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-sm dark:bg-slate-900/95">
                    <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                  </div>
                )}
                {results.map((result) => {
                  const isInvited = invitedIds.has(result.userId);
                  const isSending = invite.isPending && invite.variables === result.userId;
                  return (
                    <div key={result.userId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{result.candidate.maskedName}</p>
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-[#474ead] dark:bg-indigo-900/30 dark:text-indigo-300">
                            {Math.round(result.score)}% match
                          </span>
                          {result.candidate.isVetted && <span className="text-xs font-semibold text-emerald-600">Vetted</span>}
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                          {result.candidate.targetPosition || result.candidate.headline || "Talent profile"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[result.candidate.availability, result.candidate.location].filter(Boolean).join(" · ") || "Availability not specified"}
                        </p>
                        {result.overlapSkills.length > 0 && (
                          <p className="mt-1.5 text-xs text-slate-500">Matches: {result.overlapSkills.slice(0, 4).join(", ")}</p>
                        )}
                        {(result.missingSkills?.length || result.reasons?.length) ? (
                          <div className="mt-2 space-y-1 text-xs">
                            {result.reasons?.[0] && <p className="text-slate-600 dark:text-slate-300">{result.reasons[0]}</p>}
                            {result.missingSkills && result.missingSkills.length > 0 && (
                              <p className="text-amber-700 dark:text-amber-400">Missing: {result.missingSkills.slice(0, 3).join(", ")}</p>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" onClick={() => setPreviewing(result)}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
                        </Button>
                        {canInvite && <Button
                          size="sm"
                          disabled={isInvited || isSending}
                          className="bg-[#474ead] text-white hover:bg-[#3d439c]"
                           onClick={() => handleInvite(result.userId)}
                        >
                          {isSending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5" />}
                          {isInvited ? "Invited" : "Invite to Apply"}
                        </Button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewing)} onOpenChange={(nextOpen) => { if (!nextOpen) setPreviewing(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{preview.data?.maskedName ?? previewing?.candidate.maskedName ?? "Talent profile"}</DialogTitle>
            <DialogDescription>{mode === "admin" ? "Talent Acquisition profile preview" : "Safe client-facing profile preview"}</DialogDescription>
          </DialogHeader>
          {preview.isLoading ? (
            <div className="flex min-h-32 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading profile...</div>
          ) : preview.isError ? (
            <p className="text-sm text-red-600">We couldn&apos;t load this talent profile right now.</p>
          ) : preview.data && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{preview.data.targetPosition || preview.data.headline || "Talent profile"}</p>
                <p className="mt-1 text-slate-500">{[preview.data.availability, preview.data.location].filter(Boolean).join(" · ")}</p>
              </div>
              {preview.data.summary && <p className="leading-relaxed text-slate-700 dark:text-slate-300">{preview.data.summary}</p>}
              {previewSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {previewSkills.map((skill) => <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">{skill}</span>)}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}