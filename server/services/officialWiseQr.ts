import { createHash } from "node:crypto";
import { ObjectStorageService } from "../objectStorage";
import { wisePrivateFile } from "./manualWiseFiles";

// User-supplied original, staged privately; NOT an active receiving configuration.
// This identifies an immutable source asset, never a customer's payment destination.
export const officialWiseQr = {
  objectId: "5f3a06ff-87ee-447b-96f5-28353a1cdef7",
  sha256: "d11eb23bb6b58d4f6fb3fe531969dede65ef22086a439e8f0655e7a937d5df6e",
  bytes: 36300,
  filename: "wise-qr-code.png",
} as const;

export async function readOfficialWiseQr(): Promise<Buffer> {
  const root=new ObjectStorageService().getPrivateObjectDir().replace(/\/+$/,"");
  const [bytes]=await wisePrivateFile(`${root}/manual-wise/${officialWiseQr.objectId}`).file.download();
  if(bytes.length!==officialWiseQr.bytes ||
     createHash("sha256").update(bytes).digest("hex")!==officialWiseQr.sha256) {
    throw new Error("Official QR source failed its original-byte integrity check.");
  }
  return bytes;
}
