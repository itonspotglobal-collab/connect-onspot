import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { usdOnlyTerminationFailure } from "../routes/contractTerminations.ts";

describe("termination USD-only error mapping", () => {
  it("preserves the USD_ONLY 400 response from draft rebuilding", () => {
    const error = Object.assign(
      new Error("New pricing and billing records must use USD; existing amounts cannot be converted or relabeled."),
      { code: "USD_ONLY", status: 400 },
    );

    assert.deepEqual(usdOnlyTerminationFailure(error), {
      status: 400,
      body: {
        error: "New pricing and billing records must use USD; existing amounts cannot be converted or relabeled.",
        code: "USD_ONLY",
      },
    });
  });

  it("leaves unrelated failures to the existing termination error handling", () => {
    assert.equal(usdOnlyTerminationFailure(Object.assign(new Error("conflict"), { code: "USD_ONLY", status: 409 })), null);
    assert.equal(usdOnlyTerminationFailure(Object.assign(new Error("failure"), { code: "other", status: 400 })), null);
  });
});