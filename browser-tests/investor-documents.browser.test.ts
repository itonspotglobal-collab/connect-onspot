import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Page } from "playwright";

let vite: ViteDevServer;
let browser: Browser;
let base: string;
let fixtureWarmed = false;
const cacheDir = mkdtempSync(join(tmpdir(), "investor-docs-vite-"));
const screenshotDir = resolve("generated-artifacts/investor-request");
function markMockFixture(page: Page) {
  return page.evaluate(() => {
    const badge = document.createElement("div");
    badge.textContent = "MOCKED BROWSER FIXTURE · NO EMAIL SENT";
    badge.style.cssText = "position:fixed;z-index:10000;right:12px;bottom:12px;padding:7px 10px;border-radius:6px;background:#151a5e;color:#fff;font:700 10px/1.2 sans-serif;letter-spacing:.06em;box-shadow:0 2px 10px #151a5e44";
    document.body.appendChild(badge);
  });
}
before(async () => {
  vite = await createServer({
    configFile: false, root: resolve("client"), publicDir: resolve("public"), cacheDir,
    resolve: { alias: { "@": resolve("client/src"), "@shared": resolve("shared"), "@assets": resolve("attached_assets") } },
    optimizeDeps: {
      noDiscovery: true,
      include: ["react", "react-dom/client", "react/jsx-runtime", "@radix-ui/react-dialog",
        "@tanstack/react-query", "wouter", "lucide-react", "clsx", "tailwind-merge", "axios"],
    },
    plugins: [react(), {
      name: "investor-document-fixture",
      resolveId(id) { if (id === "/__investor-fixture.tsx") return id; },
      load(id) {
        if (id !== "/__investor-fixture.tsx") return;
        return `
          import React from 'react'; import {createRoot} from 'react-dom/client';
          import InvestorsCorner from '/src/pages/InvestorsCorner.tsx';
          import WhyOnSpotAbout from '/src/pages/WhyOnSpotAbout.tsx';
          import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
          import {InvestorGoalSettings} from '/src/components/InvestorGoalSettings.tsx';
          import '/src/index.css';
          const settings={investor_goal_total:'10000',investor_goal_contractors_2027:'{CONTRACTOR_GOAL}',investor_goal_clients_2027:'{CLIENT_GOAL}'};
          createRoot(document.getElementById('root')).render(location.pathname==='/settings'
            ? <QueryClientProvider client={new QueryClient()}><InvestorGoalSettings settings={settings}/></QueryClientProvider>
            : <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
                {location.pathname==='/why-onspot/about' ? <WhyOnSpotAbout/> : <InvestorsCorner/>}
              </QueryClientProvider>);
        `;
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === "/reference") {
            res.setHeader("Content-Type", "text/html");
            res.end(readFileSync("attached_assets/0_OnSpot_Investors_Page_1792064719023.html", "utf8"));
            return;
          }
          if (!req.headers.accept?.includes("text/html")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(await server.transformIndexHtml("/", '<html><body><div id="root"></div><script type="module" src="/__investor-fixture.tsx"></script></body></html>'));
        });
      },
    }],
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();
  base = `http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}`;
  browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ["--hide-scrollbars"],
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});
after(async () => { await browser?.close(); await vite?.close(); rmSync(cacheDir, { recursive: true, force: true }); });

async function openPage(width = 1280, height = 900, statsHandler?: Parameters<Page["route"]>[1], clock = false,
  goalsHandler?: Parameters<Page["route"]>[1]) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
  if (clock) await page.clock.install();
  await page.bringToFront();
  await page.addInitScript(() => { (window as any).__name = (fn: unknown) => fn; });
  await page.route("**/api/public/investor-stats", statsHandler ?? (route =>
    route.fulfill({ json: { contractorAccounts: 1234, clientAccounts: 56, asOf: "2026-10-16T08:00:00.000Z" } })));
  await page.route("**/api/public/investor-goals", goalsHandler ?? (route =>
    route.fulfill({ json: { totalGoal: 10_000, contractorGoal2027: 10_000, clientGoal2027: 1_000 } })));
  await page.goto(`${base}/investors`,{waitUntil:"domcontentloaded"});
  await page.locator("h1").waitFor();
  // Let the isolated Vite dependency warm-up/reload finish before opening dialogs.
  if (!fixtureWarmed) {
    await page.waitForLoadState("networkidle");
    await page.locator("h1").waitFor();
    fixtureWarmed = true;
  }
  return page;
}

test("direct URL, refreshed content and unchanged reference narrative preserve investment links", async () => {
  const page = await openPage();
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("h1").waitFor();
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.title(), "Invest in OnSpot — A Letter From Our CEO");
  assert.match((await page.locator('meta[name="description"]').getAttribute("content"))!, /A letter from Nur Laminero/);
  const logo = page.locator(".investor-top img");
  assert.equal(await logo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), true);
  assert.equal(await page.locator(".investor-top a").getAttribute("href"), "/");
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  const actual = normalize(await page.locator(".onspot-investors-page").innerText());
  const headline = "OnSpot is the unified outsourcing system where businesses find, hire, pay, and manage vetted remote talent in one place, and talent earns more doing it.";
  assert.equal(normalize(await page.locator("h1").innerText()), headline);
  assert.equal(await page.locator("h1 .investor-highlight").count(), 2);
  assert.equal(await page.locator("h1 .investor-highlight").allTextContents().then(v => v.map(normalize).join("|")),
    "unified outsourcing system|earns more");
  const referenceMap = readFileSync("attached_assets/onspot_investors_polished_v7_1793709287845.html", "utf8")
    .match(/<svg class="hero-map"[\s\S]*?<\/svg>/)![0];
  assert.equal(await page.locator(".hero-map .land").getAttribute("d"),
    referenceMap.match(/<path class="land" d="([^"]+)"/)![1]);
  assert.equal(await page.locator(".hero-map .arc").count(), 6);
  assert.equal(await page.locator(".hero-map").getAttribute("aria-hidden"), "true");
  assert.equal(actual.split(headline).length - 1, 1);
  assert.doesNotMatch(await page.locator(".investor-open").innerText(), /Hi, I.m Nur Laminero/);
  assert.equal(normalize(await page.locator(".investor-fact").first().innerText()),
    "7 days As fast as 7 days for businesses to find, hire, and to start global talent");
  const letter = page.locator(".investor-letter p").filter({ hasText: "We spent four years running a BPO" });
  assert.equal(normalize(await letter.innerText()),
    "We spent four years running a BPO before building this platform. We did not guess at the problem. We lived inside it, and we built OnSpot from operational truth rather than theory. We are already self-sustaining. Operations are fully covered by revenue before a single dollar of external investment.");
  assert.deepEqual(await letter.locator("strong").allTextContents().then(values => values.map(normalize)),
    ["We did not guess at the problem. We lived inside it", "We are already self-sustaining."]);
  assert.equal(normalize(await page.locator("#investor-invest-title").innerText()), "Invest in the Future of Work today.");
  assert.ok(await page.locator("#investor-invest-title strong, #investor-invest-title em, #investor-invest-title span").filter({ hasText: "Future of Work" }).count());
  const reference = await browser.newPage();
  await reference.goto(`${base}/reference`);
  const expected = await reference.locator("main").innerText();
  for (const line of expected.split("\n").map(normalize).filter(Boolean)) {
    // The approved update supersedes these reference passages only.
    if (line === "A letter from Nur Laminero" ||
      /^OnSpot is the unified outsourcing system/.test(line) ||
      /^(Hi, I.m Nur Laminero|We.re the unified outsourcing|As fast as 7 days|My co-founders Jake|Invest in OnSpot today|Co-Founder and CEO|Today, businesses|With OnSpot|We spent four years|We are raising|A world where)/.test(line) ||
      ["NL", "J", "M", "Macky"].includes(line)) continue;
    assert.ok(actual.includes(line), `Missing reference text: ${line}`);
  }
  assert.equal(await page.locator("#investor-letter-title").innerText(), "A letter from the founders.");
  const teamPhoto = page.locator(".investor-letter-visual > img");
  // Lazy images outside the initial viewport cannot finish decode until requested.
  await teamPhoto.scrollIntoViewIfNeeded();
  await teamPhoto.evaluate((el: HTMLImageElement) => el.decode());
  assert.ok(await teamPhoto.evaluate((el: HTMLImageElement) => el.naturalWidth > 0));
  assert.doesNotMatch((await teamPhoto.getAttribute("src"))!, /unsplash/i);
  assert.equal(await teamPhoto.getAttribute("alt"), "OnSpot co-founders Mark Apostol, Jake Wainberg, and Nur Laminero");
  assert.equal(await page.locator(".investor-letter-inset").count(), 0);
  assert.equal(normalize(await page.locator(".investor-vision").innerText()),
    "We are raising capital to launch, to scale, and to liberate how the world does meaningful work. A world where anyone can work anywhere, and every company can hire anyone, without limits.");
  assert.equal(await page.locator(".investor-footer p").innerText(),
    "© 2026 OnSpot. All rights reserved. This page is for information only and is not an offer to sell securities.");
  assert.doesNotMatch(actual, /you may lose your entire investment|© 2026 OnSpot Global/);
  const founders = page.locator(".investor-signatures");
  assert.match(await founders.innerText(), /Nur Laminero/);
  assert.match(await founders.innerText(), /Jake Wainberg/);
  assert.match(await founders.innerText(), /Mark Apostol/);
  assert.deepEqual(await founders.locator(".investor-sign b").allTextContents(), ["Nur Laminero", "Jake Wainberg", "Mark Apostol"]);
  assert.deepEqual(await founders.locator(".investor-sign span:not([role='img'])").allTextContents(), ["Co-Founder & CEO", "Co-Founder & President", "Co-Founder & COO"]);
  assert.equal(await founders.locator("img").count(), 3);
  for (const image of await founders.locator("img").all()) {
    assert.ok(await image.getAttribute("alt"));
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((el: HTMLImageElement) => el.decode());
    assert.ok(await image.evaluate((el: HTMLImageElement) => el.naturalWidth > 0));
  }
  assert.equal(await founders.locator(".investor-sign img").count(), 3);
  assert.equal(await founders.locator('img[src="/mark-apostol.png"]').count(), 1);
  const phone = page.locator(".investor-open img");
  assert.equal(await phone.count(), 1);
  await phone.evaluate((el: HTMLImageElement) => el.decode());
  assert.ok(await phone.evaluate((el: HTMLImageElement) => el.naturalWidth > 0));
  assert.equal(await page.locator(".investor-phone").count(), 1);
  for (const image of await page.locator(".onspot-investors-page img").all()) {
    const decorative=await image.evaluate(el=>!!el.closest('[aria-hidden="true"]'));
    assert.ok(decorative ? await image.getAttribute("alt")!==null : (await image.getAttribute("alt"))?.trim());
    assert.ok(Number(await image.getAttribute("width")) > 0);
    assert.ok(Number(await image.getAttribute("height")) > 0);
  }
  for (const image of await page.locator(".investor-signatures img, .investor-collage img, .investor-vision-section img").all()) {
    assert.equal(await image.getAttribute("loading"), "lazy");
  }
  const wefunder = page.getByRole("link", { name: /WeFunder/ });
  assert.equal(await wefunder.getAttribute("href"), "https://wefunder.com/onspot");
  assert.equal(await wefunder.getAttribute("target"), "_blank");
  assert.match((await wefunder.getAttribute("rel"))!, /noopener/);
  assert.match((await wefunder.getAttribute("rel"))!, /noreferrer/);
  assert.equal(await page.locator("a[download]").count(), 0);
  await reference.close();
  await page.close();
});

test("AI future-of-work section preserves reference copy, heading order, Inter and independent animation", async () => {
  const page = await openPage();
  const section = page.locator(".investor-ai");
  assert.equal(await section.count(), 1);
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await section.locator("h2").count(), 1);
  const heading = section.locator("h2.investor-ai-lead");
  assert.equal(await section.getAttribute("aria-labelledby"), await heading.getAttribute("id"));
  assert.ok(await section.evaluate(el =>
    el.previousElementSibling?.classList.contains("investor-letter") &&
    el.nextElementSibling?.classList.contains("investor-vision-section")));
  const reference = readFileSync("attached_assets/onspot_investors_polished_v8_1_1793893705548.html", "utf8")
    .match(/<section class="ai">[\s\S]*?<\/section>/)![0];
  const expected = await page.evaluate(html =>
    new DOMParser().parseFromString(html, "text/html").body.textContent!.replace(/\s+/g, " ").trim(), reference);
  assert.equal((await section.innerText()).replace(/\s+/g, " ").trim(), expected);
  assert.doesNotMatch(await section.innerText(), /—/);
  assert.equal(await section.locator(".investor-ai-body").count(), 2);
  assert.ok(await section.evaluate(el => [...el.querySelectorAll("*")].every(child =>
    getComputedStyle(child).fontFamily.includes("Inter") && Number(getComputedStyle(child).fontWeight) <= 700)));
  assert.ok(await section.evaluate(el => [el, ...el.querySelectorAll("[class]")].every(child =>
    [...child.classList].every(name => name === "investor-ai" || name.startsWith("investor-ai-")))));
  assert.equal(await page.locator("#investorAiGradient").count(), 1);
  assert.equal(await section.locator('svg:not([aria-hidden="true"])').count(), 0);
  assert.equal(await section.locator(".investor-ai-pattern").getAttribute("aria-hidden"), "true");
  assert.equal(await section.locator(".investor-ai-link").first().evaluate(el => getComputedStyle(el).animationName), "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.equal(await section.locator(".investor-ai-link").first().evaluate(el => getComputedStyle(el).animationName), "investor-ai-dash");
  const heroArc = page.locator(".hero-map .arc").first();
  const heroAnimation = await heroArc.evaluate(el => ({
    name: getComputedStyle(el).animationName,
    running: el.getAnimations().some(animation => animation.playState === "running"),
    offset: getComputedStyle(el).strokeDashoffset,
  }));
  assert.equal(heroAnimation.name, "investor-map-dash");
  assert.equal(heroAnimation.running, true);
  await page.waitForTimeout(120);
  assert.notEqual(await heroArc.evaluate(el => getComputedStyle(el).strokeDashoffset), heroAnimation.offset);
  await page.close();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`AI future-of-work section is contained and responsive at ${width}px`, async () => {
    const page = await openPage(width, 900);
    const section = page.locator(".investor-ai");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await section.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth;
    }));
    const layout = await section.evaluate(el => {
      const style = (name: string) => getComputedStyle(el.querySelector(name)!);
      const lead = style(".investor-ai-lead"), body = style(".investor-ai-body");
      return { sticky: style(".investor-ai-side").position,
        illustrationWidth: el.querySelector(".investor-ai-art")!.getBoundingClientRect().width,
        headingSize: parseFloat(lead.fontSize), closingSize: parseFloat(style(".investor-ai-close strong").fontSize),
        headingWeight: lead.fontWeight, headingSpacing: lead.letterSpacing,
        bodySize: body.fontSize, bodyWeight: body.fontWeight, bodyLineHeight: body.lineHeight,
        paddingTop: getComputedStyle(el).paddingTop,
        background: getComputedStyle(el).backgroundColor };
    });
    assert.equal(layout.sticky, width <= 900 ? "static" : "sticky");
    assert.ok(layout.illustrationWidth <= (width <= 900 ? 300 : 380));
    assert.ok(layout.headingSize > layout.closingSize);
    assert.equal(layout.headingWeight, "700");
    assert.ok(Math.abs(parseFloat(layout.headingSpacing) / layout.headingSize + .025) < .001);
    assert.equal(layout.bodySize, "17px");
    assert.equal(layout.bodyWeight, "400");
    assert.ok(Math.abs(parseFloat(layout.bodyLineHeight) - 28.9) < .1);
    assert.equal(layout.paddingTop, width <= 600 ? "56px" : width <= 900 ? "72px" : "96px");
    assert.equal(layout.background, "rgb(245, 246, 253)");
    if (width > 900) {
      await section.evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 170));
      assert.ok(Math.abs(await section.locator(".investor-ai-side").evaluate(el => el.getBoundingClientRect().top) - 40) < 1,
        "the sidebar really sticks to the viewport, not an overflow-hidden ancestor");
    }
    const cards = section.locator(".investor-ai-shift-item");
    assert.equal(await cards.count(), 3);
    const heights = await cards.evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().height));
    assert.ok(Math.max(...heights) - Math.min(...heights) < 1, "shift cards remain equal peers");
    if (width <= 600) {
      assert.equal(await cards.first().evaluate(el => getComputedStyle(el).display), "flex");
      for (const selector of [".investor-ai-premium", ".investor-ai-close"]) {
        assert.equal(await section.locator(selector).evaluate(el => getComputedStyle(el).padding), "22px 20px");
      }
    }
    await cards.first().hover();
    assert.equal(await cards.first().evaluate(el => getComputedStyle(el).transform), "none", "reduced motion prevents hover lift");
    await page.close();
  });
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`Investors hero phone canvas fits without scroll or headline overlap at ${width}px`, async () => {
    const page = await openPage(width, 900);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const headline = await page.locator("#investor-open-title").boundingBox();
    const stage = await page.locator(".investor-phone-stage").boundingBox();
    assert.ok(headline && stage);
    const actualPhone = await page.locator(".investor-phone").evaluate(el => {
      const r=el.getBoundingClientRect();
      return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};
    });
    assert.ok(actualPhone.left >= stage.x - 2 && actualPhone.right <= stage.x + stage.width + 2,
      "visible phone pixels must fit inside the responsive stage");
    assert.ok(actualPhone.top >= stage.y - 2 && actualPhone.bottom <= stage.y + stage.height + 2,
      "visible phone pixels must not be cropped vertically");
    const separated =
      actualPhone.bottom <= headline.y + 2 ||
      actualPhone.top >= headline.y + headline.height - 2 ||
      actualPhone.right <= headline.x + 2 ||
      actualPhone.left >= headline.x + headline.width - 2;
    assert.equal(separated, true, "visible phone pixels and headline must not overlap");
    await page.close();
  });
}

test("traction refresh behavior is preserved and page and portaled dialog use homepage Inter", async () => {
  let loads = 0;
  const page = await openPage(1280, 900, route => {
    loads++;
    return route.fulfill({ json: {
      contractorAccounts: loads === 1 ? 1234 : 1235,
      clientAccounts: loads === 1 ? 56 : 55,
      asOf: "2026-10-16T08:00:00.000Z",
    } });
  }, true);
  await page.getByText("1,234", { exact: true }).waitFor();
  assert.equal(await page.locator(".investor-traction-card b").allTextContents().then(v => v.join("|")), "1,234|56");
  const progress = page.getByRole("progressbar", { name: /Registered Talent/ });
  const clientProgress = page.getByRole("progressbar", { name: /Registered Clients/ });
  await progress.waitFor(); await clientProgress.waitFor();
  assert.equal(await progress.getAttribute("aria-valuenow"), "1234");
  assert.equal(await progress.getAttribute("aria-valuemax"), "10000");
  assert.equal(await clientProgress.getAttribute("aria-valuenow"), "56");
  assert.equal(await clientProgress.getAttribute("aria-valuemax"), "1000");
  await page.clock.fastForward(60_001);
  await page.getByText("1,235", { exact: true }).waitFor();
  assert.deepEqual(await page.locator(".investor-traction-card b").allTextContents(), ["1,235", "55"]);
  await page.getByRole("button", { name: /Meet the Founders/ }).click();
  for (const selector of [".onspot-investors-page h1", ".investor-traction-card b",
    ".investor-footer p", ".investor-request-dialog input", ".investor-request-dialog button"]) {
    const font = await page.locator(selector).first().evaluate(el => getComputedStyle(el).fontFamily);
    assert.match(font, /Inter/);
    assert.doesNotMatch(font, /Mont/);
  }
  await page.close();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`Founding Team has five honest profiles in order and fits ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    page.setDefaultTimeout(10_000);
    await page.addInitScript(() => { (window as any).__name = (fn: unknown) => fn; });
    await page.goto(`${base}/why-onspot/about#team`);
    const team = page.locator("#team");
    const names = team.locator(".about-grid-leaders > div > div:last-child > p:first-child");
    await names.first().waitFor();
    assert.deepEqual((await names.allTextContents()).map(name => name.replace(" (Emman)", "")),
      ["Nur Laminero", "Jake Wainberg", "Mark Apostol", "Val Legaspi", "Emmanuel Rogel"]);
    assert.doesNotMatch(await team.innerText(), /Leadership/);
    assert.ok(await page.getByRole("button", { name: "Founding Team", exact: true, includeHidden: true }).count());
    const cards = team.locator(".about-grid-leaders > div");
    assert.equal(await cards.count(), 5);
    // These previously-placeholder profiles already have supplied biographies.
    // Assert the current baseline without altering the About page's content.
    assert.match(await cards.nth(3).innerText(), /ENGINEER AND DEVELOPER/);
    assert.match(await cards.nth(3).innerText(), /5 years building software and scaling platforms for startups/);
    assert.match(await cards.nth(4).innerText(), /PRODUCT LEAD/);
    assert.match(await cards.nth(4).innerText(), /10 years shaping products where operations meets technology/);
    for (const index of [3, 4]) {
      assert.doesNotMatch(await cards.nth(index).innerText(), /pending approval|Co-Founder|CEO|COO|President/i);
    }
    assert.doesNotMatch(await cards.nth(4).innerText(), /photo.*pending|pending.*photo/i);
    const emmanuelPortrait = cards.nth(4).getByRole("img", { name: "Portrait of Emmanuel Rogel (Emman)", exact: true });
    assert.equal(await emmanuelPortrait.count(), 1);
    assert.match((await emmanuelPortrait.getAttribute("src"))!, /Emmanuel-Rogel-SQ-q0s6ffiw7u0jzm1b71e6bbnjr4v828gbc89fummsnc_1793095503773\.jpg/);
    assert.deepEqual(await emmanuelPortrait.evaluate(el => {
      const style = getComputedStyle(el);
      return [style.objectFit, style.objectPosition];
    }), ["cover", "50% 15%"]);
    const valPortrait = cards.nth(3).getByRole("img", { name: "Portrait of Val Legaspi", exact: true });
    assert.equal(await valPortrait.count(), 1);
    assert.match((await valPortrait.getAttribute("src"))!, /val\.photo_1793095419044\.jpg/);
    assert.deepEqual(await valPortrait.evaluate(el => {
      const style = getComputedStyle(el);
      return [style.objectFit, style.objectPosition, getComputedStyle(el.parentElement!).transform];
    }), ["cover", "50% 5%", "none"]);
    assert.equal(await team.locator("img").count(), 5);
    for (const image of await team.locator("img").all()) {
      assert.ok(await image.getAttribute("alt"));
      await image.evaluate((el: HTMLImageElement) => el.decode());
      assert.ok(await image.evaluate((el: HTMLImageElement) => el.naturalWidth > 0));
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const card of await cards.all()) {
      const bounds = await card.boundingBox();
      assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1);
    }
    if (width === 390 || width === 768 || width === 1440) {
      await team.screenshot({ path: `/tmp/onspot-founding-team-${width}.png`, animations: "disabled" });
    }
    await page.close();
  });
}

test("role goal meters retain true counts, cap progress and respect reduced motion", async () => {
  const page = await openPage(390, 844, route => route.fulfill({ json: {
    contractorAccounts: 12_000,
    clientAccounts: 345,
    asOf: "2026-10-16T08:00:00.000Z",
  } }));
  const progress = page.getByRole("progressbar", { name: /Registered Talent/ });
  await progress.waitFor();
  assert.deepEqual(await page.locator(".investor-traction-card b").allTextContents(), ["12,000", "345"]);
  assert.equal(await page.locator(".investor-goal-percent").first().innerText(), "100%");
  assert.equal(await progress.getAttribute("aria-valuenow"), "10000");
  assert.match((await progress.getAttribute("aria-valuetext"))!, /12,000 of 10,000/);
  assert.equal(await progress.locator(".investor-meter-fill").evaluate(el => getComputedStyle(el).transitionDuration), "0s");
  assert.equal(await progress.locator(".investor-meter-fill").evaluate(el => el.getBoundingClientRect().width),
    await progress.evaluate(el => el.getBoundingClientRect().width));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.close();
});

test("investor goal errors offer a retry without hiding account cards", async () => {
  let calls = 0;
  const page = await openPage(390, 844, undefined, false, route => {
    calls++;
    return calls === 1
      ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
      : route.fulfill({ json: { totalGoal: 10_000, contractorGoal2027: 10_000, clientGoal2027: 1_000 } });
  });
  await page.getByText("Account goals are temporarily unavailable.").waitFor();
  assert.deepEqual(await page.locator(".investor-traction-card b").allTextContents(), ["1,234", "56"]);
  await page.getByRole("button", { name: "Try again" }).last().click();
  await page.getByRole("progressbar", { name: /Registered Talent/ }).waitFor();
  await page.close();
});

test("role meters use v7 percentage precision and retain visible zero-value knobs", async () => {
  let count = 9;
  const page = await openPage(390, 844, route => route.fulfill({ json: {
    contractorAccounts: count, clientAccounts: 0, asOf: "2026-10-16T08:00:00.000Z",
  } }));
  for (const [nextCount, expected] of [[9, "0.09%"], [120, "1.2%"], [1200, "12%"], [0, "0%"]] as const) {
    count = nextCount;
    if (nextCount !== 9) await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("progressbar", { name: /Registered Talent/ }).waitFor();
    assert.equal(await page.locator(".investor-goal-percent").first().innerText(), expected);
  }
  for (const bar of await page.getByRole("progressbar").all()) {
    assert.equal(await bar.getAttribute("aria-valuenow"), "0");
    const track = await bar.boundingBox();
    const knob = await bar.locator(".investor-meter-knob").boundingBox();
    assert.ok(track && knob && knob.x >= track.x - 1 && knob.x + knob.width <= track.x + track.width + 1,
      "zero-value knob must remain fully visible within the track");
  }
  await page.close();
});

test("unset role goals never invent progress or hide actual counts", async () => {
  const page = await openPage(390, 844, undefined, false, route => route.fulfill({ json: {
    totalGoal: 10000, contractorGoal2027: null, clientGoal2027: null,
  } }));
  await page.getByText("A 2027 goal has not been set.").first().waitFor();
  assert.deepEqual(await page.locator(".investor-traction-card b").allTextContents(), ["1,234", "56"]);
  assert.equal(await page.getByRole("progressbar").count(), 0);
  await page.close();
});

test("traction loading and unavailable states never fabricate zero and can retry", async () => {
  let release: (() => void) | undefined;
  let calls = 0;
  const page = await openPage(390, 844, async route => {
    calls++;
    if (calls === 1) await new Promise<void>(resolve => { release = resolve; });
    return calls === 1
      ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
      : route.fulfill({ json: { contractorAccounts: 0, clientAccounts: 7, asOf: "2026-10-16T08:00:00.000Z" } });
  });
  await page.locator(".investor-traction-loading").first().waitFor();
  assert.equal(await page.locator(".investor-traction-card b").count(), 0);
  release?.();
  await page.locator(".investor-traction-unavailable").waitFor();
  assert.equal(await page.locator(".investor-traction-card b").count(), 0);
  await page.locator(".investor-traction-unavailable button").click();
  await page.locator(".investor-traction-card b").first().waitFor();
  assert.deepEqual(await page.locator(".investor-traction-card b").allTextContents(), ["0", "7"]);
  await page.close();
});

test("invalid aggregate responses are unavailable rather than plausible numbers", async () => {
  const page = await openPage(1280, 900, route => route.fulfill({
    json: { contractorAccounts: -1, clientAccounts: 99, asOf: "not-a-date" },
  }));
  await page.locator(".investor-traction-unavailable").waitFor();
  assert.equal(await page.locator(".investor-traction-card b").count(), 0);
  await page.close();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`page and both request dialogs fit ${width}px with no horizontal overflow`, async () => {
    const page = await openPage(width, width === 320 ? 568 : 844);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (width === 390 || width === 1440) {
      await page.locator(".investor-open img").evaluate((el: HTMLImageElement) => el.decode());
      await page.locator(".investor-open").screenshot({ path: `/tmp/onspot-investor-hero-${width}.png`, animations: "disabled" });
    }
    for (const name of [/Meet the Founders/, /Seedscope/]) {
      const card = page.getByRole("button", { name });
      await card.click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      const layout = await dialog.evaluate((el) => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
          width: innerWidth, height: innerHeight, bg: s.backgroundColor, color: s.color };
      });
      assert.ok(layout.left >= 0 && layout.right <= layout.width + 1, JSON.stringify(layout));
      assert.ok(layout.top >= 0 && layout.bottom <= layout.height + 1, JSON.stringify(layout));
      assert.equal(layout.bg, "rgb(255, 255, 255)");
      assert.notEqual(layout.color, layout.bg);
      if (width === 320) {
        assert.equal(await dialog.locator("textarea").getAttribute("maxlength"), "1500");
        assert.equal(await dialog.locator("textarea").getAttribute("rows"), "4");
        const scrollState = await dialog.evaluate(el => ({
          overflowY: getComputedStyle(el).overflowY,
          overflowX: getComputedStyle(el).overflowX,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        }));
        assert.equal(scrollState.overflowY, "auto");
        assert.ok(scrollState.scrollHeight > scrollState.clientHeight, JSON.stringify(scrollState));
        assert.equal(scrollState.overflowX, "hidden");
      }
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await page.waitForFunction(el => el === document.activeElement, await card.elementHandle());
      assert.equal(await card.evaluate((el) => el === document.activeElement), true);
    }
    await page.close();
  });
}

test("validation and typing keep focus, and submit carries document provenance", async () => {
  mkdirSync(screenshotDir, { recursive: true });
  const page = await openPage(390, 844);
  let submitted: unknown;
  await page.route("**/api/public/investor-document-requests", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: "test-lead", notificationStatus: "sent", documentAvailable: false } });
  });
  await page.getByRole("button", { name: /Meet the Founders/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Get the pitch deck", exact: true }).click();
  assert.equal(await dialog.locator('input[aria-invalid="true"]').count(), 3);
  const name = dialog.getByLabel("First name");
  await name.pressSequentially("Avery", { delay: 25 });
  assert.equal(await name.inputValue(), "Avery");
  assert.equal(await name.evaluate(el => el === document.activeElement), true);
  await dialog.getByLabel("Email", { exact: true }).fill("avery@example.org");
  const phone = dialog.getByLabel("Contact number");
  await phone.fill("123-456");
  await dialog.getByRole("button", { name: "Get the pitch deck", exact: true }).click();
  assert.equal(await phone.evaluate(el => el === document.activeElement), true);
  assert.equal(await phone.getAttribute("type"), "tel");
  assert.equal(await phone.getAttribute("autocomplete"), "tel");
  assert.match(await dialog.innerText(), /Enter a valid contact number, including country code\./);
  await phone.fill("+1 (415) 555-0198");
  const inquiry = dialog.getByLabel("Inquiry (optional)");
  await inquiry.fill("x".repeat(1501));
  assert.equal(await inquiry.inputValue().then(value => value.length), 1500);
  assert.equal(await dialog.locator("#investor-document-inquiry-counter").innerText(), "1500/1500");
  const inquiryText = "I’d love to learn more about your expansion plans.";
  await inquiry.fill(inquiryText);
  assert.equal(await dialog.locator("#investor-document-inquiry-counter").innerText(), `${inquiryText.length}/1500`);
  await markMockFixture(page);
  await page.screenshot({ path: join(screenshotDir, "form.png"), animations: "disabled" });
  await dialog.getByRole("button", { name: "Get the pitch deck", exact: true }).click();
  await dialog.getByRole("status").waitFor();
  assert.deepEqual(submitted, {
    firstName: "Avery",
    email: "avery@example.org",
    phone: "+1 (415) 555-0198",
    inquiry: inquiryText,
    requestedDocument: "deck",
    source: "investors-page",
    website: "",
  });
  assert.match((await dialog.textContent())!, /We've received your request for the OnSpot pitch deck/);
  assert.equal(await dialog.locator(".investor-doc-result strong").innerText(), "Thank you, Avery.");
  assert.equal(await dialog.locator(".investor-doc-result p").innerText(),
    "We've received your request for the OnSpot pitch deck. Our founders will review it personally and be in touch with you by email.");
  assert.doesNotMatch(await dialog.getByRole("status").innerText(), /@/);
  assert.equal(await dialog.locator("a[download]").count(), 0);
  await page.screenshot({ path: join(screenshotDir, "confirmation-sent.png"), animations: "disabled" });
  await page.close();
});

for (const outcome of ["notification-failed", "server-error", "network-error", "pending"] as const) {
  test(`valuation form honestly handles ${outcome}`, async () => {
    mkdirSync(screenshotDir, { recursive: true });
    const page = await openPage();
    let release: (() => void) | undefined;
    await page.route("**/api/public/investor-document-requests", async (route) => {
      assert.equal(route.request().postDataJSON().requestedDocument, "valuation");
      if (outcome === "network-error") return route.abort();
      if (outcome === "pending") await new Promise<void>(resolve => { release = resolve; });
      return outcome === "server-error"
        ? route.fulfill({ status: 503, json: { error: "Request could not be saved. Please try again." } })
        : route.fulfill({ status: 201, json: { id: "test-lead", notificationStatus: "failed", documentAvailable: false } });
    });
    await page.getByRole("button", { name: /Seedscope/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("First name").fill("Avery");
    await dialog.getByLabel("Email", { exact: true }).fill("avery@example.org");
    await dialog.getByLabel("Contact number").fill("+1 415 555 0198");
    await dialog.getByRole("button", { name: "Get the valuation summary", exact: true }).click();
    if (outcome === "pending") {
      const pending = dialog.getByRole("button", { name: "Saving request…" });
      await pending.waitFor();
      assert.equal(await pending.isDisabled(), true);
      release?.();
    }
    if (outcome === "server-error") {
      await dialog.getByRole("alert").waitFor();
      assert.equal(await dialog.getByRole("status").count(), 0);
    } else {
      await dialog.getByRole("status").waitFor();
      const content = await dialog.textContent();
      if (outcome === "network-error") assert.match(content!, /couldn’t confirm/);
      else assert.match(content!, /We've received your request/);
    }
    if (outcome === "notification-failed") {
      assert.match(await dialog.locator('[role="status"]').innerText(), /Thank you, Avery\./);
      assert.match(await dialog.locator('[role="status"]').innerText(), /investors@onspotglobal\.com/);
      assert.equal(await dialog.locator(".investor-doc-result p").innerText(),
        "We've received your request. If you don't hear from us soon, please contact investors@onspotglobal.com. There's no need to submit the form again.");
      assert.deepEqual((await dialog.getByRole("status").innerText()).match(/\S+@\S+/g), ["investors@onspotglobal.com."]);
      await markMockFixture(page);
      await page.screenshot({ path: join(screenshotDir, "confirmation-failed.png"), animations: "disabled" });
    }
    await page.close();
  });
}

// The new approved letter replaces the old gauge-based public presentation.
// Preserve coverage of its still-existing administrative goal controls.
test("existing Platform Settings form saves positive goals and can clear them", async () => {
  const page = await browser.newPage();
  const saved: Record<string, string>[] = [];
  await page.route("**/api/admin/platform-settings", (route) => {
    saved.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true } });
  });
  await page.goto(`${base}/settings`);
  await page.locator("#investor_goal_contractors_2027").fill("12000");
  await page.locator("#investor_goal_clients_2027").fill("1500");
  await page.locator("#investor_goal_total").fill("15000");
  await page.getByRole("button", { name: "Save Investor Goals" }).click();
  await page.waitForFunction(() => !(document.querySelector("button") as HTMLButtonElement)?.textContent?.includes("Saving"));
  assert.deepEqual(saved[0], {
    investor_goal_total: "15000",
    investor_goal_contractors_2027: "12000",
    investor_goal_clients_2027: "1500",
  });
  await page.locator("#investor_goal_clients_2027").fill("0");
  assert.equal(await page.getByRole("button", { name: "Save Investor Goals" }).isDisabled(), true);
  await page.locator("#investor_goal_clients_2027").fill("");
  await page.getByRole("button", { name: "Save Investor Goals" }).click();
  await page.waitForFunction(() => !(document.querySelector("button") as HTMLButtonElement)?.textContent?.includes("Saving"));
  assert.equal(saved[1].investor_goal_clients_2027, "");
  await page.close();
});
