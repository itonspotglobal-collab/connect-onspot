import { Pool } from "pg";
import { signupVerificationPreflight } from "../server/lib/signupVerificationPreflight";

// Deliberately NOT DATABASE_URL. This task does not authorize production access.
const target = process.env.SIGNUP_VERIFICATION_TEST_DATABASE_URL;
if (!target) throw new Error("An explicitly approved SIGNUP_VERIFICATION_TEST_DATABASE_URL is required.");
const url = new URL(target);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  || !url.pathname.startsWith("/signup_verification_test")) {
  throw new Error("This preflight entry point only accepts a disposable loopback signup_verification_test database.");
}
const pool = new Pool({ connectionString: target });
const client = await pool.connect();
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  console.log(JSON.stringify(await signupVerificationPreflight((sql, values) => client.query(sql, values)), null, 2));
  await client.query("ROLLBACK");
} finally { client.release(); await pool.end(); }