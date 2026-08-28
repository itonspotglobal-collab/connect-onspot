/**
 * job-match-scoring.test.ts
 *
 * Unit tests for the engagement-type–aware scoring inside `calculateJobMatches`
 * (MemStorage, server/storage.ts).
 *
 * Strategy: create a lightweight subclass of MemStorage that overrides only the
 * four internal methods `calculateJobMatches` depends on so no live DB or HTTP
 * server is needed.
 *
 * Coverage:
 *  (a) Candidate with matching rateEngagementType scores +20 vs. non-matching
 *  (b) Candidate with rate amount within ±20% of job budget scores +10 vs. outside
 *  (c) Job with NULL engagementType produces no regression (no bonus, no penalty, no error)
 *  (d) Legacy job (no engagementType) does not throw
 *
 * Run with:  npm test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MemStorage } from "../storage.js";
import type { Job, Candidate, Profile } from "@shared/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal Job-shaped object. All nullable columns default to null. */
function makeJob(overrides: Partial<Job & { skills: string[] }> = {}): Job & { skills: string[] } {
  const OLD_DATE = new Date("2020-01-01T00:00:00Z"); // far in the past → no recency bonus
  return {
    id: "job-test-1",
    clientId: "client-1",
    title: "Test Job",
    description: "A test job description",
    category: "Technical",
    engagementType: "contract",
    budget: "50000",
    budgetCurrency: "PHP",
    customCurrencyCode: null,
    salaryDisplay: null,
    hourlyRateMin: null,
    hourlyRateMax: null,
    duration: null,
    experienceLevel: "intermediate",
    responsibilities: null,
    requirements: null,
    skillTags: null,
    culturalFit: null,
    company: "OnSpot",
    location: "Remote",
    professionalRoleName: null,
    originalRoleName: null,
    jobFunction: null,
    otherFunction: null,
    reportingTo: null,
    division: null,
    jobCode: null,
    jobGrade: null,
    jobLevel: null,
    companyOverview: null,
    roleMission: null,
    keyOutcomes: null,
    keyResponsibilities: null,
    skillsAndCompetencies: null,
    behavioralTraits: null,
    kpis: null,
    trainingAndSupport: null,
    growthPath: null,
    jobSummary: null,
    minimumInternetSpeed: null,
    systemRequirements: null,
    requiredToolsSoftware: null,
    otherEquipmentRequirements: null,
    workDays: null,
    timeZone: null,
    preferredQualifications: null,
    compensationNotes: null,
    status: "open",
    createdAt: OLD_DATE,
    updatedAt: OLD_DATE,
    skills: ["JavaScript"],
    ...(overrides as any),
  } as Job & { skills: string[] };
}

/** Build a minimal Candidate-shaped object with injectable preferences. */
function makeCandidate(preferences: Record<string, unknown> = {}): Candidate {
  return {
    id: "cand-1",
    userId: "talent-1",
    email: "talent@example.com",
    fullName: "Test Talent",
    displayName: "Test Talent",
    headline: null,
    summary: null,
    location: null,
    timezone: null,
    profilePhotoUrl: null,
    resumeUrl: null,
    resumeFileName: null,
    videoIntroUrl: null,
    videoIntroFileName: null,
    linkedinUrl: null,
    portfolioUrl: null,
    websiteUrl: null,
    coreSkills: [],
    softSkills: [],
    workHistory: [],
    education: [],
    certifications: [],
    category: null,
    specialization: null,
    preferredRoles: [],
    availableFrom: null,
    workSetup: null,
    profileCompleted: false,
    passwordHash: null,
    preferences,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  } as unknown as Candidate;
}

// ─────────────────────────────────────────────────────────────────────────────
// TestStorage — MemStorage with injectable data for the four dep methods
// ─────────────────────────────────────────────────────────────────────────────

class TestStorage extends MemStorage {
  injectedJobs: (Job & { skills: string[] })[] = [];
  injectedCandidate: Candidate | undefined = undefined;
  injectedProfile: Profile | undefined = undefined;
  injectedTalentSkills: string[] = ["JavaScript"];

  override async searchJobsWithSkills(_filters: any) {
    return this.injectedJobs;
  }

  override async getUserSkillsWithNames(_userId: string) {
    return this.injectedTalentSkills.map((name, i) => ({
      id: i + 1,
      userId: "talent-1",
      skillId: i + 1,
      yearsExperience: null,
      createdAt: new Date("2024-01-01"),
      skill: { name, category: "General" },
    }));
  }

  override async getProfileByUserId(_userId: string) {
    return this.injectedProfile;
  }

  override async getCandidateByUserId(_userId: string) {
    return this.injectedCandidate;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateJobMatches — engagement-type scoring", () => {

  // ── (a) Engagement type match → +20 bonus ───────────────────────────────────
  it("(a) matching rateEngagementType scores +20 higher than a non-matching candidate", async () => {
    const job = makeJob({ id: "job-a", engagementType: "contract" });

    // Candidate whose preference matches the job's engagement type
    const storageMatch = new TestStorage();
    storageMatch.injectedJobs = [job];
    storageMatch.injectedCandidate = makeCandidate({ rateEngagementType: "contract" });

    const [matchA] = await storageMatch.calculateJobMatches("talent-1", { skills: ["JavaScript"] });

    // Candidate whose preference does NOT match
    const storageMiss = new TestStorage();
    storageMiss.injectedJobs = [job];
    storageMiss.injectedCandidate = makeCandidate({ rateEngagementType: "permanent" });

    const [missA] = await storageMiss.calculateJobMatches("talent-1", { skills: ["JavaScript"] });

    assert.ok(matchA, "Expected at least one match result for the matching candidate");
    assert.ok(missA,  "Expected at least one match result for the non-matching candidate");
    assert.equal(
      matchA.score - missA.score, 20,
      `Expected exactly +20 difference; got matching=${matchA.score}, non-matching=${missA.score}`,
    );
  });

  // ── (b) Rate amount within ±20% → +10 bonus ─────────────────────────────────
  it("(b) candidate rate within ±20% of job budget scores +10 higher than outside range", async () => {
    const job = makeJob({
      id: "job-b",
      engagementType: "contract",
      budget: "50000",
      budgetCurrency: "PHP",
    });

    // Candidate whose rate is within ±20% (50000 * 1.0 = 50000, ratio = 1.0 ✓)
    const storageIn = new TestStorage();
    storageIn.injectedJobs = [job];
    storageIn.injectedCandidate = makeCandidate({
      rateEngagementType: "permanent", // no engagement match → isolates rate bonus
      rateAmount: "50000",
      rateCurrency: "PHP",
    });

    const [inRange] = await storageIn.calculateJobMatches("talent-1", { skills: ["JavaScript"] });

    // Candidate whose rate is outside ±20% (200000, ratio = 4.0 ✗)
    const storageOut = new TestStorage();
    storageOut.injectedJobs = [job];
    storageOut.injectedCandidate = makeCandidate({
      rateEngagementType: "permanent",
      rateAmount: "200000",
      rateCurrency: "PHP",
    });

    const [outRange] = await storageOut.calculateJobMatches("talent-1", { skills: ["JavaScript"] });

    assert.ok(inRange,  "Expected a match result for in-range candidate");
    assert.ok(outRange, "Expected a match result for out-of-range candidate");
    assert.equal(
      inRange.score - outRange.score, 10,
      `Expected exactly +10 difference; got in-range=${inRange.score}, out-of-range=${outRange.score}`,
    );
  });

  // ── (c) NULL engagementType → no regression ──────────────────────────────────
  it("(c) job with NULL engagementType produces no bonus and no penalty compared to baseline", async () => {
    // Baseline: job with no engagementType, candidate has preferences
    const nullEngagementJob = makeJob({ id: "job-c", engagementType: null });

    const storage = new TestStorage();
    storage.injectedJobs = [nullEngagementJob];
    storage.injectedCandidate = makeCandidate({
      rateEngagementType: "contract",
      rateAmount: "50000",
      rateCurrency: "PHP",
    });

    const results = await storage.calculateJobMatches("talent-1", { skills: ["JavaScript"] });

    assert.ok(results.length > 0, "Should still return results even with NULL engagementType");

    const [result] = results;
    // Base Jaccard: skills=["JavaScript"], job.skills=["JavaScript"] → Jaccard=1.0 → 100pts
    // No engagementType means neither +20 nor +10 should apply
    assert.equal(
      result.score, 100,
      `Expected base Jaccard score of 100 (no bonus); got ${result.score}`,
    );
  });

  // ── (d) Legacy job (no engagementType) does not throw ────────────────────────
  it("(d) legacy job with NULL engagementType does not throw and returns a valid result", async () => {
    const legacyJob = makeJob({ id: "job-d", engagementType: null, budget: null });

    const storage = new TestStorage();
    storage.injectedJobs = [legacyJob];
    storage.injectedCandidate = makeCandidate({});

    let results: Awaited<ReturnType<TestStorage["calculateJobMatches"]>>;
    await assert.doesNotReject(async () => {
      results = await storage.calculateJobMatches("talent-1", { skills: ["JavaScript"] });
    }, "calculateJobMatches must not throw for a legacy job with NULL engagementType");

    assert.ok(results!.length > 0, "Should return at least one result for the legacy job");
    const [result] = results!;
    assert.ok(typeof result.score === "number" && Number.isFinite(result.score),
      `score must be a finite number; got ${result.score}`);
  });

  it("(e) matches an Other job by its custom function instead of the literal Other label", async () => {
    const job = makeJob({
      id: "job-e",
      category: "Other",
      jobFunction: "Other",
      otherFunction: "Customer Education",
    });

    const storage = new TestStorage();
    storage.injectedJobs = [job];
    storage.injectedCandidate = {
      ...makeCandidate(),
      category: "Customer Education",
    };

    const [result] = await storage.calculateJobMatches("talent-1", {
      skills: ["JavaScript"],
    });

    assert.equal(result.matchReasons.categoryMatch, true);
    assert.ok(result.matchReasons.factors.includes("Industry: Customer Education"));
  });
});
