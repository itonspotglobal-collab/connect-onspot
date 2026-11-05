/**
 * formatPublicTalentName.test.ts
 *
 * Run with: npx vitest run --config vitest.unit.config.mts client/src/lib/formatPublicTalentName.test.ts
 */
import { describe, it, expect } from "vitest";
import { maskClientTalentName } from "@shared/talentName";
import {
  sanitizeSearchCandidate,
  sanitizeFullProfileForClient,
} from "../../../server/lib/clientSearchSanitize";
import {
  formatPublicTalentName,
  formatPublicTalentNameFromFull,
  formatPublicTalentNameMasked,
  getPrivacySafeTalentDisplayName,
} from "./formatPublicTalentName";

// ─── formatPublicTalentName ───────────────────────────────────────────────────

describe("formatPublicTalentName", () => {
  // Client privacy intentionally differs from private profile-name storage:
  // retain only the first given-name token, never middle names or a surname.
  it("Oddie + Galang → Oddie G.", () => {
    expect(formatPublicTalentName("Oddie", "Galang")).toBe("Oddie G.");
  });
  it("Odie + Galang → Odie G.", () => {
    expect(formatPublicTalentName("Odie", "Galang")).toBe("Odie G.");
  });
  it("Van Carlo + Labanan → Van L.", () => {
    expect(formatPublicTalentName("Van Carlo", "Labanan")).toBe("Van L.");
  });
  it("Julie + Stramer → Julie S.", () => {
    expect(formatPublicTalentName("Julie", "Stramer")).toBe("Julie S.");
  });
  it("Lesley Jean + Valencinerina → Lesley V.", () => {
    expect(formatPublicTalentName("Lesley Jean", "Valencinerina")).toBe("Lesley V.");
  });
  it("Maria + De la Cruz → Maria D.", () => {
    expect(formatPublicTalentName("Maria", "De la Cruz")).toBe("Maria D.");
  });
  it("John + O'Connor → John O.", () => {
    expect(formatPublicTalentName("John", "O'Connor")).toBe("John O.");
  });

  // ── Edge cases ──
  it("empty lastName → empty string so the caller can use a safe fallback", () => {
    expect(formatPublicTalentName("Cher", "")).toBe("");
  });
  it("null lastName → empty string", () => {
    expect(formatPublicTalentName("Cher", null)).toBe("");
  });
  it("undefined lastName → empty string", () => {
    expect(formatPublicTalentName("Cher", undefined)).toBe("");
  });
  it("whitespace-only lastName → empty string", () => {
    expect(formatPublicTalentName("Cher", "   ")).toBe("");
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
  it("single legacy token → initial and bullets, since it might be a surname", () => {
    expect(formatPublicTalentNameFromFull("Cher")).toBe("C••••");
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
  it("single legacy token → initial and bullets", () => {
    expect(formatPublicTalentNameMasked("Cher")).toBe("C••••");
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
  it("omits additional structured given names on Client-facing surfaces", () => {
    expect(getPrivacySafeTalentDisplayName({
      firstName: "Mary Anne",
      lastName: "Cruz",
    })).toBe("Mary C.");
  });
  it("uses a single full-name fallback without exposing its surname", () => {
    expect(getPrivacySafeTalentDisplayName({ fullName: "Jane Doe" })).toBe("Jane D.");
  });
  it("never renders a legacy mask when no structured name is available", () => {
    expect(getPrivacySafeTalentDisplayName({ fullName: "R****" })).toBe("Talent Profile");
  });
  it.each([
    ["Jane Doe", "Jane D."],
    ["Jane Anne Doe", "Jane D."],
    ["Jane Anne D.", "Jane D."],
    ["Jane D.", "Jane D."],
    ["  Jane   Doe  ", "Jane D."],
    ["Doe", "D••••"],
    ["R****", "Talent Profile"],
    ["R••••", "Talent Profile"],
    ["", "Talent Profile"],
  ])("normalizes the legacy maskedName fallback %j → %j", (maskedName, expected) => {
    expect(getPrivacySafeTalentDisplayName({ maskedName })).toBe(expected);
  });
  it("does not let a legacy display value override authoritative structured fields", () => {
    expect(getPrivacySafeTalentDisplayName({
      firstName: "Jane Anne",
      lastName: "Doe",
      maskedName: "Other FullSurname",
    })).toBe("Jane D.");
  });
  it("uses a safe combined-name fallback when the structured pair is incomplete", () => {
    expect(getPrivacySafeTalentDisplayName({
      firstName: "Jane",
      lastName: null,
      fullName: "Jane Anne Doe",
    })).toBe("Jane D.");
  });
});

describe("Client/server privacy contract", () => {
  it.each([
    { firstName: "John Benedict", lastName: "Acosta", fullName: "John Benedict Acosta", expected: "John A." },
    { firstName: "Aaron Tristan", lastName: "Dela Cruz", expected: "Aaron D." },
    { first_name: "Van Carlo", last_name: "Lopez", expected: "Van L." },
    { fullName: "Mary Anne Cruz", expected: "Mary C." },
    { full_name: "John Benedict A.", expected: "John A." },
    { fullName: "Cher", expected: "C••••" },
    { firstName: "Cher", lastName: null, expected: "Talent Profile" },
    { fullName: "R****", expected: "Talent Profile" },
    { firstName: "Élodie Anne", lastName: "O’Connor", expected: "Élodie O." },
  ])("uses the same privacy mask for $expected", ({ expected, ...identity }) => {
    expect(maskClientTalentName(identity)).toBe(expected);
    expect(getPrivacySafeTalentDisplayName(identity)).toBe(expected);
    for (const sanitize of [sanitizeSearchCandidate, sanitizeFullProfileForClient]) {
      const safe = sanitize({
        ...identity,
        email: "private@example.test",
        phone: "+1 202 555 0100",
        resumeUrl: "https://private.example.test/resume.pdf",
      });
      expect(safe.maskedName).toBe(expected);
      expect(safe.fullName).toBe(expected);
      expect(safe.full_name).toBe(expected);
      const serialized = JSON.stringify(safe);
      expect(serialized).not.toContain("private@example.test");
      expect(serialized).not.toContain("+1 202 555 0100");
      expect(serialized).not.toContain("resume.pdf");
      expect(safe).not.toHaveProperty("firstName");
      expect(safe).not.toHaveProperty("lastName");
      expect(safe).not.toHaveProperty("first_name");
      expect(safe).not.toHaveProperty("last_name");
    }
  });
});
