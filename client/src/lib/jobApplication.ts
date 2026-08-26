import type { Job } from "@shared/schema";

export type JobApplicationAction =
  | { kind: "built_in"; path: string }
  | { kind: "external"; url: string }
  | { kind: "unavailable" };

function getValidExternalUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * applicationMethod is the only field that selects the application flow.
 * Missing/legacy values use the normal built-in form; malformed external jobs
 * are blocked rather than redirected to a broken URL or silently made internal.
 */
export function resolveJobApplicationAction(
  job: Pick<Job, "id" | "applicationMethod" | "applyLink">,
): JobApplicationAction {
  if (job.applicationMethod !== "external_link") {
    return { kind: "built_in", path: `/jobs/${job.id}/apply` };
  }

  const url = getValidExternalUrl(job.applyLink);
  return url ? { kind: "external", url } : { kind: "unavailable" };
}