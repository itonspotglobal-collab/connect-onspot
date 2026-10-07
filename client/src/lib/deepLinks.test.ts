import { describe, expect, it } from "vitest";
import {
  getDeepLinkResourceIds,
  matchesRequestedInterview,
  shouldOpenTalentApplicationDrawer,
} from "./deepLinks";

describe("email deep-link resource selection", () => {
  it("selects the exact talent offer", () => {
    expect(getDeepLinkResourceIds("?offerId=offer-42").offerId).toBe("offer-42");
  });

  it("retains application and exact interview selectors together", () => {
    expect(getDeepLinkResourceIds("?interviewId=interview-17&applicationId=application-9")).toMatchObject({
      applicationId: "application-9",
      interviewId: "interview-17",
    });
  });

  it("selects contract and message thread query destinations", () => {
    expect(getDeepLinkResourceIds("?id=contract-3").contractId).toBe("contract-3");
    expect(getDeepLinkResourceIds("?thread=thread-8").threadId).toBe("thread-8");
  });

  it("will not select an owned interview when the email application selector points elsewhere", () => {
    const row = { id: "interview-17", submissionId: "application-9" };
    expect(matchesRequestedInterview(row, "interview-17", "application-9")).toBe(true);
    expect(matchesRequestedInterview(row, "interview-17", "application-other")).toBe(false);
    expect(matchesRequestedInterview(row, "interview-other", "application-9")).toBe(false);
  });

  it("keeps invited submissions and interview-selected applications out of the blocking drawer", () => {
    expect(shouldOpenTalentApplicationDrawer("invited", false)).toBe(false);
    expect(shouldOpenTalentApplicationDrawer("submitted", true)).toBe(false);
    expect(shouldOpenTalentApplicationDrawer("submitted", false)).toBe(true);
  });
});
