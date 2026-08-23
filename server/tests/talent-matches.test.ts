/**
 * talent-matches.test.ts
 *
 * Regression tests for the Talent-facing match surface (Task: surface scored
 * job matches to Talent).
 *
 * Covers:
 *  (a) `calculateJobMatches` returns a `factors` breakdown that mirrors the
 *      bonuses actually applied (engagementMatch ⇔ +20, rateMatch ⇔ +10).
 *  (b) `candidateOverride` — legacy candidates with NO linked users row still
 *      get their preferences applied and their candidate-record skills used.
 *  (c) Fallback (<3 skill matches) entries carry factors with false flags.
 *
 * Run with:  npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MemStorage } from "../storage.js";
import type { Job, Candidate } from "@shared/schema";

const OLD_DATE = new Date("2020-01-01T00:00:00Z"); // no recency bonus

function makeJob(overrides: Partial<Job & { skills: string[] }> = {}): Job & { skills: string[] } {
  return {
    id: "job-1",
    clientId: "client-1",
    title: "Test Job",
    description: "desc",
    category: "Technical",
    engagementType: "Standard",
    budget: "500",
    budgetCurrency: "USD",
    company: "OnSpot",
    location: "Remote",
    status: "open",
    createdAt: OLD_DATE,
    updatedAt: OLD_DATE,
    skills: ["JavaScript"],
    ...(overrides as any),
  } as Job & { skills: string[] };
}

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "cand-legacy",
    userId: null, // legacy: no linked users row
    email: "legacy@example.com",
    coreSkills: ["JavaScript"],
    secondarySkills: [],
    preferences: {
      rateEngagementType: "Standard",
      rateAmount: "500",
      rateCurrency: "USD",
    },
    ...(overrides as any),
  } as unknown as Candidate;
}

class TestStorage extends MemStorage {
  injectedJobs: (Job & { skills: string[] })[] = [];

  override async searchJobsWithSkills(_filters: any) {
    return this.injectedJobs;
  }
  override async getUserSkillsWithNames(_userId: string) {
    return []; // legacy candidate: nothing in user_skills
  }
  override async getProfileByUserId(_userId: string) {
    return undefined;
  }
  override async getCandidateByUserId(_userId: string) {
    return undefined; // legacy candidate is NOT resolvable by userId
  }
}

describe("talent-facing matches: candidateOverride + factors", () => {
  it("uses candidateOverride prefs and candidate-record skills for legacy candidates", async () => {
    const s = new TestStorage();
    s.injectedJobs = [makeJob()];
    const candidate = makeCandidate();

    const matches = await s.calculateJobMatches("cand-legacy", undefined, candidate);
    assert.equal(matches.length, 1);
    const m = matches[0];
    // Skill overlap via candidate coreSkills (Jaccard 1/1 → 100) + 20 engagement + 10 rate
    assert.equal(m.score, 130);
    assert.deepEqual(m.overlapSkills, ["JavaScript"]);
    assert.deepEqual(m.factors, { skillOverlapCount: 1, engagementMatch: true, rateMatch: true });
  });

  it("factors mirror applied bonuses: no engagement match, rate outside ±20%", async () => {
    const s = new TestStorage();
    s.injectedJobs = [makeJob({ engagementType: "Part-Time", budget: "1000" })];
    const candidate = makeCandidate(); // prefers Standard @ 500 USD → ratio 0.5

    const [m] = await s.calculateJobMatches("cand-legacy", undefined, candidate);
    assert.equal(m.factors.engagementMatch, false);
    assert.equal(m.factors.rateMatch, false);
    assert.equal(m.score, 100); // skills only
  });

  it("currency mismatch gates the rate bonus off", async () => {
    const s = new TestStorage();
    s.injectedJobs = [makeJob({ budgetCurrency: "PHP" })];
    const candidate = makeCandidate(); // USD prefs

    const [m] = await s.calculateJobMatches("cand-legacy", undefined, candidate);
    assert.equal(m.factors.engagementMatch, true);
    assert.equal(m.factors.rateMatch, false);
    assert.equal(m.score, 120); // 100 skills + 20 engagement
  });

  it("fallback entries (no skill overlap) carry factors with false flags", async () => {
    const s = new TestStorage();
    s.injectedJobs = [makeJob({ id: "job-x", skills: ["Cobol"] })];
    const candidate = makeCandidate(); // JavaScript skills → no overlap → fallback path

    const matches = await s.calculateJobMatches("cand-legacy", undefined, candidate);
    assert.ok(matches.length >= 1);
    for (const m of matches) {
      assert.deepEqual(m.factors, { skillOverlapCount: 0, engagementMatch: false, rateMatch: false });
      assert.equal(m.score, 0);
    }
  });
});
