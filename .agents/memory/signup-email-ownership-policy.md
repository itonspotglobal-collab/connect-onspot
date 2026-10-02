---
name: Signup email ownership policy
description: Approved email-ownership requirement and audit-only implementation boundary.
---

Normal new Client and Talent registrations must not activate usable accounts until the server confirms email ownership. MVP verification uses email, not SMS.

**Why:** The owner explicitly approved this new signup requirement while requesting an audit and implementation plan only, not implementation.

**How to apply:** Treat this as the target product requirement, not evidence that verification has been built. Obtain explicit implementation authorization before changing signup behavior. Historical production accounts must not suddenly lose access because new email-verification fields are absent.

Provider email presence alone is not verification. A provider exception requires an explicit verified-email contract that the application validates and consumes. Email ownership must remain separate from the Talent Verified/Vetted classifications.

**Why:** The owner explicitly prohibited assuming provider email verification and required preserving the removal of simulated LinkedIn profile import.

**How to apply:** Audit provider claims and consumption before exempting any new signup from inbox verification. Do not restore profile import or mark a professional classification based on an email code.

The proposed Talent and Client sender identities do not establish Graph authorization. Actual receipt in both real inbox UAT flows is required before runtime PASS.

**Why:** The owner distinguished configuration and mailbox existence from permission and delivery.

**How to apply:** Confirm mailbox authorization separately; never send audit emails or claim successful delivery from configuration, token acquisition, or Graph acceptance alone.