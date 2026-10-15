---
name: Deployment dependency policy
description: How to diagnose blank publish failures caused by package-resolution or runtime-engine incompatibilities.
---

When publishing fails before compiler or application logs appear, run a clean dependency install locally before treating it as an infrastructure failure. Upgrade blocked parent dependencies to policy-accepted releases rather than bypassing the security policy or pinning an unsafe transitive package. Keep the configured Node runtime compatible with dependency engine requirements.

**Why:** The publish service can report only build identifiers when resolution fails early, while the local package firewall provides the actual blocked-package reason.

**How to apply:** For a blank early publish failure, run the deployment build's clean-install equivalent, identify the direct parent of each blocked package, update it through the package manager, regenerate the lockfile, and then verify the exact production build and startup command under the selected Node runtime.

A compatible parent update can leave an existing vulnerable transitive version locked even when a patched release satisfies its range. Check the resolved tree after updating. If the latest compatible parent still retains it, constrain the supported patched transitive release and regenerate the lockfile; do not bypass the package firewall or introduce an unrelated major-framework migration.

**Why:** Warm workspace builds can pass while fresh package downloads are rejected, and a successful parent install does not prove that the blocked transitive package changed.

**How to apply:** Test locked dependency installation and compilation in a temporary copy without disturbing the running app. State when lifecycle scripts were disabled, and distinguish a reproduced install blocker from an old remote failure whose logs contain no fatal cause.

Treat an abruptly ending compiler log as an unresolved build interruption, not proof of a compiler bug or memory exhaustion.

**Why:** A recorded remote failure ended after ordinary Browserslist, PostCSS and dependency warnings, while the same production build completed locally. Suppressing warnings or increasing heap limits would not establish or correct the cause.

**How to apply:** Preserve build semantics and add stage, exit-code, signal and progress diagnostics when fatal output is missing. A killed process alone does not establish OOM; container memory counters are scoped to the worker and may be cumulative. Do not execute application startup or migrations just to diagnose compilation.