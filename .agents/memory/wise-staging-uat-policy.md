---
name: Wise staging UAT policy
description: Authorized synthetic QR/settlement testing and the required stop boundary.
---

Clearly labeled non-payable TEST-ONLY QR configurations and simulated settlement evidence are permitted for a dedicated isolated staging ledger. They must never be described as genuine Wise destinations or independently verified real settlement.

**Why:** The owner explicitly authorized no-money synthetic testing to remove the previous requirement for genuine receiving details during staging UAT.

**How to apply:** Preserve supported signup/login and audited role assignment, separate database/private storage, safe notification capture and normal Super Admin authorization. A simulation harness must be absent from production artifacts and protected by target/fixture identity and infrastructure isolation, not just a configuration flag. Stop and document the exact blocker if authenticated staging sessions cannot be established. Do not request personal passwords or production credentials.
