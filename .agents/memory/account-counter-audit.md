---
name: Account-count audit cautions
description: Registration flags are not reliable evidence of an authenticated account.
---

A candidate's `account_created` flag can be true without an associated auth user or portal login credentials. Do not assume that this flag alone proves a completed registration.

**Why:** A production audit found pre-provisioned candidate profiles with that flag set but neither a matching user nor portal credentials. Counting those profiles as registrations would inflate a public account counter.

**How to apply:** Establish an owner-approved account definition, verify actual account/sign-in evidence without exposing credential values, and deduplicate candidate and user representations of the same identity. Keep account registrations distinct from profile completion, hiring activity, and paying customers.