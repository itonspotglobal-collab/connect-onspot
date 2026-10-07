import { describe, expect, it } from "vitest";
import { elapsedSeconds, formatElapsed, formatWorkTime, timezoneOffsetLabel, workLocalInputInstant } from "./workClockTime";

describe("work clock time helpers", () => {
  it("recovers an elapsed timer from a persisted start instant", () => {
    expect(elapsedSeconds("2026-10-07T01:17:00.000Z", Date.parse("2026-10-07T02:42:37.000Z"))).toBe(5137);
    expect(formatElapsed(5137)).toBe("01:25:37");
  });

  it("formats UTC instants in Manila without depending on browser timezone", () => {
    expect(formatWorkTime("2026-10-07T01:17:00.000Z", "Asia/Manila")).toContain("9:17");
    expect(timezoneOffsetLabel(Date.parse("2026-10-07T01:17:00Z"), "Asia/Manila")).toBe("UTC+08:00");
  });

  it("applies DST offsets for New York and rejects nonexistent wall times", () => {
    expect(timezoneOffsetLabel(Date.parse("2026-01-15T12:00:00Z"), "America/New_York")).toBe("UTC-05:00");
    expect(timezoneOffsetLabel(Date.parse("2026-07-15T12:00:00Z"), "America/New_York")).toBe("UTC-04:00");
    expect(() => workLocalInputInstant("2026-03-08T02:30", "America/New_York")).toThrow(/daylight-saving/);
    expect(workLocalInputInstant("2026-03-08T03:30", "America/New_York")).toBe("2026-03-08T07:30:00.000Z");
  });
});
