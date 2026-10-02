---
name: Signup email ownership policy
description: Email ownership policy, historical continuity, and approved email UAT boundaries.
---

Normal new Client and Talent registrations must not activate usable accounts until the server confirms email ownership. MVP verification uses email, not SMS.

**Why:** The owner explicitly requires new Client and Talent accounts to prove inbox ownership before usable credentials are activated.

**How to apply:** Historical established accounts must not suddenly lose access or acquire a false verified timestamp. Passwordless imported records are not established authenticated accounts merely because a registration flag is set.

Provider email presence alone is not verification. A provider exception requires an explicit verified-email contract that the application validates and consumes. Email ownership must remain separate from the Talent Verified/Vetted classifications.

**Why:** The owner explicitly prohibited assuming provider email verification and required preserving the removal of simulated LinkedIn profile import.

**How to apply:** Audit provider claims and consumption before exempting any new signup from inbox verification. Do not restore profile import or mark a professional classification based on an email code.

The proposed Talent and Client sender identities do not establish Graph authorization. Actual receipt in both real inbox UAT flows is required before runtime PASS.

**Why:** The owner distinguished configuration and mailbox existence from permission and delivery.

**How to apply:** Confirm mailbox authorization separately; never send audit emails or claim successful delivery from configuration, token acquisition, or Graph acceptance alone.

Historical provider identities need trustworthy prior-account evidence. An inherited memory-only user store can make a first-time provider and a historical provider look identical after restart; provider email presence is not a safe substitute.

**Why:** The ownership implementation encountered provider callbacks that used an inherited memory store rather than persistent identity links. Exempting every returned provider profile would defeat the new-account policy.

**How to apply:** Validate historical provider continuity on approved staging data before enabling the rollout. If continuity requires broader persistence changes, report that blocker rather than silently grandfathering new identities or silently forcing old users through a new activation policy.