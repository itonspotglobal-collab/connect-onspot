---
name: Drizzle schema preview limitation
description: Why local Drizzle push previews currently fail before producing a usable schema diff.
---

Local Drizzle Kit 0.39.1 cannot complete a full `push --strict --verbose` schema preview when it encounters the partial pending-invitation uniqueness index on `organization_invitations`: introspection returns a null index expression that the tool rejects.

**Why:** The failure occurs while parsing existing database metadata, before a proposed schema diff is available. It is unrelated to the migration being reviewed, so treating it as a target-schema error risks unnecessary destructive edits.

**How to apply:** Do not apply a preview generated through this failed path. For schema safety, compare the relevant development and production catalog objects directly until the Drizzle configuration/version or partial-index representation is fixed; then restore full SQL preview validation.

## Publish introspection of unvalidated checks

For a malformed generated CHECK statement, compare `pg_get_constraintdef`, `pg_get_expr` and `convalidated` before changing its predicate.

**Why:** Publish introspection was observed treating the trailing `NOT VALID` metadata as part of a CHECK expression, producing extra closing parentheses even though the development constraint was valid PostgreSQL.

**How to apply:** If existing development rows satisfy the intended predicate, validate the existing constraint through normal development permissions and recompute the Publish diff. Keep fresh schema definitions aligned. Do not remove enforcement, modify production directly, or assume every CHECK failure has this cause; test the regenerated statements on a disposable schema copy.