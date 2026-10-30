# Investors page image audit

Audited the image imports and CSS-backed visuals used by `InvestorsCorner.tsx`
and `InvestorsCorner.css`. No new founder imagery was generated or sourced.

## Current images

| Use | Asset | Audit |
| --- | --- | --- |
| Hero phone canvas | `attached_assets/iphone_mockup_transparent_1791189886936.png` | Present, transparent PNG, 1920 × 1080. The complete canvas is rendered, with a descriptive alt, explicit dimensions, and eager loading for the hero. |
| OnSpot wordmark | `client/src/assets/onspot-white-wordmark.png` | Present local brand asset, 1013 × 319; descriptive alt and intrinsic dimensions on header/footer images. |
| Nur Laminero portrait | `public/nur-ceo.jpeg` | Present portrait, 512 × 512; named alt, explicit dimensions, lazy-loaded below the fold. |
| Jake Wainberg portrait | `attached_assets/Jake_1775039278985.png` | The imported file exists and is a 428 × 570 portrait; named alt, explicit dimensions, lazy-loaded below the fold. |
| Mark Apostol portrait | Formerly `public/mark-apostol.png` | Not used now. The file has a sparkle-like mark on the portrait and its provenance/authenticity cannot be confirmed. Replaced on the page with an initials fallback rather than risk presenting a fabricated or stock image as Mark. |
| Traction illustration | `attached_assets/generated_images/Business_network_illustration_d2c6527c.png` | Existing 1280 × 896 abstract business-network illustration; used instead of generic stock-photo collage images. It does not depict a real person and has descriptive alt text and lazy loading. |
| Global-work vision | `attached_assets/investors/1451187580459-43490279c0fa.webp` | Existing 2000 × 1331 Earth-at-night image retained as a low-contrast visual for the global-work passage. It is now an actual lazy-loaded image with dimensions and descriptive alt text. |

## Removed generic stock imagery

- `1521737711867-e3b97375f902.webp`: generic coworking scene previously used behind
  the hero; removed so strangers are not mistaken for OnSpot founders.
- `1522071820081-009f0129c71c.webp` and `1556761175-b413da4baf72.webp`: generic
  coworkers previously paired with the founders' letter; removed to avoid
  implying they are the founders.
- `1600880292203-757bb62b4baf.webp` and
  `1552664730-d307ca884978.webp`: generic stock photos in the traction collage;
  replaced with the existing network illustration.
- `1497366216548-37526070297c.webp`: generic office interior behind the investor
  call-to-action; removed in favor of the existing indigo treatment.

## Follow-up asset needed

Please provide a verified, genuine portrait of Mark Apostol to replace
`public/mark-apostol.png`. Until then, the page uses the non-photographic “MA”
initials fallback. The existing Jake file referenced by the page was confirmed
present; no missing required phone or Jake PNG was found.
