/**
 * One-time, offline conversion of locally extracted, hash-verified approved MSA.
 * No DB writes. Never run this against a client-specific executed agreement.
 * Bank-instruction omission was explicitly approved by the owner.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { contractMergeFields } from "../shared/contractTemplates";
const [textPath, pdfPath, outputPath] = process.argv.slice(2);
if (!textPath || !pdfPath || !outputPath) throw new Error("Usage: converter extracted-text source-pdf output-json");
const original = await readFile(textPath, "utf8");
const sourceDocumentSha256 = createHash("sha256").update(await readFile(pdfPath)).digest("hex");
const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
let source = original.split("ACH / CREDIT CARD AUTHORIZATION FORM")[0]
  .replace(/^OnSpot Master Service Agreement\s*[–-]\s*Template\s+\d+\s*$/gm, "")
  .replace(/\f/g, "\n");
source = source.slice(source.indexOf("THIS MASTER SERVICE AGREEMENT"));
source = source.replace(/^\s*MASTER SERVICE AGREEMENT\s*$/gm, "");
// Preserve the existing first payment-remittance sentence; omit ACH auto-debit
// instructions and the wire/bank details, not replace them with invented terms.
source = source.replace(/Payment will be automatically processed[\s\S]*?ACH\/Credit Card Authorization Form\./, "");
source = source.replace(/Via Wire Transfer:[\s\S]*?(?=2\.6 Delayed Fees\.)/, "");
// Appendix B is an unfilled job-description form in the source.
source = source.replace(/The OnSpot _+ is responsible for:[\s\S]*?Duties and Responsibilities:[\s\S]*?(?=IN WITNESS WHEREOF)/,
  "The OnSpot {{job.title}} is responsible for:\n\nDuties and Responsibilities:\n\n{{job.description}}\n\n");
let paragraphs = source.split(/\n\s*\n/).map(p => p.trim().replace(/\s+/g, " ")).filter(Boolean);
paragraphs = paragraphs.map(p => p
  .replace(/Unit No\. 1702, 17th Floor High Street South Corporate Plaza Tower 2, 11th Ave Cor 26th St, Bonifacio Global City, Philippines/g, "{{onspot.address}}")
  .replace(/a Philippine corporation/g, "{{onspot.entityType}}")
  .replace(/OnSpot Technologies Inc\.?/g, "{{onspot.entityName}}")
  .replace(/On Spot Sales Inc\.?/g, "{{onspot.entityName}}")
  .replace(/as of _+/g, "as of {{contract.effectiveDate}}")
  .replace(/This SOW will be effective as of {{contract.effectiveDate}}/g, "This SOW will be effective as of {{offer.startDate}}")
  .replace(/dated _+/g, "dated {{contract.effectiveDate}}")
  .replace(/_+(?= \(the “Client”\)| \(“Client”\))/g, "{{client.legalEntityName}}")
  .replace(/_+(?= and {{onspot.entityName}})/g, "{{client.address}}")
  .replace(/On Behalf of _+/g, "On Behalf of {{client.legalEntityName}}")
  .replace(/within the _+ area/g, "within the {{contract.serviceArea}} area")
  .replace(/shall deploy _+/g, "shall deploy {{contract.numberOfFte}}")
  .replace(/Minimum Hours Required per week: _+/g, "Minimum Hours Required per week: {{contract.minimumWeeklyHours}}")
  .replace(/Cost per FTE: \$_+/g, "Cost per FTE: {{offer.rate}}")
  .replace(/Total Monthly Recurring Charge: \$_+/g, "Total Monthly Recurring Charge: {{contract.monthlyRecurringCost}}")
  .replace(/Security Deposit: \$_+/g, "Security Deposit: {{deposit.amount}}")
);
const summary = [
  ["Contract Type", "Master Service Agreement"],
  ["Parties Involved", "{{client.legalEntityName}} and {{onspot.entityName}}"],
  ["Effective Date", "{{contract.effectiveDate}}"],
  ["Scope of Services", "{{job.title}}"],
  ["Payment Terms", "{{contract.paymentTerms}}"],
  ["Number of FTE", "{{contract.numberOfFte}}"],
  ["Rate in {{offer.currency}}", "{{offer.rate}}"],
  ["Monthly Recurring Cost", "{{contract.monthlyRecurringCost}}"],
  ["Invoicing Day", "{{contract.invoicingDay}}"],
  ["Payment Method", "Stripe"],
  ["Renewal Period", "{{contract.renewalPeriod}}"],
  ["Termination Clause", "{{contract.terminationClause}}"],
];
let body = `<h1>Master Service Agreement</h1><h2>MSA Summary</h2><table><tbody>${summary.map(([label, value]) =>
  `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`).join("")}</tbody></table>`;
let clause = 0;
for (let i = 0; i < paragraphs.length; i++) {
  const paragraph = paragraphs[i];
  if (paragraph.startsWith("On Behalf of")) {
    if (!["Signature:", "Name:", "Title:", "Date:"].every((label, index) => paragraphs[i + index + 1]?.startsWith(label))) {
      throw new Error("Unrecognized source signature block; manual review required");
    }
    body += `<table><tbody><tr><th>On Behalf of {{onspot.entityName}}</th><th>On Behalf of {{client.legalEntityName}}</th></tr>` +
      `<tr><td>Signature: ______________________</td><td>Signature: ______________________</td></tr>` +
      `<tr><td>Name: {{onspot.signatoryName}}</td><td>Name: {{client.signatoryName}}</td></tr>` +
      `<tr><td>Title: {{onspot.signatoryTitle}}</td><td>Title: {{client.signatoryTitle}}</td></tr>` +
      `<tr><td>Date: ______________________</td><td>Date: ______________________</td></tr></tbody></table>`;
    i += 4;
  } else if (/^(?:\d+\. [A-Z]|APPENDIX [AB]$|STATEMENT OF WORK$|ON SPOT STAFF JOB DESCRIPTION$)/.test(paragraph) && paragraph.length < 100) {
    body += `<h2>${esc(paragraph)}</h2>`;
  } else {
    if (/_+/.test(paragraph)) throw new Error(`Unmapped non-signature blank in source paragraph ${i + 1}; manual mapping required`);
    body += `<p data-clause-id="msa-${++clause}">${esc(paragraph)}</p>`;
  }
}
if (/\bACH\b|CREDIT CARD AUTHORIZATION|Via Wire Transfer|Account Number|Routing Number|SWIFT\/BIC/i.test(body)) {
  throw new Error("Financial authorization/instructions remain; source review required");
}
const bankIdentifiers = [...original.matchAll(/(?:Account Number|Routing Number):\s*(\d+)/g)].map(m => m[1]);
if (bankIdentifiers.some(value => body.includes(value))) throw new Error("Source bank identifiers remain");
for (let section = 1; section <= 11; section++) {
  if (!body.includes(`<h2>${section}. `)) throw new Error(`Source section ${section} missing`);
}
if (!body.includes("APPENDIX A") || !body.includes("APPENDIX B")) throw new Error("Source appendix missing");
const keys = [...new Set([...body.matchAll(/{{([^}]+)}}/g)].map(m => m[1]))];
const fields = keys.map(key => {
  const field = contractMergeFields.find(field => field.key === key);
  if (!field) throw new Error("Unregistered template field");
  return field;
});
await mkdir(new URL("../server/seeds/legal/", import.meta.url), { recursive: true });
await writeFile(outputPath, JSON.stringify({
  name: "OnSpot Master Service Agreement (imported draft)",
  version: `approved-source-${sourceDocumentSha256.slice(0, 12)}`,
  sourceDocumentSha256, body, fields,
  exclusions: ["ACH/credit-card authorization page", "ACH auto-debit instructions", "Wire-transfer bank instructions"],
}, null, 2) + "\n");
console.log(`Converted approved source into draft data: ${clause} paragraphs, ${fields.length} fields, sections 1–11 and appendices A/B. No bank instructions or authorization page.`);
