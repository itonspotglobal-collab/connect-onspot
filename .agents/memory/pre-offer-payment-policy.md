---
name: Offer acceptance and security deposit policy
description: Revised business sequence, independent settlement verification, and preserving historical pre-offer financial records.
---

For ordinary new-flow applications the approved sequence is shortlist → passed completed final interview → offer → acceptance/security-deposit invoice → independently verified funding → Contractor Agreement and current signed client MSA → activation. Pre-offer payment is permanently retired, not merely disabled. Do not restore a toggle or gate interviews, offers, counters or renewals on fees or deposits.

The owner explicitly authorized ALL database-confirmed users with role `admin`, regardless of `admin_sub_role`, to use `skip_stage`, `waive_deposit`, `skip_agreements`, and `direct_placement`. Every action requires a written reason and records in both the hiring-override audit and application status history. Clients and Talent cannot grant these exceptions. Missing interviews, signatures and settlement evidence must never be fabricated. Automatic reversal remains restricted to Super Admins; it was not included in the four newly authorized actions.

**Why:** On 2026-11-03 the owner explicitly broadened these four exceptions from Super Admins to every Admin account. They change eligibility requirements, not historical truth or the amount of cash held. This authorization does not broaden settlement verification, legal-document administration, or unrelated role-specific data access.

**How to apply:** Default hiring remains deposit-first. Distinguish “Waived” from “Paid”; an administrative waiver cannot fund a payout, create held cash, or imply independent Wise verification. Agreement bypasses must remain visibly audited rather than populating signature fields. Require explicit real rate, USD currency and agreed start date for administrative offers/placements. Preserve existing invoices, accepted deferred obligations and settlement evidence.

Deposit-billing tools (including their separate waiver action), onboarding prerequisites/repairs and offline MSA recording remain Super Admin only: database role `admin` and a NULL sub-role. The all-Admin hiring waiver remains available separately.

**Why:** The owner explicitly excluded these financial/legal/repair tools from the broadened recruiting overrides. Reusing recruiting authorization accidentally granted Recruiting and Client Success access.

**How to apply:** Keep these two authorization scopes distinct in services and UI. An Admin's permission to waive a hiring prerequisite is not permission to verify money, administer legal evidence or repair onboarding records.

**Why:** On 2026-10-28 the owner explicitly superseded the signing-first sequence with payment before agreements and added shortlist/final-interview prerequisites. Neither a receipt, funded deposit, nor signatures alone establish an active new engagement.

**How to apply:** Preserve original applications and normal shortlist/final-interview prerequisites, except explicitly authorized recruiting exceptions or the audited Admin actions above. Already-accepted historical offers keep their old path; never move, rebill or recontract them merely for release. A genuinely fresh acceptance after cutover (including counters, renewals or Admin-created offers on a legacy application) must instead be invoice-first. Keep the invitation click-through checkbox separate from hash-bound versioned MSA signatures. No active MSA blocks ordinary activation unless explicitly bypassed by an audited Admin exception. Do not invent legal documents or receiving instructions.

**Why:** The owner explicitly required that no fresh post-release acceptance inherit signing-first behavior, including acceptance on a grandfathered application. Grandfathering protects historical accepted records, not future acceptance transactions.

Pricing, tax treatment, due terms, recipient and instructions must be explicitly authorized. Neither a zero amount nor an invented charge is an acceptable fallback. Keep the approved security-deposit formula and billing calculations unchanged. Manual references are unverified claims. Policy authorization and manual settlement verification remain restricted to database-confirmed Super Admins.

**Why:** A Client screenshot/reference/success redirect does not prove that OnSpot received the correct amount. Broad administrative or development-auth privileges must not bypass financial authorization.

**How to apply:** Require independently checked amount, currency, recipient and settlement reference plus an affirmative verification attestation. Keep Client billing/internal verification details out of Talent responses, and do not expose real Talent names through a financial endpoint that bypasses existing name-reveal rules. Record historical unknown-payment offers as review exceptions, never as paid evidence.

Missing job billing classification requires an explicit authorized choice, not
an inferred default or a bulk backfill. Repair the original job through the
normal ownership and approval workflow while preserving historical financial
snapshots and applicant relationships.

**Why:** The owner explicitly prohibited choosing Lite/Standard or
Tracked/Guaranteed merely to unblock Ready for Offer, and prohibited silently
changing issued invoices or contracts.

**How to apply:** Explain which choice is missing and provide the existing owned
job editor only when permitted. Do not bypass normal job re-review, independent
settlement verification, or offer eligibility after correcting classification.

Deposit deferral permits agreement preparation/signing, **not activation**.
Keep its invoice open and require held funds before Hired/Active. An approved
deposit waiver is a different explicit arrangement: it may satisfy activation
but never represents cash, independent Wise verification or payout coverage.
Historical pre-offer debt and deposit arrangements must remain separate scopes.

**Why:** The owner explicitly distinguished deferred debt from a true deposit
waiver and prohibited invented funds or signatures when unblocking onboarding.

**How to apply:** A Super Admin may attest a truthful external receipt through
the canonical settlement path, or record an actual offline signed MSA against
the approved version. No-money positive settlement UAT belongs in isolated
staging, never a false receipt in the live financial ledger. Keep the service
activation rules and the database's executed-contract immutability exception
consistent; otherwise a permitted waiver/offline signature can still roll back
when activation writes its first timestamp.
