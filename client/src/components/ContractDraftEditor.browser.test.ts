import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser } from "playwright";

let vite: ViteDevServer;
let browser: Browser;
let base: string;
let cache: string;

before(async () => {
  cache = mkdtempSync(join(tmpdir(), "contract-authoring-ui-"));
  vite = await createServer({
    configFile: false,
    root: resolve("client"),
    cacheDir: cache,
    optimizeDeps: { entries: ["src/components/ContractDraftEditor.tsx"] },
    resolve: { alias: { "@": resolve("client/src"), "@shared": resolve("shared") } },
    plugins: [react(), {
      name: "contract-authoring-test-harness",
      resolveId(id) { if (id === "/__contract-authoring.tsx") return id; },
      load(id) {
        if (id !== "/__contract-authoring.tsx") return;
        return `import React from "react";
          import {createRoot} from "react-dom/client";
          import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
          import {ContractDraftEditor} from "/src/components/ContractDraftEditor";
          import "/src/index.css";
          const queryClient = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:0}}});
          createRoot(document.getElementById("root")).render(
            <QueryClientProvider client={queryClient}>
              <main className="mx-auto max-w-5xl p-6"><ContractDraftEditor contractId="fixture-contract"/></main>
            </QueryClientProvider>);`;
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.split("?")[0] !== "/__contract-authoring") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(await server.transformIndexHtml("/__contract-authoring",
            '<html><body><div id="root"></div><script type="module" src="/__contract-authoring.tsx"></script></body></html>'));
        });
      },
    }],
    server: { host: "127.0.0.1", port: 0, strictPort: true },
  });
  await vite.listen();
  base = `http://127.0.0.1:${(vite.httpServer!.address() as AddressInfo).port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});

after(async () => {
  await browser?.close();
  await vite?.close();
  if (cache) rmSync(cache, { recursive: true, force: true });
});

test("admin profile changes are opt-in and only included in save, never live preview", { timeout: 60_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1180, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors: string[] = [];
  const previews: unknown[] = [];
  let draft: any = null;
  let saved: any = null;
  let creates = 0;

  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    let body: unknown = { message: "Unexpected fixture API" };
    let status = 404;
    if (request.method() === "GET" && url.pathname.endsWith("/authoring")) {
      body = {
        templates: [{ id: "msa-template", kind: "msa", name: "Master services agreement", version: "3" }],
        draft,
        fields: [
          { key: "client.legalEntityName", label: "Client legal entity", source: "organization profile", required: true, editableBy: "preparer" },
          { key: "client.address", label: "Client address", source: "organization profile", required: true, editableBy: "preparer" },
          { key: "talent.legalFullName", label: "Talent legal name", source: "candidate profile", required: true, editableBy: "preparer" },
        ],
        clauses: [{ id: "payment", html: '<section data-clause-id="payment"><p>Payment terms for {{client.legalEntityName}}</p></section>' }],
        preview: { html: "<h1>Agreement</h1><p>Example LLC</p>", missingKeys: [], unknownKeys: [] },
        isAdmin: true,
      };
      status = 200;
    } else if (request.method() === "POST" && url.pathname.endsWith("/authoring")) {
      creates++;
      draft = {
        id: "draft-1", kind: "msa", template_id: "msa-template", template_version: "3",
        field_values: {
          "client.legalEntityName": { value: "Example LLC", source: "organization profile", missing: false },
          "client.address": { value: "42 Example Road, Northport", source: "organization profile", missing: false },
          "talent.legalFullName": { value: "Avery Morgan", source: "candidate profile", missing: false },
        },
        field_overrides: {}, body_overrides: {}, status: "draft", revision: 1,
      };
      body = draft;
      status = 201;
    } else if (request.method() === "POST" && url.pathname.endsWith("/preview")) {
      previews.push(request.postDataJSON());
      body = { html: "<h1>Agreement</h1><p>Updated legal entity</p>", missingKeys: [], unknownKeys: [] };
      status = 200;
    } else if (request.method() === "PATCH" && url.pathname.endsWith("/authoring")) {
      saved = request.postDataJSON();
      draft = { ...draft, revision: draft.revision + 1, field_overrides: saved.fieldOverrides, body_overrides: saved.bodyOverrides };
      body = { revision: draft.revision };
      status = 200;
    }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto(`${base}/__contract-authoring`);
  await page.getByRole("combobox", { name: "Approved template" }).click();
  await page.getByRole("option", { name: /Master services agreement/ }).click();
  await page.getByRole("button", { name: "Create editable agreement" }).click();
  await page.getByRole("heading", { name: "Edit agreement details" }).waitFor();
  assert.equal(creates, 1);

  await page.getByLabel("Client legal entity").fill("Northstar Works Ltd.");
  await page.getByLabel("Also save this changed value to the linked client profile").check();
  await page.waitForFunction(() => document.body.innerText.includes("Live agreement preview"));
  await page.waitForTimeout(650);
  assert.ok(previews.length > 0, "Live preview request should be made after editing");
  assert.equal((previews.at(-1) as any).profileChanges, undefined, "Preview payload must not contain profile changes");

  await page.getByRole("button", { name: "Save edits" }).click();
  await page.getByText("Changes saved to this agreement revision. Generate a new PDF before sending.").waitFor();
  assert.equal(saved?.profileChanges?.client?.legalEntityName, "Northstar Works Ltd.");
  assert.equal(saved?.profileChanges?.talent, undefined);
  assert.deepEqual(errors.filter((message) => !message.includes("serviceWorker") || !message.includes("sandboxed")), []);
  await context.close();
});
