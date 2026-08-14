---
name: TalentProfile public view pattern
description: How canEdit, isPublicPreview, and showPrivateOwnerSections are derived; startup migration approach; EditField paragraph rendering.
---

# TalentProfile public view / canEdit pattern

## The rule
Three booleans control all conditional rendering in `TalentProfile.tsx`:

```ts
const isOwner = talentAuth?.candidateId === id;
const isPublicPreview = isOwner && new URLSearchParams(window.location.search).get("view") === "public";
const canEdit = (isOwner || isAdminUser) && !isPublicPreview;
const showPrivateOwnerSections = isOwner && !isPublicPreview;
```

**Why:** Admin can edit (canEdit true), but is never the owner via talentAuth so isPublicPreview is always false for admins — their experience is unchanged. The owner can suppress editing via `?view=public`. All JSX uses `canEdit` for edit controls and `showPrivateOwnerSections` for private sections (Applications, Complete Profile CTA).

**How to apply:** Any new owner-only editing control should gate on `canEdit`. Any new private/sensitive section should gate on `showPrivateOwnerSections`. Public View URL is `/talent-profile/:id?view=public`; navigate() to it from owner buttons.

## Startup migration pattern
The project runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` blocks in `server/routes.ts` around line 1030 (near the candidates.first_name migration). New columns added to `shared/schema.ts` must also get a startup migration block there so production deployments pick them up. The manual migration for dev DB uses:
```js
const ws = require('ws');
const { Pool, neonConfig } = require('@neondatabase/serverless');
neonConfig.webSocketConstructor = ws;
// then pool.query(...)
```

## EditField paragraph rendering
`EditField` in `TalentProfile.tsx` now renders multiline content as paragraphs when `multiline=true` and `value` is non-empty: splits on `/\n[ \t]*\n/`, maps to `<p className="text-sm leading-7 ... whitespace-pre-wrap">`. Single-line fields and empty multiline fields fall through to the original `<span>` render.

The optional `minHeight` prop controls the textarea height (default `"100px"`; More About Me uses `"180px"`; About uses `"120px"`).

## More About Me field
- Column: `more_about_me TEXT` in candidates table
- Schema field: `moreAboutMe: text("more_about_me")` in `shared/schema.ts`
- PATCH allowlist: `server/routes.ts` line ~5024
- Saved via `save("moreAboutMe", v)` in TalentProfile
- Section ID: `section-more-about`, tab label "More About Me"
- Hidden for public visitors when empty; always visible to owner
