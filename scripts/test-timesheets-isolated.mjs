import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import pg from "pg";

// Never inherit application credentials into fixture workers or PostgreSQL.
const env = Object.fromEntries(["PATH", "HOME", "LANG", "TZ", "TMPDIR", "LD_LIBRARY_PATH", "NODE_PATH",
  "PLAYWRIGHT_BROWSERS_PATH", "PLAYWRIGHT_EXECUTABLE_PATH"]
  .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
if (!env.PLAYWRIGHT_EXECUTABLE_PATH) {
  try {
    env.PLAYWRIGHT_EXECUTABLE_PATH = execFileSync("which", ["chromium"], { env, encoding: "utf8" }).trim();
  } catch { /* Use Playwright's own installed browser when no host wrapper exists. */ }
}
function run(command, args, commandEnv = env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: commandEnv, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}
const socket = createServer();
await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const root = await mkdtemp(join(tmpdir(), "onspot-timesheet-pg-"));
const data = join(root, "data");
let postgres;
try {
  await run("initdb", ["-D", data, "-U", "timesheet_fixture", "-A", "trust", "--no-locale"]);
  postgres = spawn("postgres", ["-D", data, "-h", "127.0.0.1", "-p", String(port), "-k", root],
    { env, stdio: ["ignore", "ignore", "inherit"] });
  const adminUrl = `postgresql://timesheet_fixture@127.0.0.1:${port}/postgres`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const client = new pg.Client({ connectionString: adminUrl });
    try {
      await client.connect();
      await client.query("CREATE DATABASE onspot_timesheet_fixture");
      ready = true; break;
    } catch {
      if (postgres.exitCode !== null) throw new Error("Owned PostgreSQL fixture exited before startup");
      await new Promise((resolve) => setTimeout(resolve, 100));
    } finally { await client.end().catch(() => {}); }
  }
  if (!ready) throw new Error("Owned PostgreSQL fixture failed to start");
  const url = `postgresql://timesheet_fixture@127.0.0.1:${port}/onspot_timesheet_fixture`;
  const workerEnv = {
    ...env, DATABASE_URL: url, TIMESHEET_TEST_DATABASE_URL: url,
    JWT_SECRET: "timesheet-fixture-only", DISABLE_AUTH: "false",
  };
  // Optional broader verification reuses the same owned database and credential
  // isolation. Never point these finance integration tests at application data.
  if (process.argv.includes("--mvp")) {
    const schemaDir = join(root, "fresh-schema");
    await run(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "generate",
      "--dialect", "postgresql", "--schema", "./shared/schema.ts", "--out", schemaDir], workerEnv);
    const client = new pg.Client({ connectionString: url });
    try {
      await client.connect();
      await client.query("BEGIN");
      // pg_temp helpers need a temporary namespace on this same connection.
      await client.query("CREATE TEMP TABLE fixture_session_bootstrap (id integer)");
      // Reuse the real reconciliation helpers, on this same owned connection,
      // before migrations that call their session-local pg_temp functions.
      await client.query(await readFile("scripts/migration-reconciliation.sql", "utf8"));
      for (const file of (await readdir(schemaDir)).filter((name) => name.endsWith(".sql")).sort()) {
        await client.query(await readFile(join(schemaDir, file), "utf8"));
      }
      // Current Drizzle tables omit SQL-only financial guards. Install the
      // finance/clock migrations, not retired pre-finance transformations that
      // reference columns deliberately removed from the current schema.
      for (const file of (await readdir("migrations"))
        .filter((name) => /^\d+.*\.sql$/.test(name) && Number(name.slice(0, 4)) >= 18).sort()) {
        await client.query(await readFile(join("migrations", file), "utf8"));
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { await client.end(); }
    await run(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1",
      "server/tests/talent-invoicing.integration.test.ts",
      "server/tests/talent-invoice-calculations.test.ts",
      "server/tests/talent-invoices-usd-guard.test.ts",
      "server/tests/contract-termination-usd-errors.test.ts"], workerEnv);
  }
  await run(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1",
    "server/tests/timesheets.test.ts", "server/tests/organization-timesheets.test.ts",
    "server/tests/clock-live.test.ts", "server/tests/client-team-dashboard.test.ts",
    "browser-tests/clock-live.browser.test.ts"], workerEnv);
} finally {
  if (postgres && postgres.exitCode === null) {
    const exited = new Promise((resolve) => postgres.once("exit", resolve));
    postgres.kill("SIGTERM");
    await exited;
  }
  await rm(root, { recursive: true, force: true });
}
