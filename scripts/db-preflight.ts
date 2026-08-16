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
 * NEON MISMATCH GUARD (neonPreflight):
 *   Call when you are about to use NEON_DATABASE_URL to verify production state.
 *   It confirms the Neon connection is actually the production database by
 *   checking the NEON_DB_LABEL env var, which must be set to "production" in
 *   the production Replit environment (Secrets → NEON_DB_LABEL = production).
 *   Without this label, dev's NEON_DATABASE_URL silently points at a different
 *   (possibly empty) Neon project, producing false "0 records" conclusions.
 *
 *   await neonPreflight();         // warns if NEON_DB_LABEL ≠ "production"
 *   await neonPreflight(true);     // throws if NEON_DB_LABEL ≠ "production"
 *
 * IMPORTANT: scripts should always use DATABASE_URL (the server's DB).
 * NEON_DATABASE_URL is the production Neon connection — only use it when you
 * explicitly intend to target the cloud/prod database, AND after neonPreflight()
 * confirms NEON_DB_LABEL === "production".
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

/**
 * neonPreflight — verify NEON_DATABASE_URL is the real production database
 * before running any query against it.
 *
 * Requires NEON_DB_LABEL="production" to be set in the production environment.
 * Set it once in Replit Secrets on the production deployment; never set it in
 * local dev. This makes the dev→prod boundary impossible to cross silently.
 *
 * @param strict  When true, throws if the label is missing or wrong.
 *                When false (default), logs a loud warning and continues.
 */
export function neonPreflight(strict = false): void {
  const neonUrl   = process.env.NEON_DATABASE_URL;
  const neonLabel = process.env.NEON_DB_LABEL ?? "";

  if (!neonUrl) {
    const msg = "[neon-preflight] ❌ NEON_DATABASE_URL is not set.";
    if (strict) throw new Error(msg);
    console.warn(msg);
    return;
  }

  const { host } = detectTier(neonUrl);
  const isProduction = neonLabel.toLowerCase() === "production";

  if (!isProduction) {
    const msg =
      `[neon-preflight] ⚠️  NEON_DB_LABEL="${neonLabel || "(unset)"}" — ` +
      `NEON_DATABASE_URL (${host}) is NOT confirmed as the production database.\n` +
      `  If this IS production: set NEON_DB_LABEL=production in Replit Secrets (production env).\n` +
      `  If this is a staging/test Neon: your query results do NOT reflect production state.\n` +
      `  Continuing would risk FALSE conclusions (e.g. "0 candidates" when prod has real data).`;
    if (strict) throw new Error(msg);
    console.warn(msg);
  } else {
    console.log(`[neon-preflight] ✅ NEON_DATABASE_URL → ${host} [PRODUCTION CONFIRMED]`);
  }
}
