---
name: Disposable fixture schema generation
description: Drizzle temporary-output snapshot lookup limitation observed in native hiring fixture checks.
---

Generate the temporary native fixture schema once into a fresh temporary directory. Do not reuse an absolute output directory for incremental generation.

**Why:** Drizzle's snapshot lookup prepends a relative prefix to an absolute snapshot path during a second generation, producing ENOENT even though the snapshot exists. Fresh temporary generation avoids this tooling quirk.

**How to apply:** Regenerate from the current shared schema into a new temporary directory, then initialize only the explicitly disposable local fixture database. Never reset the application or production database to work around fixture tooling.
