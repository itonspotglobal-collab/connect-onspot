import type { Express, RequestHandler } from "express";

// Profile import is unavailable. This is deliberately separate from the
// provider-backed /api/auth/linkedin sign-in routes and never accesses storage.
export const linkedInImportUnavailable: RequestHandler = (_req, res) => {
  res.status(410).json({
    error: "LinkedIn profile import is unavailable. Please edit your profile manually.",
    code: "LINKEDIN_PROFILE_IMPORT_UNAVAILABLE",
  });
};

export function registerDisabledLinkedInImportRoutes(
  app: Pick<Express, "post" | "get">,
): void {
  app.post("/api/linkedin/connect", linkedInImportUnavailable);
  app.post("/api/linkedin/import-profile", linkedInImportUnavailable);
  // Do not report old simulated records as a live provider connection.
  app.get("/api/linkedin/status/:userId", linkedInImportUnavailable);
}