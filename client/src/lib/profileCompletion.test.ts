/**
 * profileCompletion.test.ts
 *
 * Proves that the same profile data returns the same percentage
 * regardless of call order, repetition, or what the previous call returned.
 *
 * Run with: npx vitest run client/src/lib/profileCompletion.test.ts
 */
import { describe, it, expect } from "vitest";
import {
  buildCompletionItems,
  calcCompletionPct,
  profileStrengthFromCandidate,
  profileStrengthFromProfile,
} from "./profileCompletion";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(input: Parameters<typeof buildCompletionItems>[0]) {
  return calcCompletionPct(buildCompletionItems(input));
}

// ─── buildCompletionItems ────────────────────────────────────────────────────

describe("buildCompletionItems", () => {
  it("excludes items whose value is undefined", () => {
    const items = buildCompletionItems({ hasPhoto: true, hasName: undefined });
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ label: "Photo", done: true });
  });

  it("includes items whose value is false", () => {
    const items = buildCompletionItems({ hasPhoto: false });
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ label: "Photo", done: false });
  });

  it("returns all 12 items when all keys are provided", () => {
    const items = buildCompletionItems({
      hasPhoto: true, hasName: true, hasTitle: true, hasSummary: true,
      hasEmail: true, hasLocation: true, hasSkills: true, hasExperience: true,
      hasEducation: true, hasPreferences: true, hasResume: true, hasLinks: true,
    });
    expect(items).toHaveLength(12);
  });

  it("is deterministic — same input always produces same output", () => {
    const input = { hasName: true, hasPhoto: false, hasResume: true };
    expect(buildCompletionItems(input)).toEqual(buildCompletionItems(input));
  });
});

// ─── calcCompletionPct ───────────────────────────────────────────────────────

describe("calcCompletionPct", () => {
  it("returns 0 for an empty list", () => {
    expect(calcCompletionPct([])).toBe(0);
  });

  it("returns 100 when all items are done", () => {
    const items = [
      { label: "A", done: true },
      { label: "B", done: true },
    ];
    expect(calcCompletionPct(items)).toBe(100);
  });

  it("returns 0 when no items are done", () => {
    expect(calcCompletionPct([
      { label: "A", done: false },
      { label: "B", done: false },
    ])).toBe(0);
  });

  it("rounds correctly — 1 of 3 done → 33%", () => {
    expect(calcCompletionPct([
      { label: "A", done: true },
      { label: "B", done: false },
      { label: "C", done: false },
    ])).toBe(33);
  });
});

// ─── profileStrengthFromCandidate ────────────────────────────────────────────

describe("profileStrengthFromCandidate", () => {
  const fullCandidate = {
    profilePhotoUrl: "https://example.com/photo.jpg",
    displayName: "Jane Doe",
    fullName: "Jane Doe",
    headline: "Senior Engineer",
    summary: "Experienced engineer with 10 years in the field.",
    email: "jane@example.com",
    location: "Manila",
    coreSkills: ["TypeScript", "React", "Node.js"],
    workHistory: [{ title: "Engineer", company: "Acme" }],
    education: [{ school: "MIT", degree: "BS CS" }],
    preferences: { workSetup: "remote" },
    resumeUrl: "https://example.com/resume.pdf",
    linkedinUrl: "https://linkedin.com/in/janedoe",
    portfolioUrl: null,
  };

  it("returns 100% for a fully completed candidate", () => {
    const input = profileStrengthFromCandidate(fullCandidate);
    const items = buildCompletionItems(input);
    expect(items).toHaveLength(12);
    expect(calcCompletionPct(items)).toBe(100);
  });

  it("is identical before and after simulated refresh (same data → same result)", () => {
    const first = calcCompletionPct(buildCompletionItems(profileStrengthFromCandidate(fullCandidate)));
    const second = calcCompletionPct(buildCompletionItems(profileStrengthFromCandidate(fullCandidate)));
    expect(first).toBe(second);
  });

  it("returns 0% for a completely empty candidate", () => {
    const empty = profileStrengthFromCandidate({});
    expect(calcCompletionPct(buildCompletionItems(empty))).toBe(0);
  });

  it("counts name from displayName when fullName is absent", () => {
    const input = profileStrengthFromCandidate({ displayName: "Jane" });
    expect(input.hasName).toBe(true);
  });

  it("counts name from fullName when displayName is absent", () => {
    const input = profileStrengthFromCandidate({ fullName: "Jane Doe" });
    expect(input.hasName).toBe(true);
  });

  it("does not count name when both displayName and fullName are whitespace-only", () => {
    const input = profileStrengthFromCandidate({ displayName: "   ", fullName: "   " });
    expect(input.hasName).toBe(false);
  });

  it("counts LinkedIn link even when portfolioUrl is null", () => {
    const input = profileStrengthFromCandidate({ linkedinUrl: "https://linkedin.com/in/x" });
    expect(input.hasLinks).toBe(true);
  });

  it("counts portfolioUrl even when linkedinUrl is null", () => {
    const input = profileStrengthFromCandidate({ portfolioUrl: "https://portfolio.example.com" });
    expect(input.hasLinks).toBe(true);
  });

  it("does not count empty workHistory as experience", () => {
    const input = profileStrengthFromCandidate({ workHistory: [] });
    expect(input.hasExperience).toBe(false);
  });

  it("handles workHistory = null without throwing", () => {
    expect(() => profileStrengthFromCandidate({ workHistory: null })).not.toThrow();
    expect(profileStrengthFromCandidate({ workHistory: null }).hasExperience).toBe(false);
  });

  it("handles preferences without workSetup key", () => {
    const input = profileStrengthFromCandidate({ preferences: { timezone: "UTC" } });
    expect(input.hasPreferences).toBe(false);
  });

  it("handles malformed preferences (non-object) without throwing", () => {
    expect(() => profileStrengthFromCandidate({ preferences: "remote" as any })).not.toThrow();
    expect(profileStrengthFromCandidate({ preferences: "remote" as any }).hasPreferences).toBe(false);
  });
});

// ─── profileStrengthFromProfile ──────────────────────────────────────────────

describe("profileStrengthFromProfile", () => {
  const fullProfile = {
    firstName: "Jane",
    lastName: "Doe",
    title: "Senior Engineer",
    bio: "Experienced engineer.",
    location: "Manila",
    profilePicture: "https://example.com/photo.jpg",
    hasSkills: true,
    hasResume: true,
    hasLinks: true,
  };

  it("returns 100% for a fully completed profile (8 tracked items)", () => {
    const input = profileStrengthFromProfile(fullProfile);
    const items = buildCompletionItems(input);
    expect(items).toHaveLength(8);
    expect(calcCompletionPct(items)).toBe(100);
  });

  it("is identical before and after simulated refresh (same data → same result)", () => {
    const first = calcCompletionPct(buildCompletionItems(profileStrengthFromProfile(fullProfile)));
    const second = calcCompletionPct(buildCompletionItems(profileStrengthFromProfile(fullProfile)));
    expect(first).toBe(second);
  });

  it("returns 0% for a completely empty profile", () => {
    const empty = profileStrengthFromProfile({
      firstName: null, lastName: null, title: null, bio: null,
      location: null, profilePicture: null,
      hasSkills: false, hasResume: false, hasLinks: false,
    });
    expect(calcCompletionPct(buildCompletionItems(empty))).toBe(0);
  });

  it("does not count location = 'Global' as complete", () => {
    const input = profileStrengthFromProfile({
      ...fullProfile,
      location: "Global",
    });
    expect(input.hasLocation).toBe(false);
  });

  it("does not require bio to be 50+ chars (no length threshold)", () => {
    const input = profileStrengthFromProfile({ ...fullProfile, bio: "Hi" });
    expect(input.hasSummary).toBe(true);
  });

  it("does not track email (undefined — excluded from denominator)", () => {
    const input = profileStrengthFromProfile(fullProfile);
    expect(input.hasEmail).toBeUndefined();
  });

  it("does not track experience (undefined — excluded from denominator)", () => {
    const input = profileStrengthFromProfile(fullProfile);
    expect(input.hasExperience).toBeUndefined();
  });

  it("does not track education (undefined — excluded from denominator)", () => {
    const input = profileStrengthFromProfile(fullProfile);
    expect(input.hasEducation).toBeUndefined();
  });

  it("does not track preferences (undefined — excluded from denominator)", () => {
    const input = profileStrengthFromProfile(fullProfile);
    expect(input.hasPreferences).toBeUndefined();
  });
});

// ─── Cross-call consistency (the key regression test) ────────────────────────

describe("Consistency across save/reload/login cycles", () => {
  it("same candidate data returns same % when called 10 times in a row", () => {
    const candidate = {
      profilePhotoUrl: "photo.jpg",
      displayName: "Jane",
      headline: "Engineer",
      summary: "10 years exp.",
      email: "jane@example.com",
      location: "Manila",
      coreSkills: ["TypeScript"],
      workHistory: [{ title: "Dev" }],
      education: [{ school: "MIT" }],
      preferences: { workSetup: "remote" },
      resumeUrl: "resume.pdf",
      linkedinUrl: "linkedin.com",
    };
    const results = Array.from({ length: 10 }, () =>
      calcCompletionPct(buildCompletionItems(profileStrengthFromCandidate(candidate)))
    );
    expect(new Set(results).size).toBe(1);
  });

  it("same profile data returns same % when called 10 times in a row", () => {
    const profile = {
      firstName: "Jane", lastName: "Doe", title: "Engineer",
      bio: "Senior engineer.", location: "Manila",
      profilePicture: "photo.jpg",
      hasSkills: true, hasResume: true, hasLinks: false,
    };
    const results = Array.from({ length: 10 }, () =>
      calcCompletionPct(buildCompletionItems(profileStrengthFromProfile(profile)))
    );
    expect(new Set(results).size).toBe(1);
  });

  it("adding a field increases the percentage", () => {
    const base = { hasName: true, hasPhoto: false, hasTitle: false };
    const withPhoto = { ...base, hasPhoto: true };
    expect(pct(withPhoto)).toBeGreaterThan(pct(base));
  });

  it("removing a field decreases the percentage", () => {
    const full = { hasName: true, hasPhoto: true, hasTitle: true };
    const partial = { hasName: true, hasPhoto: false, hasTitle: true };
    expect(pct(partial)).toBeLessThan(pct(full));
  });
});
