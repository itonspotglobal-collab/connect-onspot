import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser } from "playwright";

// Frontend-only fixture. Synthetic identities and intercepted APIs never reach
// the application server, database, signup endpoint or real authentication.
let vite: ViteDevServer;
let browser: Browser;
let base: string;
let warmed = false;
const cache = mkdtempSync(join(tmpdir(), "launch-banner-vite-"));
before(async () => {
  vite = await createServer({
    configFile: resolve("vite.config.ts"), cacheDir: cache,
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  await vite.listen();
  base = `http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}`;
  browser = await chromium.launch({
    headless: true, ignoreDefaultArgs: ["--hide-scrollbars"],
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
  });
});
after(async () => {
  await browser?.close();
  await vite?.close();
  rmSync(cache, { force: true, recursive: true });
});

async function open(width: number, path = "/", identity = "guest") {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(15000);
  // The first full-App navigation includes cold Vite compilation; keep the
  // interaction timeout separate rather than treating compiler startup as UI lag.
  page.setDefaultNavigationTimeout(60000);
  const user = { id: `banner-fixture-${identity}`, email: `${identity}@example.test`, role: identity,
    firstName: "Fixture", lastName: "Visitor", profileCompleted: true };
  await page.addInitScript(({ identity, user }) => {
    (window as any).__name = (fn: unknown) => fn;
    if (identity === "guest") return;
    const legacy = identity === "legacy-talent";
    const payload = legacy
      ? { type: "candidate", candidateId: user.id, email: user.email, exp: 4102444800 }
      : { userId: user.id, role: identity, exp: 4102444800 };
    const token = `${btoa("{}")}.${btoa(JSON.stringify(payload))}.fixture-signature`;
    localStorage.setItem(`onboarding_completed_${user.id}`, "true");
    if (legacy) {
      localStorage.setItem("talent_profile_token", JSON.stringify({
        token, candidateId: user.id, email: user.email, fullName: "Fixture Visitor",
      }));
    } else {
      localStorage.setItem("onspot_jwt_token", token);
      localStorage.setItem("onspot_user", JSON.stringify(user));
    }
  }, { identity, user });
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (/\/notifications\/hired-popup\/claim$/.test(url.pathname)) {
      return route.fulfill({ json: null });
    }
    assert.equal(route.request().method(), "GET", `Unexpected fixture write: ${url.pathname}`);
    if (url.pathname === "/api/talent-auth/me") {
      return route.fulfill({ json: { candidateId: user.id, email: user.email, fullName: "Fixture Visitor", profileCompleted: true } });
    }
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: user });
    return route.fulfill({ status: 404, json: { error: "API intentionally absent in banner-only fixture" } });
  });
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.locator("nav.nav-over-hero").first().waitFor({ timeout: 60000 });
  if (!warmed) {
    await page.waitForLoadState("networkidle");
    warmed = true;
  }
  return page;
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`guest homepage announcement and nav fit at ${width}px`, async () => {
    const page = await open(width);
    const banner = page.getByRole("region", { name: "Launch announcement" });
    await banner.waitFor();
    const expectedHeight = width <= 767 ? 56 : 38;
    const rect = await banner.boundingBox();
    assert.ok(rect);
    assert.equal(rect.y, 0);
    assert.equal(rect.height, expectedHeight);
    const styles = await banner.evaluate(el => {
      const c = getComputedStyle(el);
      return { background: c.backgroundColor, color: c.color, font: c.fontFamily };
    });
    assert.equal(styles.background, "rgb(255, 174, 33)");
    assert.equal(styles.color, "rgb(39, 38, 104)");
    assert.match(styles.font, /Inter/);
    assert.equal(await page.locator("nav.nav-over-hero").evaluate(el => el.getBoundingClientRect().top), expectedHeight);
    const spacer = await page.locator(".launch-banner-nav-shell > div[aria-hidden='true']").boundingBox();
    assert.equal(spacer?.height, 80 + expectedHeight);
    assert.match(await banner.innerText(), width <= 767
      ? /Launching soon\. Get early access first\./
      : /Launching soon\. Sign up in advance and be first in line for early access\./);
    assert.equal(await banner.getByRole("link", { name: "Get early access" }).getAttribute("href"), "/waitlist");
    assert.equal(await banner.getByRole("button").count(), 0, "no dismissal control");
    assert.ok(await banner.evaluate(el => [...el.querySelectorAll("*")].every(child => {
      if (!child.getBoundingClientRect().width) return true;
      const r = child.getBoundingClientRect(), p = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth && r.top >= p.top && r.bottom <= p.bottom;
    })), "banner copy and button must remain inside its fixed height");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.close();
  });
}

test("mobile menu is below banner plus nav and remains within the viewport", async () => {
  const page = await open(390);
  await page.getByRole("region", { name: "Launch announcement" }).waitFor();
  await page.getByTestId("mobile-menu-toggle").click();
  await page.waitForFunction(() => {
    const menu = document.querySelector(".mobile-menu-panel")!;
    return Math.abs(menu.getBoundingClientRect().top - 136) < 1;
  });
  const box = await page.locator(".mobile-menu-panel").boundingBox();
  assert.ok(box && box.y === 136 && box.y + box.height <= 901);
  await page.close();
});

test("both fixed menu definitions retain combined offsets, including the dormant mega menu", () => {
  // The existing guest desktop nav has simple links, not a visible mega-menu
  // trigger. Protect its dormant positioning without inventing a new nav item.
  const source = readFileSync("client/src/components/TopNavigation.tsx", "utf8");
  assert.equal([...source.matchAll(/top: ["']calc\(var\(--nav-h\) \+ var\(--banner-h, 0px\)\)["']/g)].length, 2);
  assert.doesNotMatch(source, /top: ["']var\(--nav-h\)["']/);
});

test("other routes have no banner or offset; early-access link uses SPA navigation", async () => {
  const page = await open(1440, "/find-work/jobs");
  assert.equal(await page.locator(".launch-banner").count(), 0);
  assert.equal(await page.locator("nav.nav-over-hero").evaluate(el => getComputedStyle(el).top), "0px");
  await page.getByTestId("logo-home").click();
  await page.getByRole("region", { name: "Launch announcement" }).waitFor();
  await page.evaluate(() => { (window as any).__launchNavigationMarker = "same-document"; });
  await page.getByRole("link", { name: "Get early access", exact: true }).click();
  await page.waitForURL("**/waitlist");
  assert.equal(await page.locator(".launch-banner").count(), 0);
  assert.equal(await page.evaluate(() => (window as any).__launchNavigationMarker), "same-document");
  await page.close();
});

for (const role of ["talent", "client", "admin", "legacy-talent"]) {
  test(`authenticated ${role} does not see the homepage announcement`, async () => {
    const page = await open(1440, "/", role);
    if (role === "client") await page.waitForURL("**/hire-talent");
    if (role === "admin") await page.waitForURL("**/admin/dashboard");
    assert.equal(await page.locator(".launch-banner").count(), 0);
    assert.equal(await page.locator("nav.nav-over-hero").first().evaluate(el => getComputedStyle(el).top), "0px");
    await page.close();
  });
}
