import { describe, expect, it } from "vitest";
import { resolveJobApplicationAction } from "./jobApplication";

describe("resolveJobApplicationAction", () => {
  it("uses the built-in form for client-created jobs when configured as built-in", () => {
    expect(
      resolveJobApplicationAction({
        id: "client-job",
        applicationMethod: "built_in_form",
        applyLink: null,
      }),
    ).toEqual({ kind: "built_in", path: "/jobs/client-job/apply" });
  });

  it("uses the built-in form for legacy jobs with no method", () => {
    expect(
      resolveJobApplicationAction({
        id: "legacy-job",
        applicationMethod: null,
        applyLink: null,
      }),
    ).toEqual({ kind: "built_in", path: "/jobs/legacy-job/apply" });
  });

  it("opens a valid explicitly configured external link", () => {
    expect(
      resolveJobApplicationAction({
        id: "external-job",
        applicationMethod: "external_link",
        applyLink: "https://example.com/apply",
      }),
    ).toEqual({ kind: "external", url: "https://example.com/apply" });
  });

  it("blocks an external job with no valid HTTP application URL", () => {
    expect(
      resolveJobApplicationAction({
        id: "broken-external-job",
        applicationMethod: "external_link",
        applyLink: "javascript:alert(1)",
      }),
    ).toEqual({ kind: "unavailable" });
  });
});