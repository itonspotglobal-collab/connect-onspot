# In-session activities

Tracked engagements retain one clock session while Talent switches Work,
Lunch, Break or Meeting. Time Out still records the raw server event immediately.
Missed-Time-Out proposals, Client review and three-day Admin fallback are unchanged.

## Rules and records

- Work is always paid. Default Lunch is unpaid; Break and Meeting are paid.
- Default Lunch maximum: 60 minutes, once per engagement work day.
- Default Break maximum: 15 minutes, two starts per engagement work day.
  Clocking out/in does not reset the day's allowance.
- Admins edit contract rules; Talent sees them read-only. NULL uses defaults.
- Payment eligibility and Lunch/Break duration limits are snapshotted at activity
  start. Updating rules does not change a running or historical activity.
- Server timestamps close/open adjacent activities at the identical instant.
  No client-supplied activity timestamps or payment flags are accepted.
- Over-limit activities remain running, turn amber and generate one canonical
  Talent notification. Polling and a one-minute server sweep use the same atomic
  notification claim; no automatic status switch occurs.

## Calculations and approval

The shared paid-time helper splits at work-timezone midnight and clips to
requested period boundaries and approved effective finish times. Later source
activities remain stored even when excluded from an approved adjustment.
Unresolved missed-Time-Out hours remain excluded from counted time.

Legacy sessions without activities count as paid work. First switching/Time Out
adds their work history without changing the original clock timestamp.

Timesheet approval stores an immutable activity snapshot. Pre-feature approvals
retain their previous all-work interpretation. Invoice hours read that snapshot
and clip the actual activity intervals, including partial-period invoices;
unpaid time is never removed by naively pro-rating the whole shift.

## Migration and verification

`0058_clock_session_activities.sql` follows the existing transaction-local
reconciliation pattern. It adds the activity table/indexes, nullable contract
rules and a nullable timesheet revision activity snapshot. It does not backfill
or rewrite historical raw clock timestamps or previously approved intervals.
Use the established schema-release process for the actual production database;
no production migration or publishing is performed by the test harness.

Run `node scripts/test-timesheets-isolated.mjs` for the clock, timesheet,
organization, dashboard and real-browser regressions. The runner owns an isolated
local PostgreSQL database and does not inherit application credentials.
The browser flow uses the production routes/components and signed fixture
Talent/Client sessions, not real customer accounts or mocked attendance APIs.
