import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderClientEmail,
  renderApplicantEmail,
  resolveVariables,
  type EmailVariableContext,
} from "../services/emailVariableResolver.js";
import { DEFAULT_TEMPLATES } from "../seeds/seedEmailTemplates.js";

const representativeContext: EmailVariableContext = {
  applicantFirstName: "Avery & <Lee>",
  applicantLastName: "Nguyen",
  applicantFullName: "Avery & <Lee> Nguyen",
  applicantEmail: "avery@example.com",
  applicantPhone: "+65 5555 0100",
  jobTitle: "Senior Product Manager",
  jobLocation: "Singapore",
  applicationStatus: "under_review",
  previousApplicationStatus: "new",
  newApplicationStatus: "under_review",
  applicationId: "application-123",
  jobPostingId: "job-456",
  submittedDate: "August 21, 2026",
  portalUrl: "https://talent.onspotglobal.com/my-applications",
  companyName: "OnSpot",
  logoUrl: "https://talent.onspotglobal.com/new-onspot.png",
};

describe("default applicant email templates", () => {
  it("renders all 14 templates with resolved subjects, branded HTML, and accurate metadata", () => {
    const templates = DEFAULT_TEMPLATES.filter(
      (template) => !["job_approved", "job_rejected", "job_unapproved"].includes(template.category),
    );
    assert.equal(templates.length, 14);

    for (const template of templates) {
      const rendered = renderApplicantEmail(template, representativeContext);
      assert.deepEqual(
        rendered.unresolvedKeys,
        [],
        `${template.name} should have no unresolved variables`,
      );
      assert.doesNotMatch(rendered.subject, /\{\{[^}]+\}\}/, `${template.name} subject`);
      assert.doesNotMatch(rendered.bodyHtml, /\{\{[^}]+\}\}/, `${template.name} body`);
      assert.match(rendered.bodyHtml, /https:\/\/talent\.onspotglobal\.com\/new-onspot\.png/);
      assert.match(rendered.bodyHtml, /© OnSpot/);
      assert.ok(template.variables.length > 0, `${template.name} should persist variable metadata`);
      assert.ok(template.variables.includes("logo_url"), `${template.name} should declare the logo variable`);
    }
  });

  it("renders all Client decision templates and hides an absent rejection reason", () => {
    const templates = DEFAULT_TEMPLATES.filter(
      (template) => ["job_approved", "job_rejected", "job_unapproved"].includes(template.category),
    );
    assert.equal(templates.length, 3);
    const context: EmailVariableContext = {
      clientFirstName: "Morgan",
      clientLastName: "Lee",
      clientName: "Morgan Lee",
      clientEmail: "morgan@example.com",
      companyName: "Acme",
      jobId: "job-123",
      jobPostingId: "job-123",
      jobTitle: "Product Designer",
      jobStatus: "open",
      approvalStatus: "approved",
      jobUrl: "https://talent.onspotglobal.com/client/jobs/job-123/edit",
      logoUrl: "https://talent.onspotglobal.com/new-onspot.png",
    };
    for (const template of templates) {
      const rendered = renderClientEmail(template, context);
      assert.deepEqual(rendered.unresolvedKeys, []);
      assert.doesNotMatch(rendered.bodyHtml, /\{\{[#/]/);
    }
    const rejected = renderClientEmail(
      templates.find((template) => template.category === "job_rejected")!,
      context,
    );
    assert.doesNotMatch(rejected.bodyHtml, /<strong>Reason:/);
  });

  it("supports whitespace and the legacy job_company alias without exposing it in defaults", () => {
    const result = resolveVariables(
      "{{ applicant_first_name }} applied to {{ job_company }} / {{company_name}}",
      representativeContext,
    );
    assert.equal(result.resolved, "Avery & <Lee> applied to OnSpot / OnSpot");
    assert.deepEqual(result.unresolvedKeys, []);
    assert.ok(DEFAULT_TEMPLATES.every((template) => !template.variables.includes("job_company")));
  });

  it("escapes HTML values while keeping subject text single-line", () => {
    const rendered = renderApplicantEmail(
      {
        subject: "Hello {{applicant_first_name}}\n{{job_title}}",
        bodyHtml: "<p>{{applicant_first_name}} — {{job_title}}</p>",
      },
      representativeContext,
    );
    assert.equal(rendered.subject, "Hello Avery & <Lee> Senior Product Manager");
    assert.equal(
      rendered.bodyHtml,
      "<p>Avery &amp; &lt;Lee&gt; — Senior Product Manager</p>",
    );
  });

  it("flags unsupported legacy Mustache section syntax instead of allowing it to be sent", () => {
    const rendered = renderApplicantEmail(
      {
        subject: "We received your application",
        bodyHtml: "<p>{{#job_company}}At {{job_company}}{{/job_company}}</p>",
      },
      representativeContext,
    );
    assert.deepEqual(rendered.unresolvedKeys, ["#job_company", "/job_company"]);
    assert.match(rendered.bodyHtml, /\{\{#job_company\}\}/);
    assert.match(rendered.bodyHtml, /\{\{\/job_company\}\}/);
  });

  it("rejects unsafe portal and logo URLs instead of placing them in email HTML", () => {
    const rendered = renderApplicantEmail(
      {
        subject: "Safe link check",
        bodyHtml: '<a href="{{portal_url}}">Portal</a><img src="{{logo_url}}" alt="OnSpot" />',
      },
      {
        ...representativeContext,
        portalUrl: 'javascript:alert("unsafe")',
        logoUrl: 'http://example.com/logo.png',
      },
    );
    assert.deepEqual(rendered.unresolvedKeys, ["portal_url", "logo_url"]);
    assert.match(rendered.bodyHtml, /\{\{portal_url\}\}/);
    assert.match(rendered.bodyHtml, /\{\{logo_url\}\}/);
  });
});