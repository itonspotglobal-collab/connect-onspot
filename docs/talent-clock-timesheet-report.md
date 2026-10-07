# Talent Clock and Timesheet implementation report

## 1. Existing architecture

The existing Talent Clock wrote UTC-safe `timestamptz` start/end events to `clock_sessions`. Timesheets already calculated completed hours from those sessions, including explicit Admin-reviewed exception ends and immutable approved revisions. This remains the single tracked-work source. No independent timer table, hourly counter, or new `time_entries` write path was introduced.

The current rule is **one open session per Talent globally**, not one per engagement: the existing user-row lock and partial unique index enforce it. Multiple eligible engagements remain selectable, but simultaneous clocks are not enabled.

Existing Eastern Time half-month billing boundaries, approved revisions, anomaly/correction review, financial rates, and Guaranteed non-attendance semantics are retained.

## 2. Files changed

### Application
- `shared/schema.ts` — nullable contract work timezone.
- `shared/workTimezone.ts` — shared strict IANA/UTC validation.
- `migrations/0037_contract_work_timezone.sql` — additive timezone migration and valid legacy work-zone snapshots.
- `server/routes/clock.ts` — extracted existing Clock endpoints, timezone confirmation, canonical session DTOs.
- `server/routes.ts` — register Clock routes; retain existing correction/Admin review endpoints.
- `server/routes/timesheets.ts` — contract work zone, separate active session, server time, submission gate.
- `server/lib/clientTeamDashboardHandler.ts` — canonical work zone and zero hours for absent legacy entries.
- `server/routes/talentInvoices.ts` — initialize periods with the same contract/job work-zone context; no rate or financial workflow change.
- `client/src/pages/talent/Clock.tsx` — live display, timezone setup, recovery, completed session.
- `client/src/pages/Timesheets.tsx` — active-session banner and recorded duration.
- `client/src/hooks/useServerClock.ts` — display-only clock anchored to server time.
- `client/src/lib/workClockTime.ts` — timezone/DST formatting and elapsed-duration helpers.

### Tests
- `server/tests/clock-live.test.ts`
- `browser-tests/clock-live.browser.test.ts`
- `client/src/lib/workClockTime.test.ts`
- `server/tests/fixtures/timesheetServer.ts`
- `scripts/test-timesheets-isolated.mjs`

Existing organization-timesheet, clock-derived-timesheet, and Client Team tests are included in verification.

## 3. Timezone audit and storage

Existing `profiles.timezone` defaults to UTC and does not establish confirmed engagement work context. Existing `jobs.time_zone` is shared job context; changing it from the Talent Clock would affect other hires. There was no dedicated contract work-zone field.

The smallest safe addition is nullable `hiring_contracts.work_timezone`. A valid explicitly configured job zone can be reused and snapshotted when tracking starts. Otherwise Talent must choose and explicitly save a valid work zone before Clock In. Browser timezone is only an unsaved suggestion. A saved valid alias is retained in the selector even if absent from the browser's standard zone list.

Existing recorded-work contracts are snapshotted only from valid configured job zones. No raw timestamps or approved revision data are rewritten.

The work zone is locked once recorded work has a valid zone, preventing retroactive regrouping of daily totals. A legacy session lacking a valid zone may confirm its initial zone if no approved revision would be reinterpreted. This initial confirmation does not reset the session start.

`PST`, `EST`, `CST`, arbitrary offsets, and invalid regions are rejected. UTC is supported. This is a selected work timezone, **not verified physical location**. No IP-derived zone, GPS tracking, or continuous location tracking is added.

## 4. Active-session API

All routes preserve authentication and Talent ownership:

| Route | Behavior |
|---|---|
| `GET /api/talent/clock` | Eligible active signed tracked contracts, owned active session, recent sessions, work zone, derived duration, database server time. Preserves missed-out detection. |
| `PUT /api/talent/clock/timezone` | Explicitly validate/save the owned eligible contract's zone; preserve historical-zone locks. |
| `POST /api/talent/clock/in` | Lock the authenticated Talent, validate contract/status/effective dates/tracked mode, require valid zone, reject duplicate open sessions, insert server start time. |
| `POST /api/talent/clock/out` | Lock and close the authenticated Talent's actual active session using server end time; do not trust a supplied session ID or end timestamp. |
| `GET /api/talent/timesheets` | Existing clock-derived completed sessions/totals plus separate active session and server time. |

Clock In/Out use database `clock_timestamp()` after locking. Duration is derived from persisted UTC instants or an explicitly approved exception end, rather than independently persisted as another hours source.

An existing owned session can still be ended if its contract later becomes inactive. New Clock In is restricted to eligible active signed tracked contracts. Unsigned, terminated, future-start, foreign, scaffold/incomplete-hire, and Guaranteed contexts do not gain tracking permission.

## 5. Timer and recovery

The UI anchors its current display time to the server response and advances it using a monotonic browser clock. A one-second React interval updates the display only:

`elapsed = max(0, displayNow - persistedStartedAt)`

No attendance write or API call is scheduled every second. Clock/Timesheet state refreshes periodically at 60 seconds and on focus; mutations invalidate the relevant queries.

Refresh, route navigation, and a new authenticated page recover the persisted session through GET. The start is not replaced by component mount time, localStorage, or a frontend counter. Browser closure or sign-out does not automatically end the server session; reopening/signing in relies on the same owned GET recovery. Actual login-form/real-account sign-out UAT remains pending.

The Clock shows current work-local date/time, IANA zone, current UTC offset, canonical local start, and elapsed duration. DST is handled by the existing native `Intl` timezone facilities. Local correction inputs reject nonexistent DST wall times.

## 6. Clock Out

Normal Clock Out stores the real end timestamp, returns the completed session with derived duration, and refreshes Clock and Talent Timesheets. The UI shows completed start, end, duration, and work zone, with historical sessions available after reload.

Existing long-session/missed-out anomalies still require the established correction/Admin review flow. They are not silently turned into approved or billable hours.

## 7. Timesheets

Talent sees the actual open engagement in a separate live banner even when viewing another period or when filters leave no selected period. Duplicate appearances of the same open session across periods are deduplicated. Review-needed open sessions are labeled accordingly, not “Currently working.”

Normal active sessions are excluded from completed recorded sessions and completed totals. Closing the session makes the recorded duration and server-calculated daily/period totals visible.

Submission for a contract with an open session is blocked both in the UI and transactionally on the server with a clear Clock Out message. An unrelated historical contract is not blocked by another contract's open session. Existing submit/review/approved-revision workflows remain in place.

Guaranteed engagements remain non-attendance contexts, not zero-hour tracked timesheets. Missing zones are visibly identified rather than silently rendered in the browser zone.

## 8. Client integration

Client Timesheets continue to read the same authorized clock-derived periods and totals as Talent. Modern tracked Team activity reads those canonical sessions with the contract/job work zone.

The real Team SQL test uncovered an existing null-interval bug: an empty legacy left join contributed a full 24 hours per day. Missing endpoints now contribute zero. Real legacy records retain their established reporting path, while modern hires are not assigned fabricated legacy hours.

Tests compare Talent and hiring Client daily/period totals and actual Team member recorded hours. Foreign Client access remains rejected. No new roster-based payroll permission or competing time source was added.

## 9. Automated verification

**PASS: 53 isolated tests**, covering production Clock/Timesheet/Team handlers against a disposable PostgreSQL database plus existing regression suites.

**PASS: 3 frontend helper tests**, covering elapsed recovery, UTC-to-Manila display, DST offsets and invalid spring-forward local time.

**PASS: TypeScript check, production build, and whitespace/diff check.**

The isolated mobile browser test uses the actual Clock and Timesheets components, real persisted sessions, signed fixture identities, and production API handlers. It performs:

1. Explicit Asia/Manila confirmation, despite a New York browser timezone.
2. Real Clock In.
3. An actual **120-second wait**, without fake-clock advancement or rewriting start timestamps.
4. Refresh and route navigation with the same persisted start/session and non-reset elapsed display.
5. Active Timesheet banner, zero completed total, and disabled submission.
6. Real Clock Out, persisted end and at least two minutes' duration.
7. Recorded duration, completed daily/period hours and submission.
8. Client view with the same persisted totals/daily data.
9. Mobile overflow check and exactly two attendance mutation requests: Clock In and Clock Out.

All 15 requested coverage areas are represented: eligible/ineligible contracts, session creation, duplicate races, recovery, correct Clock Out, duration, completed versus active sessions, timezone persistence, Manila rendering, DST, Client totals, Guaranteed behavior, and cross-role/ownership denial. Additional coverage includes legacy missing-zone confirmation without resetting start, historical access, organization boundaries, and zero invented Team hours.

Commands:

```sh
node scripts/test-timesheets-isolated.mjs
npx vitest run client/src/lib/workClockTime.test.ts
npm run check
npm run build
git diff --check
```

The isolated runner scrubs application credentials, owns its temporary PostgreSQL process/database, and cleans up on exit. A compatible host Chromium wrapper is selected when available. Tests do not use real hiring data.

## 10. Runtime and release

The application workflow was restarted and is serving the preview. Unauthenticated Clock and Talent Timesheet API requests return 401. The mobile protected-route preview shows the Talent login page, not an auth bypass. Signed-in Clock/Timesheet UI was verified in the isolated browser fixture, not through a real account in the main preview.

The additive migration is included in the existing development pre-start and production start migration runners. These changes have not been published by this implementation session; the updated application and migration must be released together.

## 11. Manual UAT status

**Isolated real Clock In → wait → refresh/navigation → Clock Out browser flow: PASS.**

**Manual UAT using the existing hired test Talent and real Client workspace: NOT PERFORMED / PENDING.** No test attendance records were added to that account, and no manual live-account PASS is claimed.

Remaining live-account checklist:

- Sign in as the hired Talent; choose Website Developer and explicitly confirm Asia/Manila.
- Verify current regional time, date and UTC offset.
- Clock In; wait several minutes; refresh, navigate away/back, and confirm the timer/session did not reset.
- Check Currently Working in Timesheets, with active work separate from completed totals and submission blocked.
- Close/reopen the browser or sign out/in and verify persisted-session recovery.
- Clock Out; verify local start/end/zone and duration.
- Check recorded session, daily total and server period total; submit for review.
- Sign in as the owning Client; verify the same Timesheet total and correct Team recorded hours.
