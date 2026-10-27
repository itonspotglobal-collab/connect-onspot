import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Route } from "playwright";

let vite: ViteDevServer;
let browser: Browser;
let baseUrl = "";
const cache = mkdtempSync(join(tmpdir(), "onspot-client-payment-page-"));
const screenshotDir = resolve("generated-artifacts/client-payment-page");

const obligationFixture = () => ({
  category: "invoice",
  id: "fixture-invoice",
  reference: "INV-FIXTURE-2026-08",
  amount: "4860.00",
  currency: "USD",
  payerId: "fixture-client",
  status: "sent",
  paymentStatus: "awaiting_payment",
  payable: true,
  direction: "incoming",
  companyName: "Fixture Company",
  issuedAt: "2026-07-01T00:00:00.000Z",
  dueAt: "2099-08-15T00:00:00.000Z",
  period: "July 2026",
  lineItems: [{
    name: "Customer support specialist",
    description: "Customer support specialist · 160 hrs",
    amount: "4860.00",
  }],
  verifiedAt: null,
  instructions: {
    id: "fixture-config",
    recipient: "Fixture OnSpot recipient",
    instructions: "Fixture transfer instructions. Do not use outside this browser test.",
    referenceInstructions: "Include INV-FIXTURE-2026-08 as the transfer reference.",
    qrFileId: null,
    currency: "USD",
  },
  history: [] as Array<Record<string, unknown>>,
});

async function fulfill(route: Route, value: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
}

before(async () => {
  mkdirSync(screenshotDir, { recursive: true });
  vite = await createServer({
    configFile: false,
    root: resolve("client"),
    cacheDir: cache,
    resolve: {
      alias: {
        "@": resolve("client/src"),
        "@shared": resolve("shared"),
        "@assets": resolve("attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      noDiscovery: true,
      include: [
        "react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime",
        "@tanstack/react-query", "@radix-ui/react-dialog", "@radix-ui/react-slot", "axios",
        "lucide-react", "clsx", "tailwind-merge", "class-variance-authority",
        "use-sync-external-store", "use-sync-external-store/shim/index.js", "use-sync-external-store/shim/with-selector",
      ],
    },
    plugins: [react(), {
      name: "client-payment-page-fixture",
      resolveId(id) { if (id === "/__payment-page.tsx") return id; },
      load(id) {
        if (id !== "/__payment-page.tsx") return;
        return `
          import React from "react";
          import { createRoot } from "react-dom/client";
          import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
          import { Route, Router } from "wouter";
          import ClientPaymentPage from "/src/pages/client/ClientPaymentPage.tsx";
          import "/src/index.css";
          const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
          createRoot(document.getElementById("root")).render(
            <QueryClientProvider client={queryClient}>
              <Router><Route path="/client/payments/:category/:id" component={ClientPaymentPage}/></Router>
            </QueryClientProvider>
          );
        `;
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.headers.accept?.includes("text/html")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(await server.transformIndexHtml("/", '<html><body><div id="root"></div><script type="module" src="/__payment-page.tsx"></script></body></html>'));
        });
      },
    }],
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();
  baseUrl = `http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
  const warmup = await browser.newPage();
  await warmup.addInitScript(() => localStorage.setItem("onspot_jwt_token", "disposable-payment-fixture-token"));
  await warmup.route("**/api/manual-wise/obligations/**", (route) => fulfill(route, obligationFixture()));
  await warmup.goto(`${baseUrl}/client/payments/invoice/fixture-invoice`, { waitUntil: "networkidle" });
  await warmup.getByText("Invoice for Fixture Company").waitFor({ timeout: 10000 });
  await warmup.close();
});

after(async () => {
  await browser?.close();
  await vite?.close();
  rmSync(cache, { recursive: true, force: true });
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`direct client invoice checkout at ${viewport.width}px preserves invoice detail and receipt semantics`, async () => {
    const obligation = obligationFixture();
    const page = await browser.newPage({ viewport });
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    page.on("requestfailed", (request) => browserErrors.push(`request failed: ${request.url()} ${request.failure()?.errorText || ""}`));
    page.on("response", (response) => {
      if (response.status() >= 400) browserErrors.push(`http ${response.status()}: ${response.url()}`);
    });
    await page.addInitScript(() => localStorage.setItem("onspot_jwt_token", "disposable-payment-fixture-token"));
    await page.route("**/api/manual-wise/obligations/invoice/fixture-invoice", (route) => fulfill(route, obligation));
    await page.route("**/api/manual-wise/obligations/invoice/fixture-invoice/proofs", async (route) => {
      assert.equal(route.request().method(), "POST");
      assert.match(route.request().headers().authorization || "", /Bearer disposable-payment-fixture-token/);
      assert.match(route.request().headers()["content-type"] || "", /^multipart\/form-data; boundary=/);
      assert.match(route.request().postData() || "", /WISE-FIXTURE-CLAIM/);
      obligation.paymentStatus = "verification_pending";
      obligation.payable = false;
      obligation.history.push({
        id: "proof-fixture",
        status: "verification_pending",
        reference: "WISE-FIXTURE-CLAIM",
        amount: "4860.00",
        currency: "USD",
        receipt_id: null,
        receipt_name: "fixture-receipt.png",
        created_at: "2026-07-02T12:00:00.000Z",
        rejection_reason: null,
      });
      return fulfill(route, { id: "proof-fixture", status: "verification_pending" }, 201);
    });

    await page.goto(`${baseUrl}/client/payments/invoice/fixture-invoice`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const renderedText = await page.locator("#root").innerText().catch(() => "");
    assert.ok(renderedText, `Payment page did not render. Browser errors: ${browserErrors.join("\n")}; document=${await page.locator("body").innerHTML().catch(() => "")}`);
    await page.getByText("Customer support specialist · 160 hrs").waitFor({ timeout: 5000 });
    await page.getByText("$4,860.00", { exact: true }).first().waitFor();
    await page.getByText("QR code not configured").waitFor();
    assert.equal(await page.getByText("Due Aug 15, 2099").count(), 1);
    assert.equal(await page.getByText("Paid ✓").count(), 0);
    assert.equal(await page.locator("img[alt*='QR']").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    await page.screenshot({
      path: join(screenshotDir, `invoice-${viewport.width}.png`),
      fullPage: true,
      animations: "disabled",
    });

    await page.getByRole("button", { name: "I've sent the payment" }).click();
    await page.getByLabel("Transfer reference").fill("WISE-FIXTURE-CLAIM");
    await page.getByLabel(/Receipt file/).setInputFiles({
      name: "fixture-receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLYsAAAAASUVORK5CYII=", "base64"),
    });
    await page.getByRole("button", { name: "Submit payment proof" }).click();
    await page.getByText("Payment received — verifying (up to 24 hours)").waitFor();
    assert.equal(await page.getByText("Paid ✓").count(), 0, "receipt submission must never claim settled payment");
    assert.equal(await page.getByText(/independently confirm settlement/).count(), 1);
    await page.close();
  });
}

test("missing due metadata does not invent a due-on-receipt term; verified state uses canonical date", async () => {
  const obligation = {
    ...obligationFixture(),
    dueAt: null,
    status: "paid",
    paymentStatus: "paid" as const,
    payable: false,
    verifiedAt: "2026-07-02T12:00:00.000Z",
  };
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => localStorage.setItem("onspot_jwt_token", "disposable-payment-fixture-token"));
  await page.route("**/api/manual-wise/obligations/invoice/fixture-invoice", (route) => fulfill(route, obligation));
  await page.goto(`${baseUrl}/client/payments/invoice/fixture-invoice`, { waitUntil: "networkidle" });
  await page.getByText("Due date not specified").waitFor();
  await page.getByText("Paid ✓").waitFor();
  await page.getByText(/Independently verified on/).waitFor();
  assert.equal(await page.getByText("Due upon receipt").count(), 0);
  await page.close();
});

for (const category of ["deposit", "monthly_invoice", "invoice", "hiring_invoice", "replenishment", "inquiry"] as const) {
  test(`direct checkout accepts incoming ${category} obligations`, async () => {
    const obligation = { ...obligationFixture(), category };
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => localStorage.setItem("onspot_jwt_token", "disposable-payment-fixture-token"));
    await page.route("**/api/manual-wise/obligations/**", (route) => fulfill(route, obligation));
    await page.goto(`${baseUrl}/client/payments/${category}/fixture-invoice`, { waitUntil: "networkidle" });
    await page.getByText("Invoice for Fixture Company").waitFor();
    assert.equal(await page.getByText("Payment category unavailable").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    await page.close();
  });
}
