---
name: Controlled dialog focus testing
description: Focus expectations for Radix dialogs opened by custom keyboard cards rather than DialogTrigger.
---

When a Radix Dialog is controlled by a custom card's state instead of a DialogTrigger, verify that focus enters the dialog and Escape/Close dismisses it, but do not assume focus automatically returns to the card.

**Why:** Radix can only restore trigger focus when it owns a trigger element; controlled dialogs opened from a separate role=button may leave focus on the document after dismissal.

**How to apply:** Browser tests should assert dialog focus, clean dismissal, no accidental card re-open, and card availability after close. Add explicit focus restoration in the component before testing that behavior.

Verify the rendered stacking order as well as interaction tests for modal close controls.

**Why:** A sticky navigation layer can visibly cover the X while pointer-event rules still let automated clicks reach it. Successful clicks and in-viewport bounding boxes do not prove that the control is visibly unobscured.

**How to apply:** Inspect an open-modal screenshot against the actual page header and make sure the modal and its backdrop paint above the navigation.