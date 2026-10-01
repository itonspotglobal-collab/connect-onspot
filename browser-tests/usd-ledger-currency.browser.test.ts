import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, Browser, Page, Route } from "playwright";

const PORT = Number(process.env.BROWSER_TEST_PORT ?? 5173);
const BASE_URL = process.env.BROWSER_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const SCREENSHOT_PATH = path.resolve(process.cwd(), "screenshots/usd-ledger.jpg");

let browser: Browser;
let vite: ChildProcess | undefined;

type LedgerResponse = {
  page: number;
  limit: number;
  pages: number;
  total: number;
  summary: {
    currency: string;
    gtv: string | null;
    outstanding_invoices: string | null;
    pending_payouts: string | null;
    deposits_at_risk: number;
    currencyTotals: {
      gtv: Array<{ currency: string; amount: string }>;
      outstanding_invoices: Array<{ currency: string; amount: string }>;
      pending_payouts: Array<{ currency: string; amount: string }>;
    };
    mixedCurrencies: boolean;
    currencyWarnings: string[];
  };
  items: unknown[];
};

const emptyUsdLedger: LedgerResponse = {
  page: 1,
  limit: 20,
  pages: 1,
  total: 0,
  summary: {
    currency: "USD",
    gtv: "0",
    outstanding_invoices: "0",
    pending_payouts: "0",
    deposits_at_risk: 0,
    currencyTotals: {
      gtv: [],
      outstanding_invoices: [],
      pending_payouts: [],
    },
    mixedCurrencies: false,
    currencyWarnings: [],
  },
  items: [],
};

// UI-only fixture for exercising legacy mixed-denomination summaries. These
// amounts mirror the denomination-separation case in the currency summary
// unit test; they are not production transactions and are never sent to a DB.
const mixedCurrencyLedger: LedgerResponse = {
  page: 1,
  limit: 20,
  pages: 1,
  total: 0,
  summary: {
    currency: "USD",
    gtv: null,
    outstanding_invoices: "100",
    pending_payouts: null,
    deposits_at_risk: 0,
    currencyTotals: {
      gtv: [
        { currency: "USD", amount: "100" },
        { currency: "PHP", amount: "30000" },
      ],
      outstanding_invoices: [{ currency: "USD", amount: "100" }],
      pending_payouts: [{ currency: "PHP", amount: "20000" }],
    },
    mixedCurrencies: true,
    currencyWarnings: [
      "Mixed currencies (PHP, USD): amounts are kept separate; no conversion or combined total was performed.",
      "gtv contains historical non-USD or unknown currency. Review its denomination-specific amounts before using a total.",
      "pending_payouts contains historical non-USD or unknown currency. Review its denomination-specific amounts before using a total.",
    ],
  },
  items: [],
};

const mixedPeriodLedger: LedgerResponse = {
  page: 1,
  limit: 20,
  pages: 1,
  total: 1,
  summary: {
    currency: "USD",
    gtv: null,
    outstanding_invoices: "120",
    pending_payouts: "100",
    deposits_at_risk: 0,
    currencyTotals: {
      gtv: [{ currency: "PHP", amount: "36000" }],
      outstanding_invoices: [{ currency: "USD", amount: "120" }],
      pending_payouts: [{ currency: "USD", amount: "100" }],
    },
    mixedCurrencies: true,
    currencyWarnings: [
      "Mixed currencies (PHP, USD): amounts are kept separate; no conversion or combined total was performed.",
      "gtv contains historical non-USD or unknown currency. Review its denomination-specific amounts before using a total.",
    ],
  },
  items: [
    {
      id: "ledger-mixed-period-browser-fixture",
      hiring_contract_id: "contract-mixed-period-browser-fixture",
      period_start: "2026-08-01",
      period_end: "2026-08-31",
      status: "invoiced",
      client_name: "Currency Regression Client",
      client_email: "client@example.test",
      talent_name: "Currency Regression Talent",
      talent_email: "talent@example.test",
      talent_rate: "30000",
      talent_rate_currency: "PHP",
      adjusted_talent_payout: "30000",
      client_invoice_amount: "36000",
      commission_earned: "6000",
      invoice_id: "invoice-mixed-period-browser-fixture",
      invoice_number: "INV-REGRESSION-120",
      invoice_status: "sent",
      invoice_amount: "120",
      invoice_currency: "USD",
      due_date: "2026-09-30",
      paid_at: null,
      payout_id: "payout-mixed-period-browser-fixture",
      payout_status: "scheduled",
      payout_amount: "100",
      payout_currency: "USD",
      payout_method: "wire",
      payout_external_ref: null,
      disbursed_at: null,
      failed_reason: null,
      deposit_id: null,
      deposit_status: null,
      deposit_amount: null,
      deposit_currency: null,
      outstanding_invoice_amount: "120",
      outstanding_payout_amount: "100",
    },
  ],
};

// Read-only production audit values exercised through the public job API/UI.
// Local fixture IDs are used because these production jobs are absent from the
// development DB; no production IDs or job records are created or modified.
const auditedPhpJobs = [
  {
    id: "browser-fixture-sales-representative-php",
    title: "Sales Representative",
    salaryDisplay: "30,000",
    expectedDisplay: "₱30,000",
  },
  {
    id: "browser-fixture-it-administrator-php",
    title: "IT Administrator",
    salaryDisplay: "40,000–60,000",
    expectedDisplay: "₱40,000 - ₱60,000",
  },
  {
    id: "browser-fixture-it-technical-support-php",
    title: "IT Technical Support",
    salaryDisplay: "30,000–40,000",
    expectedDisplay: "₱30,000 - ₱40,000",
  },
  {
    id: "browser-fixture-business-development-associate-php",
    title: "Business Development Associate",
    salaryDisplay: "35,000–45,000",
    expectedDisplay: "₱35,000 - ₱45,000",
  },
].map((job) => ({
  ...job,
  company: "Read-only Audit Fixture",
  location: "Remote",
  category: "Sales & Marketing",
  engagementType: "full-time",
  experienceLevel: "intermediate",
  description: "Read-only fixture for public PHP salary rendering regression.",
  jobSummary: "Public listing/detail currency display fixture.",
  budget: 0,
  budgetCurrency: "PHP",
  customCurrencyCode: null,
  status: "open",
  approvalStatus: "approved",
  createdAt: "2026-08-01T00:00:00.000Z",
  skillTags: [],
  responsibilities: [],
  requirements: [],
  benefits: null,
}));

async function waitForUrl(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function prepareLedgerPage(response: LedgerResponse): Promise<{
  page: Page;
  ledgerRequests: Array<{ authorization: string | undefined; method: string }>;
  writes: string[];
}> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const ledgerRequests: Array<{ authorization: string | undefined; method: string }> = [];
  const writes: string[] = [];

  // Keep every API request local to this test. In particular, never send the
  // test-only admin token to the running backend or any production service.
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method !== "GET") {
      writes.push(`${method} ${url.pathname}`);
      return fulfillJson(route, { error: "Read-only browser regression fixture" }, 405);
    }
    if (url.pathname === "/api/admin/ledger") {
      ledgerRequests.push({
        authorization: request.headers().authorization,
        method,
      });
      return fulfillJson(route, response);
    }
    if (url.pathname === "/api/admin/billing-contracts") {
      return fulfillJson(route, []);
    }

    // Shared navigation may query unrelated data; fulfill it without allowing
    // requests or fixture credentials to reach the application server.
    return fulfillJson(route, []);
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("onspot_jwt_token", "test-only-usd-ledger-admin-token");
    localStorage.setItem(
      "onspot_user",
      JSON.stringify({
        id: "usd-ledger-browser-regression",
        email: "usd-ledger-regression@example.test",
        first_name: "Ledger",
        last_name: "Regression",
        role: "admin",
      }),
    );
  });
  await page.goto(`${BASE_URL}/admin/ledger`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("admin-ledger-page").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByRole("heading", { name: "Billing Ledger" }).waitFor({ state: "visible" });

  return { page, ledgerRequests, writes };
}

async function preparePublicJobsPage(): Promise<{
  page: Page;
  searchRequests: string[];
  detailRequests: string[];
  viewRequests: string[];
  unexpectedWrites: string[];
}> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const searchRequests: string[] = [];
  const detailRequests: string[] = [];
  const viewRequests: string[] = [];
  const unexpectedWrites: string[] = [];
  const jobsById = new Map(auditedPhpJobs.map((job) => [job.id, job]));

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method === "POST" && /^\/api\/jobs\/[^/]+\/view$/.test(url.pathname)) {
      // This public page-view counter is explicitly fulfilled in-memory; it
      // never reaches the backend's database update handler.
      viewRequests.push(url.pathname);
      return fulfillJson(route, { ok: true });
    }
    if (method !== "GET") {
      unexpectedWrites.push(`${method} ${url.pathname}`);
      return fulfillJson(route, { error: "Read-only browser regression fixture" }, 405);
    }
    if (url.pathname === "/api/jobs/search") {
      searchRequests.push(url.pathname);
      return fulfillJson(route, {
        items: auditedPhpJobs,
        meta: { page: 1, pageSize: 25, total: auditedPhpJobs.length, totalPages: 1 },
      });
    }
    if (url.pathname === "/api/jobs/popular") return fulfillJson(route, []);

    const detailMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (detailMatch) {
      const id = decodeURIComponent(detailMatch[1]);
      const job = jobsById.get(id);
      if (job) {
        detailRequests.push(url.pathname);
        return fulfillJson(route, job);
      }
      return fulfillJson(route, { error: "Not found" }, 404);
    }

    // All other APIs are intercepted too, so no public page fixture can reach
    // a backend or send test data to a database.
    return fulfillJson(route, []);
  });

  await page.goto(`${BASE_URL}/find-work/jobs`, { waitUntil: "domcontentloaded" });
  return { page, searchRequests, detailRequests, viewRequests, unexpectedWrites };
}

async function summaryCard(page: Page, index: number) {
  return page
    .getByTestId("admin-ledger-page")
    .locator(":scope > div.grid")
    .first()
    .locator(":scope > div")
    .nth(index);
}

before(async () => {
  if (!process.env.BROWSER_BASE_URL) {
    const viteEnv = { ...process.env };
    delete viteEnv.REPL_ID;
    vite = spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT)],
      { stdio: "pipe", env: { ...viteEnv, NODE_ENV: "development" } },
    );
    vite.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    await waitForUrl(BASE_URL);
  }
  const launchOptions = process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { headless: true };
  browser = await chromium.launch(launchOptions);
});

after(async () => {
  await browser?.close();
  if (vite && !vite.killed) {
    vite.kill("SIGTERM");
    await Promise.race([
      once(vite, "exit"),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
});

test("empty development ledger renders USD zero summaries and saves a screenshot", async () => {
  const { page, ledgerRequests, writes } = await prepareLedgerPage(emptyUsdLedger);
  try {
    await page.getByText("0 total periods", { exact: true }).waitFor({ state: "visible" });
    for (const [index, label] of ["GTV", "Outstanding invoices", "Pending payouts"].entries()) {
      const card = await summaryCard(page, index);
      assert.ok(await card.getByText(label, { exact: true }).count(), `${label} card is visible`);
      assert.ok(await card.getByText("$0.00", { exact: true }).count(), `${label} displays USD zero`);
      assert.match(await card.innerText(), /USD/, `${label} identifies its denomination as USD`);
      assert.doesNotMatch(await card.innerText(), /₱/, `${label} must not display a peso amount`);
    }
    assert.ok(ledgerRequests.length > 0, "the ledger endpoint is exercised");
    assert.ok(
      ledgerRequests.every(
        (request) =>
          request.method === "GET" &&
          request.authorization === "Bearer test-only-usd-ledger-admin-token",
      ),
      "only the intercepted GET uses the test-only token",
    );
    assert.deepEqual(writes, [], "the read-only regression must not issue API mutations");

    await mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });
    await page.screenshot({
      path: SCREENSHOT_PATH,
      type: "jpeg",
      quality: 88,
      fullPage: true,
      animations: "disabled",
    });
  } finally {
    await page.context().close();
  }
});

test("mixed USD/PHP summaries remain denomination-specific with no combined total", async () => {
  const { page, ledgerRequests, writes } = await prepareLedgerPage(mixedCurrencyLedger);
  try {
    await page.getByTestId("ledger-currency-review").waitFor({ state: "visible" });
    const warning = page.getByRole("alert");
    assert.ok(
      await warning.getByText(
        "Currency review required — totals are not converted.",
        { exact: true },
      ).count(),
      "mixed denominations display the review warning",
    );
    assert.ok(
      await warning.getByText(
        "Mixed currencies (PHP, USD): amounts are kept separate; no conversion or combined total was performed.",
        { exact: true },
      ).count(),
      "warning explicitly says currencies are not combined or converted",
    );

    const gtvCard = await summaryCard(page, 0);
    const invoicesCard = await summaryCard(page, 1);
    const payoutsCard = await summaryCard(page, 2);
    assert.ok(await gtvCard.getByText("Review currencies", { exact: true }).count());
    assert.ok(await payoutsCard.getByText("Review currencies", { exact: true }).count());
    assert.ok(await invoicesCard.getByText("$100.00", { exact: true }).count());
    assert.equal(await page.getByText("$30,100.00", { exact: true }).count(), 0);

    for (const groupText of [
      "GTV: $100.00",
      "GTV: ₱30,000.00",
      "Outstanding invoices: $100.00",
      "Pending payouts: ₱20,000.00",
    ]) {
      assert.ok(await warning.getByText(groupText, { exact: true }).count(), `${groupText} stays separate`);
    }
    assert.ok(ledgerRequests.length > 0);
    assert.ok(ledgerRequests.every((request) => request.method === "GET"));
    assert.deepEqual(writes, [], "the mixed-currency fixture also remains read-only");
  } finally {
    await page.context().close();
  }
});

test("a PHP billing period keeps its own currency beside USD invoice and payout amounts", async () => {
  const { page, ledgerRequests, writes } = await prepareLedgerPage(mixedPeriodLedger);
  try {
    const row = page.getByTestId("ledger-row-ledger-mixed-period-browser-fixture");
    await row.waitFor({ state: "visible" });

    const periodCell = row.locator("td").nth(1);
    assert.ok(await periodCell.getByText("₱36,000.00", { exact: true }).count());
    assert.ok(await periodCell.getByText("Commission ₱6,000.00", { exact: true }).count());
    assert.ok(await periodCell.getByText("Rate ₱30,000.00", { exact: true }).count());
    assert.doesNotMatch(await periodCell.innerText(), /\$36,000\.00|\$6,000\.00|\$30,000\.00/);

    const invoiceCell = row.locator("td").nth(2);
    const payoutCell = row.locator("td").nth(3);
    assert.ok(await invoiceCell.getByText("$120.00", { exact: false }).count());
    assert.ok(await payoutCell.getByText("$100.00", { exact: true }).count());
    assert.doesNotMatch(await invoiceCell.innerText(), /₱/);
    assert.doesNotMatch(await payoutCell.innerText(), /₱/);

    const gtvCard = await summaryCard(page, 0);
    assert.ok(await gtvCard.getByText("Review currencies", { exact: true }).count());
    assert.ok(await page.getByRole("alert").getByText(
      "Mixed currencies (PHP, USD): amounts are kept separate; no conversion or combined total was performed.",
      { exact: true },
    ).count());
    assert.equal(await page.getByText("$36,220.00", { exact: true }).count(), 0);

    assert.ok(ledgerRequests.length > 0);
    assert.ok(ledgerRequests.every((request) => request.method === "GET"));
    assert.deepEqual(writes, [], "the row-pairing fixture is read-only");
  } finally {
    await page.context().close();
  }
});

test("public PHP salary audit fixtures retain peso prices in actual listing and detail UI", async () => {
  const { page, searchRequests, detailRequests, viewRequests, unexpectedWrites } =
    await preparePublicJobsPage();
  try {
    for (const job of auditedPhpJobs) {
      const title = page.getByRole("heading", { name: job.title, exact: true });
      await title.waitFor({ state: "visible", timeout: 10_000 });
      const card = title.locator("xpath=ancestor::article");
      assert.ok(
        await card.getByText(job.expectedDisplay, { exact: true }).count(),
        `${job.title} listing retains ${job.expectedDisplay}`,
      );
    }

    for (const job of auditedPhpJobs) {
      await page.goto(`${BASE_URL}/find-work/job/${job.id}`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: job.title, exact: true }).waitFor({
        state: "visible",
        timeout: 10_000,
      });
      const compensation = page.getByText("Monthly Compensation", { exact: true }).locator("xpath=..");
      assert.ok(
        await compensation.getByText(job.expectedDisplay, { exact: true }).count(),
        `${job.title} detail retains ${job.expectedDisplay}`,
      );
    }

    assert.ok(searchRequests.length > 0, "the actual public job-listing handler is exercised");
    assert.deepEqual(
      detailRequests,
      auditedPhpJobs.map((job) => `/api/jobs/${job.id}`),
      "each public detail route fetches its intercepted job fixture",
    );
    assert.ok(
      auditedPhpJobs.every((job) => viewRequests.includes(`/api/jobs/${job.id}/view`)),
      "public view-counter requests are intercepted in memory",
    );
    assert.deepEqual(unexpectedWrites, [], "no job fixture is written to the application or database");
  } finally {
    await page.context().close();
  }
});

const developmentSnapshotPath = process.env.USD_LEDGER_SNAPSHOT_PATH;
test(
  "read-only development snapshot renders PHP ledger totals and saves a provenance-labeled screenshot",
  { skip: !developmentSnapshotPath },
  async () => {
    const snapshotPath = path.resolve(developmentSnapshotPath!);
    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as LedgerResponse;
    assert.equal(snapshot.total, 1, "snapshot should retain the one SQL-returned ledger period");
    assert.equal(snapshot.items.length, 1);
    assert.deepEqual(snapshot.summary.currencyTotals.gtv, [
      { currency: "PHP", amount: "72000.00" },
    ]);
    assert.deepEqual(snapshot.summary.currencyTotals.outstanding_invoices, [
      { currency: "PHP", amount: "72000.00" },
    ]);
    assert.equal(snapshot.summary.pending_payouts, "0");

    const { page, ledgerRequests, writes } = await prepareLedgerPage(snapshot);
    try {
      await page.getByTestId("ledger-currency-review").waitFor({ state: "visible" });
      const warning = page.getByRole("alert");
      assert.ok(await warning.getByText("GTV: ₱72,000.00", { exact: true }).count());
      assert.ok(
        await warning.getByText("Outstanding invoices: ₱72,000.00", { exact: true }).count(),
      );
      assert.equal(await page.getByText("$72,000.00", { exact: true }).count(), 0);
      assert.ok(await (await summaryCard(page, 0)).getByText("Review currencies", { exact: true }).count());
      assert.ok(await (await summaryCard(page, 1)).getByText("Review currencies", { exact: true }).count());
      assert.ok(await (await summaryCard(page, 2)).getByText("$0.00", { exact: true }).count());
      assert.ok(ledgerRequests.length > 0);
      assert.ok(
        ledgerRequests.every(
          (request) =>
            request.method === "GET" &&
            request.authorization === "Bearer test-only-usd-ledger-admin-token",
        ),
        "snapshot is rendered through the intercepted browser-test session, not the live admin API",
      );
      assert.deepEqual(writes, [], "rendering the snapshot must not issue mutations");

      // Put provenance outside the React tree and crop before the contract
      // queue/create-period content. The sole row and amounts come from the
      // supplied read-only SQL snapshot; no contract fixture is added.
      await page.getByTestId("admin-ledger-page").evaluate((ledger) => {
        const notice = document.createElement("div");
        notice.textContent =
          "READ-ONLY DEVELOPMENT DATA SNAPSHOT · Browser-test session; not a live authenticated admin API request";
        notice.setAttribute("data-testid", "ledger-snapshot-provenance");
        notice.style.cssText =
          "box-sizing:border-box;width:100%;border-radius:8px;background:#172554;color:#fff;padding:8px 12px;text-align:center;font:600 12px/1.4 system-ui,sans-serif;letter-spacing:.01em";
        ledger.prepend(notice);
      });
      await page.getByTestId("ledger-snapshot-provenance").waitFor({ state: "visible" });
      const cropHeight = await page
        .getByText("Start a billing period", { exact: true })
        .locator("xpath=ancestor::div[contains(@class, 'shadcn-card')]")
        .evaluate((element) => Math.floor(element.getBoundingClientRect().top + window.scrollY - 12));
      assert.ok(cropHeight > 250 && cropHeight < 700, "crop ends before the billing-period card");

      await mkdir(path.dirname(path.resolve("screenshots/ledger-development-readonly.jpg")), {
        recursive: true,
      });
      await page.screenshot({
        path: path.resolve("screenshots/ledger-development-readonly.jpg"),
        type: "jpeg",
        quality: 90,
        clip: { x: 0, y: 0, width: 1440, height: cropHeight },
        animations: "disabled",
      });
    } finally {
      await page.context().close();
    }
  },
);