import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { signupRetryDelayMs } from "../../client/src/lib/signupRetry.js";

const now = Date.parse("2030-01-01T00:00:00.000Z");
const defaultRetryDelayMs = 60 * 60 * 1000;

describe("signupRetryDelayMs", () => {
  it("honors numeric retry delays greater than 900 seconds", () => {
    assert.equal(signupRetryDelayMs(3_000, now), 3_000_000);
    assert.equal(signupRetryDelayMs("1200", now), 1_200_000);
  });

  it("parses a future HTTP-date Retry-After value", () => {
    assert.equal(
      signupRetryDelayMs("Tue, 01 Jan 2030 00:05:00 GMT", now),
      5 * 60 * 1000,
    );
  });

  it("uses the minimum one-second delay for an HTTP-date in the past", () => {
    assert.equal(signupRetryDelayMs("Tue, 01 Jan 2030 00:00:00 GMT", now), 1_000);
  });

  it("falls back to one hour for missing, invalid, and negative retry values", () => {
    assert.equal(signupRetryDelayMs(undefined, now), defaultRetryDelayMs);
    assert.equal(signupRetryDelayMs("not-a-date", now), defaultRetryDelayMs);
    assert.equal(signupRetryDelayMs("non-numeric", now), defaultRetryDelayMs);
    assert.equal(signupRetryDelayMs(-1, now), defaultRetryDelayMs);
  });
});