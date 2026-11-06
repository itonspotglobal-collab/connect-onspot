import { z } from "zod";

export const templateKinds = ["msa", "talent_agreement", "sow"] as const;
export const templateKindSchema = z.enum(templateKinds);
export type MergeFieldDefinition = {
  key: string; label: string; source: string; required: boolean; editableBy: "admin" | "preparer" | "none";
};
const field = (key: string, label: string, source: string, required = true,
  editableBy: MergeFieldDefinition["editableBy"] = "preparer"): MergeFieldDefinition =>
  ({ key, label, source, required, editableBy });
export const contractMergeFields: MergeFieldDefinition[] = [
  field("client.legalEntityName", "Client legal entity", "client_profiles.legal_entity_name / organizations.legal_entity_name"),
  field("client.entityType", "Client entity type", "client_profiles.entity_type / organizations.entity_type", false),
  field("client.address", "Client address", "client_profiles.address / organizations.address"),
  field("client.signatoryName", "Client signatory", "client_profiles.signatory_name / organizations.signatory_name"),
  field("client.signatoryTitle", "Client signatory title", "client_profiles.signatory_title / organizations.signatory_title"),
  field("talent.legalFullName", "Talent legal name", "candidates.legal_full_name"),
  field("talent.address", "Talent address", "candidates.address"),
  field("offer.rate", "Agreed rate", "offers.rate", true, "none"),
  field("offer.currency", "Agreed currency", "offers.rate_currency", true, "none"),
  field("offer.engagementType", "Engagement type", "offers.engagement_type", true, "none"),
  field("offer.startDate", "Agreed start date", "offers.proposed_start_date", true, "none"),
  field("job.title", "Job title", "jobs.title", true, "none"),
  field("job.description", "Job description", "jobs.description", true, "none"),
  field("deposit.amount", "Security deposit", "security_deposits.amount", true, "none"),
  field("contract.effectiveDate", "Effective date", "hiring_contracts.effective_start_date", true, "admin"),
  field("onspot.entityName", "OnSpot entity", "hiring_contracts.signing_entity / platform_settings.contract_signing_entity", true, "admin"),
  field("onspot.address", "OnSpot legal address", "platform_settings.contract_signing_address", true, "admin"),
  field("onspot.entityType", "OnSpot entity type", "platform_settings.contract_signing_entity_type", true, "admin"),
  field("contract.paymentTerms", "Payment terms", "manual", true, "admin"),
  field("contract.numberOfFte", "Number of FTE", "manual", true, "admin"),
  field("contract.monthlyRecurringCost", "Monthly recurring cost", "manual", true, "admin"),
  field("contract.invoicingDay", "Invoicing day", "manual", true, "admin"),
  field("contract.renewalPeriod", "Renewal period", "manual", true, "admin"),
  field("contract.terminationClause", "Termination clause", "manual", true, "admin"),
  field("contract.serviceArea", "SOW service area", "manual", true, "admin"),
  field("contract.minimumWeeklyHours", "SOW minimum weekly hours", "manual", true, "admin"),
  field("onspot.signatoryName", "OnSpot signatory name", "manual", true, "admin"),
  field("onspot.signatoryTitle", "OnSpot signatory title", "manual", true, "admin"),
];
export const sampleMergeData: Record<string, string> = Object.fromEntries(contractMergeFields.map(f =>
  [f.key, `Sample ${f.label}`]));
Object.assign(sampleMergeData, {
  "client.legalEntityName": "Example Client LLC", "client.address": "Example client address",
  "client.signatoryName": "Example Client Signer", "client.signatoryTitle": "Authorized representative",
  "talent.legalFullName": "Example Talent", "talent.address": "Example Talent address",
  "offer.rate": "USD 100.00", "offer.currency": "USD", "offer.engagementType": "Standard",
  "offer.startDate": "January 1, 2030", "contract.effectiveDate": "January 1, 2030",
  "deposit.amount": "USD 500.00", "job.title": "Example role", "job.description": "Example role responsibilities.",
  "onspot.entityName": "Example OnSpot entity", "onspot.address": "Example OnSpot address",
});
export const templateFieldSchema = z.object({
  key: z.string().min(1).max(100), label: z.string().trim().min(1).max(160),
  source: z.string().max(160), required: z.boolean(), editableBy: z.enum(["admin", "preparer", "none"]),
}).strict();
export const templateHtmlTags = ["section", "p", "br", "h1", "h2", "h3", "h4", "strong", "b",
  "em", "i", "u", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "blockquote", "span"];
