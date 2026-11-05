---
name: Investor resource requests
description: Document lead capture, direct Wefunder navigation and honest delivery states.
---

The owner’s investor-resource requirements supersede the earlier rule that all three actions use the same inquiry gate: Pitch Deck and Valuation Summary collect private founder-follow-up requests; Wefunder goes directly to its external opportunity profile in a secure new tab.

**Why:** The owner explicitly supplied distinct behaviors in the approved CEO-letter page.

**How to apply:** Reuse private persisted investor intake and founder notification infrastructure for document requests, while keeping existing firm-required inquiries valid. Record document choice, source and server submission time. Never expose contact information in public responses.

Saving a request, notifying the founder, delivering a document to the visitor, and authorizing a download are separate outcomes.

**Why:** Neither investment document was supplied with the approved page. Placeholder HTML declared a download ready without a real backend.

**How to apply:** Confirm persistence before showing a saved state. If founder notification fails, report saved-but-not-notified without encouraging duplicate submissions. Until real files and controlled access are available, do not claim downloads are ready, link nonexistent files, publish unrestricted asset links, or imply email delivery to the visitor.

Document intake is a request for personal founder follow-up, not automatic document fulfillment.

**Why:** On 2026-11-03 the owner explicitly requested confirmations describing founders reviewing the request and responding personally, while preserving honest notification-failure states.

**How to apply:** Keep success copy about the saved request and founder follow-up; distinguish provider acceptance from actual inbox receipt during verification. Use an approved test inbox by default; notify the normal founders in a development test only when the owner explicitly requests normal-recipient delivery.

Founder notification bodies include the submitter's trimmed email as an HTML-escaped mailto link directly below Name. The message ends after the table, without reply instructions. Website confirmations follow their own separate copy policy below.

**Why:** On 2026-11-05 the owner explicitly superseded the earlier notification-body omission. The no-email rule applies to website confirmations, not private founder notifications.

**How to apply:** Keep the notification row order Request, Name, Email, Contact number, Inquiry, Submitted, Reference. Preserve sender/recipient routing, subject, intro and investor Reply-To. Escape both the mailto attribute and link text; do not echo the address into successful website confirmations.

Do not display any email address in document-request confirmations, except the shared investor contact mailbox in the saved-notification-failed state.

**Why:** On 2026-11-03 the owner explicitly superseded the earlier success copy that echoed the visitor's email. Confirmations should describe personal founder follow-up without displaying contact addresses.

**How to apply:** Keep the visitor email for intake and Reply-To, not confirmation interpolation. Preserve the thank-you heading, Request submitted title, Done action and other result states.
