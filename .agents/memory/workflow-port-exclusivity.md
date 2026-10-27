---
name: Workflow port exclusivity
description: Why a healthy preview can still have duplicate application processes after a managed restart.
---

The development web server should own its preview port exclusively. A second process must fail to bind rather than silently share traffic.

**Why:** A managed restart left two separate application process groups listening on the same port when port reuse was enabled. Both answered requests and ran scheduled work. The workflow showed as running, and a homepage request succeeded, masking the duplicate. Stopping the managed workflow removed only one group; the other required separate, targeted cleanup.

**How to apply:** If a preview behaves inconsistently after a restart, check the actual listening processes, not just the workflow state or an HTTP 200. Stop the workflow, identify and remove only confirmed orphaned app processes, then start it once and verify exactly one listener remains. Do not add a port-sharing option to mask an address-in-use error.
