import { Router,type RequestHandler } from "express";
import multer from "multer";
import { pool,query } from "../db";
import { ClientMsaService } from "../services/clientMsaService";
import { onboardingStatus } from "../services/contractorOnboardingStatus";
import { OnboardingError } from "../services/contractorOnboardingPolicy";
import { dispatchHiringLifecycleEvents } from "../services/hiringLifecycleDispatch";
import { ContractError } from "../services/hiringContractService";
import { MAX_CONTRACT_PDF_BYTES } from "../services/contractBlobStore";

export function contractorOnboardingRouter(authenticate:RequestHandler,limiter:RequestHandler) {
  const router=Router();
  const msa=new ClientMsaService(pool,undefined,dispatchHiringLifecycleEvents);
  router.use((req,_res,next)=>{
    if(!/^\/api\/(?:contractor-onboarding(?:\/|$)|admin\/(?:contractor-onboarding|msa-documents)(?:\/|$)|client\/(?:msa|pending-deposits)(?:\/|$))/.test(req.path))return next("router");
    next();
  });
  router.use(authenticate);
  router.use(async(req:any,res,next)=>{
    try {
      let id=req.user?.id;
      if(req.talentAuth?.candidateId)id=(await query(`SELECT coalesce(c.user_id,u.id) AS id FROM candidates c
        LEFT JOIN users u ON lower(u.email)=lower(c.email) AND u.role='talent' WHERE c.id=$1
        AND EXISTS(SELECT 1 FROM users linked WHERE linked.id=coalesce(c.user_id,u.id) AND linked.role='talent')`,[req.talentAuth.candidateId])).rows[0]?.id;
      const a=id?(await query("SELECT id,role,admin_sub_role FROM users WHERE id=$1",[id])).rows[0]:null;
      if(!a)return res.status(401).json({error:"Authentication required"});
      req.onboardingActor=a;next();
    } catch {res.status(401).json({error:"Authentication required"});}
  });
  const handle=(fn:(req:any,res:any)=>Promise<any>):RequestHandler=>(req,res,next)=>{Promise.resolve(fn(req,res)).catch(next);};
  router.param("id",(_req,res,next,id)=>{
    if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))return res.status(404).json({error:"MSA_NOT_FOUND"});
    next();
  });
  router.get("/api/contractor-onboarding/:submissionId",handle(async(req,res)=>res.json(await onboardingStatus(pool,req.params.submissionId,req.onboardingActor.id))));
  router.get("/api/client/pending-deposits",handle(async(req,res)=>{
    if(req.onboardingActor.role!=="client")throw new OnboardingError(403,"FORBIDDEN","Client account required.");
    const items=(await query(`SELECT d.id,d.amount,d.currency,j.title AS job_title,
      coalesce(d.submission_id,h.submission_id) AS submission_id FROM security_deposits d
      LEFT JOIN hiring_contracts h ON h.id=d.hiring_contract_id
      JOIN job_submissions js ON js.id=coalesce(d.submission_id,h.submission_id)
      JOIN jobs j ON j.id=js.job_id WHERE js.client_id=$1 AND d.status='pending'
      ORDER BY d.created_at DESC`,[req.onboardingActor.id])).rows;
    res.json(items);
  }));
  router.get("/api/admin/contractor-onboarding",handle(async(req,res)=>{
    if(req.onboardingActor.role!=="admin")throw new OnboardingError(403,"FORBIDDEN","Admin access required.");
    const rows=(await query("SELECT id FROM job_submissions WHERE status IN ('offer_accepted','contract_sent','contract_signed') ORDER BY updated_at DESC LIMIT 200")).rows;
    const items=[];for(const r of rows)items.push(await onboardingStatus(pool,r.id,req.onboardingActor.id));
    const activeMsaExists=(await query("SELECT EXISTS(SELECT 1 FROM msa_documents WHERE active AND effective_at<=now()) AS present")).rows[0].present;
    res.json({items,activeMsaExists,canManageMsa:req.onboardingActor.admin_sub_role===null});
  }));
  router.get("/api/client/msa",handle(async(req,res)=>res.json(await msa.status(req.onboardingActor.id))));
  router.get("/api/client/msa/:id/pdf",handle(async(req,res)=>{
    const pdf=await msa.pdf(req.onboardingActor.id,req.params.id);
    res.set({"Content-Type":"application/pdf","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
      "Content-Security-Policy":"sandbox","Content-Disposition":`inline; filename="msa.pdf"; filename*=UTF-8''${encodeURIComponent(pdf.filename)}`});
    res.end(pdf.bytes);
  }));
  router.post("/api/client/msa/sign",limiter,handle(async(req,res)=>res.json(await msa.sign(req.onboardingActor.id,req.body,
    {ip:req.ip??"",userAgent:req.get("user-agent")??""}))));
  router.get("/api/admin/msa-documents",handle(async(req,res)=>res.json(await msa.list(req.onboardingActor.id))));
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_CONTRACT_PDF_BYTES,files:1,fields:3}}).single("file");
  router.post("/api/admin/msa-documents",limiter,handle(async(req,res)=>{
    // Reject unauthorized multipart uploads before consuming any bytes.
    await msa.list(req.onboardingActor.id);
    await new Promise<void>((resolve,reject)=>upload(req,res,e=>e?reject(e):resolve()));
    res.status(201).json(await msa.upload(req.onboardingActor.id,req.file,req.body.version,req.body.effectiveAt));
  }));
  router.post("/api/admin/msa-documents/:id/activate",limiter,handle(async(req,res)=>res.json(await msa.activate(req.onboardingActor.id,req.params.id,req.body))));
  router.use((error:any,_req:any,res:any,next:any)=>{
    if(error instanceof OnboardingError)return res.status(error.status).json({error:error.code,code:error.code,message:error.message});
    if(error instanceof ContractError)return res.status(error.status).json(error.body);
    if(error?.code==="LIMIT_FILE_SIZE")return res.status(413).json({error:"PDF_TOO_LARGE",message:"Upload a PDF no larger than 10 MB."});
    next(error);
  });
  return router;
}
