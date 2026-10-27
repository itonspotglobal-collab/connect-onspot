import { describe, expect, it } from "vitest";
import { isPendingClientInvitation } from "./talentInvitationState";

describe("talent client invitation consent state", () => {
  it("keeps Accept and Decline eligible after shortlist while acceptance is pending", () => {
    expect(isPendingClientInvitation({
      status: "shortlisted",
      initiated_by: "client",
      invitation_pending: true,
    })).toBe(true);
    expect(isPendingClientInvitation({
      status: "shortlisted",
      invitation_type: "client_invitation",
      invitationPending: true,
    })).toBe(true);
  });

  it("does not turn an organic shortlist into a client invitation", () => {
    expect(isPendingClientInvitation({ status: "shortlisted", initiated_by: "talent", invitation_pending: true })).toBe(false);
    expect(isPendingClientInvitation({ status: "shortlisted", invitation_pending: true })).toBe(false);
  });

  it("hides invitation actions after acceptance", () => {
    expect(isPendingClientInvitation({ status: "shortlisted", initiated_by: "client", invitation_pending: false })).toBe(false);
  });

  it("preserves the old invited-status flow only for client-origin invitations", () => {
    expect(isPendingClientInvitation({ status: "invited", initiated_by: "client" })).toBe(true);
    expect(isPendingClientInvitation({ status: "invited", initiated_by: "talent" })).toBe(false);
  });
});
