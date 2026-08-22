import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export type ClientTalentInviteTarget = {
  id: string;
  name: string;
  idType?: "talentUser" | "candidate";
};

type InviteJob = {
  id: string;
  title: string;
  engagementType?: string | null;
};

type ApiResult = {
  ok: boolean;
  status?: number;
  body: Record<string, any>;
};

function parseApiError(error: unknown): ApiResult {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/^(\d+):\s*([\s\S]*)$/);
  if (!match) return { ok: false, body: { error: message } };

  let body: Record<string, any> = {};
  try {
    body = JSON.parse(match[2]);
  } catch {
    body = { error: match[2] || message };
  }
  return { ok: false, status: Number(match[1]), body };
}

async function postInvite(
  target: ClientTalentInviteTarget,
  jobId: string,
  inviteDateTime: string,
): Promise<ApiResult> {
  try {
    const res = await apiRequest("POST", "/api/client/invitations", {
      jobId,
      ...(target.idType === "candidate"
        ? { candidateId: target.id }
        : { talentUserId: target.id }),
      proposedTimes: [
        {
          start: new Date(inviteDateTime).toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      ],
    });
    return { ok: true, body: await res.json().catch(() => ({})) };
  } catch (error) {
    return parseApiError(error);
  }
}

/**
 * Shared client invitation flow for talent discovery surfaces.
 *
 * The target may be identified by a linked users.id (search results) or a
 * candidates.id (Talent Pool/full profile). Candidate IDs are resolved by the
 * server and never exposed as user IDs in public profile payloads.
 */
export function ClientTalentInviteDialog({
  target,
  onClose,
  onInvited,
  onInvitingChange,
}: {
  target: ClientTalentInviteTarget | null;
  onClose: () => void;
  onInvited?: () => void;
  onInvitingChange?: (isInviting: boolean) => void;
}) {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<InviteJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [inviteDateTime, setInviteDateTime] = useState("");

  useEffect(() => {
    if (!target) {
      setJobs([]);
      setLoading(false);
      setSelectedJobId(null);
      setInviteDateTime("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSelectedJobId(null);
    setInviteDateTime("");
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/client/jobs");
        const all = await res.json().catch(() => []);
        const open = Array.isArray(all)
          ? all.filter(
              (job: any) =>
                job.status === "open" &&
                (job.approvalStatus === "approved" ||
                  job.approval_status === "approved"),
            )
          : [];
        if (!cancelled) setJobs(open);
      } catch {
        if (!cancelled) setJobs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!target) return null;

  const close = () => {
    if (!sending) onClose();
  };

  const confirmInvite = async (jobId: string) => {
    if (!inviteDateTime) {
      toast({
        title: "Choose an interview time",
        description:
          "Every new invitation includes an initial interview proposal.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    onInvitingChange?.(true);
    try {
      let result = await postInvite(target, jobId, inviteDateTime);

      if (result.body.error === "already_invited") {
        onInvited?.();
        onClose();
        return;
      }

      if (result.body.error === "msa_required") {
        window.open(
          result.body.termsUrl || "/terms",
          "_blank",
          "noopener,noreferrer",
        );
        const accepted = window.confirm(
          "Please review the Terms of Service in the opened tab. Press OK only if you accept them to record acceptance and send this invitation.",
        );
        if (!accepted) return;

        try {
          await apiRequest("POST", "/api/client/msa-acceptance", {
            accepted: true,
          });
        } catch (error) {
          const parsed = parseApiError(error);
          throw new Error(
            parsed.body.message ||
              parsed.body.error ||
              "Please accept the Terms of Service before inviting talent.",
          );
        }
        result = await postInvite(target, jobId, inviteDateTime);
      }

      if (!result.ok) {
        throw new Error(
          result.body.message ||
            result.body.error ||
            "Failed to send invitation",
        );
      }

      onInvited?.();
      toast({
        title: "Invitation sent",
        description: "The talent will see your invitation on their dashboard.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Could not send invitation",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
      onInvitingChange?.(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-talent-invite-title"
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#474ead]" />
            <p className="text-sm text-slate-500">Loading job postings…</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-6">
            <h2
              id="client-talent-invite-title"
              className="mb-2 text-[17px] font-bold text-slate-900 dark:text-white"
            >
              No open job postings
            </h2>
            <p className="mb-5 text-[13.5px] text-slate-500 dark:text-slate-400">
              You need an active, approved job posting to invite{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {target.name}
              </span>
              . Post one first, then come back to send the invitation.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={close}
                className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13.5px] font-semibold text-slate-500 transition-colors hover:text-slate-700 dark:border-slate-700"
              >
                Cancel
              </button>
              <a
                href="/client-profile"
                onClick={onClose}
                className="rounded-[10px] bg-[#474ead] px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#363c87]"
              >
                Post a Job →
              </a>
            </div>
          </div>
        ) : jobs.length === 1 ? (
          <div className="p-6">
            <h2
              id="client-talent-invite-title"
              className="mb-1 text-[17px] font-bold text-slate-900 dark:text-white"
            >
              Invite {target.name}?
            </h2>
            <p className="mb-5 text-[13.5px] text-slate-500 dark:text-slate-400">
              They&apos;ll be invited to:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {jobs[0].title}
              </span>
              {jobs[0].engagementType && (
                <span className="ml-1 text-slate-400">
                  · {jobs[0].engagementType}
                </span>
              )}
            </p>
            <InterviewTimeInput
              value={inviteDateTime}
              onChange={setInviteDateTime}
            />
            <InviteActions
              sending={sending}
              onCancel={close}
              onConfirm={() => confirmInvite(jobs[0].id)}
              confirmLabel="Send invitation"
            />
          </div>
        ) : (
          <div className="p-6">
            <h2
              id="client-talent-invite-title"
              className="mb-1 text-[17px] font-bold text-slate-900 dark:text-white"
            >
              Invite {target.name} to which role?
            </h2>
            <p className="mb-4 text-[13.5px] text-slate-400">
              Select one of your open job postings.
            </p>
            <InterviewTimeInput
              value={inviteDateTime}
              onChange={setInviteDateTime}
            />
            <div className="mb-5 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={cn(
                    "rounded-[10px] border px-4 py-3 text-left text-[13.5px] font-semibold transition-colors",
                    selectedJobId === job.id
                      ? "border-[#474ead] bg-[#EFEFFA] text-[#474ead]"
                      : "border-slate-200 text-slate-700 hover:border-[#474ead] hover:text-[#474ead] dark:border-slate-700 dark:text-slate-300",
                  )}
                >
                  {job.title}
                  {job.engagementType && (
                    <span className="ml-2 text-[12px] font-normal text-slate-400">
                      {job.engagementType}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <InviteActions
              sending={sending}
              onCancel={close}
              onConfirm={() => selectedJobId && confirmInvite(selectedJobId)}
              confirmLabel="Send invitation"
              confirmDisabled={!selectedJobId || !inviteDateTime}
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function InterviewTimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-5 block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
        Propose an initial interview time
      </span>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#474ead] focus:ring-2 focus:ring-[#474ead]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        required
      />
      <span className="mt-1 block text-[11px] text-slate-400">
        The talent can accept this time or suggest alternatives.
      </span>
    </label>
  );
}

function InviteActions({
  sending,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmDisabled = false,
}: {
  sending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        onClick={onCancel}
        disabled={sending}
        className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13.5px] font-semibold text-slate-500 transition-colors hover:text-slate-700 disabled:opacity-60 dark:border-slate-700"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={sending || confirmDisabled}
        className="flex items-center gap-1.5 rounded-[10px] bg-[#474ead] px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#363c87] disabled:opacity-60"
      >
        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : confirmLabel}
      </button>
    </div>
  );
}