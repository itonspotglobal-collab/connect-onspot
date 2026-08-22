---
name: Tablet hero layout rule
description: Responsive rule for keeping homepage carousel content and preview mockups contained at tablet widths.
---

At 768–1023px, homepage carousel slides use a two-column layout with right-column preview cards constrained to the actual column width.

**Why:** The default single-column layout persisted until the desktop breakpoint, causing a tall text-plus-preview stack to overflow the fixed hero at tablet widths. Explicit containment also prevents preview mockups from running against the viewport edge.

**How to apply:** Keep mobile rules at or below 767px and desktop rules at or above 1024px independent. Any new homepage preview at the tablet breakpoint must fit its right column and preserve a visible gap above the carousel controls.