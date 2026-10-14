---
name: Investors visual scope
description: Owner-requested design boundaries for the Investors page.
---

The desktop Investors layout uses two columns: headline and gauges on the left, the supplied tilted phone image on the right. The owner's subsequent mobile refinement explicitly requires a centered headline below 768px, followed by gauges, tagline, seed-round pill, stacked inquiry buttons, then phone. Preserve the desktop headline alignment and presentation. Remove the old eyebrow and earnings subhead. Do not modify Home.

Smartphone sizing refinements are limited to widths below 768px; tablet and desktop remain unchanged. Allow natural vertical scrolling rather than compressing the whole presentation into one screen.

**Why:** The owner explicitly scoped the compact-sizing request as a refinement, not a redesign, and prioritized readable proportions over fitting everything above the fold.

**How to apply:** Keep future compact-spacing adjustments inside the smartphone breakpoint unless separately authorized; preserve the artwork, content order, dynamic statistics, and inquiry behavior.

**Why:** The owner explicitly replaced the earlier instructions to match the investor pitch-deck presentation.

**How to apply:** Keep desktop and mobile alignment rules distinct; the mobile centering request is not permission to center the desktop headline. Use Inter throughout except the tagline word “Without.” The owner subsequently authorized the closest verified Google Fonts brush/marker candidate provisionally, with a single accent-font token; swap to Hyperwave One when a licensed web-font file is supplied.

The owner explicitly approved stopping to report the unavailable Hyperwave One font rather than silently substituting, then resolved the stop through an addendum authorizing a provisional Google Fonts match without waiting for a selection.

**Why:** Font substitutions require an explicit scope decision; approval of this exception is not a general permission to ignore future exact-font requirements.

**How to apply:** Compare two or three catalog-verified candidates in the actual tagline against the pitch slide, including uppercase versus mixed case. Use the best candidate now, retain `font-display: swap` and a safe fallback, and document that exact Hyperwave One self-hosting needs a web-licensed WOFF2 file.

Use the owner-supplied phone artwork as-is, preserving its baked tilt and shadow; do not rebuild the device or replace its screen with a fresh capture.

**Why:** The owner requires continuity with the pitch-deck asset and explicitly prohibited recreating it.

**How to apply:** Verify actual alpha transparency and inspect edges before shipping; neither a “transparent” filename nor an RGBA header proves transparency. Report any background fringes rather than silently changing the artwork.

The Investors page should feel like the existing home hero continued, using its actual shared background, header treatment, light-on-indigo text and gold accents—not a separately recreated light theme.

**Why:** The owner explicitly requested visual continuity and reuse rather than a parallel approximation of the brand.

**How to apply:** Keep shared hero presentation reusable and maintain the home page's appearance when extracting or changing shared styling.

Measure the home hero's actual computed styles, including inherited typography, before claiming a visual match. Do not rely on earlier font-name instructions or shared color tokens alone. Any further shared-style extraction must leave Home visually unchanged, demonstrated with before/after screenshots.

**Why:** The owner rejected the initial Investors rebuild because its forced display font and translucent buttons did not match the rendered Home hero despite sharing background and color tokens.

**How to apply:** Use the rendered headline's typeface for the Investors headline, gauge numerals, labels and goal lines. All three inquiry actions should match Home's solid-white primary pill, not its translucent secondary button. Preserve the current two-group white/gold headline, not the superseded earnings subhead.

Contractor and Client account gauges are the page's only statistics. Keep the current owner-specified headline, tagline, seed-round pill, phone artwork and three equally weighted inquiry actions; do not add extra figures or sections without a new scope decision.

**Why:** The owner explicitly limited the page to this focused fundraising presentation.

**How to apply:** Do not introduce additional financial, hiring, growth or marketplace metrics during future design work. Preserve the existing inquiry behavior while restyling its controls.

Investor targets are owner-approved goals, not forecasts or inferred estimates. Goal initialization must remain application-managed and preserve subsequent Super Admin edits; do not replace it with manual production database writes.

**Why:** The owner explicitly supplied the targets and required insert-if-absent startup initialization rather than hand-editing production. Missing goals are an error safeguard, not the intended normal presentation.

**How to apply:** Preserve the owner-approved target configuration and Super Admin control. Never enlarge a small count/goal arc through a floor or rescaling; its start marker is a separate decorative dot.

Label screenshot environments explicitly when reporting account totals.

**Why:** The owner questioned development screenshots whose account totals differed from the published site's separate database.

**How to apply:** Distinguish development previews from published-site captures and read-only production audits. Never present development totals as production totals or alter the counters to make screenshots agree.
