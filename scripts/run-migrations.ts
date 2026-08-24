import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const migrationId = "0010_remove_legacy_freelance_tables";
const migrationPath = path.resolve(
  process.cwd(),
  "migrations",
  `${migrationId}.sql`,
);

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run application migrations");
  }

  const migrationSql = await readFile(migrationPath, "utf8");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [migrationId],
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_schema_migrations (
        id         text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const alreadyApplied = await client.query(
      "SELECT 1 FROM app_schema_migrations WHERE id = $1",
      [migrationId],
    );
    if (alreadyApplied.rowCount) {
      await client.query("COMMIT");
      console.log(`⏭️  Migration ${migrationId} already applied`);
      return;
    }

    await client.query(migrationSql);
    await client.query(
      "INSERT INTO app_schema_migrations (id) VALUES ($1)",
      [migrationId],
    );
    await client.query("COMMIT");
    console.log(`✅ Migration ${migrationId} applied`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((error) => {
  console.error(`❌ Migration ${migrationId} failed:`, error);
  process.exitCode = 1;
});