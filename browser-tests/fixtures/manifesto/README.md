# Approved Manifesto regression guard

Run `npm run test:manifesto` (also included in `npm run test:browser`).
Install a Playwright Chromium browser beforehand, or set
`PLAYWRIGHT_EXECUTABLE_PATH` to the host's compatible Chromium binary.
On Replit: `PLAYWRIGHT_EXECUTABLE_PATH=/repl/tools/bin/chromium npm run test:manifesto`.

The suite starts **Vite only**, intercepts all API requests, blocks external
services/scripts, and serves fonts from local fixtures. It never starts the
backend, runs SQL/migrations, publishes, or accesses production.
`BROWSER_BASE_URL` is optional but must point to a loopback frontend;
`BROWSER_TEST_PORT` selects the isolated Vite port (default 5173).

The unmodified approved HTML is read from
`attached_assets/manifesto_final_mockup_1790834956585.html`. Its SHA-256 and the
product's pinned 600-weight Inter font are checked so neither baseline can
silently change. Desktop renders at 1280 and 1440 use the same browser/fonts as
the app, with only the approved 8x2 gold divider accent applied to the reference.
No screenshot regions are ignored. A maximum channel difference of 16 and
0.005% changed pixels allows small antialias noise; element geometry is also
checked to 0.1px, alongside exact typography, spacing, text, and colors.
Failed comparisons save reference, actual, and diff PNGs in
`browser-tests/results/manifesto` (gitignored). Do not loosen tolerances or
regenerate baselines to accept a design change without explicit approval.

Mobile checks at 320, 375, 390, and 600px intentionally do not compare to the
desktop-only reference's overflowing closing panel. They assert the approved
stacked closing layout, dark backgrounds, headline overlap, two script lines,
no global navigation/footer/chat controls, and no horizontal overflow.
Both About links are clicked through the actual App router.

Font fixtures are test-only copies downloaded from Google Fonts:
- Inter 400/500: `fonts.gstatic.com/s/inter/v20/` (SIL OFL license in
  `client/public/fonts/inter-OFL.txt`).
- Caveat 600: `fonts.gstatic.com/s/caveat/v23/` (SIL OFL in `caveat-OFL.txt`).
- Inter 600 is served from the existing product file, not duplicated here.

Third-party embeds are blocked, not executed. These checks guard the app's own
overlay routing; they do not validate an external vendor's widget behavior.