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

Browser callbacks serialized by Playwright do not inherit tsx/esbuild's module-scoped function-name helper. Nested named or inferred-name functions in `evaluate` can therefore fail with `__name is not defined`.

**Why:** The host compiler preserves function names, but the browser receives only the callback source, not the compiler runtime.

**How to apply:** When using nested helpers in browser callbacks, supply the minimal function-name shim through a test-only init script, or avoid transformations that require that runtime. Do not modify application code to fix a test serialization failure.

Injected or removed test styles should be followed by a rendering turn before asserting their computed effects.

**Why:** In host Chromium, stylesheet invalidation can briefly expose the previous computed style even after the injection/removal promise resolves; deliberate-drift tests otherwise fail intermittently.

**How to apply:** Wait for animation frames after test-only style mutations rather than weakening layout assertions or adding arbitrary long timeouts.

Register request-event waits before triggering the action that emits the request.

**Why:** A Playwright click can resolve after the request has already been emitted; registering `waitForRequest` afterward then times out even though the application submitted correctly.

**How to apply:** Create the request-wait promise first, trigger the click, and then await that promise. Do not add product delays to compensate for a test listener race.

Isolated Vite servers need separate optimizer caches, not just separate ports.

**Why:** Parallel browser fixtures sharing the running preview's cache produced stale dependency hashes, blank lazy-navigation pages, and `Outdated Optimize Dep` responses even when form checks passed.

**How to apply:** Give each fixture a unique temporary cache directory through its subprocess configuration, then remove only that directory during teardown. Never repair a frontend cache issue by restarting a backend that performs prohibited database work.

Form visibility alone is not proof that a browser fixture successfully hydrated an existing profile.

**Why:** An incorrect response envelope allowed upload tests to pass while the profile silently rendered blank; adding a real edit-and-save assertion exposed the fixture mismatch.

**How to apply:** Assert a known server-provided value before editing or submitting. Match the endpoint's actual resource envelope: HTTP-client transport unwrapping does not necessarily unwrap nested resource data.