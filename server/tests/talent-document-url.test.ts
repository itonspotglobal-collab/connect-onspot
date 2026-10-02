import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canAccessObject, ObjectPermission } from "../objectAcl.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createTalentDocumentUrlHandler,
  TalentDocumentObjectNotFoundError,
} from "../lib/talentDocumentUrlHandler.js";

const USER = { email: "talent@example.com", id: "user-123" };
const RESUME_PATH = "/objects/uploads/resume-uuid";
const VIDEO_PATH = "/objects/uploads/video-uuid";
const PRIVATE_POLICY = { visibility: "private" as const, owner: USER.id };

function makeResponse() {
  let statusCode = 200;
  let body: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(value: unknown) {
      body = value;
      return response;
    },
  };
  return { response, get statusCode() { return statusCode; }, get body() { return body; } };
}

async function invoke(options: {
  kind?: "resume" | "videoIntro";
  user?: Record<string, unknown>;
  fileUrl?: unknown;
  fileName?: unknown;
  policy?: { visibility: "private" | "public"; owner?: string } | null;
  readObjectPolicy?: (fileUrl: string) => Promise<{ visibility: "private" | "public"; owner?: string } | null>;
  query?: (sql: string, parameters: unknown[]) => Promise<{ rowCount?: number | null }>;
}) {
  const result = makeResponse();
  let policyReadCount = 0;
  let queryCount = 0;
  let capturedSql = "";
  let capturedParameters: unknown[] = [];
  const handler = createTalentDocumentUrlHandler({
    kind: options.kind ?? "resume",
    readObjectPolicy: options.readObjectPolicy ?? (async () => {
      policyReadCount += 1;
      return options.policy === undefined ? PRIVATE_POLICY : options.policy;
    }),
    query: async (sql, parameters) => {
      queryCount += 1;
      capturedSql = sql;
      capturedParameters = parameters;
      return options.query
        ? options.query(sql, parameters)
        : { rowCount: 1 };
    },
  });
  await handler(
    {
      user: Object.hasOwn(options, "user") ? options.user : USER,
      body: {
        fileUrl: options.fileUrl === undefined ? RESUME_PATH : options.fileUrl,
        fileName: options.fileName,
      },
    } as any,
    result.response as any,
    (() => {}) as any,
  );
  return {
    ...result,
    get policyReadCount() { return policyReadCount; },
    get queryCount() { return queryCount; },
    get capturedSql() { return capturedSql; },
    get capturedParameters() { return capturedParameters; },
  };
}

describe("talent document URL persistence", () => {
  it("persists resume URL and filename only after private owner policy validation", async () => {
    const result = await invoke({ fileName: "My CV.pdf" });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, {
      success: true,
      resumeUrl: RESUME_PATH,
      resumeFileName: "My CV.pdf",
    });
    assert.match(result.capturedSql, /resume_url = \$1, resume_file_name = \$2/);
    assert.deepEqual(result.capturedParameters, [RESUME_PATH, "My CV.pdf", USER.email]);
  });

  it("persists video intro URL and filename with the existing response shape", async () => {
    const result = await invoke({
      kind: "videoIntro",
      fileUrl: VIDEO_PATH,
      fileName: "intro.mp4",
    });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, {
      success: true,
      videoIntroUrl: VIDEO_PATH,
      videoIntroFileName: "intro.mp4",
    });
    assert.match(result.capturedSql, /video_intro_url = \$1, video_intro_file_name = \$2/);
    assert.deepEqual(result.capturedParameters, [VIDEO_PATH, "intro.mp4", USER.email]);
  });

  it("accepts the authenticated claims.sub fallback when identifying the object owner", async () => {
    const result = await invoke({
      user: { email: USER.email, claims: { sub: USER.id } },
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.queryCount, 1);
  });

  it("rejects missing authenticated identity without reading storage or updating", async () => {
    for (const user of [undefined, { email: USER.email }, { id: USER.id }]) {
      const result = await invoke({ user });
      assert.equal(result.statusCode, 401);
      assert.equal(result.policyReadCount, 0);
      assert.equal(result.queryCount, 0);
    }
  });

  it("rejects traversal, signed, external, and noncanonical paths before storage lookup", async () => {
    for (const fileUrl of [
      "/objects/../private/file",
      "/objects/uploads/%2e%2e/file",
      "/objects/uploads/file?signature=secret",
      "https://storage.googleapis.com/private/file",
      "https://example.com/objects/uploads/file",
      "/objects/uploads//file",
      "/objects/uploads\\..\\file",
    ]) {
      const result = await invoke({ fileUrl });
      assert.equal(result.statusCode, 400, String(fileUrl));
      assert.equal(result.policyReadCount, 0);
      assert.equal(result.queryCount, 0);
    }
  });

  it("returns 404 for a nonexistent object without updating", async () => {
    const result = await invoke({
      readObjectPolicy: async () => {
        throw new TalentDocumentObjectNotFoundError();
      },
    });
    assert.equal(result.statusCode, 404);
    assert.equal(result.queryCount, 0);
  });

  it("rejects foreign-owned, missing-ACL, and public objects without updating", async () => {
    const foreign = await invoke({ policy: { visibility: "private", owner: "other-user" } });
    const noAcl = await invoke({ policy: null });
    const publicObject = await invoke({ policy: { visibility: "public", owner: USER.id } });
    for (const result of [foreign, noAcl, publicObject]) {
      assert.equal(result.statusCode, 403);
      assert.equal(result.queryCount, 0);
    }
  });

  it("returns 404 for a missing candidate row and 500 for database errors", async () => {
    const missing = await invoke({ query: async () => ({ rowCount: 0 }) });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.queryCount, 1);

    const failed = await invoke({
      query: async () => {
        throw new Error("injected database failure");
      },
    });
    assert.equal(failed.statusCode, 500);
    assert.equal(failed.queryCount, 1);
  });

  it("returns 500 and does not update when object storage or ACL lookup fails", async () => {
    const result = await invoke({
      readObjectPolicy: async () => {
        throw new Error("injected storage failure");
      },
    });
    assert.equal(result.statusCode, 500);
    assert.equal(result.queryCount, 0);
  });

  it("the real retrieval ACL permits the private owner and denies another Talent or anonymous user", async () => {
    const objectFile = {
      getMetadata: async () => [{
        metadata: { "custom:aclPolicy": JSON.stringify({ visibility: "private", owner: USER.id }) },
      }],
    } as any;
    assert.equal(await canAccessObject({ objectFile, userId: USER.id, requestedPermission: ObjectPermission.READ }), true);
    assert.equal(await canAccessObject({ objectFile, userId: "another-talent", requestedPermission: ObjectPermission.READ }), false);
    assert.equal(await canAccessObject({ objectFile, requestedPermission: ObjectPermission.READ }), false);
  });

  it("keeps authentication, storage existence/ACL wiring, and document filenames in production routes", () => {
    const routesPath = fileURLToPath(new URL("../routes.ts", import.meta.url));
    const source = readFileSync(routesPath, "utf8");
    assert.match(source, /app\.patch\(\s*"\/api\/talent\/me\/resume-url",\s*authenticateJWT,\s*createTalentDocumentUrlHandler/);
    assert.match(source, /app\.patch\(\s*"\/api\/talent\/me\/video-intro-url",\s*authenticateJWT,\s*createTalentDocumentUrlHandler/);
    assert.match(source, /objectStorageService\.getObjectEntityFile\(fileUrl\)/);
    assert.match(source, /return getObjectAclPolicy\(objectFile\)/);
    assert.match(source, /resume_file_name AS "resumeFileName"/);
    assert.match(source, /video_intro_file_name AS "videoIntroFileName"/);
    assert.match(source, /app\.get\("\/api\/objects\/:objectPath\(\*\)", authenticateJWT/);
    assert.match(source, /objectStorageService\.canAccessObjectEntity/);
  });
});