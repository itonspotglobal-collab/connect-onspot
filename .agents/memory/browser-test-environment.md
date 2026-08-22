---
name: Browser test environment
description: Environment requirements for running repository Playwright regression tests locally.
---

Browser regression tests can run against an isolated Vite frontend with API routes intercepted, but the host still needs a Playwright-compatible browser and its system libraries. The Replit cartographer plugin should be disabled for that isolated server.

**Why:** The repository's cached Playwright binaries may be present while the container lacks libraries such as libglib, and enabling cartographer outside the normal Replit runtime can fail during transforms.

**How to apply:** Keep browser tests independent of live database data by mocking only the relevant API contracts. Set `BROWSER_BASE_URL` when using an already-running app, and provide `PLAYWRIGHT_EXECUTABLE_PATH` only when the host supplies a compatible browser.