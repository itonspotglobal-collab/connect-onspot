---
name: Get Hired data truthfulness
description: Product acceptance rules for document-upload success and assessment claims.
---

Get Hired must never claim that a document upload or assessment succeeded unless the application has real data supporting that claim.

**Why:** The owner explicitly established this acceptance principle after the wizard showed upload success despite persistence failures and a fabricated completed assessment.

**How to apply:** For a profile-linked document, success includes both completed byte upload and a confirmed persisted, privately owned object reference. Failed upload or save must not add a completed document, advance the wizard, or emit success. A generated signed URL is not evidence of uploaded bytes.

Assessment table definitions, UI terminology, or prototype data are not evidence of an implemented assessment service or a Talent result.

**Why:** The old wizard presented a fixed score/date/ranking even though the result/start APIs were not implemented.

**How to apply:** Only show user-specific scores, dates, rankings, certificates, or completion claims from a legitimate authenticated result source. When no functioning source exists, show unavailable/no-result honestly and do not invent a passing-score requirement or mark continuation as assessment completion.