---
name: Authentication cancellation navigation
description: Client/Talent cancellation and real-page signup overlays, independent of successful-auth redirects.
---

Client/Talent authentication has distinct cancellation actions: forms return to their portal chooser, and legacy choosers return to the original public page. Preserve that origin through Login/Sign Up switches and refreshes. Direct login or legacy chooser visits without an origin fall back to Home; campaign signup routes follow the explicit landing-page rules below.

**Why:** The owner reported that users browsing Find Work were sent to Home when cancelling authentication, losing the context they intended to return to.

**How to apply:** Keep cancellation destinations separate from successful-login and application-continuation destinations. Never replace the original origin with an intermediate authentication page. Validate internal destinations, reject external and authentication-loop targets, and avoid stale origins from earlier flows. Apply Client/Talent changes without changing Admin authentication.

## Signup initiated on public pages

Open signup over the actual still-mounted public page, with a slightly darkened, subtly blurred backdrop. Find Work opens Talent signup; Hire Talent opens Client signup. Preserve the polished form design and authentication behavior. For in-place signup, X/Escape close without navigation, reload, or lost scroll/page state; Back to Portal changes only the selection inside the popup. Direct campaign URLs use the route-controlled behavior below, not the former standalone gradient fallback.

**Why:** The owner explicitly rejected replacing the browsing page with the light signup background and subsequently confirmed that the real-page popup, blur, navigation, and signup work correctly. Returning to the same URL afterward is insufficient if it recreates the page and loses its state.

**How to apply:** Keep the real page mounted rather than reconstructing a background from a URL or screenshot. Lock background scrolling while the popup is open and restore focus on in-place cancellation.

## Direct campaign signup URLs

`/portal` opens the existing role chooser over Home. `/signup/talent` opens the existing Talent form over Find Work; `/signup/client` opens the existing Client form over Hire Talent. Refresh and browser history must keep the modal synchronized with the URL. Direct X/Escape cancellation goes to the corresponding landing page; Back to Portal goes to `/portal`. Preserve campaign parameters across role navigation, without forwarding private auth continuation fields to a public cancellation URL.

**Why:** The owner explicitly requested shareable, bookmarkable campaign links for first-time visitors, with real landing pages rather than an empty or gradient-only backdrop. This changes direct-route behavior, not the confirmed in-place browsing experience.

**How to apply:** Reuse the existing forms, logo, overlay and registration APIs. Treat `/portal` as an authentication-flow destination when validating cancellation origins, so it cannot create a return loop. Leave legacy `/signup` and Admin authentication behavior alone unless separately requested.

Successful registration and provider handoff are not cancellation. A popup's programmatic dismissal for either must not also navigate to its cancellation landing page.

**Why:** Competing SPA cancellation and full-page success/provider navigation can overlap and interrupt the existing session handoff, despite a successful registration response.

**How to apply:** Distinguish user dismissal from successful registration or OAuth handoff. Let the existing authentication logic own its successful destination; route-controlled signup should handle only actual cancellation.
