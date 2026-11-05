import { describe, expect, it } from "vitest";
import { getJobPriorityScore, sortJobs } from "./jobUtils";

describe("Find Work ordering", () => {
  const jobs = [
    { id: "urgent", urgentlyHiring: true, isFeatured: false, postedAt: "2026-01-01" },
    { id: "featured", urgentlyHiring: false, isFeatured: true, postedAt: "2025-01-01" },
    { id: "new", urgentlyHiring: false, isFeatured: false, postedAt: "2026-03-01", createdAt: "2025-01-01" },
    { id: "fallback", isFeatured: false, postedAt: null, createdAt: "2026-02-01" },
  ];
  it("pins featured only and otherwise uses posted date, falling back to creation date", () => {
    expect(sortJobs(jobs, "recently-posted").map(j => j.id)).toEqual(["featured", "new", "fallback", "urgent"]);
    expect(jobs[0].id).toBe("urgent");
    expect(getJobPriorityScore(jobs[0])).toBe(0);
    expect(getJobPriorityScore(jobs[1])).toBe(1);
    expect(getJobPriorityScore({ isFeatured: true, urgentlyHiring: true })).toBe(1);
  });
  it("uses ID descending to break equal-date ties", () => {
    expect(sortJobs([{ id: "a", createdAt: "2026-01-01" }, { id: "z", createdAt: "2026-01-01" }],
      "recently-posted").map(j => j.id)).toEqual(["z", "a"]);
  });
  it("preserves explicit most-applied, top-remote and urgent filters", () => {
    const explicit = [
      { id: "a", proposalCount: 1, location: "Remote", urgentlyHiring: true },
      { id: "b", proposalCount: 9, location: "Onsite", urgentlyHiring: false },
    ];
    expect(sortJobs(explicit, "most-applied").map(j => j.id)).toEqual(["b", "a"]);
    expect(sortJobs(explicit, "top-remote").map(j => j.id)).toEqual(["a"]);
    expect(sortJobs(explicit, "urgently-hiring").map(j => j.id)).toEqual(["a"]);
  });
});
