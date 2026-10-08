/**
 * Controlled provider smoke test, not an authenticated profile/upload UAT.
 * Creates one random non-sensitive object; never changes any existing object
 * or profile. Signed URLs, bucket identifiers and credentials are never logged.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ObjectStorageService } from "../server/objectStorage.ts";
import { getObjectAclPolicy, setObjectAclPolicy } from "../server/objectAcl.ts";

if (!process.argv.includes("--run-controlled-upload")) {
  throw new Error("Explicit --run-controlled-upload authorization is required");
}

const owner = `mvp-verification-${randomUUID()}`;
const bytes = Buffer.from("ONSpot controlled non-sensitive storage verification.\n");
const result: Record<string, boolean | number | string> = {
  signedUpload: false, uploadedBytes: false, privateAcl: false,
  ownerAllowed: false, foreignDenied: false, anonymousDenied: false,
  freshClientRead: false, unsignedProviderReadDenied: false, cleanup: false,
};
let file: Awaited<ReturnType<ObjectStorageService["getObjectEntityFile"]>> | undefined;
let path: string | undefined;
try {
  const service = new ObjectStorageService();
  const upload = await service.getObjectEntityUploadURL();
  result.signedUpload = true;
  path = upload.objectPath;
  const response = await fetch(upload.uploadUrl, {
    method: "PUT", body: bytes, headers: { "Content-Type": "text/plain" },
    signal: AbortSignal.timeout(30_000),
  });
  result.uploadStatus = response.status;
  assert.ok(response.ok, "Controlled signed upload was rejected");
  result.uploadedBytes = true;
  file = await service.getObjectEntityFile(path);
  await setObjectAclPolicy(file, { owner, visibility: "private" });
  result.privateAcl = (await getObjectAclPolicy(file))?.visibility === "private";
  result.ownerAllowed = await service.canAccessObjectEntity({ objectFile: file, userId: owner });
  result.foreignDenied = !(await service.canAccessObjectEntity({ objectFile: file, userId: "foreign-fixture" }));
  result.anonymousDenied = !(await service.canAccessObjectEntity({ objectFile: file }));
  const fresh = new ObjectStorageService();
  const reloaded = await fresh.getObjectEntityFile(path);
  const [downloaded] = await reloaded.download();
  result.freshClientRead = downloaded.equals(bytes);
  const unsigned = await fetch(`https://storage.googleapis.com/${encodeURIComponent(file.bucket.name)}/${file.name.split("/").map(encodeURIComponent).join("/")}`, {
    signal: AbortSignal.timeout(15_000),
  });
  result.unsignedProviderReadDenied = [401, 403, 404].includes(unsigned.status);
  result.unsignedProviderStatus = unsigned.status;
  assert.ok(result.privateAcl && result.ownerAllowed && result.foreignDenied
    && result.anonymousDenied && result.freshClientRead
    && result.unsignedProviderReadDenied, "Private storage verification failed");
} catch (error) {
  // Provider error strings can contain signed URLs. Emit only a safe category.
  result.error = error instanceof assert.AssertionError ? "VERIFICATION_FAILED" : "PROVIDER_UNVERIFIED";
  process.exitCode = 1;
} finally {
  try {
    if (path && !file && result.uploadedBytes) {
      file = await new ObjectStorageService().getObjectEntityFile(path);
    }
    if (file) {
      const acl = await getObjectAclPolicy(file);
      // The path came from this run's fresh UUID, not external input. Refuse
      // deletion if an unexpected owner appears; never delete existing data.
      assert.ok(!acl || acl.owner === owner, "Unexpected fixture object owner");
      await file.delete();
      result.cleanup = true;
    }
  } catch {
    result.cleanup = false;
    result.cleanupError = "CONTROLLED_OBJECT_CLEANUP_UNVERIFIED";
    process.exitCode = 1;
  }
  console.log(JSON.stringify(result));
}
