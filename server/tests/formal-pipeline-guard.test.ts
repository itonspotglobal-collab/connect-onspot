/**
 * Static regression checks for the formal pipeline boundary.
 *
 * The non-pipeline shortlist exclusion is intentionally a shared SQL fragment.
 * Keep the literal in the guard so a new route cannot silently drift back to
 * hand-written SQL with a different filter.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const allowedPredicateFile = path.join("server", "services", "formalPipelineGuard.ts");

// Build the matcher from pieces so this test does not become an additional
// occurrence of the raw predicate it is protecting.
const workflowColumn = ["workflow", "type"].join("_");
const shortlistWorkflowType = ["client", "shortlist"].join("_");
const shortlistExclusionPattern = new RegExp(
  `(?:\\b[A-Za-z_$][\\w$]*\\s*\\.\\s*)?\\b${workflowColumn}\\b\\s*(?:<>|!=)\\s*'${shortlistWorkflowType}'`,
  "g",
);

function findShortlistExclusions(source: string): string[] {
  return [...source.matchAll(shortlistExclusionPattern)].map(([match]) => match);
}

function trackedSourceFiles(): string[] {
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--", "*.ts", "*.tsx", "*.js", "*.jsx", "*.mjs", "*.cjs", "*.py"],
    { cwd: projectRoot },
  );

  return output
    .toString()
    .split("\0")
    .filter(Boolean);
}

describe("formal pipeline shortlist exclusion boundary", () => {
  it("recognizes aliased and differently formatted shortlist exclusions", () => {
    const cases = [
      `${workflowColumn}!='${shortlistWorkflowType}'`,
      `${workflowColumn}  !=  '${shortlistWorkflowType}'`,
      `js . ${workflowColumn}\n<>\n'${shortlistWorkflowType}'`,
    ];

    for (const source of cases) {
      assert.equal(findShortlistExclusions(source).length, 1, `failed to recognize: ${source}`);
    }
  });

  it("keeps the shortlist exclusion predicate literal exclusively in the shared guard", () => {
    const occurrences = trackedSourceFiles().flatMap((relativePath) => {
      const content = readFileSync(path.join(projectRoot, relativePath), "utf8");
      return findShortlistExclusions(content).map(() => relativePath);
    });

    assert.deepEqual(
      occurrences,
      [allowedPredicateFile],
      "the raw shortlist exclusion predicate must remain exclusively in formalPipelineGuard.ts",
    );
  });
});
