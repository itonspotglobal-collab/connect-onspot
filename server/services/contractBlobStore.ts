import { createHash, randomUUID } from "node:crypto";
import { PDFDocument, PDFDict, PDFArray, PDFRawStream, StandardFonts } from "pdf-lib";
import { objectStorageClient, ObjectStorageService } from "../objectStorage";
import { setObjectAclPolicy } from "../objectAcl";
import { ContractError } from "./hiringContractService";

export const CONTRACT_OBJECT_PREFIX = "/objects/hiring-contract-documents/";
export const MAX_CONTRACT_PDF_BYTES = 10 * 1024 * 1024;
export interface ContractBlobProvider {
  save(bytes: Buffer): Promise<string>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
function storageFile(key: string) {
  if (!key.startsWith(CONTRACT_OBJECT_PREFIX) || !/^\/objects\/hiring-contract-documents\/[a-f0-9-]{36}$/.test(key)) {
    throw new ContractError(400, { error: "invalid_contract_object" });
  }
  const full = new ObjectStorageService().getPrivateObjectDir().replace(/\/$/, "") + "/" + key.slice("/objects/".length);
  const [bucket, ...parts] = full.split("/").filter(Boolean);
  return objectStorageClient.bucket(bucket).file(parts.join("/"));
}
export const contractBlobProvider: ContractBlobProvider = {
  async save(bytes) {
    const key = CONTRACT_OBJECT_PREFIX + randomUUID();
    const file = storageFile(key);
    try {
      await file.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: "application/pdf", cacheControl: "private, no-store" } });
      await setObjectAclPolicy(file, { visibility: "private" });
      return key;
    } catch {
      await file.delete({ ignoreNotFound: true }).catch(() => {});
      throw new ContractError(502, { error: "private_upload_failed", message: "The private PDF could not be stored safely." });
    }
  },
  async read(key) { return Buffer.from((await storageFile(key).download())[0]); },
  async remove(key) { await storageFile(key).delete({ ignoreNotFound: true }); },
};
export function pdfHash(bytes: Buffer) { return createHash("sha256").update(bytes).digest("hex"); }
export async function validateContractPdf(file: { buffer: Buffer; mimetype: string; originalname: string }) {
  const bytes = file.buffer;
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_CONTRACT_PDF_BYTES ||
      file.mimetype !== "application/pdf" || !/\.pdf$/i.test(file.originalname) ||
      bytes.subarray(0, 5).toString() !== "%PDF-") {
    throw new ContractError(400, { error: "invalid_pdf", message: "Upload a non-empty PDF, maximum 10 MB, with a .pdf filename." });
  }
  let pdf: PDFDocument;
  try { pdf = await PDFDocument.load(bytes, { updateMetadata: false }); }
  catch { throw new ContractError(400, { error: "invalid_pdf", message: "The PDF must be readable and not password-protected." }); }
  if (!pdf.getPageCount() || pdf.getPageCount() > 300) throw new ContractError(400, { error: "invalid_pdf", message: "The PDF must contain 1–300 pages." });
  const forbidden = new Set(["JavaScript", "JS", "Launch", "EmbeddedFile", "EmbeddedFiles", "OpenAction", "AA", "XFA", "RichMedia", "SubmitForm", "ImportData"]);
  const seen = new Set<object>();
  function inspect(value: any) {
    if (!value || seen.has(value)) return;
    seen.add(value);
    if (value instanceof PDFRawStream) inspect(value.dict);
    if (value instanceof PDFDict) {
      for (const [key, val] of value.entries()) {
        if (forbidden.has(key.decodeText()) || forbidden.has((val as any)?.decodeText?.())) {
          throw new ContractError(400, { error: "unsafe_pdf", message: "Active scripts, embedded files and form actions are not supported." });
        }
        inspect(val);
      }
    } else if (value instanceof PDFArray) value.asArray().forEach(inspect);
  }
  pdf.context.enumerateIndirectObjects().forEach(([, value]) => inspect(value));
  const filename = file.originalname.replace(/\\/g, "/").split("/").pop()!.replace(/[^a-zA-Z0-9 ._-]/g, "_").slice(0, 180) || "contract.pdf";
  return { sha256: pdfHash(bytes), filename, size: bytes.length };
}
/** Preserve original bytes separately; the copy adds a non-provider signature record. */
export async function executedContractPdf(bytes: Buffer, document: any, signatures: any[]) {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  let y = 746;
  function line(text: string, size = 10) {
    // Original PDF and canonical DB retain Unicode names; standard-font audit copy
    // must not fail execution for a non-Latin legal name.
    const printable = text.replace(/[^\x20-\x7e]/g, "?");
    for (let offset = 0; offset < printable.length; offset += 87) {
      page.drawText(printable.slice(offset, offset + 87), { x: 42, y, size, font });
      y -= 17;
    }
  }
  line("OnSpot in-system signature record", 16); y -= 12;
  line(`Document: ${document.id} | Version: ${document.version}`);
  line(`Original SHA-256: ${document.sha256}`);
  line("Original source PDF is retained unchanged."); y -= 12;
  for (const signature of signatures) {
    line(`${signature.signer_role}: ${signature.legal_name}`, 12);
    if (signature.organization_name) line(`On behalf of: ${signature.organization_name}`);
    line(`Authenticated signer: ${signature.signer_user_id}`);
    line(`Signed: ${new Date(signature.signed_at).toISOString()}`);
    line("Method: typed name and explicit consent"); y -= 14;
  }
  line("This is not a qualified external electronic-signature certificate.");
  return Buffer.from(await pdf.save());
}
