import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";
import { guardInvestorGoalUpdates, registerInvestorGoalRoutes } from "../routes/investorGoals";
import { INVESTOR_GOAL_PLACEHOLDERS, isValidInvestorGoalSetting, parseInvestorGoal } from "../../shared/investorGoals";

describe("investor goal configuration", () => {
  let server: Server;
  let base: string;
  let rows: { key: string; value: string }[] = [];
  let fail = false;
  let authorizationCalls = 0;
  before(async () => {
    const app = express();
    app.use(express.json());
    registerInvestorGoalRoutes(app, async (sql) => {
      assert.match(sql, /FROM platform_settings/);
      assert.doesNotMatch(sql, /users|candidates/);
      if (fail) throw new Error("Fixture settings unavailable");
      return { rows };
    });
    app.patch("/settings", guardInvestorGoalUpdates((req, res, next) => {
      authorizationCalls++;
      if (req.header("x-fixture-admin") !== "super") return void res.sendStatus(403);
      next();
    }), (_req, res) => res.sendStatus(204));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("missing and placeholder settings expose null goals, never guessed numbers", async () => {
    for (const data of [[], Object.entries(INVESTOR_GOAL_PLACEHOLDERS).map(([key, value]) => ({ key, value }))]) {
      rows = data;
      const response = await fetch(`${base}/api/public/investor-goals`);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { contractorGoal2027: null, clientGoal2027: null });
    }
  });
  it("reads changed live goals without a deploy or a stats-cache dependency", async () => {
    rows = [
      { key: "investor_goal_contractors_2027", value: "2500" },
      { key: "investor_goal_clients_2027", value: "400" },
      { key: "unrelated_private_setting", value: "not public" },
    ];
    assert.deepEqual(await (await fetch(`${base}/api/public/investor-goals`)).json(),
      { contractorGoal2027: 2500, clientGoal2027: 400 });
    rows[0].value = "5000";
    rows[1].value = "";
    assert.deepEqual(await (await fetch(`${base}/api/public/investor-goals`)).json(),
      { contractorGoal2027: 5000, clientGoal2027: null });
  });
  it("rejects zero, negative, fractional, exponent, formatted and unsafe targets", () => {
    for (const value of ["0", "-1", "1.5", "1e3", "1,000", "Infinity", "9007199254740992", "garbage"]) {
      assert.equal(parseInvestorGoal(value), null);
      assert.equal(isValidInvestorGoalSetting("investor_goal_clients_2027", value), false);
    }
    assert.equal(parseInvestorGoal(" 1234 "), 1234);
    assert.equal(isValidInvestorGoalSetting("investor_goal_clients_2027", ""), true);
    assert.equal(isValidInvestorGoalSetting("investor_goal_clients_2027", "{CLIENT_GOAL}"), true);
    assert.equal(isValidInvestorGoalSetting("investor_goal_clients_2027", "{CONTRACTOR_GOAL}"), false);
  });
  it("requires the Super Admin policy for either goal, including mixed updates", async () => {
    for (const body of [
      { investor_goal_clients_2027: "100" },
      { investor_goal_contractors_2027: "200" },
      { investor_goal_clients_2027: "100", name_reveal_threshold: "new" },
    ]) {
      const request = { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
      assert.equal((await fetch(`${base}/settings`, request)).status, 403);
      assert.equal((await fetch(`${base}/settings`, {
        ...request, headers: { ...request.headers, "x-fixture-admin": "super" },
      })).status, 204);
    }
    assert.equal(authorizationCalls, 6);
  });
  it("does not change authorization for existing settings", async () => {
    assert.equal((await fetch(`${base}/settings`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name_reveal_threshold: "new" }),
    })).status, 204);
    assert.equal(authorizationCalls, 6);
  });
  it("fails explicitly when configuration cannot be read", async () => {
    fail = true;
    assert.equal((await fetch(`${base}/api/public/investor-goals`)).status, 503);
  });
});
