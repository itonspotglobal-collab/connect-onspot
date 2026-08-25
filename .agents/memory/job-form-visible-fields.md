---
name: Job-form visible fields
description: Rules for keeping the shared Admin and Client job form aligned with the approved four-step posting flow.
---

The shared Admin and Client job form exposes only the approved four-step fields. Legacy job attributes may remain in storage for existing posts, but must not reappear merely because they are available on the loaded form object.

**Why:** Reintroducing old Job Success Profile, classification, application, system, or compensation controls makes the Client and Admin experiences diverge from the approved posting flow. Sending their default values on an edit can also silently erase existing job data.

**How to apply:** When changing the shared form, add a field to both its visible step and its narrow submission payload only when it is explicitly part of the approved flow. For edits, omit hidden legacy fields from PATCH payloads rather than serializing form defaults. Keep structured required skills and the derived `skillTags` together because matching continues to use the latter.

Work setup, duration, company name, description, education, and skills are optional in the approved flow. New skill requirements start empty; only explicit user-added, non-blank rows persist.

**Why:** Example skills in an early mockup were illustrative, not default job requirements. Optional fields must never be silently filled with a fake value to satisfy the form.

**How to apply:** Keep title, function, experience level, engagement type, and the Admin ownership selection required. Normalize an empty rich-text description to an empty string (the column accepts this without a migration), pass blank company/work setup as null, and derive `skillTags` only from non-blank structured skill names.