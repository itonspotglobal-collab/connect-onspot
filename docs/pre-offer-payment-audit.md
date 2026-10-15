# Pre-offer hiring payment audit

## Scope and confirmed implementation

The canonical hiring record is `job_submissions`, not legacy `job_applications`.
`server/services/formalPipelineGuard.ts` admits linked organic applications and
accepted Client invitations, excludes silent shortlists and inactive applications,
and enforces ownership. Existing eligible stages permit legitimate direct offers;
there is no universal completed-interview prerequisite.

`server/routes.ts` contains the formal offer POST, Client counteroffer response,
Talent counteroffer response, expiration handling, and single-pending-offer
constraint. Client creation snapshots job engagement/billing modes and Talent rate
expectations. `ClientProfile.tsx` is the active Client offer UI;
`AdminJobApplications.tsx` manages application stages but does not have a separate
formal-offer creation endpoint. Elevated users calling the Client endpoint must
still satisfy its ownership check.

`contractDocumentService.ts`, `hiringContractService.ts`, and
`ContractWorkflow.tsx` implement accepted-offer preparation, private PDF versions,
hash-bound consent, signing, and canonical execution. OnSpot remains mandatory,
with Client/Organization signatures where applicable. Execution activates billing
and creates the security deposit. This must not be replaced by a payment event.

`server/lib/billing.ts`, `server/routes/talentInvoices.ts`, and the existing
invoice/monthly-invoice/deposit entities support engagement billing, not a charge
before an offer. `ClientInvoices.tsx` and `client/Billing.tsx` expose existing
engagement invoices. `AdminLedger.tsx` is the existing administrative ledger.
Manual financial references exist, but are not proof of a verified gateway
transaction. No pre-offer gateway/webhook can safely be inferred from them.

## Missing and partial functionality

- No persisted Ready for Offer intent or hiring-attempt invoice existed.
- No authorized pre-offer fee/tax/due-date/payment-instructions policy existed.
- No pending-evidence/manual verification lifecycle existed for this fee.
- Offer creation and counteroffer INSERTs lacked a pre-offer payment guard.
- No Client invoice/payment progress or Admin review controls existed for this fee.
- Existing invoice screens were reusable containers, but their period-based
  records must not be overloaded with a non-recurring hiring charge.
- Historical offers have no established pre-offer evidence. They must be explicit
  review exceptions, never backfilled as paid.

## Integration and database design

Add dedicated policy versions, one persisted intent/attempt per original
submission, `hiring_pre_offer` invoices, append-only event history, and historical
review exceptions. Do not change submission statuses or existing financial rows.
Snapshot authorized fixed-per-attempt USD pricing, explicit tax treatment,
recipient, method, instructions and due date at issuance. Absence of policy must
fail closed. A paid invoice remains reusable for reoffers within the same original
attempt; a void/refund/invalidation cannot authorize a new offer.

Use submission → invoice lock order in mutations and a database offer trigger as
defense in depth for every INSERT/new-send path (including Admin-assisted calls).
The trigger checks original parties, attempt, type, paid/verified amounts/currency,
and verifier. New counters also require valid payment; existing historical offers
may still be accepted/declined and executed legitimately. Refunds must create an
exception rather than rewriting accepted offers/contracts.

Super Admin only may authorize policies and verify/reject/void/invalidate/refund.
Client evidence is a reference, never a payment declaration. Confirmation requires
independently checked amount/currency, recipient, transaction reference and
affirmative attestation. Restrict all reads by database-confirmed role/ownership;
Talent cannot read these records. Keep internal verification notes out of Client
responses.

## Deployment boundaries

Use additive versioned migration `0038`; existing rows are not rewritten.
Apply through `scripts/run-migrations.ts` during the normal migration/start flow.
Do not run production schema pushes or publish automatically. Review existing
database identity/Neon rollout constraints before release. Missing policy blocks
new offers intentionally; configure it through the Super Admin UI before UAT.
An old app instance may encounter the database guard during a rolling release;
coordinate migration and UI rollout. Existing accepted offers, signed contracts,
deposits, sent invoices and Talent vetting quiz are outside modification scope.

Implementation details, executed tests and remaining UAT are recorded in
`docs/pre-offer-payment-completion.md`.
