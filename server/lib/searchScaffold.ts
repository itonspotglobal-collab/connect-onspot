/**
 * searchScaffold.ts
 *
 * Shared utilities for client talent-search scaffold job creation.
 *
 * These are extracted from the POST /api/client/talent-search route handler so
 * the test suite can import the real production functions rather than maintaining
 * verbatim copies with a "keep this in sync" comment.
 */

/**
 * Infers a jobs.category value from free-text search input.
 *
 * jobs.category is NOT NULL in the schema, so every scaffold job INSERT needs a
 * non-empty value. This function uses keyword matching to pick a sensible category;
 * if none match it falls back to "Customer Support" (the catch-all bucket).
 *
 * The production route uses this as:
 *   const resolvedCategory = category?.trim() || inferCategory(title);
 */
export function inferCategory(text: string): string {
  const t = text.toLowerCase();
  const MAP: [string, string][] = [
    ["customer support", "Customer Support"], ["support", "Customer Support"],
    ["inbox", "Virtual Assistants"], ["calendar", "Virtual Assistants"],
    ["virtual assistant", "Virtual Assistants"], ["admin", "Virtual Assistants"],
    ["website", "Developers"], ["developer", "Developers"],
    ["engineer", "Developers"], ["software", "Developers"],
    ["design", "Designers"], ["graphic", "Designers"],
    ["ui", "Designers"], ["ux", "Designers"],
    ["social media", "Marketing Specialists"], ["campaign", "Marketing Specialists"],
    ["marketing", "Marketing Specialists"],
    ["bookkeeping", "Accountants"], ["accounting", "Accountants"],
    ["finance", "Accountants"], ["books", "Accountants"],
    ["patient", "Healthcare Professionals"], ["healthcare", "Healthcare Professionals"],
    ["medical", "Healthcare Professionals"],
    ["sales", "Sales Representatives"], ["outbound", "Sales Representatives"],
    ["leads", "Sales Representatives"],
    ["operations", "Operations Specialists"], ["day-to-day", "Operations Specialists"],
    ["ops", "Operations Specialists"],
    ["it support", "IT & Technical Support"], ["tech support", "IT & Technical Support"],
    ["helpdesk", "IT & Technical Support"],
  ];
  for (const [kw, cat] of MAP) {
    if (t.includes(kw)) return cat;
  }
  return "Customer Support";
}
