import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  matchTalentToSearch,
  parseTalentSearchQuery,
  type TalentMatchInput,
} from "../services/talentMatchingService.js";

function talent(candidate: Record<string, unknown>, userSkills: string[] = []): TalentMatchInput {
  return {
    userId: String(candidate.id ?? "talent-search-test"),
    candidate: {
      id: "talent-search-test",
      coreSkills: [],
      secondarySkills: [],
      workHistory: [],
      ...candidate,
    },
    userSkills,
  };
}

describe("generic talent profile search matching", () => {
  it("fixes the Developer regression using the full profile", () => {
    const frenzyLike = matchTalentToSearch("Developer", talent({
      target_position: "Software Engineer",
      category: "Developers",
      experience_years: "1-3",
      core_skills: ["Research", "Project Coordination"],
      secondary_skills: [
        "Automation Testing",
        "Project Management",
        "Quality Assurance",
        "Machine Learning",
        "Manual Testing",
        "C#",
        "Programming",
        "Language C",
        "System",
        "Full Stack Developer",
      ],
      summary: "Software engineering / full stack development background",
    }));
    const unrelated = matchTalentToSearch("Developer", talent({
      targetPosition: "Social Media Manager",
      category: "Marketing",
      coreSkills: ["Canva", "Facebook Ads", "Content Creation"],
      summary: "Plans social media campaigns and marketing content.",
    }));

    assert.ok(frenzyLike.score >= 50, `expected meaningful developer score, received ${frenzyLike.score}`);
    assert.ok(frenzyLike.score > unrelated.score);
    assert.ok(frenzyLike.matchedSkills.some((skill) => /programming|full stack|c#/i.test(skill)));
  });

  it("scores a clear software development profile strongly", () => {
    const result = matchTalentToSearch("Developer", talent({
      targetPosition: "Software Engineer",
      category: "Developers",
      coreSkills: ["React", "Node.js", "Programming"],
      secondarySkills: ["Full Stack Developer"],
      headline: "Full stack software engineer",
      workHistory: [{ jobTitle: "Software Engineer", responsibilities: "Built web applications." }],
    }));
    assert.ok(result.score >= 70);
  });

  it("keeps an unrelated marketing profile low", () => {
    const result = matchTalentToSearch("Developer", talent({
      targetPosition: "Social Media Manager",
      category: "Marketing",
      coreSkills: ["Canva", "Facebook Ads", "Content Creation"],
    }));
    assert.ok(result.score < 20);
  });

  it("ranks React evidence above a different developer specialty", () => {
    const react = matchTalentToSearch("React Developer", talent({
      targetPosition: "Software Engineer",
      category: "Developers",
      coreSkills: ["React.js", "TypeScript", "Node.js"],
      workHistory: [{ role: "Frontend Developer" }],
    }));
    const java = matchTalentToSearch("React Developer", talent({
      targetPosition: "Backend Java Developer",
      category: "Developers",
      coreSkills: ["Java", "Spring Boot"],
      workHistory: [{ role: "Backend Developer" }],
    }));
    assert.ok(react.score >= 70);
    assert.ok(react.score >= java.score + 15);
  });

  it("understands IT administrator role-family evidence", () => {
    const result = matchTalentToSearch("IT Administrator", talent({
      targetPosition: "Systems Administrator",
      coreSkills: ["Active Directory", "Microsoft 365", "Windows Server", "Networking"],
      workHistory: [{ role: "System Administrator" }],
    }));
    assert.ok(result.score >= 60);
  });

  it("understands virtual and administrative assistant role-family evidence", () => {
    const result = matchTalentToSearch("Virtual Assistant", talent({
      targetPosition: "Administrative Assistant",
      coreSkills: ["Calendar Management", "Inbox Management", "Scheduling", "Data Entry"],
      workHistory: [{ role: "Administrative Assistant" }],
    }));
    assert.ok(result.score >= 60);
  });

  it("uses summary-only evidence without inventing a score floor", () => {
    const result = matchTalentToSearch("Full Stack Developer", talent({
      summary: "Experienced full stack developer building web applications.",
    }));
    assert.ok(result.score >= 10);
    assert.ok(result.componentScores.profile >= 80);
  });

  it("uses the professional profile bio when candidate summary fields are empty", () => {
    const input = talent({});
    input.profile = {
      title: "Remote professional",
      bio: "Experienced full stack developer building React and Node applications.",
    };
    const result = matchTalentToSearch("Full Stack Developer", input);
    assert.ok(result.score >= 10);
    assert.ok(result.componentScores.profile >= 80);
  });

  it("counts secondary skills as meaningful but lower-weight evidence", () => {
    const result = matchTalentToSearch("Developer", talent({
      coreSkills: ["Research"],
      secondarySkills: ["Full Stack Developer", "Programming", "C#"],
    }));
    assert.ok(result.score >= 15);
    assert.ok(result.matchedSkills.includes("Programming"));
  });

  it("uses work-history role evidence when structured profile fields are sparse", () => {
    const result = matchTalentToSearch("Developer", talent({
      workHistory: [{ role: "Software Engineer", description: "Built internal web applications." }],
    }));
    assert.ok(result.score >= 10);
    assert.ok(result.componentScores.workHistory >= 80);
  });

  it("returns zero when the profile has no related evidence", () => {
    const result = matchTalentToSearch("Developer", talent({
      targetPosition: "Bookkeeper",
      category: "Accounting",
      coreSkills: ["QuickBooks", "Accounts Payable"],
    }));
    assert.equal(result.score, 0);
  });

  it("normalizes case, punctuation, and common technology aliases", () => {
    const lower = matchTalentToSearch("developer", talent({
      targetPosition: "Software Engineer",
      coreSkills: ["React.js", "Node.js"],
    }));
    const upper = matchTalentToSearch("DEVELOPER", talent({
      targetPosition: "Software Engineer",
      coreSkills: ["React", "Node"],
    }));
    const parsed = parseTalentSearchQuery("Senior React Developer");

    assert.equal(lower.score, upper.score);
    assert.deepEqual(parsed.seniorityTerms, ["senior"]);
    assert.deepEqual(parsed.skillTerms, ["react"]);
    assert.equal(parsed.roleFamily, "software_development");
  });
});