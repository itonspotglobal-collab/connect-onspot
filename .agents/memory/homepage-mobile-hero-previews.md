---
name: Mobile hero preview rule
description: Responsive decision for homepage carousel preview cards on short phone screens.
---

Mobile homepage-carousel previews must use compact, content-complete card variants below the mobile breakpoint. Do not cap a desktop-density preview with a fixed height and `overflow: hidden`.

**Why:** Cropped cards hid meaningful dashboard rows and summary content on common short phone viewports. The user explicitly approved compact previews that preserve the carousel controls and the entire visible card.

**How to apply:** When preview content becomes too tall on mobile, reduce the information hierarchy (for example, fewer list rows and lower-priority detail) and allow the compact card to determine its own height. Test every carousel slide at short, standard, and tall phone heights, with a clear gap above its controls.