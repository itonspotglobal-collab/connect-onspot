import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { drizzle } from "drizzle-orm/pg-proxy";
import { and, desc, eq, getTableColumns, sql as sqlOp } from "drizzle-orm";
import { notifications, jobSubmissions, jobs } from "../../shared/schema";

// Exercise the actual storage method/query without importing storage's startup
// services. SQL here uses portable LEFT JOIN/ORDER BY/LIMIT constructs; SQLite
// is only a disposable relational fixture, not a PostgreSQL migration test.
const source = readFileSync(new URL("../storage.ts", import.meta.url), "utf8");
const listBody = [...source.matchAll(
  /async listNotificationsByUser\(userId: string, unreadOnly\?: boolean\): Promise<Notification\[\]> \{([\s\S]*?)\n  \}/g,
)].at(-1)![1];
const pageBlock = source.slice(source.indexOf("// Only featured jobs are pinned."))
  .match(/const items = await db[\s\S]*?\.offset\(offset\);/)![0];

function fixture(table: any, seed: Record<string, unknown>[]) {
  const columns = Object.values(getTableColumns(table)).map((column: any) => column.name);
  return { columns, rows: seed };
}
function database(tables: Record<string, ReturnType<typeof fixture>>) {
  return drizzle(async (sql, params) => {
    const result = spawnSync("python", ["-c", `
import json,sqlite3,sys
x=json.load(sys.stdin);db=sqlite3.connect(":memory:")
for name,t in x["tables"].items():
 db.execute('CREATE TABLE "'+name+'" ('+','.join('"'+c+'"' for c in t["columns"])+')')
 for r in t["rows"]:
  keys=list(r)
  db.execute('INSERT INTO "'+name+'" ('+','.join('"'+k+'"' for k in keys)+') VALUES ('+','.join('?' for k in keys)+')',list(r.values()))
print(json.dumps(db.execute(x["sql"],x["params"]).fetchall()))
`], { input: JSON.stringify({ tables, sql, params }), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return { rows: JSON.parse(result.stdout) };
  });
}
test("historical submission alerts resolve only job ID, retain recipient/unread filtering and tolerate deleted jobs", async () => {
  const row = (id: string, user: string, relation: string, related: string, read = false) => ({
    id, user_id: user, type: "job_application_status_changed", title: "Historic alert",
    message: "Fixture", related_type: relation, related_id: related,
    is_read: read, created_at: "2026-01-01T00:00:00Z",
  });
  const db = database({
    notifications: fixture(notifications, [
      row("old-shortlist", "talent-a", "job_submission", "submission-1"),
      row("old-interview", "talent-a", "job_submission", "submission-2", true),
      row("deleted", "talent-a", "job_submission", "deleted-submission"),
      row("unrelated-type", "talent-a", "job", "submission-1"),
      row("other-recipient", "talent-b", "job_submission", "submission-2"),
    ]),
    job_submissions: { columns: ["id", "job_id"], rows: [
      { id: "submission-1", job_id: "job-1" }, { id: "submission-2", job_id: "job-2" },
    ] },
  });
  const list = new Function("db", "getTableColumns", "notificationsTable", "jobSubmissionsTable",
    "and", "eq", "desc", `return async function(userId, unreadOnly) { ${listBody} }`)
    (db, getTableColumns, notifications, jobSubmissions, and, eq, desc);
  const all = await list("talent-a", false);
  assert.equal(all.length, 4);
  assert.equal(all.find((n: any) => n.id === "old-shortlist").relatedJobId, "job-1");
  assert.equal(all.find((n: any) => n.id === "old-interview").relatedJobId, "job-2");
  assert.equal(all.find((n: any) => n.id === "deleted").relatedJobId, null);
  assert.equal(all.find((n: any) => n.id === "unrelated-type").relatedJobId, null);
  assert.ok(!all.some((n: any) => n.id === "other-recipient"));
  assert.equal((await list("talent-a", true)).length, 3);
});
test("featured-first/posted-date/ID ordering is applied before pagination, with no urgent boost", async () => {
  const seed = [
    { id: "urgent-old", is_featured: false, urgently_hiring: true, posted_at: "2026-01-01", created_at: "2026-04-01" },
    { id: "featured", is_featured: true, urgently_hiring: false, posted_at: "2025-01-01", created_at: "2025-01-01" },
    { id: "new", is_featured: false, urgently_hiring: false, posted_at: "2026-03-01", created_at: "2025-01-01" },
    { id: "z", is_featured: false, posted_at: null, created_at: "2026-02-01" },
    { id: "a", is_featured: false, posted_at: "2026-02-01", created_at: "2025-01-01" },
  ];
  const db = database({ jobs: fixture(jobs, seed) });
  const page = new Function("db", "desc", "sqlOp", "jobsTable", "whereClause", "pageSize", "offset",
    `return (async () => { ${pageBlock} return items; })();`);
  const first = await page(db, desc, sqlOp, jobs, sqlOp`true`, 2, 0);
  const second = await page(db, desc, sqlOp, jobs, sqlOp`true`, 2, 2);
  const third = await page(db, desc, sqlOp, jobs, sqlOp`true`, 2, 4);
  assert.deepEqual([...first, ...second, ...third].map(j => j.id), ["featured", "new", "z", "a", "urgent-old"]);
});
