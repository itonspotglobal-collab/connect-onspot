import { describe, expect, it } from "vitest";
import { defaultFormData, jobToFormData } from "./jobFormUtils";
import { buildRateDisplay, formatCurrencyAmount } from "./jobUtils";

describe("USD-only new pricing defaults and historical currency display", () => {
  it("defaults new job forms and missing future job currencies to USD", () => {
    expect(defaultFormData.currency).toBe("USD");
    expect(jobToFormData({ id: "new-data", title: "Role" } as any).currency).toBe("USD");
  });

  it("preserves an explicitly saved PHP currency while editing", () => {
    const form = jobToFormData({
      id: "legacy-php",
      title: "IT Administrator",
      status: "open",
      budgetCurrency: "PHP",
      salaryDisplay: "40,000–60,000",
    } as any);

    expect(form.currency).toBe("PHP");
    expect(form.salaryDisplay).toBe("40,000–60,000");
    expect(buildRateDisplay({
      salaryDisplay: form.salaryDisplay,
      budgetCurrency: form.currency,
    })).toBe("₱40,000 - ₱60,000");
  });

  it("keeps approved PHP job salary ranges in PHP without converting their amounts", () => {
    const historicalJobs = [
      { title: "Sales Representative", salaryDisplay: "30,000", expected: "₱30,000" },
      { title: "IT Administrator", salaryDisplay: "40,000–60,000", expected: "₱40,000 - ₱60,000" },
      { title: "IT Technical Support", salaryDisplay: "30,000–40,000", expected: "₱30,000 - ₱40,000" },
      { title: "Business Development Associate", salaryDisplay: "35,000–45,000", expected: "₱35,000 - ₱45,000" },
    ];

    for (const job of historicalJobs) {
      expect(buildRateDisplay({
        salaryDisplay: job.salaryDisplay,
        budgetCurrency: "PHP",
      }), job.title).toBe(job.expected);
    }
  });

  it("preserves explicit historical currency prefixes when metadata is missing", () => {
    const examples = [
      { salaryDisplay: "PHP 30,000", expected: "PHP 30,000" },
      { salaryDisplay: "₱30,000", expected: "₱30,000" },
      { salaryDisplay: "USD 30,000", expected: "USD 30,000" },
      { salaryDisplay: "$30,000", expected: "$30,000" },
      { salaryDisplay: "GBP 30,000", expected: "GBP 30,000" },
      { salaryDisplay: "EUR 30,000", expected: "EUR 30,000" },
      { salaryDisplay: "OTHER 30,000", expected: "OTHER 30,000" },
    ];

    for (const example of examples) {
      expect(buildRateDisplay({ salaryDisplay: example.salaryDisplay })).toBe(example.expected);
    }
  });

  it("preserves explicit salary denominations and flags conflicting currency metadata", () => {
    expect(buildRateDisplay({
      salaryDisplay: "USD 45,000",
      budgetCurrency: "PHP",
    })).toBe("USD 45,000 (currency metadata mismatch: PHP)");

    expect(buildRateDisplay({
      salaryDisplay: "PHP 45,000",
      budgetCurrency: "USD",
    })).toBe("PHP 45,000 (currency metadata mismatch: USD)");
  });

  it("formats rate amounts using their actual currency code", () => {
    expect(formatCurrencyAmount(30000, "USD")).toContain("$");
    expect(formatCurrencyAmount(30000, "EUR")).toContain("€");
    expect(formatCurrencyAmount(30000, "PHP")).toBe("₱30,000");
    expect(formatCurrencyAmount(30000)).toContain("$");
  });
});