# Admin-managed Wise QR configuration

## Scope and access

Use **Admin Ledger → Manual Wise payments**. Existing permissions are retained: only a current database-authorized Super Admin can upload, draft, activate, deactivate or restore receiving settings. Other admin subroles, Clients and Talent cannot change them.

This extends the existing configuration table, private files and financial audit; it is not another payment settings system. No Wise API, automatic verification, payment-amount changes, billing-formula changes, historical deletions or production deployment are included.

## Operator instructions

1. Inspect the currently active QR and receiving details. **Edit as new draft** copies an active version, or start an empty draft.
2. Enter the independently confirmed recipient, primary currency, supported currency list, transfer instructions and reference instructions. Include the primary currency in the list. Deposit funding/custody authorization remains a separate explicit business approval.
3. Select a PNG, JPEG or WebP and inspect its local preview. **Upload QR image** writes the existing private App Storage and displays the protected server preview. The supplied official source remains an optional alternative. Neither operation changes live settings. The existing 8 MiB/content inspection applies; PDF is not a QR image format.
4. **Save draft** creates an immutable draft without disabling the active configuration. To revise a saved draft, use it as a template and save another draft.
5. Choose **Review this draft**. Inspect the exact saved QR, recipient, currencies, transfer instructions and reference text. The protected image must load and decode successfully.
6. Confirm image review, receiving-account ownership, supported currencies and payment instructions individually. Enter an activation reason, then **Activate reviewed configuration**. Nothing is preconfirmed; QR-less drafts cannot activate.
7. Successful activation atomically replaces active versions for the selected currencies. The old settings remain available until commit. A stale draft returns 409 if an overlapping active version changed after draft creation; save and review a fresh draft. Reusing an already reviewed draft also returns 409.
8. **Deactivate** requires a reason and immediately revokes the still-active currency rows approved in that activation together. Separately activated configurations are unaffected. Previously issued obligations bound to a revoked destination are blocked.
9. Review prior versions in **Configuration history**. **Restore as draft** copies a retired version into a new draft; fresh review and separate activation are mandatory. Restoration does not mutate the old receiving details or clear their revocation.

## Version, currency and snapshot model

The existing one-active-version-per-currency index is preserved. A reviewed multi-currency draft creates one existing-style active row for each supported currency in one transaction. These rows share the source draft and original QR. Deactivation uses that shared activation source to revoke the remaining active siblings together.

Each upload, draft, activation, revocation and restoration draft is audited. Version history includes the QR reference, upload actor/date, recipient, currency set, payment/reference instructions, activation actor/date, predecessor, source draft/version and deactivation/replacement reason. Historic content and receipts are retained; legacy activation actors/dates stay unknown rather than being invented.

An issued receiving snapshot includes QR, currency, recipient, instructions **and reference instructions**. A newer QR is never combined with an older invoice's text, even when recipient names match.

Newly issued eligible payments use current active settings. Previously bound invoices and submitted proofs preserve their original version. If an older issued invoice is first opened after replacement, the service recovers the known version active at issuance using database timestamps at full precision. Where legacy data has no authoritative historical activation period, first enrollment uses current confirmed instructions rather than inventing a past account.

Unsupported currencies receive no incompatible QR. Collection QR images are never provided for outgoing Talent payouts. Revoked destination snapshots remain blocked even after a new/restored activation; existing issued obligations need separate financial review rather than a silent destination rewrite.

The existing customer component refreshes status every 30 seconds and on focus/manual refresh. Revocation takes effect on the server immediately; previously downloaded images cannot be recalled.

## Existing API extensions

All endpoints use existing bearer authentication, current database role checks and mutation rate limiting.

- `GET /api/admin/manual-wise/config` — active versions, drafts and history, including upload/lifecycle metadata.
- `POST /api/admin/manual-wise/config` — save draft only, `active:false`; accepts existing receiving fields and `supportedCurrencies` (1–20 distinct uppercase three-letter codes including primary `currency`).
- `POST /api/admin/manual-wise/config/:id/activate` — requires `confirmImageReviewed`, `confirmReceivingAccount`, `confirmCurrencies`, `confirmInstructions` all `true`, plus nonempty `reason`.
- `POST /api/admin/manual-wise/config/:id/deactivate` — nonempty `reason`; immediate grouped revocation.
- `POST /api/admin/manual-wise/config/:id/restore` — nonempty `reason`; returns a new unactivated draft.
- Existing `/config/qr`, `/config/qr/official` and protected `/api/manual-wise/files/:id` continue using the normal private upload/access pipeline. Uploading does not activate.

## Migration and development state

`migrations/0041_manual_wise_configuration_lifecycle.sql` adds lifecycle metadata to `manual_wise_config`, with matching Drizzle definitions. It does not change financial balances or activate receiving details. It was applied **only to development**, idempotently tested in disposable PostgreSQL, and not run against production.

Development still has no receiving configuration seeded. The supplied official QR remains pending independent account/currency/instruction approval. Do not invent a recipient, currency support, administrator identity or activation event to make a demo look active.

Private storage is persistent and never served from a public asset URL. The original source image was read successfully with identical bytes after application restart. A production environment using a different private directory/bucket must have the selected image available in its own authorized storage; development availability alone is not a production readiness claim.

## Verification

- **28 backend/billing tests passed:** existing receipt verification/rejection/authorization and amount calculations; original-byte image upload/download; draft isolation; all four activation confirmations; multiple currencies; conflicting activations; original snapshots for pending proofs and previously unviewed invoices; safe restoration; grouped revocation; unauthorized lifecycle requests; and HTTP application restart with a fresh PostgreSQL pool. Invoice amounts/currencies/statuses remain identical across the restart/activation test.
- **22 browser tests passed:** all six incoming categories and original downloads at mobile/desktop widths; existing receipt submission; full upload → local/server preview → draft → activation → history → restore → re-review → deactivate flow at 390px and 1280px; invalid currencies; and activation denial for undecodable, forbidden or missing protected images.
- TypeScript and every production build stage passed.
- Browser tests use real components with isolated API fixtures. Backend tests own disposable PostgreSQL and inject a blob transport. No real payment, signed-in live-account UAT or production deployment is claimed.
- Review screenshots: `generated-artifacts/wise-qr-lifecycle/review-390.png` and `review-1280.png`, explicitly showing **fixture** destinations, not approved live collection settings.

## Changed files

- `client/src/components/manual-wise/WiseConfigurationSettings.tsx` — focused lifecycle UI.
- `client/src/components/manual-wise/AdminWisePayments.tsx` — integrates settings; settlement/review/payout logic retained.
- `server/services/manualWiseConfiguration.ts` — draft/activation/revocation/restore transactions and audit.
- `server/services/manualWiseService.ts` — delegates settings and preserves original receiving snapshots.
- `server/routes/manualWise.ts` — lifecycle endpoints and QR upload audit.
- `shared/schema.ts`, `migrations/0041_manual_wise_configuration_lifecycle.sql` — existing-table metadata.
- `server/tests/manual-wise.integration.test.ts`, `browser-tests/manual-wise.browser.test.ts` — regression/lifecycle tests.
- `docs/WISE_QR_CONFIGURATION.md`, `docs/MANUAL_WISE_PAYMENTS.md` and the existing manual-settlement project memory note.
