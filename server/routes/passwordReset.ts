import type { Express, RequestHandler } from "express";
import { PasswordResetError, type PasswordResetService } from "../services/passwordResetService";

export function registerPasswordResetRoutes(app: Express, service: PasswordResetService, limiter: RequestHandler) {
  for (const operation of ["request", "confirm"] as const) {
    app.post(`/api/auth/password-reset/${operation}`, limiter, async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      try {
        return res.json(await service[operation](req.body, req.ip ?? req.socket.remoteAddress ?? "unknown"));
      } catch (error) {
        if (error instanceof PasswordResetError) return res.status(error.status).json({ success: false, message: error.message });
        // Unknown failures must not leak provider, SQL, email or OTP details.
        console.error("[password-reset] REQUEST_FAILED");
        return res.status(503).json({ success: false, message: "Password reset is temporarily unavailable. Please try again." });
      }
    });
  }
}
