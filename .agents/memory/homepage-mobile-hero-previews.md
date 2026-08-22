---
name: Mobile hero preview rule
description: Responsive decision for homepage carousel preview cards on short phone screens.
---

Mobile homepage-carousel previews must use compact, content-complete card variants below the mobile breakpoint. Do not cap a desktop-density preview with a fixed height and `overflow: hidden`.

**Why:** Cropped cards hid meaningful dashboard rows and summary content on common short phone viewports. The user explicitly approved compact previews that preserve the carousel controls and the entire visible card.

**How to apply:** When preview content becomes too tall on mobile, reduce the information hierarchy (for example, fewer list rows and lower-priority detail) and allow the compact card to determine its own height. Test every carousel slide at short, standard, and tall phone heights, with a clear gap above its controls.

Compact cards should share the slide copy's left edge and use the remaining horizontal viewport space through the right edge rather than being independently centered.

**Why:** Centered cards created inconsistent gutters and left the earnings preview unnecessarily narrow compared with the headline and CTA.

**How to apply:** Below 768px, align the compact visual wrappers to the stacked copy column and size the cards from that shared left edge to the viewport boundary. Keep this rule mobile-only; tablet and desktop use their own contained two-column layout.