/**
 * scripts/backfill-acl-owners.ts
 *
 * One-time script to fix broken (owner-less) ACL metadata on private objects
 * uploaded via the three call sites that were missing the `owner` field.
 *
 * For each affected job_submission:
 *   • If the candidate has a user_id  → backfill owner on the stored object
 *   • If no candidate / no user_id    → delete the orphaned storage object
 *                                        and null the URL column
 *
 * All actions are logged with outcome. Run once; safe to re-run (idempotent
 * for backfill rows — setObjectAclPolicy is a metadata overwrite).
 *
 * Usage:
 *   npx tsx scripts/backfill-acl-owners.ts
 */

import { query } from "../server/db";
import { objectStorageClient } from "../server/objectStorage";
import { setObjectAclPolicy } from "../server/objectAcl";

// ── helpers ──────────────────────────────────────────────────────────────────

function parseObjectUrl(url: string): { bucketName: string; objectName: string } | null {
  // URL format: /objects/<prefix>/<uuid>
  // PRIVATE_OBJECT_DIR format: /<bucketName>[/<prefix>]
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!privateObjectDir) {
    throw new Error("PRIVATE_OBJECT_DIR env var not set — cannot resolve storage path");
  }

  // Strip leading /objects/ from the URL to get the relative object path
  // e.g. "/objects/application-resumes/abc" → "application-resumes/abc"
  const relPath = url.replace(/^\/objects\//, "");

  // The full storage path is PRIVATE_OBJECT_DIR + "/" + relPath
  const fullPath = `${privateObjectDir}/${relPath}`.replace(/\/+/g, "/");

  // fullPath is like "/bucketName/rest/of/path" or "bucketName/rest/of/path"
  const parts = fullPath.split("/").filter((p) => p.length > 0);
  if (parts.length < 2) {
    return null;
  }
  return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
}

async function backfillOwner(url: string, ownerId: string): Promise<"patched" | "object-not-found" | "error"> {
  try {
    const parsed = parseObjectUrl(url);
    if (!parsed) return "error";
    const bucket = objectStorageClient.bucket(parsed.bucketName);
    const file = bucket.file(parsed.objectName);
    const [exists] = await file.exists();
    if (!exists) return "object-not-found";
    await setObjectAclPolicy(file, { visibility: "private", owner: ownerId });
    return "patched";
  } catch (err: any) {
    console.error(`  ⚠️  backfillOwner error for ${url}:`, err.message);
    return "error";
  }
}

async function deleteOrphanedObject(url: string): Promise<"deleted" | "object-not-found" | "error"> {
  try {
    const parsed = parseObjectUrl(url);
    if (!parsed) return "error";
    const bucket = objectStorageClient.bucket(parsed.bucketName);
    const file = bucket.file(parsed.objectName);
    const [exists] = await file.exists();
    if (!exists) return "object-not-found";
    await file.delete();
    return "deleted";
  } catch (err: any) {
    console.error(`  ⚠️  deleteOrphanedObject error for ${url}:`, err.message);
    return "error";
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== backfill-acl-owners ===\n");

  // Find all job_submissions with application-resumes or application-videos URLs
  const subs = await query(`
    SELECT
      js.id            AS submission_id,
      js.resume_url,
      js.video_introduction_url,
      js.email,
      c.user_id        AS candidate_user_id
    FROM job_submissions js
    LEFT JOIN candidates c
      ON LOWER(c.email) = LOWER(js.email)
     AND c.user_id IS NOT NULL
    WHERE js.resume_url            LIKE '/objects/application-resumes/%'
       OR js.video_introduction_url LIKE '/objects/application-videos/%'
    ORDER BY js.created_at DESC
  `);

  console.log(`Found ${subs.rows.length} affected submission(s).\n`);

  let patchCount = 0;
  let deleteCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (const row of subs.rows) {
    const {
      submission_id,
      resume_url,
      video_introduction_url,
      email,
      candidate_user_id,
    } = row;

    console.log(`── Submission ${submission_id} (${email})`);
    console.log(`   owner resolvable: ${candidate_user_id ? `YES → ${candidate_user_id}` : "NO — orphan"}`);

    // ── resume_url ────────────────────────────────────────────────────────
    if (resume_url?.startsWith("/objects/application-resumes/")) {
      if (candidate_user_id) {
        const outcome = await backfillOwner(resume_url, candidate_user_id);
        console.log(`   resume  ${resume_url}  →  ${outcome}`);
        if (outcome === "patched") patchCount++;
        else if (outcome === "object-not-found") notFoundCount++;
        else errorCount++;
      } else {
        // Orphaned — delete storage object and null the DB column
        const outcome = await deleteOrphanedObject(resume_url);
        console.log(`   resume  ${resume_url}  →  ${outcome} (orphan)`);
        if (outcome === "deleted" || outcome === "object-not-found") {
          await query(
            `UPDATE job_submissions SET resume_url = NULL, resume_file_name = NULL, updated_at = NOW() WHERE id = $1`,
            [submission_id],
          );
          console.log(`   resume_url column nulled on submission ${submission_id}`);
          deleteCount++;
        } else {
          errorCount++;
        }
      }
    }

    // ── video_introduction_url ────────────────────────────────────────────
    if (video_introduction_url?.startsWith("/objects/application-videos/")) {
      if (candidate_user_id) {
        const outcome = await backfillOwner(video_introduction_url, candidate_user_id);
        console.log(`   video   ${video_introduction_url}  →  ${outcome}`);
        if (outcome === "patched") patchCount++;
        else if (outcome === "object-not-found") notFoundCount++;
        else errorCount++;
      } else {
        const outcome = await deleteOrphanedObject(video_introduction_url);
        console.log(`   video   ${video_introduction_url}  →  ${outcome} (orphan)`);
        if (outcome === "deleted" || outcome === "object-not-found") {
          await query(
            `UPDATE job_submissions SET video_introduction_url = NULL, video_introduction_file_name = NULL, updated_at = NOW() WHERE id = $1`,
            [submission_id],
          );
          console.log(`   video_introduction_url column nulled on submission ${submission_id}`);
          deleteCount++;
        } else {
          errorCount++;
        }
      }
    }

    console.log();
  }

  // Also fix candidates.resume_url pointing at application-resumes objects
  const candRows = await query(`
    SELECT id, user_id, email, resume_url
    FROM candidates
    WHERE resume_url LIKE '/objects/application-resumes/%'
      AND user_id IS NOT NULL
  `);

  if (candRows.rows.length > 0) {
    console.log(`── candidates.resume_url backfill (${candRows.rows.length} row(s))\n`);
    for (const cand of candRows.rows) {
      // The same object was already patched above via the submission loop;
      // calling setObjectAclPolicy again is idempotent (overwrites metadata).
      const outcome = await backfillOwner(cand.resume_url, cand.user_id);
      console.log(`   candidate ${cand.id} (${cand.email})  ${cand.resume_url}  →  ${outcome}`);
      if (outcome === "patched") patchCount++;
      else if (outcome === "object-not-found") notFoundCount++;
      else errorCount++;
    }
    console.log();
  }

  console.log("=== summary ===");
  console.log(`  patched:       ${patchCount}`);
  console.log(`  deleted:       ${deleteCount}`);
  console.log(`  not-found:     ${notFoundCount}`);
  console.log(`  errors:        ${errorCount}`);

  if (errorCount > 0) {
    console.error("\n❌ Completed with errors — review output above.");
    process.exit(1);
  } else {
    console.log("\n✅ Done.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
