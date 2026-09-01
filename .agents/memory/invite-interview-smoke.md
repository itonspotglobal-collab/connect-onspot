---
name: Invitation and interview smoke coverage
description: Release-level regression strategy for invitation acceptance and interview timezone propagation.
---

Use synthetic, self-cleaning fixtures against the production route registration for invitation and interview smoke coverage. Assert both participant-facing response shapes and the formatter's timezone label, because the client and talent APIs intentionally use different field naming conventions.

**Why:** The end-to-end path crosses role authorization, job eligibility, candidate filtering, invitation consent, interview ownership, and timestamp normalization. A unit-only test can miss a regression at any one boundary, while a shared or real fixture could alter hiring records.

**How to apply:** Keep the smoke path serial, use an explicit IANA timezone, verify it after invitation creation and after confirmation from both participant views, and use a no-op email transport so route coverage has no external side effects.

For client-entered `datetime-local` values, interpret the wall-clock fields in the timezone the client explicitly selected, then send the resulting UTC instant together with that IANA timezone. Never let the browser timezone reinterpret a manually selected zone.

**Why:** `datetime-local` has no timezone. Calling `new Date(value).toISOString()` uses the browser timezone and silently changes the intended instant whenever the selected interview timezone differs.

**How to apply:** Test the same wall-clock value in at least two IANA zones, including a cross-browser-zone scenario, and assert that invitation emails format the UTC instant back in the stored selected timezone with the timezone label visible.