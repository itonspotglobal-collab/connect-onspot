---
name: Job posting drafts
description: Durable rules for saving, resuming, listing, and submitting unfinished Admin and Client job postings.
---

Unfinished job postings reuse the normal jobs record with `status = "draft"` and saved form-step metadata. A draft must update in place; final submission changes that same row into the normal pending-approval workflow.

**Why:** A separate draft store or creating a second row on submission would split ownership/history and can produce duplicate postings. Draft rows also contain incomplete information, so they must never reach talent-facing discovery, matching, recommendations, invitation readiness, SEO counts, or public details.

**How to apply:** Keep Client ownership derived from authentication, reject empty new drafts, allow partial draft fields through draft-specific normalization without weakening final form validation, exclude drafts explicitly from public/internal discovery queries, and hide approval/open/refresh actions until submission. On Client Save Draft & Exit, await persistence and refetch the authenticated Client jobs query before navigating; use actual form contents as a fallback to dirty-state tracking.