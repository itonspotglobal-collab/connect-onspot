export interface InvitationAcceptanceState {
  status?: string | null;
  initiatedBy?: string | null;
  initiated_by?: string | null;
  invitationType?: string | null;
  invitation_type?: string | null;
  invitationPending?: boolean;
  invitation_pending?: boolean;
}

/**
 * Invite consent is independent from application stage. An invite-with-interview
 * may already be shortlisted while acceptance is still pending.
 */
export function isPendingClientInvitation(item: InvitationAcceptanceState): boolean {
  const clientInitiated = item.invitationType === "client_invitation"
    || item.invitation_type === "client_invitation"
    || item.initiatedBy === "client"
    || item.initiated_by === "client";
  return clientInitiated && (item.invitationPending === true || item.invitation_pending === true || item.status === "invited");
}
