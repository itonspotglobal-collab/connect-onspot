import { describe, expect, it } from "vitest";
import { isContractorOfferAllowed } from "./contractorOnboarding";

describe("contractor offer onboarding gate", () => {
  it("preserves offers on records explicitly assigned to the legacy path", () => {
    expect(isContractorOfferAllowed({ policy: "legacy", canSendOffer: false })).toBe(true);
  });

  it("blocks deposit-first offers until the server confirms eligibility", () => {
    expect(isContractorOfferAllowed({ policy: "deposit_first", canSendOffer: false })).toBe(false);
    expect(isContractorOfferAllowed({ policy: "deposit_first" })).toBe(false);
    expect(isContractorOfferAllowed({ policy: "deposit_first", canSendOffer: true })).toBe(true);
  });
});
