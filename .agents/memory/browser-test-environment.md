---
name: Browser test environment
description: Environment requirements for running repository Playwright regression tests locally.
---

Browser regression tests can run against an isolated Vite frontend with API routes intercepted, but the host still needs a Playwright-compatible browser and its system libraries. The Replit cartographer plugin should be disabled for that isolated server.

**Why:** The repository's cached Playwright binaries may be present while the container lacks libraries such as libglib, and enabling cartographer outside the normal Replit runtime can fail during transforms.

**How to apply:** Keep browser tests independent of live database data by mocking only the relevant API contracts. Set `BROWSER_BASE_URL` when using an already-running app, and provide `PLAYWRIGHT_EXECUTABLE_PATH` only when the host supplies a compatible browser.

When validating a new browser suite, run it by file as well as through the package-wide glob. The suites each manage their own Vite lifecycle, and the aggregate command can expose unrelated teardown/timing failures even when the changed suite is green.

**Why:** The package-wide Node test command loads multiple suites that independently start and stop isolated Vite servers; failures in one suite can mask the result of another.

**How to apply:** Treat the changed suite's direct command and typecheck as the primary signal, then report unrelated aggregate-suite failures separately rather than changing product code to accommodate them.