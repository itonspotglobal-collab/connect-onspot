import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { renderClientEmail, renderBrandedEmailLayout, buildClientEmailContext } from "../services/emailVariableResolver";
import { button, jobApprovalEmailContent, formatJobApprovalDate } from "../services/jobApprovalEmailContent";

let existing: any[] = [];
const updates: unknown[][] = [];
mock.module("../db.ts", { namedExports: { query: async (sql: string, values: unknown[]) => {
  if (sql.includes("SELECT")) return { rows: existing };
  if (sql.includes("UPDATE applicant_email_templates")) updates.push(values);
  return { rows: [] };
} } });
const { DEFAULT_TEMPLATES, seedEmailTemplates } = await import("../seeds/seedEmailTemplates");
const approved = DEFAULT_TEMPLATES.find(t => t.category === "job_approved")!;
const oldSubject = "Your job post has been approved — {{job_title}}";
const oldBody = renderBrandedEmailLayout(`<p style="margin:0 0 16px;">Hi {{client_first_name}},</p>
<p style="margin:0 0 16px;">Good news — your job posting for <strong>{{job_title}}</strong> has been approved.</p>
<p style="margin:0 0 16px;">Your role is now available according to the current OnSpot publishing rules, and you can begin reviewing talent and applications.</p>
${button("{{job_url}}", "View Job Posting")}
<p style="margin:0;">Warm regards,<br />The OnSpot Hire Talent Team</p>`);

test("automatic and composer stock approval content match, with safe view/application links", () => {
  const context = buildClientEmailContext({
    clientEmail: "fixture@example.test", clientFirstName: 'Alex & <Team> "A"',
    jobId: "job-123", jobTitle: 'Designer <script> "Lead"', approvalStatus: "approved",
  });
  const composer = renderClientEmail(approved, context);
  assert.deepEqual(composer.unresolvedKeys, []);
  const automatic = renderBrandedEmailLayout(jobApprovalEmailContent({
    firstName: context.clientFirstName!, jobTitle: context.jobTitle!,
    approvedDate: context.jobApprovedDate!, jobViewUrl: context.jobViewUrl!,
    applicationsUrl: context.jobApplicationsUrl!,
  }));
  assert.equal(composer.bodyHtml, renderClientEmail({ subject: composer.subject, bodyHtml: automatic }, context).bodyHtml);
  assert.equal(composer.subject, 'Your job post is live: Designer <script> "Lead"');
  assert.match(automatic, /Alex &amp; &lt;Team&gt; &quot;A&quot;/);
  assert.doesNotMatch(automatic, /<script>|\/edit|current OnSpot publishing rules/);
  assert.match(automatic, /Approved date/);
  assert.match(automatic, /What happens next/);
  assert.match(automatic, /The OnSpot Hire Talent Team/);
  assert.match(context.jobUrl!, /\/edit$/);
  assert.match(context.jobViewUrl!, /\/client\/job-postings\?jobId=job-123$/);
  assert.match(context.jobApplicationsUrl!, /\/client\/job-submissions\?jobId=job-123$/);
  assert.equal(formatJobApprovalDate(new Date("2026-11-06T00:01:00Z")), "November 6, 2026");
});

test("seed upgrades the exact previous stock approval but preserves customized templates", async () => {
  assert.equal(createHash("sha256").update(`${oldSubject}\n${oldBody}`).digest("hex"),
    "45738009baa04013e9d3b394541ebda4f0e1e975d385e3e4fd0268891cfc20b8");
  const stock = DEFAULT_TEMPLATES.map((t, i) => ({
    id: `fixture-${i}`, name: t.name, subject: t.subject, body_html: t.bodyHtml, variables: t.variables,
  }));
  existing = stock.map(t => t.name === approved.name ? { ...t, subject: oldSubject, body_html: oldBody } : t);
  updates.length = 0;
  await seedEmailTemplates();
  assert.equal(updates.length, 1);
  assert.equal(updates[0][0], approved.subject);
  assert.equal(updates[0][1], approved.bodyHtml);
  existing = stock.map(t => t.name === approved.name ? { ...t, body_html: `${oldBody}<p>Custom message</p>` } : t);
  updates.length = 0;
  await seedEmailTemplates();
  assert.equal(updates.length, 0);
  existing = stock;
  await seedEmailTemplates();
  assert.equal(updates.length, 0, "new stock is already current");
});
