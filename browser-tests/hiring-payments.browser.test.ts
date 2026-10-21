import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium, type Browser } from "playwright";

let vite: ViteDevServer, browser: Browser, base: string;
const cacheDir=mkdtempSync(join(tmpdir(),"hiring-payments-ui-"));
before(async()=>{
  vite=await createServer({configFile:false,root:resolve("client"),cacheDir,
    define:{"process.env.NODE_ENV":JSON.stringify("test")},
    resolve:{alias:{"@":resolve("client/src"),"@shared":resolve("shared"),"@assets":resolve("attached_assets")}},
    plugins:[react(),{name:"payment-fixture",resolveId(id){if(id==="/__payments.tsx")return id;},
      load(id){if(id!=="/__payments.tsx")return; return `
        import React from 'react';import {createRoot} from 'react-dom/client';
        import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
        import {ClientHiringPaymentPanel,ClientHiringInvoicesSection,AdminHiringPaymentsSection} from '/src/components/hiring-payments/HiringPayments.tsx';
        import {ExtendOfferDialog} from '/src/pages/ClientProfile.tsx';
        import '/src/index.css';
        const mode=new URLSearchParams(location.search).get('mode');
        const submission={id:'original-submission',status:'reviewed',applicantName:'Fixture Talent',jobTitle:'Fixture Job',engagementType:'Standard'};
        createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
         <main style={{padding:16}}>{mode==='admin'?<AdminHiringPaymentsSection/>:mode==='list'?<ClientHiringInvoicesSection/>:mode==='offer'?<ExtendOfferDialog submission={submission} onClose={()=>{}} onOfferSent={()=>{}}/>:<ClientHiringPaymentPanel submissionId="original-submission"/>}</main>
        </QueryClientProvider>);`;
      },
      configureServer(s){s.middlewares.use(async(req,res,next)=>{
        if(!req.headers.accept?.includes("text/html"))return next();
        res.setHeader("Content-Type","text/html");res.end(await s.transformIndexHtml("/",'<html><meta name="viewport" content="width=device-width, initial-scale=1"/><body><div id="root"></div><script type="module" src="/__payments.tsx"></script></body></html>'));
      });}
    }],server:{host:"127.0.0.1",port:0}});
  await vite.listen();base=`http://127.0.0.1:${(vite.httpServer!.address() as any).port}`;
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
});
after(async()=>{await browser?.close();await vite?.close();rmSync(cacheDir,{recursive:true,force:true});});
const invoice={
  id:"invoice-fixture",invoice_type:"hiring_pre_offer",attempt_id:"attempt-fixture",submission_id:"original-submission",
  job_id:"job-fixture",invoice_number:"HPO-00000001",fee_description:"Authorized hiring fee",amount:"135.25",currency:"USD",
  fee_basis:"fixed_per_hiring_attempt",tax_treatment:"inclusive",tax_description:"Inclusive fixture tax",status:"issued",
  issued_at:"2026-10-14T00:00:00Z",due_date:"2026-10-21T00:00:00Z",payment_method:"manual_transfer",
  payment_recipient:"Fixture Recipient",payment_instructions:"Fixture transfer instructions",payment_reference:null,
  verified_at:null,created_at:"2026-10-14T00:00:00Z",updated_at:"2026-10-14T00:00:00Z",
};
async function fixture(mode="",width=390,status:string|null=null,readyFailure?:{status:number;body:unknown}){
  const page=await browser.newPage({viewport:{width,height:844}});
  const state={invoices:status?[{...invoice,status,verified_at:status==="paid"?"2026-10-14T01:00:00Z":null}]:[] as any[],posts:[] as any[]};
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem("onspot_jwt_token","fixture-only");});
  await page.route("**/api/**",async route=>{
    const path=new URL(route.request().url()).pathname,method=route.request().method();
    let body:any,code=200;
    if(method==="POST"){
      const request=route.request().postDataJSON();state.posts.push({path,body:request});
      if(path.endsWith("/ready")){
        if(readyFailure){code=readyFailure.status;body=readyFailure.body;}
        else{state.invoices=[{...invoice}];body=state.invoices[0];}
      }
      else if(path.endsWith("/reference")){state.invoices[0]={...state.invoices[0],status:"verification_pending",payment_reference:request.reference};body=state.invoices[0];}
      else if(path.endsWith("/review")){state.invoices[0]={...state.invoices[0],status:"paid",verified_at:"2026-10-14T01:00:00Z"};body=state.invoices[0];}
      else{body={error:"UNEXPECTED_TEST_MUTATION"};code=500;}
    }else if(path.endsWith("/policy"))body=null;
    else if(path.endsWith("/exceptions"))body=[];
    else if(path.endsWith("/hiring-invoices"))body=state.invoices;
    else if(path.includes("/hiring-invoices/"))body={invoice:state.invoices[0],history:[{id:"1",event:"invoice_issued",previous_status:null,new_status:"issued",created_at:invoice.created_at}]};
    else if(path.startsWith("/api/manual-wise/obligations/"))body={
      id:"invoice-fixture",category:"hiring_invoice",amount:"135.25",currency:"USD",payerId:"fixture-client",
      status:"issued",paymentStatus:"awaiting_payment",payable:true,direction:"incoming",instructions:null,history:[],
      blockedReason:"No approved payment instructions are available. Contact OnSpot billing support.",
    };
    else if(path==="/api/client/offers")body=[];
    else{body={error:"UNEXPECTED_TEST_QUERY"};code=404;}
    await route.fulfill({status:code,json:body});
  });
  await page.goto(`${base}/?mode=${mode}`);
  return {page,state,errors};
}
test("Client readiness issues intent once; missing approved Wise instructions never becomes a payment fallback",async()=>{
  const {page,state,errors}=await fixture();
  await page.getByRole("button",{name:"Ready for Offer",exact:true}).click();
  await page.getByText("HPO-00000001", {exact:false}).first().waitFor();
  assert.equal(state.posts.length,1);
  await page.getByRole("button",{name:/View invoice.*payment instructions/i}).click();
  await page.getByText("No approved payment instructions are available. Contact OnSpot billing support.",{exact:true}).waitFor();
  assert.equal(await page.getByText("Payment Verified",{exact:true}).count(),0);
  assert.equal(state.posts.length,1);
  assert.deepEqual(errors,[]);
  await page.close();
});
for(const status of ["issued","verification_pending","paid"]){
  test(`Existing Send Offer is ${status==="paid"?"enabled":"locked"} for ${status}`,async()=>{
    const {page,errors}=await fixture("offer",390,status);
    await page.getByRole("dialog").waitFor();
    const rate=page.locator('input[type="number"]').first();await rate.fill("2500");
    const button=page.getByRole("button",{name:status==="paid"?"Send Offer":"Payment verification required",exact:true});
    if(status==="paid"){await page.getByText("Payment Verified",{exact:true}).waitFor();await button.waitFor();assert.equal(await button.isEnabled(),true);}
    else assert.equal(await button.isDisabled(),true);
    assert.deepEqual(errors,[]);await page.close();
  });
}
test("Admin pending hiring invoices route receipt verification to the unified Wise workflow",async()=>{
  const {page,state,errors}=await fixture("admin",1280,"verification_pending");
  const review = page.getByRole("link",{name:"Review receipt in Payment Verifications",exact:true});
  await review.waitFor();
  assert.equal(await review.getAttribute("href"),"/admin/ledger#manual-wise-admin");
  assert.equal(await page.getByRole("button",{name:"Review",exact:true}).count(),0);
  assert.equal(await page.getByRole("button",{name:"Record verify",exact:true}).count(),0);
  await page.screenshot({path:"/tmp/hiring-payments-admin-review.png",fullPage:true});
  assert.equal(state.posts.length,0);
  assert.deepEqual(errors,[]);await page.close();
});
test("Client invoice list clearly separates pre-offer billing and opens immutable history",async()=>{
  const {page,errors}=await fixture("list",390,"paid");
  await page.getByText("Pre-offer hiring invoices",{exact:true}).waitFor();
  await page.getByRole("button",{name:/^View invoice$/i}).click();
  await page.getByText("Payment Verified",{exact:true}).waitFor();
  await page.getByText(/invoice issued/i).waitFor();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('[role="dialog"]')!).opacity==="1");
  await page.screenshot({path:"/tmp/hiring-payments-client-invoice.png",fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);await page.close();
});

test("Structured classification error offers only the authorized job editor, never raw JSON",async()=>{
  const {page,errors}=await fixture("",390,null,{status:409,body:{
    code:"JOB_BILLING_CLASSIFICATION_REQUIRED",message:"Raw backend detail must not display",
    details:{missingFields:["engagementType","billingMode"],editPath:"/client/jobs/job-fixture/edit"},
  }});
  try {
    await page.getByRole("button",{name:"Ready for Offer",exact:true}).click();
    await page.getByText("Job billing setup required",{exact:true}).waitFor();
    await page.getByText("Engagement type",{exact:true}).waitFor();
    await page.getByText("Billing mode",{exact:true}).waitFor();
    assert.equal(await page.getByRole("link",{name:"Review Job Billing Settings"}).getAttribute("href"),"/client/jobs/job-fixture/edit");
    assert.doesNotMatch(await page.locator("main").innerText(),/Raw backend|JOB_BILLING_CLASSIFICATION_REQUIRED|409:/);
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
});

test("Classification errors without a safe editor show administrator guidance",async()=>{
  for(const editPath of [null,"https://example.test/unsafe","//example.test/unsafe","/admin/jobs/job-fixture/edit"]){
    const {page}=await fixture("",390,null,{status:409,body:{
      code:"JOB_BILLING_CLASSIFICATION_REQUIRED",details:{missingFields:["billingMode"],editPath},
    }});
    try {
      await page.getByRole("button",{name:"Ready for Offer",exact:true}).click();
      await page.getByText(/Please contact an OnSpot administrator to update this job/).waitFor();
      assert.equal(await page.getByRole("link",{name:"Review Job Billing Settings"}).count(),0);
    } finally {await page.close();}
  }
});

for(const [status,code,heading] of [
  [409,"HIRING_BILLING_POLICY_REQUIRED","Hiring fee policy unavailable"],
  [401,"UNAUTHORIZED","Authorization required"],
  [403,"FORBIDDEN","Authorization required"],
  [404,"APPLICATION_NOT_FOUND","Application or job unavailable"],
  [409,"APPLICATION_NOT_OFFER_ELIGIBLE","Application is not ready for an offer"],
  [409,"HIRING_ATTEMPT_IDENTITY_CHANGED","Invoice could not be matched"],
  [503,"HIRING_PAYMENT_FAILED","Invoice preparation unavailable"],
] as const){
  test(`Ready for Offer handles structured ${code} separately`,async()=>{
    const {page,errors}=await fixture("",390,null,{status,body:{code,message:"Raw internal server detail"}});
    try {
      await page.getByRole("button",{name:"Ready for Offer",exact:true}).click();
      await page.getByText(heading,{exact:true}).waitFor();
      assert.doesNotMatch(await page.locator("main").innerText(),/Raw internal server detail|\{"code"/);
      assert.deepEqual(errors,[]);
    } finally {await page.close();}
  });
}
