# Investors production rendering verification

## Scope and result

The approved Investors visual composition has been restored without changing
its statistics queries/refresh logic, routes or document-request behavior.
The requested H1 separator is now an em dash; its words and all other existing
page copy are unchanged. Other pages received only the explicitly approved
packaging/optimization of their existing public image dependencies.

No production data writes, production migrations or publication were performed.
Republication requires the user's Publish action; post-publication live
screenshots remain pending that action.

## Reproduction before edits

Captured `https://onspotglobal.com/investors` and the development preview at
1440px and 390px before editing the component or stylesheet.

- The sampled live and development typography, hero/phone geometry and
  backgrounds matched. No production-only cascade failure was established.
- Both lacked the reference's hero photo/decorations, two-photo traction
  collage, letter photos, actual Mark portrait and CTA photography.
- The live statistics and goals requests returned **200**.
- No image/CSS/font HTTP 404 was observed. A below-fold lazy image that had
  not yet loaded was not treated as a confirmed asset failure.
- The browser reported an existing, unrelated Lindy embed authorization
  configuration error. That widget was not changed.

An original production bundle was built before source edits. Its actual
`npm run start` server reproduced the same missing composition against a
disposable local database. It did not establish a minification-only failure.

### Differences from the supplied reference

| Section | Before | Restoration |
|---|---|---|
| Hero | Plain gradient, padded PNG, missing orbit/badges | Local photo, gradient/grid, CSS device, 600px ring, 540px glow, orbit and four hidden decorative badges |
| Trust strip | Existing facts/labels | Kept white strip, tiles, yellow accents and all current facts |
| Traction | Single network illustration | Two real decorative photos, yellow circle and dots; current total-account card and all query states retained |
| Letter | Gradient-only media/inset | Real main/inset photos, sticky panel, dots and white title note |
| Vision | Two portraits plus initials | Exactly three founder images with alt text; real Mark PNG |
| Invest | Gradient-only panel | Local photo under navy treatment/ring; featured yellow card and existing actions retained |
| Footer | Existing wordmark/disclaimer | Kept navy layout, official wordmark and current disclaimer |

The supplied reference has static figures and somewhat different narrative.
Those were not copied over the application's current data or wording.

## Assets and CSS

- Eight optimized WebPs now live in `client/src/assets/investors/`, all below
  300 KB, with clean filenames and tracked imports.
- `public/mark-apostol.png` is **30,228 bytes**, below the requested 100 KB.
- Existing Nur and shared wordmark files are also below 300 KB.
- The obsolete padded phone PNG is no longer a build dependency; the supplied
  CSS-built phone uses exactly one hero image for its screen wordmark.
- Following explicit approval, **35** public image dependencies imported by
  other pages were packaged. Their combined size fell from **40,921,036** to
  **6,365,489 bytes**; each is below 300 KB. Their import paths and all consuming
  page components/styles/copy/behavior are unchanged.
- Page rules are scoped to `.onspot-investors-page`. Dialog content and its
  existing portaled overlay/viewport use their dedicated `investor-request-*`
  roots: those wrappers are outside the dialog content in the shared primitive,
  so their existing DOM behavior was preserved.
- No generic `.hero`, `.card`, `.dots`, `.phone`, `.quote`, `.vision` or
  `.collage` classes were introduced for Investors.
- Explicit reference spacing/typography no longer depends on global section
  defaults or Tailwind preflight order. The bundled CSS contains the restored
  hero, ring, glow, badge, collage, letter and CTA selectors.
- No new `!important`; the existing reduced-motion block retains it.
- `main.tsx`, global CSS, routing and `InvestorDocumentDialog.tsx` were not edited.

## Actual verification

| Check | Result |
|---|---|
| `browser-tests/investor-documents.browser.test.ts` | **27/27 passed** |
| TypeScript | Passed |
| Production build | Passed |
| Real `npm run start` with built bundle | Passed against owned disposable PostgreSQL |
| Local production widths | 320 / 390 / 768 / 1024 / 1440 |
| Local production horizontal overflow | None |
| Hero semantics | One H1 and one hero image |
| Founder portraits | Three actual images with alt text |
| Local public statistics/goals requests | 200; real disposable-database responses |
| Local production image decoding | No broken images |
| Fresh Git checkout build | Passed from committed source |

The fresh checkout reused the existing installed dependency tree via a
`node_modules` symlink. No ignored application assets were copied into it.
This proves tracked-source/image completeness, not a new cold `npm ci`.

Browser form/clock scenarios use the existing isolated browser mocks.
The live site was inspected read-only; no real investor lead was submitted.

The production visual harness runs:

```
node scripts/test-hiring-payments-isolated.mjs --investors-production
```

It owns a temporary TLS-enabled PostgreSQL server and a final-schema fixture.
The ordinary `npm run start` command executes its migration-ledger check and
starts the real compiled application. A test-only native PostgreSQL transport
adapter and isolated service configuration prevent access to live databases,
KV, email or AI credentials. This verifies the built public page, not real
account authentication or forward production migrations.

## Screenshots

`generated-artifacts/investors/` contains:

- `before-live-{1440,390}.jpg` and `before-dev-{1440,390}.jpg`
- `before-production-{1440,390}.jpg`
- `after-mock-{1440,390}.jpg`
- `after-dev-{1440,390}.jpg`
- `after-production-{1440,390}.jpg`
- `comparison-{1440,390}.jpg` — labelled side-by-side reference/dev/production
- corresponding hero crops, computed-style/network metrics and local server logs

These generated outputs are ignored by Git and deployment. The comparison
images are supplied separately for download. Live-data numbers and timestamps
can legitimately differ between environments.

## Republish checklist

- [x] Component, CSS, image files and verification helpers committed.
- [x] Browser suite, typecheck and production-bundle checks pass.
- [x] No other page code/styles/copy changed.
- [x] Complete final fresh-checkout build check.
- [ ] User republishes through Publish.
- [ ] Verify the new live asset fingerprint on `onspotglobal.com`.
- [ ] Capture post-publication live screenshots at 1440px and 390px and confirm
      statistics, image loading, responsive layout and console/network results.
