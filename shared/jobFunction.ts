export const OTHER_JOB_FUNCTION = "Other";

type JobFunctionFields = {
  jobFunction?: unknown;
  job_function?: unknown;
  otherFunction?: unknown;
  other_function?: unknown;
  category?: unknown;
};

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getJobFunctionDisplay(job: JobFunctionFields): string {
  const selected =
    textValue(job.jobFunction) ||
    textValue(job.job_function) ||
    textValue(job.category);
  const custom =
    textValue(job.otherFunction) ||
    textValue(job.other_function);

  return selected.toLowerCase() === OTHER_JOB_FUNCTION.toLowerCase() && custom
    ? custom
    : selected;
}

export function getJobFunctionSearchValues(job: JobFunctionFields): string[] {
  const values = [
    getJobFunctionDisplay(job),
    textValue(job.jobFunction),
    textValue(job.job_function),
    textValue(job.otherFunction),
    textValue(job.other_function),
    textValue(job.category),
  ].filter(Boolean);

  return Array.from(new Set(values));
}