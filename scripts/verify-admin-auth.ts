/**
 * verify-admin-auth.ts
 *
 * Regression guard: every /api/admin/jobs endpoint must return 401 for
 * unauthenticated requests.  A 200 means auth middleware was silently
 * removed (e.g. by a stale-snapshot task merge).
 *
 * Run: npx tsx scripts/verify-admin-auth.ts
 * Requires the dev server to be running on localhost:5000.
 */

const BASE = "http://localhost:5000";

const PROBES: { method: string; path: string }[] = [
  { method: "GET",    path: "/api/admin/jobs" },
  { method: "GET",    path: "/api/admin/jobs/options" },
  { method: "GET",    path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000" },
  { method: "POST",   path: "/api/admin/jobs" },
  { method: "PATCH",  path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000" },
  { method: "PATCH",  path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/status" },
  { method: "POST",   path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/refresh" },
  { method: "DELETE", path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000" },
  { method: "POST",   path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/approve" },
  { method: "POST",   path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/reject" },
  { method: "POST",   path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/link" },
  { method: "POST",   path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/pending" },
];

async function run() {
  let failures = 0;

  for (const { method, path } of PROBES) {
    const url = `${BASE}${path}`;
    let status: number;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: ["POST", "PATCH"].includes(method) ? "{}" : undefined,
      });
      status = res.status;
    } catch (err: any) {
      console.error(`  ✗ ${method} ${path}  →  NETWORK ERROR: ${err.message}`);
      failures++;
      continue;
    }

    const ok = status === 401 || status === 403;
    const icon = ok ? "✓" : "✗ FAIL";
    console.log(`  ${icon}  ${method.padEnd(6)} ${path.padEnd(60)} → ${status}`);
    if (!ok) failures++;
  }

  console.log("");
  if (failures === 0) {
    console.log("✅  All admin job endpoints correctly reject unauthenticated requests.");
    process.exit(0);
  } else {
    console.error(`❌  ${failures} endpoint(s) did NOT return 401/403 — auth middleware missing or bypassed.`);
    process.exit(1);
  }
}

run();
