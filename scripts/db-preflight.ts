/**
 * db-preflight.ts
 *
 * Call at the top of any migration or admin script before touching the DB.
 * Prints which database DATABASE_URL points to so the target is unambiguous
 * in script output, and optionally asserts the expected tier so a script
 * written for local dev fails loudly instead of silently hitting production.
 *
 * Usage (no assertion):
 *   import { dbPreflight } from "../scripts/db-preflight";
 *   await dbPreflight();           // prints and continues
 *
 * Usage (with assertion):
 *   await dbPreflight("local");    // throws if DATABASE_URL is not local dev
 *   await dbPreflight("cloud");    // throws if DATABASE_URL is not Neon cloud
 *
 * IMPORTANT: scripts should always use DATABASE_URL (the server's DB).
 * NEON_DATABASE_URL is DEPRECATED and should be removed from all environments.
 * Investigation confirmed it pointed to a separate staging Neon project
 * (ep-royal-meadow, 0 candidates), not the real production database.
 * The real production DB is DATABASE_URL in the production environment.
 * See .agents/memory/db-two-databases.md for the full history.
 */

type Tier = "local" | "cloud";

function detectTier(dbUrl: string): { host: string; tier: Tier | "unknown" } {
  let host = "(unknown)";
  try {
    const u = new URL(dbUrl);
    host = `${u.hostname}${u.pathname}`;
  } catch {
    const m = dbUrl.match(/@([^/?]+)/);
    if (m) host = m[1];
  }

  const tier: Tier | "unknown" =
    /neon\.tech|neondb/.test(host) ? "cloud" :
    /helium|localhost|127\.0\.0\.1/.test(host) ? "local" :
    "unknown";

  return { host, tier };
}

export async function dbPreflight(expected?: Tier): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL is not set. Scripts must use DATABASE_URL (the server's DB), " +
      "not NEON_DATABASE_URL (the production Neon DB)."
    );
  }

  const { host, tier } = detectTier(dbUrl);
  const tierLabel =
    tier === "cloud" ? "NEON CLOUD" :
    tier === "local" ? "LOCAL DEV" :
    "UNKNOWN — double-check before proceeding";

  console.log(`[db-preflight] DATABASE_URL → ${host} [${tierLabel}]`);

  if (expected && tier !== expected) {
    throw new Error(
      `[db-preflight] Expected ${expected.toUpperCase()} DB but DATABASE_URL points to ${tierLabel}. ` +
      `If you meant to target production, use NEON_DATABASE_URL explicitly and confirm you intend that.`
    );
  }
}

