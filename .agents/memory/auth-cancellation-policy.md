---
name: Authentication cancellation navigation
description: Client/Talent auth cancellation must return to the originating page without changing successful-auth redirects.
---

Standalone Client/Talent authentication has two distinct exit actions: forms return to their portal chooser, and choosers return to the original public page. Preserve that origin through portal changes, Login/Sign Up switches, and refreshes. Direct visits without a valid origin fall back to Home.

**Why:** The owner reported that users browsing Find Work were sent to Home when cancelling authentication, losing the context they intended to return to.

**How to apply:** Keep cancellation destinations separate from successful-login and application-continuation destinations. Never replace the original origin with an intermediate authentication page. Validate internal destinations, reject external and authentication-loop targets, and avoid stale origins from earlier flows. Apply Client/Talent changes without changing Admin authentication.

Public-page signup buttons and inquiry/signup CTAs use an in-page modal: portal selection stays inside it, Back to Portal changes its internal step, and dismissal restores the original page position and visible opener. Direct signup URLs retain a standalone fallback.

**Why:** The owner clarified that this applies to all public browsing pages, not just Find Work: the actual homepage, opportunity list, or other originating page must stay mounted behind signup.

**How to apply:** Use the shared modal for public navigation and signup CTAs without navigating or recreating the background page. Preserve direct auth routes, successful-registration destinations, and auth-to-auth continuation parameters. On mobile, restore focus to the visible menu toggle rather than its now-collapsed Sign Up item.
