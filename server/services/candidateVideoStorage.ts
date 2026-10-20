import { randomUUID } from "node:crypto";
import { ObjectStorageService, objectStorageClient, signObjectURL } from "../objectStorage";
import { setObjectAclPolicy } from "../objectAcl";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

export async function saveCandidateVideoFromFile(path: string, type: string, filename: string) {
  const root = new ObjectStorageService().getPrivateObjectDir().replace(/\/+$/, "");
  const id = randomUUID();
  const [bucket, ...name] = `${root}/candidate-videos/${id}`.split("/").filter(Boolean);
  const target = objectStorageClient.bucket(bucket).file(name.join("/"));
  try {
    await pipeline(createReadStream(path), target.createWriteStream({
      resumable: true, metadata: { contentType: type, metadata: { originalName: filename } },
    }));
    await setObjectAclPolicy(target, { visibility: "private" });
    return `/objects/candidate-videos/${id}`;
  } catch (error) {
    await target.delete({ ignoreNotFound: true }).catch(() => {});
    throw error;
  }
}

/** Signed PUTs target quarantine only. A generation-pinned copy seals the final video. */
export function candidateVideoStorage(namespace: "candidate-videos" | "application-videos" = "candidate-videos") {
  function file(uploadId: string, pending = false, generation?: string) {
    const root = new ObjectStorageService().getPrivateObjectDir().replace(/\/+$/, "");
    const full = `${root}/${namespace}/${pending ? "_pending/" : ""}${uploadId}`;
    const [bucket, ...name] = full.split("/").filter(Boolean);
    return objectStorageClient.bucket(bucket).file(name.join("/"), generation ? { generation } : undefined);
  }
  return {
    async pruneExpired() {
      const root = new ObjectStorageService().getPrivateObjectDir().replace(/\/+$/, "");
      const [bucket, ...prefix] = `${root}/${namespace}/_pending/`.split("/").filter(Boolean);
      // Bounded maintenance of abandoned quarantine objects. Only this private
      // upload prefix is eligible; never touch final or historical profile media.
      const [objects] = await objectStorageClient.bucket(bucket).getFiles({
        prefix: `${prefix.join("/")}/`, maxResults: 100, autoPaginate: false,
      });
      for (const object of objects) {
        const created = new Date(object.metadata.timeCreated || "").getTime();
        if (Number.isFinite(created) && created < Date.now() - 60 * 60 * 1000) {
          await object.delete({ ignoreNotFound: true });
        }
      }
    },
    async initiate() {
      const uploadId = randomUUID();
      const target = file(uploadId, true);
      const uploadUrl = await signObjectURL({
        bucketName: target.bucket.name, objectName: target.name, method: "PUT", ttlSec: 900,
      });
      return { uploadId, uploadUrl };
    },
    async inspect(uploadId: string) {
      const [metadata] = await file(uploadId, true).getMetadata();
      const generation = String(metadata.generation);
      const source = file(uploadId, true, generation);
      const [head] = await source.download({ start: 0, end: 63, validation: false });
      return { size: Number(metadata.size), type: metadata.contentType || "", generation, head };
    },
    async publish(uploadId: string, generation: string, type: string, filename: string) {
      const target = file(uploadId);
      await file(uploadId, true, generation).copy(target, {
        preconditionOpts: { ifGenerationMatch: 0 },
      });
      try {
        await target.setMetadata({ contentType: type, metadata: { originalName: filename } });
        await setObjectAclPolicy(target, { visibility: "private" });
      } catch (error) {
        await target.delete({ ignoreNotFound: true }).catch(() => {});
        throw error;
      }
      return `/objects/${namespace}/${uploadId}`;
    },
    async discard(uploadId: string, published = false) {
      await file(uploadId, !published).delete({ ignoreNotFound: true });
    },
  };
}

export type CandidateVideoStorage = Omit<ReturnType<typeof candidateVideoStorage>, "pruneExpired"> &
  Partial<Pick<ReturnType<typeof candidateVideoStorage>, "pruneExpired">>;
