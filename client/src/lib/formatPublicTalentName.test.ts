/**
 * formatPublicTalentName.test.ts
 *
 * Run with: npx vitest run client/src/lib/formatPublicTalentName.test.ts
 */
import { describe, it, expect } from "vitest";
import {
  formatPublicTalentName,
  formatPublicTalentNameFromFull,
  formatPublicTalentNameMasked,
  getPrivacySafeTalentDisplayName,
} from "./formatPublicTalentName";

// ─── formatPublicTalentName ───────────────────────────────────────────────────

describe("formatPublicTalentName", () => {
  // ── Acceptance-criteria cases from the spec ──
  it("Oddie + Galang → Oddie G.", () => {
    expect(formatPublicTalentName("Oddie", "Galang")).toBe("Oddie G.");
  });
  it("Odie + Galang → Odie G.", () => {
    expect(formatPublicTalentName("Odie", "Galang")).toBe("Odie G.");
  });
  it("Van Carlo + Labanan → Van Carlo L.", () => {
    expect(formatPublicTalentName("Van Carlo", "Labanan")).toBe("Van Carlo L.");
  });
  it("Julie + Stramer → Julie S.", () => {
    expect(formatPublicTalentName("Julie", "Stramer")).toBe("Julie S.");
  });
  it("Lesley Jean + Valencinerina → Lesley Jean V.", () => {
    expect(formatPublicTalentName("Lesley Jean", "Valencinerina")).toBe("Lesley Jean V.");
  });
  it("Maria + De la Cruz → Maria D.", () => {
    expect(formatPublicTalentName("Maria", "De la Cruz")).toBe("Maria D.");
  });
  it("John + O'Connor → John O.", () => {
    expect(formatPublicTalentName("John", "O'Connor")).toBe("John O.");
  });

  // ── Edge cases ──
  it("empty lastName → first name only, no trailing space or period", () => {
    expect(formatPublicTalentName("Cher", "")).toBe("Cher");
  });
  it("null lastName → first name only", () => {
    expect(formatPublicTalentName("Cher", null)).toBe("Cher");
  });
  it("undefined lastName → first name only", () => {
    expect(formatPublicTalentName("Cher", undefined)).toBe("Cher");
  });
  it("whitespace-only lastName → first name only", () => {
    expect(formatPublicTalentName("Cher", "   ")).toBe("Cher");
  });
  it("missing firstName → empty string (never exposes last name)", () => {
    expect(formatPublicTalentName("", "Galang")).toBe("");
  });
  it("null firstName → empty string", () => {
    expect(formatPublicTalentName(null, "Galang")).toBe("");
  });
  it("both null → empty string", () => {
    expect(formatPublicTalentName(null, null)).toBe("");
  });
  it("both undefined → empty string", () => {
    expect(formatPublicTalentName(undefined, undefined)).toBe("");
  });
  it("trims whitespace from both fields", () => {
    expect(formatPublicTalentName("  Ana  ", "  Reyes  ")).toBe("Ana R.");
  });
  it("uppercases a lowercase first character of surname", () => {
    expect(formatPublicTalentName("Maria", "de la Cruz")).toBe("Maria D.");
  });
  it("does not produce double period for single-char last name", () => {
    expect(formatPublicTalentName("Ali", "B")).toBe("Ali B.");
  });
  it("result never contains the full last name", () => {
    const result = formatPublicTalentName("Odie", "Galang");
    expect(result).not.toContain("Galang");
    expect(result).toBe("Odie G.");
  });
});

// ─── formatPublicTalentNameFromFull ──────────────────────────────────────────

describe("formatPublicTalentNameFromFull", () => {
  it("two-word name → First L.", () => {
    expect(formatPublicTalentNameFromFull("Odie Galang")).toBe("Odie G.");
  });
  it("three-word name → first token plus final surname initial", () => {
    expect(formatPublicTalentNameFromFull("Van Carlo Labanan")).toBe("Van L.");
  });
  it("multi-part name ignores middle names", () => {
    expect(formatPublicTalentNameFromFull("Mary Anne Cruz")).toBe("Mary C.");
  });
  it("single name → returned as-is", () => {
    expect(formatPublicTalentNameFromFull("Cher")).toBe("Cher");
  });
  it("empty string → empty string", () => {
    expect(formatPublicTalentNameFromFull("")).toBe("");
  });
  it("null → empty string", () => {
    expect(formatPublicTalentNameFromFull(null)).toBe("");
  });
  it("undefined → empty string", () => {
    expect(formatPublicTalentNameFromFull(undefined)).toBe("");
  });
  it("extra whitespace is ignored", () => {
    expect(formatPublicTalentNameFromFull("  Julie   Stramer  ")).toBe("Julie S.");
  });
});

// ─── formatPublicTalentNameMasked ────────────────────────────────────────────

describe("formatPublicTalentNameMasked", () => {
  it("single name → returned as-is", () => {
    expect(formatPublicTalentNameMasked("Cher")).toBe("Cher");
  });
  it("two names → First S.", () => {
    expect(formatPublicTalentNameMasked("John Smith")).toBe("John S.");
  });
  it("combined multi-word name uses only the first and final tokens", () => {
    expect(formatPublicTalentNameMasked("Frenzy Val Eloise")).toBe("Frenzy E.");
  });
  it("does not expose the final surname from a multi-word name", () => {
    expect(formatPublicTalentNameMasked("Frenzy Val Eloise Legaspi")).toBe("Frenzy L.");
  });

  it("strips trailing period from a token before taking its initial", () => {
    expect(formatPublicTalentNameMasked("Ijeoma O.")).toBe("Ijeoma O.");
  });

  it("trims leading/trailing whitespace", () => {
    expect(formatPublicTalentNameMasked("  John Smith  ")).toBe("John S.");
  });
  it("collapses internal whitespace between tokens", () => {
   expect(formatPublicTalentNameMasked("Van  Carlo   Labanan")).toBe("Van L.");
  });

  it("empty string → empty string", () => {
    expect(formatPublicTalentNameMasked("")).toBe("");
  });
  it("whitespace-only string → empty string", () => {
    expect(formatPublicTalentNameMasked("   ")).toBe("");
  });
  it("null → empty string", () => {
    expect(formatPublicTalentNameMasked(null)).toBe("");
  });
  it("undefined → empty string", () => {
    expect(formatPublicTalentNameMasked(undefined)).toBe("");
  });
  it("legacy asterisk masks are discarded rather than rendered", () => {
    expect(formatPublicTalentNameMasked("R****")).toBe("");
  });

  it("never exposes the full final surname", () => {
    const result = formatPublicTalentNameMasked("Frenzy Val Eloise Legaspi");
    expect(result).not.toContain("Legaspi");
    expect(result).toBe("Frenzy L.");
  });
  it("initials are always uppercased", () => {
    expect(formatPublicTalentNameMasked("anna smith")).toBe("anna S.");
  });
});

describe("getPrivacySafeTalentDisplayName", () => {
  it("prefers structured names over an old masked display value", () => {
    expect(getPrivacySafeTalentDisplayName({
      firstName: "Robert",
      lastName: "Smith",
      maskedName: "R****",
    })).toBe("Robert S.");
  });
  it("uses a valid full name before a legacy masked display value", () => {
    expect(getPrivacySafeTalentDisplayName({
      fullName: "Robert Smith",
      maskedName: "R****",
    })).toBe("Robert S.");
  });
  it("keeps a multi-word structured first name intact", () => {
    expect(getPrivacySafeTalentDisplayName({
      firstName: "Mary Anne",
      lastName: "Cruz",
    })).toBe("Mary Anne C.");
  });
  it("uses a single full-name fallback without exposing its surname", () => {
    expect(getPrivacySafeTalentDisplayName({ fullName: "Jane Doe" })).toBe("Jane D.");
  });
  it("never renders a legacy mask when no structured name is available", () => {
    expect(getPrivacySafeTalentDisplayName({ fullName: "R****" })).toBe("Talent Profile");
  });
});
