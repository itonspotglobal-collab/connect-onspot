import type { Express, Request, Response } from "express";
import { SignupError, SignupVerificationService } from "../services/signupVerificationService";
import { signupErrorDiagnostic } from "../lib/signupErrorDiagnostic";

export const PENDING_SIGNUP_COOKIE = "onspot_pending_signup";
export function pendingSignupCapability(req: Request): string {
  return req.headers.cookie?.split(";").map(s => s.trim())
    .find(s => s.startsWith(`${PENDING_SIGNUP_COOKIE}=`))?.slice(PENDING_SIGNUP_COOKIE.length + 1) ?? "";
}
export function setPendingSignupCapability(res: Response, capability: string) {
  res.cookie(PENDING_SIGNUP_COOKIE, capability, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 86_400_000,
  });
}
export function signupMutationAllowed(req: Request) {
  if (req.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.get("origin");
  return !origin || origin === `${req.protocol}://${req.get("host")}`;
}
export function createSignupVerificationHandlers(service: SignupVerificationService) {
  const handle = (fn: (req: Request, res: Response) => Promise<unknown>, mutation = true) =>
    async (req: Request, res: Response) => {
      res.set("Cache-Control", "no-store");
      try {
        if (mutation && !signupMutationAllowed(req)) throw new SignupError(403, "ORIGIN_REJECTED", "Use the signup page on this site.");
        await fn(req, res);
      } catch (error) {
        if (error instanceof SignupError) {
          if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
          res.status(error.status).json({ success: false, error: error.code, message: error.message,
            ...(error.retryAfter && { retryAfter: error.retryAfter }) });
        } else {
          // Never log request bodies, raw SQL errors/parameters, password or OTP.
          console.error("[signup-verification] VERIFICATION_UNAVAILABLE", signupErrorDiagnostic(error));
          res.status(503).json({ success: false, error: "VERIFICATION_UNAVAILABLE", message: "Signup is temporarily unavailable. Please try again." });
        }
      }
    };
  const challengeBody = (req: Request, withCode = false) => {
    const keys = Object.keys(req.body ?? {});
    if (keys.some(k => !["challengeId", ...(withCode ? ["code"] : [])].includes(k))
      || typeof req.body?.challengeId !== "string" || (withCode && typeof req.body.code !== "string")) {
      throw new SignupError(400, "INVALID_REQUEST", "Invalid verification request.");
    }
    return req.body as { challengeId: string; code: string };
  };
  return {
    start: handle(async (req, res) => {
      const result = await service.start(req.body, req.ip ?? "unknown", pendingSignupCapability(req));
      if (result.capability) setPendingSignupCapability(res, result.capability);
      else res.clearCookie(PENDING_SIGNUP_COOKIE, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
      res.status(result.status).json(result.body);
    }),
    claim: handle(async (req, res) => {
      // Candidate IDs are deliberately not used as ownership/linking evidence.
      // Activation resolves the candidate by verified email under a row lock.
      const email = req.body?.email;
      const password = req.body?.password ?? req.body?.newPassword;
      if (Object.keys(req.body ?? {}).some(k => !["email", "password", "newPassword", "candidateId"].includes(k))) {
        throw new SignupError(400, "INVALID_REQUEST", "Invalid account claim.");
      }
      const result = await service.start({
        email, password, role: "talent", first_name: "Talent", last_name: "Member",
      }, req.ip ?? "unknown", pendingSignupCapability(req), { purpose: "talent_claim" });
      setPendingSignupCapability(res, result.capability);
      res.status(result.status).json(result.body);
    }),
    verify: handle(async (req, res) => {
      const input = challengeBody(req, true);
      const body = await service.verify(pendingSignupCapability(req), input.challengeId, input.code, req.ip ?? "unknown");
      res.clearCookie(PENDING_SIGNUP_COOKIE, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
      res.status(201).json(body);
    }),
    resend: handle(async (req, res) => {
      const input = challengeBody(req);
      const result = await service.resend(pendingSignupCapability(req), input.challengeId, req.ip ?? "unknown");
      res.status(result.status).json(result.body);
    }),
    cancel: handle(async (req, res) => {
      const input = challengeBody(req);
      await service.cancel(pendingSignupCapability(req), input.challengeId);
      res.clearCookie(PENDING_SIGNUP_COOKIE, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
      res.json({ success: true });
    }),
    status: handle(async (req, res) => {
      const capability = pendingSignupCapability(req);
      if (!capability) throw new SignupError(404, "NO_PENDING_SIGNUP", "No pending signup was found.");
      res.json(await service.status(capability));
    }, false),
  };
}
export function registerSignupVerificationRoutes(app: Express, service: SignupVerificationService) {
  const handlers = createSignupVerificationHandlers(service);
  app.post("/api/signup", handlers.start);
  // No verified legacy endpoint consumers were found; keep compatibility
  // through the SAME service rather than removing or retaining a bypass.
  app.post("/signup", handlers.start);
  app.get("/api/signup/status", handlers.status);
  app.post("/api/signup/verify", handlers.verify);
  app.post("/api/signup/resend", handlers.resend);
  app.post("/api/signup/cancel", handlers.cancel);
  app.post("/api/talent-auth/set-password", handlers.claim);
  app.post("/api/candidates/setup-password", handlers.claim);
  return handlers;
}