# Mobile route audit baseline

The initial wide route sweep was not valid evidence of zero overflow: generic empty API fixtures and blank/redirected pages produced viewport-width documents without representative application content. Those routes are not counted as passing.

Before mobile changes, the 14 declared priority routes were not rendered with usable content under the original fixtures: `/talent-profile/:id` lacked the required setup/tabs markers; `/get-hired`, `/my-applications`, `/client-profile`, `/client/interviews`, `/client/billing`, `/client/payments/:category/:id`, `/messages`, `/hire-talent`, `/jobs/:jobId/apply`, `/admin/job-applications`, `/admin/interviews`, `/admin/ledger`, and `/signup` had no representative page content. `/sign-in` is not an App.tsx route.

The source-mode TalentProfile harness was blocked by lodash subpath interop and then bundle-loading timeouts. A subsequent built-App fixture successfully rendered the populated profile and found real 766px document overflow at all three widths. After correcting long-text flex-item minimum widths, the populated profile measured 375/375, 390/390 and 430/430 with no overflow. See `docs/mobile-profile-populated-audit.md` for that valid targeted result.

A first built-App wide sweep still reused failed App/error-boundary state between SPA navigations and was not usable broad evidence. The corrected sweep starts a fresh document for each route. It visited 139 routes / 417 viewports: 138 rendered, 267 had fixture/runtime errors and 12 redirected. It identified 17 overflowing rendered states across seven routes. Those defects were reported before fixing and are detailed in `docs/mobile-profile-populated-audit.md`; all seven routes plus the populated Talent Profile subsequently passed a 24-state focused rerun. This is **not an all-routes mobile sign-off**: missing representative data and fixture/runtime errors remain blockers. The ongoing full-sweep test rejects incomplete coverage rather than treating collection as a passing check.

No live credentials, backend, database or mail were used by these browser fixtures. Development workflow restart/schema verification happened separately and is documented in `docs/deposit-activation-release.md`. Detailed wide report and artifacts: [`generated-artifacts/mobile-route-audit/report.md`](../generated-artifacts/mobile-route-audit/report.md).

Final post-fix repeat: 139 routes / 417 measurements, with 138 rendered checks
and no observed overflow. The remaining 279 were unverified: 262 fixture/runtime
errors, 15 redirects and 2 missing-content states. The full-sweep test therefore
failed its coverage gate as intended. It is not a release sign-off.
