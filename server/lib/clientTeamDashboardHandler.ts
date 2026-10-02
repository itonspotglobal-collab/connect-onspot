import type { Request, RequestHandler, Response } from "express";
import {
  calculateModernDashboardActivity,
  getDashboardHoursTracking,
  getDashboardWeeklyTargetHours,
  latestDashboardActivityAt,
  normalizeDashboardHours,
  type DashboardClockSession,
  type DashboardTrackedContract,
} from "./clientTeamDashboardActivity.js";

export interface ClientTeamDashboardQueryResult {
  rows: any[];
}

export type ClientTeamDashboardQuery = (
  sql: string,
  params?: unknown[],
) => Promise<ClientTeamDashboardQueryResult>;

export interface ClientTeamDashboardHandlerDependencies {
  query: ClientTeamDashboardQuery;
  now?: () => Date;
}

const ORGANIZATION_SQL = `SELECT o.id, o.name
  FROM organizations o
  INNER JOIN organization_members om ON om.organization_id = o.id
 WHERE o.id = $1 AND om.user_id = $2 AND om.status = 'active'
 LIMIT 1`;

/*
 * The independent aggregates are lateral / pre-grouped by Talent so joining
 * modern sessions cannot multiply legacy time, billing, or roster rows.
 */
const MEMBERS_SQL = `WITH authorized_clients AS (
  SELECT om.user_id
    FROM organization_members om
   WHERE om.organization_id = $1 AND om.status = 'active'
), engagements AS (
  SELECT c.id::text AS engagement_id, 'legacy'::text AS source,
         c.client_id, c.talent_id, c.job_id,
         COALESCE(NULLIF(c.title, ''), j.title) AS project,
         j.division AS team, c.contract_type, c.rate::numeric AS rate,
         'USD'::text AS rate_currency, 'hourly'::text AS rate_period,
         NULL::text AS engagement_type, NULL::text AS billing_mode,
         NULL::text AS work_timezone, NULL::date AS effective_start_date,
         NULL::date AS effective_end_date, c.start_date, c.end_date
    FROM contracts c
    INNER JOIN jobs j ON j.id = c.job_id
    INNER JOIN authorized_clients ac ON ac.user_id = c.client_id
   WHERE c.status = 'active' AND (c.end_date IS NULL OR c.end_date::date >= CURRENT_DATE)
  UNION ALL
  SELECT hc.id::text AS engagement_id, 'hiring'::text AS source,
         js.client_id, js.talent_id, js.job_id, j.title AS project,
         j.division AS team, NULL::text AS contract_type, o.rate::numeric AS rate,
         o.rate_currency, 'period'::text AS rate_period, o.engagement_type,
         hc.billing_mode, j.time_zone AS work_timezone, hc.effective_start_date,
         hc.effective_end_date, o.proposed_start_date AS start_date, NULL::date AS end_date
    FROM hiring_contracts hc
    INNER JOIN offers o ON o.id = hc.offer_id
    INNER JOIN job_submissions js ON js.id = hc.submission_id
    INNER JOIN jobs j ON j.id = js.job_id
    INNER JOIN authorized_clients ac ON ac.user_id = js.client_id
   WHERE hc.onspot_signed_at IS NOT NULL AND hc.status NOT IN ('void', 'voided')
     AND js.talent_id IS NOT NULL
), ranked_engagements AS (
  SELECT e.*,
         ROW_NUMBER() OVER (
           PARTITION BY e.talent_id ORDER BY e.start_date DESC NULLS LAST, e.engagement_id DESC
         ) AS engagement_rank,
         ROW_NUMBER() OVER (
           PARTITION BY e.talent_id
           ORDER BY CASE WHEN e.source = 'hiring' AND e.billing_mode = 'guaranteed' THEN 1 ELSE 0 END,
                    e.start_date DESC NULLS LAST, e.engagement_id DESC
         ) AS hours_engagement_rank
    FROM engagements e
), grouped_engagements AS (
  SELECT talent_id, COUNT(DISTINCT job_id)::int AS project_count,
         ARRAY_AGG(DISTINCT job_id) AS project_ids,
         ARRAY_AGG(engagement_id) FILTER (WHERE source = 'legacy') AS legacy_contract_ids,
         ARRAY_AGG(engagement_id)
           FILTER (WHERE source = 'hiring' AND billing_mode = 'tracked') AS modern_tracked_contract_ids,
         COALESCE(BOOL_OR(source = 'legacy'), FALSE) AS has_legacy_time_tracking,
         MAX(engagement_type) FILTER (WHERE hours_engagement_rank = 1) AS hours_engagement_type,
         COALESCE(JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(
           'id', engagement_id, 'workTimezone', work_timezone,
           'effectiveStartDate', effective_start_date, 'proposedStartDate', start_date,
           'effectiveEndDate', effective_end_date
         )) FILTER (WHERE source = 'hiring' AND billing_mode = 'tracked'), '[]'::jsonb)
           AS modern_tracked_contracts,
         MAX(project) FILTER (WHERE engagement_rank = 1) AS project,
         MAX(team) FILTER (WHERE engagement_rank = 1) AS team,
         MAX(rate) FILTER (WHERE engagement_rank = 1) AS rate,
         MAX(rate_currency) FILTER (WHERE engagement_rank = 1) AS rate_currency,
         MAX(rate_period) FILTER (WHERE engagement_rank = 1) AS rate_period,
         MAX(engagement_type) FILTER (WHERE engagement_rank = 1) AS engagement_type,
         MIN(end_date) FILTER (WHERE end_date IS NOT NULL) AS contract_end_date
    FROM ranked_engagements
   GROUP BY talent_id
)
SELECT ge.talent_id,
       COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email, 'Team member') AS name,
       COALESCE(NULLIF(TRIM(p.title), ''), NULLIF(TRIM(ge.project), ''), 'Team member') AS role,
       ge.team, ge.project, ge.project_count, ge.project_ids,
       COALESCE(NULLIF(TRIM(p.availability), ''), 'offline') AS availability,
       COALESCE(NULLIF(TRIM(p.timezone), ''), 'UTC') AS timezone,
       NULLIF(p.rating::text, '0') AS rating, ge.rate, ge.rate_currency, ge.rate_period,
       ge.engagement_type, ge.has_legacy_time_tracking, ge.hours_engagement_type,
       ge.modern_tracked_contracts, ge.contract_end_date,
       latest_activity.start_time AS latest_activity_at,
       latest_activity.end_time AS latest_activity_end,
       modern_activity.latest_activity_at AS modern_latest_activity_at,
       COALESCE(modern_activity.is_currently_clocked_in, FALSE) AS modern_is_currently_clocked_in,
       COALESCE(modern_activity.incomplete_session_count, 0)::int AS modern_incomplete_session_count,
       COALESCE(modern_activity.clock_sessions, '[]'::jsonb) AS modern_clock_sessions,
       COALESCE(time_summary.hours_logged, 0)::numeric AS legacy_hours_logged,
       COALESCE(time_summary.weekly_activity, ARRAY[0,0,0,0,0,0,0]::numeric[]) AS legacy_weekly_activity,
       COALESCE(member_spend.spend_by_currency, '[]'::json) AS spend_by_currency
  FROM grouped_engagements ge
  INNER JOIN users u ON u.id = ge.talent_id
  LEFT JOIN profiles p ON p.user_id = ge.talent_id
  LEFT JOIN LATERAL (
    SELECT te.start_time, te.end_time
      FROM time_entries te
     WHERE te.contract_id = ANY(ge.legacy_contract_ids) AND te.status <> 'rejected'
     ORDER BY te.start_time DESC LIMIT 1
  ) latest_activity ON TRUE
  LEFT JOIN LATERAL (
    SELECT MAX(GREATEST(cs.started_at, CASE
             WHEN cs.ended_at > cs.started_at AND cs.ended_at <= $2::timestamptz THEN cs.ended_at
             ELSE NULL END)) AS latest_activity_at,
           BOOL_OR(cs.started_at <= $2::timestamptz AND cs.ended_at IS NULL
             AND cs.exception_status IS NULL AND cs.exception_type IS NULL
             AND cs.started_at > $2::timestamptz - INTERVAL '30 minutes') AS is_currently_clocked_in,
           COUNT(*) FILTER (WHERE (
             cs.exception_status IS DISTINCT FROM 'approved'
             AND (cs.ended_at IS NULL OR cs.exception_status IS NOT NULL)
           ) OR (
             cs.exception_status = 'approved'
             AND (cs.exception_type IS NULL OR cs.approved_end_at IS NULL
                  OR cs.approved_end_at <= cs.started_at)
           ) OR (
             cs.exception_status IS NULL
             AND (cs.exception_type IS NOT NULL OR
                  (cs.ended_at IS NOT NULL AND cs.ended_at <= cs.started_at))
            ) OR (
              CASE WHEN cs.exception_status = 'approved' THEN cs.approved_end_at ELSE cs.ended_at END > $2::timestamptz
           ))::int AS incomplete_session_count,
           COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
             'id', cs.id, 'hiringContractId', cs.hiring_contract_id,
             'startedAt', cs.started_at, 'endedAt', cs.ended_at,
             'approvedEndAt', cs.approved_end_at, 'exceptionStatus', cs.exception_status,
             'exceptionType', cs.exception_type
           )) FILTER (WHERE cs.started_at >= $2::timestamptz - INTERVAL '8 days'
             OR COALESCE(cs.approved_end_at, cs.ended_at) >= $2::timestamptz - INTERVAL '8 days'
             OR (cs.ended_at IS NULL AND cs.exception_status IS DISTINCT FROM 'approved')), '[]'::jsonb)
             AS clock_sessions
      FROM clock_sessions cs
     WHERE cs.talent_id = ge.talent_id
       AND cs.hiring_contract_id::text = ANY(ge.modern_tracked_contract_ids)
       AND cs.started_at < $2::timestamptz
  ) modern_activity ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(day_hours) AS hours_logged, ARRAY_AGG(day_hours ORDER BY day_index) AS weekly_activity
      FROM (
        SELECT days.day_index,
                COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (
                  LEAST(te.effective_end, DATE_TRUNC('week', CURRENT_DATE) + ((days.day_index + 1) * INTERVAL '1 day'))
                  - GREATEST(te.start_time, DATE_TRUNC('week', CURRENT_DATE) + (days.day_index * INTERVAL '1 day'))
                )) / 3600)), 0)::numeric AS day_hours
          FROM GENERATE_SERIES(0, 6) AS days(day_index)
           LEFT JOIN LATERAL (
             SELECT entry.start_time,
                    CASE WHEN entry.duration IS NOT NULL
                      THEN entry.start_time + entry.duration::numeric * INTERVAL '1 minute'
                      ELSE COALESCE(entry.end_time, NOW())
                    END AS effective_end
               FROM time_entries entry
              WHERE entry.contract_id = ANY(ge.legacy_contract_ids)
                AND entry.status <> 'rejected'
           ) te ON te.start_time < DATE_TRUNC('week', CURRENT_DATE) + ((days.day_index + 1) * INTERVAL '1 day')
             AND te.effective_end > DATE_TRUNC('week', CURRENT_DATE) + (days.day_index * INTERVAL '1 day')
         GROUP BY days.day_index
      ) day_totals
  ) time_summary ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('currency', totals.currency, 'amount', totals.amount)),
                    '[]'::json) AS spend_by_currency
      FROM (
        SELECT i.currency, SUM(i.amount)::numeric AS amount
          FROM invoices i
          INNER JOIN invoice_periods ip ON ip.id = i.period_id
          INNER JOIN hiring_contracts hc ON hc.id = i.hiring_contract_id
          INNER JOIN job_submissions js ON js.id = hc.submission_id
         WHERE js.talent_id = ge.talent_id
           AND js.client_id IN (SELECT user_id FROM authorized_clients) AND i.status <> 'void'
         GROUP BY i.currency
        UNION ALL
        SELECT COALESCE(payments.currency, 'USD') AS currency, SUM(payments.amount)::numeric AS amount
          FROM payments
          INNER JOIN contracts legacy_contract ON legacy_contract.id = payments.contract_id
         WHERE legacy_contract.talent_id = ge.talent_id
           AND legacy_contract.client_id IN (SELECT user_id FROM authorized_clients)
           AND payments.status NOT IN ('failed', 'cancelled')
         GROUP BY COALESCE(payments.currency, 'USD')
      ) totals
  ) member_spend ON TRUE
 ORDER BY name`;

const SPEND_SQL = `WITH authorized_clients AS (
  SELECT om.user_id FROM organization_members om
   WHERE om.organization_id = $1 AND om.status = 'active'
), charges AS (
  SELECT i.currency, i.amount::numeric AS amount,
         COALESCE(ip.period_start::timestamp, i.created_at) AS charge_date
    FROM invoices i
    INNER JOIN invoice_periods ip ON ip.id = i.period_id
    INNER JOIN hiring_contracts hc ON hc.id = i.hiring_contract_id
    INNER JOIN job_submissions js ON js.id = hc.submission_id
    INNER JOIN authorized_clients ac ON ac.user_id = js.client_id
   WHERE i.status <> 'void'
  UNION ALL
  SELECT COALESCE(p.currency, 'USD') AS currency, p.amount::numeric AS amount, p.created_at AS charge_date
    FROM payments p
    INNER JOIN contracts c ON c.id = p.contract_id
    INNER JOIN authorized_clients ac ON ac.user_id = c.client_id
   WHERE p.status NOT IN ('failed', 'cancelled')
)
SELECT currency, SUM(amount)::numeric AS total_spend,
       SUM(amount) FILTER (WHERE charge_date >= DATE_TRUNC('week', CURRENT_DATE)
         AND charge_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days')::numeric AS this_week_spend
  FROM charges GROUP BY currency ORDER BY currency`;

const toNumber = (value: unknown) => value == null ? 0 : Number(value);

export function createClientTeamDashboardHandler(
  dependencies: ClientTeamDashboardHandlerDependencies,
): RequestHandler {
  const now = dependencies.now ?? (() => new Date());
  const dbQuery = dependencies.query;

  return async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const organizationId = typeof req.query.organizationId === "string"
      ? req.query.organizationId.trim()
      : "";
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!organizationId) return res.status(400).json({ error: "organizationId is required" });

    try {
      const dashboardNow = now();
      const organizationResult = await dbQuery(ORGANIZATION_SQL, [organizationId, userId]);
      if (!organizationResult.rows.length) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const memberResult = await dbQuery(MEMBERS_SQL, [organizationId, dashboardNow]);
      const spendResult = await dbQuery(SPEND_SQL, [organizationId]);
      const spendByCurrency = spendResult.rows.map((row: any) => ({
        currency: row.currency,
        total: toNumber(row.total_spend),
        thisWeek: toNumber(row.this_week_spend),
      }));
      const members = memberResult.rows.map((row: any) => {
        const contractEndDate = row.contract_end_date ? new Date(row.contract_end_date) : null;
        const daysUntilEnd = contractEndDate
          ? Math.max(0, Math.ceil((contractEndDate.getTime() - dashboardNow.getTime()) / 86_400_000))
          : null;
        const legacyWeeklyActivity: number[] = Array.isArray(row.legacy_weekly_activity)
          ? row.legacy_weekly_activity.map(toNumber)
          : [0, 0, 0, 0, 0, 0, 0];
        const trackedContracts = Array.isArray(row.modern_tracked_contracts)
          ? row.modern_tracked_contracts as DashboardTrackedContract[]
          : typeof row.modern_tracked_contracts === "string"
            ? JSON.parse(row.modern_tracked_contracts) as DashboardTrackedContract[]
            : [];
        const clockSessions = Array.isArray(row.modern_clock_sessions)
          ? row.modern_clock_sessions as DashboardClockSession[]
          : typeof row.modern_clock_sessions === "string"
            ? JSON.parse(row.modern_clock_sessions) as DashboardClockSession[]
            : [];
        const modernActivity = calculateModernDashboardActivity(trackedContracts, clockSessions, dashboardNow);
        const weeklyActivity = legacyWeeklyActivity.map((hours, index) =>
          normalizeDashboardHours(hours + (modernActivity.weeklyActivity[index] ?? 0)));
        const hoursLogged = normalizeDashboardHours(
          weeklyActivity.reduce((total, hours) => total + hours, 0),
        );
        const profileAvailability = String(row.availability || "").toLowerCase();
        const isActiveTimeEntry = row.latest_activity_at && !row.latest_activity_end
          && dashboardNow.getTime() - new Date(row.latest_activity_at).getTime() < 30 * 60_000;
        const latestActivityAt = latestDashboardActivityAt(
          row.latest_activity_at, row.modern_latest_activity_at, dashboardNow,
        );
        const isActiveModernClock = Boolean(row.modern_is_currently_clocked_in)
          && modernActivity.isCurrentlyClockedIn;
        const status = profileAvailability === "available" || profileAvailability === "online"
          ? "online"
          : profileAvailability === "busy" || profileAvailability === "away"
            ? "away"
            : isActiveTimeEntry || isActiveModernClock ? "online" : "offline";
        const hoursTracking = getDashboardHoursTracking(
          Boolean(row.has_legacy_time_tracking), trackedContracts.length,
        );
        const weeklyTargetHours = getDashboardWeeklyTargetHours(
          hoursTracking, row.hours_engagement_type ?? null,
        );
        const memberSpend = Array.isArray(row.spend_by_currency)
          ? row.spend_by_currency.map((spend: any) => ({
            currency: spend.currency, amount: toNumber(spend.amount),
          }))
          : [];
        return {
          id: row.talent_id,
          name: row.name,
          initials: row.name.split(/\s+/).filter(Boolean).slice(0, 2)
            .map((part: string) => part[0]?.toUpperCase()).join("") || "TM",
          role: row.role,
          team: row.team || undefined,
          status,
          timezone: row.timezone,
          latestActivityAt,
          project: row.project || "No active project",
          projectCount: Number(row.project_count || 0),
          projectIds: Array.isArray(row.project_ids) ? row.project_ids : [],
          contractWarning: daysUntilEnd != null && daysUntilEnd <= 14
            ? `Contract ends in ${daysUntilEnd} day${daysUntilEnd === 1 ? "" : "s"}`
            : undefined,
          rating: row.rating == null ? null : toNumber(row.rating),
          hoursTracking,
          hoursLogged: hoursTracking === "not_tracked" ? 0 : hoursLogged,
          weeklyTargetHours,
          weeklyActivity,
          incompleteSessionCount: toNumber(row.modern_incomplete_session_count),
          rate: row.rate == null ? null : toNumber(row.rate),
          rateCurrency: row.rate_currency || null,
          ratePeriod: row.rate_period || null,
          engagementType: row.engagement_type || null,
          spendByCurrency: memberSpend,
        };
      });
      const totalHours = normalizeDashboardHours(
        members.reduce((sum: number, member: any) => sum + member.hoursLogged, 0),
      );
      const weeklyCapacity = members.reduce((sum: number, member: any) => sum + member.weeklyTargetHours, 0);
      const needsAttention = members.filter((member: any) => member.contractWarning).length;

      return res.json({
        organization: organizationResult.rows[0],
        summary: {
          teamMembers: members.length,
          activeProjects: new Set(memberResult.rows.flatMap((row: any) => row.project_ids || [])).size,
          hoursLogged: totalHours,
          weeklyCapacityHours: weeklyCapacity,
          needsAttention,
        },
        members,
        spendByCurrency,
        roi: {
          benchmarkAvailable: false,
          totalSpendByCurrency: spendByCurrency.map(({ currency, total }) => ({ currency, amount: total })),
          thisWeekSpendByCurrency: spendByCurrency.map(({ currency, thisWeek }) => ({ currency, amount: thisWeek })),
          savingsByCurrency: [],
        },
      });
    } catch (err: any) {
      console.error("GET /api/client/team-dashboard failed:", err);
      return res.status(500).json({ error: "Failed to load team dashboard" });
    }
  };
}

export const clientTeamDashboardSqlForTests = {
  organization: ORGANIZATION_SQL,
  members: MEMBERS_SQL,
  spend: SPEND_SQL,
};