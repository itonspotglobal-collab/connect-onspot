export const MAX_CANDIDATE_VIDEO_BYTES = 200 * 1024 * 1024;
export const VIDEO_TOO_LARGE = "Your video exceeds the 200 MB limit. Please upload a smaller video.";
export const CANDIDATE_VIDEO_MIMES = [
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/mpeg",
] as const;

export function candidateVideoError(size: number, type: string): string | null {
  if (!Number.isSafeInteger(size) || size < 1) return "Please select a non-empty video.";
  if (size > MAX_CANDIDATE_VIDEO_BYTES) return VIDEO_TOO_LARGE;
  if (!(CANDIDATE_VIDEO_MIMES as readonly string[]).includes(type)) {
    return "Please upload an MP4, WebM, MOV, AVI or MPEG video.";
  }
  return null;
}
