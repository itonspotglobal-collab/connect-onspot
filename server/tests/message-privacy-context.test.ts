import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CROSS_MESSAGE_REDACTION,
  detectMessagePrivacyContext,
  type PrivacyContextMessage,
} from "../lib/messagePrivacyContext.js";

const NOW = new Date("2026-08-28T07:00:00.000Z");

function messages(
  contents: string[],
  senderId = "sender-a",
  minutesAgo = 0,
): PrivacyContextMessage[] {
  return contents.map((content, index) => ({
    id: `m-${index + 1}`,
    senderId,
    content,
    createdAt: new Date(NOW.getTime() - minutesAgo * 60_000 + index),
  }));
}

describe("cross-message privacy context", () => {
  const cases = [
    {
      name: "split email domain",
      previous: ["val@onspot"],
      incoming: "global.com",
      types: ["email", "obfuscated_contact"],
    },
    {
      name: "three-part symbolic email",
      previous: ["val", "@onspotglobal"],
      incoming: ".com",
      types: ["email", "obfuscated_contact"],
    },
    {
      name: "three-part word-obfuscated email",
      previous: ["val at", "gmail dot"],
      incoming: "com",
      types: ["obfuscated_contact"],
    },
    {
      name: "split Philippine phone",
      previous: ["0917", "123"],
      incoming: "4723",
      types: ["phone"],
    },
    {
      name: "four-part international phone",
      previous: ["+63", "917", "123"],
      incoming: "4723",
      types: ["phone"],
      expectedAffectedIds: ["m-2", "m-3"],
    },
    {
      name: "split credential label and value",
      previous: ["password:"],
      incoming: "SuperSecret123!",
      types: ["credential"],
    },
  ];

  for (const testCase of cases) {
    it(`detects ${testCase.name}`, async () => {
      const recent = messages(testCase.previous);
      const result = await detectMessagePrivacyContext({
        senderId: "sender-a",
        recentMessages: recent,
        newContent: testCase.incoming,
        now: NOW,
      });
      assert.equal(result.detected, true);
      assert.equal(result.source, "deterministic");
      assert.equal(result.sanitizedNewContent, CROSS_MESSAGE_REDACTION);
      assert.deepEqual(
        result.affectedPreviousMessageIds,
        testCase.expectedAffectedIds ?? recent.map((message) => message.id),
      );
      assert.ok(
        result.detections.some((detection) =>
          testCase.types.includes(detection.type),
        ),
      );
    });
  }

  it("does not flag unrelated professional messages", async () => {
    const result = await detectMessagePrivacyContext({
      senderId: "sender-a",
      recentMessages: messages(["I have 3 years experience"]),
      newContent: "and completed 4 projects",
      now: NOW,
      semanticDetector: async () => ({
        containsSensitiveInfo: false,
        detections: [],
      }),
    });
    assert.equal(result.detected, false);
    assert.deepEqual(result.affectedPreviousMessageIds, []);
  });

  it("redacts only the sensitive boundary span and preserves surrounding text", async () => {
    const result = await detectMessagePrivacyContext({
      senderId: "sender-a",
      recentMessages: messages(["My portfolio is val@onspot"]),
      newContent: "global.com — thank you",
      now: NOW,
    });
    assert.equal(result.detected, true);
    assert.equal(
      result.previousMessageRedactions[0]?.sanitizedContent,
      "My portfolio is *****",
    );
    assert.equal(result.sanitizedNewContent, "***** — thank you");
  });

  it("does not combine fragments from different senders", async () => {
    const result = await detectMessagePrivacyContext({
      senderId: "talent",
      recentMessages: messages(["val@onspot"], "client"),
      newContent: "global.com",
      now: NOW,
      semanticDetector: async () => ({
        containsSensitiveInfo: false,
        detections: [],
      }),
    });
    assert.equal(result.detected, false);
  });

  it("does not combine fragments outside the three-minute window", async () => {
    const result = await detectMessagePrivacyContext({
      senderId: "sender-a",
      recentMessages: messages(["val@onspot"], "sender-a", 30),
      newContent: "global.com",
      now: NOW,
      semanticDetector: async () => ({
        containsSensitiveInfo: false,
        detections: [],
      }),
    });
    assert.equal(result.detected, false);
  });

  it("uses Vanessa only as a bounded fallback for suspicious fragments", async () => {
    let received = "";
    const recent = messages([
      "You can find me on the mail service after the interview",
      "my username is val",
    ]);
    const incoming = "the service is gmail for contact, thanks";
    const result = await detectMessagePrivacyContext({
      senderId: "sender-a",
      recentMessages: recent,
      newContent: incoming,
      now: NOW,
      semanticDetector: async (content) => {
        received = content;
        const start = content.indexOf("mail service");
        const end = content.indexOf(" for contact");
        return {
          containsSensitiveInfo: true,
          detections: [
            {
              type: "contact_sharing",
              start,
              end,
              confidence: 0.96,
            },
          ],
        };
      },
    });
    assert.equal(result.detected, true);
    assert.equal(result.source, "vanessa");
    assert.equal(result.affectedPreviousMessageIds.length, 2);
    assert.ok(received.includes("username is val"));
    assert.equal(
      result.previousMessageRedactions[0]?.sanitizedContent,
      "You can find me on the *****",
    );
    assert.equal(result.sanitizedNewContent, "***** for contact, thanks");
  });

  it("rejects a broad Vanessa whole-context range", async () => {
    const result = await detectMessagePrivacyContext({
      senderId: "sender-a",
      recentMessages: messages([
        "You can find me on the mail service after the interview",
        "my username is val",
      ]),
      newContent: "the service is gmail for contact, thanks",
      now: NOW,
      semanticDetector: async (content) => ({
        containsSensitiveInfo: true,
        detections: [
          {
            type: "contact_sharing",
            start: 0,
            end: content.length,
            confidence: 0.99,
          },
        ],
      }),
    });
    assert.equal(result.detected, false);
    assert.deepEqual(result.previousMessageRedactions, []);
  });
});