/**
 * Rehearse migrations 0018-0031 in a self-owned, disposable PostgreSQL 16
 * cluster. This deliberately does not use the application migration runner or
 * any connection setting supplied by the caller's environment.
 */
import { chmod, mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

const root = process.cwd();
const migrationDirectory = path.join(root, "migrations");
const helperPath = path.join(root, "scripts", "migration-reconciliation.sql");
const independentVerificationPath = path.join(
  root,
  "docs",
  "migration-reconciliation-verification.sql",
);
const fixturePath = path.join(
  root,
  "scripts",
  "fixtures",
  "migration-0017-baseline.sql",
);
const migrationSelectors = Array.from({ length: 14 }, (_, index) =>
  String(index + 18).padStart(4, "0"),
);
const migrationLedgerIds = new Map<string, string>();
const childEnvironment = {
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  HOME: os.tmpdir(),
  LANG: "C",
};

let tempRoot: string | undefined;
let dataDirectory: string | undefined;
let socketDirectory: string | undefined;
let pool: Pool | undefined;
let serverStarted = false;
let assertions = 0;

function assert(condition: unknown, message: string): asserts condition {
  assertions++;
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function expectFailure(
  action: () => Promise<unknown>,
  message: string,
  matching?: RegExp,
) {
  assertions++;
  try {
    await action();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (matching && !matching.test(detail)) {
      throw new Error(`${message}: unexpected error: ${detail}`);
    }
    return detail;
  }
  throw new Error(`${message}: operation unexpectedly succeeded`);
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to reserve a private PostgreSQL port"));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForDatabase(candidate: Pool, attempts = 50) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await candidate.query("SELECT 1");
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Private PostgreSQL cluster did not become ready: ${lastError}`);
}

async function startPrivateCluster() {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "migration-reconcile-"));
  await chmod(tempRoot, 0o700);
  dataDirectory = path.join(tempRoot, "data");
  socketDirectory = path.join(tempRoot, "socket");
  const logPath = path.join(tempRoot, "postgres.log");
  const port = await reservePort();
  await mkdir(socketDirectory, { mode: 0o700 });

  execFileSync(
    "initdb",
    ["--auth=trust", "-U", "reconcile_test", "-D", dataDirectory, "--no-instructions"],
    { env: childEnvironment, stdio: "pipe" },
  );
  execFileSync(
    "pg_ctl",
    [
      "-D",
      dataDirectory,
      "-l",
      logPath,
      "-o",
      `-k ${socketDirectory} -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700`,
      "-w",
      "start",
    ],
    { env: childEnvironment, stdio: "pipe" },
  );
  serverStarted = true;

  // Explicit connection fields are intentional: never pass a URL or rely on
  // libpq's PG* environment defaults.
  pool = new Pool({
    host: socketDirectory,
    port,
    user: "reconcile_test",
    database: "postgres",
    password: "",
    max: 4,
    connectionTimeoutMillis: 5_000,
  });
  await waitForDatabase(pool);
}

async function stopPrivateCluster() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
  let stopError: unknown;
  if (serverStarted && dataDirectory) {
    try {
      execFileSync("pg_ctl", ["-D", dataDirectory, "-m", "fast", "-w", "stop"], {
        env: childEnvironment,
        stdio: "pipe",
      });
    } catch (error) {
      stopError = error;
      try {
        execFileSync("pg_ctl", ["-D", dataDirectory, "-m", "immediate", "-w", "stop"], {
          env: childEnvironment,
          stdio: "pipe",
        });
        stopError = undefined;
      } catch {
        // Preserve the original stop failure after cleanup is attempted.
      }
    } finally {
      serverStarted = false;
    }
  }
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
    tempRoot = undefined;
  }
  if (stopError) throw stopError;
}

function db(): Pool {
  if (!pool) throw new Error("Private PostgreSQL pool is not initialized");
  return pool;
}

async function resetToBaseline() {
  const fixture = await readFile(fixturePath, "utf8");
  await db().query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await db().query(fixture);
}

async function migrationSources() {
  const helper = await readFile(helperPath, "utf8");
  for (const api of [
    "reconcile_table",
    "reconcile_column",
    "reconcile_constraint",
    "reconcile_index",
    "reconcile_function",
    "reconcile_trigger",
    "pause_known_trigger",
    "resume_known_trigger",
    "drop_obsolete_unique_pair",
    "finish_reconciliation",
  ]) {
    assert(
      new RegExp(`\\b${api}\\s*\\(`, "i").test(helper),
      `shared helper defines ${api}`,
    );
  }

  const sources = new Map<string, string>();
  const migrationFiles = await readdir(migrationDirectory);
  for (const id of migrationSelectors) {
    const matching = migrationFiles.filter((name) => name.startsWith(`${id}_`));
    assert(matching.length === 1, `exactly one migration source exists for ${id}`);
    migrationLedgerIds.set(id, matching[0].replace(/\.sql$/, ""));
    sources.set(id, await readFile(path.join(migrationDirectory, matching[0]), "utf8"));
  }
  return { helper, sources };
}

function ledgerId(selector: string) {
  const id = migrationLedgerIds.get(selector);
  if (!id) throw new Error(`No full migration filename is registered for ${selector}`);
  return id;
}

async function applyMigration(
  selector: string,
  helper: string,
  sources: Map<string, string>,
  failAfterMigration = false,
) {
  const id = ledgerId(selector);
  const client: PoolClient = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [id]);
    const alreadyApplied = await client.query(
      "SELECT 1 FROM public.app_schema_migrations WHERE id = $1",
      [id],
    );
    if (alreadyApplied.rowCount) {
      await client.query("COMMIT");
      return false;
    }

    // Match the reconciliation runner's transaction boundary: helper objects
    // are session-local and live only while this migration is applied.
    await client.query(helper);
    await client.query(sources.get(selector)!);
    await client.query("SELECT pg_temp.finish_reconciliation()");
    if (failAfterMigration) await client.query("SELECT 1 / 0");
    await client.query("INSERT INTO public.app_schema_migrations (id) VALUES ($1)", [
      id,
    ]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function applyThrough(
  through: string,
  helper: string,
  sources: Map<string, string>,
  failAfterMigration?: string,
) {
  for (const id of migrationSelectors) {
    if (id > through) break;
    await applyMigration(id, helper, sources, id === failAfterMigration);
  }
}

async function clearLaterLedgerEntries() {
  // Deliberately scoped to the harness's own temporary fixture database.
  await db().query("DELETE FROM public.app_schema_migrations WHERE id = ANY($1::text[])", [
    migrationSelectors.map(ledgerId),
  ]);
}

async function deleteLedgerEntry(selector: string) {
  // Ledger resets are fixture-only and always use the runner's full filename ID.
  await db().query("DELETE FROM public.app_schema_migrations WHERE id=$1", [
    ledgerId(selector),
  ]);
}

async function assertLedgerComplete() {
  const result = await db().query(
    "SELECT id FROM public.app_schema_migrations WHERE id = ANY($1::text[]) ORDER BY id",
    [migrationSelectors.map(ledgerId)],
  );
  assert(
    result.rows.map((row) => row.id).join(",") ===
      migrationSelectors.map(ledgerId).sort().join(","),
    "all and only expected later migrations are recorded",
  );
}

async function verifyFinalCatalogAgainstIndependentManifest() {
  const verificationSql = await readFile(independentVerificationPath, "utf8");
  const queryResults = await db().query(verificationSql);
  const resultSets = Array.isArray(queryResults) ? queryResults : [queryResults];
  assert(
    resultSets.length === 2,
    "independent catalog verification returns separate ledger and structure result sets",
  );

  const [ledger, structure] = resultSets;
  assert(
    ledger.rows.length === 14 &&
      ledger.rows.every((row) => row.status === "MATCHING"),
    "independent manifest reports all 14 full migration IDs as MATCHING",
  );
  const structuralMatches = structure.rows.filter(
    (row) => row.status === "MATCHING",
  ).length;
  const structuralConflicts = structure.rows.filter(
    (row) => row.status === "CONFLICTING",
  ).length;
  const structuralMissing = structure.rows.filter(
    (row) => row.status === "MISSING",
  ).length;
  const structuralConstraints = structure.rows.filter(
    (row) => row.object_type === "constraint",
  ).length;
  const structuralIndexes = structure.rows.filter(
    (row) => row.object_type === "index",
  ).length;
  const structuralTables = structure.rows.filter(
    (row) => row.object_type === "table",
  ).length;
  const structuralColumns = structure.rows.filter(
    (row) => row.object_type === "column",
  ).length;
  const structuralFunctions = structure.rows.filter(
    (row) => row.object_type === "function",
  ).length;
  const structuralTriggers = structure.rows.filter(
    (row) => row.object_type === "trigger",
  ).length;
  const structuralMismatches = structure.rows
    .filter((row) => row.status !== "MATCHING")
    .map((row) => `${row.status}:${row.object_type}.${row.object_key}`)
    .join(", ");
  assert(
    structure.rows.length === 455 &&
      structuralMatches === 455 &&
      structuralConflicts === 0 &&
      structuralMissing === 0 &&
      structuralTables === 26 &&
      structuralColumns === 211 &&
      structuralConstraints === 126 &&
      structuralIndexes === 58 &&
      structuralFunctions === 16 &&
      structuralTriggers === 18,
    `independent manifest reports 455 structural MATCHING (26 tables, 211 columns, 126 constraints, 58 indexes, 16 functions, 18 triggers) and no CONFLICTING/MISSING (rows=${structure.rows.length}, matching=${structuralMatches}, conflicting=${structuralConflicts}, missing=${structuralMissing}, tables=${structuralTables}, columns=${structuralColumns}, constraints=${structuralConstraints}, indexes=${structuralIndexes}, functions=${structuralFunctions}, triggers=${structuralTriggers}; mismatches=${structuralMismatches})`,
  );
  assert(
    structure.rows.some(
      (row) =>
        row.object_type === "column" &&
        row.object_key === "jobs.time_zone" &&
        row.status === "MATCHING",
    ),
    "independent structural manifest includes jobs.time_zone",
  );
}

async function testCleanAndMatchingFinal(helper: string, sources: Map<string, string>) {
  await resetToBaseline();
  await applyThrough("0031", helper, sources);
  await assertLedgerComplete();
  await verifyFinalCatalogAgainstIndependentManifest();

  const finalShape = await db().query(`
    SELECT
      to_regclass('public.payment_provider_accounts') IS NOT NULL AS provider_table,
      to_regclass('public.clock_sessions') IS NOT NULL AS clock_table,
      to_regclass('public.timesheet_periods') IS NOT NULL AS periods_table,
      to_regclass('public.talent_invoices') IS NOT NULL AS talent_invoice_table,
      to_regclass('public.client_credit_applications') IS NOT NULL AS client_credit_table,
      to_regclass('public.hiring_contract_termination_requests') IS NOT NULL AS termination_table,
      EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.talent_invoices'::regclass
        AND attname='base_amount' AND NOT attisdropped) AS base_amount_column,
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.hiring_contracts'::regclass
        AND tgname='hiring_contract_termination_immutable' AND tgenabled='O') AS termination_guard_enabled
  `);
  assert(
    Object.values(finalShape.rows[0]).every(Boolean),
    "clean baseline has the expected final feature structures and enabled guard",
  );

  await clearLaterLedgerEntries();
  await applyThrough("0031", helper, sources);
  await assertLedgerComplete();
  const replay = await db().query(`
    SELECT count(*)::int AS count
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='payment_provider_accounts'
  `);
  assert(replay.rows[0].count === 1, "matching final pre-created schema reconciles on replay");
}

async function assertMigrationUnrecorded(id: string) {
  const result = await db().query(
    "SELECT 1 FROM public.app_schema_migrations WHERE id = $1",
    [ledgerId(id)],
  );
  assert(
    result.rowCount === 0,
    `failed ${ledgerId(id)} transaction did not record its ledger ID`,
  );
}

async function testPartialAndColumnDrift(helper: string, sources: Map<string, string>) {
  const invalidShapes: Array<{
    name: string;
    setup: string;
    repair: string;
    preserveAccountTable?: boolean;
  }> = [
    {
      name: "partial pre-existing payment account table",
      setup: "CREATE TABLE public.payment_provider_accounts (id uuid PRIMARY KEY)",
      repair: "DROP TABLE public.payment_provider_accounts",
      preserveAccountTable: true,
    },
    {
      name: "wrong invoice column type",
      setup: "ALTER TABLE public.invoices ADD COLUMN payment_provider integer",
      repair: "ALTER TABLE public.invoices DROP COLUMN payment_provider",
    },
    {
      name: "wrong invoice column default",
      setup: "ALTER TABLE public.invoices ADD COLUMN payment_provider text DEFAULT 'wire'",
      repair: "ALTER TABLE public.invoices DROP COLUMN payment_provider",
    },
    {
      name: "unexpected not-null invoice column",
      setup: "ALTER TABLE public.invoices ADD COLUMN external_charge_id text NOT NULL",
      repair: "ALTER TABLE public.invoices DROP COLUMN external_charge_id",
    },
  ];

  for (const shape of invalidShapes) {
    await resetToBaseline();
    await db().query(shape.setup);
    await expectFailure(
      () => applyMigration("0018", helper, sources),
      `${shape.name} is rejected`,
    );
    await assertMigrationUnrecorded("0018");
    const accountTable = await db().query(
      "SELECT to_regclass('public.payment_provider_accounts') AS relation",
    );
    assert(
      shape.preserveAccountTable
        ? accountTable.rows[0].relation !== null
        : accountTable.rows[0].relation === null,
      shape.preserveAccountTable
        ? `${shape.name} is preserved on failure`
        : `${shape.name} failure rolls back earlier DDL in the same migration`,
    );
    await db().query(shape.repair);
    await applyMigration("0018", helper, sources);
    const repaired = await db().query(
      "SELECT 1 FROM public.app_schema_migrations WHERE id=$1",
      [ledgerId("0018")],
    );
    assert(repaired.rowCount === 1, `${shape.name} can resume after repair`);
  }
}

async function testSafePartialObjectCompletion(
  helper: string,
  sources: Map<string, string>,
) {
  await resetToBaseline();
  await db().query(`
    CREATE TABLE public.payment_provider_accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid()
    )
  `);
  await applyMigration("0018", helper, sources);
  const shape = await db().query(`
    SELECT
      (SELECT count(*)::int FROM pg_attribute
        WHERE attrelid='public.payment_provider_accounts'::regclass
          AND attnum > 0 AND NOT attisdropped) AS columns,
      to_regclass('public.payment_provider_accounts_owner_unique') IS NOT NULL AS owner_index,
      to_regclass('public.payment_provider_accounts_external_unique') IS NOT NULL AS external_index
  `);
  assert(
    shape.rows[0]?.columns === 8 &&
      shape.rows[0]?.owner_index &&
      shape.rows[0]?.external_index,
    "empty partial object with the correct ID default is completed safely",
  );
  const ledger = await db().query(
    "SELECT id FROM public.app_schema_migrations WHERE id=$1",
    [ledgerId("0018")],
  );
  assert(ledger.rows[0]?.id === ledgerId("0018"), "completion records full runner migration ID");
}

async function assertPayoutTalentInvoiceForeignKey() {
  const result = await db().query(`
    SELECT c.conname, c.confdeltype, c.convalidated,
           c.confrelid::regclass::text AS referenced_table,
           pg_get_constraintdef(c.oid, true) AS definition
    FROM pg_constraint c
    WHERE c.conrelid='public.payouts'::regclass
      AND c.contype='f'
      AND ARRAY(
        SELECT a.attname::text
        FROM unnest(c.conkey) k(attnum)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
        ORDER BY a.attname
      ) = ARRAY['talent_invoice_id']::text[]
  `);
  assert(
    result.rows.length === 1 &&
      result.rows[0].referenced_table === "talent_invoices" &&
      result.rows[0].confdeltype === "r" &&
      result.rows[0].convalidated &&
      /REFERENCES talent_invoices\(id\) ON DELETE RESTRICT/i.test(
        result.rows[0].definition,
      ),
    "payout talent_invoice_id is bound to the expected RESTRICT foreign key",
  );
}

async function testPayoutForeignKeyReconciliation(
  helper: string,
  sources: Map<string, string>,
) {
  await resetToBaseline();
  await applyThrough("0023", helper, sources);
  await db().query(`
    ALTER TABLE public.payouts
      ADD COLUMN talent_invoice_id uuid
      CONSTRAINT payouts_talent_invoice_id_wrong_target_fkey
      REFERENCES public.offers(id) ON DELETE RESTRICT
  `);
  await expectFailure(
    () => applyMigration("0024", helper, sources),
    "wrong-target payout FK is rejected",
    /conflicting foreign key/i,
  );
  await assertMigrationUnrecorded("0024");
  const rolledBack = await db().query(
    "SELECT to_regclass('public.talent_invoices') AS relation",
  );
  assert(
    rolledBack.rows[0].relation === null,
    "wrong-target FK failure rolls back migration-created invoice DDL",
  );
  const wrongFkSurvived = await db().query(`
    SELECT pg_get_constraintdef(oid, true) AS definition
    FROM pg_constraint
    WHERE conrelid='public.payouts'::regclass
      AND conname='payouts_talent_invoice_id_wrong_target_fkey'
  `);
  assert(
    /REFERENCES offers\(id\)/i.test(wrongFkSurvived.rows[0]?.definition ?? ""),
    "pre-existing conflicting FK is preserved after failed reconciliation",
  );
  await db().query(`
    ALTER TABLE public.payouts
      DROP CONSTRAINT payouts_talent_invoice_id_wrong_target_fkey,
      DROP COLUMN talent_invoice_id
  `);
  await applyMigration("0024", helper, sources);
  await assertPayoutTalentInvoiceForeignKey();

  // Rehearse the matching ORM/SQL pre-created FK rather than relying only on
  // the clean path that adds it as part of reconcile_column.
  await db().query(`
    DROP INDEX public.payouts_talent_invoice_unique;
    ALTER TABLE public.payouts
      DROP CONSTRAINT payouts_talent_invoice_id_fkey,
      DROP COLUMN talent_invoice_id;
    ALTER TABLE public.payouts
      ADD COLUMN talent_invoice_id uuid
      REFERENCES public.talent_invoices(id) ON DELETE RESTRICT
  `);
  await deleteLedgerEntry("0024");
  await applyMigration("0024", helper, sources);
  await assertPayoutTalentInvoiceForeignKey();

  // A correctly named FK with the wrong delete action must not be accepted.
  await db().query(`
    ALTER TABLE public.payouts
      DROP CONSTRAINT payouts_talent_invoice_id_fkey,
      ADD CONSTRAINT payouts_talent_invoice_id_fkey
        FOREIGN KEY (talent_invoice_id)
        REFERENCES public.talent_invoices(id) ON DELETE CASCADE
  `);
  await deleteLedgerEntry("0024");
  await expectFailure(
    () => applyMigration("0024", helper, sources),
    "payout FK with the wrong delete action is rejected",
    /conflicting foreign key|conflicting constraint/i,
  );
  await assertMigrationUnrecorded("0024");
  await db().query(`
    ALTER TABLE public.payouts
      DROP CONSTRAINT payouts_talent_invoice_id_fkey,
      ADD CONSTRAINT payouts_talent_invoice_id_fkey
        FOREIGN KEY (talent_invoice_id)
        REFERENCES public.talent_invoices(id) ON DELETE RESTRICT
  `);
  await applyMigration("0024", helper, sources);
  await assertPayoutTalentInvoiceForeignKey();
}

async function testWrongIndexPredicate(helper: string, sources: Map<string, string>) {
  await resetToBaseline();
  await applyMigration("0018", helper, sources);
  await db().query(`
    DROP INDEX public.payment_provider_accounts_external_unique;
    CREATE UNIQUE INDEX payment_provider_accounts_external_unique
      ON public.payment_provider_accounts(provider_name, external_account_id)
      WHERE external_account_id IS NOT NULL
  `);
  await deleteLedgerEntry("0018");
  await expectFailure(
    () => applyMigration("0018", helper, sources),
    "same-named index with a wrong predicate is rejected",
  );
  await assertMigrationUnrecorded("0018");
}

async function testWrongAndDisabledTrigger(helper: string, sources: Map<string, string>) {
  await resetToBaseline();
  await applyThrough("0023", helper, sources);
  await db().query(`
    DROP TRIGGER offers_billing_mode_immutable ON public.offers;
    CREATE TRIGGER offers_billing_mode_immutable
      BEFORE INSERT ON public.offers
      FOR EACH ROW EXECUTE FUNCTION public.prevent_offer_billing_mode_change()
  `);
  await deleteLedgerEntry("0023");
  await expectFailure(
    () => applyMigration("0023", helper, sources),
    "same-named trigger with the wrong event is rejected",
  );
  await assertMigrationUnrecorded("0023");

  await resetToBaseline();
  await applyThrough("0023", helper, sources);
  await db().query(
    "ALTER TABLE public.offers DISABLE TRIGGER offers_billing_mode_immutable",
  );
  await deleteLedgerEntry("0023");
  await expectFailure(
    () => applyMigration("0023", helper, sources),
    "disabled known trigger is rejected",
  );
  await assertMigrationUnrecorded("0023");
}

async function testUnexpectedFunctionBodyAndProperties(
  helper: string,
  sources: Map<string, string>,
) {
  await resetToBaseline();
  await applyThrough("0023", helper, sources);
  await db().query(`
    CREATE OR REPLACE FUNCTION public.prevent_offer_billing_mode_change()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.billing_mode IS DISTINCT FROM OLD.billing_mode THEN
        RAISE EXCEPTION 'unexpected altered guard body';
      END IF;
      RETURN NEW;
    END;
    $$
  `);
  await deleteLedgerEntry("0023");
  await expectFailure(
    () => applyMigration("0023", helper, sources),
    "unexpected billing-mode function body is rejected",
    /unexpected existing definition\/properties/i,
  );
  await assertMigrationUnrecorded("0023");

  await resetToBaseline();
  await applyThrough("0023", helper, sources);
  await db().query(
    "ALTER FUNCTION public.prevent_offer_billing_mode_change() SECURITY DEFINER",
  );
  await deleteLedgerEntry("0023");
  await expectFailure(
    () => applyMigration("0023", helper, sources),
    "unexpected SECURITY DEFINER function property is rejected",
    /unexpected existing definition\/properties/i,
  );
  await assertMigrationUnrecorded("0023");
}

async function testTimezoneBackfillRollback(helper: string, sources: Map<string, string>) {
  await resetToBaseline();
  await applyThrough("0021", helper, sources);
  await db().query(`
    INSERT INTO public.users (id, role) VALUES ('tz-talent', 'talent');
    INSERT INTO public.offers (id) VALUES ('00000000-0000-4000-8000-000000000021');
    INSERT INTO public.hiring_contracts (id, offer_id)
      VALUES ('00000000-0000-4000-8000-000000000022',
              '00000000-0000-4000-8000-000000000021');
    INSERT INTO public.timesheet_periods
      (id, hiring_contract_id, period_start, period_end, work_timezone)
      VALUES ('00000000-0000-4000-8000-000000000023',
              '00000000-0000-4000-8000-000000000022',
              '2024-01-01', '2024-01-31', 'America/New_York');
    INSERT INTO public.timesheet_revisions
      (id, timesheet_period_id, version, decision_reason)
      VALUES ('00000000-0000-4000-8000-000000000024',
              '00000000-0000-4000-8000-000000000023', 1, 'fixture revision');
  `);

  await expectFailure(
    () => applyMigration("0022", helper, sources, true),
    "injected post-backfill error rolls back migration 0022",
    /division by zero/i,
  );
  await assertMigrationUnrecorded("0022");
  const rolledBack = await db().query(`
    SELECT
      NOT EXISTS (SELECT 1 FROM pg_attribute
        WHERE attrelid='public.timesheet_revisions'::regclass
          AND attname='work_timezone' AND NOT attisdropped) AS column_rolled_back,
      EXISTS (SELECT 1 FROM pg_trigger
        WHERE tgrelid='public.timesheet_revisions'::regclass
          AND tgname='timesheet_revisions_immutable' AND tgenabled='O') AS trigger_enabled
  `);
  assert(
    rolledBack.rows[0].column_rolled_back && rolledBack.rows[0].trigger_enabled,
    "failed timezone backfill restores its original enabled trigger and schema",
  );

  await applyMigration("0022", helper, sources);
  const recovered = await db().query(`
    SELECT tr.work_timezone,
           t.tgenabled = 'O' AS trigger_enabled
    FROM public.timesheet_revisions tr
    JOIN pg_trigger t ON t.tgrelid=tr.tableoid AND t.tgname='timesheet_revisions_immutable'
    WHERE tr.id='00000000-0000-4000-8000-000000000024'
  `);
  assert(
    recovered.rows[0]?.work_timezone === "America/New_York" &&
      recovered.rows[0]?.trigger_enabled,
    "timezone backfill resumes successfully with trigger enabled",
  );
}

async function testPausedTriggerRollbackDuringBackfill(
  helper: string,
  sources: Map<string, string>,
) {
  await resetToBaseline();
  await applyThrough("0021", helper, sources);
  await db().query(`
    INSERT INTO public.users (id, role) VALUES ('pause-talent', 'talent');
    INSERT INTO public.offers (id) VALUES ('00000000-0000-4000-8000-000000000071');
    INSERT INTO public.hiring_contracts (id, offer_id)
      VALUES ('00000000-0000-4000-8000-000000000072',
              '00000000-0000-4000-8000-000000000071');
    INSERT INTO public.timesheet_periods
      (id, hiring_contract_id, period_start, period_end, work_timezone)
      VALUES ('00000000-0000-4000-8000-000000000073',
              '00000000-0000-4000-8000-000000000072',
              '2024-02-01', '2024-02-29', 'America/Chicago');
    ALTER TABLE public.timesheet_revisions ADD COLUMN work_timezone text;
    ALTER TABLE public.timesheet_revisions
      ADD CONSTRAINT timesheet_revision_timezone_backfill_blocked_check
      CHECK (work_timezone IS NULL);
    INSERT INTO public.timesheet_revisions
      (id, timesheet_period_id, version, decision_reason)
      VALUES ('00000000-0000-4000-8000-000000000074',
              '00000000-0000-4000-8000-000000000073', 1, 'blocked fixture');
  `);

  await expectFailure(
    () => applyMigration("0022", helper, sources),
    "backfill constraint failure rolls back while a known trigger is paused",
    /timesheet_revision_timezone_backfill_blocked_check/i,
  );
  await assertMigrationUnrecorded("0022");
  const afterFailure = await db().query(`
    SELECT
      EXISTS (SELECT 1 FROM pg_trigger
        WHERE tgrelid='public.timesheet_revisions'::regclass
          AND tgname='timesheet_revisions_immutable'
          AND tgenabled='O') AS trigger_enabled,
      (SELECT work_timezone FROM public.timesheet_revisions
        WHERE id='00000000-0000-4000-8000-000000000074') IS NULL AS backfill_rolled_back,
      EXISTS (SELECT 1 FROM pg_namespace
        WHERE nspname='_migration_reconcile_template') AS scratch_schema_leaked
  `);
  assert(
    afterFailure.rows[0]?.trigger_enabled &&
      afterFailure.rows[0]?.backfill_rolled_back &&
      !afterFailure.rows[0]?.scratch_schema_leaked,
    "failed backfill restores the trigger, data, and scratch schema state",
  );

  await db().query(`
    ALTER TABLE public.timesheet_revisions
      DROP CONSTRAINT timesheet_revision_timezone_backfill_blocked_check
  `);
  await applyMigration("0022", helper, sources);
  const resumed = await db().query(`
    SELECT tr.work_timezone, t.tgenabled='O' AS trigger_enabled
    FROM public.timesheet_revisions tr
    JOIN pg_trigger t ON t.tgrelid=tr.tableoid
      AND t.tgname='timesheet_revisions_immutable'
    WHERE tr.id='00000000-0000-4000-8000-000000000074'
  `);
  assert(
    resumed.rows[0]?.work_timezone === "America/Chicago" &&
      resumed.rows[0]?.trigger_enabled,
    "backfill resumes after removing the deliberate blocker",
  );
}

async function testReportedPrecreatedTimesheetState(
  helper: string,
  sources: Map<string, string>,
) {
  await resetToBaseline();
  await applyThrough("0020", helper, sources);
  const ledgerBefore = await db().query(
    "SELECT id, applied_at::text FROM public.app_schema_migrations WHERE id = ANY($1::text[]) ORDER BY id",
    [migrationSelectors.slice(0, 3).map(ledgerId)],
  );
  assert(
    ledgerBefore.rows.length === 3,
    "reported partial-publish simulation begins with only 0018-0020 applied",
  );

  // Materialize the exact table/constraint/index/timezone catalog produced by
  // the published SQL/ORM side, then remove only the three missing guards and
  // the 0021/0022 ledger rows. The resulting catalog is the reported failure
  // state: existing 0018-0020 ledger entries and timestamps are untouched.
  await applyThrough("0022", helper, sources);
  await db().query(`
    DROP TRIGGER timesheet_revisions_immutable ON public.timesheet_revisions;
    DROP TRIGGER timesheet_revision_sessions_immutable ON public.timesheet_revision_sessions;
    DROP TRIGGER timesheet_audit_immutable ON public.timesheet_audit;
    DROP FUNCTION public.reject_timesheet_history_mutation();
  `);
  await deleteLedgerEntry("0021");
  await deleteLedgerEntry("0022");

  const partialState = await db().query(`
    SELECT
      (SELECT count(*)::int FROM pg_class c
        WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
          AND c.relname = ANY(ARRAY[
            'timesheet_periods', 'timesheet_revisions', 'timesheet_revision_sessions',
            'timesheet_correction_proposals', 'timesheet_disputes', 'timesheet_audit'
          ])) AS table_count,
      EXISTS (SELECT 1 FROM pg_attribute
        WHERE attrelid='public.jobs'::regclass AND attname='time_zone'
          AND NOT attisdropped) AS job_timezone_column,
      EXISTS (SELECT 1 FROM pg_attribute
        WHERE attrelid='public.timesheet_revisions'::regclass
          AND attname='work_timezone' AND NOT attisdropped) AS revision_timezone_column,
      EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid='public.timesheet_periods'::regclass
          AND conname='timesheet_period_approved_revision_fk') AS approved_revision_fk,
      EXISTS (SELECT 1 FROM pg_class
        WHERE oid=to_regclass('public.timesheet_periods_contract_period')) AS periods_index,
      to_regprocedure('public.reject_timesheet_history_mutation()') IS NULL AS function_missing,
      (SELECT count(*)::int FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid
        WHERE c.relnamespace='public'::regnamespace AND t.tgname = ANY(ARRAY[
          'timesheet_revisions_immutable',
          'timesheet_revision_sessions_immutable',
          'timesheet_audit_immutable'
        ])) = 0 AS three_triggers_missing
  `);
  assert(
    partialState.rows[0]?.table_count === 6 &&
      partialState.rows[0]?.job_timezone_column &&
      partialState.rows[0]?.revision_timezone_column &&
      partialState.rows[0]?.approved_revision_fk &&
      partialState.rows[0]?.periods_index &&
      partialState.rows[0]?.function_missing &&
      partialState.rows[0]?.three_triggers_missing,
    "partial-publish fixture has all SQL/ORM table structures but lacks only guards",
  );
  const pendingLedger = await db().query(
    "SELECT count(*)::int AS count FROM public.app_schema_migrations WHERE id = ANY($1::text[])",
    [migrationSelectors.slice(3).map(ledgerId)],
  );
  assert(pendingLedger.rows[0]?.count === 0, "failed publish simulation keeps ledger at 0020");

  await applyThrough("0031", helper, sources);
  const ledgerAfter = await db().query(
    "SELECT id, applied_at::text FROM public.app_schema_migrations WHERE id = ANY($1::text[]) ORDER BY id",
    [migrationSelectors.slice(0, 3).map(ledgerId)],
  );
  assert(
    JSON.stringify(ledgerAfter.rows) === JSON.stringify(ledgerBefore.rows),
    "retry skips 0018-0020 without changing their original ledger timestamps",
  );
  const restoredGuards = await db().query(`
    SELECT
      to_regprocedure('public.reject_timesheet_history_mutation()') IS NOT NULL AS function_present,
      (SELECT count(*)::int FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid
        WHERE c.relnamespace='public'::regnamespace AND t.tgenabled='O'
          AND t.tgname = ANY(ARRAY[
            'timesheet_revisions_immutable',
            'timesheet_revision_sessions_immutable',
            'timesheet_audit_immutable'
          ])) AS enabled_guards
  `);
  assert(
    restoredGuards.rows[0]?.function_present &&
      restoredGuards.rows[0]?.enabled_guards === 3,
    "retry restores all three immutable timesheet triggers",
  );
  await assertLedgerComplete();
}

async function testFullPrecreatedPublishState(
  helper: string,
  sources: Map<string, string>,
) {
  await resetToBaseline();
  await applyThrough("0031", helper, sources);
  const earlyLedgerBefore = await db().query(
    "SELECT id, applied_at::text FROM public.app_schema_migrations WHERE id = ANY($1::text[]) ORDER BY id",
    [migrationSelectors.slice(0, 3).map(ledgerId)],
  );
  assert(
    earlyLedgerBefore.rows.length === 3,
    "full-schema publish simulation starts with original 0018-0020 ledger timestamps",
  );

  const cleanGuards = await db().query(`
    SELECT
      (SELECT count(*)::int FROM pg_proc
        WHERE pronamespace='public'::regnamespace
          AND prokind='f' AND prorettype='trigger'::regtype) AS function_count,
      (SELECT count(*)::int FROM pg_trigger t
        JOIN pg_proc p ON p.oid=t.tgfoid
        WHERE NOT t.tgisinternal AND p.pronamespace='public'::regnamespace) AS trigger_count,
      (SELECT count(*)::int FROM public.talent_credit_memos) AS credit_memo_rows,
      (SELECT count(*)::int FROM pg_constraint c
        WHERE c.conrelid='public.talent_credit_memos'::regclass
          AND c.contype='u'
          AND ARRAY(
            SELECT a.attname::text
            FROM unnest(c.conkey) k(attnum)
            JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
            ORDER BY a.attname
          )=ARRAY['corrected_revision_id','original_invoice_id']::text[]) AS old_pair_unique
  `);
  assert(
    cleanGuards.rows[0]?.function_count === 16 &&
      cleanGuards.rows[0]?.trigger_count === 18 &&
      cleanGuards.rows[0]?.credit_memo_rows === 0 &&
      cleanGuards.rows[0]?.old_pair_unique === 0,
    "final generated schema starts with all 16 functions/18 triggers and no obsolete pair",
  );

  // Recreate the known-valid old migration-0024 unique pair on an empty table.
  // Migration 0026 must remove its backing constraint/index during the retry.
  await db().query(`
    ALTER TABLE public.talent_credit_memos
      ADD UNIQUE (original_invoice_id, corrected_revision_id)
  `);
  await db().query(`
    DO $drop_owned_guards$
    DECLARE item record;
    BEGIN
      FOR item IN
        SELECT ns.nspname AS schema_name, c.relname AS table_name, t.tgname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid
        JOIN pg_namespace ns ON ns.oid=c.relnamespace
        JOIN pg_proc p ON p.oid=t.tgfoid
        WHERE NOT t.tgisinternal
          AND p.pronamespace='public'::regnamespace
          AND p.prokind='f' AND p.prorettype='trigger'::regtype
      LOOP
        EXECUTE format('DROP TRIGGER %I ON %I.%I',
          item.tgname, item.schema_name, item.table_name);
      END LOOP;

      FOR item IN
        SELECT ns.nspname AS schema_name, p.proname
        FROM pg_proc p
        JOIN pg_namespace ns ON ns.oid=p.pronamespace
        WHERE ns.nspname='public'
          AND p.prokind='f' AND p.prorettype='trigger'::regtype
      LOOP
        EXECUTE format('DROP FUNCTION %I.%I()', item.schema_name, item.proname);
      END LOOP;
    END
    $drop_owned_guards$
  `);

  await db().query(
    "DELETE FROM public.app_schema_migrations WHERE id = ANY($1::text[])",
    [migrationSelectors.slice(3).map(ledgerId)],
  );
  const partialState = await db().query(`
    SELECT
      (SELECT count(*)::int FROM pg_class c
        WHERE c.relnamespace='public'::regnamespace AND c.relkind='r') AS tables,
      (SELECT count(*)::int FROM pg_attribute a
        JOIN pg_class c ON c.oid=a.attrelid
        WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
          AND a.attnum > 0 AND NOT a.attisdropped) AS columns,
      (SELECT count(*)::int FROM pg_constraint c
        JOIN pg_class r ON r.oid=c.conrelid
        WHERE r.relnamespace='public'::regnamespace) AS constraints,
      (SELECT count(*)::int FROM pg_class c
        WHERE c.relnamespace='public'::regnamespace AND c.relkind='i') AS indexes,
      (SELECT count(*)::int FROM pg_proc
        WHERE pronamespace='public'::regnamespace
          AND prokind='f' AND prorettype='trigger'::regtype) AS functions,
      (SELECT count(*)::int FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid
        WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace) AS triggers,
      (SELECT count(*)::int FROM public.talent_credit_memos) AS credit_memo_rows,
      (SELECT count(*)::int FROM pg_constraint c
        WHERE c.conrelid='public.talent_credit_memos'::regclass
          AND c.contype='u'
          AND ARRAY(
            SELECT a.attname::text
            FROM unnest(c.conkey) k(attnum)
            JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
            ORDER BY a.attname
          )=ARRAY['corrected_revision_id','original_invoice_id']::text[]) AS old_pair_unique
  `);
  const independentSql = await readFile(independentVerificationPath, "utf8");
  const independentResult = await db().query(independentSql);
  const independentSets = Array.isArray(independentResult)
    ? independentResult
    : [independentResult];
  const structureRows = independentSets[1]?.rows ?? [];
  const nonmatchingRows = structureRows.filter(
    (row) => row.status !== "MATCHING",
  );
  const nonmatchingObjectKeys = nonmatchingRows
    .map((row) => `${row.status}:${row.object_type}.${row.object_key}`)
    .join(", ");
  const statusCount = (status: string) =>
    structureRows.filter((row) => row.status === status).length;
  const structureTypeCount = (type: string) =>
    structureRows.filter((row) => row.object_type === type).length;
  const missingFunctions = structureRows.filter(
    (row) => row.status === "MISSING" && row.object_type === "function",
  ).length;
  const missingTriggers = structureRows.filter(
    (row) => row.status === "MISSING" && row.object_type === "trigger",
  ).length;
  const conflictingPairObjects = structureRows.filter(
    (row) =>
      row.status === "CONFLICTING" &&
      row.object_type === "constraint" &&
      row.object_key.includes("talent_credit_memos_original_invoice_id_corrected_revision"),
  ).length + structureRows.filter(
    (row) =>
      row.status === "CONFLICTING" &&
      row.object_type === "index" &&
      row.object_key.includes("talent_credit_memos_original_invoice_id_corrected_revision"),
  ).length;
  assert(
    partialState.rows[0]?.functions === 0 &&
      partialState.rows[0]?.triggers === 0 &&
      partialState.rows[0]?.credit_memo_rows === 0 &&
      partialState.rows[0]?.old_pair_unique === 1 &&
      structureRows.length === 457 &&
      statusCount("MATCHING") === 421 &&
      statusCount("MISSING") === 34 &&
      statusCount("CONFLICTING") === 2 &&
      structureTypeCount("table") === 26 &&
      structureTypeCount("column") === 211 &&
      structureTypeCount("constraint") === 127 &&
      structureTypeCount("index") === 59 &&
      structureTypeCount("function") === 16 &&
      structureTypeCount("trigger") === 18 &&
      missingFunctions === 16 &&
      missingTriggers === 18 &&
      conflictingPairObjects === 2,
    `reported full-catalog state inventory mismatch (unfiltered private public-schema inventory=${JSON.stringify(partialState.rows[0])}; scoped manifest statuses={rows:${structureRows.length}, matching:${statusCount("MATCHING")}, missing:${statusCount("MISSING")}, conflicting:${statusCount("CONFLICTING")}}; scoped manifest type counts={tables:${structureTypeCount("table")}, columns:${structureTypeCount("column")}, constraints:${structureTypeCount("constraint")}, indexes:${structureTypeCount("index")}, functions:${structureTypeCount("function")}, triggers:${structureTypeCount("trigger")}}; missing guards=${missingFunctions} functions/${missingTriggers} triggers; obsolete-pair conflicts=${conflictingPairObjects}; nonmatching object keys=${nonmatchingObjectKeys})`,
  );
  const pendingLedger = await db().query(
    "SELECT count(*)::int AS count FROM public.app_schema_migrations WHERE id = ANY($1::text[])",
    [migrationSelectors.slice(3).map(ledgerId)],
  );
  assert(
    pendingLedger.rows[0]?.count === 0,
    "full-catalog publish simulation removes only migration 0021-0031 ledger IDs",
  );

  await applyThrough("0031", helper, sources);
  const earlyLedgerAfter = await db().query(
    "SELECT id, applied_at::text FROM public.app_schema_migrations WHERE id = ANY($1::text[]) ORDER BY id",
    [migrationSelectors.slice(0, 3).map(ledgerId)],
  );
  assert(
    JSON.stringify(earlyLedgerAfter.rows) === JSON.stringify(earlyLedgerBefore.rows),
    "full-catalog retry leaves 0018-0020 ledger timestamps unchanged",
  );
  await assertLedgerComplete();
  await verifyFinalCatalogAgainstIndependentManifest();
  const obsoletePair = await db().query(`
    SELECT count(*)::int AS count
    FROM pg_index i
    WHERE i.indrelid='public.talent_credit_memos'::regclass
      AND i.indisunique
      AND i.indnkeyatts=2
      AND ARRAY(
        SELECT a.attname::text
        FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
        WHERE k.ord <= i.indnkeyatts
        ORDER BY a.attname
      )=ARRAY['corrected_revision_id','original_invoice_id']::text[]
  `);
  assert(
    obsoletePair.rows[0]?.count === 0,
    "full-catalog retry removes the obsolete unique credit-memo pair index",
  );
}

async function testBillingBackfillAndFinalGuards(
  helper: string,
  sources: Map<string, string>,
) {
  await resetToBaseline();
  await db().query(`
    INSERT INTO public.users (id, role) VALUES
      ('backfill-client', 'client'), ('backfill-talent', 'talent');
    INSERT INTO public.offers (id, proposed_start_date) VALUES
      ('00000000-0000-4000-8000-000000000031', '2020-01-05'),
      ('00000000-0000-4000-8000-000000000032', '2020-02-05');
    INSERT INTO public.hiring_contracts
      (id, offer_id, status, created_at, onspot_signed_at, talent_signed_at)
    VALUES
      ('00000000-0000-4000-8000-000000000033',
       '00000000-0000-4000-8000-000000000031', 'signed',
       '2020-01-01', '2020-01-02', '2020-01-03'),
      ('00000000-0000-4000-8000-000000000034',
       '00000000-0000-4000-8000-000000000032', 'terminated',
       '2020-02-01', NULL, NULL);
  `);
  await applyThrough("0024", helper, sources);

  // This nullable extension is one of the explicitly supported legacy shapes.
  await db().query(`
    ALTER TABLE public.talent_invoices ADD COLUMN base_amount numeric(12,2);
    INSERT INTO public.talent_invoices
      (id, hiring_contract_id, offer_id, talent_id, client_id, billing_mode,
       period_start, period_end, currency, monthly_rate, amount, status,
       auto_send_at, payout_due_on, base_amount)
    VALUES
      ('00000000-0000-4000-8000-000000000035',
       '00000000-0000-4000-8000-000000000033',
       '00000000-0000-4000-8000-000000000031',
       'backfill-talent', 'backfill-client', 'tracked',
       '2020-01-01', '2020-01-31', 'USD', 100, 100, 'sent',
       '2020-02-01', '2020-02-15', NULL);
    INSERT INTO public.payouts
      (id, hiring_contract_id, talent_invoice_id)
    VALUES ('00000000-0000-4000-8000-000000000036',
            '00000000-0000-4000-8000-000000000033',
            '00000000-0000-4000-8000-000000000035');
  `);
  await applyThrough("0031", helper, sources);
  const backfills = await db().query(`
    SELECT
      hc.effective_start_date,
      hc.billing_activated_at,
      ti.base_amount,
      ti.base_amount IS NOT NULL AS base_amount_backfilled,
      p.payout_due_on,
      (SELECT proposed_start_date::date FROM public.offers
        WHERE id=hc.offer_id) AS expected_start
    FROM public.hiring_contracts hc
    JOIN public.talent_invoices ti
      ON ti.hiring_contract_id=hc.id
    JOIN public.payouts p ON p.talent_invoice_id=ti.id
    WHERE hc.id='00000000-0000-4000-8000-000000000033'
  `);
  assert(
    backfills.rows[0]?.effective_start_date?.toISOString().slice(0, 10) === "2020-01-05" &&
      backfills.rows[0]?.expected_start?.toISOString().slice(0, 10) === "2020-01-05" &&
      backfills.rows[0]?.billing_activated_at?.toISOString().startsWith("2020-01-03") &&
      backfills.rows[0]?.base_amount_backfilled &&
      Number(backfills.rows[0]?.base_amount) === 100 &&
      backfills.rows[0]?.payout_due_on?.toISOString().slice(0, 10) === "2020-02-15",
    "billing snapshots, supported nullable invoice base, and payout due date backfill",
  );
  const guards = await db().query(`
    SELECT
      (SELECT tgenabled='O' FROM pg_trigger
        WHERE tgrelid='public.hiring_contracts'::regclass
          AND tgname='hiring_contract_billing_start_immutable') AS start_guard_enabled,
      (SELECT tgenabled='O' FROM pg_trigger
        WHERE tgrelid='public.talent_invoices'::regclass
          AND tgname='talent_invoices_sent_immutable') AS invoice_guard_enabled,
      (SELECT attnotnull FROM pg_attribute
        WHERE attrelid='public.talent_invoices'::regclass
          AND attname='base_amount' AND NOT attisdropped) AS base_amount_required
  `);
  assert(
    guards.rows[0]?.start_guard_enabled &&
      guards.rows[0]?.invoice_guard_enabled &&
      guards.rows[0]?.base_amount_required,
    "billing backfills leave the final immutable guards enabled",
  );

  // Replay 0025 on final structure while both guards are active. Inserts are
  // allowed, but the old nullable values can only be filled by the known
  // pause/backfill/resume path.
  await db().query(`
    INSERT INTO public.offers (id, proposed_start_date)
      VALUES ('00000000-0000-4000-8000-000000000037', '2021-03-04');
    INSERT INTO public.hiring_contracts (id, offer_id, status, created_at)
      VALUES ('00000000-0000-4000-8000-000000000038',
              '00000000-0000-4000-8000-000000000037', 'terminated', '2021-03-01');
    ALTER TABLE public.talent_invoices ALTER COLUMN base_amount DROP NOT NULL;
    INSERT INTO public.talent_invoices
      (id, hiring_contract_id, offer_id, talent_id, client_id, billing_mode,
       period_start, period_end, currency, monthly_rate, amount, status,
       auto_send_at, payout_due_on, base_amount)
    VALUES
      ('00000000-0000-4000-8000-000000000039',
       '00000000-0000-4000-8000-000000000038',
       '00000000-0000-4000-8000-000000000037',
       'backfill-talent', 'backfill-client', 'tracked',
       '2021-03-01', '2021-03-31', 'USD', 125, 125, 'sent',
       '2021-04-01', '2021-04-15', NULL);
  `);
  await deleteLedgerEntry("0025");
  await applyMigration("0025", helper, sources);
  const replayBackfill = await db().query(`
    SELECT hc.effective_start_date, ti.base_amount,
      (SELECT tgenabled='O' FROM pg_trigger
        WHERE tgrelid='public.hiring_contracts'::regclass
          AND tgname='hiring_contract_billing_start_immutable') AS start_guard_enabled,
      (SELECT tgenabled='O' FROM pg_trigger
        WHERE tgrelid='public.talent_invoices'::regclass
          AND tgname='talent_invoices_sent_immutable') AS invoice_guard_enabled
    FROM public.hiring_contracts hc
    JOIN public.talent_invoices ti ON ti.hiring_contract_id=hc.id
    WHERE hc.id='00000000-0000-4000-8000-000000000038'
  `);
  assert(
    replayBackfill.rows[0]?.effective_start_date?.toISOString().slice(0, 10) === "2021-03-04" &&
      Number(replayBackfill.rows[0]?.base_amount) === 125 &&
      replayBackfill.rows[0]?.start_guard_enabled &&
      replayBackfill.rows[0]?.invoice_guard_enabled,
    "final enabled guards permit only the controlled nullable backfill and resume enabled",
  );
}

async function testCreditMemoDuplicatesAndFinancialGuards() {
  const ids = {
    offer: "00000000-0000-4000-8000-000000000041",
    contract: "00000000-0000-4000-8000-000000000042",
    period: "00000000-0000-4000-8000-000000000043",
    revision: "00000000-0000-4000-8000-000000000044",
    invoice: "00000000-0000-4000-8000-000000000045",
    memo1: "00000000-0000-4000-8000-000000000046",
    memo2: "00000000-0000-4000-8000-000000000047",
    statement: "00000000-0000-4000-8000-000000000048",
  };
  await db().query(`
    INSERT INTO public.users (id, role) VALUES
      ('finance-client', 'client'), ('finance-talent', 'talent');
    INSERT INTO public.offers (id, proposed_start_date)
      VALUES ('${ids.offer}', '2024-01-01');
    INSERT INTO public.hiring_contracts
      (id, offer_id, status, billing_mode, effective_start_date, billing_activated_at)
      VALUES ('${ids.contract}', '${ids.offer}', 'signed', 'tracked', '2024-01-01', now());
    INSERT INTO public.timesheet_periods
      (id, hiring_contract_id, period_start, period_end, work_timezone)
      VALUES ('${ids.period}', '${ids.contract}', '2024-01-01', '2024-01-31',
              'America/New_York');
    INSERT INTO public.timesheet_revisions
      (id, timesheet_period_id, version, decision_reason, work_timezone)
      VALUES ('${ids.revision}', '${ids.period}', 1, 'finance fixture',
              'America/New_York');
    INSERT INTO public.talent_invoices
      (id, hiring_contract_id, offer_id, talent_id, client_id, billing_mode,
       period_start, period_end, currency, monthly_rate, amount, base_amount,
       credit_amount, timesheet_revision_id, status, auto_send_at, payout_due_on)
    VALUES ('${ids.invoice}', '${ids.contract}', '${ids.offer}', 'finance-talent',
      'finance-client', 'tracked', '2024-01-01', '2024-01-31', 'USD',
      100, 100, 100, 0, '${ids.revision}', 'sent', '2024-02-01', '2024-02-15');
    INSERT INTO public.talent_credit_memos
      (id, original_invoice_id, corrected_revision_id, talent_id,
       hiring_contract_id, currency, amount)
    VALUES
      ('${ids.memo1}', '${ids.invoice}', '${ids.revision}', 'finance-talent',
       '${ids.contract}', 'USD', -10),
      ('${ids.memo2}', '${ids.invoice}', '${ids.revision}', 'finance-talent',
       '${ids.contract}', 'USD', -10);
    INSERT INTO public.client_monthly_invoices
      (id, client_id, invoice_month, currency, subtotal, status)
    VALUES ('${ids.statement}', 'finance-client', '2024-01-01', 'USD', 120, 'draft');
    INSERT INTO public.client_monthly_invoice_lines
      (client_monthly_invoice_id, talent_invoice_id, talent_amount,
       commission_rate, client_amount)
    VALUES ('${ids.statement}', '${ids.invoice}', 100, 0.2, 120);
    UPDATE public.client_monthly_invoices SET status='sent' WHERE id='${ids.statement}';
  `);

  const duplicates = await db().query(
    "SELECT count(*)::int AS count FROM public.talent_credit_memos WHERE original_invoice_id=$1 AND corrected_revision_id=$2",
    [ids.invoice, ids.revision],
  );
  assert(
    duplicates.rows[0].count === 2,
    "legitimate duplicate Talent credit-memo pairs coexist after obsolete uniqueness is removed",
  );

  await expectFailure(
    () =>
      db().query("UPDATE public.talent_invoices SET amount=amount+1 WHERE id=$1", [
        ids.invoice,
      ]),
    "sent Talent invoice amount mutation is rejected",
    /sent Talent invoices are immutable/i,
  );
  await expectFailure(
    () =>
      db().query("UPDATE public.talent_credit_memos SET amount=0 WHERE id=$1", [
        ids.memo1,
      ]),
    "Talent credit memo mutation is rejected",
    /Talent credit memos are immutable/i,
  );
  await expectFailure(
    () =>
      db().query("UPDATE public.client_monthly_invoices SET subtotal=0 WHERE id=$1", [
        ids.statement,
      ]),
    "sent Client monthly invoice mutation is rejected",
    /sent Client monthly invoices are immutable/i,
  );
  await expectFailure(
    () =>
      db().query(
        "UPDATE public.client_monthly_invoice_lines SET client_amount=0 WHERE client_monthly_invoice_id=$1",
        [ids.statement],
      ),
    "Client monthly invoice line mutation is rejected",
    /Client monthly invoice lines are immutable/i,
  );
}

async function testLegacyTerminationConflict(helper: string, sources: Map<string, string>) {
  await resetToBaseline();
  await applyThrough("0030", helper, sources);
  await db().query(`
    INSERT INTO public.users (id, role) VALUES
      ('termination-client', 'client'), ('termination-admin', 'admin');
    INSERT INTO public.offers (id) VALUES ('00000000-0000-4000-8000-000000000051');
    INSERT INTO public.hiring_contracts (id, offer_id, status)
      VALUES ('00000000-0000-4000-8000-000000000052',
              '00000000-0000-4000-8000-000000000051', 'terminated');
    INSERT INTO public.hiring_contract_termination_requests
      (id, hiring_contract_id, requester_id, requester_role,
       requested_effective_end_date, reason, status, decision_reason,
       decided_by, decided_at, approved_effective_end_date)
    VALUES ('00000000-0000-4000-8000-000000000053',
      '00000000-0000-4000-8000-000000000052', 'termination-client', 'client',
      '2024-05-01', 'canonical approval', 'approved', 'already adjudicated',
      'termination-admin', '2024-05-02', '2024-05-01');

    CREATE TABLE public.contract_termination_requests (
      id uuid PRIMARY KEY,
      hiring_contract_id uuid NOT NULL,
      requested_by varchar NOT NULL,
      effective_end_date date NOT NULL,
      reason text NOT NULL,
      status text NOT NULL,
      review_reason text,
      reviewed_by varchar,
      reviewed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO public.contract_termination_requests
      (id, hiring_contract_id, requested_by, effective_end_date, reason,
       status, review_reason, reviewed_by, reviewed_at)
    VALUES ('00000000-0000-4000-8000-000000000054',
      '00000000-0000-4000-8000-000000000052', 'termination-client',
      '2024-05-01', 'legacy approval', 'approved', 'legacy adjudication',
      'termination-admin', '2024-05-02');
  `);
  await expectFailure(
    () => applyMigration("0031", helper, sources),
    "conflicting legacy approved termination is rejected rather than discarded",
    /conflicts with canonical approvals/i,
  );
  await assertMigrationUnrecorded("0031");
  const beforeRepair = await db().query(`
    SELECT count(*)::int AS approvals FROM public.hiring_contract_termination_requests
    WHERE hiring_contract_id='00000000-0000-4000-8000-000000000052'
      AND status='approved'
  `);
  assert(
    beforeRepair.rows[0]?.approvals === 1,
    "failed legacy import preserves the pre-existing canonical approval",
  );
  await db().query(`
    UPDATE public.contract_termination_requests
       SET status='rejected'
     WHERE id='00000000-0000-4000-8000-000000000054'
  `);
  await applyMigration("0031", helper, sources);
  const result = await db().query(`
    SELECT count(*)::int AS approvals,
           bool_and(id='00000000-0000-4000-8000-000000000053') AS canonical_preserved,
           (SELECT count(*)::int FROM public.hiring_contract_termination_requests
             WHERE hiring_contract_id='00000000-0000-4000-8000-000000000052'
               AND status='rejected') AS rejected_imported
    FROM public.hiring_contract_termination_requests
    WHERE hiring_contract_id='00000000-0000-4000-8000-000000000052'
      AND status='approved'
  `);
  assert(
    result.rows[0]?.approvals === 1 &&
      result.rows[0]?.canonical_preserved &&
      result.rows[0]?.rejected_imported === 1,
    "corrected legacy import preserves canonical approval and resumes successfully",
  );
}

async function testOnlyMissingTerminationCheckIsNotValid(
  helper: string,
  sources: Map<string, string>,
) {
  await resetToBaseline();
  await applyThrough("0030", helper, sources);
  await db().query(`
    ALTER TABLE public.hiring_contracts
      DROP CONSTRAINT hiring_contracts_termination_snapshot_check;
    INSERT INTO public.hiring_contracts
      (id, status, effective_end_date)
    VALUES
      ('00000000-0000-4000-8000-000000000061', 'terminated', '2024-06-01')
  `);

  const before = await db().query(`
    SELECT
      (SELECT count(*)::int FROM pg_constraint
        WHERE conrelid='public.hiring_contracts'::regclass
          AND conname='hiring_contracts_termination_snapshot_check') AS matching_checks,
      (SELECT count(*)::int FROM public.hiring_contracts
        WHERE id='00000000-0000-4000-8000-000000000061'
          AND effective_end_date='2024-06-01'
          AND termination_reason IS NULL AND terminated_by IS NULL
          AND terminated_at IS NULL) AS historical_bad_rows
  `);
  assert(
    before.rows[0]?.matching_checks === 0 && before.rows[0]?.historical_bad_rows === 1,
    "NOT VALID regression starts with only the termination check missing",
  );

  await applyMigration("0031", helper, sources);
  const after = await db().query(`
    SELECT c.convalidated,
           EXISTS (SELECT 1 FROM public.hiring_contracts
             WHERE id='00000000-0000-4000-8000-000000000061'
               AND effective_end_date='2024-06-01'
               AND termination_reason IS NULL AND terminated_by IS NULL
               AND terminated_at IS NULL) AS legacy_row_preserved
    FROM pg_constraint c
    WHERE c.conrelid='public.hiring_contracts'::regclass
      AND c.conname='hiring_contracts_termination_snapshot_check'
  `);
  assert(
    after.rows[0]?.convalidated === false && after.rows[0]?.legacy_row_preserved,
    "missing check is restored NOT VALID without rejecting historical bad data",
  );

  await expectFailure(
    () =>
      db().query(`
        INSERT INTO public.hiring_contracts
          (id, status, effective_end_date)
        VALUES ('00000000-0000-4000-8000-000000000062',
                'terminated', '2024-06-02')
      `),
    "new invalid termination snapshots remain constrained by NOT VALID check",
    /hiring_contracts_termination_snapshot_check/i,
  );
  const rowCount = await db().query(
    "SELECT count(*)::int AS count FROM public.hiring_contracts WHERE id='00000000-0000-4000-8000-000000000062'",
  );
  assert(rowCount.rows[0].count === 0, "rejected new row is not persisted");
}

async function main() {
  const { helper, sources } = await migrationSources();
  await startPrivateCluster();
  try {
    await testCleanAndMatchingFinal(helper, sources);
    await testPartialAndColumnDrift(helper, sources);
    await testSafePartialObjectCompletion(helper, sources);
    await testPayoutForeignKeyReconciliation(helper, sources);
    await testWrongIndexPredicate(helper, sources);
    await testWrongAndDisabledTrigger(helper, sources);
    await testUnexpectedFunctionBodyAndProperties(helper, sources);
    await testTimezoneBackfillRollback(helper, sources);
    await testPausedTriggerRollbackDuringBackfill(helper, sources);
    await testReportedPrecreatedTimesheetState(helper, sources);
    await testFullPrecreatedPublishState(helper, sources);
    await testBillingBackfillAndFinalGuards(helper, sources);
    await testCreditMemoDuplicatesAndFinancialGuards();
    await testLegacyTerminationConflict(helper, sources);
    await testOnlyMissingTerminationCheckIsNotValid(helper, sources);
    console.log(`Migration reconciliation harness: ${assertions} checks passed.`);
  } finally {
    await stopPrivateCluster();
  }
}

main().catch(async (error) => {
  console.error("Migration reconciliation verification failed:", error);
  try {
    await stopPrivateCluster();
  } catch (cleanupError) {
    console.error("Private cluster cleanup also failed:", cleanupError);
  }
  process.exitCode = 1;
});