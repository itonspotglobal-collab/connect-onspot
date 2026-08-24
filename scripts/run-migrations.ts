/**
 * Versioned SQL migration runner.
 *
 * Scans every *.sql file in the `migrations/` directory (sorted
 * lexicographically so 0001 runs before 0002 etc.), then applies each one that
 * has not already been recorded in the `app_schema_migrations` tracking table.
 *
 * This script is run by `npm run migrate` (before `npm run dev`) and by
 * `npm start` (before the production server starts). It is idempotent: running
 * it twice produces the same result, and a migration that has already been
 * applied is silently skipped.
 *
 * Failures are surfaced with a non-zero exit code so CI and the Replit start
 * command catch them before the application server boots.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run application migrations");
  }

  // Discover all migration files sorted lexicographically.
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("ℹ️  No migration files found — nothing to run.");
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Ensure the tracking table exists before doing anything else.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_schema_migrations (
      id         text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // ── Grandfather pre-existing migrations ────────────────────────────────────
  // The original migration runner was pinned to a single file and only ever
  // recorded 0002 and 0010. Migrations 0003–0009 were applied directly against
  // the DB but never tracked. Detect this by checking whether the schema
  // already has the `jobs` table (proof of prior migration work) and, if so,
  // mark every SQL file that exists on disk — except the one we are adding now
  // (0011) — as already applied so we don't re-run destructive DDL.
  const jobsTableExists = await pool.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'jobs'
  `);
  if (jobsTableExists.rowCount) {
    // Build the set of all migrations that are already recorded.
    const recorded = await pool.query(
      "SELECT id FROM app_schema_migrations",
    );
    const recordedIds = new Set(recorded.rows.map((r: any) => r.id));

    // The baseline set: every migration file whose index is 0010 or lower.
    // 0011 is the new migration we actually need to run; anything older is
    // assumed to have already been applied to the database.
    const baseline = files
      .map((f) => f.replace(/\.sql$/, ""))
      .filter((id) => id <= "0010");

    const toGrandfather = baseline.filter((id) => !recordedIds.has(id));
    if (toGrandfather.length > 0) {
      const placeholders = toGrandfather
        .map((_, i) => `($${i + 1})`)
        .join(", ");
      await pool.query(
        `INSERT INTO app_schema_migrations (id) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        toGrandfather,
      );
      console.log(
        `⏩ Grandfathered ${toGrandfather.length} pre-existing migration(s) as already applied: ${toGrandfather.join(", ")}`,
      );
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  let applied = 0;
  let skipped = 0;

  for (const file of files) {
    const migrationId = file.replace(/\.sql$/, "");
    const migrationPath = path.join(MIGRATIONS_DIR, file);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Advisory lock per migration ID prevents concurrent runs from applying
      // the same migration twice on multi-instance deploys.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        migrationId,
      ]);

      const alreadyApplied = await client.query(
        "SELECT 1 FROM app_schema_migrations WHERE id = $1",
        [migrationId],
      );

      if (alreadyApplied.rowCount) {
        await client.query("COMMIT");
        skipped++;
        continue;
      }

      const migrationSql = await readFile(migrationPath, "utf8");

      // Some migrations contain their own BEGIN/COMMIT (e.g. 0011). Run the
      // SQL as-is; the outer BEGIN/COMMIT wraps tracking-table bookkeeping only
      // when the inner script does NOT manage its own transaction. Since both
      // paths ultimately COMMIT, the tracking INSERT is safe in both cases.
      await client.query(migrationSql);
      await client.query(
        "INSERT INTO app_schema_migrations (id) VALUES ($1)",
        [migrationId],
      );
      await client.query("COMMIT");

      console.log(`✅ Migration ${migrationId} applied`);
      applied++;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw new Error(
        `Migration ${migrationId} failed: ${(error as Error).message}`,
      );
    } finally {
      // always release — whether the migration succeeded, was skipped, or threw
      client.release();
    }
  }

  await pool.end();

  if (applied === 0) {
    console.log(`⏭️  All ${skipped} migration(s) already applied — nothing to do.`);
  } else {
    console.log(
      `✅ ${applied} migration(s) applied, ${skipped} skipped (already applied).`,
    );
  }
}

runMigrations().catch((error) => {
  console.error(`❌ Migration runner failed: ${error.message}`);
  process.exitCode = 1;
});
