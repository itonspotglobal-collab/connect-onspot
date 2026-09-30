import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  claimDeadlineForPeriod,
  guaranteedPeriodAmount,
  halfMonthPeriod,
  payoutDateForPeriod,
  trackedPeriodAmount,
} from "../routes/talentInvoices.js";

describe("Talent invoice calendar and amount calculations", () => {
  it("splits periods on the 1st/16th and handles short calendar months", () => {
    assert.deepEqual(halfMonthPeriod("2024-02-14"), { start: "2024-02-01", end: "2024-02-15" });
    assert.deepEqual(halfMonthPeriod("2024-02-16"), { start: "2024-02-16", end: "2024-02-29" });
    assert.deepEqual(halfMonthPeriod("2025-02-16"), { start: "2025-02-16", end: "2025-02-28" });
  });

  it("uses America/New_York midnight for claim cutoffs across the spring DST change", () => {
    const deadline = claimDeadlineForPeriod("2025-03-15");
    assert.equal(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", dateStyle: "short", timeStyle: "short",
    }).format(deadline), "3/17/25, 12:00 AM");
    assert.equal(claimDeadlineForPeriod("2025-11-15").toISOString(), "2025-11-17T05:00:00.000Z");
  });

  it("calculates tracked compensation strictly from approved hours", () => {
    assert.equal(trackedPeriodAmount(1000, "Standard", 80).amount, 500);
    assert.equal(trackedPeriodAmount(1000, "Standard", 0).amount, 0);
    assert.equal(trackedPeriodAmount(800, "Lite", 40).amount, 400);
    assert.equal(trackedPeriodAmount(1000, "Standard", 160).amount, 1000);
  });

  it("prorates Guaranteed rates by active calendar days without partial claim deductions", () => {
    assert.equal(guaranteedPeriodAmount(2800, { start: "2025-02-01", end: "2025-02-15" }, "2025-02-01"), 1500);
    assert.equal(guaranteedPeriodAmount(3100, { start: "2025-03-01", end: "2025-03-15" }, "2025-03-08"), 800);
  });

  it("uses New York 25th/5th runs and catches up multiple missed cycles", () => {
    assert.equal(payoutDateForPeriod({ start: "2025-06-01", end: "2025-06-15" }, "2025-06-18"), "2025-06-25");
    assert.equal(payoutDateForPeriod({ start: "2025-06-16", end: "2025-06-30" }, "2025-07-01"), "2025-07-05");
    assert.equal(payoutDateForPeriod({ start: "2025-01-16", end: "2025-01-31" }, "2025-02-07"), "2025-02-25");
    assert.equal(payoutDateForPeriod({ start: "2025-01-01", end: "2025-01-15" }, "2025-03-20"), "2025-03-25");
    assert.equal(payoutDateForPeriod({ start: "2025-01-16", end: "2025-01-31" }, "2025-03-20"), "2025-03-25");
  });
});