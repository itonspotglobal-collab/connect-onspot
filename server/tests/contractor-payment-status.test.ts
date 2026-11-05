import { test, mock } from "node:test";
import assert from "node:assert/strict";

mock.module("../services/contractorOnboardingPolicy", { namedExports: {
  isDepositFirst: async () => true,
  OnboardingError: class extends Error {},
} });
mock.module("../services/adminHiringOverrideState", { namedExports: {
  hiringOverrideState: async () => ({ overriddenStages: [], finalInterviewPassed: false, skipMsa: false, skipContractorAgreement: false }),
} });
mock.module("../services/depositArrangementState", { namedExports: {
  depositArrangement: async () => null, msaSignatureExists: async () => false,
} });
mock.module("../services/onboardingPrerequisites", { namedExports: {
  onboardingPrerequisites: async () => ({ wiseReady: false, msaReady: false }),
} });
const { onboardingStatus } = await import("../services/contractorOnboardingStatus");

async function status(role: string, stage: string, accepted: boolean, deposit: any) {
  const db = { query: async (sql: string) => {
    let rows: any[] = [];
    if (sql.includes("FROM job_submissions js")) rows = [{
      id: "submission-fixture", client_id: "client-fixture", job_id: "job-fixture",
      status: stage, actor_role: role, actor_sub_role: null,
    }];
    else if (sql.includes("FROM offers")) rows = accepted ? [{ id: "offer-fixture", status: "accepted" }] : [];
    else if (sql.includes("FROM security_deposits")) rows = deposit ? [deposit] : [];
    else if (sql.includes("FROM jobs")) rows = [{ title: "Fixture role" }];
    return { rows };
  } };
  return onboardingStatus(db as any, "submission-fixture", "actor-fixture");
}

for (const role of ["client", "admin", "talent"]) {
  for (const stage of ["shortlisted", "interviewing"]) {
    test(`${role} ${stage} has no payment state or payment-setup notice`, async () => {
      const result = await status(role, stage, false, null);
      assert.equal(result.paymentState, null);
      assert.ok(!result.setup?.clientMessage);
      assert.ok(result.stages.every(s => s.label !== "Awaiting payment"));
    });
  }
}
test("accepted offers without an invoice have no payment state", async () => {
  assert.equal((await status("client", "offer_accepted", true, null)).paymentState, null);
});
test("accepted offer with pending deposit retains the Client payment/setup notice", async () => {
  const result = await status("client", "offer_accepted", true, { id: "deposit", status: "pending" });
  assert.equal(result.paymentState, "Awaiting payment");
  assert.match(result.setup.clientMessage, /finalising payment details/);
});
test("a stray pending deposit does not expose pre-offer payment copy", async () => {
  const result = await status("client", "shortlisted", false, { id: "deposit", status: "pending" });
  assert.equal(result.paymentState, null);
  assert.equal(result.setup.clientMessage, null);
});
test("paid, waived and verification-pending deposits retain their existing labels", async () => {
  for (const [deposit, label] of [
    [{ status: "held" }, "Paid"], [{ status: "waived" }, "Waived"],
    [{ status: "pending", proof_status: "verification_pending" }, "Verifying"],
  ] as const) {
    assert.equal((await status("admin", "offer_accepted", true, deposit)).paymentState, label);
  }
});
