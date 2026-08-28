import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  enrichTalentMatchesWithVanessa,
  matchTalentToJob,
  type TalentMatchInput,
  type TalentMatchWithIdentity,
} from "../services/talentMatchingService.js";

const job = {
  id: "job-match-test",
  title: "IT Systems Administrator",
  category: "Technical",
  description: "Maintain Windows servers, user access, and network reliability.",
  responsibilities: "Manage Active Directory and Microsoft 365 incidents.",
  experienceLevel: "senior",
  skillTags: ["Active Directory", "Microsoft 365", "Networking"],
  requiredSkills: ["Active Directory", "Microsoft 365", "Networking"],
  requiresFluentEnglish: true,
};

function talent(overrides: Record<string, unknown> = {}): TalentMatchInput {
  return {
    userId: "talent-test",
    userSkills: [],
    candidate: {
      id: "candidate-test",
      targetPosition: "Systems Administrator",
      headline: "IT infrastructure specialist",
      summary: "Supports Windows environments and enterprise users.",
      coreSkills: ["Windows", "Active Directory", "Microsoft 365", "Networking"],
      secondarySkills: [],
      experienceYears: "6",
      seniority: "Senior",
      languages: ["English"],
      workHistory: [{ title: "Systems Administrator", responsibilities: "Managed Windows servers and Active Directory." }],
      preferences: { desiredRoles: ["IT Systems Administrator"] },
      ...overrides,
    },
  };
}

function rankedMatch(overrides: Record<string, unknown> = {}): TalentMatchWithIdentity {
  const input = talent(overrides);
  return {
    candidateId: "candidate-test",
    userId: "talent-test",
    candidate: input.candidate as Record<string, any>,
    ...matchTalentToJob(job, input),
  };
}

describe("job-specific talent matching", () => {
  it("scores a strong candidate highly and explains the evidence", () => {
    const result = matchTalentToJob(job, talent());
    assert.ok(result.score >= 75);
    assert.equal(result.matchTier, "excellent");
    assert.deepEqual(result.missingSkills, []);
    assert.ok(result.overlapSkills.includes("Active Directory"));
    assert.ok(result.reasons.some((reason) => reason.includes("core skills")));
  });

  it("scores a weak unrelated candidate low", () => {
    const result = matchTalentToJob(job, talent({
      targetPosition: "Social Media Manager",
      headline: "Creative marketing professional",
      summary: "Creates campaigns and social content.",
      coreSkills: ["SEO", "Content Writing"],
      experienceYears: "5",
      seniority: "Senior",
      languages: ["English"],
      workHistory: [{ title: "Marketing Manager", responsibilities: "Led social media campaigns." }],
      preferences: { desiredRoles: ["Marketing Manager"] },
    }));
    assert.ok(result.score < 35);
    assert.equal(result.matchTier, "low");
  });

  it("reports partial overlap and missing required skills", () => {
    const result = matchTalentToJob(job, talent({
      coreSkills: ["Active Directory"],
      secondarySkills: [],
      experienceYears: "2",
      workHistory: [{ title: "IT Support", responsibilities: "Resolved user access issues." }],
    }));
    assert.equal(result.missingSkills.length, 2);
    assert.ok(result.componentScores.skills < 50);
    assert.ok(result.score < 70);
  });

  it("does not inflate an empty profile", () => {
    const result = matchTalentToJob(job, { candidate: { id: "empty" }, userSkills: [] });
    assert.ok(result.score < 15);
    assert.equal(result.matchedSkills.length, 0);
  });

  it("recognizes narrow technology aliases without broad fuzzy matching", () => {
    const result = matchTalentToJob(
      { ...job, skillTags: ["React.js"], requiredSkills: ["React.js"], title: "React Developer" },
      talent({
        targetPosition: "Frontend Developer",
        coreSkills: ["ReactJS"],
        workHistory: [{ title: "React developer", responsibilities: "Built web applications." }],
      }),
    );
    assert.deepEqual(result.matchedSkills, ["React.js"]);

    const unrelated = matchTalentToJob(
      { ...job, skillTags: ["AD"], requiredSkills: ["AD"] },
      talent({ coreSkills: ["Marketing"] }),
    );
    assert.equal(unrelated.matchedSkills.length, 0);
  });

  it("normalizes database-style snake_case candidate records before scoring", () => {
    const result = matchTalentToJob(job, {
      candidate: {
        id: "snake-case-candidate",
        target_position: "Systems Administrator",
        core_skills: ["Active Directory", "Microsoft 365"],
        experience_years: "6",
        work_history: [{ title: "Systems Administrator" }],
        preferences: { desiredRoles: ["IT Systems Administrator"] },
      },
      profile: { languages: ["English"] },
    });
    assert.ok(result.componentScores.role >= 70);
    assert.ok(result.componentScores.experience >= 60);
    assert.ok(result.overlapSkills.length >= 2);
  });

  it("keeps strongest candidates first after deterministic ranking", () => {
    const strong = rankedMatch();
    const weakInput = talent({ coreSkills: ["Customer Support"], targetPosition: "Customer Support Agent" });
    const weak = { ...rankedMatch(), candidateId: "candidate-weak", userId: "talent-weak", candidate: weakInput.candidate as Record<string, any>, ...matchTalentToJob(job, weakInput) };
    const sorted = [weak, strong].sort((left, right) => right.score - left.score);
    assert.equal(sorted[0].candidateId, "candidate-test");
  });

  it("falls back to deterministic scores when Vanessa fails", async () => {
    const strong = rankedMatch();
    const before = strong.score;
    await enrichTalentMatchesWithVanessa(
      job,
      [strong],
      new Map([["talent-test", talent()]]),
      { enabled: true, reranker: async () => { throw new Error("simulated Vanessa outage"); } },
    );
    assert.equal(strong.score, before);
  });

  it("applies a valid Vanessa signal only to the bounded shortlist", async () => {
    const calls: string[] = [];
    const first = rankedMatch();
    const secondInput = talent({
      id: "candidate-2",
      targetPosition: "IT Support",
      coreSkills: ["Active Directory"],
      workHistory: [{ title: "IT Support", responsibilities: "Resolved user access issues." }],
    });
    const second = {
      candidateId: "candidate-2",
      userId: "talent-2",
      candidate: secondInput.candidate as Record<string, any>,
      ...matchTalentToJob(job, secondInput),
    };
    const inputs = new Map([
      ["talent-test", talent()],
      ["talent-2", secondInput],
    ]);
    await enrichTalentMatchesWithVanessa(job, [first, second], inputs, {
      enabled: true,
      shortlistSize: 1,
      reranker: async (_job, input) => {
        calls.push(String(input.candidate.id));
        return { semanticScore: 100, roleAlignment: 100, domainAlignment: 100, reasons: ["Strong contextual fit"] };
      },
    });
    assert.deepEqual(calls, ["candidate-test"]);
    assert.ok(first.aiReason);
    assert.equal(second.aiReason, undefined);
  });

  it("selects the Vanessa shortlist after deterministic sorting", async () => {
    const weakInput = talent({
      id: "candidate-weak-first",
      targetPosition: "Marketing Manager",
      coreSkills: ["SEO"],
      workHistory: [{ title: "Marketing Manager" }],
    });
    const strongInput = talent({ id: "candidate-strong-second" });
    const weak = {
      candidateId: "candidate-weak-first",
      userId: "talent-weak-first",
      candidate: weakInput.candidate as Record<string, any>,
      ...matchTalentToJob(job, weakInput),
    };
    const strong = {
      candidateId: "candidate-strong-second",
      userId: "talent-strong-second",
      candidate: strongInput.candidate as Record<string, any>,
      ...matchTalentToJob(job, strongInput),
    };
    const calls: string[] = [];
    await enrichTalentMatchesWithVanessa(
      job,
      [weak, strong],
      new Map([["talent-weak-first", weakInput], ["talent-strong-second", strongInput]]),
      {
        enabled: true,
        shortlistSize: 1,
        reranker: async (_job, input) => {
          calls.push(String(input.candidate.id));
          return { semanticScore: 100, reasons: [] };
        },
      },
    );
    assert.deepEqual(calls, ["candidate-strong-second"]);
  });
});