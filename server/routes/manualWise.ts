import type { Express, RequestHandler } from "express";
import multer from "multer";
import type { Readable } from "node:stream";
import { lstat,readFile } from "node:fs/promises";
import path from "node:path";
import { readOfficialWiseQr,officialWiseQr } from "../services/officialWiseQr";
import { z } from "zod";
import { ManualWiseService, WiseError } from "../services/manualWiseService";
import { inspectWiseFile, wisePrivateFile, WISE_FILE_LIMIT } from "../services/manualWiseFiles";

export function registerManualWiseRoutes(app:Express,deps:{
  service:ManualWiseService; authenticate:RequestHandler; limiter:RequestHandler;
  officialQr?:()=>Promise<Buffer>;
  blobs?: {
    save(buffer:Buffer,contentType:string):Promise<string>;
    read(key:string):Readable;
    delete(key:string):Promise<void>;
  };
}) {
  const {service,authenticate,limiter}=deps;
  const blobs=deps.blobs ?? {
    async save(buffer:Buffer,contentType:string) {
      const obj=wisePrivateFile();
      await obj.file.save(buffer,{resumable:false,metadata:{contentType,
        cacheControl:"private,no-store",metadata:{financialEvidence:"true"}}});
      return obj.key;
    },
    read(key:string){return wisePrivateFile(key).file.createReadStream();},
    async delete(key:string){await wisePrivateFile(key).file.delete();},
  };
  const actor=(req:any)=>req.user?.id as string;
  const handle=(fn:(req:any,res:any)=>Promise<unknown>):RequestHandler=>async(req,res)=>{
    res.setHeader("Cache-Control","no-store");
    try {const value=await fn(req,res);if(!res.headersSent)res.json(value);}
    catch(error:any) {
      if(res.headersSent){res.destroy();return;}
      res.removeHeader("Content-Length");
      res.setHeader("Content-Type","application/json");
      if(error instanceof WiseError)res.status(error.status).json({error:error.message});
      else if(error instanceof z.ZodError)res.status(422).json({error:error.issues.map((i:any)=>i.message).join(" ")});
      else if(error.code==="23505")res.status(409).json({error:"This proof or transaction reference is already recorded."});
      else if(error.code==="22P02")res.status(400).json({error:"Invalid payment identifier."});
      else {console.error("Manual Wise request failed",{code:error.code});res.status(503).json({error:"Manual payment service is temporarily unavailable. No settlement was confirmed."});}
    }
  };
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:WISE_FILE_LIMIT,files:1,fields:4}});
  const multipart=(req:any,res:any)=>new Promise<void>((resolve,reject)=>{
    upload.single("receipt")(req,res,error=>{
      if(error)reject(new WiseError(422,"Upload one receipt of no more than 8 MiB."));else resolve();
    });
  });
  async function storeFile(req:any,purpose:"qr"|"receipt") {
    if(!req.file)throw new WiseError(422,"A valid receipt attachment is required.");
    let contentType:string;
    try {contentType=await inspectWiseFile(req.file.buffer,purpose==="qr");}
    catch(e:any){throw new WiseError(422,e.message);}
    const key=await blobs.save(req.file.buffer,contentType);
    try {
      const insert=async(db:Pick<typeof service.pool,"query">)=>{
        const row=(await db.query(`INSERT INTO manual_wise_files(uploaded_by,purpose,object_key,filename,content_type,byte_size)
          VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[actor(req),purpose,key,
          String(req.file.originalname).replace(/[\x00-\x1f/\\]/g,"_").slice(0,180),contentType,req.file.buffer.length])).rows[0];
        if(purpose==="qr")await db.query(`INSERT INTO manual_wise_audit(actor_id,event,details) VALUES($1,'wise_qr_uploaded',$2)`,
          [actor(req),JSON.stringify({fileId:row.id,contentType,bytes:req.file.buffer.length})]);
        return row.id as string;
      };
      return purpose==="qr" ? await service.tx(async db=>{
        await service.actor(db,actor(req),true);
        return insert(db);
      }) : await insert(service.pool);
    } catch(e){await blobs.delete(key).catch(()=>{});throw e;}
  }
  app.get("/api/manual-wise/obligations",authenticate,handle(req=>service.list(actor(req))));
  app.get("/api/manual-wise/obligations/:category/:id",authenticate,handle(req=>
    service.detail(actor(req),service.category(req.params.category),req.params.id)));
  app.post("/api/manual-wise/obligations/:category/:id/proofs",authenticate,limiter,
    // Authorize before accepting any bytes into durable storage.
    handle(async(req,res)=>{
      const o=await service.detail(actor(req),service.category(req.params.category),req.params.id);
      if(!o.payable)throw new WiseError(409,o.blockedReason??"This obligation cannot accept another proof.");
      await multipart(req,res);
      const reference=z.string().trim().min(1).max(500).parse(req.body.reference);
      const fileId=await storeFile(req,"receipt");
      // Unlinked upload metadata is retained for audit; it grants no customer access.
      res.status(201).json(await service.submit(actor(req),service.category(req.params.category),req.params.id,reference,fileId));
    }));
  app.get("/api/manual-wise/files/:id",authenticate,handle(async(req,res)=>{
    const row=await service.fileAccess(actor(req),req.params.id);
    res.set({"Content-Type":row.content_type,"Content-Length":String(row.byte_size),
      "Content-Disposition":`attachment; filename="payment-evidence-${row.id}.${row.content_type==="application/pdf"?"pdf":row.content_type.split("/")[1]}"`,
      "X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"});
    await new Promise<void>((resolve,reject)=>{
      blobs.read(row.object_key).on("error",reject).on("end",resolve).pipe(res);
    });
  }));
  app.get("/api/admin/manual-wise/submissions",authenticate,handle(req=>service.submissions(actor(req),
    Object.fromEntries(Object.entries(req.query).filter(([,v])=>typeof v==="string").map(([k,v])=>[k,String(v).slice(0,500)])))));
  app.post("/api/admin/manual-wise/submissions/:id/review",authenticate,limiter,handle(req=>service.review(actor(req),req.params.id,req.body)));
  app.get("/api/admin/manual-wise/config",authenticate,handle(req=>service.config(actor(req))));
  app.get("/api/admin/manual-wise/config/qr/official",authenticate,handle(async(req,res)=>{
    await service.actor(service.pool as any,actor(req),true);
    const bytes=await (deps.officialQr ?? readOfficialWiseQr)();
    res.setHeader("Content-Type","image/png");
    res.setHeader("Content-Disposition",`inline; filename="${officialWiseQr.filename}"`);
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("Content-Security-Policy","sandbox; default-src 'none'");
    res.send(bytes);
  }));
  app.post("/api/admin/manual-wise/config/qr/official",authenticate,limiter,handle(async(req,res)=>{
    await service.actor(service.pool as any,actor(req),true);
    const bytes=await (deps.officialQr ?? readOfficialWiseQr)();
    req.file={buffer:bytes,originalname:officialWiseQr.filename};
    res.status(201).json({id:await storeFile(req,"qr")});
  }));
  app.get("/api/admin/manual-wise/legacy-inquiries/:id/receipt",authenticate,handle(async(req,res)=>{
    await service.actor(service.pool as any,actor(req),true);
    const row=(await service.pool.query("SELECT payment_proof_url FROM inquiries WHERE id=$1",[req.params.id])).rows[0];
    const url=row?.payment_proof_url;
    if(typeof url!=="string" || !url.startsWith("/payment-proofs/"))throw new WiseError(404,"No local historical receipt is available.");
    const filename=decodeURIComponent(url.slice("/payment-proofs/".length));
    if(!filename || filename!==path.basename(filename) || /[\\/\0]/.test(filename))throw new WiseError(404,"Historical receipt is unavailable.");
    const file=path.resolve("public/payment-proofs",filename);
    const info=await lstat(file).catch(()=>null);
    if(!info?.isFile() || info.isSymbolicLink() || info.size>WISE_FILE_LIMIT)throw new WiseError(404,"Historical receipt requires controlled archival review.");
    const bytes=await readFile(file);
    const contentType=await inspectWiseFile(bytes);
    res.setHeader("Content-Type",contentType);res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("Content-Disposition",'attachment; filename="historical-receipt"');
    res.setHeader("Content-Security-Policy","sandbox; default-src 'none'");
    res.send(bytes);
  }));
  app.post("/api/admin/manual-wise/config",authenticate,limiter,handle(req=>service.configure(actor(req),req.body)));
  app.post("/api/admin/manual-wise/config/:id/activate",authenticate,limiter,handle(req=>
    service.configurations.activate(actor(req),req.params.id,req.body)));
  app.post("/api/admin/manual-wise/config/:id/deactivate",authenticate,limiter,handle(req=>
    service.configurations.deactivate(actor(req),req.params.id,req.body)));
  app.post("/api/admin/manual-wise/config/:id/restore",authenticate,limiter,handle(req=>
    service.configurations.restore(actor(req),req.params.id,req.body)));
  app.post("/api/admin/manual-wise/config/qr",authenticate,limiter,handle(async(req,res)=>{
    await service.actor(service.pool,actor(req),true);
    await multipart(req,res);
    res.status(201).json({id:await storeFile(req,"qr")});
  }));
  app.get("/api/admin/manual-wise/payouts",authenticate,handle(req=>service.list(actor(req),true)));
  app.post("/api/admin/manual-wise/payouts/:id/destination",authenticate,limiter,handle(req=>service.destination(actor(req),req.params.id,req.body)));
  app.post("/api/admin/manual-wise/inquiries/:id/quote",authenticate,limiter,handle(req=>service.quote(actor(req),req.params.id,req.body)));

  // Retire unsafe settlement shortcuts at their original URLs. Old financial history
  // remains intact; all new settlement evidence goes through the transactional service.
  const retired:RequestHandler=(_req,res)=>{res.status(409).json({error:"Use Payment Verifications with a receipt and independent settlement evidence."});};
  for(const path of ["/api/inquiries/:id/paid","/api/inquiries/:id/payment",
    "/api/inquiries/:id/payment/verify","/api/inquiries/:id/payment/reject"]) app.patch(path,authenticate,retired);
  app.post("/api/inquiries/:id/payment-confirmation",authenticate,retired);
  app.post("/api/payments",authenticate,retired);
  app.post("/api/client/hiring-invoices/:id/reference",authenticate,retired);
  app.post("/api/admin/hiring-invoices/:id/review",authenticate,(req,res,next)=>{
    if(["verify","reject"].includes(req.body?.action))return retired(req,res,next);
    next();
  });
  // Nonsettlement lifecycle actions retain their existing handlers and permissions.
  const settlementGuard:RequestHandler=(req,res,next)=>{
    const target=String(req.body?.action??req.body?.status??"").toLowerCase();
    if(["paid","held","cure","disbursed"].includes(target))return retired(req,res,next);
    next();
  };
  for(const path of ["/api/admin/invoices/:id","/api/admin/payouts/:id","/api/admin/security-deposits/:id"])
    app.patch(path,authenticate,settlementGuard);
  const financialAdmin:RequestHandler=async(req,res,next)=>{
    try{await service.actor(service.pool,actor(req),true);next();}
    catch{res.status(403).json({error:"Super Admin financial permission required."});}
  };
  app.post("/api/admin/security-deposits/:id/replenishments",authenticate,financialAdmin,(_req,_res,next)=>next());
  app.post("/api/admin/contracts/:hcId/security-deposit",authenticate,financialAdmin,(_req,_res,next)=>next());
  app.get("/api/inquiries",authenticate,financialAdmin,(_req,_res,next)=>next());
  for(const path of ["/api/inquiries/:id/endorse","/api/inquiries/:id/status","/api/inquiries/:id/notes"])
    app.patch(path,authenticate,financialAdmin,settlementGuard);
  app.patch("/api/inquiries/:id/status",async(req,res,next)=>{
    try{
    if(req.body?.status==="completed") {
      const row=(await service.pool.query("SELECT paid_at,payment_status FROM inquiries WHERE id=$1",[req.params.id])).rows[0];
      if(!row?.paid_at || row.payment_status!=="verified") {
        res.status(409).json({error:"Payment must be independently verified before completing the inquiry."});return;
      }
    }
    if(req.body?.status && !["pending_endorsement","endorsed","rejected","payment_pending","completed"].includes(req.body.status)) {
      res.status(422).json({error:"Invalid inquiry lifecycle status."});return;
    }
    next();
    }catch{res.status(503).json({error:"Inquiry lifecycle is temporarily unavailable; no status was changed."});}
  });
  // Inquiry review/read is now owner-scoped, even before a finalized quote exists.
  app.get("/api/inquiries/:id",authenticate,async(req,res,next)=>{
    try{
      const user=await service.actor(service.pool,actor(req));
      if(user.role==="admin"&&user.admin_sub_role===null)return next();
      const row=(await service.pool.query("SELECT email FROM inquiries WHERE id=$1",[req.params.id])).rows[0];
      if(!row || !user.email_verified_at || String(user.email_verified_email).toLowerCase()!==String(user.email).toLowerCase() ||
        String(row.email).trim().toLowerCase()!==String(user.email).trim().toLowerCase()) {
        res.status(403).json({error:"Sign in with the verified email used for this inquiry."});return;
      }
      next();
    }catch{res.status(403).json({error:"Inquiry access denied."});}
  });
  // Historical files are preserved on disk but no longer publicly downloadable.
  app.use("/payment-proofs",(_req,res)=>{res.status(403).json({error:"Legacy receipts require authorized financial review."});});
}
