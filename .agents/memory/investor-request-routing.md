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

**How to apply:** Keep success copy about the saved request and founder follow-up; distinguish provider acceptance from actual inbox receipt during verification. Never send development test messages to the founders in place of an approved test inbox.

Omit the contact email row from investor notification bodies, while retaining the investor's address in Reply-To and storage. Website confirmations are unchanged by this rule.

**Why:** On 2026-11-03 the owner explicitly chose "Notification email body" when clarifying where the displayed email address should be removed.

**How to apply:** Do not reintroduce an email table row or mailto link into founder notifications. Keep sender/recipient routing and direct-reply behavior intact.
