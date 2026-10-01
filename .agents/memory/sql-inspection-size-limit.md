---
name: Read-only SQL inspection size limit
description: Large embedded reference catalogs can exceed the production SQL callback's child-process argument limit.
---

Keep read-only inspection statements small enough for the SQL callback's transport, not merely valid for PostgreSQL.

**Why:** An embedded expected-catalog SELECT worked through a private PostgreSQL client but failed in the production inspection callback with `spawn E2BIG` at roughly 130 KiB. That error occurred before SQL execution; removing incidental whitespace did not reduce it enough.

**How to apply:** Batch by object category while preserving comparison context. Retain the owned-table markers and touched parent columns in each batch, and retain constraint expectations when checking primary/unique backing-index aliases. Filter the final report to the requested category rather than discarding contextual definitions. Never replace the authorized read-only channel with a shell connection or weaken catalog checks to avoid this transport limit.