/**
 * Performance-test seed script — Phase 13
 *
 * SAFETY: Requires NODE_ENV=development or TEST_SEED=true.
 * NEVER runs automatically. Run manually only in dev/staging.
 *
 * Usage:
 *   TEST_SEED=true npx tsx scripts/seed-perf-test.ts
 *
 * Cleanup:
 *   TEST_SEED=true npx tsx scripts/seed-perf-test.ts --cleanup
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

neonConfig.webSocketConstructor = ws;

const SEED_DOMAIN = "perf-seed.onspot.test";
const BATCH_SIZE = 100;
const TALENT_COUNT = parseInt(process.env.SEED_TALENT_COUNT || "500", 10);
const CLIENT_COUNT = parseInt(process.env.SEED_CLIENT_COUNT || "100", 10);
const JOB_COUNT = parseInt(process.env.SEED_JOB_COUNT || "200", 10);

const CATEGORIES = [
  "Customer Support",
  "Virtual Assistant",
  "Technical Support",
  "Sales & Marketing",
  "Finance & Accounting",
  "Data Entry",
  "Software Development",
  "Graphic Design",
  "Content Writing",
  "Human Resources",
];
const LOCATIONS = ["Philippines", "Remote", "Asia", "Global"];
const EXPERIENCE_LEVELS = ["entry", "intermediate", "expert"];
const STATUS = ["open", "in_progress", "completed"];
const AVAILABILITY = ["available", "busy", "offline"];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function main() {
  const isCleanup = process.argv.includes("--cleanup");

  if (process.env.NODE_ENV === "production" && process.env.TEST_SEED !== "true") {
    console.error("❌ Refusing to seed in production. Set TEST_SEED=true to override (dangerous).");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL not set.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool });

  if (isCleanup) {
    console.log(`🧹 Cleaning up seed data (domain: ${SEED_DOMAIN})…`);
    await pool.query(`DELETE FROM candidates WHERE email LIKE '%@${SEED_DOMAIN}'`);
    await pool.query(`DELETE FROM jobs WHERE company = $1`, [`seed-${SEED_DOMAIN}`]);
    await pool.query(
      `DELETE FROM users WHERE email LIKE '%@${SEED_DOMAIN}'`,
    );
    console.log("✅ Cleanup complete.");
    await pool.end();
    return;
  }

  const runId = uid();
  console.log(`🌱 Seeding perf-test data — runId: ${runId}`);
  console.log(`  Talent: ${TALENT_COUNT}, Clients: ${CLIENT_COUNT}, Jobs: ${JOB_COUNT}`);

  // ── Talent candidates (no users table required) ──────────────────────────
  console.log("Inserting talent candidates…");
  let inserted = 0;
  while (inserted < TALENT_COUNT) {
    const batch = Math.min(BATCH_SIZE, TALENT_COUNT - inserted);
    const values: string[] = [];
    const params: any[] = [];
    let pi = 1;
    for (let i = 0; i < batch; i++) {
      const n = inserted + i;
      const email = `talent-${runId}-${n}@${SEED_DOMAIN}`;
      const cat = rand(CATEGORIES);
      const loc = rand(LOCATIONS);
      const avail = rand(AVAILABILITY);
      values.push(`($${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++})`);
      params.push(
        `Talent ${n}`,
        email,
        `Engineer ${n}`,
        cat,
        loc,
        avail,
        true,
      );
    }
    await pool.query(
      `INSERT INTO candidates (full_name, email, target_position, category, location, availability, profile_completed)
       VALUES ${values.join(",")}
       ON CONFLICT DO NOTHING`,
      params,
    );
    inserted += batch;
    process.stdout.write(`\r  Talent: ${inserted}/${TALENT_COUNT}`);
  }
  console.log("\n  ✅ Talent inserted");

  // ── Client users ──────────────────────────────────────────────────────────
  console.log("Inserting client users…");
  const clientIds: string[] = [];
  inserted = 0;
  while (inserted < CLIENT_COUNT) {
    const batch = Math.min(BATCH_SIZE, CLIENT_COUNT - inserted);
    const values: string[] = [];
    const params: any[] = [];
    let pi = 1;
    for (let i = 0; i < batch; i++) {
      const n = inserted + i;
      const id = `seed-${runId}-c${n}`;
      const email = `client-${runId}-${n}@${SEED_DOMAIN}`;
      values.push(`($${pi++},$${pi++},$${pi++},$${pi++},$${pi++})`);
      params.push(id, email, `SeedClient${n}`, `SeedClient${n}`, "client");
      clientIds.push(id);
    }
    await pool.query(
      `INSERT INTO users (id, email, username, company, role)
       VALUES ${values.join(",")}
       ON CONFLICT DO NOTHING`,
      params,
    );
    inserted += batch;
    process.stdout.write(`\r  Clients: ${inserted}/${CLIENT_COUNT}`);
  }
  console.log("\n  ✅ Clients inserted");

  // ── Jobs ─────────────────────────────────────────────────────────────────
  if (clientIds.length > 0) {
    console.log("Inserting jobs…");
    inserted = 0;
    while (inserted < JOB_COUNT) {
      const batch = Math.min(BATCH_SIZE, JOB_COUNT - inserted);
      const values: string[] = [];
      const params: any[] = [];
      let pi = 1;
      for (let i = 0; i < batch; i++) {
        const n = inserted + i;
        const clientId = clientIds[n % clientIds.length];
        const cat = rand(CATEGORIES);
        const exp = rand(EXPERIENCE_LEVELS);
        const st = rand(STATUS);
        values.push(`($${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++})`);
        params.push(
          clientId,
          `Seed Job ${n}`,
          `This is a performance-test job created by seed run ${runId}.`,
          cat,
          "hourly",
          exp,
          st,
          `seed-${SEED_DOMAIN}`,
        );
      }
      await pool.query(
        `INSERT INTO jobs (client_id, title, description, category, contract_type, experience_level, status, company)
         VALUES ${values.join(",")}`,
        params,
      );
      inserted += batch;
      process.stdout.write(`\r  Jobs: ${inserted}/${JOB_COUNT}`);
    }
    console.log("\n  ✅ Jobs inserted");
  }

  console.log(`\n🎉 Seed complete — runId: ${runId}`);
  console.log(`   Cleanup: TEST_SEED=true npx tsx scripts/seed-perf-test.ts --cleanup`);
  await pool.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
