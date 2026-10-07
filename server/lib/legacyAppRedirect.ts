import type { Request, Response, NextFunction } from "express";
import { buildAppUrl, getAppBaseUrl } from "./appUrl";

/** This alias is verified on this deployment; marketing hosts are not aliases. */
export function legacyAppRedirect(req: Request, res: Response, next: NextFunction) {
  if (!["GET", "HEAD"].includes(req.method) || req.hostname !== "talent.onspotglobal.com"
    || req.path.startsWith("/api/") || req.path.startsWith("/objects/")) return next();
  try {
    if (new URL(getAppBaseUrl()).hostname === req.hostname) return next();
    return res.redirect(308, buildAppUrl(req.originalUrl));
  } catch {
    // Invalid configuration must not redirect to an untrusted destination.
    return res.status(503).type("text/plain").send("Application URL configuration is unavailable.");
  }
}
