import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validatePasswordStrength as validateShared } from "../../shared/passwordPolicy.js";
import { validatePasswordStrength as validateAuthUtils } from "../auth-utils.js";

const specialCharacterMessage = "Password must contain at least one special character";
const validAtLength = (length: number): string => `Aa1!${"b".repeat(length - 4)}`;

describe("shared password policy", () => {
  it("preserves the auth-utils validation export", () => {
    assert.strictEqual(validateAuthUtils, validateShared);
  });

  it("accepts the minimum length and rejects one character below it", () => {
    assert.deepEqual(validateShared(validAtLength(8)), { isValid: true, errors: [] });
    assert.deepEqual(validateShared(validAtLength(7)), {
      isValid: false,
      errors: ["Password must be at least 8 characters long"],
    });
  });

  it("accepts the maximum length and rejects one character above it", () => {
    assert.deepEqual(validateShared(validAtLength(128)), { isValid: true, errors: [] });
    assert.deepEqual(validateShared(validAtLength(129)), {
      isValid: false,
      errors: ["Password must be less than 128 characters"],
    });
  });

  it("reports missing lowercase, uppercase, and digit requirements exactly", () => {
    assert.deepEqual(validateShared("AB1!CDEF"), {
      isValid: false,
      errors: ["Password must contain at least one lowercase letter"],
    });
    assert.deepEqual(validateShared("ab1!cdef"), {
      isValid: false,
      errors: ["Password must contain at least one uppercase letter"],
    });
    assert.deepEqual(validateShared("Abc!defg"), {
      isValid: false,
      errors: ["Password must contain at least one number"],
    });
  });

  it("accepts every special character matched by the original policy regex", () => {
    const allowedSpecialCharacters = [
      "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "_", "+", "-", "=", "[", "]",
      "{", "}", ";", "'", ":", '"', "\\", "|", ",", ".", "<", ">", "/", "?",
    ];

    for (const specialCharacter of allowedSpecialCharacters) {
      assert.deepEqual(
        validateShared(`Aa1${specialCharacter}bcde`),
        { isValid: true, errors: [] },
        `expected ${JSON.stringify(specialCharacter)} to count as a special character`,
      );
    }
  });

  it("rejects punctuation not matched by the original policy regex", () => {
    for (const nonmatchingCharacter of ["~", "`", " ", "é"]) {
      assert.deepEqual(
        validateShared(`Aa1${nonmatchingCharacter}bcde`),
        { isValid: false, errors: [specialCharacterMessage] },
        `expected ${JSON.stringify(nonmatchingCharacter)} not to count as a special character`,
      );
    }
  });
});