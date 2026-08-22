import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { isInvitableJob, type InvitationPickerJob, type InvitationReadiness } from "@/lib/invitationReadiness";
import type { ClientTalentInviteTarget } from "./ClientTalentInviteDialog";
import { clientShortlistsQueryKey } from "@/hooks/useClientShortlists";
import { useClientShortlists } from "@/hooks/useClientShortlists";

type ShortlistJob = InvitationPickerJob & {
  created_via?: string | null;
};

function parseError(error: unknown): { error?: string; message?: string } {
  const text = error instanceof Error ? error.message : String(error);
  const match = text.match(/^(\d+):\s*([\s\S]*)$/);
  if (!match) return { error: text };
  try { return JSON.parse(match[2]); } catch { return { error: match[2] || text }; }
}

function jobStateLabel(job: ShortlistJob) {
  if (job.approvalStatus === "pending" || job.approval_status === "pending") return "Pending approval";
  if (job.approvalStatus && job.approvalStatus !== "approved") return "Not approved";
  return "Open role";
}

export function ClientTalentShortlistDialog({
  target,
  onClose,
  onShortlisted,
}: {
  target: ClientTalentInviteTarget | null;
  onClose: () => void;
  onShortlisted?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { shortlists, remove: removeShortlist } = useClientShortlists(Boolean(target));
  const [readiness, setReadiness] = useState<InvitationReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) {
      setReadiness(null);
      setSelectedJobId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSelectedJobId(null);
    (async () => {
      try {
        const response = await apiRequest("GET", "/api/client/invitation-readiness");
        const body = await response.json();
        if (!response.ok || !body.summary || !body.msa) throw new Error(body.message || "Could not load your roles");
        if (!cancelled) setReadiness(body as InvitationReadiness);
      } catch (error) {
        if (!cancelled) {
          setReadiness(null);
          toast({ title: "Couldn't load your roles", description: parseError(error).error, variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [target, toast]);

  const jobs = useMemo(
    () => ((readiness?.jobs ?? []) as ShortlistJob[]).filter(
      (job) => job.created_via !== "search_scaffold" && job.status === "open",
    ),
    [readiness],
  );

  if (!target) return null;
  const close = () => { if (!saving) onClose(); };
  const state = readiness?.summary.state;

  const save = async (jobId: string) => {
    setSaving(true);
    try {
      const existing = shortlists.find(
        (item) =>
          item.jobId === jobId &&
          (target.idType === "candidate"
            ? item.candidateId === target.id
            : item.talentId === target.id),
      );
      if (existing) {
        await removeShortlist.mutateAsync(existing.id);
        toast({ title: "Removed from shortlist", description: `${target.name} was removed from this role.` });
        onShortlisted?.();
        onClose();
        return;
      }
      const payload = target.idType === "candidate"
        ? { jobId, candidateId: target.id }
        : { jobId, talentUserId: target.id };
      const response = await apiRequest("POST", "/api/client/shortlists", payload);
      const body = await response.json().catch(() => ({}));
      if (body.alreadyShortlisted) {
        toast({ title: "Already on your shortlist", description: `${target.name} is already saved for this role.` });
      } else {
        toast({ title: "Talent shortlisted", description: `${target.name} was saved for ${jobs.find((job) => job.id === jobId)?.title ?? "this role"}.` });
      }
      await queryClient.invalidateQueries({ queryKey: clientShortlistsQueryKey });
      onShortlisted?.();
      onClose();
    } catch (error) {
      const body = parseError(error);
      if (body.error === "already_invited") {
        toast({ title: "Already invited", description: "This talent already has an invitation for that role.", variant: "destructive" });
      } else {
        toast({ title: "Couldn't save shortlist", description: body.message || body.error || "Please try again.", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const blocker = state === "pending_approval"
    ? { title: "Your role is awaiting approval", body: "You can save talent to an open role now. Interviews can be sent after an admin approves it." }
    : state === "closed_jobs"
      ? { title: "Your roles are closed", body: "Reopen a role or create a new one before saving talent." }
      : state === "scaffold_only"
        ? { title: "Create a real role first", body: "The saved search placeholder cannot hold a shortlist. Create a job posting to save talent against a specific role." }
        : state === "no_jobs"
          ? { title: "No roles yet", body: "Create a job posting before saving talent to a specific role." }
          : { title: "No open roles available", body: "Open a role or create a new one before saving talent." };

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="client-talent-shortlist-title">
      <button className="absolute inset-0 cursor-default bg-black/60" aria-label="Close shortlist dialog" onClick={close} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
          <h2 id="client-talent-shortlist-title" className="text-[17px] font-bold text-slate-900 dark:text-white">
            Save {target.name} to which role?
          </h2>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
            Shortlisting is private and does not notify the talent.
          </p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading your roles…</div>
        ) : jobs.length === 0 ? (
          <div className="p-6">
            <h3 className="text-[16px] font-bold text-slate-900 dark:text-white">{blocker.title}</h3>
            <p className="mt-2 text-[13.5px] leading-6 text-slate-500 dark:text-slate-400">{blocker.body}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={close} className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Close</button>
              <a href="/client-profile" className="rounded-[10px] bg-[#474ead] px-4 py-2 text-[13px] font-semibold text-white">View job postings →</a>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-5 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  aria-pressed={selectedJobId === job.id}
                  className={cn(
                    "rounded-[10px] border px-4 py-3 text-left transition-colors",
                    selectedJobId === job.id ? "border-[#474ead] bg-[#EFEFFA] text-[#474ead]" : "border-slate-200 text-slate-700 hover:border-[#474ead] dark:border-slate-700 dark:text-slate-300",
                  )}
                >
                  <span className="block text-[13.5px] font-semibold">{job.title}</span>
                  <span className="mt-1 block text-[11.5px] font-normal text-slate-400">
                    {shortlists.some((item) => item.jobId === job.id && (target.idType === "candidate" ? item.candidateId === target.id : item.talentId === target.id)) ? "Shortlisted · click to remove" : jobStateLabel(job)}
                    {job.engagementType ? ` · ${job.engagementType}` : ""}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={close} disabled={saving} className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={() => selectedJobId && save(selectedJobId)} disabled={!selectedJobId || saving} className="flex items-center gap-1.5 rounded-[10px] bg-[#474ead] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save shortlist"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}