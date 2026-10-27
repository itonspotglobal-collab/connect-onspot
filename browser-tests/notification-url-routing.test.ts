import assert from "node:assert/strict";
import { test } from "node:test";
import { safeInternalNotificationRoute } from "../client/src/lib/notificationRouting";

test("notification internal routes are constrained to the current user's approved surfaces", () => {
  assert.equal(safeInternalNotificationRoute("/client/payments/deposit/dep_123", "client"), "/client/payments/deposit/dep_123");
  assert.equal(safeInternalNotificationRoute("/client/payments/monthly_invoice/INV-123", "client"), "/client/payments/monthly_invoice/INV-123");
  assert.equal(safeInternalNotificationRoute("/dashboard", "client"), "/dashboard");
  assert.equal(safeInternalNotificationRoute("/admin/ledger", "admin"), "/admin/ledger");
  assert.equal(safeInternalNotificationRoute("/my-applications", "talent"), "/my-applications");
  assert.equal(
    safeInternalNotificationRoute("/client-profile?jobId=job-1&applicationId=app_2", "client"),
    "/client-profile?jobId=job-1&applicationId=app_2",
  );
});

test("notification related URLs reject external, malformed, unknown, and role-forbidden destinations", () => {
  for (const value of [
    "https://malicious.invalid/",
    "//malicious.invalid/",
    "/client/payments/payout/private-id",
    "/client/payments/invoice/%2f%2fevil",
    "/client/payments/invoice/id?next=https://malicious.invalid",
    "/client-profile?next=https://malicious.invalid",
    "/admin/ledger",
    "/dashboard#external",
    "/unknown",
  ]) {
    assert.equal(safeInternalNotificationRoute(value, "client"), null, value);
  }
  assert.equal(safeInternalNotificationRoute("/client/payments/invoice/id", "talent"), null);
  assert.equal(safeInternalNotificationRoute("/admin/ledger", "client"), null);
  assert.equal(safeInternalNotificationRoute("/my-applications", "admin"), null);
  assert.equal(safeInternalNotificationRoute("/client-profile?applicationId=bad%2fpath", "client"), null);
});
