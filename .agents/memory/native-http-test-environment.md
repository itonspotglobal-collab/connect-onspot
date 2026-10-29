---
name: Native HTTP test harness
description: Distinguish full-Express test-worker IPC failures from application regressions.
---

Full Express integration fixtures can hit Node 22 test-worker serialization failures even after individual assertions pass.

**Why:** A fixture emitted “Unable to deserialize cloned data due to invalid or unsupported version” from the Node runner's IPC decoder, not from an application handler. Direct node:test execution exposed the complete passing suite without removing assertions.

**How to apply:** Inspect the TAP results before a worker-level failure and separate transport/harness errors from failing endpoint assertions. Preserve owned-database isolation and synthetic authentication; do not bypass production auth or weaken expected behavior to accommodate a runner failure.
