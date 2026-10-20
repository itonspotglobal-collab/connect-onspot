import { candidateVideoError } from "../../../shared/candidateVideo";

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  if (typeof body.error === "string") return new Error(body.error);
  if (response.status === 413) return new Error("The upload service rejected this request. Your video may be within the limit; please retry or contact support.");
  if ([401, 403].includes(response.status)) return new Error("Your session expired or you do not have access to this profile. Please sign in again.");
  return new Error(fallback);
}

export async function uploadCandidateVideo(
  candidateId: string, file: File, authorization: string, onProgress: (percent: number) => void,
) {
  const validation = candidateVideoError(file.size, file.type);
  if (validation) throw new Error(validation);
  const base = `/api/candidates/${encodeURIComponent(candidateId)}/video/uploads`;
  const headers = { Authorization: authorization, "Content-Type": "application/json" };
  const initiation = await fetch(base, { method: "POST", headers,
    body: JSON.stringify({ filename: file.name, size: file.size, type: file.type }) });
  if (!initiation.ok) throw await responseError(initiation, "Could not start video upload. Please try again.");
  const { uploadUrl, uploadToken } = await initiation.json();
  try {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      // Do not send application credentials to the storage host.
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.timeout = 15 * 60 * 1000;
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) onProgress(Math.min(99, Math.round(event.loaded / event.total * 100)));
      };
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(
        xhr.status === 413 ? "Storage rejected the upload. Please retry; your file may still be within the 200 MB limit."
          : "Video storage could not accept the upload. Please retry.",
      ));
      xhr.onerror = () => reject(new Error("Video upload could not reach storage. Check your connection and try again."));
      xhr.ontimeout = () => reject(new Error("Video upload timed out. Please retry on a stable connection."));
      xhr.onabort = () => reject(new Error("Video upload was interrupted. Please try again."));
      xhr.send(file);
    });
    const complete = await fetch(`${base}/complete`, { method: "POST", headers, body: JSON.stringify({ uploadToken }) });
    if (!complete.ok) throw await responseError(complete, "Video uploaded but could not be saved. Please retry.");
    onProgress(100);
    return await complete.json();
  } catch (error) {
    await fetch(`${base}/cancel`, { method: "POST", headers, body: JSON.stringify({ uploadToken }) }).catch(() => {});
    throw error;
  }
}
