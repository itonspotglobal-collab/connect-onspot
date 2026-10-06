# Interview, offer and hiring-flow correction

## Root causes

- A shared hiring guard only admitted `client_invitation`. Legitimate authenticated Find Work applications were saved as `application`, so Client interviews/offers and downstream contract queries rejected the correct original record.
- Admin availability used the selected interviewer's personal calendar. Confirmation saved an interview and sent a companion email, but never created an Outlook event.
- Talent-led scheduling submitted every availability result, exceeding the server's ten-proposal limit. Controls now select one to ten actual windows and reset selections when configuration changes.
- Action visibility did not distinguish linked, hireable applications from unlinked/imported/shortlist records.
- A Client confirming an older proposal could rewrite an already advanced parent application to `interviewing`; interview outcomes could also reject an already signed hire. Both paths now lock and check the parent before writing. Signed/Hired applications cannot be reopened or rejected this way.

## Eligibility and authorization

Hiring uses the original `job_submissions` record, not the separate legacy `job_applications` tracker and not a duplicate invitation.

Both entry paths require a real non-scaffold job, matching persisted job/submission Client ownership, a valid Client/Admin owner, an actual Talent user, and a non-rejected/non-withdrawn/non-declined submission. Organic applications additionally require Talent initiation, linked registration, approved job approval status and a non-draft job.

Existing action-specific stages remain enforced. Admin scheduling allows new/review/shortlist/interviewing stages; Client interview creation requires its existing review/shortlist/interviewing stages. Offers retain their original permitted stages, engagement/billing snapshot validation, pending-offer exclusion, expiry behavior and USD rules. Offer eligibility is rechecked under a submission lock before insertion.

Clients still only act on their own submissions. Random or foreign IDs fail; no new organization/team-wide privilege was introduced. Invitations still use their existing creation, acceptance and messaging relationship. Invitation-only name reveal and messaging predicates remain separate from the broader hiring predicate.

Client-created interviews preserve the existing in-app proposal/response flow; this change does **not** give Clients arbitrary access to the shared mailbox or introduce a new Admin-review requirement.

## Shared Outlook calendar

Admin availability and Admin-managed confirmations target the configured shared FindWork mailbox, never the logged-in Admin/personal interviewer's calendar. The mailbox is resolved from an explicit calendar override or the existing FindWork verification sender.

An Admin confirmation or Talent acceptance of an Admin proposal:

1. Locks/revalidates the interview and submission and checks Talent conflicts.
2. Serializes shared-calendar writes and verifies current Outlook availability.
3. Creates/updates a real Graph event with the canonical Talent account email as attendee, relevant OnSpot interviewer context, job/applicant/type details, duration, public notes and UTC instants. The selected display timezone remains persisted.
4. Requests an event-based Teams meeting only when the calendar advertises Teams support and no manual meeting link was supplied.
5. Persists the returned event ID and genuine meeting link before committing confirmation.

Graph failure rolls back the local confirmation. Safe distinct errors cover missing configuration, inaccessible mailbox, unavailable calendar, busy time and event failure; empty verified availability remains an empty result, not fabricated slots.

Stable Graph transaction identifiers and stored event references prevent duplicate events. Calendar-view transaction IDs recover a remotely created event after a lost response/local rollback. Reschedule/cancellation removes the old appointment before committing; an already removed event is only treated as idempotently removed after verifying mailbox-calendar access. Completed event history is retained.

Creating an event with attendees asks Exchange to issue invitations. An API event reference is **not** proof of inbox receipt.

## Microsoft permissions

- Effective **application `Calendars.ReadWrite`** access to the shared mailbox is required for calendar reads/free-busy and event creation/update/deletion.
- Prefer Exchange Online Application RBAC, **`Application Calendars.ReadWrite`**, restricted to the intended mailbox. Alternatively, use tenant-admin-consented Entra application `Calendars.ReadWrite` with the tenant's supported Exchange mailbox restriction.
- Exchange RBAC and Entra grants are additive: retaining an unrestricted Entra grant defeats an intended RBAC-only mailbox restriction.
- Existing companion emails separately need **application `Mail.Send`** access to their configured sender. Calendar invitations do not require a separate MIME/ICS mail implementation.
- This uses app-only `/users/...`, not delegated `/me` or `Calendars.ReadWrite.Shared`. Event-based Teams creation does not require `OnlineMeetings.ReadWrite.All`; mailbox licensing/provider support must still be valid.

References:
- https://learn.microsoft.com/en-us/graph/api/user-post-events
- https://learn.microsoft.com/en-us/graph/api/calendar-getschedule
- https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac

### Environment variable names only

Required existing credentials: `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`.

Mailbox configuration: `MICROSOFT_FINDWORK_MAILBOX` or existing `TALENT_VERIFICATION_EMAIL_FROM`.

Optional existing interviewer configuration: `ONSPOT_INTERVIEWERS_JSON`.

Existing companion sender configuration: `APPLICATION_EMAIL_FROM`.

Disposable regression harness only: `HIRING_FLOW_TEST_DATABASE_URL`.

Check the mailbox setting in **each** environment; a development-only sender setting does not configure production.

## Files and migration

Functional files:
- `server/services/formalPipelineGuard.ts`
- `server/services/findWorkCalendarService.ts` (new)
- `server/services/microsoftGraphCalendarService.ts`
- `server/services/hiringContractService.ts` (eligibility wording only)
- `server/routes.ts`
- `shared/schema.ts`
- `client/src/components/InterviewWorkflowUi.tsx`
- `client/src/pages/AdminJobApplications.tsx`
- `client/src/pages/ClientProfile.tsx`

Regression files:
- `scripts/verify-hiring-flow.ts`
- `server/tests/hiring-flow.fixture.ts`
- `server/tests/fixtures/hiring-db.ts`

`migrations/0034_findwork_interview_calendar.sql` additively adds `calendar_event_id`, `calendar_managed` and `calendar_interviewer_id` to interviews. Existing records, offers, contracts and proposals are retained. Existing Admin-created interviews are recognized by their creator when subsequently confirmed/updated; no retrospective invitations are sent merely by loading the page.

Development is positively identified as the existing `heliumdb`; migration `0034` is applied and its three columns verified. Production has **not** been migrated or published by this task. Use the existing versioned migration workflow against the confirmed production target before running the changed production routes.

## Automated results

**10/10 native PostgreSQL regression tests passed.** Full TypeScript checking and diff whitespace checking passed. The application starts and its public preview renders. These tests exercise the actual production route-handler bodies, eligibility helpers, contract/signature service and calendar service against a separate loopback-only disposable database. Only external Microsoft HTTP responses are simulated; OnSpot SQL and business logic are not mocked.

Coverage includes:
- Actual Client invitation creation/acceptance and actual authenticated Find Work submission creation.
- Both paths through interview creation, offer, Talent acceptance and contract eligibility, using the same submission ID.
- Native fixture review-stage preparation (not a claim of browser/Admin review UAT).
- Talent signature alone does not hire; Admin cannot impersonate the Talent signature; subsequent OnSpot countersign marks the contract signed and submission hired.
- Cross-Client interview/offer creation and list/update denials; random IDs; rejected/withdrawn, silent, unlinked, forged-owner, draft, pending-approval and scaffold exclusions.
- Admin-selected time and Talent-selected Admin proposals; canonical Talent attendee, UTC time/duration, stored display timezone and event ID.
- Graph permission/event/busy failures, local rollback, repeat confirmation and recovery after a lost event-creation response.

The standalone runner requires an explicitly initialized disposable local database with the current shared schema. It refuses application/production database credentials and never imports full application startup. The fixture adds the existing runtime-managed settings table absent from Drizzle.

An older live-development regression command was **not green**: its personal-calendar expectation conflicts with the new shared-calendar behavior, and legacy interview fixtures are blocked by existing email-ownership requirements. Those results are not presented as passing. No authentication requirement was weakened to make fixtures pass.

## Manual UAT checklist and current results

**Live Outlook event/send/receive: PENDING.** The existing configured live mailbox availability check returned an access error. Tenant calendar permission and mailbox scope need verification. No real invitation delivery is claimed.

**Authenticated Admin/Client browser UAT: PENDING.** The screenshot browser cannot sign into those pages. The native regression results above are not a substitute for signed-in visual UAT.

Admin:
1. Open a real linked Find Work application; review/shortlist it.
2. Open Schedule Interview; verify interviewer, dates, timezone, duration and navigation.
3. Choose an Admin time; confirm the persisted interview and shared-mailbox event.
4. Verify the actual Talent inbox receives the Outlook invitation and any supported join link.
5. Choose Talent-led scheduling; select up to ten windows; accept one as Talent.
6. Verify final timezone/time and exactly one shared event, including retry behavior.

Client:
1. Apply through Find Work as authenticated Talent and verify the owning Client sees that original application.
2. Complete the existing review/shortlist workflow; propose an interview without a forbidden/not-found error.
3. Reach the existing offer stage and submit an offer successfully.
4. Verify the Talent offer, acceptance and reachable Admin contract workflow.
5. Verify Hired only after the real required signatures.

Security:
1. Repeat interview creation/read/update and offer creation/read using another Client's identifiers.
2. Verify server rejection for foreign/random, rejected/withdrawn/terminal and unlinked/shortlist records.

## Limitations and guarantees

Live mailbox permissions, Teams support and actual recipient delivery remain unverified. A temporary tenant/network failure must be fixed or retried, not bypassed. Cross-environment or externally created calendar writes cannot participate in this application's database advisory lock; Outlook availability is checked again immediately before writing. There is no new background reconciliation/outbox worker for arbitrary external calendar edits.

The public preview retains existing unrelated Lindy-embed authorization and missing Stripe-public-key warnings; startup also retains legacy non-USD billing warnings. These were not changed as part of this hiring/calendar task.

**Hired remains signed-contract controlled. Cross-Client authorization remains enforced. The existing Client-invitation creation/acceptance/offer/signature path passed the native regression alongside organic applications. No auth bypass, fake calendar event, duplicate organic invitation or broad hiring redesign was added.**
