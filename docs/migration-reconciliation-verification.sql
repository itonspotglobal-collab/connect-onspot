-- Read-only expected-definition gate for migrations 0018-0031.
-- Authorized inspection only. This file contains SELECT statements only:
-- no DDL, DML, SET, migration invocation, repair, or ledger writes.
-- The static reference catalog was collected from original git HEAD sources
-- applied to the scoped 0017 fixture in a private disposable PostgreSQL 16 cluster.
-- The private reference replay normalizes only 0026's reviewed unique-pair removal
-- by semantic source-column identity; the read-only gate itself never normalizes.

-- Compare full migration filename IDs, not a numeric prefix range.
WITH expected_ledger(id) AS (
  VALUES
    ('0018_payment_provider_framework'),
    ('0019_clock_sessions'),
    ('0020_clock_exception_reviews'),
    ('0021_timesheets'),
    ('0022_timesheet_revision_timezone'),
    ('0023_billing_mode'),
    ('0024_talent_invoicing'),
    ('0025_phase3b_review_fixes'),
    ('0026_phase3b_acceptance_fixes'),
    ('0027_client_late_guaranteed_credits'),
    ('0028_client_credit_application_capacity_and_dates'),
    ('0029_contract_termination'),
    ('0030_terminated_contract_snapshot_guards'),
    ('0031_reconcile_contract_termination')
)
SELECT e.id AS expected_full_migration_id,
       CASE WHEN m.id IS NULL THEN 'MISSING' ELSE 'MATCHING' END AS status,
       m.applied_at
FROM expected_ledger e
LEFT JOIN public.app_schema_migrations m ON m.id = e.id
ORDER BY e.id;

-- Manifest rows are [object_type, object_key, expected_definition].
-- Existing 0017 parent columns are excluded except explicitly migration-owned
-- definitions such as jobs.time_zone; unrelated parent constraints/indexes are
-- excluded. Rows cover definitions introduced, altered, or explicitly
-- verified by migrations 0018-0031.
WITH expected AS (
  SELECT item->>0 AS object_type,
         item->>1 AS object_key,
         item->2 AS definition
  FROM jsonb_array_elements(
$expected_manifest$
[
  ["column","client_credit_applications.amount",{"table":"client_credit_applications","type":"numeric(12,2)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_credit_applications.client_credit_memo_id",{"table":"client_credit_applications","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_credit_applications.client_monthly_invoice_id",{"table":"client_credit_applications","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_credit_applications.created_at",{"table":"client_credit_applications","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","client_credit_applications.id",{"table":"client_credit_applications","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","client_credit_memos.all_in_amount",{"table":"client_credit_memos","type":"numeric(12,2)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_credit_memos.client_id",{"table":"client_credit_memos","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_credit_memos.created_at",{"table":"client_credit_memos","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","client_credit_memos.currency",{"table":"client_credit_memos","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_credit_memos.hiring_contract_id",{"table":"client_credit_memos","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_credit_memos.id",{"table":"client_credit_memos","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","client_credit_memos.late_claim_id",{"table":"client_credit_memos","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_credit_memos.original_talent_invoice_id",{"table":"client_credit_memos","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_credit_memos.period_end",{"table":"client_credit_memos","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_credit_memos.period_start",{"table":"client_credit_memos","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_late_guaranteed_claims.client_id",{"table":"client_late_guaranteed_claims","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_late_guaranteed_claims.created_at",{"table":"client_late_guaranteed_claims","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","client_late_guaranteed_claims.decided_at",{"table":"client_late_guaranteed_claims","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","client_late_guaranteed_claims.decided_by",{"table":"client_late_guaranteed_claims","type":"character varying","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","client_late_guaranteed_claims.decision_reason",{"table":"client_late_guaranteed_claims","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","client_late_guaranteed_claims.hiring_contract_id",{"table":"client_late_guaranteed_claims","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_late_guaranteed_claims.id",{"table":"client_late_guaranteed_claims","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","client_late_guaranteed_claims.original_talent_invoice_id",{"table":"client_late_guaranteed_claims","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_late_guaranteed_claims.period_end",{"table":"client_late_guaranteed_claims","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_late_guaranteed_claims.period_start",{"table":"client_late_guaranteed_claims","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_late_guaranteed_claims.reason",{"table":"client_late_guaranteed_claims","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_late_guaranteed_claims.status",{"table":"client_late_guaranteed_claims","type":"text","nullable":false,"default":"'open'::text","identity":"","generated":""}],
  ["column","client_monthly_invoice_lines.client_amount",{"table":"client_monthly_invoice_lines","type":"numeric(12,2)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_monthly_invoice_lines.client_monthly_invoice_id",{"table":"client_monthly_invoice_lines","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_monthly_invoice_lines.commission_rate",{"table":"client_monthly_invoice_lines","type":"numeric(5,4)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_monthly_invoice_lines.talent_amount",{"table":"client_monthly_invoice_lines","type":"numeric(12,2)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_monthly_invoice_lines.talent_invoice_id",{"table":"client_monthly_invoice_lines","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_monthly_invoices.client_id",{"table":"client_monthly_invoices","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_monthly_invoices.created_at",{"table":"client_monthly_invoices","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","client_monthly_invoices.currency",{"table":"client_monthly_invoices","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_monthly_invoices.id",{"table":"client_monthly_invoices","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","client_monthly_invoices.invoice_month",{"table":"client_monthly_invoices","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","client_monthly_invoices.status",{"table":"client_monthly_invoices","type":"text","nullable":false,"default":"'sent'::text","identity":"","generated":""}],
  ["column","client_monthly_invoices.subtotal",{"table":"client_monthly_invoices","type":"numeric(12,2)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","clock_exception_reviews.action",{"table":"clock_exception_reviews","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","clock_exception_reviews.actor_id",{"table":"clock_exception_reviews","type":"character varying","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_exception_reviews.clock_session_id",{"table":"clock_exception_reviews","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","clock_exception_reviews.created_at",{"table":"clock_exception_reviews","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","clock_exception_reviews.decision_reason",{"table":"clock_exception_reviews","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_exception_reviews.id",{"table":"clock_exception_reviews","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","clock_exception_reviews.proposal_reason",{"table":"clock_exception_reviews","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_exception_reviews.proposed_end_at",{"table":"clock_exception_reviews","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_exception_reviews.reviewer_id",{"table":"clock_exception_reviews","type":"character varying","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_sessions.approved_end_at",{"table":"clock_sessions","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_sessions.created_at",{"table":"clock_sessions","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","clock_sessions.ended_at",{"table":"clock_sessions","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_sessions.exception_detected_at",{"table":"clock_sessions","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_sessions.exception_status",{"table":"clock_sessions","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_sessions.exception_type",{"table":"clock_sessions","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_sessions.hiring_contract_id",{"table":"clock_sessions","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","clock_sessions.id",{"table":"clock_sessions","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","clock_sessions.proposal_reason",{"table":"clock_sessions","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_sessions.proposed_end_at",{"table":"clock_sessions","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_sessions.resolution_reason",{"table":"clock_sessions","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_sessions.resolved_at",{"table":"clock_sessions","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_sessions.resolved_by",{"table":"clock_sessions","type":"character varying","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","clock_sessions.started_at",{"table":"clock_sessions","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","clock_sessions.talent_id",{"table":"clock_sessions","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","guaranteed_nonperformance_claims.client_id",{"table":"guaranteed_nonperformance_claims","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","guaranteed_nonperformance_claims.created_at",{"table":"guaranteed_nonperformance_claims","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","guaranteed_nonperformance_claims.decided_at",{"table":"guaranteed_nonperformance_claims","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","guaranteed_nonperformance_claims.decided_by",{"table":"guaranteed_nonperformance_claims","type":"character varying","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","guaranteed_nonperformance_claims.decision_reason",{"table":"guaranteed_nonperformance_claims","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","guaranteed_nonperformance_claims.hiring_contract_id",{"table":"guaranteed_nonperformance_claims","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","guaranteed_nonperformance_claims.id",{"table":"guaranteed_nonperformance_claims","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","guaranteed_nonperformance_claims.period_end",{"table":"guaranteed_nonperformance_claims","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","guaranteed_nonperformance_claims.period_start",{"table":"guaranteed_nonperformance_claims","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","guaranteed_nonperformance_claims.reason",{"table":"guaranteed_nonperformance_claims","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","guaranteed_nonperformance_claims.status",{"table":"guaranteed_nonperformance_claims","type":"text","nullable":false,"default":"'open'::text","identity":"","generated":""}],
  ["column","guaranteed_nonperformance_claims.talent_invoice_id",{"table":"guaranteed_nonperformance_claims","type":"uuid","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","hiring_contract_termination_requests.approved_effective_end_date",{"table":"hiring_contract_termination_requests","type":"date","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","hiring_contract_termination_requests.created_at",{"table":"hiring_contract_termination_requests","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","hiring_contract_termination_requests.decided_at",{"table":"hiring_contract_termination_requests","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","hiring_contract_termination_requests.decided_by",{"table":"hiring_contract_termination_requests","type":"character varying","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","hiring_contract_termination_requests.decision_reason",{"table":"hiring_contract_termination_requests","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","hiring_contract_termination_requests.hiring_contract_id",{"table":"hiring_contract_termination_requests","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","hiring_contract_termination_requests.id",{"table":"hiring_contract_termination_requests","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","hiring_contract_termination_requests.reason",{"table":"hiring_contract_termination_requests","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","hiring_contract_termination_requests.requested_effective_end_date",{"table":"hiring_contract_termination_requests","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","hiring_contract_termination_requests.requester_id",{"table":"hiring_contract_termination_requests","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","hiring_contract_termination_requests.requester_role",{"table":"hiring_contract_termination_requests","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","hiring_contract_termination_requests.status",{"table":"hiring_contract_termination_requests","type":"text","nullable":false,"default":"'open'::text","identity":"","generated":""}],
  ["column","hiring_contracts.billing_activated_at",{"table":"hiring_contracts","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","hiring_contracts.billing_mode",{"table":"hiring_contracts","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","hiring_contracts.effective_end_date",{"table":"hiring_contracts","type":"date","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","hiring_contracts.effective_start_date",{"table":"hiring_contracts","type":"date","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","hiring_contracts.terminated_at",{"table":"hiring_contracts","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","hiring_contracts.terminated_by",{"table":"hiring_contracts","type":"character varying","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","hiring_contracts.termination_reason",{"table":"hiring_contracts","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","invoices.external_charge_id",{"table":"invoices","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","invoices.payment_provider",{"table":"invoices","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","jobs.billing_mode",{"table":"jobs","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","jobs.time_zone",{"table":"jobs","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","offers.billing_mode",{"table":"offers","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","payment_provider_accounts.connected_at",{"table":"payment_provider_accounts","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","payment_provider_accounts.external_account_id",{"table":"payment_provider_accounts","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","payment_provider_accounts.id",{"table":"payment_provider_accounts","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","payment_provider_accounts.owner_id",{"table":"payment_provider_accounts","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","payment_provider_accounts.owner_type",{"table":"payment_provider_accounts","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","payment_provider_accounts.provider_name",{"table":"payment_provider_accounts","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","payment_provider_accounts.status",{"table":"payment_provider_accounts","type":"text","nullable":false,"default":"'not_connected'::text","identity":"","generated":""}],
  ["column","payment_provider_accounts.updated_at",{"table":"payment_provider_accounts","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","payouts.external_transfer_id",{"table":"payouts","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","payouts.payment_provider",{"table":"payouts","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","payouts.payout_due_on",{"table":"payouts","type":"date","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","payouts.talent_invoice_id",{"table":"payouts","type":"uuid","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","security_deposit_replenishments.amount",{"table":"security_deposit_replenishments","type":"numeric(12,2)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","security_deposit_replenishments.created_at",{"table":"security_deposit_replenishments","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","security_deposit_replenishments.currency",{"table":"security_deposit_replenishments","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","security_deposit_replenishments.hiring_contract_id",{"table":"security_deposit_replenishments","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","security_deposit_replenishments.id",{"table":"security_deposit_replenishments","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","security_deposit_replenishments.recorded_by",{"table":"security_deposit_replenishments","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","security_deposit_replenishments.reference",{"table":"security_deposit_replenishments","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","talent_credit_memo_applications.amount",{"table":"talent_credit_memo_applications","type":"numeric(12,2)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_credit_memo_applications.created_at",{"table":"talent_credit_memo_applications","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","talent_credit_memo_applications.credit_memo_id",{"table":"talent_credit_memo_applications","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_credit_memo_applications.talent_invoice_id",{"table":"talent_credit_memo_applications","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_credit_memo_applications_v2.amount",{"table":"talent_credit_memo_applications_v2","type":"numeric(12,2)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_credit_memo_applications_v2.created_at",{"table":"talent_credit_memo_applications_v2","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","talent_credit_memo_applications_v2.credit_memo_id",{"table":"talent_credit_memo_applications_v2","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_credit_memo_applications_v2.id",{"table":"talent_credit_memo_applications_v2","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","talent_credit_memo_applications_v2.talent_invoice_id",{"table":"talent_credit_memo_applications_v2","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_credit_memos.amount",{"table":"talent_credit_memos","type":"numeric(12,2)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_credit_memos.corrected_revision_id",{"table":"talent_credit_memos","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_credit_memos.created_at",{"table":"talent_credit_memos","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","talent_credit_memos.currency",{"table":"talent_credit_memos","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_credit_memos.hiring_contract_id",{"table":"talent_credit_memos","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_credit_memos.id",{"table":"talent_credit_memos","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","talent_credit_memos.original_invoice_id",{"table":"talent_credit_memos","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_credit_memos.talent_id",{"table":"talent_credit_memos","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.amount",{"table":"talent_invoices","type":"numeric(12,2)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.auto_send_at",{"table":"talent_invoices","type":"timestamp with time zone","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.base_amount",{"table":"talent_invoices","type":"numeric(12,2)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.billing_mode",{"table":"talent_invoices","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.client_id",{"table":"talent_invoices","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.commission_rate",{"table":"talent_invoices","type":"numeric(5,4)","nullable":false,"default":"0.2000","identity":"","generated":""}],
  ["column","talent_invoices.created_at",{"table":"talent_invoices","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","talent_invoices.credit_amount",{"table":"talent_invoices","type":"numeric(12,2)","nullable":false,"default":"0","identity":"","generated":""}],
  ["column","talent_invoices.currency",{"table":"talent_invoices","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.drafted_at",{"table":"talent_invoices","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","talent_invoices.hiring_contract_id",{"table":"talent_invoices","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.hourly_equivalent",{"table":"talent_invoices","type":"numeric(12,4)","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.hours",{"table":"talent_invoices","type":"numeric(10,4)","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.id",{"table":"talent_invoices","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","talent_invoices.monthly_rate",{"table":"talent_invoices","type":"numeric(12,2)","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.offer_id",{"table":"talent_invoices","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.payout_due_on",{"table":"talent_invoices","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.period_end",{"table":"talent_invoices","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.period_start",{"table":"talent_invoices","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.sent_at",{"table":"talent_invoices","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.standard_hours",{"table":"talent_invoices","type":"numeric(10,4)","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.status",{"table":"talent_invoices","type":"text","nullable":false,"default":"'draft'::text","identity":"","generated":""}],
  ["column","talent_invoices.talent_id",{"table":"talent_invoices","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.timesheet_revision_id",{"table":"talent_invoices","type":"uuid","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","talent_invoices.updated_at",{"table":"talent_invoices","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","timesheet_audit.action",{"table":"timesheet_audit","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_audit.actor_id",{"table":"timesheet_audit","type":"character varying","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_audit.created_at",{"table":"timesheet_audit","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","timesheet_audit.details",{"table":"timesheet_audit","type":"jsonb","nullable":false,"default":"'{}'::jsonb","identity":"","generated":""}],
  ["column","timesheet_audit.id",{"table":"timesheet_audit","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","timesheet_audit.reason",{"table":"timesheet_audit","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_audit.timesheet_period_id",{"table":"timesheet_audit","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_correction_proposals.clock_session_id",{"table":"timesheet_correction_proposals","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_correction_proposals.created_at",{"table":"timesheet_correction_proposals","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","timesheet_correction_proposals.decided_at",{"table":"timesheet_correction_proposals","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_correction_proposals.decided_by",{"table":"timesheet_correction_proposals","type":"character varying","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_correction_proposals.decision_reason",{"table":"timesheet_correction_proposals","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_correction_proposals.id",{"table":"timesheet_correction_proposals","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","timesheet_correction_proposals.reason",{"table":"timesheet_correction_proposals","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_correction_proposals.requested_by",{"table":"timesheet_correction_proposals","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_correction_proposals.requested_end_at",{"table":"timesheet_correction_proposals","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_correction_proposals.requested_started_at",{"table":"timesheet_correction_proposals","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_correction_proposals.status",{"table":"timesheet_correction_proposals","type":"text","nullable":false,"default":"'pending'::text","identity":"","generated":""}],
  ["column","timesheet_correction_proposals.timesheet_period_id",{"table":"timesheet_correction_proposals","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_disputes.client_id",{"table":"timesheet_disputes","type":"character varying","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_disputes.created_at",{"table":"timesheet_disputes","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","timesheet_disputes.id",{"table":"timesheet_disputes","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","timesheet_disputes.reason",{"table":"timesheet_disputes","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_disputes.resolution_reason",{"table":"timesheet_disputes","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_disputes.resolved_at",{"table":"timesheet_disputes","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_disputes.resolved_by",{"table":"timesheet_disputes","type":"character varying","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_disputes.status",{"table":"timesheet_disputes","type":"text","nullable":false,"default":"'open'::text","identity":"","generated":""}],
  ["column","timesheet_disputes.timesheet_period_id",{"table":"timesheet_disputes","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_periods.approved_revision_id",{"table":"timesheet_periods","type":"uuid","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_periods.created_at",{"table":"timesheet_periods","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","timesheet_periods.hiring_contract_id",{"table":"timesheet_periods","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_periods.id",{"table":"timesheet_periods","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","timesheet_periods.period_end",{"table":"timesheet_periods","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_periods.period_start",{"table":"timesheet_periods","type":"date","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_periods.status",{"table":"timesheet_periods","type":"text","nullable":false,"default":"'open'::text","identity":"","generated":""}],
  ["column","timesheet_periods.submitted_at",{"table":"timesheet_periods","type":"timestamp with time zone","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_periods.updated_at",{"table":"timesheet_periods","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","timesheet_periods.work_timezone",{"table":"timesheet_periods","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_revision_sessions.clock_session_id",{"table":"timesheet_revision_sessions","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_revision_sessions.effective_end_at",{"table":"timesheet_revision_sessions","type":"timestamp with time zone","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_revision_sessions.revision_id",{"table":"timesheet_revision_sessions","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_revision_sessions.source",{"table":"timesheet_revision_sessions","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_revision_sessions.started_at",{"table":"timesheet_revision_sessions","type":"timestamp with time zone","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_revisions.created_at",{"table":"timesheet_revisions","type":"timestamp with time zone","nullable":false,"default":"now()","identity":"","generated":""}],
  ["column","timesheet_revisions.created_by",{"table":"timesheet_revisions","type":"character varying","nullable":true,"default":null,"identity":"","generated":""}],
  ["column","timesheet_revisions.decision_reason",{"table":"timesheet_revisions","type":"text","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_revisions.exception_approved",{"table":"timesheet_revisions","type":"boolean","nullable":false,"default":"false","identity":"","generated":""}],
  ["column","timesheet_revisions.id",{"table":"timesheet_revisions","type":"uuid","nullable":false,"default":"gen_random_uuid()","identity":"","generated":""}],
  ["column","timesheet_revisions.timesheet_period_id",{"table":"timesheet_revisions","type":"uuid","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_revisions.version",{"table":"timesheet_revisions","type":"integer","nullable":false,"default":null,"identity":"","generated":""}],
  ["column","timesheet_revisions.work_timezone",{"table":"timesheet_revisions","type":"text","nullable":true,"default":null,"identity":"","generated":""}],
  ["constraint","client_credit_applications.client_credit_applications_amount_check",{"table":"client_credit_applications","type":"CHECK","definition":"CHECK ((amount > (0)::numeric))","validated":true}],
  ["constraint","client_credit_applications.client_credit_applications_client_credit_memo_id_client_mon_key",{"table":"client_credit_applications","type":"UNIQUE","definition":"UNIQUE (client_credit_memo_id, client_monthly_invoice_id)","validated":true}],
  ["constraint","client_credit_applications.client_credit_applications_client_credit_memo_id_fkey",{"table":"client_credit_applications","type":"FOREIGN KEY","definition":"FOREIGN KEY (client_credit_memo_id) REFERENCES client_credit_memos(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_credit_applications.client_credit_applications_client_monthly_invoice_id_fkey",{"table":"client_credit_applications","type":"FOREIGN KEY","definition":"FOREIGN KEY (client_monthly_invoice_id) REFERENCES client_monthly_invoices(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_credit_applications.client_credit_applications_pkey",{"table":"client_credit_applications","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","client_credit_memos.client_credit_memos_all_in_amount_check",{"table":"client_credit_memos","type":"CHECK","definition":"CHECK ((all_in_amount > (0)::numeric))","validated":true}],
  ["constraint","client_credit_memos.client_credit_memos_client_id_fkey",{"table":"client_credit_memos","type":"FOREIGN KEY","definition":"FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_credit_memos.client_credit_memos_hiring_contract_id_fkey",{"table":"client_credit_memos","type":"FOREIGN KEY","definition":"FOREIGN KEY (hiring_contract_id) REFERENCES hiring_contracts(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_credit_memos.client_credit_memos_late_claim_id_fkey",{"table":"client_credit_memos","type":"FOREIGN KEY","definition":"FOREIGN KEY (late_claim_id) REFERENCES client_late_guaranteed_claims(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_credit_memos.client_credit_memos_late_claim_id_key",{"table":"client_credit_memos","type":"UNIQUE","definition":"UNIQUE (late_claim_id)","validated":true}],
  ["constraint","client_credit_memos.client_credit_memos_original_talent_invoice_id_fkey",{"table":"client_credit_memos","type":"FOREIGN KEY","definition":"FOREIGN KEY (original_talent_invoice_id) REFERENCES talent_invoices(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_credit_memos.client_credit_memos_original_talent_invoice_id_key",{"table":"client_credit_memos","type":"UNIQUE","definition":"UNIQUE (original_talent_invoice_id)","validated":true}],
  ["constraint","client_credit_memos.client_credit_memos_pkey",{"table":"client_credit_memos","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","client_late_guaranteed_claims.client_late_guaranteed_claims_client_id_fkey",{"table":"client_late_guaranteed_claims","type":"FOREIGN KEY","definition":"FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_late_guaranteed_claims.client_late_guaranteed_claims_decided_by_fkey",{"table":"client_late_guaranteed_claims","type":"FOREIGN KEY","definition":"FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_late_guaranteed_claims.client_late_guaranteed_claims_hiring_contract_id_fkey",{"table":"client_late_guaranteed_claims","type":"FOREIGN KEY","definition":"FOREIGN KEY (hiring_contract_id) REFERENCES hiring_contracts(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_late_guaranteed_claims.client_late_guaranteed_claims_hiring_contract_id_period_sta_key",{"table":"client_late_guaranteed_claims","type":"UNIQUE","definition":"UNIQUE (hiring_contract_id, period_start, period_end)","validated":true}],
  ["constraint","client_late_guaranteed_claims.client_late_guaranteed_claims_original_talent_invoice_id_fkey",{"table":"client_late_guaranteed_claims","type":"FOREIGN KEY","definition":"FOREIGN KEY (original_talent_invoice_id) REFERENCES talent_invoices(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_late_guaranteed_claims.client_late_guaranteed_claims_original_talent_invoice_id_key",{"table":"client_late_guaranteed_claims","type":"UNIQUE","definition":"UNIQUE (original_talent_invoice_id)","validated":true}],
  ["constraint","client_late_guaranteed_claims.client_late_guaranteed_claims_pkey",{"table":"client_late_guaranteed_claims","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","client_late_guaranteed_claims.client_late_guaranteed_claims_status_check",{"table":"client_late_guaranteed_claims","type":"CHECK","definition":"CHECK ((status = ANY (ARRAY['open'::text, 'approved'::text, 'rejected'::text])))","validated":true}],
  ["constraint","client_monthly_invoice_lines.client_monthly_invoice_lines_client_monthly_invoice_id_fkey",{"table":"client_monthly_invoice_lines","type":"FOREIGN KEY","definition":"FOREIGN KEY (client_monthly_invoice_id) REFERENCES client_monthly_invoices(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_monthly_invoice_lines.client_monthly_invoice_lines_pkey",{"table":"client_monthly_invoice_lines","type":"PRIMARY KEY","definition":"PRIMARY KEY (client_monthly_invoice_id, talent_invoice_id)","validated":true}],
  ["constraint","client_monthly_invoice_lines.client_monthly_invoice_lines_talent_invoice_id_fkey",{"table":"client_monthly_invoice_lines","type":"FOREIGN KEY","definition":"FOREIGN KEY (talent_invoice_id) REFERENCES talent_invoices(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_monthly_invoice_lines.client_monthly_invoice_lines_talent_invoice_id_key",{"table":"client_monthly_invoice_lines","type":"UNIQUE","definition":"UNIQUE (talent_invoice_id)","validated":true}],
  ["constraint","client_monthly_invoices.client_monthly_invoices_client_id_fkey",{"table":"client_monthly_invoices","type":"FOREIGN KEY","definition":"FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","client_monthly_invoices.client_monthly_invoices_client_id_invoice_month_currency_key",{"table":"client_monthly_invoices","type":"UNIQUE","definition":"UNIQUE (client_id, invoice_month, currency)","validated":true}],
  ["constraint","client_monthly_invoices.client_monthly_invoices_pkey",{"table":"client_monthly_invoices","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","client_monthly_invoices.client_monthly_invoices_status_check",{"table":"client_monthly_invoices","type":"CHECK","definition":"CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text])))","validated":true}],
  ["constraint","clock_exception_reviews.clock_exception_reviews_action_check",{"table":"clock_exception_reviews","type":"CHECK","definition":"CHECK ((action = ANY (ARRAY['detected'::text, 'proposed'::text, 'approved'::text, 'rejected'::text])))","validated":true}],
  ["constraint","clock_exception_reviews.clock_exception_reviews_actor_id_fkey",{"table":"clock_exception_reviews","type":"FOREIGN KEY","definition":"FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","clock_exception_reviews.clock_exception_reviews_check",{"table":"clock_exception_reviews","type":"CHECK","definition":"CHECK ((((action = 'detected'::text) AND (actor_id IS NULL) AND (reviewer_id IS NULL) AND (proposed_end_at IS NULL) AND (proposal_reason IS NULL) AND (decision_reason IS NULL)) OR ((action = 'proposed'::text) AND (actor_id IS NOT NULL) AND (reviewer_id IS NULL) AND (proposed_end_at IS NOT NULL) AND (proposal_reason IS NOT NULL) AND (decision_reason IS NULL)) OR ((action = ANY (ARRAY['approved'::text, 'rejected'::text])) AND (actor_id IS NULL) AND (reviewer_id IS NOT NULL) AND (proposed_end_at IS NOT NULL) AND (proposal_reason IS NOT NULL) AND (decision_reason IS NOT NULL))))","validated":true}],
  ["constraint","clock_exception_reviews.clock_exception_reviews_clock_session_id_fkey",{"table":"clock_exception_reviews","type":"FOREIGN KEY","definition":"FOREIGN KEY (clock_session_id) REFERENCES clock_sessions(id) ON DELETE CASCADE","validated":true}],
  ["constraint","clock_exception_reviews.clock_exception_reviews_pkey",{"table":"clock_exception_reviews","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","clock_exception_reviews.clock_exception_reviews_reviewer_id_fkey",{"table":"clock_exception_reviews","type":"FOREIGN KEY","definition":"FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","clock_sessions.clock_sessions_check",{"table":"clock_sessions","type":"CHECK","definition":"CHECK (((exception_status IS NULL) = (exception_type IS NULL)))","validated":true}],
  ["constraint","clock_sessions.clock_sessions_check1",{"table":"clock_sessions","type":"CHECK","definition":"CHECK ((((exception_status IS NULL) AND (proposed_end_at IS NULL) AND (proposal_reason IS NULL) AND (approved_end_at IS NULL) AND (resolved_by IS NULL) AND (resolved_at IS NULL) AND (resolution_reason IS NULL)) OR ((exception_status = 'detected'::text) AND (exception_type IS NOT NULL) AND (proposed_end_at IS NULL) AND (proposal_reason IS NULL) AND (approved_end_at IS NULL) AND (resolved_by IS NULL) AND (resolved_at IS NULL) AND (resolution_reason IS NULL)) OR ((exception_status = 'pending'::text) AND (exception_type IS NOT NULL) AND (proposed_end_at IS NOT NULL) AND (proposal_reason IS NOT NULL) AND (approved_end_at IS NULL) AND (resolved_by IS NULL) AND (resolved_at IS NULL) AND (resolution_reason IS NULL)) OR ((exception_status = 'approved'::text) AND (exception_type IS NOT NULL) AND (proposed_end_at IS NOT NULL) AND (proposal_reason IS NOT NULL) AND (approved_end_at IS NOT NULL) AND (resolved_by IS NOT NULL) AND (resolved_at IS NOT NULL) AND (resolution_reason IS NOT NULL)) OR ((exception_status = 'rejected'::text) AND (exception_type IS NOT NULL) AND (proposed_end_at IS NOT NULL) AND (proposal_reason IS NOT NULL) AND (approved_end_at IS NULL) AND (resolved_by IS NOT NULL) AND (resolved_at IS NOT NULL) AND (resolution_reason IS NOT NULL))))","validated":true}],
  ["constraint","clock_sessions.clock_sessions_exception_status_check",{"table":"clock_sessions","type":"CHECK","definition":"CHECK (((exception_status IS NULL) OR (exception_status = ANY (ARRAY['detected'::text, 'pending'::text, 'approved'::text, 'rejected'::text]))))","validated":true}],
  ["constraint","clock_sessions.clock_sessions_exception_type_check",{"table":"clock_sessions","type":"CHECK","definition":"CHECK (((exception_type IS NULL) OR (exception_type = 'missed_out'::text)))","validated":true}],
  ["constraint","clock_sessions.clock_sessions_hiring_contract_id_fkey",{"table":"clock_sessions","type":"FOREIGN KEY","definition":"FOREIGN KEY (hiring_contract_id) REFERENCES hiring_contracts(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","clock_sessions.clock_sessions_pkey",{"table":"clock_sessions","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","clock_sessions.clock_sessions_resolved_by_fkey",{"table":"clock_sessions","type":"FOREIGN KEY","definition":"FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","clock_sessions.clock_sessions_talent_id_fkey",{"table":"clock_sessions","type":"FOREIGN KEY","definition":"FOREIGN KEY (talent_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","guaranteed_nonperformance_claims.guaranteed_nonperformance_cla_hiring_contract_id_period_sta_key",{"table":"guaranteed_nonperformance_claims","type":"UNIQUE","definition":"UNIQUE (hiring_contract_id, period_start, period_end)","validated":true}],
  ["constraint","guaranteed_nonperformance_claims.guaranteed_nonperformance_claims_client_id_fkey",{"table":"guaranteed_nonperformance_claims","type":"FOREIGN KEY","definition":"FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","guaranteed_nonperformance_claims.guaranteed_nonperformance_claims_decided_by_fkey",{"table":"guaranteed_nonperformance_claims","type":"FOREIGN KEY","definition":"FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","guaranteed_nonperformance_claims.guaranteed_nonperformance_claims_hiring_contract_id_fkey",{"table":"guaranteed_nonperformance_claims","type":"FOREIGN KEY","definition":"FOREIGN KEY (hiring_contract_id) REFERENCES hiring_contracts(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","guaranteed_nonperformance_claims.guaranteed_nonperformance_claims_pkey",{"table":"guaranteed_nonperformance_claims","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","guaranteed_nonperformance_claims.guaranteed_nonperformance_claims_status_check",{"table":"guaranteed_nonperformance_claims","type":"CHECK","definition":"CHECK ((status = ANY (ARRAY['open'::text, 'approved'::text, 'rejected'::text])))","validated":true}],
  ["constraint","guaranteed_nonperformance_claims.guaranteed_nonperformance_claims_talent_invoice_id_fkey",{"table":"guaranteed_nonperformance_claims","type":"FOREIGN KEY","definition":"FOREIGN KEY (talent_invoice_id) REFERENCES talent_invoices(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","guaranteed_nonperformance_claims.guaranteed_nonperformance_claims_talent_invoice_id_key",{"table":"guaranteed_nonperformance_claims","type":"UNIQUE","definition":"UNIQUE (talent_invoice_id)","validated":true}],
  ["constraint","hiring_contract_termination_requests.hiring_contract_termination_requests_check",{"table":"hiring_contract_termination_requests","type":"CHECK","definition":"CHECK ((((status = 'open'::text) AND (decision_reason IS NULL) AND (decided_by IS NULL) AND (decided_at IS NULL) AND (approved_effective_end_date IS NULL)) OR ((status = 'approved'::text) AND (decision_reason IS NOT NULL) AND (btrim(decision_reason) <> ''::text) AND (decided_by IS NOT NULL) AND (decided_at IS NOT NULL) AND (approved_effective_end_date IS NOT NULL)) OR ((status = 'rejected'::text) AND (decision_reason IS NOT NULL) AND (btrim(decision_reason) <> ''::text) AND (decided_by IS NOT NULL) AND (decided_at IS NOT NULL) AND (approved_effective_end_date IS NULL))))","validated":true}],
  ["constraint","hiring_contract_termination_requests.hiring_contract_termination_requests_check1",{"table":"hiring_contract_termination_requests","type":"CHECK","definition":"CHECK (((approved_effective_end_date IS NULL) OR (approved_effective_end_date >= requested_effective_end_date)))","validated":true}],
  ["constraint","hiring_contract_termination_requests.hiring_contract_termination_requests_decided_by_fkey",{"table":"hiring_contract_termination_requests","type":"FOREIGN KEY","definition":"FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","hiring_contract_termination_requests.hiring_contract_termination_requests_hiring_contract_id_fkey",{"table":"hiring_contract_termination_requests","type":"FOREIGN KEY","definition":"FOREIGN KEY (hiring_contract_id) REFERENCES hiring_contracts(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","hiring_contract_termination_requests.hiring_contract_termination_requests_pkey",{"table":"hiring_contract_termination_requests","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","hiring_contract_termination_requests.hiring_contract_termination_requests_reason_check",{"table":"hiring_contract_termination_requests","type":"CHECK","definition":"CHECK ((btrim(reason) <> ''::text))","validated":true}],
  ["constraint","hiring_contract_termination_requests.hiring_contract_termination_requests_requester_id_fkey",{"table":"hiring_contract_termination_requests","type":"FOREIGN KEY","definition":"FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","hiring_contract_termination_requests.hiring_contract_termination_requests_requester_role_check",{"table":"hiring_contract_termination_requests","type":"CHECK","definition":"CHECK ((requester_role = ANY (ARRAY['client'::text, 'talent'::text, 'admin'::text])))","validated":true}],
  ["constraint","hiring_contract_termination_requests.hiring_contract_termination_requests_status_check",{"table":"hiring_contract_termination_requests","type":"CHECK","definition":"CHECK ((status = ANY (ARRAY['open'::text, 'approved'::text, 'rejected'::text])))","validated":true}],
  ["constraint","hiring_contracts.hiring_contracts_billing_mode_check",{"table":"hiring_contracts","type":"CHECK","definition":"CHECK (((billing_mode IS NULL) OR (billing_mode = ANY (ARRAY['tracked'::text, 'guaranteed'::text]))))","validated":true}],
  ["constraint","hiring_contracts.hiring_contracts_terminated_by_fkey",{"table":"hiring_contracts","type":"FOREIGN KEY","definition":"FOREIGN KEY (terminated_by) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","hiring_contracts.hiring_contracts_termination_snapshot_check",{"table":"hiring_contracts","type":"CHECK","definition":"CHECK ((((effective_end_date IS NULL) AND (termination_reason IS NULL) AND (terminated_by IS NULL) AND (terminated_at IS NULL)) OR ((effective_end_date IS NOT NULL) AND (billing_mode = ANY (ARRAY['tracked'::text, 'guaranteed'::text])) AND (termination_reason IS NOT NULL) AND (btrim(termination_reason) <> ''::text) AND (terminated_by IS NOT NULL) AND (terminated_at IS NOT NULL) AND ((effective_start_date IS NULL) OR (effective_end_date >= effective_start_date)))))","validated":true}],
  ["constraint","jobs.jobs_billing_mode_check",{"table":"jobs","type":"CHECK","definition":"CHECK (((billing_mode IS NULL) OR (billing_mode = ANY (ARRAY['tracked'::text, 'guaranteed'::text]))))","validated":true}],
  ["constraint","offers.offers_billing_mode_check",{"table":"offers","type":"CHECK","definition":"CHECK (((billing_mode IS NULL) OR (billing_mode = ANY (ARRAY['tracked'::text, 'guaranteed'::text]))))","validated":true}],
  ["constraint","payment_provider_accounts.payment_provider_accounts_owner_id_fkey",{"table":"payment_provider_accounts","type":"FOREIGN KEY","definition":"FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE","validated":true}],
  ["constraint","payment_provider_accounts.payment_provider_accounts_owner_type_check",{"table":"payment_provider_accounts","type":"CHECK","definition":"CHECK ((owner_type = ANY (ARRAY['client'::text, 'talent'::text])))","validated":true}],
  ["constraint","payment_provider_accounts.payment_provider_accounts_pkey",{"table":"payment_provider_accounts","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","payment_provider_accounts.payment_provider_accounts_status_check",{"table":"payment_provider_accounts","type":"CHECK","definition":"CHECK ((status = ANY (ARRAY['not_connected'::text, 'pending'::text, 'active'::text, 'restricted'::text])))","validated":true}],
  ["constraint","payouts.payouts_talent_invoice_id_fkey",{"table":"payouts","type":"FOREIGN KEY","definition":"FOREIGN KEY (talent_invoice_id) REFERENCES talent_invoices(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","security_deposit_replenishments.security_deposit_replenishments_amount_check",{"table":"security_deposit_replenishments","type":"CHECK","definition":"CHECK ((amount > (0)::numeric))","validated":true}],
  ["constraint","security_deposit_replenishments.security_deposit_replenishments_hiring_contract_id_fkey",{"table":"security_deposit_replenishments","type":"FOREIGN KEY","definition":"FOREIGN KEY (hiring_contract_id) REFERENCES hiring_contracts(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","security_deposit_replenishments.security_deposit_replenishments_pkey",{"table":"security_deposit_replenishments","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","security_deposit_replenishments.security_deposit_replenishments_recorded_by_fkey",{"table":"security_deposit_replenishments","type":"FOREIGN KEY","definition":"FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_credit_memo_applications.talent_credit_memo_applications_credit_memo_id_fkey",{"table":"talent_credit_memo_applications","type":"FOREIGN KEY","definition":"FOREIGN KEY (credit_memo_id) REFERENCES talent_credit_memos(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_credit_memo_applications.talent_credit_memo_applications_pkey",{"table":"talent_credit_memo_applications","type":"PRIMARY KEY","definition":"PRIMARY KEY (credit_memo_id, talent_invoice_id)","validated":true}],
  ["constraint","talent_credit_memo_applications.talent_credit_memo_applications_talent_invoice_id_fkey",{"table":"talent_credit_memo_applications","type":"FOREIGN KEY","definition":"FOREIGN KEY (talent_invoice_id) REFERENCES talent_invoices(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_credit_memo_applications_v2.talent_credit_memo_applications_v2_amount_check",{"table":"talent_credit_memo_applications_v2","type":"CHECK","definition":"CHECK ((amount <> (0)::numeric))","validated":true}],
  ["constraint","talent_credit_memo_applications_v2.talent_credit_memo_applications_v2_credit_memo_id_fkey",{"table":"talent_credit_memo_applications_v2","type":"FOREIGN KEY","definition":"FOREIGN KEY (credit_memo_id) REFERENCES talent_credit_memos(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_credit_memo_applications_v2.talent_credit_memo_applications_v2_pkey",{"table":"talent_credit_memo_applications_v2","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","talent_credit_memo_applications_v2.talent_credit_memo_applications_v2_talent_invoice_id_fkey",{"table":"talent_credit_memo_applications_v2","type":"FOREIGN KEY","definition":"FOREIGN KEY (talent_invoice_id) REFERENCES talent_invoices(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_credit_memos.talent_credit_memos_corrected_revision_id_fkey",{"table":"talent_credit_memos","type":"FOREIGN KEY","definition":"FOREIGN KEY (corrected_revision_id) REFERENCES timesheet_revisions(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_credit_memos.talent_credit_memos_hiring_contract_id_fkey",{"table":"talent_credit_memos","type":"FOREIGN KEY","definition":"FOREIGN KEY (hiring_contract_id) REFERENCES hiring_contracts(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_credit_memos.talent_credit_memos_original_invoice_id_fkey",{"table":"talent_credit_memos","type":"FOREIGN KEY","definition":"FOREIGN KEY (original_invoice_id) REFERENCES talent_invoices(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_credit_memos.talent_credit_memos_pkey",{"table":"talent_credit_memos","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","talent_credit_memos.talent_credit_memos_talent_id_fkey",{"table":"talent_credit_memos","type":"FOREIGN KEY","definition":"FOREIGN KEY (talent_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_invoices.talent_invoices_billing_mode_check",{"table":"talent_invoices","type":"CHECK","definition":"CHECK ((billing_mode = ANY (ARRAY['tracked'::text, 'guaranteed'::text])))","validated":true}],
  ["constraint","talent_invoices.talent_invoices_client_id_fkey",{"table":"talent_invoices","type":"FOREIGN KEY","definition":"FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_invoices.talent_invoices_hiring_contract_id_fkey",{"table":"talent_invoices","type":"FOREIGN KEY","definition":"FOREIGN KEY (hiring_contract_id) REFERENCES hiring_contracts(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_invoices.talent_invoices_hiring_contract_id_period_start_period_end_key",{"table":"talent_invoices","type":"UNIQUE","definition":"UNIQUE (hiring_contract_id, period_start, period_end)","validated":true}],
  ["constraint","talent_invoices.talent_invoices_offer_id_fkey",{"table":"talent_invoices","type":"FOREIGN KEY","definition":"FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_invoices.talent_invoices_pkey",{"table":"talent_invoices","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","talent_invoices.talent_invoices_status_check",{"table":"talent_invoices","type":"CHECK","definition":"CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'void'::text])))","validated":true}],
  ["constraint","talent_invoices.talent_invoices_talent_id_fkey",{"table":"talent_invoices","type":"FOREIGN KEY","definition":"FOREIGN KEY (talent_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","talent_invoices.talent_invoices_timesheet_revision_id_fkey",{"table":"talent_invoices","type":"FOREIGN KEY","definition":"FOREIGN KEY (timesheet_revision_id) REFERENCES timesheet_revisions(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_audit.timesheet_audit_action_check",{"table":"timesheet_audit","type":"CHECK","definition":"CHECK ((action = ANY (ARRAY['submitted'::text, 'correction_requested'::text, 'disputed'::text, 'review_approved'::text, 'review_rejected'::text, 'review_exception'::text, 'correction_decided'::text])))","validated":true}],
  ["constraint","timesheet_audit.timesheet_audit_actor_id_fkey",{"table":"timesheet_audit","type":"FOREIGN KEY","definition":"FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_audit.timesheet_audit_pkey",{"table":"timesheet_audit","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","timesheet_audit.timesheet_audit_timesheet_period_id_fkey",{"table":"timesheet_audit","type":"FOREIGN KEY","definition":"FOREIGN KEY (timesheet_period_id) REFERENCES timesheet_periods(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_correction_proposals.timesheet_correction_proposals_check",{"table":"timesheet_correction_proposals","type":"CHECK","definition":"CHECK (((requested_started_at IS NOT NULL) OR (requested_end_at IS NOT NULL)))","validated":true}],
  ["constraint","timesheet_correction_proposals.timesheet_correction_proposals_clock_session_id_fkey",{"table":"timesheet_correction_proposals","type":"FOREIGN KEY","definition":"FOREIGN KEY (clock_session_id) REFERENCES clock_sessions(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_correction_proposals.timesheet_correction_proposals_decided_by_fkey",{"table":"timesheet_correction_proposals","type":"FOREIGN KEY","definition":"FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_correction_proposals.timesheet_correction_proposals_pkey",{"table":"timesheet_correction_proposals","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","timesheet_correction_proposals.timesheet_correction_proposals_requested_by_fkey",{"table":"timesheet_correction_proposals","type":"FOREIGN KEY","definition":"FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_correction_proposals.timesheet_correction_proposals_status_check",{"table":"timesheet_correction_proposals","type":"CHECK","definition":"CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))","validated":true}],
  ["constraint","timesheet_correction_proposals.timesheet_correction_proposals_timesheet_period_id_fkey",{"table":"timesheet_correction_proposals","type":"FOREIGN KEY","definition":"FOREIGN KEY (timesheet_period_id) REFERENCES timesheet_periods(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_disputes.timesheet_disputes_client_id_fkey",{"table":"timesheet_disputes","type":"FOREIGN KEY","definition":"FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_disputes.timesheet_disputes_pkey",{"table":"timesheet_disputes","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","timesheet_disputes.timesheet_disputes_resolved_by_fkey",{"table":"timesheet_disputes","type":"FOREIGN KEY","definition":"FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_disputes.timesheet_disputes_status_check",{"table":"timesheet_disputes","type":"CHECK","definition":"CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text])))","validated":true}],
  ["constraint","timesheet_disputes.timesheet_disputes_timesheet_period_id_fkey",{"table":"timesheet_disputes","type":"FOREIGN KEY","definition":"FOREIGN KEY (timesheet_period_id) REFERENCES timesheet_periods(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_periods.timesheet_period_approved_revision_fk",{"table":"timesheet_periods","type":"FOREIGN KEY","definition":"FOREIGN KEY (approved_revision_id) REFERENCES timesheet_revisions(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_periods.timesheet_periods_check",{"table":"timesheet_periods","type":"CHECK","definition":"CHECK ((period_start <= period_end))","validated":true}],
  ["constraint","timesheet_periods.timesheet_periods_hiring_contract_id_fkey",{"table":"timesheet_periods","type":"FOREIGN KEY","definition":"FOREIGN KEY (hiring_contract_id) REFERENCES hiring_contracts(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_periods.timesheet_periods_hiring_contract_id_period_start_period_en_key",{"table":"timesheet_periods","type":"UNIQUE","definition":"UNIQUE (hiring_contract_id, period_start, period_end)","validated":true}],
  ["constraint","timesheet_periods.timesheet_periods_pkey",{"table":"timesheet_periods","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","timesheet_periods.timesheet_periods_status_check",{"table":"timesheet_periods","type":"CHECK","definition":"CHECK ((status = ANY (ARRAY['open'::text, 'submitted'::text, 'approved'::text, 'disputed'::text, 'rejected'::text])))","validated":true}],
  ["constraint","timesheet_revision_sessions.timesheet_revision_sessions_check",{"table":"timesheet_revision_sessions","type":"CHECK","definition":"CHECK ((effective_end_at > started_at))","validated":true}],
  ["constraint","timesheet_revision_sessions.timesheet_revision_sessions_clock_session_id_fkey",{"table":"timesheet_revision_sessions","type":"FOREIGN KEY","definition":"FOREIGN KEY (clock_session_id) REFERENCES clock_sessions(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_revision_sessions.timesheet_revision_sessions_pkey",{"table":"timesheet_revision_sessions","type":"PRIMARY KEY","definition":"PRIMARY KEY (revision_id, clock_session_id)","validated":true}],
  ["constraint","timesheet_revision_sessions.timesheet_revision_sessions_revision_id_fkey",{"table":"timesheet_revision_sessions","type":"FOREIGN KEY","definition":"FOREIGN KEY (revision_id) REFERENCES timesheet_revisions(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_revision_sessions.timesheet_revision_sessions_source_check",{"table":"timesheet_revision_sessions","type":"CHECK","definition":"CHECK ((source = ANY (ARRAY['clock'::text, 'approved_exception'::text, 'admin_correction'::text])))","validated":true}],
  ["constraint","timesheet_revisions.timesheet_revisions_created_by_fkey",{"table":"timesheet_revisions","type":"FOREIGN KEY","definition":"FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_revisions.timesheet_revisions_pkey",{"table":"timesheet_revisions","type":"PRIMARY KEY","definition":"PRIMARY KEY (id)","validated":true}],
  ["constraint","timesheet_revisions.timesheet_revisions_timesheet_period_id_fkey",{"table":"timesheet_revisions","type":"FOREIGN KEY","definition":"FOREIGN KEY (timesheet_period_id) REFERENCES timesheet_periods(id) ON DELETE RESTRICT","validated":true}],
  ["constraint","timesheet_revisions.timesheet_revisions_timesheet_period_id_version_key",{"table":"timesheet_revisions","type":"UNIQUE","definition":"UNIQUE (timesheet_period_id, version)","validated":true}],
  ["function","prevent_offer_billing_mode_change()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"6eb2b474500a751a8dbf8bd8e8f44a44","body_source":"\nBEGIN\n  IF NEW.billing_mode IS DISTINCT FROM OLD.billing_mode THEN\n    RAISE EXCEPTION 'offer billing mode is immutable';\n  END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","prevent_signed_contract_billing_mode_change()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"99230f95517faa3f1c10cc3002c87c9b","body_source":"\nBEGIN\n  IF OLD.status IN ('signed', 'terminated') AND NEW.billing_mode IS DISTINCT FROM OLD.billing_mode THEN\n    RAISE EXCEPTION 'billing mode is immutable after contract signing';\n  END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","prevent_signed_contract_billing_start_change()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"9395f7efee65ee045440ea8c882d6b14","body_source":"\nBEGIN\n  IF OLD.status IN ('signed', 'terminated') AND (\n    NEW.effective_start_date IS DISTINCT FROM OLD.effective_start_date OR\n    NEW.billing_activated_at IS DISTINCT FROM OLD.billing_activated_at\n  ) THEN\n    RAISE EXCEPTION 'executed contract billing start is immutable';\n  END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","protect_client_credit_applications()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"6f50261e0d2cfb70a9fc184192c04f31","body_source":"\nDECLARE\n  statement_status text;\n  statement_client text;\n  statement_currency text;\n  statement_subtotal numeric(12,2);\n  gross_line_total numeric(12,2);\n  statement_applied numeric(12,2);\n  memo_client text;\n  memo_currency text;\n  memo_period_start date;\n  memo_amount numeric(12,2);\n  memo_created_at timestamptz;\n  memo_original_invoice_id uuid;\n  memo_applied numeric(12,2);\n  statement_month date;\n  source_month date;\n  approval_month date;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN\n    RAISE EXCEPTION 'Client credit applications are immutable';\n  END IF;\n\n  SELECT status, client_id, currency, subtotal, invoice_month\n    INTO statement_status, statement_client, statement_currency, statement_subtotal, statement_month\n    FROM client_monthly_invoices WHERE id = NEW.client_monthly_invoice_id FOR UPDATE;\n  SELECT client_id, currency, period_start, all_in_amount, created_at, original_talent_invoice_id\n    INTO memo_client, memo_currency, memo_period_start, memo_amount, memo_created_at, memo_original_invoice_id\n    FROM client_credit_memos WHERE id = NEW.client_credit_memo_id FOR UPDATE;\n\n  SELECT COALESCE(SUM(amount), 0) INTO memo_applied\n    FROM client_credit_applications WHERE client_credit_memo_id = NEW.client_credit_memo_id;\n  SELECT COALESCE(SUM(amount), 0) INTO statement_applied\n    FROM client_credit_applications WHERE client_monthly_invoice_id = NEW.client_monthly_invoice_id;\n  SELECT COALESCE(SUM(client_amount), 0) INTO gross_line_total\n    FROM client_monthly_invoice_lines WHERE client_monthly_invoice_id = NEW.client_monthly_invoice_id;\n\n  IF statement_status IS DISTINCT FROM 'draft'\n     OR statement_client IS DISTINCT FROM memo_client\n     OR statement_currency IS DISTINCT FROM memo_currency THEN\n    RAISE EXCEPTION 'Client credit applications must target a same-client, same-currency draft statement';\n  END IF;\n\n  source_month := date_trunc('month', memo_period_start)::date;\n  approval_month := date_trunc(\n    'month', memo_created_at AT TIME ZONE 'America/New_York'\n  )::date;\n  IF statement_month = source_month THEN\n    IF EXISTS (\n      SELECT 1\n        FROM client_monthly_invoice_lines source_line\n        JOIN client_monthly_invoices source_statement\n          ON source_statement.id = source_line.client_monthly_invoice_id\n       WHERE source_line.talent_invoice_id = memo_original_invoice_id\n         AND source_statement.status = 'sent'\n    ) THEN\n      RAISE EXCEPTION 'A sent original-month statement cannot receive a late Client credit';\n    END IF;\n  ELSIF statement_month <= source_month OR statement_month < approval_month THEN\n    RAISE EXCEPTION 'Late Client credits must target an eligible statement at or after approval month';\n  END IF;\n\n  -- Invoice lines are the immutable gross snapshot. The statement subtotal may\n  -- already be net of previously applied credits, so subtract prior credits\n  -- from gross line total exactly once.\n  IF gross_line_total = 0 THEN\n    gross_line_total := statement_subtotal + statement_applied;\n  END IF;\n  IF NEW.amount > memo_amount - memo_applied\n     OR NEW.amount > gross_line_total - statement_applied THEN\n    RAISE EXCEPTION 'Client credit application exceeds remaining memo or nonnegative statement balance';\n  END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","protect_client_credit_memos()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"bb30f00002ccbb111a84b94dabeef52f","body_source":"\nDECLARE claim_status text; invoice_status text; invoice_currency text;\n        claim_contract uuid; claim_invoice uuid; claim_client text;\n        claim_start date; claim_end date;\n        invoice_contract uuid; invoice_client text; invoice_start date; invoice_end date;\n        expected_amount numeric(12,2); invoice_base numeric(12,2); invoice_commission numeric(5,4);\nBEGIN\n  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Client credit memos are immutable'; END IF;\n  SELECT status, hiring_contract_id, original_talent_invoice_id, client_id, period_start, period_end\n    INTO claim_status, claim_contract, claim_invoice, claim_client, claim_start, claim_end\n    FROM client_late_guaranteed_claims WHERE id = NEW.late_claim_id;\n  SELECT status, currency, hiring_contract_id, client_id, period_start, period_end,\n         base_amount, commission_rate\n    INTO invoice_status, invoice_currency, invoice_contract, invoice_client, invoice_start,\n         invoice_end, invoice_base, invoice_commission\n    FROM talent_invoices WHERE id = NEW.original_talent_invoice_id;\n  IF claim_status IS DISTINCT FROM 'approved' OR invoice_status IS DISTINCT FROM 'sent'\n     OR invoice_currency IS DISTINCT FROM NEW.currency\n     OR claim_contract IS DISTINCT FROM NEW.hiring_contract_id\n     OR claim_invoice IS DISTINCT FROM NEW.original_talent_invoice_id\n     OR claim_client IS DISTINCT FROM NEW.client_id\n     OR claim_start IS DISTINCT FROM NEW.period_start OR claim_end IS DISTINCT FROM NEW.period_end\n     OR invoice_contract IS DISTINCT FROM NEW.hiring_contract_id\n     OR invoice_client IS DISTINCT FROM NEW.client_id\n     OR invoice_start IS DISTINCT FROM NEW.period_start OR invoice_end IS DISTINCT FROM NEW.period_end THEN\n    RAISE EXCEPTION 'Client credit memo must reference an approved claim and sent same-currency invoice';\n  END IF;\n  SELECT client_amount INTO expected_amount\n    FROM client_monthly_invoice_lines WHERE talent_invoice_id = NEW.original_talent_invoice_id;\n  expected_amount := COALESCE(expected_amount, ROUND(invoice_base * (1 + invoice_commission), 2));\n  IF NEW.all_in_amount IS DISTINCT FROM expected_amount THEN\n    RAISE EXCEPTION 'Client credit memo must match the original all-in statement snapshot';\n  END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","protect_client_late_claims()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"b85603838ebe06217d1d3215109fb6b6","body_source":"\nBEGIN\n  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'late Client claims cannot be deleted'; END IF;\n  IF TG_OP = 'UPDATE' AND (\n    OLD.status <> 'open' OR NEW.status NOT IN ('approved', 'rejected')\n    OR NEW.id IS DISTINCT FROM OLD.id\n    OR NEW.hiring_contract_id IS DISTINCT FROM OLD.hiring_contract_id\n    OR NEW.original_talent_invoice_id IS DISTINCT FROM OLD.original_talent_invoice_id\n    OR NEW.client_id IS DISTINCT FROM OLD.client_id\n    OR NEW.period_start IS DISTINCT FROM OLD.period_start\n    OR NEW.period_end IS DISTINCT FROM OLD.period_end\n    OR NEW.reason IS DISTINCT FROM OLD.reason\n    OR NEW.created_at IS DISTINCT FROM OLD.created_at\n    OR NEW.decision_reason IS NULL OR NEW.decided_by IS NULL OR NEW.decided_at IS NULL\n  ) THEN\n    RAISE EXCEPTION 'late Client claims allow only one immutable adjudication';\n  END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","protect_client_monthly_invoice_lines()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"01873fc81ae7b6ff9ef31d246326b6c1","body_source":"\nDECLARE invoice_status text;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN\n    RAISE EXCEPTION 'Client monthly invoice lines are immutable';\n  END IF;\n  SELECT status INTO invoice_status\n    FROM client_monthly_invoices WHERE id = NEW.client_monthly_invoice_id;\n  IF invoice_status IS DISTINCT FROM 'draft' THEN\n    RAISE EXCEPTION 'Client monthly invoice lines can only be added before the invoice is sent';\n  END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","protect_credit_memo_application_legacy()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"8a85b9b601211e735b73e933fea07344","body_source":"\nDECLARE invoice_status text;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN\n    RAISE EXCEPTION 'credit memo applications are immutable';\n  END IF;\n  SELECT status INTO invoice_status FROM talent_invoices WHERE id = NEW.talent_invoice_id;\n  IF invoice_status IS DISTINCT FROM 'draft' THEN\n    RAISE EXCEPTION 'credit memo applications must target an unsent Talent invoice draft';\n  END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","protect_credit_memo_application_v2()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"8a85b9b601211e735b73e933fea07344","body_source":"\nDECLARE invoice_status text;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN\n    RAISE EXCEPTION 'credit memo applications are immutable';\n  END IF;\n  SELECT status INTO invoice_status FROM talent_invoices WHERE id = NEW.talent_invoice_id;\n  IF invoice_status IS DISTINCT FROM 'draft' THEN\n    RAISE EXCEPTION 'credit memo applications must target an unsent Talent invoice draft';\n  END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","protect_hiring_contract_termination()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"81edd371f0979a323490c358399e3430","body_source":"\nBEGIN\n  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;\n  IF OLD.effective_end_date IS NOT NULL\n     AND (NEW.effective_end_date IS DISTINCT FROM OLD.effective_end_date\n       OR NEW.termination_reason IS DISTINCT FROM OLD.termination_reason\n       OR NEW.terminated_by IS DISTINCT FROM OLD.terminated_by\n       OR NEW.terminated_at IS DISTINCT FROM OLD.terminated_at) THEN\n    RAISE EXCEPTION 'An approved contract termination is immutable';\n  END IF;\n  IF OLD.effective_end_date IS NULL AND NEW.effective_end_date IS NOT NULL\n     AND NEW.effective_end_date < (now() AT TIME ZONE 'America/New_York')::date THEN\n    RAISE EXCEPTION 'Contract termination cannot be backdated';\n  END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","protect_hiring_contract_termination_requests()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"8b2d9e3efe2fb345d9c0c78c506f004f","body_source":"\nBEGIN\n  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Contract termination requests are immutable audit records'; END IF;\n  IF TG_OP = 'UPDATE' AND (\n    OLD.status <> 'open' OR NEW.status NOT IN ('approved', 'rejected')\n    OR NEW.id IS DISTINCT FROM OLD.id OR NEW.hiring_contract_id IS DISTINCT FROM OLD.hiring_contract_id\n    OR NEW.requester_id IS DISTINCT FROM OLD.requester_id OR NEW.requester_role IS DISTINCT FROM OLD.requester_role\n    OR NEW.requested_effective_end_date IS DISTINCT FROM OLD.requested_effective_end_date\n    OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.created_at IS DISTINCT FROM OLD.created_at\n    OR NEW.decision_reason IS NULL OR btrim(NEW.decision_reason) = ''\n    OR NEW.decided_by IS NULL OR NEW.decided_at IS NULL\n    OR (NEW.status = 'approved' AND NEW.approved_effective_end_date IS NULL)\n    OR (NEW.status = 'rejected' AND NEW.approved_effective_end_date IS NOT NULL)\n  ) THEN RAISE EXCEPTION 'Termination requests allow one immutable adjudication'; END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","protect_security_deposit_replenishments()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"62afa86b1a959ec31309a69bf1d534bd","body_source":"\nBEGIN\n  RAISE EXCEPTION 'security deposit replenishments are immutable';\nEND;\n"}],
  ["function","protect_sent_client_monthly_invoices()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"f25e869c799d78d5ddf74e1ae79f7b51","body_source":"\nBEGIN\n  IF TG_OP = 'DELETE' AND OLD.status = 'sent' THEN\n    RAISE EXCEPTION 'sent Client monthly invoices are immutable';\n  END IF;\n  IF TG_OP = 'UPDATE' AND OLD.status = 'sent' THEN\n    RAISE EXCEPTION 'sent Client monthly invoices are immutable';\n  END IF;\n  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","protect_sent_talent_invoice()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"eb7ae85eb0b1f0656055c7a2e1e45d28","body_source":"\nBEGIN\n  IF TG_OP = 'DELETE' AND OLD.status = 'sent' THEN\n    RAISE EXCEPTION 'sent Talent invoices are immutable';\n  END IF;\n  IF TG_OP = 'UPDATE' AND OLD.status = 'sent' THEN\n    RAISE EXCEPTION 'sent Talent invoices are immutable';\n  END IF;\n  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","protect_talent_credit_memos()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"a6a793d9e25aeb07e380c2f03b9b9f8b","body_source":"\nDECLARE original_status text;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN\n    RAISE EXCEPTION 'Talent credit memos are immutable';\n  END IF;\n  SELECT status INTO original_status FROM talent_invoices WHERE id = NEW.original_invoice_id;\n  IF original_status IS DISTINCT FROM 'sent' THEN\n    RAISE EXCEPTION 'Talent credit memos must refer to a sent invoice';\n  END IF;\n  RETURN NEW;\nEND;\n"}],
  ["function","reject_timesheet_history_mutation()",{"result":"trigger","language":"plpgsql","kind":"f","volatility":"volatile","strict":false,"security_definer":false,"leakproof":false,"parallel":"unsafe","config":null,"returns_set":false,"support":true,"cost":100,"rows":0,"body_md5":"f4e68ba1e2d006e67573b1ddff30917f","body_source":"\nBEGIN\n  RAISE EXCEPTION 'timesheet revision and audit history is immutable';\nEND;\n"}],
  ["index","client_credit_applications_client_credit_memo_id_client_mon_key",{"table":"client_credit_applications","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX client_credit_applications_client_credit_memo_id_client_mon_key ON public.client_credit_applications USING btree (client_credit_memo_id, client_monthly_invoice_id)","predicate":null,"keys":["client_credit_memo_id","client_monthly_invoice_id"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.uuid_ops"],"collations":[null,null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","client_credit_applications_invoice_idx",{"table":"client_credit_applications","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX client_credit_applications_invoice_idx ON public.client_credit_applications USING btree (client_monthly_invoice_id)","predicate":null,"keys":["client_monthly_invoice_id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","client_credit_applications_memo_idx",{"table":"client_credit_applications","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX client_credit_applications_memo_idx ON public.client_credit_applications USING btree (client_credit_memo_id)","predicate":null,"keys":["client_credit_memo_id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","client_credit_applications_pkey",{"table":"client_credit_applications","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX client_credit_applications_pkey ON public.client_credit_applications USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","client_credit_memos_client_currency_idx",{"table":"client_credit_memos","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX client_credit_memos_client_currency_idx ON public.client_credit_memos USING btree (client_id, currency, period_start, created_at)","predicate":null,"keys":["client_id","currency","period_start","created_at"],"opclasses":["pg_catalog.text_ops","pg_catalog.text_ops","pg_catalog.date_ops","pg_catalog.timestamptz_ops"],"collations":["pg_catalog.default","pg_catalog.default",null,null],"options":"0 0 0 0","key_count":4,"nulls_not_distinct":false}],
  ["index","client_credit_memos_late_claim_id_key",{"table":"client_credit_memos","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX client_credit_memos_late_claim_id_key ON public.client_credit_memos USING btree (late_claim_id)","predicate":null,"keys":["late_claim_id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","client_credit_memos_original_talent_invoice_id_key",{"table":"client_credit_memos","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX client_credit_memos_original_talent_invoice_id_key ON public.client_credit_memos USING btree (original_talent_invoice_id)","predicate":null,"keys":["original_talent_invoice_id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","client_credit_memos_pkey",{"table":"client_credit_memos","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX client_credit_memos_pkey ON public.client_credit_memos USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","client_late_guaranteed_claims_hiring_contract_id_period_sta_key",{"table":"client_late_guaranteed_claims","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX client_late_guaranteed_claims_hiring_contract_id_period_sta_key ON public.client_late_guaranteed_claims USING btree (hiring_contract_id, period_start, period_end)","predicate":null,"keys":["hiring_contract_id","period_start","period_end"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.date_ops","pg_catalog.date_ops"],"collations":[null,null,null],"options":"0 0 0","key_count":3,"nulls_not_distinct":false}],
  ["index","client_late_guaranteed_claims_original_talent_invoice_id_key",{"table":"client_late_guaranteed_claims","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX client_late_guaranteed_claims_original_talent_invoice_id_key ON public.client_late_guaranteed_claims USING btree (original_talent_invoice_id)","predicate":null,"keys":["original_talent_invoice_id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","client_late_guaranteed_claims_pkey",{"table":"client_late_guaranteed_claims","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX client_late_guaranteed_claims_pkey ON public.client_late_guaranteed_claims USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","client_late_guaranteed_claims_status_idx",{"table":"client_late_guaranteed_claims","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX client_late_guaranteed_claims_status_idx ON public.client_late_guaranteed_claims USING btree (status, created_at)","predicate":null,"keys":["status","created_at"],"opclasses":["pg_catalog.text_ops","pg_catalog.timestamptz_ops"],"collations":["pg_catalog.default",null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","client_monthly_invoice_lines_pkey",{"table":"client_monthly_invoice_lines","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX client_monthly_invoice_lines_pkey ON public.client_monthly_invoice_lines USING btree (client_monthly_invoice_id, talent_invoice_id)","predicate":null,"keys":["client_monthly_invoice_id","talent_invoice_id"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.uuid_ops"],"collations":[null,null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","client_monthly_invoice_lines_talent_invoice_id_key",{"table":"client_monthly_invoice_lines","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX client_monthly_invoice_lines_talent_invoice_id_key ON public.client_monthly_invoice_lines USING btree (talent_invoice_id)","predicate":null,"keys":["talent_invoice_id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","client_monthly_invoices_client_id_invoice_month_currency_key",{"table":"client_monthly_invoices","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX client_monthly_invoices_client_id_invoice_month_currency_key ON public.client_monthly_invoices USING btree (client_id, invoice_month, currency)","predicate":null,"keys":["client_id","invoice_month","currency"],"opclasses":["pg_catalog.text_ops","pg_catalog.date_ops","pg_catalog.text_ops"],"collations":["pg_catalog.default",null,"pg_catalog.default"],"options":"0 0 0","key_count":3,"nulls_not_distinct":false}],
  ["index","client_monthly_invoices_pkey",{"table":"client_monthly_invoices","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX client_monthly_invoices_pkey ON public.client_monthly_invoices USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","clock_exception_reviews_pkey",{"table":"clock_exception_reviews","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX clock_exception_reviews_pkey ON public.clock_exception_reviews USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","clock_exception_reviews_session_history",{"table":"clock_exception_reviews","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX clock_exception_reviews_session_history ON public.clock_exception_reviews USING btree (clock_session_id, created_at, id)","predicate":null,"keys":["clock_session_id","created_at","id"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.timestamptz_ops","pg_catalog.uuid_ops"],"collations":[null,null,null],"options":"0 0 0","key_count":3,"nulls_not_distinct":false}],
  ["index","clock_sessions_one_open_per_talent",{"table":"clock_sessions","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX clock_sessions_one_open_per_talent ON public.clock_sessions USING btree (talent_id) WHERE ((ended_at IS NULL) AND (exception_status IS DISTINCT FROM 'approved'::text))","predicate":"((ended_at IS NULL) AND (exception_status IS DISTINCT FROM 'approved'::text))","keys":["talent_id"],"opclasses":["pg_catalog.text_ops"],"collations":["pg_catalog.default"],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","clock_sessions_pkey",{"table":"clock_sessions","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX clock_sessions_pkey ON public.clock_sessions USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","clock_sessions_talent_recent",{"table":"clock_sessions","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX clock_sessions_talent_recent ON public.clock_sessions USING btree (talent_id, started_at DESC)","predicate":null,"keys":["talent_id","started_at"],"opclasses":["pg_catalog.text_ops","pg_catalog.timestamptz_ops"],"collations":["pg_catalog.default",null],"options":"0 3","key_count":2,"nulls_not_distinct":false}],
  ["index","guaranteed_claims_status_idx",{"table":"guaranteed_nonperformance_claims","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX guaranteed_claims_status_idx ON public.guaranteed_nonperformance_claims USING btree (status)","predicate":null,"keys":["status"],"opclasses":["pg_catalog.text_ops"],"collations":["pg_catalog.default"],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","guaranteed_nonperformance_cla_hiring_contract_id_period_sta_key",{"table":"guaranteed_nonperformance_claims","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX guaranteed_nonperformance_cla_hiring_contract_id_period_sta_key ON public.guaranteed_nonperformance_claims USING btree (hiring_contract_id, period_start, period_end)","predicate":null,"keys":["hiring_contract_id","period_start","period_end"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.date_ops","pg_catalog.date_ops"],"collations":[null,null,null],"options":"0 0 0","key_count":3,"nulls_not_distinct":false}],
  ["index","guaranteed_nonperformance_claims_pkey",{"table":"guaranteed_nonperformance_claims","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX guaranteed_nonperformance_claims_pkey ON public.guaranteed_nonperformance_claims USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","guaranteed_nonperformance_claims_talent_invoice_id_key",{"table":"guaranteed_nonperformance_claims","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX guaranteed_nonperformance_claims_talent_invoice_id_key ON public.guaranteed_nonperformance_claims USING btree (talent_invoice_id)","predicate":null,"keys":["talent_invoice_id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","hiring_contract_termination_one_approval_idx",{"table":"hiring_contract_termination_requests","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX hiring_contract_termination_one_approval_idx ON public.hiring_contract_termination_requests USING btree (hiring_contract_id) WHERE (status = 'approved'::text)","predicate":"(status = 'approved'::text)","keys":["hiring_contract_id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","hiring_contract_termination_one_open_request_idx",{"table":"hiring_contract_termination_requests","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX hiring_contract_termination_one_open_request_idx ON public.hiring_contract_termination_requests USING btree (hiring_contract_id) WHERE (status = 'open'::text)","predicate":"(status = 'open'::text)","keys":["hiring_contract_id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","hiring_contract_termination_requests_pkey",{"table":"hiring_contract_termination_requests","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX hiring_contract_termination_requests_pkey ON public.hiring_contract_termination_requests USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","hiring_contract_termination_requests_status_idx",{"table":"hiring_contract_termination_requests","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX hiring_contract_termination_requests_status_idx ON public.hiring_contract_termination_requests USING btree (status, created_at)","predicate":null,"keys":["status","created_at"],"opclasses":["pg_catalog.text_ops","pg_catalog.timestamptz_ops"],"collations":["pg_catalog.default",null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","payment_provider_accounts_external_unique",{"table":"payment_provider_accounts","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX payment_provider_accounts_external_unique ON public.payment_provider_accounts USING btree (provider_name, external_account_id) WHERE ((provider_name IS NOT NULL) AND (external_account_id IS NOT NULL))","predicate":"((provider_name IS NOT NULL) AND (external_account_id IS NOT NULL))","keys":["provider_name","external_account_id"],"opclasses":["pg_catalog.text_ops","pg_catalog.text_ops"],"collations":["pg_catalog.default","pg_catalog.default"],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","payment_provider_accounts_owner_unique",{"table":"payment_provider_accounts","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX payment_provider_accounts_owner_unique ON public.payment_provider_accounts USING btree (owner_type, owner_id)","predicate":null,"keys":["owner_type","owner_id"],"opclasses":["pg_catalog.text_ops","pg_catalog.text_ops"],"collations":["pg_catalog.default","pg_catalog.default"],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","payment_provider_accounts_pkey",{"table":"payment_provider_accounts","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX payment_provider_accounts_pkey ON public.payment_provider_accounts USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","payouts_talent_invoice_unique",{"table":"payouts","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX payouts_talent_invoice_unique ON public.payouts USING btree (talent_invoice_id) WHERE (talent_invoice_id IS NOT NULL)","predicate":"(talent_invoice_id IS NOT NULL)","keys":["talent_invoice_id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","security_deposit_replenishments_contract_idx",{"table":"security_deposit_replenishments","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX security_deposit_replenishments_contract_idx ON public.security_deposit_replenishments USING btree (hiring_contract_id, created_at)","predicate":null,"keys":["hiring_contract_id","created_at"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.timestamptz_ops"],"collations":[null,null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","security_deposit_replenishments_pkey",{"table":"security_deposit_replenishments","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX security_deposit_replenishments_pkey ON public.security_deposit_replenishments USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","talent_credit_memo_applications_pkey",{"table":"talent_credit_memo_applications","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX talent_credit_memo_applications_pkey ON public.talent_credit_memo_applications USING btree (credit_memo_id, talent_invoice_id)","predicate":null,"keys":["credit_memo_id","talent_invoice_id"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.uuid_ops"],"collations":[null,null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","talent_credit_memo_applications_v2_pkey",{"table":"talent_credit_memo_applications_v2","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX talent_credit_memo_applications_v2_pkey ON public.talent_credit_memo_applications_v2 USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","talent_credit_memo_apps_v2_invoice_idx",{"table":"talent_credit_memo_applications_v2","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX talent_credit_memo_apps_v2_invoice_idx ON public.talent_credit_memo_applications_v2 USING btree (talent_invoice_id)","predicate":null,"keys":["talent_invoice_id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","talent_credit_memo_apps_v2_memo_idx",{"table":"talent_credit_memo_applications_v2","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX talent_credit_memo_apps_v2_memo_idx ON public.talent_credit_memo_applications_v2 USING btree (credit_memo_id)","predicate":null,"keys":["credit_memo_id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","talent_credit_memos_invoice_revision_idx",{"table":"talent_credit_memos","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX talent_credit_memos_invoice_revision_idx ON public.talent_credit_memos USING btree (original_invoice_id, corrected_revision_id)","predicate":null,"keys":["original_invoice_id","corrected_revision_id"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.uuid_ops"],"collations":[null,null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","talent_credit_memos_pkey",{"table":"talent_credit_memos","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX talent_credit_memos_pkey ON public.talent_credit_memos USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","talent_credit_memos_talent_idx",{"table":"talent_credit_memos","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX talent_credit_memos_talent_idx ON public.talent_credit_memos USING btree (talent_id, created_at)","predicate":null,"keys":["talent_id","created_at"],"opclasses":["pg_catalog.text_ops","pg_catalog.timestamptz_ops"],"collations":["pg_catalog.default",null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","talent_invoices_hiring_contract_id_period_start_period_end_key",{"table":"talent_invoices","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX talent_invoices_hiring_contract_id_period_start_period_end_key ON public.talent_invoices USING btree (hiring_contract_id, period_start, period_end)","predicate":null,"keys":["hiring_contract_id","period_start","period_end"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.date_ops","pg_catalog.date_ops"],"collations":[null,null,null],"options":"0 0 0","key_count":3,"nulls_not_distinct":false}],
  ["index","talent_invoices_period_idx",{"table":"talent_invoices","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX talent_invoices_period_idx ON public.talent_invoices USING btree (period_start, period_end)","predicate":null,"keys":["period_start","period_end"],"opclasses":["pg_catalog.date_ops","pg_catalog.date_ops"],"collations":[null,null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","talent_invoices_pkey",{"table":"talent_invoices","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX talent_invoices_pkey ON public.talent_invoices USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","talent_invoices_talent_status_idx",{"table":"talent_invoices","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX talent_invoices_talent_status_idx ON public.talent_invoices USING btree (talent_id, status)","predicate":null,"keys":["talent_id","status"],"opclasses":["pg_catalog.text_ops","pg_catalog.text_ops"],"collations":["pg_catalog.default","pg_catalog.default"],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","timesheet_audit_period",{"table":"timesheet_audit","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX timesheet_audit_period ON public.timesheet_audit USING btree (timesheet_period_id, created_at)","predicate":null,"keys":["timesheet_period_id","created_at"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.timestamptz_ops"],"collations":[null,null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","timesheet_audit_pkey",{"table":"timesheet_audit","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX timesheet_audit_pkey ON public.timesheet_audit USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","timesheet_correction_proposals_pkey",{"table":"timesheet_correction_proposals","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX timesheet_correction_proposals_pkey ON public.timesheet_correction_proposals USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","timesheet_corrections_period",{"table":"timesheet_correction_proposals","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX timesheet_corrections_period ON public.timesheet_correction_proposals USING btree (timesheet_period_id, created_at)","predicate":null,"keys":["timesheet_period_id","created_at"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.timestamptz_ops"],"collations":[null,null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","timesheet_disputes_period",{"table":"timesheet_disputes","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX timesheet_disputes_period ON public.timesheet_disputes USING btree (timesheet_period_id, created_at)","predicate":null,"keys":["timesheet_period_id","created_at"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.timestamptz_ops"],"collations":[null,null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","timesheet_disputes_pkey",{"table":"timesheet_disputes","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX timesheet_disputes_pkey ON public.timesheet_disputes USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","timesheet_periods_contract_period",{"table":"timesheet_periods","unique":false,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE INDEX timesheet_periods_contract_period ON public.timesheet_periods USING btree (hiring_contract_id, period_start DESC)","predicate":null,"keys":["hiring_contract_id","period_start"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.date_ops"],"collations":[null,null],"options":"0 3","key_count":2,"nulls_not_distinct":false}],
  ["index","timesheet_periods_hiring_contract_id_period_start_period_en_key",{"table":"timesheet_periods","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX timesheet_periods_hiring_contract_id_period_start_period_en_key ON public.timesheet_periods USING btree (hiring_contract_id, period_start, period_end)","predicate":null,"keys":["hiring_contract_id","period_start","period_end"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.date_ops","pg_catalog.date_ops"],"collations":[null,null,null],"options":"0 0 0","key_count":3,"nulls_not_distinct":false}],
  ["index","timesheet_periods_pkey",{"table":"timesheet_periods","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX timesheet_periods_pkey ON public.timesheet_periods USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","timesheet_revision_sessions_pkey",{"table":"timesheet_revision_sessions","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX timesheet_revision_sessions_pkey ON public.timesheet_revision_sessions USING btree (revision_id, clock_session_id)","predicate":null,"keys":["revision_id","clock_session_id"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.uuid_ops"],"collations":[null,null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["index","timesheet_revisions_pkey",{"table":"timesheet_revisions","unique":true,"primary":true,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX timesheet_revisions_pkey ON public.timesheet_revisions USING btree (id)","predicate":null,"keys":["id"],"opclasses":["pg_catalog.uuid_ops"],"collations":[null],"options":"0","key_count":1,"nulls_not_distinct":false}],
  ["index","timesheet_revisions_timesheet_period_id_version_key",{"table":"timesheet_revisions","unique":true,"primary":false,"valid":true,"ready":true,"live":true,"method":"btree","definition":"CREATE UNIQUE INDEX timesheet_revisions_timesheet_period_id_version_key ON public.timesheet_revisions USING btree (timesheet_period_id, version)","predicate":null,"keys":["timesheet_period_id","version"],"opclasses":["pg_catalog.uuid_ops","pg_catalog.int4_ops"],"collations":[null,null],"options":"0 0","key_count":2,"nulls_not_distinct":false}],
  ["table","client_credit_applications",{"kind":"r"}],
  ["table","client_credit_memos",{"kind":"r"}],
  ["table","client_late_guaranteed_claims",{"kind":"r"}],
  ["table","client_monthly_invoice_lines",{"kind":"r"}],
  ["table","client_monthly_invoices",{"kind":"r"}],
  ["table","clock_exception_reviews",{"kind":"r"}],
  ["table","clock_sessions",{"kind":"r"}],
  ["table","guaranteed_nonperformance_claims",{"kind":"r"}],
  ["table","hiring_contract_termination_requests",{"kind":"r"}],
  ["table","hiring_contracts",{"kind":"r"}],
  ["table","invoices",{"kind":"r"}],
  ["table","jobs",{"kind":"r"}],
  ["table","offers",{"kind":"r"}],
  ["table","payment_provider_accounts",{"kind":"r"}],
  ["table","payouts",{"kind":"r"}],
  ["table","security_deposit_replenishments",{"kind":"r"}],
  ["table","talent_credit_memo_applications",{"kind":"r"}],
  ["table","talent_credit_memo_applications_v2",{"kind":"r"}],
  ["table","talent_credit_memos",{"kind":"r"}],
  ["table","talent_invoices",{"kind":"r"}],
  ["table","timesheet_audit",{"kind":"r"}],
  ["table","timesheet_correction_proposals",{"kind":"r"}],
  ["table","timesheet_disputes",{"kind":"r"}],
  ["table","timesheet_periods",{"kind":"r"}],
  ["table","timesheet_revision_sessions",{"kind":"r"}],
  ["table","timesheet_revisions",{"kind":"r"}],
  ["trigger","client_credit_applications.client_credit_applications_immutable",{"table":"client_credit_applications","enabled":"O","function":"public.protect_client_credit_applications()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":true,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER client_credit_applications_immutable BEFORE INSERT OR DELETE OR UPDATE ON public.client_credit_applications FOR EACH ROW EXECUTE FUNCTION protect_client_credit_applications()"}],
  ["trigger","client_credit_memos.client_credit_memos_immutable",{"table":"client_credit_memos","enabled":"O","function":"public.protect_client_credit_memos()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":true,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER client_credit_memos_immutable BEFORE INSERT OR DELETE OR UPDATE ON public.client_credit_memos FOR EACH ROW EXECUTE FUNCTION protect_client_credit_memos()"}],
  ["trigger","client_late_guaranteed_claims.client_late_claims_immutable",{"table":"client_late_guaranteed_claims","enabled":"O","function":"public.protect_client_late_claims()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":false,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER client_late_claims_immutable BEFORE DELETE OR UPDATE ON public.client_late_guaranteed_claims FOR EACH ROW EXECUTE FUNCTION protect_client_late_claims()"}],
  ["trigger","client_monthly_invoice_lines.client_monthly_invoice_lines_immutable",{"table":"client_monthly_invoice_lines","enabled":"O","function":"public.protect_client_monthly_invoice_lines()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":true,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER client_monthly_invoice_lines_immutable BEFORE INSERT OR DELETE OR UPDATE ON public.client_monthly_invoice_lines FOR EACH ROW EXECUTE FUNCTION protect_client_monthly_invoice_lines()"}],
  ["trigger","client_monthly_invoices.client_monthly_invoices_immutable",{"table":"client_monthly_invoices","enabled":"O","function":"public.protect_sent_client_monthly_invoices()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":false,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER client_monthly_invoices_immutable BEFORE DELETE OR UPDATE ON public.client_monthly_invoices FOR EACH ROW EXECUTE FUNCTION protect_sent_client_monthly_invoices()"}],
  ["trigger","hiring_contract_termination_requests.hiring_contract_termination_requests_immutable",{"table":"hiring_contract_termination_requests","enabled":"O","function":"public.protect_hiring_contract_termination_requests()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":false,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER hiring_contract_termination_requests_immutable BEFORE DELETE OR UPDATE ON public.hiring_contract_termination_requests FOR EACH ROW EXECUTE FUNCTION protect_hiring_contract_termination_requests()"}],
  ["trigger","hiring_contracts.hiring_contract_billing_start_immutable",{"table":"hiring_contracts","enabled":"O","function":"public.prevent_signed_contract_billing_start_change()","timing":"BEFORE","level":"ROW","events":{"delete":false,"insert":false,"update":true,"truncate":false},"update_of":["effective_start_date","billing_activated_at"],"definition":"CREATE TRIGGER hiring_contract_billing_start_immutable BEFORE UPDATE OF effective_start_date, billing_activated_at ON public.hiring_contracts FOR EACH ROW EXECUTE FUNCTION prevent_signed_contract_billing_start_change()"}],
  ["trigger","hiring_contracts.hiring_contract_termination_immutable",{"table":"hiring_contracts","enabled":"O","function":"public.protect_hiring_contract_termination()","timing":"BEFORE","level":"ROW","events":{"delete":false,"insert":false,"update":true,"truncate":false},"update_of":["effective_end_date","termination_reason","terminated_by","terminated_at"],"definition":"CREATE TRIGGER hiring_contract_termination_immutable BEFORE UPDATE OF effective_end_date, termination_reason, terminated_by, terminated_at ON public.hiring_contracts FOR EACH ROW EXECUTE FUNCTION protect_hiring_contract_termination()"}],
  ["trigger","hiring_contracts.hiring_contracts_billing_mode_immutable",{"table":"hiring_contracts","enabled":"O","function":"public.prevent_signed_contract_billing_mode_change()","timing":"BEFORE","level":"ROW","events":{"delete":false,"insert":false,"update":true,"truncate":false},"update_of":["billing_mode"],"definition":"CREATE TRIGGER hiring_contracts_billing_mode_immutable BEFORE UPDATE OF billing_mode ON public.hiring_contracts FOR EACH ROW EXECUTE FUNCTION prevent_signed_contract_billing_mode_change()"}],
  ["trigger","offers.offers_billing_mode_immutable",{"table":"offers","enabled":"O","function":"public.prevent_offer_billing_mode_change()","timing":"BEFORE","level":"ROW","events":{"delete":false,"insert":false,"update":true,"truncate":false},"update_of":["billing_mode"],"definition":"CREATE TRIGGER offers_billing_mode_immutable BEFORE UPDATE OF billing_mode ON public.offers FOR EACH ROW EXECUTE FUNCTION prevent_offer_billing_mode_change()"}],
  ["trigger","security_deposit_replenishments.security_deposit_replenishments_immutable",{"table":"security_deposit_replenishments","enabled":"O","function":"public.protect_security_deposit_replenishments()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":false,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER security_deposit_replenishments_immutable BEFORE DELETE OR UPDATE ON public.security_deposit_replenishments FOR EACH ROW EXECUTE FUNCTION protect_security_deposit_replenishments()"}],
  ["trigger","talent_credit_memo_applications.talent_credit_memo_applications_immutable",{"table":"talent_credit_memo_applications","enabled":"O","function":"public.protect_credit_memo_application_legacy()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":true,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER talent_credit_memo_applications_immutable BEFORE INSERT OR DELETE OR UPDATE ON public.talent_credit_memo_applications FOR EACH ROW EXECUTE FUNCTION protect_credit_memo_application_legacy()"}],
  ["trigger","talent_credit_memo_applications_v2.talent_credit_memo_applications_v2_immutable",{"table":"talent_credit_memo_applications_v2","enabled":"O","function":"public.protect_credit_memo_application_v2()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":true,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER talent_credit_memo_applications_v2_immutable BEFORE INSERT OR DELETE OR UPDATE ON public.talent_credit_memo_applications_v2 FOR EACH ROW EXECUTE FUNCTION protect_credit_memo_application_v2()"}],
  ["trigger","talent_credit_memos.talent_credit_memos_immutable",{"table":"talent_credit_memos","enabled":"O","function":"public.protect_talent_credit_memos()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":true,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER talent_credit_memos_immutable BEFORE INSERT OR DELETE OR UPDATE ON public.talent_credit_memos FOR EACH ROW EXECUTE FUNCTION protect_talent_credit_memos()"}],
  ["trigger","talent_invoices.talent_invoices_sent_immutable",{"table":"talent_invoices","enabled":"O","function":"public.protect_sent_talent_invoice()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":false,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER talent_invoices_sent_immutable BEFORE DELETE OR UPDATE ON public.talent_invoices FOR EACH ROW EXECUTE FUNCTION protect_sent_talent_invoice()"}],
  ["trigger","timesheet_audit.timesheet_audit_immutable",{"table":"timesheet_audit","enabled":"O","function":"public.reject_timesheet_history_mutation()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":false,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER timesheet_audit_immutable BEFORE DELETE OR UPDATE ON public.timesheet_audit FOR EACH ROW EXECUTE FUNCTION reject_timesheet_history_mutation()"}],
  ["trigger","timesheet_revision_sessions.timesheet_revision_sessions_immutable",{"table":"timesheet_revision_sessions","enabled":"O","function":"public.reject_timesheet_history_mutation()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":false,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER timesheet_revision_sessions_immutable BEFORE DELETE OR UPDATE ON public.timesheet_revision_sessions FOR EACH ROW EXECUTE FUNCTION reject_timesheet_history_mutation()"}],
  ["trigger","timesheet_revisions.timesheet_revisions_immutable",{"table":"timesheet_revisions","enabled":"O","function":"public.reject_timesheet_history_mutation()","timing":"BEFORE","level":"ROW","events":{"delete":true,"insert":false,"update":true,"truncate":false},"update_of":[],"definition":"CREATE TRIGGER timesheet_revisions_immutable BEFORE DELETE OR UPDATE ON public.timesheet_revisions FOR EACH ROW EXECUTE FUNCTION reject_timesheet_history_mutation()"}]
]
$expected_manifest$::jsonb
  ) AS manifest(item)
),
owned_tables AS (
  SELECT object_key AS table_name
  FROM expected
  WHERE object_type = 'table'
    AND object_key NOT IN ('jobs', 'offers', 'hiring_contracts', 'invoices', 'payouts')
),
migration_parent_columns AS (
  SELECT definition->>'table' AS table_name,
         split_part(object_key, '.', 2) AS column_name
  FROM expected
  WHERE object_type = 'column'
    AND definition->>'table' IN ('jobs', 'offers', 'hiring_contracts', 'invoices', 'payouts')
),
actual AS (
  SELECT 'table'::text AS object_type, c.relname::text AS object_key,
         jsonb_build_object('kind', c.relkind::text) AS definition
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN expected e ON e.object_type = 'table' AND e.object_key = c.relname
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')

  UNION ALL
  SELECT 'column', c.relname || '.' || a.attname,
         jsonb_build_object(
           'table', c.relname,
           'type', format_type(a.atttypid, a.atttypmod),
           'nullable', NOT a.attnotnull,
           'default', pg_get_expr(d.adbin, d.adrelid, false),
           'identity', a.attidentity::text,
           'generated', a.attgenerated::text
         )
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
  WHERE n.nspname = 'public'
    AND (c.relname IN (SELECT table_name FROM owned_tables)
         OR EXISTS (SELECT 1 FROM expected e WHERE e.object_type = 'column'
                    AND e.object_key = c.relname || '.' || a.attname))

  UNION ALL
  SELECT 'constraint', c.relname || '.' || con.conname,
         jsonb_build_object(
           'table', c.relname,
           'type', CASE con.contype
             WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY'
             WHEN 'c' THEN 'CHECK' WHEN 'u' THEN 'UNIQUE'
             WHEN 'x' THEN 'EXCLUSION' ELSE con.contype::text END,
           'definition', pg_get_constraintdef(con.oid, false),
           'validated', con.convalidated
         )
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND (c.relname IN (SELECT table_name FROM owned_tables)
         OR EXISTS (SELECT 1 FROM expected e WHERE e.object_type = 'constraint'
                    AND e.object_key = c.relname || '.' || con.conname)
         OR EXISTS (
           SELECT 1
           FROM expected e
           WHERE e.object_type = 'constraint'
             AND e.definition->>'table' = c.relname
             AND e.definition->>'type' = CASE con.contype
               WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY'
               WHEN 'c' THEN 'CHECK' WHEN 'u' THEN 'UNIQUE'
               WHEN 'x' THEN 'EXCLUSION' ELSE con.contype::text END
             AND e.definition->>'definition' = pg_get_constraintdef(con.oid, false)
         )
         OR (con.contype = 'f' AND EXISTS (
           SELECT 1
           FROM unnest(con.conkey) AS fk_source(attnum)
           JOIN pg_attribute source_column
             ON source_column.attrelid = con.conrelid
            AND source_column.attnum = fk_source.attnum
           JOIN migration_parent_columns owned_column
             ON owned_column.table_name = c.relname
            AND owned_column.column_name = source_column.attname
         )))

  UNION ALL
  SELECT 'index', idx.relname,
         jsonb_build_object(
           'table', tab.relname,
           'unique', i.indisunique,
           'primary', i.indisprimary,
           'valid', i.indisvalid,
           'ready', i.indisready,
           'live', i.indislive,
           'method', am.amname,
           'definition', pg_get_indexdef(i.indexrelid, 0, false),
           'predicate', pg_get_expr(i.indpred, i.indrelid, false),
           'keys', ARRAY(
             SELECT pg_get_indexdef(i.indexrelid, k, false)
             FROM generate_series(1, i.indnatts) AS key_position(k)
             ORDER BY k
           ),
           'opclasses', ARRAY(
             SELECT CASE WHEN k <= i.indnkeyatts
                         THEN op_ns.nspname || '.' || opc.opcname
                         ELSE NULL END
             FROM generate_series(1, i.indnatts) AS key_position(k)
             LEFT JOIN pg_opclass opc
               ON k <= i.indnkeyatts AND opc.oid = i.indclass[k - 1]
             LEFT JOIN pg_namespace op_ns ON op_ns.oid = opc.opcnamespace
             ORDER BY k
           ),
           'collations', ARRAY(
             SELECT CASE WHEN k <= i.indnkeyatts AND coll.oid IS NOT NULL
                         THEN coll_ns.nspname || '.' || coll.collname
                         ELSE NULL END
             FROM generate_series(1, i.indnatts) AS key_position(k)
             LEFT JOIN pg_collation coll
               ON k <= i.indnkeyatts AND coll.oid = i.indcollation[k - 1]
             LEFT JOIN pg_namespace coll_ns ON coll_ns.oid = coll.collnamespace
             ORDER BY k
           ),
           'options', i.indoption::text,
           'key_count', i.indnkeyatts,
           'nulls_not_distinct', i.indnullsnotdistinct
         )
  FROM pg_index i
  JOIN pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_class tab ON tab.oid = i.indrelid
  JOIN pg_namespace ns ON ns.oid = tab.relnamespace
  JOIN pg_am am ON am.oid = idx.relam
  WHERE ns.nspname = 'public'
    AND (tab.relname IN (SELECT table_name FROM owned_tables)
         OR EXISTS (SELECT 1 FROM expected e WHERE e.object_type = 'index'
                    AND e.object_key = idx.relname)
         OR EXISTS (
           SELECT 1
           FROM generate_series(1, i.indnatts) AS key_position(k)
           JOIN pg_attribute source_column
             ON source_column.attrelid = i.indrelid
            AND source_column.attnum = i.indkey[key_position.k - 1]
           JOIN migration_parent_columns owned_column
             ON owned_column.table_name = tab.relname
            AND owned_column.column_name = source_column.attname
         )
         OR EXISTS (
           SELECT 1
           FROM pg_depend index_dependency
           JOIN pg_attribute source_column
             ON source_column.attrelid = index_dependency.refobjid
            AND source_column.attnum = index_dependency.refobjsubid
           JOIN migration_parent_columns owned_column
             ON owned_column.table_name = tab.relname
            AND owned_column.column_name = source_column.attname
           WHERE index_dependency.classid = 'pg_class'::regclass
             AND index_dependency.objid = i.indexrelid
             AND index_dependency.refclassid = 'pg_class'::regclass
             AND index_dependency.refobjid = i.indrelid
             AND index_dependency.refobjsubid > 0
         ))

  UNION ALL
  SELECT 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         jsonb_build_object(
           'result', pg_get_function_result(p.oid),
           'language', l.lanname,
           'kind', p.prokind::text,
           'volatility', CASE p.provolatile WHEN 'i' THEN 'immutable'
                           WHEN 's' THEN 'stable' WHEN 'v' THEN 'volatile' END,
           'strict', p.proisstrict,
           'security_definer', p.prosecdef,
           'leakproof', p.proleakproof,
           'parallel', CASE p.proparallel WHEN 's' THEN 'safe'
                          WHEN 'r' THEN 'restricted' WHEN 'u' THEN 'unsafe' END,
           'config', p.proconfig,
           'returns_set', p.proretset,
           'support', p.prosupport = 0,
           'cost', p.procost,
           'rows', p.prorows,
           'body_md5', md5(p.prosrc),
           'body_source', p.prosrc
         )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND EXISTS (SELECT 1 FROM expected e WHERE e.object_type = 'function'
                AND split_part(e.object_key, '(', 1) = p.proname)

  UNION ALL
  SELECT 'trigger', c.relname || '.' || t.tgname,
         jsonb_build_object(
           'table', c.relname,
           'enabled', t.tgenabled::text,
           'function', format('%I.%I(%s)', fn_ns.nspname, fn.proname,
                              pg_get_function_identity_arguments(fn.oid)),
           'timing', CASE WHEN (t.tgtype & 64) <> 0 THEN 'INSTEAD OF'
                          WHEN (t.tgtype & 2) <> 0 THEN 'BEFORE' ELSE 'AFTER' END,
           'level', CASE WHEN (t.tgtype & 1) <> 0 THEN 'ROW' ELSE 'STATEMENT' END,
           'events', jsonb_build_object(
             'insert', (t.tgtype & 4) <> 0,
             'delete', (t.tgtype & 8) <> 0,
             'update', (t.tgtype & 16) <> 0,
             'truncate', (t.tgtype & 32) <> 0
           ),
           'update_of', ARRAY(
             SELECT a.attname::text
             FROM unnest(t.tgattr::smallint[]) WITH ORDINALITY AS update_column(attnum, ord)
             JOIN pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = update_column.attnum
             ORDER BY update_column.ord
           ),
           'definition', pg_get_triggerdef(t.oid, false)
         )
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc fn ON fn.oid = t.tgfoid
  JOIN pg_namespace fn_ns ON fn_ns.oid = fn.pronamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal
    AND (c.relname IN (SELECT table_name FROM owned_tables)
         OR EXISTS (SELECT 1 FROM expected e WHERE e.object_type = 'trigger'
                    AND e.object_key = c.relname || '.' || t.tgname))
),
definitions AS (
  SELECT 'expected'::text AS source, object_type, object_key, definition
  FROM expected
  UNION ALL
  SELECT 'actual'::text AS source, object_type, object_key, definition
  FROM actual
),
numeric_default_literals AS (
  SELECT source, object_type, object_key, definition,
         CASE
           WHEN definition->>'type' ~ '^(numeric|decimal)(\([0-9]+,[0-9]+\))?$'
           THEN COALESCE(
             (regexp_match(
               definition->>'default',
               '^([+-]?[0-9]{1,32}(\.[0-9]{1,16})?)$'
             ))[1],
             (regexp_match(
               definition->>'default',
               '^''([+-]?[0-9]{1,32}(\.[0-9]{1,16})?)''::(numeric|decimal)$'
             ))[1],
             (regexp_match(
               definition->>'default',
               '^\(([+-]?[0-9]{1,32}(\.[0-9]{1,16})?)\)::(numeric|decimal)$'
             ))[1]
           )
           ELSE NULL
         END AS numeric_literal
  FROM definitions
),
normalized_definitions AS (
  SELECT source, object_type, object_key, definition,
         CASE WHEN numeric_literal IS NOT NULL
              THEN jsonb_set(
                definition,
                '{default}',
                to_jsonb(('numeric:' || trim_scale(numeric_literal::numeric)::text)::text)
              )
              ELSE definition END AS match_definition
  FROM numeric_default_literals
),
expected_normalized AS (
  SELECT object_type, object_key, definition, match_definition
  FROM normalized_definitions WHERE source = 'expected'
),
actual_normalized AS (
  SELECT object_type, object_key, definition, match_definition
  FROM normalized_definitions WHERE source = 'actual'
),
-- 0026's intended removal is a negative invariant independent of constraint or
-- index name and key order; the nonunique replacement index is still expected.
forbidden_unique_pair_indexes AS (
  SELECT idx.relname AS object_key
  FROM pg_index i
  JOIN pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_class tab ON tab.oid = i.indrelid
  JOIN pg_namespace ns ON ns.oid = tab.relnamespace
  WHERE ns.nspname = 'public'
    AND tab.relname = 'talent_credit_memos'
    AND i.indisunique
    AND i.indnkeyatts = 2
    AND i.indexprs IS NULL
    AND ARRAY(
      SELECT source_column.attname::text
      FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS source_key(attnum, ord)
      JOIN pg_attribute source_column
        ON source_column.attrelid = i.indrelid
       AND source_column.attnum = source_key.attnum
      WHERE source_key.ord <= i.indnkeyatts
      ORDER BY source_key.ord
    ) IN (
      ARRAY['original_invoice_id', 'corrected_revision_id']::text[],
      ARRAY['corrected_revision_id', 'original_invoice_id']::text[]
    )
),
constraint_aliases AS (
  SELECT e.object_key AS expected_key,
         min(a.object_key) AS alias_key
  FROM expected_normalized e
  JOIN actual_normalized a
    ON a.object_type = 'constraint'
   AND a.match_definition = e.match_definition
  LEFT JOIN actual existing
    ON existing.object_type = 'constraint'
   AND existing.object_key = e.object_key
  WHERE e.object_type = 'constraint'
    AND existing.object_key IS NULL
  GROUP BY e.object_key
),
expected_constraint_index_keys AS (
  SELECT object_key AS constraint_key,
         definition->>'table' AS table_name,
         definition->>'type' AS constraint_type,
         regexp_split_to_array(
           regexp_replace(
             (regexp_match(
               definition->>'definition',
               '^(PRIMARY KEY|UNIQUE) \((.*)\)$'
             ))[2],
             '[[:space:]]', '', 'g'
           ),
           ','
         ) AS source_columns
  FROM expected_normalized
  WHERE object_type = 'constraint'
    AND definition->>'type' IN ('PRIMARY KEY', 'UNIQUE')
),
expected_constraint_index_pairs AS (
  SELECT c.constraint_key, i.object_key AS index_key, c.table_name,
         c.constraint_type, c.source_columns
  FROM expected_constraint_index_keys c
  JOIN expected_normalized i
    ON i.object_type = 'index'
   AND i.match_definition->>'table' = c.table_name
   AND i.match_definition->'keys' = to_jsonb(c.source_columns)
   AND i.match_definition->>'unique' = 'true'
   AND i.match_definition->>'primary' = (c.constraint_type = 'PRIMARY KEY')::text
),
constraint_alias_indexes AS (
  SELECT ca.expected_key,
         rel.relname AS table_name,
         idx.relname AS index_key,
         CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' ELSE 'UNIQUE' END AS constraint_type,
         i.indisprimary AS is_primary,
         i.indisunique AS is_unique,
         ARRAY(
           SELECT source_column.attname::text
           FROM unnest(con.conkey) WITH ORDINALITY AS source_key(attnum, ord)
           JOIN pg_attribute source_column
             ON source_column.attrelid = con.conrelid
            AND source_column.attnum = source_key.attnum
           ORDER BY source_key.ord
         ) AS source_columns
  FROM constraint_aliases ca
  JOIN pg_class rel
    ON rel.relname = split_part(ca.alias_key, '.', 1)
  JOIN pg_namespace rel_ns
    ON rel_ns.oid = rel.relnamespace AND rel_ns.nspname = 'public'
  JOIN pg_constraint con
    ON con.conrelid = rel.oid
   AND con.conname = split_part(ca.alias_key, '.', 2)
   AND con.contype IN ('p', 'u')
  JOIN pg_index i ON i.indexrelid = con.conindid AND i.indrelid = con.conrelid
  JOIN pg_class idx ON idx.oid = i.indexrelid
),
index_aliases AS (
  SELECT p.index_key AS expected_index_key,
         min(ai.object_key) AS alias_index_key
  FROM expected_constraint_index_pairs p
  JOIN constraint_alias_indexes cai
    ON cai.expected_key = p.constraint_key
  JOIN expected_normalized ei
    ON ei.object_type = 'index' AND ei.object_key = p.index_key
  JOIN actual_normalized ai
    ON ai.object_type = 'index' AND ai.object_key = cai.index_key
  LEFT JOIN actual existing
    ON existing.object_type = 'index'
   AND existing.object_key = p.index_key
  WHERE existing.object_key IS NULL
    AND cai.table_name = p.table_name
    AND cai.constraint_type = p.constraint_type
    AND cai.source_columns = p.source_columns
    AND cai.is_unique
    AND cai.is_primary = (p.constraint_type = 'PRIMARY KEY')
    AND ei.match_definition->'keys' = to_jsonb(cai.source_columns)
    AND ei.match_definition->>'table' = cai.table_name
    AND (ei.match_definition - 'definition') = (ai.match_definition - 'definition')
  GROUP BY p.index_key
),
comparison AS (
  SELECT e.object_type, e.object_key,
         CASE WHEN a.object_key IS NOT NULL
                   AND en.match_definition = an.match_definition THEN 'MATCHING'
              WHEN a.object_key IS NOT NULL THEN 'CONFLICTING'
              WHEN e.object_type = 'constraint' AND ca.alias_key IS NOT NULL THEN 'MATCHING'
              WHEN e.object_type = 'index' AND ia.alias_index_key IS NOT NULL THEN 'MATCHING'
              ELSE 'MISSING' END AS status,
         e.definition AS expected_definition,
         COALESCE(a.definition, alias_a.definition, alias_index.definition) AS actual_definition,
         CASE WHEN ca.alias_key IS NOT NULL
              THEN 'matching constraint definition found under alternate name: ' || ca.alias_key
              WHEN ia.alias_index_key IS NOT NULL
              THEN 'backing index matches accepted constraint alias under alternate name: ' || ia.alias_index_key
              WHEN e.object_type = 'function'
                   AND e.definition->>'body_md5' = a.definition->>'body_md5'
                   AND e.definition->>'body_source' IS DISTINCT FROM a.definition->>'body_source'
              THEN 'suspected body-hash collision; exact source differs'
              ELSE NULL END AS diagnostic
  FROM expected e
  JOIN expected_normalized en USING (object_type, object_key)
  LEFT JOIN actual a USING (object_type, object_key)
  LEFT JOIN actual_normalized an USING (object_type, object_key)
  LEFT JOIN constraint_aliases ca
    ON e.object_type = 'constraint' AND ca.expected_key = e.object_key
  LEFT JOIN actual alias_a
    ON alias_a.object_type = 'constraint' AND alias_a.object_key = ca.alias_key
  LEFT JOIN index_aliases ia
    ON e.object_type = 'index' AND ia.expected_index_key = e.object_key
  LEFT JOIN actual alias_index
    ON alias_index.object_type = 'index' AND alias_index.object_key = ia.alias_index_key

  UNION ALL
  SELECT a.object_type, a.object_key, 'CONFLICTING', NULL::jsonb, a.definition,
         CASE WHEN forbidden.object_key IS NOT NULL
              THEN 'forbidden unique index on talent_credit_memos(original_invoice_id, corrected_revision_id), in either key order'
              ELSE 'unexpected additional scoped object' END
  FROM actual a
  LEFT JOIN expected e USING (object_type, object_key)
  LEFT JOIN forbidden_unique_pair_indexes forbidden
    ON a.object_type = 'index' AND forbidden.object_key = a.object_key
  WHERE e.object_key IS NULL
    AND NOT (a.object_type = 'constraint' AND EXISTS (
      SELECT 1 FROM constraint_aliases ca WHERE ca.alias_key = a.object_key
    ))
    AND NOT (a.object_type = 'index' AND EXISTS (
      SELECT 1 FROM index_aliases ia WHERE ia.alias_index_key = a.object_key
    ))
)
SELECT object_type, object_key, status,
       expected_definition, actual_definition, diagnostic
FROM comparison
ORDER BY object_type, object_key;
