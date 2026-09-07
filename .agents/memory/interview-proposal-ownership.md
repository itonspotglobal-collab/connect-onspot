---
name: Interview proposal ownership
description: The established meaning of current_proposal_owner in interview negotiation.
---

`current_proposal_owner` identifies the party whose response is currently required, not the party that authored the latest proposal. A Client proposal sets it to `talent`; a Talent proposal sets it to `client`; confirmation or cancellation clears it.

**Why:** The field name is misleading, but the existing writers, response guards, backfill, Talent UI, and concurrency locks consistently use pending-responder semantics. Inverting it would corrupt existing negotiation turns.

**How to apply:** Derive action availability and awaiting labels from pending-responder semantics. Preserve row locking, current-slot validation, and immutable proposal history when adding interview actions.