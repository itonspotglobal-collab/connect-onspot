import { z } from "zod";

export const addressColumns = {
  addressLine1: "address_line1", addressLine2: "address_line2", city: "city",
  stateRegion: "state_region", postalCode: "postal_code", country: "country",
} as const;
export const businessPartyColumns = {
  legalEntityName: "legal_entity_name", entityType: "entity_type", ...addressColumns,
  signatoryName: "signatory_name", signatoryTitle: "signatory_title",
} as const;
export const talentPartyColumns = {
  legalFullName: "legal_full_name", ...addressColumns, taxIdLast4: "tax_id_last4",
} as const;
const nullableText = z.string().trim().max(300).nullable().optional()
  .transform(value => value === "" ? null : value);
const addressShape = {
  addressLine1: nullableText, addressLine2: nullableText, city: nullableText,
  stateRegion: nullableText, postalCode: nullableText, country: nullableText,
};
export const businessPartyShape = {
  legalEntityName: nullableText, entityType: nullableText, ...addressShape,
  signatoryName: nullableText, signatoryTitle: nullableText,
};
export const talentPartySchema = z.object({
  legalFullName: nullableText, ...addressShape,
  taxIdLast4: z.string().trim().regex(/^(?:[0-9]{4})?$/, "Enter only the last four digits")
    .nullable().optional().transform(value => value === "" ? null : value),
}).strict();
export const businessPartySchema = z.object(businessPartyShape).strict();

/** Only fixed server-owned identifiers may reach SQL builders. */
export function partyDetailsFromRow(row: Record<string, any>, columns: Record<string, string>) {
  return Object.fromEntries(Object.entries(columns).map(([key, column]) => [key, row[column] ?? null]));
}

/** Private candidate details never belong in generic profile/discovery DTOs. */
export function stripTalentPartyDetails<T extends Record<string, any>>(value: T): T {
  const safe = { ...value };
  for (const [key, column] of Object.entries(talentPartyColumns)) {
    delete safe[key];
    delete safe[column];
  }
  return safe;
}
