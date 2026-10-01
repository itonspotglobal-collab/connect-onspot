# Migration reconciliation verification

This document describes two separate checks for migrations `0018`–`0031`:

1. A local, disposable PostgreSQL rehearsal of the migrations.
2. A standalone, **SELECT-only** expected-definition report for an authorized
   operator to run against a target database before and after deployment.

Neither check deploys, repairs, publishes, writes the migration ledger, nor
automatically triggers a manual republish. A release decision and any republish
remain explicit operator actions.

## Disposable migration rehearsal

`scripts/verify-migration-reconciliation.ts` rehearses the reconciliation
migrations against PostgreSQL 16 in a cluster it owns. It creates a temporary
data directory and private Unix socket, connects with explicit
`reconcile_test`/`postgres`/socket settings, and stops and removes that cluster
in `finally` cleanup. Its child processes receive a clean environment; it does
not read `DATABASE_URL` or other PostgreSQL connection variables and does not
call the application migration runner.

The fixture at `scripts/fixtures/migration-0017-baseline.sql` is a deliberately
small contract fixture, **not a production dump or clone**. It contains only
pre-0018 parent-table columns and ledger entries needed to exercise these
migrations and their backfills. It does not claim to represent all prior
production schema or data.

The harness applies the reconciliation helper and migrations in a transaction
for each test. PostgreSQL disallows foreign keys from temporary tables to
persistent tables, so the helper builds its reference tables in a scratch
regular schema. This requires `CREATE SCHEMA` privilege in the disposable
cluster; the helper creates and drops that schema inside each migration
transaction. It does not open connections itself or write migration-ledger
entries.

From the repository root, with PostgreSQL 16 `initdb`, `postgres`, and `pg_ctl`
available in `PATH` and dependencies already installed, run:

```sh
./node_modules/.bin/tsx scripts/verify-migration-reconciliation.ts
```

The script never derives a target connection from project configuration. It
does not run `npm migrate`, `npm dev`, `npm start`, application/database tests,
or any migration outside its owned disposable cluster. Do not change the
harness to accept a caller-provided URL or persistent database.

## Read-only expected-definition release gate

`docs/migration-reconciliation-verification.sql` is independent of the
rehearsal runner and contains only `SELECT` statements. It embeds a static
expected catalog manifest and uses left joins to report `MATCHING`, `MISSING`,
or `CONFLICTING` for every expected object. It also reports unexpected
additional objects within the migration-owned scope as conflicts. The ledger
check lists all fourteen full migration IDs (`0018_...` through
`0031_reconcile_contract_termination`); it does not rely on a truncated
`BETWEEN '0018' AND '0031'` range.

The manifest contains 455 structural expectations: 26 table/relation
expectations (21 tables introduced by this range and five existing parent
tables that receive changes), 211 column definitions, 126 constraints, 58
indexes, 16 public trigger functions, and 18 enabled triggers. It verifies all
columns on the 21 introduced tables and the migration-added columns on
`jobs`, `offers`, `hiring_contracts`, `invoices`, and `payouts`, including the
explicitly verified `jobs.time_zone` definition. Constraint entries include
canonical definitions and validation state. Index entries
include the owning table, canonical definition, ordered keys, operator classes,
collations, options, predicate, and valid/ready/live state; both
`timesheet_revisions` and `timesheet_revision_sessions` are covered. Trigger
entries include the owning table, enabled state, function binding, timing,
level, events, and ordered `UPDATE OF` column names.

On the five existing parent tables, additional foreign keys that use
migration-added source columns and indexes whose keys, included columns, or
expressions depend on those columns are included in the scoped-object check,
even under unexpected names. This catches an additional wrong-target payout
foreign key or a duplicate index without bringing unrelated legacy parent-table
keys and indexes into scope.

The scoped `0017` fixture already contains `jobs.time_zone`. It remains in the
manifest because original migration `0021` declares it with
`ADD COLUMN IF NOT EXISTS`, and the reconciliation helper explicitly owns its
verification; the manifest tracks touched/verified definitions, not only
catalog additions relative to the fixture.

Constraint names are not treated as semantic identity by themselves. If an
expected constraint name is absent, a validated constraint with the same
canonical definition on the same relation can satisfy the expectation; the
report marks that row `MATCHING` and identifies the alternate name. If the
expected name exists but is bound to a different definition, it remains
`CONFLICTING` even if an equivalent definition exists under another name. This
avoids a false `MISSING` plus unexpected-name `CONFLICTING` pair without hiding
a wrong named binding. When the accepted alias is a primary-key or unique
constraint, its backing index can also satisfy the corresponding expected
index under a different name, but only when the relation, ordered source keys,
primary/unique kind, and remaining structural index definition match. Explicit
migration indexes remain name-strict; an unrelated or wrong-definition index
cannot use a constraint alias to satisfy them.

Migration `0026` intentionally removes the unique restriction on
`talent_credit_memos(original_invoice_id, corrected_revision_id)` and replaces
it with a nonunique index. The obsolete unique constraint and its backing index
are therefore absent from the expected manifest. The report explicitly
conflicts on any remaining unique index over exactly those two source columns,
in either key order, whether constraint-backed or standalone; the intended
nonunique replacement index remains an expected named object.

Numeric defaults on numeric/decimal columns compare equal across a deliberately
narrow set of literal spellings: bounded bare decimal literals, quoted
decimal literals cast to unbounded numeric/decimal, and parenthesized decimal
literals cast to unbounded numeric/decimal. Casts with a numeric/decimal
precision or scale typmod are deliberately excluded and remain exact
comparisons, because the cast can round or change the literal's value. The SQL
validates accepted forms with regular expressions and canonicalizes only the
captured literal with PostgreSQL `trim_scale`; it does not evaluate an
unexpected default function or expression. Unrecognized forms and all
nonnumeric defaults remain exact comparisons.

Function body fingerprints are PostgreSQL's built-in `md5(prosrc)` over the
exact stored `pg_proc.prosrc` text (outer `CREATE FUNCTION` syntax is not part
of `prosrc`). The manifest also retains that exact expected source text and
function properties, so equality is checked against both the fingerprint and
the complete body, not the hash alone. A matching MD5 with different body
text is reported as a suspected hash collision and remains `CONFLICTING`.
These are the final definitions produced by the original `0018`–`0031` source
set in the isolated reference rehearsal, including functions replaced by later
migrations and the documented reference-only pair-UID normalization; they are
not a list of every interim function version accepted by the reconciliation
helper.

Use the SQL only on a database you are authorized to inspect:

1. Before deployment, save the complete report as a read-only baseline. Review
   every `MISSING` or `CONFLICTING` object and every missing ledger ID; do not
   treat a partial schema as permission to publish.
2. After the separately authorized deployment, rerun the same SQL and compare
   the reports. A clean structural gate has every expected object `MATCHING`,
   no unexpected scoped object conflicts, and all fourteen full ledger IDs
   present. Investigate discrepancies rather than editing the database with
   this report.
3. Make any release/republish decision manually. The query cannot initiate or
   authorize a deploy or republish.

### Reference-catalog provenance and limits

The embedded definitions were collected independently by applying the
**original** `migrations/0018_...sql` through `migrations/0031_...sql` obtained
from `git show HEAD:<migration-path>` to the scoped `0017` fixture in a private,
disposable PostgreSQL 16 cluster. The cluster used an explicit private Unix
socket and clean child environment; no application connection settings,
production database, production query, or workflow restart was used. No
fixture rows are represented in the manifest: it is a structural reference
catalog, not a business-data snapshot or a production clone. The draft
`docs/proposed-migrations/0032_termination_snapshot_null_semantics.sql` is
outside this range and outside the active migration runner.

The completed isolated parse/comparison check applied all fourteen original
sources and ran the embedded query on that private fixture after one narrowly
reviewed reference-only normalization: the original `0026` removal intent for
the unique `talent_credit_memos(original_invoice_id, corrected_revision_id)`
pair can miss the PostgreSQL-generated/truncated legacy constraint identifier.
The disposable reference check identified the pair by relation OID and exact
source-column set resolved through `pg_index.indkey`/`pg_attribute`, validated
the reviewed unique-index properties, and removed only that obsolete
constraint/index pair; no other catalog normalization was used. The read-only
manifest itself does not normalize or remove anything and reports any such
remaining unique index as a conflict. After this isolated normalization, all
455 structural rows were `MATCHING` (26 relations/tables,
211 columns, 126 constraints, 58 indexes, 16 functions, and 18 triggers). The
ledger query returned the fourteen full IDs as `MISSING` in this check because
raw migration SQL deliberately does not write runner ledger entries; this is
not a result from a production database.

Separately, the main agent's authorized read-only production inspection
reported that the Oct. 1 Publish DDL created six of the expected 21 feature
tables before ledger IDs `0018`–`0020` were recorded at 08:04; the timesheet
history function and three timesheet triggers were absent in that inspected
state. The six timesheet table definitions and the revision timezone column
matched migrations `0021`/`0022`. The then-current read-only Publish schema
diff had `hasDiff=false`, no warnings, and no generated SQL. The read-only SQL
replica was PostgreSQL 16.15 versus PostgreSQL 16.10 in the private rehearsal;
independently observed public jobs and ledger timestamps correlated the
inspected datasets. This is evidence from a separate inspection, not a query
run by this document's author and not proof that every production schema/data
history matches the fixture. Re-run the read-only gate against the actual
authorized target at the release checkpoint.

Passing the isolated rehearsal demonstrates only that the scoped fixture and
tested migration paths work on the local PostgreSQL 16 build. The reference
catalog and rehearsal do not guarantee that a production schema/data state has
been fully inspected or that deployment is safe.

## Expanded read-only pre-release inspection

The authorized production catalog inspection subsequently compared all expected
categories in read-only batches, retaining table, touched-parent-column, and
constraint-alias context. All 421 expected primitive definitions matched:
26 relations/tables, 211 columns, 126 constraints, and 58 indexes. The sixteen
expected public trigger functions and eighteen enabled triggers were missing.
The only additional scoped objects were the obsolete credit-memo pair unique
constraint and its backing index. The observed index was a valid, ready, live,
non-primary btree over the two UUID columns, with default UUID operator classes,
no predicate, ordinary ordering, and ordinary NULL handling. This is the
reviewed obsolete restriction that pending migration `0026` removes, not a
reason to bypass or manually stamp that migration.

A fresh full-ID ledger SELECT still showed only `0018`–`0020` recorded among
this range, at 08:04:01 UTC on 2026-10-01; every `0021`–`0031` ID was missing.
These queries performed no repair, backfill, ledger write, or protection change.

### Development/Publish alignment remains an operator gate

The inspected Publish diff contained no SQL. This is not proof that editing
the schema source alone has updated the existing development database. No
development schema mutation was authorized or performed in this work.

If the existing development database still retains the obsolete pair unique
restriction, a later Publish schema synchronization can reintroduce it after
the corrected startup migration has removed it from production; an already
recorded `0026` would then correctly be skipped. Review and align the development
schema through its approved development-only flow before financial launch or
subsequent publishing. Do not solve this by deleting ledger records, adding a
production self-healing hook, or directly mutating production.

For a manual retry, review the actual Publish diff again, reject data-overwrite
or destructive prompts, and verify the full ledger and all enabled financial
protections after startup. The local fixture does not certify production data
backfills or authorize financial activity before that post-release verification.
