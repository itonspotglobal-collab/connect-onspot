/**
 * candidateMediaAuth.ts
 *
 * Pure helper that validates a Bearer JWT against a candidate profile ID for
 * resume and video upload/delete operations.  Extracted from routes.ts so that
 * the auth logic can be unit-tested without spinning up a full HTTP server.
 *
 * Return value:
 *   { ok: true }  — candidate JWT is valid and owns the profile
 *   { ok: false, status: 401, error }  — missing or invalid token
 *   { ok: false, status: 403, error }  — token valid but not authorised
 *   { ok: false, status: 403, error: "talent-email-check-required", email }
 *       — talent-role JWT supplied; caller must verify email against the DB.
 */

import jwt from "jsonwebtoken";

export type MediaAuthOk = { ok: true };
export type MediaAuthFail =
  | { ok: false; status: 401; error: string }
  | { ok: false; status: 403; error: "You are not authorized to upload to this profile" | "Insufficient permissions" }
  | { ok: false; status: 403; error: "talent-email-check-required"; email: string };

export type MediaAuthResult = MediaAuthOk | MediaAuthFail;

/**
 * Check whether `authHeader` (the raw "Authorization" header value, e.g.
 * "Bearer eyJ…") grants upload/delete access to `candidateId`.
 *
 * Handles:
 *   (a) Candidate JWT  (decoded.type === "candidate")
 *       – Returns { ok: true }  if decoded.candidateId === candidateId
 *       – Returns 403           otherwise
 *   (b) Talent-role JWT  (decoded.role === "talent" && decoded.email)
 *       – Returns { ok: false, status: 403, error: "talent-email-check-required", email }
 *         so the caller can do a DB check without this module needing a DB handle.
 *   (c) Any other JWT / no token
 *       – Returns 401 or 403 as appropriate.
 */
export function checkCandidateMediaAuth(
  authHeader: string | undefined,
  candidateId: string,
  jwtSecret: string,
): MediaAuthResult {
  const token = authHeader?.split(" ")[1];
  if (!token) {
    return { ok: false, status: 401, error: "Authentication required" };
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired token" };
  }

  if (decoded.type === "candidate") {
    if (decoded.candidateId !== candidateId) {
      return { ok: false, status: 403, error: "You are not authorized to upload to this profile" };
    }
    return { ok: true };
  }

  if (decoded.role === "talent" && decoded.email) {
    return { ok: false, status: 403, error: "talent-email-check-required", email: decoded.email };
  }

  return { ok: false, status: 403, error: "Insufficient permissions" };
}
