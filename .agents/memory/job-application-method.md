---
name: Job application method
description: Durable rules for deciding whether a job uses OnSpot's form or an external application URL.
---

Treat `applicationMethod` as the sole application-flow selector. Job creator, client ownership, submission source, and approval path must never imply an external application. Missing legacy values default to the built-in form.

An explicit external method requires a valid HTTP(S) URL. If that configuration is malformed, show an unavailable state rather than silently falling back to the built-in form or opening an unsafe/broken URL.

**Why:** Client-created jobs previously inherited an external database default even though the Client form had no external-link control, sending Talent to a dead-end screen after approval.

**How to apply:** Keep creation defaults, database defaults, public CTA behavior, direct apply-page guards, and submission APIs aligned whenever application fields or job-creation paths change.