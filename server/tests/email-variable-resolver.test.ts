import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildEmailContext, resolveVariables } from "../services/emailVariableResolver.js";

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