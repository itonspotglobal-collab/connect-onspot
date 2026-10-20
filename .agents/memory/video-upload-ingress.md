---
name: Video upload ingress constraint
description: Published ingress rejects legitimate large multipart video bodies before Express.
---

The published Google Frontend rejected a 63 MiB video multipart request with HTML 413 while the same development request reached Express. Treat successful development multipart uploads as insufficient evidence of published large-body compatibility.

**Why:** This externally imposed production limit prevented Talent video uploads even though the application's configured limit was already 200 MiB.

**How to apply:** Keep large video bytes off the application ingress, preserve private storage and authenticated ownership verification, and verify actual browser-to-storage transfer separately from fixture database tests. Do not increase unrelated global limits or assume development and production share storage/CORS configuration. Do not delete replaced profile media merely as cleanup: submitted job applications may retain those URLs.

Audit application attachments separately from profile uploads; fixing one surface is not proof that the other stopped sending large multipart bodies.

**Why:** The profile file-selection fix left both job application submission and Settings' separate recording-save handler using multipart requests. A browser test also showed that an artificial file-validation delay could submit an older profile video when the user advanced immediately after recording.

**How to apply:** Trace file selection and recording-save callbacks separately on every surface. Scope verified application-upload references to both the authenticated Talent and intended job. Make file selection authoritative before navigation can validate it; do not use elapsed time as evidence that an upload or application persisted. Distinguish normal password login into disposable seeded accounts from mocked authentication and from approved staging/production account UAT.
