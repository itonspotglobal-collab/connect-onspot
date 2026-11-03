import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import pg from "pg";

// Explicitly owned local PostgreSQL; no inherited application credentials.
const env = Object.fromEntries(["PATH", "HOME", "LANG", "TZ", "TMPDIR", "LD_LIBRARY_PATH", "NODE_PATH",
  "PLAYWRIGHT_BROWSERS_PATH", "PLAYWRIGHT_EXECUTABLE_PATH"]
  .filter(key => process.env[key]).map(key => [key, process.env[key]]));
function run(command, args, vars = env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: vars, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Fixture command exited ${code}`)));
  });
}
const socket = createServer();
await new Promise(resolve => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const root = await mkdtemp(join(tmpdir(), "onspot-password-reset-pg-"));
const data = join(root, "data");
let postgres;
try {
  await run("initdb", ["-D", data, "-U", "password_reset_fixture", "-A", "trust", "--no-locale"]);
  postgres = spawn("postgres", ["-D", data, "-h", "127.0.0.1", "-p", String(port), "-k", root], {
    env, stdio: ["ignore", "ignore", "inherit"],
  });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const client = new pg.Client({ connectionString: `postgresql://password_reset_fixture@127.0.0.1:${port}/postgres` });
    try {
      await client.connect();
      await client.query("CREATE DATABASE signup_verification_test");
      ready = true; break;
    } catch {
      if (postgres.exitCode !== null) throw new Error("Fixture PostgreSQL exited");
      await new Promise(resolve => setTimeout(resolve, 100));
    } finally { await client.end().catch(() => {}); }
  }
  if (!ready) throw new Error("Fixture PostgreSQL did not become ready");
  const url = `postgresql://password_reset_fixture@127.0.0.1:${port}/signup_verification_test`;
  await run(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1",
    "server/tests/password-reset.test.ts", "server/tests/signup-email-verification.test.ts"], {
    ...env, DATABASE_URL: url, PASSWORD_RESET_TEST_DATABASE_URL: url, SIGNUP_VERIFICATION_TEST_DATABASE_URL: url,
    JWT_SECRET: "password-reset-fixture-only", DISABLE_AUTH: "false",
  });
} finally {
  if (postgres && postgres.exitCode === null) {
    postgres.kill("SIGTERM");
    await new Promise(resolve => postgres.once("exit", resolve));
  }
  await rm(root, { recursive: true, force: true });
}
