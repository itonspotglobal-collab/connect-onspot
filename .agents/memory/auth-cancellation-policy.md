---
name: Authentication cancellation navigation
description: Client/Talent cancellation and real-page signup overlays, independent of successful-auth redirects.
---

Client/Talent authentication has two distinct exit actions: forms return to their portal chooser, and choosers return to the original public page. Preserve that origin through portal changes, Login/Sign Up switches, and refreshes. Direct visits without a valid origin fall back to Home.

**Why:** The owner reported that users browsing Find Work were sent to Home when cancelling authentication, losing the context they intended to return to.

**How to apply:** Keep cancellation destinations separate from successful-login and application-continuation destinations. Never replace the original origin with an intermediate authentication page. Validate internal destinations, reject external and authentication-loop targets, and avoid stale origins from earlier flows. Apply Client/Talent changes without changing Admin authentication.

## Signup initiated on public pages

Open signup over the actual still-mounted public page, with a slightly darkened, subtly blurred backdrop. Find Work opens Talent signup; Hire Talent opens Client signup. Preserve the polished form design and authentication behavior. X/Escape close the popup without navigation, reload, or lost scroll/page state. Back to Portal changes only the selection inside the popup. Direct signup URLs retain their standalone fallback.

**Why:** The owner explicitly rejected replacing the browsing page with the light signup background. Returning to the same URL afterward is insufficient if it recreates the page and loses its state.

**How to apply:** Keep the real page mounted rather than reconstructing a background from a URL or screenshot. Lock background scrolling while the popup is open, restore focus on close, and keep standalone auth-navigation rules for direct URLs and Login/Sign Up switches.
