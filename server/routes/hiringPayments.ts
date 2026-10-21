import type { Express, Request, Response, RequestHandler } from "express";
import { HiringPaymentService, HiringPaymentError, PAYMENT_REQUIRED_MESSAGE } from "../services/hiringPaymentService";
import { z } from "zod";

export function hiringPaymentFailure(res: Response, error: any): boolean {
  if (error instanceof HiringPaymentError) {
    res.status(error.status).json({ error: error.code, code: error.code, message: error.message,
      ...(error.details ? { details: error.details } : {}) }); return true;
  }
  if (error?.code === "P0001" && String(error.message).includes("PRE_OFFER_PAYMENT_REQUIRED")) {
    res.status(409).json({ error: "PRE_OFFER_PAYMENT_REQUIRED", code: "PRE_OFFER_PAYMENT_REQUIRED", message: PAYMENT_REQUIRED_MESSAGE }); return true;
  }
  if (error?.code === "23505" && error?.constraint === "hiring_pre_offer_unique_settlement") {
    res.status(409).json({ error: "SETTLEMENT_ALREADY_USED", code: "SETTLEMENT_ALREADY_USED",
      message: "That settled transaction reference already verifies another hiring invoice. Review the payment allocation." });
    return true;
  }
  return false;
}
export function registerHiringPaymentRoutes(app: Express, deps: {
  service: HiringPaymentService; authenticate: RequestHandler; limiter: RequestHandler;
}) {
  const { service, authenticate, limiter } = deps;
  const handle = (fn: (req: Request) => Promise<unknown>): RequestHandler => async (req,res) => {
    try { res.json(await fn(req)); }
    catch (error) {
      if (hiringPaymentFailure(res,error)) return;
      if (error instanceof z.ZodError || (error as any)?.code === "22P02") {
        res.status(400).json({ error: "INVALID_REQUEST", message: "Invalid invoice or application identifier." }); return;
      }
      console.error("Hiring payment request failed", { code: (error as any)?.code });
      res.status(500).json({ error: "HIRING_PAYMENT_FAILED", message: "Unable to process this hiring payment request." });
    }
  };
  const actor = (r: Request) => (r as any).user?.id as string;
  const uuid = (value: unknown) => z.string().uuid().parse(value);
  const filters = (req: Request) => Object.fromEntries(
    ["submissionId","status","clientId","talentId","jobId"].flatMap(key =>
      typeof req.query[key] === "string" ? [[key,String(req.query[key]).slice(0,150)]] : []));
  app.get("/api/client/hiring-invoices",authenticate,handle(r => service.list(actor(r),false,filters(r))));
  app.get("/api/client/hiring-invoices/:id",authenticate,handle(r => service.detail(actor(r),uuid(r.params.id),false)));
  app.post("/api/client/hiring-invoices/ready",authenticate,limiter,handle(r => service.ready(actor(r),z.string().min(1).max(150).parse(r.body?.submissionId))));
  app.post("/api/client/hiring-invoices/:id/reference",authenticate,limiter,handle(r => service.reference(actor(r),uuid(r.params.id),r.body?.reference)));
  app.get("/api/admin/hiring-invoices",authenticate,handle(r => service.list(actor(r),true,filters(r))));
  app.get("/api/admin/hiring-invoices/policy",authenticate,handle(r => service.policy(actor(r))));
  app.post("/api/admin/hiring-invoices/policy",authenticate,limiter,handle(r => service.configure(actor(r),r.body)));
  app.get("/api/admin/hiring-invoices/exceptions",authenticate,handle(r => service.exceptions(actor(r))));
  app.get("/api/admin/hiring-invoices/:id",authenticate,handle(r => service.detail(actor(r),uuid(r.params.id),true)));
  app.post("/api/admin/hiring-invoices/:id/review",authenticate,limiter,handle(r => service.review(actor(r),uuid(r.params.id),r.body)));
}
