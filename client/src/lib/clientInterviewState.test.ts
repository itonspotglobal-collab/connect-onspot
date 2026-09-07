import { describe, expect, it } from "vitest";
import { getClientInterviewDisplayState } from "./clientInterviewState";

describe("getClientInterviewDisplayState", () => {
  it("waits on Talent after a Client proposal", () => {
    expect(getClientInterviewDisplayState({
      status: "proposed",
      current_proposal_owner: "talent",
    })).toBe("awaiting_talent");
  });

  it("requires Client action after a Talent counter-proposal", () => {
    expect(getClientInterviewDisplayState({
      status: "proposed",
      current_proposal_owner: "client",
    })).toBe("action_required");
  });

  it("uses canonical terminal states ahead of proposal ownership", () => {
    expect(getClientInterviewDisplayState({
      status: "confirmed",
      confirmed_time: "2030-09-07T00:00:00.000Z",
      current_proposal_owner: "client",
    })).toBe("confirmed");
    expect(getClientInterviewDisplayState({
      status: "proposed",
      confirmed_time: "2030-09-07T00:00:00.000Z",
      current_proposal_owner: "talent",
    })).toBe("confirmed");
    expect(getClientInterviewDisplayState({ status: "completed" })).toBe("completed");
    expect(getClientInterviewDisplayState({ status: "cancelled" })).toBe("cancelled");
  });
});