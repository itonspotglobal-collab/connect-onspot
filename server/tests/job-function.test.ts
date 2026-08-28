import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { insertJobSchema } from "@shared/schema";
import {
  getJobFunctionDisplay,
  getJobFunctionSearchValues,
  OTHER_JOB_FUNCTION,
} from "@shared/jobFunction";
import { JOB_FORM_FUNCTION_OPTIONS } from "../../client/src/lib/jobConstants";
import { jobToFormData } from "../../client/src/lib/jobFormUtils";
import { validateJobFormMetadata } from "../routes.js";

describe("custom job function", () => {
  it("keeps Other as the last guided-form option", () => {
    assert.equal(JOB_FORM_FUNCTION_OPTIONS.at(-1), OTHER_JOB_FUNCTION);
  });

  it("preserves predefined functions and resolves Other to its custom value", () => {
    assert.equal(
      getJobFunctionDisplay({ jobFunction: "Marketing", category: "Marketing" }),
      "Marketing",
    );
    assert.equal(
      getJobFunctionDisplay({
        jobFunction: "Other",
        otherFunction: "Customer Education",
        category: "Other",
      }),
      "Customer Education",
    );
    assert.deepEqual(
      getJobFunctionSearchValues({
        jobFunction: "Other",
        otherFunction: "Customer Education",
        category: "Other",
      }),
      ["Customer Education", "Other"],
    );
  });

  it("requires a custom value for final submissions but allows incomplete drafts", () => {
    assert.ok(
      validateJobFormMetadata({
        status: "open",
        jobFunction: "Other",
        otherFunction: "   ",
      }),
    );
    assert.equal(
      validateJobFormMetadata({
        status: "draft",
        jobFunction: "Other",
        otherFunction: "   ",
      }),
      null,
    );
    assert.equal(
      validateJobFormMetadata({
        status: "open",
        jobFunction: "Other",
        otherFunction: "Customer Education",
      }),
      null,
    );
  });

  it("trims the custom value at the persistence schema boundary", () => {
    const parsed = insertJobSchema.parse({
      clientId: "client-1",
      title: "Customer educator",
      description: "Build customer education programs.",
      category: "Other",
      experienceLevel: "intermediate",
      jobFunction: "Other",
      otherFunction: "  Customer Education  ",
    });

    assert.equal(parsed.otherFunction, "Customer Education");
  });

  it("hydrates custom values when resuming or editing a job", () => {
    const formData = jobToFormData({
      title: "Customer educator",
      description: "Build customer education programs.",
      category: "Other",
      jobFunction: "Other",
      otherFunction: "Customer Education",
      status: "draft",
    } as any);

    assert.equal(formData.jobFunction, "Other");
    assert.equal(formData.otherFunction, "Customer Education");
    assert.equal(getJobFunctionDisplay(formData), "Customer Education");
  });
});