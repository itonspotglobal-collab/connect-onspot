---
name: Authentication cancellation navigation
description: Client/Talent cancellation and real-page signup overlays, independent of successful-auth redirects.
---

Client/Talent authentication has distinct cancellation actions: forms return to their portal chooser; Login's chooser returns to the original public page or Home for direct visits; direct signup's chooser returns Home. Preserve a valid Login origin through Login/Sign Up switches and refreshes. Campaign signup routes follow the explicit landing-page rules below.

**Why:** The owner reported that users browsing Find Work were sent to Home when cancelling authentication, losing the context they intended to return to.

**How to apply:** Keep cancellation destinations separate from successful-login and application-continuation destinations. Never replace the original origin with an intermediate authentication page. Validate internal destinations, reject external and authentication-loop targets, and avoid stale origins from earlier flows. Apply Client/Talent changes without changing Admin authentication.

## Signup initiated on public pages

Open signup over the actual still-mounted public page, with a slightly darkened, subtly blurred backdrop. Find Work opens Talent signup; Hire Talent opens Client signup. Preserve the polished form design and authentication behavior. For in-place signup, X/Escape close without navigation, reload, or lost scroll/page state; Back to Portal changes only the selection inside the popup. Direct campaign URLs use the route-controlled behavior below, not the former standalone gradient fallback.

**Why:** The owner explicitly rejected replacing the browsing page with the light signup background and subsequently confirmed that the real-page popup, blur, navigation, and signup work correctly. Returning to the same URL afterward is insufficient if it recreates the page and loses its state.

**How to apply:** Keep the real page mounted rather than reconstructing a background from a URL or screenshot. Lock background scrolling while the popup is open and restore focus on in-place cancellation.

## Direct campaign signup URLs

`/portal` opens the existing role chooser over Home. `/signup/talent` opens the existing Talent form over Find Work; `/signup/client` opens the existing Client form over Hire Talent. Refresh and browser history must keep the modal synchronized with the URL. Direct X/Escape cancellation goes to the corresponding landing page; Back to Portal goes to `/portal`. Preserve campaign parameters across role navigation, without forwarding private auth continuation fields to a public cancellation URL.

**Why:** The owner explicitly requested shareable, bookmarkable campaign links for first-time visitors, with real landing pages rather than an empty or gradient-only backdrop. This changes direct-route behavior, not the confirmed in-place browsing experience.

**How to apply:** Reuse the existing forms, logo, overlay and registration APIs. Treat `/portal` as an authentication-flow destination when validating cancellation origins, so it cannot create a return loop. The obsolete `/signup` route now redirects to `/portal`, retaining query parameters. Leave Admin authentication behavior alone unless separately requested.

## Login modal presentation

Direct `/login` and typed Login routes render the actual Home hero at the top behind the navy modal; Login opened while browsing keeps the original page instance mounted with its scroll and focus. The Login chooser and forms match the existing signup dialog's white logo, navy card, blurred backdrop and responsive layout, without altering login APIs or successful destinations.

**Why:** The owner explicitly retired the old standalone Login and signup chooser styling while requiring direct campaign URLs and original-page preservation. A login success can change the authenticated role while the background remains mounted; letting a role-aware background redirect at the same time can race the form's own destination.

**How to apply:** Keep only the presentation background on a frozen public route while Login is open; do not let its internal redirects compete with active Login navigation. The Login form itself continues to use the real URL and its existing successful-authentication logic. Cancel closes to the original page where there is one, otherwise to a valid explicit origin or Home. Browser Back/Forward follows the URL.

Successful registration and provider handoff are not cancellation. A popup's programmatic dismissal for either must not also navigate to its cancellation landing page.

**Why:** Competing SPA cancellation and full-page success/provider navigation can overlap and interrupt the existing session handoff, despite a successful registration response.

**How to apply:** Distinguish user dismissal from successful registration or OAuth handoff. Let the existing authentication logic own its successful destination; route-controlled signup should handle only actual cancellation.

## Modal layout lifecycle

Keep one dialog and scroll-lock owner mounted while switching authentication views; reset route-dependent form presentation without keying the entire dialog by role. Size auth cards from their padded viewport slot, not from `100vw`.

**Why:** With classic scrollbars, replacing a dialog while its scroll-lock stylesheet is still active makes the next lock count existing compensation again. The right margin and padding then grow on each role change, shrinking the actual background. Hiding horizontal overflow does not fix that lifecycle error.

**How to apply:** Chooser, Client, Talent and password views should update within the same shell. Direct-route backgrounds are viewport surfaces; in-place backgrounds must preserve their original component identity and content width. Keep scrollable content inside bounded cards and leave unrelated dialogs unchanged.
