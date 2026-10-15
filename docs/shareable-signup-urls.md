# Shareable signup popup URLs

## Behavior

| URL | Existing popup | Existing background | X / Escape destination |
| --- | --- | --- | --- |
| `/portal` | Get started with OnSpot | Home | `/` |
| `/signup/talent` | Find Work registration | Find Work jobs landing | `/find-work/jobs` |
| `/signup/client` | Client registration | Hire Talent | `/hire-talent` |

Role selection from `/portal` changes the URL. Back to Portal from either form
returns to `/portal`. Reload and browser Back/Forward derive the selected popup
from the current route, without relying on previous visits or stored history.

Campaign query parameters survive role navigation, refresh and cancellation.
Private authentication fields such as email, continuation destinations and
application tokens are not copied to public cancellation destinations.

Signup opened while browsing still overlays the original mounted page and
retains its existing scroll/focus restoration behavior. The obsolete `/signup`
page now redirects to `/portal`, retaining its query string; typed signup
routes are unaffected. No signup form was duplicated or redesigned.

## Implementation

- `client/src/App.tsx`: register `/portal` alongside the existing typed routes.
- `client/src/pages/PortalSignupPage.tsx`: real landing-page backgrounds and
  URL-controlled selection, cancellation, campaign parameters and role links.
- `client/src/components/SignUpDialog.tsx`: optional routed role-selection
  callbacks and distinction between user cancellation and successful
  signup/LinkedIn handoff. Existing registration and provider logic stays in
  this component.
- `client/src/lib/authBackNavigation.ts`: exclude `/portal` from return origins
  to prevent authentication navigation loops.

The existing navy styling, logo, form validation, email verification, blurred
overlay, footer actions, scrolling and LinkedIn initiation endpoint are reused.
There are no new dependencies, database changes, or analytics services.

## Verification

- All three direct links checked in fresh isolated browser contexts, with UTM
  parameters, refresh and closing, at mobile, tablet and desktop sizes.
- Role changes, Back to Portal, browser back/forward and reopening via history.
- Existing in-place signup, origin retention, focus restoration, scrolling,
  validation, inline errors, Client and Talent registration/session handoffs.
- Existing LinkedIn button still initiates `/api/auth/linkedin` for both roles.
  The provider endpoint was intercepted in tests; no live LinkedIn login occurred.
- Full browser run: 39 passed and one Client-success case timed out. Investigation
  found overlapping cancellation/success navigation. After separating them, the
  final focused 10-case handoff/visual regression run passed, including that
  previously timed-out Client scenario. The remaining route/navigation checks
  were unchanged by that correction and had already passed.
- Six isolated HTTP tests exercised the actual production `serveStatic` handler:
  direct requests and repeated refreshes return the SPA shell with HTTP 200 for
  all three paths, including its metadata-failure fallback. Metadata is stubbed;
  these tests do not start application migrations or database/background jobs.
- `npx tsc --noEmit`, `npm run build`, and whitespace validation passed.
- The running `/portal` page was visually checked; the mobile Talent popup was
  checked through the real-component browser fixture.

No real registration account was created by the automated tests. Backend
registration requests were explicitly intercepted; payloads and resulting
Client/Talent session handoffs were asserted.

## Release checks

Nothing was published. Production server nested-route handling is verified
locally, not on the currently published site. After release, open each path
from an external email in a fresh browser and complete approved-account UAT.
Live LinkedIn sign-in requires the existing provider configuration and an
approved account; preserving its endpoint is not proof of a completed OAuth
round trip.

## Login presentation and background

`/login`, `/login/client`, `/login/talent` use the same navy modal, official
white logo, dim and blur as signup, retaining distinct Login wording. The
password-setup and forgot-password views use the same form shell. A fresh
direct visit renders Home behind the modal at its hero. When opening Login
from a public page, the page remains mounted at its prior scroll position
and restores that position after X/Escape; role choice and Back to Portal
update the URL with browser history. Background redirects are suppressed
while Login is open, so a role-aware landing cannot compete with a successful
Login redirect. The login requests, validation, session handling and success
destinations have not changed.

Verification: fresh-route mobile/tablet/desktop Login checks, X/Escape,
refresh, original-page persistence, role history, input visibility and
responsive overflow; existing Login incident regressions for both account
types, errors, rate limits, password and admin session handoff. The broader
browser run passed 71 cases and identified two outdated/racy checks; focused
reruns passed the previously failing signup-chooser and Admin session cases.
The production static-route suite now also checks the Login URLs and legacy
signup redirect's SPA shell (routing itself is client-side).
