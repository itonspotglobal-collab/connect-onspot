---
name: Invitation and interview smoke coverage
description: Release-level regression strategy for invitation acceptance and interview timezone propagation.
---

Use synthetic, self-cleaning fixtures against the production route registration for invitation and interview smoke coverage. Assert both participant-facing response shapes and the formatter's timezone label, because the client and talent APIs intentionally use different field naming conventions.

**Why:** The end-to-end path crosses role authorization, job eligibility, candidate filtering, invitation consent, interview ownership, and timestamp normalization. A unit-only test can miss a regression at any one boundary, while a shared or real fixture could alter hiring records.

**How to apply:** Keep the smoke path serial, use an explicit IANA timezone, verify it after invitation creation and after confirmation from both participant views, and use a no-op email transport so route coverage has no external side effects.