---
name: USD-only rollout and historical pricing
description: Approved global USD policy, non-retroactive exclusions, and currency audit cautions.
---

New pricing and billing are USD-only for all Talent worldwide. Multi-currency and exchange-rate conversion are explicitly deferred. Do not infer denomination from nationality, location, timezone, or payout region.

**Why:** The user explicitly approved a single-currency rollout, not a conversion project or country-specific pricing policy.

**How to apply:** Validate USD at new financial write boundaries and distinguish defaults for new rows from the actual currency of existing records.

Existing records, including previously approved PHP-priced jobs, are excluded from automatic repricing, currency relabeling, and currency backfills. Any correction of old prices requires a separate explicit decision.

**Why:** The user confirmed that real job prices could exist despite zero numeric budget fields. Some prices were stored as salary text, so checking numeric budgets alone was not proof that historical amounts were absent.

**How to apply:** Audit text pricing as well as numeric amounts. Preserve stored denominations in displays, block incompatible upstream currencies rather than treating their numbers as USD, and flag mixed or unknown summary currencies without conversion or a combined monetary total.