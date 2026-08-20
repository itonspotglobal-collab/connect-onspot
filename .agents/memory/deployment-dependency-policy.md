---
name: Deployment dependency policy
description: How to diagnose blank publish failures caused by package-resolution or runtime-engine incompatibilities.
---

When publishing fails before compiler or application logs appear, run a clean dependency install locally before treating it as an infrastructure failure. Upgrade blocked parent dependencies to policy-accepted releases rather than bypassing the security policy or pinning an unsafe transitive package. Keep the configured Node runtime compatible with dependency engine requirements.

**Why:** The publish service can report only build identifiers when resolution fails early, while the local package firewall provides the actual blocked-package reason.

**How to apply:** For a blank early publish failure, run the deployment build's clean-install equivalent, identify the direct parent of each blocked package, update it through the package manager, regenerate the lockfile, and then verify the exact production build and startup command under the selected Node runtime.