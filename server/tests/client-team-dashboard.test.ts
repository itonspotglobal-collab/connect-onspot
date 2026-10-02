import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clientTeamDashboardSqlForTests,
  createClientTeamDashboardHandler,
  type ClientTeamDashboardQuery,
} from "../lib/clientTeamDashboardHandler.js";
import type { DashboardClockSession, DashboardTrackedContract } from "../lib/clientTeamDashboardActivity.js";

const now = new Date("2024-03-13T12:00:00.000Z");
const trackedContract: DashboardTrackedContract = {
  id: "tracked-contract",
  workTimezone: "America/Los_Angeles",
  effectiveStartDate: null,
  proposedStartDate: null,
  effectiveEndDate: null,
};

function modernSession(overrides: Partial<DashboardClockSession> = {}): DashboardClockSession {
  return {
    id: "clock-1",
    hiringContractId: trackedContract.id,
    startedAt: "2024-03-12T17:00:00.000Z",
    endedAt: "2024-03-12T19:00:00.000Z",
    approvedEndAt: null,
    exceptionStatus: null,
    exceptionType: null,
    ...overrides,
  };
}

function member(overrides: Record<string, unknown> = {}) {
  return {
    talent_id: "talent-1",
    name: "Taylor Talent",
    role: "Engineer",
    team: "Platform",
    availability: "offline",
    timezone: "America/Los_Angeles",
    project: "Dashboard",
    project_count: 1,
    project_ids: ["project-1"],
    rate: "80",
    rate_currency: "USD",
    rate_period: "period",
    engagement_type: "Standard",
    hours_engagement_type: "Standard",
    has_legacy_time_tracking: false,
    modern_tracked_contracts: [],
    modern_clock_sessions: [],
    modern_incomplete_session_count: 0,
    modern_is_currently_clocked_in: false,
    legacy_hours_logged: 0,
    legacy_weekly_activity: [0, 0, 0, 0, 0, 0, 0],
    spend_by_currency: [],
    ...overrides,
  };
}

function fixtureQuery(options: {
  allowed?: boolean;
  members?: Record<string, unknown>[];
  spend?: Record<string, unknown>[];
} = {}) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query: ClientTeamDashboardQuery = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql === clientTeamDashboardSqlForTests.organization) {
      const [organizationId, userId] = params;
      const row = options.allowed === false || organizationId !== "org-1" || userId !== "owner-1"
        ? []
        : [{ id: "org-1", name: "Example Org" }];
      return { rows: row };
    }
    if (sql === clientTeamDashboardSqlForTests.members) {
      assert.equal(params[0], "org-1");
      assert.ok(params[1] instanceof Date);
      assert.match(sql, /WHERE om\.organization_id = \$1 AND om\.status = 'active'/);
      assert.match(sql, /INNER JOIN authorized_clients ac ON ac\.user_id = c\.client_id/);
      assert.match(sql, /INNER JOIN authorized_clients ac ON ac\.user_id = js\.client_id/);
      return { rows: options.members ?? [] };
    }
    if (sql === clientTeamDashboardSqlForTests.spend) {
      assert.deepEqual(params, ["org-1"]);
      assert.match(sql, /WHERE om\.organization_id = \$1 AND om\.status = 'active'/);
      return { rows: options.spend ?? [] };
    }
    throw new Error("Unexpected dashboard query");
  };
  return { query, calls };
}

async function invoke(
  query: ClientTeamDashboardQuery,
  request: { user?: { id: string }; query: Record<string, unknown> },
) {
  const handler = createClientTeamDashboardHandler({ query, now: () => now });
  const response: { statusCode: number; body: any; status: (code: number) => any; json: (body: any) => any } = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = JSON.parse(JSON.stringify(body));
      return this;
    },
  };
  await handler(request as any, response as any, () => undefined);
  return response;
}

describe("GET /api/client/team-dashboard handler with an isolated query fixture", () => {
  it("returns 401 when no authenticated client user is attached", async () => {
    const fixture = fixtureQuery();
    const response = await invoke(fixture.query, { query: { organizationId: "org-1" } });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { error: "Unauthorized" });
    assert.equal(fixture.calls.length, 0);
  });

  it("returns 400 for a missing organization id", async () => {
    const fixture = fixtureQuery();
    const response = await invoke(fixture.query, { user: { id: "owner-1" }, query: {} });
    assert.equal(response.statusCode, 400);
    assert.equal(fixture.calls.length, 0);
  });

  it("returns 404 for a nonmember, missing organization, or inactive membership", async () => {
    for (const userId of ["outsider", "inactive-member"]) {
      const fixture = fixtureQuery({ allowed: false });
      const response = await invoke(fixture.query, {
        user: { id: userId },
        query: { organizationId: "org-1" },
      });
      assert.equal(response.statusCode, 404);
      assert.deepEqual(response.body, { error: "Organization not found" });
      assert.equal(fixture.calls.length, 1);
      assert.deepEqual(fixture.calls[0].params, ["org-1", userId]);
      assert.match(fixture.calls[0].sql, /o\.id = \$1 AND om\.user_id = \$2 AND om\.status = 'active'/);
    }
    const missingOrg = fixtureQuery();
    const response = await invoke(missingOrg.query, {
      user: { id: "owner-1" },
      query: { organizationId: "other-org" },
    });
    assert.equal(response.statusCode, 404);
  });

  it("returns a modern Tracked member's completed recorded hours and recorded latest activity", async () => {
    const row = member({
      modern_tracked_contracts: [trackedContract],
      modern_clock_sessions: [modernSession()],
      modern_latest_activity_at: "2024-03-12T19:00:00.000Z",
      modern_incomplete_session_count: 2,
      modern_is_currently_clocked_in: false,
    });
    const fixture = fixtureQuery({ members: [row] });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.members[0].hoursLogged, 2);
    assert.equal(response.body.members[0].hoursTracking, "tracked");
    assert.equal(response.body.members[0].incompleteSessionCount, 2);
    assert.equal(response.body.members[0].latestActivityAt, "2024-03-12T19:00:00.000Z");
    assert.equal(response.body.summary.hoursLogged, 2);
  });

  it("counts legacy time_entries hours and keeps legacy scope separate from clock sessions", async () => {
    const fixture = fixtureQuery({
      members: [member({
        has_legacy_time_tracking: true,
        legacy_hours_logged: "3.5",
        legacy_weekly_activity: [3.5, 0, 0, 0, 0, 0, 0],
      })],
    });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.body.members[0].hoursLogged, 3.5);
    assert.equal(response.body.members[0].hoursTracking, "tracked");
    assert.match(fixture.calls[1].sql, /ARRAY_AGG\(engagement_id\) FILTER \(WHERE source = 'legacy'\)/);
    assert.match(fixture.calls[1].sql, /FROM time_entries te/);
    assert.match(fixture.calls[1].sql, /te\.contract_id = ANY\(ge\.legacy_contract_ids\)/);
    assert.doesNotMatch(fixture.calls[1].sql, /timesheet_revision_sessions|talent_invoices/);
  });

  it("aggregates mixed legacy and modern recorded hours once per Talent", async () => {
    const fixture = fixtureQuery({
      members: [member({
        has_legacy_time_tracking: true,
        legacy_hours_logged: "3",
        legacy_weekly_activity: [3, 0, 0, 0, 0, 0, 0],
        modern_tracked_contracts: [trackedContract],
        modern_clock_sessions: [modernSession()],
      })],
    });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.body.members.length, 1);
    assert.equal(response.body.members[0].hoursLogged, 5);
    assert.equal(response.body.summary.hoursLogged, 5);
    assert.equal(response.body.members[0].weeklyActivity.reduce((sum: number, value: number) => sum + value, 0), 5);
  });

  it("does not multiply modern or legacy hours when multiple engagements are grouped", async () => {
    const fixture = fixtureQuery({
      members: [member({
        has_legacy_time_tracking: true,
        legacy_hours_logged: "3",
        legacy_weekly_activity: [3, 0, 0, 0, 0, 0, 0],
        modern_tracked_contracts: [
          trackedContract,
          { ...trackedContract, id: "tracked-contract-2" },
        ],
        modern_clock_sessions: [modernSession()],
        project_count: 2,
        project_ids: ["project-1", "project-2"],
      })],
    });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.body.members[0].hoursLogged, 5);
    assert.equal(response.body.summary.activeProjects, 2);
    assert.equal(response.body.summary.teamMembers, 1);
  });

  it("returns Guaranteed-only members as not tracked with zero hours and weekly capacity", async () => {
    const fixture = fixtureQuery({
      members: [member({ engagement_type: "Standard", hours_engagement_type: null })],
    });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.body.members[0].hoursTracking, "not_tracked");
    assert.equal(response.body.members[0].hoursLogged, 0);
    assert.equal(response.body.members[0].weeklyTargetHours, 0);
    assert.equal(response.body.summary.weeklyCapacityHours, 0);
  });

  it("uses the Tracked engagement target when a newer Guaranteed engagement is present", async () => {
    const fixture = fixtureQuery({
      members: [member({
        hours_engagement_type: "Lite",
        modern_tracked_contracts: [trackedContract],
      })],
    });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.body.members[0].hoursTracking, "tracked");
    assert.equal(response.body.members[0].weeklyTargetHours, 20);
  });

  it("surfaces unresolved modern sessions without counting open-clock elapsed time", async () => {
    const fixture = fixtureQuery({
      members: [member({
        modern_tracked_contracts: [trackedContract],
        modern_clock_sessions: [modernSession({
          startedAt: "2024-03-13T11:45:00.000Z",
          endedAt: null,
        })],
        modern_is_currently_clocked_in: true,
        modern_incomplete_session_count: 1,
      })],
    });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.body.members[0].hoursLogged, 0);
    assert.equal(response.body.members[0].incompleteSessionCount, 1);
    assert.equal(response.body.members[0].status, "online");
  });

  it("does not use reviewed effective times as the modern last-activity clock-out", async () => {
    const fixture = fixtureQuery({
      members: [member({
        modern_tracked_contracts: [trackedContract],
        modern_clock_sessions: [modernSession({
          endedAt: null,
          approvedEndAt: "2024-03-12T19:00:00.000Z",
          exceptionStatus: "approved",
          exceptionType: "missed_out",
        })],
        modern_latest_activity_at: "2024-03-12T17:00:00.000Z",
      })],
    });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.body.members[0].hoursLogged, 2);
    assert.equal(response.body.members[0].latestActivityAt, "2024-03-12T17:00:00.000Z");
    assert.match(fixture.calls[1].sql, /cs\.ended_at > cs\.started_at AND cs\.ended_at <= \$2::timestamptz/);
    assert.doesNotMatch(fixture.calls[1].sql, /CASE WHEN cs\.exception_status IS NULL THEN cs\.ended_at/);
  });

  it("uses a valid raw clock-out regardless of exception status, but rejects a future clock-out", async () => {
    const fixture = fixtureQuery({
      members: [member({
        modern_tracked_contracts: [trackedContract],
        modern_clock_sessions: [modernSession({
          endedAt: "2024-03-12T19:00:00.000Z",
          exceptionStatus: "rejected",
          exceptionType: "missed_out",
        })],
        modern_latest_activity_at: "2024-03-12T19:00:00.000Z",
      })],
    });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.body.members[0].latestActivityAt, "2024-03-12T19:00:00.000Z");
    assert.match(fixture.calls[1].sql, /cs\.ended_at > cs\.started_at AND cs\.ended_at <= \$2::timestamptz/);
  });

  it("combines spend, hours, capacity, and attention summaries from the same scoped fixture", async () => {
    const fixture = fixtureQuery({
      members: [
        member({ talent_id: "t1", has_legacy_time_tracking: true, legacy_hours_logged: 2,
          legacy_weekly_activity: [2, 0, 0, 0, 0, 0, 0], contract_end_date: "2024-03-20" }),
        member({ talent_id: "t2", has_legacy_time_tracking: false }),
      ],
      spend: [{ currency: "USD", total_spend: "100", this_week_spend: "25" }],
    });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.body.summary.teamMembers, 2);
    assert.equal(response.body.summary.hoursLogged, 2);
    assert.equal(response.body.summary.weeklyCapacityHours, 40);
    assert.equal(response.body.summary.needsAttention, 1);
    assert.deepEqual(response.body.spendByCurrency, [{ currency: "USD", total: 100, thisWeek: 25 }]);
    assert.deepEqual(fixture.calls.map((call) => call.params[0]), ["org-1", "org-1", "org-1"]);
  });

  it("preserves the profile availability precedence over a current modern open clock", async () => {
    const fixture = fixtureQuery({
      members: [member({
        availability: "away",
        modern_tracked_contracts: [trackedContract],
        modern_clock_sessions: [modernSession({
          startedAt: "2024-03-13T11:45:00.000Z",
          endedAt: null,
        })],
        modern_is_currently_clocked_in: true,
        modern_incomplete_session_count: 1,
      })],
    });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.body.members[0].status, "away");
  });

  it("uses approved effective ends for recorded hours while leaving latest activity on the raw clock-in", async () => {
    const fixture = fixtureQuery({
      members: [member({
        modern_tracked_contracts: [trackedContract],
        modern_clock_sessions: [modernSession({
          endedAt: null,
          approvedEndAt: "2024-03-12T19:00:00.000Z",
          exceptionStatus: "approved",
          exceptionType: "missed_out",
        })],
        modern_latest_activity_at: "2024-03-12T17:00:00.000Z",
      })],
    });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.body.members[0].hoursLogged, 2);
    assert.equal(response.body.members[0].latestActivityAt, "2024-03-12T17:00:00.000Z");
  });

  it("preserves a legacy latest activity when modern activity is absent or future-dated", async () => {
    const fixture = fixtureQuery({
      members: [member({
        latest_activity_at: "2024-03-12T16:00:00.000Z",
        modern_latest_activity_at: "2024-03-14T10:00:00.000Z",
      })],
    });
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.body.members[0].latestActivityAt, "2024-03-12T16:00:00.000Z");
  });

  it("returns a valid empty roster and zero summary for an active organization member", async () => {
    const fixture = fixtureQuery();
    const response = await invoke(fixture.query, {
      user: { id: "owner-1" },
      query: { organizationId: "org-1" },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.summary, {
      teamMembers: 0,
      activeProjects: 0,
      hoursLogged: 0,
      weeklyCapacityHours: 0,
      needsAttention: 0,
    });
  });

  it("returns the documented 500 response when a scoped query fails", async () => {
    const query: ClientTeamDashboardQuery = async (sql) => {
      if (sql === clientTeamDashboardSqlForTests.organization) return { rows: [{ id: "org-1", name: "Example Org" }] };
      throw new Error("fixture query error");
    };
    const originalError = console.error;
    console.error = () => undefined;
    try {
      const response = await invoke(query, {
        user: { id: "owner-1" },
        query: { organizationId: "org-1" },
      });
      assert.equal(response.statusCode, 500);
      assert.deepEqual(response.body, { error: "Failed to load team dashboard" });
    } finally {
      console.error = originalError;
    }
  });
});