import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createTalentIdentityHandler,
  type TalentAuthUserQuery,
} from "../lib/talentAuthIdentity.js";

type CapturedResponse = {
  statusCode: number;
  body: unknown;
};

async function runIdentityHandler(
  handler: ReturnType<typeof createTalentIdentityHandler>,
  req: Record<string, unknown>,
): Promise<CapturedResponse> {
  const response: CapturedResponse = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      response.statusCode = code;
      return this;
    },
    json(body: unknown) {
      response.body = body;
      return this;
    },
  };
  await handler(req as any, res as any, (() => undefined) as any);
  return response;
}

describe("GET /api/talent-auth/me identity contract", () => {
  it("returns the linked users.id rather than a distinct candidates.id", async () => {
    const candidate = {
      id: "candidate-record-17",
      fullName: "Linked Talent",
      email: "linked@example.test",
    };
    let queryParameters: unknown[] | undefined;
    let queryText = "";
    const query: TalentAuthUserQuery = async (sql, parameters) => {
      queryText = sql;
      queryParameters = parameters;
      return { rows: [{ id: "user-record-92", email: "linked@example.test", role: "talent" }] };
    };
    const handler = createTalentIdentityHandler({
      getCandidate: async (id) => id === candidate.id ? candidate : undefined,
      query,
    });

    const response = await runIdentityHandler(handler, {
      talentAuth: { candidateId: candidate.id, email: candidate.email },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      candidateId: candidate.id,
      userId: "user-record-92",
      fullName: candidate.fullName,
      email: candidate.email,
    });
    assert.match(queryText, /JOIN users u ON u\.id = c\.user_id/);
    assert.deepEqual(queryParameters, [candidate.id, candidate.email]);
  });

  it("uses the authenticateJWT legacy email fallback when the candidate has no user link", async () => {
    const candidate = {
      id: "legacy-candidate-23",
      fullName: "Legacy Talent",
      email: "legacy@example.test",
    };
    let queryText = "";
    let queryParameters: unknown[] | undefined;
    const query: TalentAuthUserQuery = async (sql, parameters) => {
      queryText = sql;
      queryParameters = parameters;
      return { rows: [{ id: "email-matched-user-31", email: "legacy@example.test", role: "talent" }] };
    };
    const handler = createTalentIdentityHandler({
      getCandidate: async () => candidate,
      query,
    });

    const response = await runIdentityHandler(handler, {
      talentAuth: { candidateId: candidate.id, email: "LEGACY@example.test" },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      candidateId: candidate.id,
      userId: "email-matched-user-31",
      fullName: candidate.fullName,
      email: candidate.email,
    });
    assert.match(queryText, /WHERE lower\(u\.email\) = lower\(\$2\)/);
    assert.match(queryText, /NOT EXISTS[\s\S]*JOIN users linked ON linked\.id = c\.user_id[\s\S]*WHERE c\.id = \$1/);
    assert.deepEqual(queryParameters, [candidate.id, "LEGACY@example.test"]);
  });

  it("preserves candidateId as userId for a candidate with no users row", async () => {
    const candidate = {
      id: "candidate-only-legacy",
      fullName: "Candidate Only",
      email: "candidate-only@example.test",
    };
    const query: TalentAuthUserQuery = async () => ({ rows: [] });
    const handler = createTalentIdentityHandler({
      getCandidate: async () => candidate,
      query,
    });

    const response = await runIdentityHandler(handler, {
      talentAuth: { candidateId: candidate.id, email: candidate.email },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      candidateId: candidate.id,
      userId: candidate.id,
      fullName: candidate.fullName,
      email: candidate.email,
    });
  });

  it("returns 404 for a missing candidate without attempting user lookup", async () => {
    let queryCalled = false;
    const handler = createTalentIdentityHandler({
      getCandidate: async () => undefined,
      query: async () => {
        queryCalled = true;
        return { rows: [] };
      },
    });

    const response = await runIdentityHandler(handler, {
      talentAuth: { candidateId: "missing-candidate", email: "missing@example.test" },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { error: "Candidate not found" });
    assert.equal(queryCalled, false);
  });

  it("rejects an unauthenticated identity request", async () => {
    let candidateRead = false;
    let queryCalled = false;
    const handler = createTalentIdentityHandler({
      getCandidate: async () => {
        candidateRead = true;
        return undefined;
      },
      query: async () => {
        queryCalled = true;
        return { rows: [] };
      },
    });

    const response = await runIdentityHandler(handler, {});

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { error: "Talent auth required" });
    assert.equal(candidateRead, false);
    assert.equal(queryCalled, false);
  });
});