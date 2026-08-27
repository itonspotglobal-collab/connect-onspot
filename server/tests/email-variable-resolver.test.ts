import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildEmailContext,
  renderApplicantEmail,
  resolveVariables,
} from "../services/emailVariableResolver.js";
import { htmlToPlainText } from "../lib/htmlToPlainText.js";

describe("application status email variables", () => {
  it("exposes previous/new status without changing application_status semantics", () => {
    const context = buildEmailContext({
      firstName: "Taylor",
      lastName: "Applicant",
      email: "taylor@example.com",
      jobTitle: "Operations Manager",
      status: "shortlisted",
      previousStatus: "under_review",
      newStatus: "shortlisted",
      applicationId: "application-1",
      jobPostingId: "job-1",
    });
    const result = resolveVariables(
      "{{applicant_first_name}}: {{application_status}} / {{previous_application_status}} → {{new_application_status}} ({{application_id}} / {{job_posting_id}})",
      context,
    );

    assert.equal(
      result.resolved,
      "Taylor: shortlisted / under_review → shortlisted (application-1 / job-1)",
    );
    assert.deepEqual(result.unresolvedKeys, []);
  });
});


describe("email-safe job descriptions", () => {
  it("converts rich-text paragraphs and inline markup to readable text", () => {
    assert.equal(htmlToPlainText("<p>Hello</p>"), "Hello");
    assert.equal(
      htmlToPlainText("<p>First</p><p>Second</p>"),
      "First\nSecond",
    );
    assert.equal(
      htmlToPlainText("<p>Experience with <strong>React</strong> is required.</p>"),
      "Experience with React is required.",
    );
    assert.equal(
      htmlToPlainText("<p>Remote &amp; flexible</p>"),
      "Remote & flexible",
    );
  });

  it("keeps lists readable and removes unsafe markup", () => {
    assert.equal(
      htmlToPlainText("<p>Required skills:</p><ul><li>React</li><li>TypeScript</li></ul>"),
      "Required skills:\n• React\n• TypeScript",
    );
    assert.equal(
      htmlToPlainText('<p>Safe</p><script>alert("xss")</script><iframe>bad</iframe>'),
      "Safe",
    );
  });

  it("handles empty and plain-text descriptions", () => {
    assert.equal(htmlToPlainText(null), "");
    assert.equal(htmlToPlainText(undefined), "");
    assert.equal(htmlToPlainText(""), "");
    assert.equal(htmlToPlainText("Plain text description"), "Plain text description");
  });

  it("normalizes only the job description variable while preserving email HTML", () => {
    const rendered = renderApplicantEmail(
      {
        subject: "Invitation for {{job_title}}",
        bodyHtml: "<h3>{{job_title}}</h3><p>{{job_description}}</p>",
      },
      buildEmailContext({
        email: "talent@example.com",
        jobTitle: "Testing",
        jobDescription: "<p>This is <strong>safe</strong>.</p>",
      }),
    );

    assert.equal(rendered.unresolvedKeys.length, 0);
    assert.match(rendered.bodyHtml, /<h3>Testing<\/h3>/);
    assert.match(rendered.bodyHtml, /This is safe\./);
    assert.doesNotMatch(rendered.bodyHtml, /<p>This is <strong>safe<\/strong>\.<\/p>/);
  });

  it("preserves sanitized paragraph and list line breaks in rendered email HTML", () => {
    const rendered = renderApplicantEmail(
      {
        subject: "Invitation",
        bodyHtml: "<p>{{job_description}}</p>",
      },
      buildEmailContext({
        email: "talent@example.com",
        jobDescription: "<p>Required skills:</p><ul><li>React</li><li>TypeScript</li></ul>",
      }),
    );

    assert.equal(
      rendered.bodyHtml,
      "<p>Required skills:<br>• React<br>• TypeScript</p>",
    );
  });
});