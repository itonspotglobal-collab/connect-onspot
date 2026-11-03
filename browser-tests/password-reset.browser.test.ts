import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium, type Browser } from "playwright";

// Actual public portal screens; only reset endpoints are mocked. No account
// credentials, inbox deliveries or application database writes are needed.
const base = new URL(process.env.PASSWORD_RESET_BROWSER_BASE_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}`);
assert.ok(base.hostname.endsWith(".replit.dev"), "Use the development preview, never the published app.");
let browser: Browser;
before(async () => {
  let executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (!executablePath) {
    try { executablePath = execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(); } catch { /* Playwright-managed browser. */ }
  }
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  await mkdir("generated-artifacts/password-reset", { recursive: true });
});
after(async () => { await browser?.close(); });

for (const role of ["talent", "client"] as const) {
  test(`${role} public portal: code stages, resend, invalid-code feedback, password visibility and return to sign-in`, { timeout: 90_000 }, async () => {
    const context = await browser.newContext({ viewport: role === "talent" ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
    const page = await context.newPage();
    const requests: any[] = [], confirmations: any[] = [];
    try {
      await page.clock.install();
      await page.route("**/api/auth/password-reset/**", async route => {
        const body = route.request().postDataJSON();
        if (route.request().url().endsWith("/request")) {
          requests.push(body);
          return route.fulfill({ json: { success: true, message: "If an account exists for that email, we've sent a 6-digit code." } });
        }
        confirmations.push(body);
        return body.code === "001234"
          ? route.fulfill({ json: { success: true, message: "Password updated. Please sign in." } })
          : route.fulfill({ status: 400, json: { success: false, message: "That code is invalid or has expired." } });
      });
      await page.goto(new URL(`/login/${role}`, base).href, { waitUntil: "domcontentloaded", timeout: 60_000 });
      const forgot = page.getByRole("button", { name: /Forgot password/i });
      await forgot.waitFor({ state: "visible", timeout: 60_000 }); await forgot.click();
      await page.getByLabel("Email Address", { exact: true }).fill("ResetFixture@Example.test");
      assert.equal(await page.getByLabel("6-digit code", { exact: true }).count(), 0);
      await page.getByRole("button", { name: "Send code", exact: true }).click();
      const code = page.getByLabel("6-digit code", { exact: true });
      await code.waitFor();
      assert.deepEqual(requests, [{ email: "resetfixture@example.test", role }]);
      assert.equal(await code.getAttribute("inputmode"), "numeric");
      assert.equal(await code.getAttribute("autocomplete"), "one-time-code");
      assert.equal(await page.getByRole("button", { name: /Resend code in/ }).isDisabled(), true);
      await page.clock.runFor(60_100);
      const resend = page.getByRole("button", { name: "Resend code", exact: true });
      await resend.waitFor(); assert.equal(await resend.isDisabled(), false); await resend.click();
      await page.getByRole("button", { name: /Resend code in/ }).waitFor();
      assert.equal(requests.length, 2);
      await code.fill("12a3");
      assert.equal(await code.inputValue(), "123");
      const reset = page.getByRole("button", { name: "Reset password", exact: true });
      assert.equal(await reset.isDisabled(), true);
      await code.fill("999999");
      const next = page.getByLabel("New Password", { exact: true });
      const repeat = page.getByLabel("Confirm New Password", { exact: true });
      await next.fill("Browser-Fixture-Password-123!");
      await repeat.fill("Different-Fixture-123!");
      assert.equal(await reset.isDisabled(), true);
      await repeat.fill("Browser-Fixture-Password-123!");
      assert.equal(await next.getAttribute("type"), "password");
      await page.getByRole("button", { name: "Show password", exact: true }).click();
      assert.equal(await next.getAttribute("type"), "text");
      await page.getByRole("button", { name: "Hide password", exact: true }).click();
      await reset.click();
      await page.getByText("That code is invalid or has expired.", { exact: true }).waitFor();
      assert.equal(confirmations.length, 1);
      const box = await code.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= page.viewportSize()!.width);
      await page.screenshot({ path: `generated-artifacts/password-reset/${role}-code-stage.png` });
      await code.fill("001234"); await reset.click();
      await page.getByText("Password updated. Please sign in.", { exact: true }).waitFor();
      const email = page.locator("#login-email");
      await email.waitFor();
      assert.equal(await email.inputValue(), "resetfixture@example.test");
      assert.equal(confirmations.at(-1).code, "001234");
      assert.equal(await page.locator('input[autocomplete="current-password"]').inputValue(), "");
      assert.equal(await page.getByRole("heading", { name: "Reset Password", exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes("Browser-Fixture-Password-123!")), false);
      assert.equal(new URL(page.url()).searchParams.has("code"), false);
    } finally { await context.close(); }
  });
}
