import { Router, type RequestHandler } from "express";
import type { Pool } from "pg";
import { ZodError } from "zod";
import { ContractTemplateService } from "../services/contractTemplateService";
import { ContractTemplateError } from "../services/contractMergeService";

export function contractTemplatesRouter(db: Pool, authenticate: RequestHandler, limiter: RequestHandler) {
  const router = Router();
  const service = new ContractTemplateService(db);
  router.use(authenticate);
  router.use((req: any, res, next) => {
    if (!req.user?.id) { res.status(403).json({ error: "Only a Super Admin can manage contract templates" }); return; }
    next();
  });
  router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
  router.param("id", (_req, res, next, id) => {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
      res.status(404).json({ error: "Template not found" }); return;
    } next();
  });
  const handle = (fn: (req: any) => Promise<any>): RequestHandler => async (req: any, res) => {
    try { res.json(await fn(req)); }
    catch (error) {
      if (error instanceof ContractTemplateError) return void res.status(error.status).json({ error: error.message, code: error.code });
      if (error instanceof ZodError) return void res.status(422).json({ error: "Check the template fields, version and review details" });
      // Do not send template bodies, account values or DB diagnostics to logs.
      res.status(500).json({ error: "Unable to process contract template" });
    }
  };
  router.get("/", handle(req => service.list(req.user.id)));
  router.get("/:id", handle(req => service.detail(req.user.id, req.params.id)));
  router.post("/", limiter, handle(req => service.create(req.user.id, req.body)));
  router.patch("/:id", limiter, handle(req => service.update(req.user.id, req.params.id, req.body)));
  router.post("/:id/preview", limiter, handle(req => service.preview(req.user.id, req.params.id, req.body)));
  router.post("/:id/activate", limiter, handle(req => service.activate(req.user.id, req.params.id, req.body)));
  return router;
}
