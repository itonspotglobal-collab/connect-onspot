import { randomUUID } from "node:crypto";
import { PDFDocument, PDFDict, PDFName } from "pdf-lib";
import { ObjectStorageService, objectStorageClient } from "../objectStorage";

export const WISE_FILE_LIMIT = 8 * 1024 * 1024;
export async function inspectWiseFile(buffer: Buffer, qr = false): Promise<string> {
  if (!buffer.length || buffer.length > WISE_FILE_LIMIT) throw new Error("Receipt must be between 1 byte and 8 MiB.");
  // Content signatures, not filename/header claims. No SVG/HTML/executable uploads.
  let type = "";
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
      buffer.length >= 33 && buffer.toString("ascii",12,16)==="IHDR" &&
      buffer.readUInt32BE(16)>0 && buffer.readUInt32BE(20)>0 &&
      buffer.subarray(-8,-4).toString("ascii")==="IEND") type = "image/png";
  else if (buffer.length>4 && buffer[0]===255 && buffer[1]===216 && buffer[2]===255 &&
      buffer[buffer.length-2]===255 && buffer[buffer.length-1]===217) type="image/jpeg";
  else if (buffer.length>=20 && buffer.toString("ascii",0,4)==="RIFF" &&
      buffer.toString("ascii",8,12)==="WEBP" && buffer.readUInt32LE(4)+8===buffer.length &&
      ["VP8 ","VP8L","VP8X"].includes(buffer.toString("ascii",12,16))) type="image/webp";
  else if (!qr && buffer.toString("ascii",0,5)==="%PDF-") {
    try {
      const doc = await PDFDocument.load(buffer);
      // Active PDFs are not accepted as financial evidence.
      const activeKeys=["JavaScript","JS","Launch","EmbeddedFile","RichMedia","OpenAction","AA","AcroForm"];
      const activeObjects=doc.context.enumerateIndirectObjects().some(([,obj])=>
        obj instanceof PDFDict && activeKeys.some(key=>obj.has(PDFName.of(key))));
      if (!doc.getPageCount() || activeObjects || /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction)\b/.test(buffer.toString("latin1"))) {
        throw new Error("Active PDF");
      }
      type="application/pdf";
    } catch { throw new Error("Upload a valid, non-encrypted PDF without active content."); }
  }
  if (!type) throw new Error("Upload a valid PNG, JPEG, WebP image or PDF receipt.");
  return type;
}

// Keys are generated here and are never returned as generic /objects URLs.
export function wisePrivateFile(key?: string) {
  const root = new ObjectStorageService().getPrivateObjectDir().replace(/\/+$/, "");
  const parts = root.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("Private receipt storage is not configured.");
  const objectKey = key ?? `${root}/manual-wise/${randomUUID()}`;
  if (!objectKey.startsWith(`${root}/manual-wise/`) ||
      !/^[a-f0-9-]{36}$/.test(objectKey.slice(`${root}/manual-wise/`.length))) {
    throw new Error("Invalid private receipt identifier.");
  }
  return { key: objectKey, file: objectStorageClient.bucket(parts[0]).file(objectKey.split("/").filter(Boolean).slice(1).join("/")) };
}
