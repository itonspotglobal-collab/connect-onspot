import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";

// Import the production registrar without connecting to a live database.
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
const { createCachedInvestorStatsLoader, registerInvestorRoutes } =
  await import("../routes/investors.js");

type InvestorRequest = {
  name: string;
  firm: string;
  email: string;
  requestType: "meeting" | "deck" | "founder";
  message?: string;
};

const sample: InvestorRequest = {
  name: "Avery Investor",
  firm: "Example Ventures",
  email: "avery@example.org",
  requestType: "meeting",
};

describe("public investor intake", () => {
  let server: Server;
  let base = "";
  let statsLoads = 0;
  let saves: InvestorRequest[] = [];
  let notifications: InvestorRequest[] = [];
  let outcomes: { id: string; success: boolean }[] = [];
  let deliver = true;

  before(async () => {
    const app = express();
    app.use(express.json());
    registerInvestorRoutes(app, {
      loadStats: async () => {
        statsLoads++;
        return { contractorAccounts: 90, clientAccounts: 8, asOf: "2026-10-01T00:00:00.000Z" };
      },
      saveRequest: async (request) => {
        saves.push(request);
        return { id: `request-${saves.length}` };
      },
      notifyFounder: async (request) => {
        notifications.push(request);
        return { success: deliver, error: deliver ? undefined : "Test mail failure" };
      },
      recordNotification: async (id, result) => {
        outcomes.push({ id, success: result.success });
      },
    });
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  it("serves deduplicated account totals publicly from a shared cache", async () => {
    const first = await fetch(`${base}/api/public/investor-stats`);
    const second = await fetch(`${base}/api/public/investor-stats`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("cache-control"), "no-store");
    assert.deepEqual(await first.json(), {
      contractorAccounts: 90,
      clientAccounts: 8,
      asOf: "2026-10-01T00:00:00.000Z",
    });
    assert.equal((await second.json()).clientAccounts, 8);
    assert.equal(statsLoads, 1);
  });

  it("refreshes after 60 seconds and coalesces simultaneous refreshes", async () => {
    let now = 0;
    let calls = 0;
    const cache = createCachedInvestorStatsLoader(async () => {
      calls++;
      return { contractorAccounts: calls, clientAccounts: 2, asOf: `timestamp-${calls}` };
    }, 60_000, () => now);
    assert.deepEqual((await Promise.all([cache(), cache(), cache()])).map((r) => r.contractorAccounts), [1, 1, 1]);
    now = 59_999;
    assert.equal((await cache()).contractorAccounts, 1);
    now = 60_000;
    assert.equal((await cache()).contractorAccounts, 2);
    assert.equal(calls, 2);
  });

  it("saves and notifies Nur for each of the three request types", async () => {
    for (const requestType of ["meeting", "deck", "founder"] as const) {
      const response = await fetch(`${base}/api/public/investor-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sample, requestType }),
      });
      assert.equal(response.status, 201);
      assert.equal((await response.json()).notificationStatus, "sent");
    }
    assert.deepEqual(saves.map((r) => r.requestType), ["meeting", "deck", "founder"]);
    assert.deepEqual(notifications.map((r) => r.requestType), ["meeting", "deck", "founder"]);
    assert.equal(outcomes.every((r) => r.success), true);
  });

  it("rejects invalid request types without saving or emailing", async () => {
    const previous = saves.length;
    const response = await fetch(`${base}/api/public/investor-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sample, requestType: "wrong" }),
    });
    assert.equal(response.status, 400);
    assert.equal(saves.length, previous);
  });

  it("reports an email failure without losing the saved request", async () => {
    deliver = false;
    const response = await fetch(`${base}/api/public/investor-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...sample, requestType: "founder", message: "Please contact me." }),
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).notificationStatus, "failed");
    assert.equal(saves.at(-1)?.message, "Please contact me.");
    assert.deepEqual(outcomes.at(-1), { id: `request-${saves.length}`, success: false });
  });

  it("does not send a notification when storing the request fails", async () => {
    let sent = false;
    const failingApp = express();
    failingApp.use(express.json());
    registerInvestorRoutes(failingApp, {
      loadStats: async () => ({ contractorAccounts: 0, clientAccounts: 0, asOf: "2026-10-01T00:00:00.000Z" }),
      saveRequest: async () => { throw new Error("Test save failure"); },
      notifyFounder: async () => { sent = true; return { success: true }; },
      recordNotification: async () => {},
    });
    const failingServer = failingApp.listen(0);
    try {
      await new Promise<void>((resolve) => failingServer.once("listening", resolve));
      const port = (failingServer.address() as { port: number }).port;
      const response = await fetch(`http://127.0.0.1:${port}/api/public/investor-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sample),
      });
      assert.equal(response.status, 503);
      assert.equal(sent, false);
    } finally {
      await new Promise<void>((resolve) => failingServer.close(() => resolve()));
    }
  });

  it("rate-limits excessive public submissions before another write", async () => {
    const previous = saves.length;
    const response = await fetch(`${base}/api/public/investor-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sample),
    });
    assert.equal(response.status, 429);
    assert.equal(saves.length, previous);
  });
});