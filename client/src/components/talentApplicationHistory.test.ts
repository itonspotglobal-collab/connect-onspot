import { describe, expect, it } from "vitest";
import { getTalentHistoryTimeline } from "./talentApplicationHistory";

describe("Talent application history timeline", () => {
  it("shows actual status history and submittedAt without filling skipped stages", () => {
    const events = getTalentHistoryTimeline([
      { status: "shortlisted", at: "2026-05-03T12:00:00Z" },
      { status: "offer_expired", at: "2026-05-05T12:00:00Z" },
    ], "2026-05-01T12:00:00Z");
    expect(events.map((event) => event.status)).toEqual(["submitted", "shortlisted", "offer_expired"]);
  });

  it("does not duplicate a recorded submitted event and ignores invalid timestamps", () => {
    const events = getTalentHistoryTimeline([
      { status: "submitted", at: "2026-05-01T12:00:00Z" },
      { status: "under_review", at: "not-a-date" },
    ], "2026-05-01T11:00:00Z");
    expect(events.map((event) => event.status)).toEqual(["submitted"]);
  });

  it("returns no inferred events when neither history nor submission time exists", () => {
    expect(getTalentHistoryTimeline(undefined, null)).toEqual([]);
  });
});
