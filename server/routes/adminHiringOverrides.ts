import type {Express,RequestHandler} from "express";
import {AdminHiringOverrideService,HIRING_OVERRIDE_ACTIONS} from "../services/adminHiringOverrideService";
import {OnboardingError} from "../services/contractorOnboardingPolicy";

export function registerAdminHiringOverrideRoutes(app:Express,service:AdminHiringOverrideService,
  authenticate:RequestHandler,admin:RequestHandler,limiter:RequestHandler) {
  const handle=(fn:(r:any)=>Promise<any>):RequestHandler=>async(req,res)=>{
    try {res.json(await fn(req));}
    catch(e:any) {
      if(e instanceof OnboardingError)return void res.status(e.status).json({error:e.code,message:e.message});
      if(e?.code==="22P02")return void res.status(400).json({error:"INVALID_IDENTIFIER",message:"Invalid identifier."});
      console.warn("[hiring-override] request failed",{code:e?.code??"unavailable"});
      res.status(503).json({error:"OVERRIDE_UNAVAILABLE",message:"No change confirmed. Refresh the application before retrying."});
    }
  };
  app.get("/api/admin/hiring-overrides/capabilities",authenticate,admin,handle(async r=>{
    return service.capabilities(r.user.id);
  }));
  app.get("/api/admin/hiring-overrides",authenticate,admin,handle(r=>service.history(r.user.id,String(r.query.submissionId??"").slice(0,150))));
  for(const action of HIRING_OVERRIDE_ACTIONS)
    app.post(`/api/admin/hiring-overrides/${action}`,authenticate,admin,limiter,handle(r=>service.execute(r.user.id,action,r.body)));
}
