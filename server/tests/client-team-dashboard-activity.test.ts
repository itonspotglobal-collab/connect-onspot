import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clientTeamDashboardSqlForTests } from "../lib/clientTeamDashboardHandler.js";
import {
  calculateModernDashboardActivity,
  getDashboardHoursTracking,
  getDashboardWeeklyTargetHours,
  latestDashboardActivityAt,
  type DashboardClockSession,
  type DashboardTrackedContract,
} from "../lib/clientTeamDashboardActivity.js";

const now = new Date("2024-03-13T12:00:00.000Z");
const contract: DashboardTrackedContract = {
  id: "tracked-contract",
  workTimezone: "America/Los_Angeles",
  effectiveStartDate: null,
  proposedStartDate: null,
  effectiveEndDate: null,
};

function session(
  overrides: Partial<DashboardClockSession> = {},
): DashboardClockSession {
  return {
    id: "clock-session",
    hiringContractId: contract.id,
    startedAt: "2024-03-12T17:00:00.000Z",
    endedAt: "2024-03-12T19:00:00.000Z",
    approvedEndAt: null,
    exceptionStatus: null,
    exceptionType: null,
    ...overrides,
  };
}

function calculate(
  sessions: DashboardClockSession[],
  selectedContracts: DashboardTrackedContract[] = [contract],
) {
  return calculateModernDashboardActivity(selectedContracts, sessions, now);
}

describe("Client Team Dashboard recorded-hour aggregation", () => {
  it("keeps verified legacy time on the legacy source without counting it as a modern clock session", () => {
    assert.equal(calculate([session({ hiringContractId: "legacy-contract" })]).hoursLogged, 0);
  });

  it("includes completed modern Tracked clock intervals", () => {
    assert.equal(calculate([session()]).hoursLogged, 2);
  });

  it("returns zero for a modern Tracked engagement with no completed time", () => {
    assert.equal(calculate([]).hoursLogged, 0);
  });

  it("excludes an open clock and reports it instead of accumulating elapsed time", () => {
    const result = calculate([session({ startedAt: "2024-03-01T17:00:00Z", endedAt: null })]);
    assert.equal(result.hoursLogged, 0);
    assert.equal(result.incompleteSessionCount, 1);
    assert.equal(result.isCurrentlyClockedIn, false);
  });

  it("excludes an unresolved stale missed-clock-out exception", () => {
    const result = calculate([session({
      startedAt: "2024-03-12T17:00:00Z",
      endedAt: null,
      exceptionStatus: "detected",
      exceptionType: "missed_out",
    })]);
    assert.equal(result.hoursLogged, 0);
    assert.equal(result.incompleteSessionCount, 1);
  });

  it("excludes pending and rejected exception intervals until an approved end exists", () => {
    const pending = session({ endedAt: null, exceptionStatus: "pending", exceptionType: "missed_out" });
    const rejected = session({ id: "rejected-session", exceptionStatus: "rejected", exceptionType: "missed_out" });
    const result = calculate([pending, rejected]);
    assert.equal(result.hoursLogged, 0);
    assert.equal(result.incompleteSessionCount, 2);
  });

  it("uses the effective end only for a reviewed approved exception", () => {
    const result = calculate([session({
      endedAt: null,
      approvedEndAt: "2024-03-12T19:00:00.000Z",
      exceptionStatus: "approved",
      exceptionType: "missed_out",
    })]);
    assert.equal(result.hoursLogged, 2);
    assert.equal(result.incompleteSessionCount, 0);
  });

  it("continues to count recorded time regardless of submitted/unapproved timesheet state", () => {
    const unapprovedTimesheet = {
      ...session(),
      timesheetStatus: "submitted",
      approvedRevisionId: null,
    } as DashboardClockSession;
    assert.equal(calculate([unapprovedTimesheet]).hoursLogged, 2);
  });

  it("ignores revisions and invoice-hour representations rather than adding them to clocks", () => {
    const revisionBearingClock = {
      ...session(),
      revisionSnapshots: [{ hours: 5 }, { hours: 7 }],
      invoiceHours: 9,
    } as DashboardClockSession;
    assert.equal(calculate([revisionBearingClock]).hoursLogged, 2);
  });

  it("keeps tracked contracts explicit for a Talent with mixed legacy and modern engagements", () => {
    const result = calculate([
      session(),
      session({ id: "other-source-session", hiringContractId: "legacy-contract" }),
    ]);
    assert.equal(result.hoursLogged, 2);
    assert.deepEqual(result.weeklyActivity.reduce((total, hours) => total + hours, 0), 2);
  });

  it("splits completed time across local midnight into the correct days", () => {
    const result = calculate([session({
      startedAt: "2024-03-13T06:00:00.000Z", // Tuesday 23:00 PDT
      endedAt: "2024-03-13T08:00:00.000Z", // Wednesday 01:00 PDT
    })]);
    assert.equal(result.weeklyActivity[1], 1);
    assert.equal(result.weeklyActivity[2], 1);
  });

  it("clips a session at Monday 00:00 in the work timezone", () => {
    const result = calculate([session({
      startedAt: "2024-03-11T06:30:00.000Z", // Sunday 23:30 PDT
      endedAt: "2024-03-11T07:30:00.000Z", // Monday 00:30 PDT
    })]);
    assert.equal(result.hoursLogged, 0.5);
    assert.equal(result.weeklyActivity[0], 0.5);
    assert.equal(result.weeklyActivity[6], 0);
  });

  it("uses the selected contract work timezone to assign activity days", () => {
    const tokyoContract = { ...contract, workTimezone: "Asia/Tokyo" };
    const result = calculateModernDashboardActivity([tokyoContract], [session({
      startedAt: "2024-03-10T14:30:00.000Z", // Sunday 23:30 in Tokyo
      endedAt: "2024-03-10T15:30:00.000Z", // Monday 00:30 in Tokyo
    })], now);
    assert.equal(result.weeklyActivity[0], 0.5);
    assert.equal(result.weeklyActivity[6], 0);
  });

  it("uses actual DST-aware midnight boundaries for weekly day allocation", () => {
    const result = calculateModernDashboardActivity([contract], [session({
      startedAt: "2024-03-10T08:00:00.000Z", // 00:00 PST, immediately before the spring-forward jump
      endedAt: "2024-03-10T11:00:00.000Z", // 04:00 PDT
    })], new Date("2024-03-10T12:00:00.000Z"));
    assert.equal(result.weeklyActivity[6], 3);
    assert.equal(result.hoursLogged, 3);
  });

  it("clips intervals to inclusive contract service dates in the work timezone", () => {
    const boundedContract = {
      ...contract,
      effectiveStartDate: "2024-03-12",
      effectiveEndDate: "2024-03-12",
    };
    const result = calculateModernDashboardActivity([boundedContract], [session({
      startedAt: "2024-03-12T06:00:00.000Z", // Before the Tuesday 00:00 PDT start boundary
      endedAt: "2024-03-12T09:00:00.000Z", // Tuesday 02:00 PDT
    })], now);
    assert.equal(result.hoursLogged, 2);
    assert.equal(result.weeklyActivity[1], 2);
  });

  it("clips a modern session crossing the inclusive contract end date at local midnight", () => {
    const boundedContract = {
      ...contract,
      effectiveStartDate: "2024-03-12",
      effectiveEndDate: "2024-03-12",
    };
    const result = calculateModernDashboardActivity([boundedContract], [session({
      startedAt: "2024-03-13T06:00:00.000Z", // Tuesday 23:00 PDT
      endedAt: "2024-03-13T10:00:00.000Z", // Wednesday 03:00 PDT
    })], now);
    assert.equal(result.hoursLogged, 1);
    assert.equal(result.weeklyActivity[1], 1);
  });

  it("excludes a future-ended malformed interval rather than fabricating a completed duration", () => {
    const result = calculate([session({
      startedAt: "2024-03-13T10:00:00.000Z",
      endedAt: "2024-03-13T18:00:00.000Z",
    })]);
    assert.equal(result.hoursLogged, 0);
    assert.equal(result.incompleteSessionCount, 1);
  });

  it("counts only the inside-contract portion of a session crossing the start date", () => {
    const result = calculate([session({
      startedAt: "2024-03-12T06:00:00.000Z",
      endedAt: "2024-03-12T08:00:00.000Z",
    })], [{ ...contract, effectiveStartDate: "2024-03-12" }]);
    assert.equal(result.hoursLogged, 1);
    assert.equal(result.weeklyActivity[1], 1);
  });

  for (const workTimezone of [null, "Invalid/WorkZone"]) {
    it(`uses the documented UTC fallback for a ${workTimezone ? "invalid" : "missing"} work timezone`, () => {
      const result = calculate([session({
        startedAt: "2024-03-11T00:30:00.000Z",
        endedAt: "2024-03-11T01:30:00.000Z",
      })], [{ ...contract, workTimezone }]);
      assert.equal(result.hoursLogged, 1);
      assert.equal(result.weeklyActivity[0], 1);
    });
  }

  it("represents a Guaranteed-only engagement as not tracked with no weekly capacity", () => {
    const tracking = getDashboardHoursTracking(false, 0);
    assert.equal(tracking, "not_tracked");
    assert.equal(getDashboardWeeklyTargetHours(tracking, "Standard"), 0);
  });

  it("keeps a mixed legacy/Guaranteed member tracked and excludes Guaranteed mode from its target", () => {
    const tracking = getDashboardHoursTracking(true, 0);
    assert.equal(tracking, "tracked");
    assert.equal(getDashboardWeeklyTargetHours(tracking, null), 40);
  });

  it("keeps the tracked engagement target when a newer Guaranteed engagement exists", () => {
    const tracking = getDashboardHoursTracking(false, 1);
    assert.equal(tracking, "tracked");
    assert.equal(getDashboardWeeklyTargetHours(tracking, "Lite"), 20);
  });

  it("chooses the latest real clock activity, ignores future modern clock-outs, and preserves legacy activity", () => {
    assert.equal(
      latestDashboardActivityAt(
        "2024-03-12T18:00:00.000Z",
        "2024-03-13T10:00:00.000Z",
        now,
      )?.toISOString(),
      "2024-03-13T10:00:00.000Z",
    );
    assert.equal(
      latestDashboardActivityAt(
        "2024-03-12T18:00:00.000Z",
        "2024-03-14T10:00:00.000Z",
        now,
      )?.toISOString(),
      "2024-03-12T18:00:00.000Z",
    );
  });

  it("keeps the endpoint's organization scoping, legacy provenance, and one-row-per-Talent aggregation", () => {
    const routes = readFileSync(new URL("../routes.ts", import.meta.url), "utf8");
    assert.match(routes, /app\.get\(\s*"\/api\/client\/team-dashboard",\s*authenticateJWT,\s*requireClient,\s*createClientTeamDashboardHandler/);
    const dashboardSql = Object.values(clientTeamDashboardSqlForTests).join("\n");
    assert.match(dashboardSql, /om\.organization_id = \$1[\s\S]*om\.status = 'active'/);
    assert.match(dashboardSql, /o\.id = \$1 AND om\.user_id = \$2 AND om\.status = 'active'/);
    assert.match(dashboardSql, /'legacy'::text AS source/);
    assert.match(dashboardSql, /'hiring'::text AS source/);
    assert.match(dashboardSql, /GROUP BY talent_id/);
    assert.match(dashboardSql, /ARRAY_AGG\(engagement_id\) FILTER \(WHERE source = 'legacy'\)/);
    assert.match(dashboardSql, /cs\.hiring_contract_id::text = ANY\(ge\.modern_tracked_contract_ids\)/);
    assert.match(dashboardSql, /MAX\(GREATEST\(\s*cs\.started_at,\s*CASE\s+WHEN cs\.ended_at > cs\.started_at AND cs\.ended_at <= \$2::timestamptz THEN cs\.ended_at\s+ELSE NULL\s+END\s*\)\) AS latest_activity_at/);
    assert.match(dashboardSql, /cs\.ended_at IS NULL\s+AND cs\.exception_status IS NULL\s+AND cs\.exception_type IS NULL/);
    assert.match(dashboardSql, /JSONB_AGG\(DISTINCT JSONB_BUILD_OBJECT/);
    assert.match(dashboardSql, /hours_engagement_rank/);
    assert.match(dashboardSql, /modern_activity\.clock_sessions/);
    assert.doesNotMatch(dashboardSql, /FROM timesheet_revision_sessions/);
    assert.doesNotMatch(dashboardSql, /FROM talent_invoices/);
    assert.match(dashboardSql, /LEAST\(te\.effective_end, DATE_TRUNC\('week', CURRENT_DATE\)/);
    assert.match(dashboardSql, /GREATEST\(te\.start_time, DATE_TRUNC\('week', CURRENT_DATE\)/);
    assert.match(dashboardSql, /entry\.start_time \+ entry\.duration::numeric \* INTERVAL '1 minute'/);
  });
});