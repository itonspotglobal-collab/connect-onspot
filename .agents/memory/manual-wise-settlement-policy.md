---
name: Manual Wise settlement policy
description: Incoming receipt evidence versus settlement, outgoing separation and deposit operating authorization.
---

Manual Wise is an explicitly requested operating workflow, not a provider API integration. OnSpot must never mark an obligation paid or a payout disbursed solely because a receipt or reference was submitted. Independent Super Admin settlement confirmation is mandatory; receipts remain auditable evidence.

**Why:** The product owner requested one manual collection/verification system across existing financial obligations without redesigning billing, inventing banking details or implementing a payment provider.

**How to apply:** Keep existing financial rows as balance authorities. Do not create parallel invoices, a second wallet or invented transfer records. Incoming collection instructions and outgoing Talent payout destinations are different authorities; never show the incoming QR for a payout.

Deposit funding additionally requires an explicit business-approved manual funding/custody operating policy. Do not interpret implementing receipt verification as regulatory approval or assume funds are held before independent settlement verification.

**Why:** The earlier billing plan assumed provider-managed custody. The manual request authorizes a software workflow, not an automatic change to legal/operational fund-handling assumptions.

**How to apply:** Keep deposits/top-ups disabled until the business explicitly confirms the operating policy. Pending top-ups provide no coverage. Preserve historical funds, existing principal formulas and lifecycle/termination rules.
