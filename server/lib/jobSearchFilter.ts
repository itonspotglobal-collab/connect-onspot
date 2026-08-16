/**
 * jobSearchFilter.ts
 *
 * In-process text filter applied to job search results in MemStorage.
 *
 * Extracted from MemStorage.searchJobsWithSkills so the regression test in
 * server/tests/confidential-search.test.ts can import the real production function
 * rather than maintaining a verbatim copy with a "keep this in sync" comment.
 *
 * SECURITY NOTE: The company-name guard (last condition) must NEVER be removed.
 * It prevents leaking a real employer's identity when a candidate searches by
 * company name on a job marked isCompanyConfidential. Any future change to this
 * filter logic (e.g. moving to raw SQL or a full-text index) must preserve that
 * guard and add a corresponding integration test.
 *
 * See server/tests/confidential-search.test.ts for the regression test that
 * verifies this behaviour.
 */
export interface FilterableJob {
  title: string;
  description: string;
  category: string;
  company: string | null;
  isCompanyConfidential: boolean;
}

export function applySearchFilter<T extends FilterableJob>(jobs: T[], q: string): T[] {
  const query = q.toLowerCase();
  return jobs.filter(j =>
    j.title.toLowerCase().includes(query) ||
    j.description.toLowerCase().includes(query) ||
    j.category.toLowerCase().includes(query) ||
    // SECURITY: Do NOT match company name for confidential jobs — prevents leaking the
    // real employer identity when a candidate searches by company name.
    // Any future change to this search block (e.g. raw SQL / full-text index) MUST
    // preserve this guard. See server/tests/confidential-search.test.ts.
    (!j.isCompanyConfidential && j.company != null && j.company.toLowerCase().includes(query))
  );
}
