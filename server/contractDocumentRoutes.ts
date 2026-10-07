import { Router, type RequestHandler } from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { query } from "./db";
import { ContractError } from "./services/hiringContractService";
import * as contracts from "./services/contractDocumentService";
import { deliverContractEmails } from "./services/contractDeliveryService";
import { MAX_CONTRACT_PDF_BYTES } from "./services/contractBlobStore";

export function contractDocumentRouter(authenticate: RequestHandler, limiter: RequestHandler) {
  const router = Router();
  router.use(authenticate);
  router.use(async (req: any, res, next) => {
    try {
      let userId = req.user?.id;
      if (req.talentAuth?.candidateId) {
        const result = await query(`SELECT COALESCE(c.user_id,u.id) AS user_id FROM candidates c
          LEFT JOIN users u ON lower(u.email)=lower(c.email) AND u.role='talent' WHERE c.id=$1
          AND EXISTS(SELECT 1 FROM users linked WHERE linked.id=COALESCE(c.user_id,u.id) AND linked.role='talent')`, [req.talentAuth.candidateId]);
        userId = result.rows[0]?.user_id;
      }
      if (!userId) return res.status(401).json({ error: "Authentication required" });
      req.contractActor = { id: userId };
      next();
    } catch { res.status(401).json({ error: "Authentication required" }); }
  });
  // Resolve/authorize identifiers before accepting any multipart bytes.
  router.param("id", (req, res, next, id) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      res.status(404).json({ error: "Contract not found" }); return;
    }
    next();
  });
  function handle(fn: (req: any, res: any) => Promise<any>): RequestHandler {
    return (req, res, next) => { Promise.resolve(fn(req, res)).catch(next); };
  }
  const assertOffer: RequestHandler = (req, res, next) => {
    const id = req.body?.offerId ?? req.query.offerId;
    if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      res.status(400).json({ error: "Valid offerId required" }); return;
    }
    next();
  };
  router.get("/", handle(async (req, res) => res.json(await contracts.listContracts(req.contractActor))));
  router.get("/accepted-offers", handle(async (req, res) => res.json(await contracts.acceptedContractOffers(req.contractActor))));
  router.get("/context", assertOffer, handle(async (req, res) => res.json(await contracts.contractOfferContext(req.query.offerId, req.contractActor))));
  router.post("/", limiter, assertOffer, handle(async (req, res) => res.status(201).json(await contracts.prepareContract(req.contractActor, req.body))));
  router.get("/:id", handle(async (req, res) => res.json(await contracts.contractDetail(req.params.id, req.contractActor))));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_CONTRACT_PDF_BYTES, files: 1, fields: 0 } }).single("file");
  router.delete("/:id/document",limiter,handle(async(req,res)=>res.json(await contracts.removePrimaryDraftPdf(req.params.id,req.contractActor))));
  router.put("/:id/attachments", limiter, handle(async (req,res)=>{
    const detail=await contracts.contractDetail(req.params.id,req.contractActor);
    if(!detail.permissions.canPrepare) throw new ContractError(409,{error:"package_immutable"});
    await new Promise<void>((resolve,reject)=>upload(req,res,error=>error?reject(error):resolve()));
    res.status(201).json(await contracts.uploadContractAttachment(req.params.id,req.contractActor,req.file));
  }));
  router.delete("/:id/attachments/:attachmentId",limiter,handle(async(req,res)=>{
    res.json(await contracts.removeContractAttachment(req.params.id,req.params.attachmentId,req.contractActor));
  }));
  router.get("/:id/attachments/:attachmentId/pdf",handle(async(req,res)=>{
    const pdf=await contracts.readContractAttachment(req.params.id,req.params.attachmentId,req.contractActor);
    res.set({"Content-Type":"application/pdf","Content-Length":String(pdf.bytes.length),
      "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
      "Content-Disposition":`inline; filename="${pdf.filename}"`});
    res.send(pdf.bytes);
  }));
  router.put("/:id/document", limiter,
    handle(async (req, res) => {
      const detail = await contracts.contractDetail(req.params.id, req.contractActor);
      if (!detail.permissions.canPrepare) throw new ContractError(409, { error: "draft_document_required" });
      await new Promise<void>((resolve, reject) => upload(req, res, error => error ? reject(error) : resolve()));
      res.json(await contracts.uploadContractPdf(req.params.id, req.contractActor, req.file));
    }));
  router.get("/:id/pdf", handle(async (req, res) => {
    const pdf = await contracts.contractPdf(req.params.id, req.contractActor, req.query.executed === "true");
    res.set({ "Content-Type": "application/pdf", "Content-Length": String(pdf.bytes.length),
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${pdf.filename.replace(/["\\\r\n]/g, "_")}"` });
    res.end(pdf.bytes);
  }));
  router.post("/:id/send", limiter, handle(async (req, res) => {
    const contract = await contracts.sendContract(req.params.id, req.contractActor);
    const email = await deliverContractEmails(req.params.id).catch(() => ({ status: "failed" }));
    res.json({ contract, email });
  }));
  router.post("/:id/resend-emails", limiter, handle(async (req, res) => {
    const detail = await contracts.contractDetail(req.params.id, req.contractActor);
    if (!detail.permissions.canManage) throw new ContractError(403, { error: "contract_manager_required" });
    const email = await deliverContractEmails(req.params.id).catch(() => ({ status: "failed" }));
    res.json({ email });
  }));
  router.post("/:id/sign", limiter, handle(async (req, res) => {
    const signed = await contracts.signContractPdf(req.params.id, req.contractActor, req.body, {
      ip_hash: createHash("sha256").update(req.ip || "").digest("hex"),
      user_agent: String(req.headers["user-agent"] ?? "").slice(0, 200),
    });
    const email = await deliverContractEmails(req.params.id).catch(() => ({ status: "failed" }));
    res.json({ ...signed, email });
  }));
  for (const action of ["void", "decline"] as const) {
    router.post(`/:id/${action}`, limiter, handle(async (req, res) => {
      const closed = await contracts.closeContract(req.params.id, req.contractActor, req.body.reason, action === "decline");
      const email = await deliverContractEmails(req.params.id).catch(() => ({ status: "failed" }));
      res.json({ ...closed, email });
    }));
  }
  router.use((error: any, _req: any, res: any, _next: any) => {
    if (error instanceof ContractError) return res.status(error.status).json(error.body);
    if (error instanceof multer.MulterError) return res.status(400).json({ error: "invalid_pdf_upload", message: "Upload one PDF no larger than 10 MB." });
    console.error("[contract-document] request failed:", error?.name ?? "Error");
    res.status(500).json({ error: "contract_operation_failed", message: "The contract operation failed. No signature success is claimed; please retry." });
  });
  return router;
}
