---
name: Pilot/client config pattern
description: How OnSpot models pilot clients (e.g. Saddleman) so new clients can be added by config without touching UI/DB code.
---

Pilot clients (Saddleman first) are modeled as entries in a `PILOTS` registry keyed by id (`client/src/lib/pilotConfig.ts`), not hardcoded per-page. Each entry carries id/name/status/brandPromise/clientMessage/talentMessage. Onboarding a new pilot should only require adding a new registry entry.

**Why:** the business wants to run multiple pilot clients over time (Saddleman is the first), and UI copy/CTAs/dashboards must not need rewriting per client.

**How to apply:** when adding client-specific UI, read from `getPilot(id)` / `PILOTS` rather than inlining a client's name or copy. Activity tracking (`trackPilotActivity`/`getPilotActivity`) is namespaced per pilot id in localStorage so multiple pilots don't share counters.

The `jobs`/`candidates` DB tables have no real `pilotId`/`clientId`-to-pilot column yet (`jobs.clientId` is the posting user's id, not a pilot key). `client/src/lib/pilotFiltering.ts` provides placeholder resolution (`getJobPilotId`, company-name heuristic) so pilot-aware filtering/badging works today and can swap to a real column later without call-site changes.
