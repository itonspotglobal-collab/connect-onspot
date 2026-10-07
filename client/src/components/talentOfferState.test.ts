import { describe, expect, it } from "vitest";
import { bucketTalentOffers, isTalentOfferExpired } from "./talentOfferState";

describe("talent offer expiry", () => {
  const now = Date.parse("2026-10-01T12:00:00.000Z");

  it("accepts camel- and snake-case expiration fields and treats the deadline as closed", () => {
    expect(isTalentOfferExpired({ status: "sent", expiresAt: "2026-10-01T11:59:00.000Z" }, now)).toBe(true);
    expect(isTalentOfferExpired({ status: "sent", expires_at: "2026-10-01T12:00:00.000Z" }, now)).toBe(true);
    expect(isTalentOfferExpired({ status: "sent", expires_at: "2026-10-01T12:01:00.000Z" }, now)).toBe(false);
  });

  it("does not count expired sent offers as actionable pending and keeps them in history", () => {
    const offers = [
      { id: "active", status: "sent", expiresAt: "2026-10-02T00:00:00Z", proposerRole: "client" },
      { id: "expired", status: "sent", expires_at: "2026-09-30T00:00:00Z", proposer_role: "client" },
      { id: "counter", status: "sent", expiresAt: "2026-10-02T00:00:00Z", proposerRole: "talent" },
    ];
    const buckets = bucketTalentOffers(offers, now);
    expect(buckets.pending.map(({ id }) => id)).toEqual(["active"]);
    expect(buckets.waitingForClient.map(({ id }) => id)).toEqual(["counter"]);
    expect(buckets.past.map(({ id }) => id)).toEqual(["expired"]);
  });
});
