import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CANDIDATE_ME_SQL,
  createCandidateMeHandler,
} from "../lib/candidateMeHandler.js";

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

async function invoke(
  query: (sql: string, parameters: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>,
  email?: string,
) {
  const result = makeResponse();
  const handler = createCandidateMeHandler(query);
  await handler({ user: email ? { email } : undefined } as any, result.response as any, (() => {}) as any);
  return result;
}

describe("GET /api/candidates/me optional legacy answer compatibility", () => {
  it("returns the profile when values_answers is absent and reports capability false", async () => {
    let calledSql = "";
    const result = await invoke(async (sql, parameters) => {
      calledSql = sql;
      assert.deepEqual(parameters, ["talent@example.com"]);
      return {
        rows: [{
          id: "candidate-1",
          fullName: "Test Talent",
          valuesAnswers: null,
          valuesAnswersAvailable: false,
        }],
      };
    }, "talent@example.com");

    assert.equal(result.statusCode, 200);
    assert.equal((result.body as any).valuesAnswersAvailable, false);
    assert.equal((result.body as any).valuesAnswers, null);
    assert.match(calledSql, /to_jsonb\(c\)->'values_answers' AS "valuesAnswers"/);
    assert.match(calledSql, /to_jsonb\(c\) \? 'values_answers' AS "valuesAnswersAvailable"/);
    assert.doesNotMatch(calledSql, /c\.values_answers/);
  });

  it("preserves an existing answer object without normalizing or inventing values", async () => {
    const answers = { collaboration: "listen-first", ownership: "take-initiative" };
    const result = await invoke(async () => ({
      rows: [{ id: "candidate-2", valuesAnswers: answers, valuesAnswersAvailable: true }],
    }), "talent@example.com");

    assert.equal(result.statusCode, 200);
    assert.deepEqual((result.body as any).valuesAnswers, answers);
    assert.equal((result.body as any).valuesAnswersAvailable, true);
  });

  it("preserves an existing legacy text answer value verbatim", async () => {
    const answerText = "legacy answer text";
    const result = await invoke(async () => ({
      rows: [{ id: "candidate-3", valuesAnswers: answerText, valuesAnswersAvailable: true }],
    }), "talent@example.com");

    assert.equal(result.statusCode, 200);
    assert.equal((result.body as any).valuesAnswers, answerText);
  });

  it("retains the talent ownership join and case-insensitive authenticated-email filter", async () => {
    assert.match(CANDIDATE_ME_SQL, /JOIN users u\s+ON u\.role = 'talent'/);
    assert.match(CANDIDATE_ME_SQL, /u\.id = c\.user_id OR LOWER\(u\.email\) = LOWER\(c\.email\)/);
    assert.match(CANDIDATE_ME_SQL, /WHERE LOWER\(c\.email\) = LOWER\(\$1\)/);

    let parameters: unknown[] = [];
    await invoke(async (_sql, values) => {
      parameters = values;
      return { rows: [{ id: "candidate-4", valuesAnswersAvailable: false }] };
    }, "Owner@Example.com");
    assert.deepEqual(parameters, ["Owner@Example.com"]);
  });

  it("keeps authenticateJWT on the production route and rejects missing identity", async () => {
    const routesPath = fileURLToPath(new URL("../routes.ts", import.meta.url));
    const routesSource = readFileSync(routesPath, "utf8");
    assert.match(
      routesSource,
      /app\.get\("\/api\/candidates\/me", authenticateJWT, createCandidateMeHandler\(query\)\)/,
    );

    let queryCalled = false;
    const result = await invoke(async () => {
      queryCalled = true;
      return { rows: [] };
    });
    assert.equal(result.statusCode, 401);
    assert.equal(queryCalled, false);
  });

  it("preserves not-found and database-error response semantics", async () => {
    const missing = await invoke(async () => ({ rows: [] }), "talent@example.com");
    assert.equal(missing.statusCode, 404);
    assert.deepEqual(missing.body, { error: "No candidate profile found" });

    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      const failed = await invoke(async () => {
        throw new Error("injected database failure");
      }, "talent@example.com");
      assert.equal(failed.statusCode, 500);
      assert.deepEqual(failed.body, { error: "Failed to fetch candidate" });
    } finally {
      console.error = originalConsoleError;
    }
  });
});