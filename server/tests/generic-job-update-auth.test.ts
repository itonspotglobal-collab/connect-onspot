import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http, { type Server } from "node:http";
import type { RequestHandler } from "express";
import { registerGenericJobUpdateRoute } from "../routes.js";

const job = {
  id: "job-1",
  clientId: "client-1",
  title: "Legacy PHP job",
  description: "Legacy job description",
  category: "Engineering",
  experienceLevel: "intermediate",
  budget: "100.00",
  budgetCurrency: "PHP",
  salaryDisplay: "PHP 100",
  status: "draft",
  engagementType: "Standard",
  billingMode: "tracked",
};

let server: Server;
let storageReads = 0;
let storageWrites = 0;

function request(
  method: string,
  path: string,
  auth?: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const { port } = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
          ...(data
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data),
              }
            : {}),
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => (responseBody += chunk));
        res.on("end", () => {
          let json: any = null;
          try {
            json = JSON.parse(responseBody);
          } catch {
            // Preserve the status if an unexpected non-JSON response is returned.
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

describe("generic job PATCH authorization", () => {
  before(async () => {
    const app = express();
    app.use(express.json());
    const authentication: RequestHandler = (req, res, next) => {
      const identity = req.headers.authorization?.replace(/^Bearer\s+/, "");
      if (!identity) return res.status(401).json({ error: "Authentication required" });
      const [id, role] = identity.split(":");
      (req as any).user = { id, role };
      return next();
    };
    registerGenericJobUpdateRoute(app, authentication, {
      getJob: async () => {
        storageReads += 1;
        return { ...job } as any;
      },
      updateJob: async (_id, updates) => {
        storageWrites += 1;
        return { ...job, ...updates } as any;
      },
    } as any);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns 401 before reading or mutating a job when unauthenticated", async () => {
    storageReads = 0;
    storageWrites = 0;
    const response = await request("PATCH", "/api/jobs/job-1", undefined, { title: "changed" });
    assert.equal(response.status, 401);
    assert.equal(storageReads, 0);
    assert.equal(storageWrites, 0);
  });

  it("returns 403 to talent before evaluating a legacy currency change or writing", async () => {
    storageReads = 0;
    storageWrites = 0;
    const response = await request(
      "PATCH",
      "/api/jobs/job-1",
      "talent-1:talent",
      { budget: "100", budgetCurrency: "USD" },
    );
    assert.equal(response.status, 403);
    assert.equal(storageReads, 1);
    assert.equal(storageWrites, 0);
  });

  it("allows an owning client to update a non-financial field", async () => {
    storageWrites = 0;
    const response = await request(
      "PATCH",
      "/api/jobs/job-1",
      "client-1:client",
      { title: "Updated by owner" },
    );
    assert.equal(response.status, 200);
    assert.equal(response.json.title, "Updated by owner");
    assert.equal(storageWrites, 1);
  });

  it("allows admins", async () => {
    const response = await request(
      "PATCH",
      "/api/jobs/job-1",
      "admin-1:admin",
      { title: "Updated by admin" },
    );
    assert.equal(response.status, 200);
    assert.equal(response.json.title, "Updated by admin");
  });
});