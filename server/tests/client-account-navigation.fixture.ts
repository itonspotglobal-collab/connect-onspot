// Import the real-auth, owned-database fixture, including its automatic email
// regression cases. Graph is simulated; all routes, logins and persistence are real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Page } from "playwright";
import { query } from "../db";
import { browser, base, logins, ids, api } from "./client-application-status.fixture";

const jobs = {
  draft: randomUUID(), pending: randomUUID(), open: randomUUID(),
  closed: randomUUID(), disposable: randomUUID(), foreign: randomUUID(),
};
const applications: Record<string, string> = {};
const title = (kind: string) => `NAV ${kind} position`;

// Seed in the serial test stream, after the imported fixture's async startup
// and status regressions, rather than racing an independent root before hook.
test("Navigation records use the authenticated fixture's owned accounts", async () => {
  for (const [kind, id] of Object.entries(jobs)) {
    await query(`INSERT INTO jobs
      (id,client_id,title,description,category,status,approval_status,experience_level,
       application_method,budget,budget_currency,work_days,engagement_type,billing_mode,created_at)
      VALUES ($1,$2,$3,'Disposable navigation verification','Customer Service',$4,$5,
       'intermediate','built_in_form',1250,'USD','Monday-Friday','Standard','tracked',NOW()+$6::interval)`,
    [id, kind === "foreign" ? ids.other : ids.client, title(kind),
      kind === "draft" ? "draft" : kind === "closed" ? "closed" : "open",
      kind === "pending" || kind === "draft" ? "pending" : "approved", `${Object.keys(jobs).indexOf(kind)} minutes`]);
  }
  for (const [index, status] of Array.from(["new","under_review","reviewed","shortlisted","rejected","client_shortlist"].entries())) {
    const id = randomUUID(); applications[status] = id;
    await query(`INSERT INTO job_submissions
      (id,job_id,client_id,talent_id,email,first_name,last_name,applicant_name,status,
       workflow_type,initiated_by,registration_status,submitted_at)
      VALUES ($1,$2,$3,$4,$5,'Private','Fixture','Private Fixture',$6,$7,$8,'registered',NOW()+$9::interval)`,
    [id, jobs.open, ids.client, ids.talent, `${ids.talent}@example.test`,
      status === "client_shortlist" ? "shortlisted" : status,
      status === "client_shortlist" ? "client_shortlist" : "application",
      status === "client_shortlist" ? "client" : "talent", `${index} minutes`]);
  }
  await query("UPDATE job_submissions SET applicant_name=NULL WHERE id=$1",[applications.reviewed]);
});

async function pageFor(who = "client", width = 1440) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  if (who !== "anonymous") {
    await page.addInitScript((login) => {
      localStorage.setItem("onspot_jwt_token", login.token);
      localStorage.setItem("onspot_user", JSON.stringify(login.user));
    }, logins[who]);
  }
  return page;
}
async function checkMetric(page: Page, id: string, count: number) {
  const metric = page.getByTestId(id);
  await metric.waitFor();
  const value = await metric.getAttribute("data-value");
  if (value !== null) assert.equal(Number(value), count, id);
  else assert.match(await metric.innerText(), new RegExp(`\\b${count}\\b`), id);
}
async function choose(page: Page, index: number, option: string) {
  await page.getByRole("combobox").nth(index).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("Client sidebar exposes both guarded management pages in Core Modules order with active state", { timeout: 60000 }, async () => {
  const page = await pageFor();
  try {
    await page.goto(base + "/client/job-postings");
    await page.getByRole("heading", { name: "Job Postings", exact: true, level: 1 }).waitFor();
    const ordered = await page.locator('.client-portal-sidebar [data-testid^="nav-"]').evaluateAll(elements =>
      elements.slice(0, 6).map(element => element.textContent?.trim()));
    assert.deepEqual(ordered, ["Dashboard","Find Talent","Job Postings","Job Submissions","Messages","Interviews"]);
    assert.equal(await page.getByTestId("nav-job-postings").getAttribute("data-active"), "true");
    await page.getByTestId("nav-job-submissions").click();
    await page.getByRole("heading", { name: "Job Submissions", exact: true, level: 1 }).waitFor();
    assert.equal(await page.getByTestId("nav-job-submissions").getAttribute("data-active"), "true");
    for (const item of ["team","billing","monthly-invoices","contracts","contract-end-requests","timesheets","client-profile","settings"]) {
      assert.equal(await page.getByTestId(`nav-${item}`).count(), 1, item);
    }
  } finally { await page.close(); }
});

test("Job and application summaries use canonical, unique, authorized API records", { timeout: 60000 }, async () => {
  const page = await pageFor();
  try {
    const jobList = (await api("GET", "/api/client/jobs")).body;
    assert.ok(!jobList.some((job: any) => job.id === jobs.foreign));
    await page.goto(base + "/client/job-postings");
    await checkMetric(page,"jobs-count-all", jobList.length);
    await checkMetric(page,"jobs-count-drafts", jobList.filter((job: any) => job.status === "draft").length);
    await checkMetric(page,"jobs-count-pending", jobList.filter((job: any) => job.status !== "draft" && job.approval_status === "pending").length);
    await checkMetric(page,"jobs-count-open", jobList.filter((job: any) => job.status === "open").length);
    await checkMetric(page,"jobs-count-closed", jobList.filter((job: any) => ["closed","cancelled","completed"].includes(job.status)).length);
    const submissions = (await api("GET", "/api/client/job-submissions")).body;
    assert.ok(!submissions.some((application: any) => application.id === applications.client_shortlist));
    assert.equal(new Set(submissions.map((application: any) => application.id)).size, submissions.length);
    await page.getByTestId("nav-job-submissions").click();
    await checkMetric(page,"submissions-count-total",submissions.length);
    for (const [name, statuses] of Object.entries({
      new:["new"],"under-review":["under_review","reviewed"],shortlisted:["shortlisted"],rejected:["rejected"],
    })) await checkMetric(page,`submissions-count-${name}`, submissions.filter((application: any) => statuses.includes(application.status)).length);
    assert.equal(await page.getByTestId(`client-application-${applications.client_shortlist}`).count(),0);
    assert.ok(!(await page.locator("main").innerText()).includes(`${ids.talent}@example.test`));
  } finally { await page.close(); }
});

test("Client Profile has compact three-record previews with navigation, not management controls", { timeout: 60000 }, async () => {
  const page = await pageFor();
  const reads: string[] = [];
  page.on("request", request => {
    if (request.method() === "GET" && ["/api/client/jobs","/api/client/job-submissions"].some(path => request.url().endsWith(path))) reads.push(request.url());
  });
  try {
    await page.goto(base + "/client-profile");
    const postings = page.getByTestId("client-jobs-preview");
    const submissions = page.getByTestId("client-submissions-preview");
    await postings.getByRole("link",{name:/View All Job Postings/i}).waitFor();
    await submissions.getByRole("link",{name:/View All Submissions/i}).waitFor();
    assert.ok((await postings.innerText()).includes(title("disposable")));
    assert.equal(await postings.locator('[data-testid^="client-job-"]').count(), 3);
    assert.equal(await submissions.locator('[data-testid^="client-application-"]').count(), 3);
    assert.equal(await postings.getByRole("button",{name:/Invite|Close|Reopen|Edit|Delete/i}).count(),0);
    assert.equal(await submissions.getByRole("button",{name:/Message|Update Status|Extend Offer/i}).count(),0);
    assert.equal(await page.locator("main table").count(),0);
    assert.equal(reads.filter(url=>url.endsWith("/api/client/jobs")).length,1);
    assert.equal(reads.filter(url=>url.endsWith("/api/client/job-submissions")).length,1);
    await postings.getByRole("link",{name:/View All Job Postings/i}).click();
    await page.getByRole("heading",{name:"Job Postings",exact:true,level:1}).waitFor();
    await page.getByTestId("nav-client-profile").click();
    await page.getByTestId("client-submissions-preview").getByRole("link",{name:/View All Submissions/i}).click();
    await page.getByRole("heading",{name:"Job Submissions",exact:true,level:1}).waitFor();
  } finally { await page.close(); }
});

test("Existing job preview, close/reopen, edit and delete actions remain wired to their original endpoints", { timeout: 60000 }, async () => {
  const page = await pageFor();
  const writes: string[] = [];
  page.on("request", request => { if (["PATCH","DELETE","POST"].includes(request.method()) && request.url().includes("/api/client/jobs/")) writes.push(`${request.method()} ${request.url()}`); });
  try {
    await page.goto(base + "/client/job-postings");
    const row = page.getByTestId(`client-job-${jobs.disposable}`); await row.waitFor();
    await row.getByRole("button",{name:"View",exact:true}).click();
    await page.getByRole("dialog").getByText(title("disposable"),{exact:true}).waitFor();
    await page.getByRole("dialog").getByRole("button",{name:"Close",exact:true}).click();
    await row.getByRole("button",{name:"Close",exact:true}).click();
    await row.getByRole("button",{name:"Reopen",exact:true}).waitFor();
    await row.getByRole("button",{name:"Reopen",exact:true}).click();
    await row.getByRole("button",{name:"Close",exact:true}).waitFor();
    assert.equal(writes.filter(item=>item.includes("/status")).length,2);
    assert.equal((await query("SELECT status,approval_status FROM jobs WHERE id=$1",[jobs.disposable])).rows[0].approval_status,"approved");
    await row.getByRole("button",{name:/delete/i}).click();
    await page.getByRole("alertdialog").getByRole("button",{name:"Delete",exact:true}).click();
    await row.waitFor({state:"hidden"});
    assert.equal((await query("SELECT id FROM jobs WHERE id=$1",[jobs.disposable])).rowCount,0);
    assert.equal(writes.filter(item=>item.startsWith("DELETE")).length,1);
    await page.getByTestId(`client-job-${jobs.draft}`).getByRole("button",{name:/Continue Editing/i}).click();
    await page.waitForURL(`**/client/jobs/${jobs.draft}/edit`);
  } finally { await page.close(); }
});

test("Search, job/status filters and ordering retain context across existing application details", { timeout: 60000 }, async () => {
  const page = await pageFor();
  try {
    await page.goto(base + "/client/job-submissions");
    await page.getByRole("heading",{name:"Job Submissions",exact:true,level:1}).waitFor();
    const search = page.getByPlaceholder(/search/i).first();
    await search.fill(title("open"));
    await choose(page,0,title("open"));
    await choose(page,1,"Under Review");
    await page.getByTestId(`client-application-${applications.reviewed}`).waitFor();
    await page.getByTestId(`client-application-${applications.under_review}`).waitFor();
    assert.equal(await page.locator('[data-testid^="client-application-"]').count(),2);
    await search.fill("Talent Profile");
    await page.getByTestId(`client-application-${applications.reviewed}`).waitFor();
    assert.equal(await page.locator('[data-testid^="client-application-"]').count(),1);
    await search.fill(title("open"));
    const row = page.getByTestId(`client-application-${applications.reviewed}`);
    await row.getByRole("button",{name:/view/i}).click();
    await page.getByText("Update application status",{exact:true}).waitFor();
    await page.getByRole("dialog").getByRole("button",{name:"Close",exact:true}).click();
    assert.equal(await search.inputValue(),title("open"));
    assert.equal(await page.locator('[data-testid^="client-application-"]').count(),2);
    await choose(page,1,"All statuses");
    await choose(page,2,"Oldest first");
    const firstId = await page.locator('[data-testid^="client-application-"]').first().getAttribute("data-testid");
    assert.equal(firstId,`client-application-${applications.new}`);
    await search.fill("No such application 88421");
    await page.getByText(/No applications match these filters/i).waitFor();
    await search.fill("");
    await choose(page,0,"All job postings");
    await choose(page,2,"Newest first");
    const firstPage = await page.locator('[data-testid^="client-application-"]').evaluateAll(rows=>rows.map(row=>row.getAttribute("data-testid")));
    assert.equal(firstPage.length,10);
    await page.getByTestId("button-submissions-next").click();
    const secondPage = await page.locator('[data-testid^="client-application-"]').evaluateAll(rows=>rows.map(row=>row.getAttribute("data-testid")));
    assert.equal(secondPage.length,10);
    assert.ok(secondPage.every(id=>!firstPage.includes(id)));
    await page.getByTestId("button-submissions-previous").click();
    assert.deepEqual(await page.locator('[data-testid^="client-application-"]').evaluateAll(rows=>rows.map(row=>row.getAttribute("data-testid"))),firstPage);
  } finally { await page.close(); }
});

test("Legacy Profile links preserve application identity; missing or foreign resources do not disclose content", { timeout: 60000 }, async () => {
  const page = await pageFor();
  try {
    await page.goto(base + `/client-profile?applicationId=${applications.new}&jobId=${jobs.open}`);
    await page.getByText("Update application status",{exact:true}).waitFor();
    assert.ok(page.url().includes(`/client/job-submissions?`));
    assert.ok(page.url().includes(`applicationId=${applications.new}`));
    await page.goto(base + `/client/job-submissions?applicationId=${randomUUID()}`);
    await page.getByText(/unavailable|not associated with your account/i).first().waitFor();
    assert.equal(await page.getByRole("dialog").count(),0);
    await page.goto(base + `/client/job-postings?jobId=${jobs.draft}`);
    await page.getByRole("dialog").getByText(title("draft"),{exact:true}).waitFor();
    await page.goto(base + `/client/job-postings?jobId=${jobs.foreign}`);
    await page.getByText(/unavailable|not associated with your account/i).first().waitFor();
    assert.equal(await page.getByText(title("foreign"),{exact:true}).count(),0);
  } finally { await page.close(); }
});

test("Unauthorized roles cannot load Client data or modify Client jobs through the new destinations", { timeout: 60000 }, async () => {
  for (const who of ["talent","admin","anonymous"]) {
    const page = await pageFor(who);
    try {
      for (const route of ["/client/job-postings","/client/job-submissions"]) {
        await page.goto(base + route);
        assert.equal(await page.getByRole("heading",{name:/^Job (Postings|Submissions)$/}).count(),0,who);
      }
      assert.ok([401,403].includes((await api("GET","/api/client/jobs",who)).status));
      const submissions = await api("GET","/api/client/job-submissions",who);
      // Preserve the existing role-neutral read endpoint's empty owner-scoped
      // response; only the new Client UI and Client mutations are role-gated.
      if (submissions.status === 200) assert.deepEqual(submissions.body, []);
      else assert.ok([401,403].includes(submissions.status));
    } finally { await page.close(); }
  }
  assert.equal((await api("GET",`/api/client/jobs/${jobs.foreign}`)).status,404);
  assert.ok([403,404].includes((await api("PATCH",`/api/client/jobs/${jobs.foreign}/status`,"client",{status:"closed"})).status));
});

test("Loading and network failure states never pretend that jobs or applications are empty", { timeout: 60000 }, async () => {
  for (const [route,apiPath] of [["/client/job-postings","/api/client/jobs"],["/client/job-submissions","/api/client/job-submissions"]]) {
    const page = await pageFor();
    try {
      await page.route(`**${apiPath}`,intercept=>intercept.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Synthetic unavailable service"})}));
      await page.goto(base + route);
      await page.getByRole("button",{name:/retry|try again/i}).waitFor();
      await page.unroute(`**${apiPath}`);
      await page.getByRole("button",{name:/retry|try again/i}).click();
      await page.locator('[data-testid^="client-job-"],[data-testid^="client-application-"]').first().waitFor();
    } finally { await page.close(); }
  }
});

test("Desktop, tablet and mobile Client pages remain navigable without document overflow", { timeout: 90000 }, async () => {
  for (const width of [1440,820,390]) {
    const page = await pageFor("client",width);
    try {
      for (const [route,label] of [["/client/job-postings","Job Postings"],["/client/job-submissions","Job Submissions"]]) {
        await page.goto(base + route);
        await page.getByRole("heading",{name:label,exact:true,level:1}).waitFor();
        if (width < 768) {
          await page.getByRole("button",{name:"Open client navigation"}).click();
          await page.getByRole("dialog").getByTestId("nav-job-postings").waitFor();
          await page.keyboard.press("Escape");
          await page.getByRole("dialog").waitFor({state:"hidden"});
        }
        const dimensions = await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
        assert.ok(dimensions.document <= dimensions.viewport+1,JSON.stringify({route,width,...dimensions}));
        if (route === "/client/job-postings" && width === 820) {
          const titleBox = await page.getByTestId(`client-job-${jobs.open}`).locator("h3").locator("..").boundingBox();
          assert.ok(titleBox && titleBox.width > 250,"Tablet job details must not collapse beside action buttons");
        }
        await page.screenshot({path:`/tmp/client-navigation-${route.endsWith("postings")?"postings":"submissions"}-${width}.png`,fullPage:true});
      }
    } finally { await page.close(); }
  }
});

test("Dedicated-page loading and empty-state UI are explicit", {timeout:60000}, async()=>{
  for (const [route,endpoint,label,empty] of [
    ["/client/job-postings","/api/client/jobs","Loading job postings","No job postings yet"],
    ["/client/job-submissions","/api/client/job-submissions","Loading applications","No submissions yet"],
  ]) {
    const page = await pageFor();
    let release!: ()=>void;
    const gate = new Promise<void>(resolve=>{release=resolve;});
    try {
      // UI-state-only transport simulation, separate from the real endpoint
      // ownership/count/mutation tests above.
      await page.route(`**${endpoint}`,async intercept=>{
        await gate;
        await intercept.fulfill({status:200,contentType:"application/json",body:"[]"});
      });
      await page.goto(base+route);
      await page.getByLabel(label,{exact:true}).waitFor();
      release();
      await page.getByRole("heading",{name:empty,exact:true}).waitFor();
      assert.equal(await page.locator('[data-testid^="client-job-"],[data-testid^="client-application-"]').count(),0);
    } finally {release();await page.close();}
  }
});
