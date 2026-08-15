/**
 * profilePreferencesUpdate.ts
 *
 * Pure helper: given the fields from a PUT /api/profiles/me request body,
 * produce the JSONB object that should be merged into candidates.preferences.
 *
 * Extracted so it can be unit-tested without a live DB.
 */

export interface ProfileRateFields {
  hourlyRate?: string | number | null;
  rateEngagementType?: string | null;
  rateCurrency?: string | null;
}

/**
 * Build the partial preferences object to merge into candidates.preferences.
 * Returns null when there is nothing to write (all fields empty/null).
 */
export function buildPreferencesUpdate(
  fields: ProfileRateFields,
): Record<string, string> | null {
  const updates: Record<string, string> = {};

  if (fields.hourlyRate != null && fields.hourlyRate !== "") {
    updates.rateAmount = String(fields.hourlyRate);
  }
  if (fields.rateEngagementType) {
    updates.rateEngagementType = String(fields.rateEngagementType);
  }
  if (fields.rateCurrency) {
    updates.rateCurrency = String(fields.rateCurrency);
  }

  return Object.keys(updates).length > 0 ? updates : null;
}
