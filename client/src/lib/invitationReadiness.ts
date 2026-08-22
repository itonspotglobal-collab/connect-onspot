export type InvitationPickerState =
  | "ready"
  | "pending_approval"
  | "closed_jobs"
  | "scaffold_only"
  | "no_jobs"
  | "not_ready";

export interface InvitationPickerJob {
  id: string;
  title: string;
  engagementType?: string | null;
  engagement_type?: string | null;
  status?: string | null;
  approvalStatus?: string | null;
  approval_status?: string | null;
  [key: string]: unknown;
}

export interface InvitationReadiness {
  jobs: InvitationPickerJob[];
  summary: {
    state: InvitationPickerState;
    totalJobs: number;
    pendingApprovalCount: number;
    closedJobsCount: number;
    scaffoldJobsCount: number;
    openApprovedCount: number;
  };
  msa: {
    required: boolean;
    accepted: boolean;
    termsUrl: string;
  };
}

export function isInvitableJob(job: InvitationPickerJob): boolean {
  return (
    job.status === "open" &&
    (job.approvalStatus === "approved" || job.approval_status === "approved")
  );
}