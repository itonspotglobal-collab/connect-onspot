import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, Browser, Locator, Page, Route } from "playwright";
import { contractMergeFields } from "../../../shared/contractTemplates";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5189);
const BASE_URL = process.env.BROWSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const API = "/api/admin/contract-templates";
let browser: Browser;
let vite: ChildProcess | undefined;

type Template = {
  id: string;
  kind: "msa" | "talent_agreement" | "sow";
  name: string;
  version: string;
  status: "draft" | "active" | "retired";
  createdAt: string;
  activatedAt?: string;
  activationReason?: string;
  body: string;
  fields: Array<{ key: string; label: string; source: string; required: boolean; editableBy: "admin" | "preparer" | "none" }>;
  reviewHash: string;
};
type FixtureState = {
  templates: Template[];
  requests: Array<{ method: string; path: string; body?: Record<string, unknown> }>;
  forbidden?: boolean;
  staleActivation?: boolean;
  sequence: number;
};

const registry = contractMergeFields.map((field) => ({ ...field }));
const baseBody = "<section data-clause-id=\"terms\"><h2>Commercial terms</h2><p>Services for {{job.title}}</p><table><thead><tr><th>Item</th><th>Rate</th></tr></thead><tbody><tr><td>Monthly service</td><td>{{offer.rate}}</td></tr></tbody></table><p>Accepted by {{client.legalEntityName}}</p></section>";
const date = "2026-05-12T12:00:00.000Z";

function freshState(): FixtureState {
  return {
    templates: [{
      id: "fixture-active-msa",
      kind: "msa",
      name: "OnSpot Services Agreement",
      version: "2.0",
      status: "active",
      createdAt: date,
      activatedAt: date,
      activationReason: "Approved legal review.",
      body: baseBody,
      fields: [
        { ...registry[0], required: true },
        { ...registry[10], required: true },
        { ...registry[7], required: true },
      ],
      reviewHash: "review-active-v1",
    }],
    requests: [],
    sequence: 1,
  };
}

function listItem(template: Template) {
  const { id, kind, name, version, status, createdAt, activatedAt, activationReason } = template;
  return { id, kind, name, version, status, createdAt, activatedAt, activationReason };
}

async function fulfill(route: Route, value: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
}

async function routeApi(route: Route, state: FixtureState) {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const body = request.postDataJSON?.() as Record<string, unknown> | undefined;
  state.requests.push({ method: request.method(), path, body });
  if (state.forbidden) return fulfill(route, { code: "FORBIDDEN", message: "Super Admin access required" }, 403);
  if (request.method() === "GET" && path === API) {
    return fulfill(route, { items: state.templates.map(listItem), mergeFields: registry });
  }
  if (request.method() === "POST" && path === API) {
    const source = typeof body?.sourceTemplateId === "string" ? state.templates.find((item) => item.id === body.sourceTemplateId) : undefined;
    const created: Template = {
      id: `fixture-draft-${++state.sequence}`,
      kind: body?.kind as Template["kind"],
      name: String(body?.name ?? ""),
      version: String(body?.version ?? ""),
      status: "draft",
      createdAt: date,
      body: source?.body ?? "",
      fields: source?.fields.map((field) => ({ ...field })) ?? [],
      reviewHash: `review-draft-${state.sequence}`,
    };
    state.templates.unshift(created);
    return fulfill(route, created, 201);
  }
  const match = path.match(/^\/api\/admin\/contract-templates\/([^/]+)(?:\/(preview|activate))?$/);
  if (!match) return fulfill(route, { error: "Unexpected test request" }, 404);
  const template = state.templates.find((item) => item.id === decodeURIComponent(match[1]));
  if (!template) return fulfill(route, { error: "Template not found" }, 404);
  if (request.method() === "GET" && !match[2]) {
    return fulfill(route, { ...template, mergeFields: registry });
  }
  if (request.method() === "PATCH" && !match[2]) {
    assert.equal(template.status, "draft", "only drafts may be edited");
    template.name = String(body?.name ?? template.name);
    template.body = String(body?.body ?? template.body);
    template.fields = (body?.fields as Template["fields"]) ?? template.fields;
    template.reviewHash = `review-saved-${++state.sequence}`;
    return fulfill(route, template);
  }
  if (request.method() === "POST" && match[2] === "preview") {
    const previewBody = typeof body?.body === "string" ? body.body : template.body;
    const fieldKeys = new Set(template.fields.map((field) => field.key));
    const usedKeys = Array.from(previewBody.matchAll(/\{\{([^}]+)\}\}/g), (item) => item[1]);
    const unknownKeys = [...new Set(usedKeys.filter((key) => !registry.some((field) => field.key === key)))];
    const missingKeys = [...new Set(usedKeys.filter((key) => !fieldKeys.has(key)))];
    const html = previewBody
      .replaceAll("{{client.legalEntityName}}", "Example Client LLC")
      .replaceAll("{{job.title}}", "Example role")
      .replaceAll("{{offer.rate}}", "USD 100.00");
    return fulfill(route, { html, missingKeys, unknownKeys, reviewHash: template.reviewHash });
  }
  if (request.method() === "POST" && match[2] === "activate") {
    if (state.staleActivation) return fulfill(route, { code: "REVIEW_STALE", message: "Review no longer matches saved content" }, 409);
    assert.equal(body?.reviewed, true);
    assert.equal(body?.reviewHash, template.reviewHash, "activation hash must equal current saved template hash");
    assert.ok(String(body?.reason ?? "").trim());
    template.status = "active";
    template.activatedAt = date;
    template.activationReason = String(body?.reason);
    return fulfill(route, template);
  }
  return fulfill(route, { error: "Unexpected method" }, 405);
}

async function waitForUrl(url: string) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok || response.status === 404) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function newHarness(state = freshState()): Promise<{ page: Page; state: FixtureState }> {
  const context = await browser.newContext({ viewport: { width: 1420, height: 1000 } });
  const page = await context.newPage();
  await page.route("**/api/admin/contract-templates**", (route) => routeApi(route, state));
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ type: "module", url: "/src/browser-tests/ContractTemplatesHarness.tsx" });
  await page.getByRole("heading", { name: "Contract templates" }).waitFor();
  return { page, state };
}

async function waitForEnabled(page: Page, button: Locator) {
  await page.waitForFunction((element) => element instanceof HTMLButtonElement && !element.disabled, await button.elementHandle());
}

before(async () => {
  if (!process.env.BROWSER_BASE_URL) {
    const env = { ...process.env, NODE_ENV: "development" };
    delete env.REPL_ID;
    vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT)], { stdio: "pipe", env });
    vite.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    await waitForUrl(BASE_URL);
  }
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { headless: true });
});

after(async () => {
  await browser?.close();
  if (vite && !vite.killed) {
    vite.kill("SIGTERM");
    await Promise.race([once(vite, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
});

test("admin can create a blank template and a cloned version preserves tables, inserts fields, previews, and activates with its reviewHash", async () => {
  const { page, state } = await newHarness();
  try {
    await page.getByRole("heading", { name: "OnSpot Services Agreement" }).waitFor();
    await page.getByRole("button", { name: "New template" }).click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByLabel("Agreement type").selectOption("talent_agreement");
    await createDialog.getByLabel("Template name").fill("New Talent Agreement");
    await createDialog.getByLabel("Version").fill("1.0");
    await createDialog.getByRole("button", { name: "Create draft" }).click();
    await page.getByRole("heading", { name: "New Talent Agreement" }).waitFor();
    const createRequest = state.requests.find((request) => request.method === "POST" && request.path === API);
    assert.equal(createRequest?.body?.kind, "talent_agreement");
    assert.equal(createRequest?.body?.version, "1.0");
    assert.ok(state.templates.some((item) => item.name === "New Talent Agreement" && item.status === "draft"));

    await page.getByRole("button", { name: /OnSpot Services Agreement/ }).click();
    await page.getByRole("button", { name: "New version from this" }).click();
    const cloneDialog = page.getByRole("dialog");
    await cloneDialog.getByLabel("Version").fill("2.1");
    await cloneDialog.getByRole("button", { name: "Create draft" }).click();
    const clonedName = "OnSpot Services Agreement";
    await page.getByRole("heading", { name: clonedName }).waitFor();
    const clonePost = state.requests.filter((request) => request.method === "POST" && request.path === API).at(-1);
    const cloned = state.templates.find((item) => item.id === String(clonePost?.body?.sourceTemplateId));
    assert.equal(clonePost?.body?.sourceTemplateId, "fixture-active-msa");
    assert.ok(cloned);

    const editor = page.getByRole("textbox", { name: "Agreement body" });
    await page.waitForFunction(() => !!document.querySelector('[contenteditable="true"] table'));
    let originalTableCount = await editor.locator("table").count();
    assert.equal(originalTableCount, 1, "clone must retain source MSA tables");
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" Reviewed clause.");
    await page.getByText("Insert field", { exact: true }).click();
    await page.getByRole("button", { name: /Client legal entity/ }).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" {{unknown.field}}");
    await page.waitForTimeout(900);
    assert.match(await editor.innerHTML(), /\{\{client\.legalEntityName\}\}/);
    assert.match(await editor.innerHTML(), /<table>/);
    originalTableCount = await editor.locator("table").count();
    assert.equal(originalTableCount, 1);
    const sampleFrame = page.locator('iframe[title="Agreement preview using sample data"]');
    await sampleFrame.waitFor();
    await page.waitForFunction(() => document.querySelector('iframe[title="Agreement preview using sample data"]')?.getAttribute("srcdoc")?.includes("Example Client LLC"));
    assert.equal(await page.getByRole("button", { name: "Review & activate" }).isDisabled(), true, "dirty content cannot activate even after preview");

    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByText("Draft saved", { exact: true }).waitFor();
    await page.getByText(/Unregistered fields: unknown\.field/).waitFor();
    assert.equal(await page.getByRole("button", { name: "Review & activate" }).isDisabled(), true, "unknown merge fields must block activation");

    await editor.evaluate((element) => {
      element.innerHTML = element.innerHTML.replace("{{unknown.field}}", "");
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContent" }));
    });
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByText("Draft saved", { exact: true }).waitFor();
    await waitForEnabled(page, page.getByRole("button", { name: "Review & activate" }));
    const savedDraft = state.templates.find((item) => item.status === "draft" && item.id !== state.templates.find((item) => item.name === "New Talent Agreement")?.id);
    assert.ok(savedDraft);
    assert.match(savedDraft.body, /<table>/);
    assert.match(savedDraft.body, /\{\{client\.legalEntityName\}\}/);
    const previewRequest = state.requests.filter((request) => request.method === "POST" && request.path.endsWith("/preview")).at(-1);
    assert.equal(previewRequest?.body?.body, savedDraft.body);
    const reviewedHash = savedDraft.reviewHash;

    await page.getByRole("button", { name: "Review & activate" }).click();
    const activationDialog = page.getByRole("dialog");
    await activationDialog.getByLabel(/Review and activation reason/).fill("Reviewed clause language and current approved terms.");
    await activationDialog.getByRole("checkbox").check();
    await activationDialog.getByRole("button", { name: "Confirm activation" }).click();
    await page.getByText("Template activated", { exact: true }).waitFor();
    const activationRequest = state.requests.find((request) => request.method === "POST" && request.path.endsWith("/activate"));
    assert.equal(activationRequest?.body?.reviewHash, reviewedHash);
    assert.equal(activationRequest?.body?.reviewed, true);
    assert.equal(activationRequest?.body?.reason, "Reviewed clause language and current approved terms.");
  } finally {
    await page.context().close();
  }
});

test("review-stale activation is not retried silently and non-Super Admin 403 is explicit", async () => {
  const state = freshState();
  state.templates.unshift({
    ...state.templates[0],
    id: "fixture-draft-stale",
    status: "draft",
    name: "Draft for stale review",
    version: "3.0",
    reviewHash: "review-stale-v1",
  });
  state.staleActivation = true;
  const { page } = await newHarness(state);
  try {
    await page.getByRole("button", { name: /Draft for stale review/ }).click();
    await waitForEnabled(page, page.getByRole("button", { name: "Review & activate" }));
    await page.getByRole("button", { name: "Review & activate" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Review and activation reason/).fill("Reviewed legal wording.");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Confirm activation" }).click();
    await page.getByText("Review is stale").waitFor();
    assert.equal(state.requests.filter((request) => request.method === "POST" && request.path.endsWith("/activate")).length, 1);
  } finally {
    await page.context().close();
  }

  const forbiddenState = freshState();
  forbiddenState.forbidden = true;
  const forbidden = await newHarness(forbiddenState);
  try {
    await forbidden.page.getByRole("heading", { name: "Super Admin access required" }).waitFor();
    assert.equal(forbiddenState.requests.filter((request) => request.method === "GET" && request.path === API).length, 1);
    assert.equal(await forbidden.page.getByText("No versions yet").count(), 0);
  } finally {
    await forbidden.page.context().close();
  }
});
