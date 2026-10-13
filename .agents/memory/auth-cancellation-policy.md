---
name: Authentication cancellation navigation
description: Client/Talent auth cancellation must return to the originating page without changing successful-auth redirects.
---

Client/Talent authentication has two distinct exit actions: forms return to their portal chooser, and choosers return to the original public page. Preserve that origin through portal changes, Login/Sign Up switches, and refreshes. Direct visits without a valid origin fall back to Home.

**Why:** The owner reported that users browsing Find Work were sent to Home when cancelling authentication, losing the context they intended to return to.

**How to apply:** Keep cancellation destinations separate from successful-login and application-continuation destinations. Never replace the original origin with an intermediate authentication page. Validate internal destinations, reject external and authentication-loop targets, and avoid stale origins from earlier flows. Apply Client/Talent changes without changing Admin authentication.
