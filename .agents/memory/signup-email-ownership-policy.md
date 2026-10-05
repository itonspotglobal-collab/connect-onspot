---
name: Signup email ownership policy
description: Email ownership policy, historical continuity, and approved email UAT boundaries.
---

Normal new Client and Talent registrations must not activate usable accounts until the server confirms email ownership. MVP verification uses email, not SMS. The owner has authorized a temporary server-controlled exception for fresh password registrations while verification delivery is repaired; this does not revoke the default ownership policy.

**Why:** The owner explicitly requires new Client and Talent accounts to prove inbox ownership before usable credentials are activated.

**How to apply:** Historical established accounts must not suddenly lose access or acquire a false verified timestamp. Passwordless imported records are not established authenticated accounts merely because a registration flag is set.

The temporary exception must never claim that an email was verified, take over an existing account, or attach an imported profile without ownership proof. Re-enabling verification applies to subsequent registrations; do not silently lock out accounts created during the approved exception.

**Why:** The owner requested a reversible signup-only fallback while explicitly preserving existing login, authentication, and authorization.

**How to apply:** Keep persisted inbox-verification evidence truthful, preserve existing-account claiming protections, and require separate approval for any retrospective verification policy.

Provider email presence alone is not verification. A provider exception requires an explicit verified-email contract that the application validates and consumes. Email ownership must remain separate from the Talent Verified/Vetted classifications.

**Why:** The owner explicitly prohibited assuming provider email verification and required preserving the removal of simulated LinkedIn profile import.

**How to apply:** Audit provider claims and consumption before exempting any new signup from inbox verification. Do not restore profile import or mark a professional classification based on an email code.

The proposed Talent and Client sender identities do not establish Graph authorization. Actual receipt in both real inbox UAT flows is required before runtime PASS.

**Why:** The owner distinguished configuration and mailbox existence from permission and delivery.

**How to apply:** Confirm mailbox authorization separately; never send audit emails or claim successful delivery from configuration, token acquisition, or Graph acceptance alone.

Historical provider continuity requires durable provider-subject evidence. Neither matching email nor the existence of an old memory-only implementation establishes an affected persisted account.

**Why:** An earlier architecture-only assessment raised a continuity blocker without demonstrating persisted affected accounts. The owner requires evidence of actual account impact before migration or recovery work.

**How to apply:** Positively identify the approved database, then inspect actual provider-subject fields, identity links, and serialized authenticated sessions using counts only. Memory-only records disappear on normal restarts; absent durable identity evidence, do not invent a historical migration requirement. Never reconstruct provider subjects from email, name, role, or profile information.