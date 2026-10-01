import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BILLING_CURRENCY, requireUsdCurrency } from "../../shared/currency.js";
import {
  buildProfileRatePreferencePatch,
  MemStorage,
  sameFinancialValue,
  validateUsdJobUpdate,
  validateUsdProfileUpdate,
  validateUsdRatePreferenceUpdate,
} from "../storage.js";
import { jobUpdateAuthorizationStatus } from "../routes.js";

describe("USD-only rollout guards", () => {
  it("defaults missing currency to USD and rejects another denomination with the stable error", () => {
    assert.equal(requireUsdCurrency(), BILLING_CURRENCY);
    assert.equal(requireUsdCurrency("usd"), BILLING_CURRENCY);
    assert.throws(
      () => requireUsdCurrency("PHP"),
      (error: any) =>
        error.code === "USD_ONLY" &&
        error.status === 400 &&
        error.message === "New pricing and billing records must use USD; existing amounts cannot be converted or relabeled.",
    );
  });

  it("requires USD for new in-memory jobs and profiles without changing their existing amounts", async () => {
    const storage = new MemStorage();
    const job = await storage.createJob({
      clientId: "client",
      title: "USD role",
      description: "Role",
      category: "Engineering",
      experienceLevel: "intermediate",
    } as any);
    assert.equal(job.budgetCurrency, "USD");
    await assert.rejects(
      storage.createJob({
        clientId: "client",
        title: "Legacy denomination",
        description: "Role",
        category: "Engineering",
        experienceLevel: "intermediate",
        budgetCurrency: "PHP",
      } as any),
      (error: any) => error.code === "USD_ONLY" && error.status === 400,
    );

    const profile = await storage.createProfile({
      userId: "talent",
      firstName: "A",
      lastName: "Talent",
      hourlyRate: "20",
    } as any);
    assert.equal(profile.rateCurrency, "USD");
  });

  it("allows unchanged legacy PHP job/profile fields but rejects relabeling or repricing them", () => {
    assert.equal(sameFinancialValue("30000.00", "30000"), true);
    assert.equal(sameFinancialValue("0.00", "0"), true);
    assert.equal(sameFinancialValue("9007199254740993.00", "9007199254740993"), true);
    assert.equal(sameFinancialValue("9007199254740993", "9007199254740992"), false);
    assert.doesNotThrow(() =>
      validateUsdJobUpdate(
        { budget: "30000", budgetCurrency: "PHP", salaryDisplay: "PHP 30,000" },
        { budget: "30000", budgetCurrency: "PHP", salaryDisplay: "PHP 30,000" },
      ),
    );
    assert.throws(
      () => validateUsdJobUpdate(
        { budget: "30000.00", budgetCurrency: "PHP", salaryDisplay: "PHP 30,000" },
        { budget: "30000", budgetCurrency: "USD", salaryDisplay: "PHP 30,000" },
      ),
      (error: any) => error.code === "USD_ONLY",
    );
    assert.throws(
      () => validateUsdJobUpdate(
        { budget: "0.00", budgetCurrency: "PHP", salaryDisplay: "PHP 0.00" },
        { budget: "0", budgetCurrency: "USD", salaryDisplay: "PHP 0.00" },
      ),
      (error: any) => error.code === "USD_ONLY",
    );
    assert.throws(
      () => validateUsdJobUpdate(
        { budget: "30000", budgetCurrency: "PHP" },
        { budget: "32000" },
      ),
      (error: any) => error.code === "USD_ONLY",
    );
    assert.throws(
      () => validateUsdJobUpdate(
        { budget: "30000", budgetCurrency: null },
        { budget: "32000" },
      ),
      (error: any) => error.code === "USD_ONLY",
    );
    assert.doesNotThrow(() =>
      validateUsdJobUpdate(
        { budget: "30000.00", budgetCurrency: "PHP" },
        { budget: "31000", budgetCurrency: "USD" },
      ),
    );

    assert.doesNotThrow(() =>
      validateUsdProfileUpdate(
        { hourlyRate: "20", rateCurrency: "PHP" },
        { hourlyRate: "20", rateCurrency: "PHP" },
      ),
    );
    assert.throws(
      () => validateUsdProfileUpdate(
        { hourlyRate: "20", rateCurrency: "PHP" },
        { hourlyRate: "20", rateCurrency: "USD" },
      ),
      (error: any) => error.code === "USD_ONLY",
    );
    assert.throws(
      () => validateUsdProfileUpdate(
        { hourlyRate: "20.00", rateCurrency: "PHP" },
        { hourlyRate: "20", rateCurrency: "USD" },
      ),
      (error: any) => error.code === "USD_ONLY",
    );
    assert.throws(
      () => validateUsdProfileUpdate(
        { hourlyRate: "20", rateCurrency: null },
        { hourlyRate: "35" },
      ),
      (error: any) => error.code === "USD_ONLY",
    );
    assert.doesNotThrow(() =>
      validateUsdProfileUpdate(
        { hourlyRate: "20", rateCurrency: "PHP" },
        { hourlyRate: "35", rateCurrency: "USD" },
      ),
    );
  });

  it("preserves unchanged PHP candidate preferences and requires USD for newly entered rates", () => {
    assert.doesNotThrow(() =>
      validateUsdRatePreferenceUpdate(
        { rateAmount: "25.00", rateCurrency: "PHP" },
        { rateAmount: "25", rateCurrency: "PHP" },
      ),
    );
    assert.throws(
      () => validateUsdRatePreferenceUpdate(
        { rateAmount: "25.00", rateCurrency: "PHP" },
        { rateAmount: "25", rateCurrency: "USD" },
      ),
      (error: any) => error.code === "USD_ONLY",
    );
    assert.throws(
      () => validateUsdRatePreferenceUpdate(
        { rateAmount: "25", rateCurrency: "PHP" },
        { rateAmount: "30" },
      ),
      (error: any) => error.code === "USD_ONLY",
    );
    assert.throws(
      () => validateUsdRatePreferenceUpdate(
        { rateAmount: "25", rateCurrency: "PHP" },
        { rateAmount: "25", rateCurrency: "USD" },
      ),
      (error: any) => error.code === "USD_ONLY",
    );
    assert.doesNotThrow(() =>
      validateUsdRatePreferenceUpdate(
        { rateAmount: "25", rateCurrency: "PHP" },
        { rateAmount: "40", rateCurrency: "USD" },
      ),
    );
  });

  it("detects legacy OTHER currency-code changes and preserves candidate PHP rates on bio-only profile saves", () => {
    assert.throws(
      () => validateUsdJobUpdate(
        {
          budget: "30000.00",
          budgetCurrency: "OTHER",
          customCurrencyCode: "PHP",
          salaryDisplay: "PHP 30,000",
        },
        {
          budget: "30000",
          budgetCurrency: "OTHER",
          customCurrencyCode: "USD",
          salaryDisplay: "PHP 30,000",
        },
      ),
      (error: any) => error.code === "USD_ONLY",
    );

    const phpPreferences = {
      rateAmount: "25.00",
      rateCurrency: "PHP",
      rateEngagementType: "weekly",
    };
    const patch = buildProfileRatePreferencePatch(
      { hourlyRate: "25.00", rateCurrency: "USD" },
      { hourlyRate: "25", rateCurrency: "USD" },
      phpPreferences,
      "hourly",
    );
    assert.equal(patch, null);
    assert.deepEqual(phpPreferences, {
      rateAmount: "25.00",
      rateCurrency: "PHP",
      rateEngagementType: "weekly",
    });
    assert.deepEqual(
      buildProfileRatePreferencePatch(
        { hourlyRate: "20", rateCurrency: "USD" },
        { hourlyRate: "30", rateCurrency: "USD" },
        phpPreferences,
        "hourly",
      ),
      {
        rateAmount: "30",
        rateCurrency: "USD",
        rateEngagementType: "hourly",
      },
    );
  });

  it("cannot relabel a retained historical salary by changing its independent zero budget", () => {
    const existing = { budget: "0.00", budgetCurrency: "PHP", salaryDisplay: "30,000" };
    for (const updates of [
      { budget: "100", budgetCurrency: "USD" },
      { budget: "100", budgetCurrency: "USD", salaryDisplay: "30,000" },
      { budget: "100", budgetCurrency: "USD", salaryDisplay: "30000.00" },
    ]) {
      assert.throws(
        () => validateUsdJobUpdate(existing, updates),
        (error: any) => error.code === "USD_ONLY" && error.status === 400,
      );
    }
    assert.doesNotThrow(() =>
      validateUsdJobUpdate(existing, { budget: "100", budgetCurrency: "USD", salaryDisplay: "" }),
    );
    assert.doesNotThrow(() =>
      validateUsdJobUpdate(existing, { budget: "100", budgetCurrency: "USD", salaryDisplay: "100" }),
    );
    assert.deepEqual(existing, { budget: "0.00", budgetCurrency: "PHP", salaryDisplay: "30,000" });
  });

  it("authorizes only admins and owning clients on the generic job-update path", () => {
    const job = { clientId: "client-1" };
    assert.equal(jobUpdateAuthorizationStatus(null, job), 401);
    assert.equal(jobUpdateAuthorizationStatus({ id: "talent-1", role: "talent" }, job), 403);
    assert.equal(jobUpdateAuthorizationStatus({ id: "client-2", role: "client" }, job), 403);
    assert.equal(jobUpdateAuthorizationStatus({ id: "client-1", role: "client" }, job), null);
    assert.equal(jobUpdateAuthorizationStatus({ id: "admin-1", role: "admin" }, job), null);
  });
});