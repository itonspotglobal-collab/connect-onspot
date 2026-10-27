import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIVE_STATUSES, APPLICATION_STATUS_META, STATUS_PIPELINE, getStatusMeta } from "../client/src/lib/applicationStatus";

test("contract_signed remains visible and active until verified deposit completes the hiring stage", () => {
  assert.equal(getStatusMeta("contract_signed").label, "Contract signed · deposit due");
  assert.equal(APPLICATION_STATUS_META.contract_signed.talentLabel, "Contract signed · deposit due");
  assert.equal(ACTIVE_STATUSES.has("contract_signed"), true);
  assert.equal(STATUS_PIPELINE.includes("contract_signed"), true);
  assert.equal(getStatusMeta("contract_signed").isTerminal, false);
});
