/**
 * formatPublicTalentName.test.ts
 *
 * Run with: npx vitest run client/src/lib/formatPublicTalentName.test.ts
 */
import { describe, it, expect } from "vitest";
import {
  formatPublicTalentName,
  formatPublicTalentNameFromFull,
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
  it("three-word name → FirstFirst L.", () => {
    expect(formatPublicTalentNameFromFull("Van Carlo Labanan")).toBe("Van Carlo L.");
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
