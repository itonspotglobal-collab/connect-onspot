import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { filterMessageContent } from "../lib/piiPatterns.js";
import { filterMessageContentWithVanessa } from "../lib/messagePrivacyFilter.js";

describe("message privacy filter — deterministic redaction", () => {
  const cases = [
    ["Contact me at val@onspotglobal.com", "Contact me at *****.com"],
    ["My email is john.doe@gmail.com", "My email is *****.com"],
    ["john@example.co.uk", "*****.co.uk"],
    ["Call me at +63 917 123 4723", "Call me at ***4723"],
    ["09171234723", "***4723"],
    ["(0917) 123-4723", "***4723"],
    ["password: SuperSecret123!", "password: ********"],
    ["My password is one two three", "My password is ********"],
    ['temporary password: "one two three!"', "temporary password: ********"],
    ["password: super secret phrase, okay", "password: ********, okay"],
    ["password: SuperSecret123; please use it", "password: ********; please use it"],
    ["OTP is 839221", "OTP is ******"],
    ["Bearer eyJhbGciOiJIUzI1NiJ9.test.signature", "Bearer ********"],
    [
      "Email val@gmail.com or call +639171234723. Password: hello123",
      "Email *****.com or call ***4723. Password: ********",
    ],
    ["reach me at val at gmail dot com", "reach me at *****.com"],
    ["reach me at val [at] gmail [dot] com", "reach me at *****.com"],
    ["reach me at val(at)gmail(dot)com", "reach me at *****.com"],
    ["reach me at v a l @ gmail . com", "reach me at *****.com"],
    [
      "my number is nine one seven one two three four seven two three",
      "my number is ********",
    ],
  ] as const;

  for (const [input, expected] of cases) {
    it(`redacts ${input}`, () => {
      const result = filterMessageContent(input);
      assert.equal(result.sanitizedContent, expected);
      assert.equal(result.flaggedForReview, true);
      assert.ok(result.detections.length > 0);
      assert.ok(!JSON.stringify(result.detections).includes("gmail"));
      assert.ok(!JSON.stringify(result.detections).includes("SuperSecret"));
    });
  }

  const cleanCases = [
    "I have 3 years experience and handled 200 tickets.",
    "I have 4 years of email marketing experience.",
    "I implemented password reset functionality.",
    "The client's website requires authentication.",
    "React version 19.",
    "Ticket #12345 is ready and the budget is $5,000.",
    "I work at home. Today I will review it.",
    "Meet me at work. Tomorrow is fine.",
  ];

  for (const input of cleanCases) {
    it(`does not alter normal discussion: ${input}`, () => {
      const result = filterMessageContent(input);
      assert.equal(result.sanitizedContent, input);
      assert.equal(result.flaggedForReview, false);
      assert.deepEqual(result.detections, []);
    });
  }
});

describe("message privacy filter — Vanessa fallback behavior", () => {
  it("never sends deterministically detected credentials to Vanessa", async () => {
    let received = "";
    const result = await filterMessageContentWithVanessa(
      'My password is "one two three!" and email is val@gmail.com',
      async (content) => {
        received = content;
        return { containsSensitiveInfo: false, detections: [] };
      },
    );
    assert.ok(!received.includes("one two three"));
    assert.ok(!received.includes("val@gmail.com"));
    assert.ok(received.includes("********"));
    assert.equal(
      result.sanitizedContent,
      "My password is ******** and email is *****.com",
    );
  });

  it("continues with deterministic protection when Vanessa fails", async () => {
    const result = await filterMessageContentWithVanessa(
      "Email me at val@gmail.com",
      async () => {
        throw new Error("unavailable");
      },
    );
    assert.equal(result.sanitizedContent, "Email me at *****.com");
    assert.equal(result.flaggedForReview, true);
  });

  it("applies only high-confidence, bounded Vanessa ranges", async () => {
    const input = "Reach me on WhatsApp under username val.";
    const start = input.indexOf("WhatsApp");
    const end = input.length - 1;
    const result = await filterMessageContentWithVanessa(input, async () => ({
      containsSensitiveInfo: true,
      detections: [
        { type: "contact_sharing", start, end, confidence: 0.97 },
        { type: "low_confidence", start: 0, end: 5, confidence: 0.4 },
        { type: "invented_type", start: 0, end: 5, confidence: 0.99 },
      ],
    }));
    assert.equal(result.sanitizedContent, "Reach me on ********.");
    assert.equal(result.flaggedForReview, true);
    assert.equal(result.detections.at(-1)?.source, "vanessa");
  });
});