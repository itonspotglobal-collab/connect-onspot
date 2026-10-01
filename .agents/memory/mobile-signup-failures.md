---
name: Mobile signup failure diagnosis
description: Hidden signup errors can resemble navigation loops; validation, retry, and viewport checks must reflect actual browser behavior.
---

Diagnose apparent signup loops using server rejection status and visible form feedback before changing authentication redirects. Keep existing password security requirements consistent between client and server.

**Why:** A reported mobile loop was repeated password-policy rejection followed by rate limiting, while desktop and mobile used the same signup handler. Transient toast feedback was not reliable inside the dialog.

**How to apply:** Require persistent in-form failure messages, preserve editable details, and honor the entire server-provided retry delay. Do not substitute another feature's cooldown: limiter windows are independently configurable.

Check sticky actions and errors against the actual viewport, not just whether a browser locator is visible.

**Why:** Playwright automatically scrolls controls into view, which can hide initial footer clipping. The shared dialog's outer vertical padding also reduces the space available to its inner card.

**How to apply:** Account for container padding in height budgets and verify complete action/error bounding boxes on short mobile and desktop viewports.