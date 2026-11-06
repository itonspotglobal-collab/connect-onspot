import { describe, expect, it } from "vitest";
import { getAdvanceAvailability } from "./getAdvanceAvailability";

describe("getAdvanceAvailability", () => {
  const now = new Date("2025-04-03T12:00:00Z");
  it("allows a confirmed interview after its start", () => {
    expect(getAdvanceAvailability({ status: "confirmed", confirmed_time: "2025-04-03T11:00:00Z" }, now).available).toBe(true);
  });
  it("allows completed pending outcomes", () => {
    expect(getAdvanceAvailability({ status: "completed", outcome: "pending" }, now)).toEqual({ available: true, reason: null });
  });
  it("explains proposed interviews", () => {
    expect(getAdvanceAvailability({ status: "proposed" }, now).reason).toBe("Available once the talent confirms a time and the interview has started.");
  });
  it("gates future confirmed interviews", () => {
    expect(getAdvanceAvailability({ status: "confirmed", confirmedTime: "2025-04-03T13:00:00Z" }, now).available).toBe(false);
  });
  it("allows the exact confirmed start, including camelCase API fields",()=>{
    expect(getAdvanceAvailability({status:"confirmed",confirmedTime:now.toISOString()},now).available).toBe(true);
  });
  it("does not allow already recorded final outcomes",()=>{
    for(const outcome of ["advance","reject","passed"])
      expect(getAdvanceAvailability({status:"confirmed",confirmed_time:"2025-04-03T11:00:00Z",outcome},now).available).toBe(false);
  });
  it("handles invalid or missing confirmed timestamps without throwing",()=>{
    for(const confirmed_time of [undefined,"not a date"])
      expect(getAdvanceAvailability({status:"confirmed",confirmed_time},now).available).toBe(false);
  });
  it("keeps cancelled and unconfirmed interviews unavailable",()=>{
    for(const status of ["cancelled","proposed","rescheduled","completed"])
      expect(getAdvanceAvailability({status,confirmed_time:"2025-04-03T11:00:00Z"},now).available).toBe(false);
  });
});
