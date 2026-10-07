---
name: Contracts navigation policy
description: User-required boundaries for Contracts Back navigation across role-specific entry points.
---

Contracts Back navigation must remain inside OnSpot. Use a genuine preceding app history entry when proven; otherwise return to the appropriate role's existing landing page. Direct links and refreshed entries must not trust arbitrary browser history.

**Why:** The owner accesses Contracts through different Talent, Client and Admin workflows and explicitly prohibited navigating outside the application.

**How to apply:** Preserve native browser Back/Forward and existing route context. Never use history length alone as proof of an internal predecessor; replacing an entry must not manufacture one. Keep this navigation work separate from contract, signature and authorization rules.
