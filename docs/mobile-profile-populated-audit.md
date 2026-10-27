# Populated Talent Profile mobile verification

This is an **isolated browser fixture**, not a real authenticated-account UAT.
The actual built application is served by an owned static test server. App API
requests are intercepted with disposable, populated Talent data, including long
text, the setup banner, section tabs and a `contract_signed` application.

## Measured failure before the root-cause fix

| Viewport | document scrollWidth | clientWidth | Result |
|---|---:|---:|---|
| 375×812 | 766 | 375 | Overflow |
| 390×844 | 766 | 390 | Overflow |
| 430×932 | 766 | 430 | Overflow |

The earlier source-mode audit did not reliably render the App due to transitive
CommonJS dependency loading and bundle timeouts. Its apparent zero-overflow
result was not valid. Serving the built App avoided that test-harness issue and
exposed real overflow in populated experience rows.

## Root cause and correction

Long unbroken company/institution text contributed a large intrinsic minimum
width to experience/education/certification flex rows. Those content flex items
now use `min-w-0` and `overflow-wrap:anywhere`. This constrains content to its
actual column and wraps long words. It does not suppress document overflow.
Earlier responsive changes also constrain the profile grid, banner and section
content; rich text can wrap long URLs.

## After correction

| Viewport | document scrollWidth | clientWidth | Result |
|---|---:|---:|---|
| 375×812 | 375 | 375 | No overflow |
| 390×844 | 390 | 390 | No overflow |
| 430×932 | 430 | 430 | No overflow |

The test requires the intended route and populated profile markers, rejects
runtime/error/redirect states as a focused pass, and fails if a rendered page
overflows. Horizontal tab scrolling remains contained within the tab region.
This does not establish that every profile interaction, edit dialog, keyboard
path or other App route has been verified.

## Additional observed overflow fixes

A corrected wide sweep, using a fresh document per route rather than reusing a
failed App error boundary, found seven more overflowing routes:

| Route | Before: document width at failing viewports |
|---|---|
| `/admin/vanessa-responses` | 399px at 375/390px |
| `/admin/vanessa-learning` | 501px at all three widths |
| `/admin/insights` | 382px at 375px |
| `/admin/email-templates/:id/edit` | 468px at all three widths |
| `/admin/interviewers` | 391px at 375/390px |
| `/legal-ops` | viewport + 8px at all three widths |
| `/candidate-profile/:candidateId` | 6768px at all three widths |

Corrections: mobile conversation columns stack and constrain their scroll areas;
shared tabs use contained horizontal scrolling and mobile-sized targets; Admin
headers wrap/stack instead of extending actions offscreen; legacy profile text
can wrap; offstage carousel transforms and decorative bounds stay inside mobile
widths. Desktop breakpoints retain their prior layouts.

A focused rerun of these seven routes **plus Talent Profile** passed **24/24
route/viewport checks**, with intended page markers, no runtime errors and no
document overflow. Screenshots and measurements are in
`generated-artifacts/mobile-route-audit/profile/` and `overflow-fixes-report.md`.
Other protected or populated App states remain a separate coverage requirement.

## Repeat

Build first, then run the browser test with the installed browser executable:

```sh
npm run build
MOBILE_AUDIT_BUILT=1 node --import tsx --test \
  --test-concurrency=1 browser-tests/mobile-route-audit.browser.test.ts
```

Set `PLAYWRIGHT_EXECUTABLE_PATH` to the existing browser when required by the
environment. `MOBILE_AUDIT_ALL=1` selects every App route for the broader sweep,
but missing representative fixtures remain explicitly unaudited states.
