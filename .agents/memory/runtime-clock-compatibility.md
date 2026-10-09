---
name: Runtime clock compatibility
description: Deployment diagnostic timestamp handling when the durable runtime rejects Date.now.
---

Use the actual runtime's supported clock behavior rather than assuming the generic CodeExecution description applies.

**Why:** During deployment diagnostics, this workspace's durable runtime rejected Date.now with a disabled-in-durableptc error even though the generic tool description advertised it. That prevented a time-filtered log call from running; it was not evidence of unavailable production logs.

**How to apply:** If this error occurs, obtain the current UTC timestamp through the documented impure boundary or a read-only shell clock, then pass the numeric timestamp to the durable callback. Keep deployment-log timestamps in milliseconds as documented. Do not replace official diagnostics with credential inspection or raw infrastructure requests.
