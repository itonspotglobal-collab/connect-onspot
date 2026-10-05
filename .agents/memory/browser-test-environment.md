---
name: Browser test environment
description: Environment requirements for running repository Playwright regression tests locally.
---

Browser regression tests can run against an isolated Vite frontend with API routes intercepted, but the host still needs a Playwright-compatible browser and its system libraries. The Replit cartographer plugin should be disabled for that isolated server.

**Why:** The repository's cached Playwright binaries may be present while the container lacks libraries such as libglib, and enabling cartographer outside the normal Replit runtime can fail during transforms.

**How to apply:** Keep browser tests independent of live database data by mocking only the relevant API contracts. Only set `BROWSER_BASE_URL` to a dedicated fixture target, never a customer-facing deployment. Provide `PLAYWRIGHT_EXECUTABLE_PATH` only when the host supplies a compatible browser.

Credential-scrubbed child environments still need browser-specific runtime configuration.

**Why:** Removing inherited configuration made an installed browser appear missing; selecting its cache explicitly then exposed missing native-library search paths. These were test-environment failures, not application regressions.

**How to apply:** Configure a compatible host-wrapped browser or its cache/native-library requirements separately from application credentials. Do not restore production secrets merely to make fixture tests launch. Record failed setup attempts separately from substantive browser assertions.

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

Vite library-mode browser fixtures must explicitly replace Node environment references.

**Why:** A production-mode library build can still retain `process.env.NODE_ENV` in React dependencies; a normal browser has no Node `process` global, so the fixture fails before exercising the application.

**How to apply:** Pin `process.env.NODE_ENV` to production in the fixture build's `define` configuration. Do not add a Node shim to application code or weaken authentication assertions to accommodate the fixture.

Form visibility alone is not proof that a browser fixture successfully hydrated an existing profile.

**Why:** An incorrect response envelope allowed upload tests to pass while the profile silently rendered blank; adding a real edit-and-save assertion exposed the fixture mismatch.

**How to apply:** Assert a known server-provided value before editing or submitting. Match the endpoint's actual resource envelope: HTTP-client transport unwrapping does not necessarily unwrap nested resource data.

Do not fulfill unexpected fixture API requests with a successful empty array.

**Why:** An empty array is truthy and can be mistaken for an event-claim object, opening a fabricated modal. That modal makes an otherwise-rendered card unavailable to accessibility selectors. Object endpoints can also crash when a list-shaped fallback omits required nested fields.

**How to apply:** Explicitly model each endpoint's response, including its actual no-event value, and fail unexpected requests. Inspect modal and accessibility state before changing a missing-card selector. Keep diagnostic response overrides temporary until a test correction is authorized.

With a frozen Playwright clock, changing device metrics can leave viewport-unit computed styles from the prior desktop render, even when `innerWidth` and media queries have changed.

**Why:** The browser retained desktop viewport-based padding during a mobile resize; advancing the fake clock did not correct it, but a fresh navigation did. This produced a false mobile-overflow failure.

**How to apply:** Use a fresh navigation or separate page for each device-size layout check under a frozen clock. Preserve strict overflow assertions; do not change product CSS to accommodate stale test-browser styles.