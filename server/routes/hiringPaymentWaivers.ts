import type {Express,RequestHandler} from "express";
import {HiringPaymentWaiverService,WaiverError} from "../services/hiringPaymentWaiverService";
import {HiringPaymentService} from "../services/hiringPaymentService";
import {hiringPaymentFailure} from "./hiringPayments";

export function registerHiringPaymentWaiverRoutes(app:Express,d:{
  service:HiringPaymentWaiverService;invoices:HiringPaymentService;
  authenticate:RequestHandler;limiter:RequestHandler;afterCommit:()=>Promise<void>;
}) {
  const handle=(fn:(req:any)=>Promise<any>):RequestHandler=>async(req,res)=>{
    try {res.json(await fn(req));}
    catch(e:any) {
      if(e instanceof WaiverError){res.status(e.status).json({error:e.code,message:e.message});return;}
      if(hiringPaymentFailure(res,e))return;
      console.warn("[hiring-payment-skip] request failed",{code:e?.code});
      res.status(500).json({error:"PAYMENT_SKIP_FAILED",message:"Unable to process payment arrangement."});
    }
  };
  const id=(r:any)=>String(r.params.submissionId).slice(0,150);
  app.get("/api/hiring-payment-waivers/:submissionId",d.authenticate,
    handle(r=>d.service.status(r.user?.id,id(r))));
  app.post("/api/admin/hiring-payment-waivers/:submissionId/grant",d.authenticate,d.limiter,
    handle(r=>d.service.grant(r.user?.id,id(r),r.body)));
  app.post("/api/admin/hiring-payment-waivers/:submissionId/revoke",d.authenticate,d.limiter,
    handle(r=>d.service.revoke(r.user?.id,id(r),r.body)));
  app.post("/api/client/hiring-payment-waivers/:submissionId/request",d.authenticate,d.limiter,
    handle(r=>d.service.request(r.user?.id,id(r),r.body)));
  app.post("/api/admin/hiring-payment-waivers/:submissionId/invoice",d.authenticate,d.limiter,
    handle(async r=>{
      const invoice=await d.invoices.ready(r.user?.id,id(r),true);
      void d.afterCommit().catch(()=>{});
      return invoice;
    }));
}
