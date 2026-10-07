---
name: Email destination verification
description: Canonical URL authority and the distinction between rendering tests and real email navigation UAT.
---

Transactional email delivery was confirmed working during real manual UAT; the failure was the destination domain and navigation, including from a mobile email client. Do not redesign branding or replace the delivery provider to fix navigation.

**Why:** A delivered email with a valid-looking CTA still led to the public homepage rather than the intended authenticated offer/contract.

**How to apply:** Obtain the current primary application URL from publishing metadata and inspect production configuration separately. Never infer the application origin from the sender mailbox, a legacy Talent hostname, request headers, or a workspace development domain.

Do not call email navigation fully verified based only on rendered hrefs or signed-out screenshots.

**Why:** Deployment snapshots, role selection, login return paths, historical interview rounds and resource ownership can fail after an otherwise correct URL is generated.

**How to apply:** Report rendering/unit tests separately from actual newly generated external-email-client → login → owned-resource UAT. Historical inbox hrefs do not change; an alias redirect must preserve the resource path/query and cannot invent a missing record ID.
