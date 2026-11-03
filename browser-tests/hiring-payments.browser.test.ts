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
    optimizeDeps:{noDiscovery:true,include:["react","react-dom/client","react/jsx-runtime","@tanstack/react-query","@radix-ui/react-dialog","lucide-react","wouter","clsx","tailwind-merge","axios"]},
    resolve:{alias:{"@":resolve("client/src"),"@shared":resolve("shared"),"@assets":resolve("attached_assets")}},
    plugins:[react(),{name:"payment-fixture",enforce:"pre",resolveId(id){if(/(?:^|\/)contexts\/AuthContext(?:\.[jt]sx?)?$/.test(id))return "\0payment-fixture-auth";if(id==="/__payments.tsx")return id;},
      load(id){if(id==="\0payment-fixture-auth")return "export function useAuth(){return {user:{id:'fixture-client',role:'client'},isAuthenticated:true,isLoading:false}}; export function AuthProvider({children}){return children}";if(id!=="/__payments.tsx")return; return `
        import React from 'react';import {createRoot} from 'react-dom/client';
        import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
        import {ClientHiringPaymentPanel,ClientHiringInvoicesSection,AdminHiringPaymentsSection} from '/src/components/hiring-payments/HiringPayments.tsx';
        import {ExtendOfferDialog} from '/src/pages/ClientProfile.tsx';
        import {OverrideControls,DirectPlacementDialog} from '/src/components/admin-hiring-overrides/OverrideControls.tsx';
        import {PaymentVerificationCard} from '/src/components/hiring-payments/PaymentVerificationCard.tsx';
        import '/src/index.css';
        const mode=new URLSearchParams(location.search).get('mode');
        const submission={id:'original-submission',status:'reviewed',applicantName:'Fixture Talent',jobTitle:'Fixture Job',engagementType:'Standard'};
        createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
         <main style={{padding:16}}>{mode==='placement'?<DirectPlacementDialog clientId="fixture-client" jobs={[{id:'job-fixture',title:'Fixture Job',approvalStatus:'approved'}]}/>:mode?.startsWith('override')?<OverrideControls submissionId="original-submission" hasAcceptedOffer={mode!=='override-early'} initialRate={mode==='override-early'?undefined:2500} initialStartDate={mode==='override-early'?undefined:'2032-10-01'}/>:mode==='legacy-card'?<PaymentVerificationCard submissionId="original-submission"/>:mode==='admin'?<AdminHiringPaymentsSection/>:mode==='list'?<ClientHiringInvoicesSection/>:mode==='offer'?<ExtendOfferDialog submission={submission} onClose={()=>{}} onOfferSent={()=>{}}/>:<ClientHiringPaymentPanel submissionId="original-submission"/>}</main>
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
async function fixture(mode="",width=390,status:string|null=null,readyFailure?:{status:number;body:unknown},overrideFailure?:{status:number;body:unknown}){
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
      else if(path.startsWith("/api/admin/hiring-overrides/")){
        if(overrideFailure){code=overrideFailure.status;body=overrideFailure.body;}
        else body={id:"audit-fixture",submissionId:request.submissionId??"new-placement",status:path.endsWith("waive_deposit")?"offer_accepted":"hired"};
      }
      else{body={error:"UNEXPECTED_TEST_MUTATION"};code=500;}
    }else if(path==="/api/admin/hiring-overrides/capabilities"){
      code=mode.startsWith("override-denied")?403:200;body=code===403?{error:"ADMIN_REQUIRED"}:{canManage:true,canRevert:false};
    }
    else if(path==="/api/admin/hiring-overrides")body={items:state.posts.filter(p=>p.path.startsWith("/api/admin/hiring-overrides/")).map((p,i)=>({
      id:String(i),action:p.path.split("/").pop(),reason:p.body.reason,created_at:"2026-11-03T00:00:00Z",reverted_at:null,notify_parties:false,
    }))};
    else if(path.startsWith("/api/hiring-payment-waivers/"))body={required:true,paid:false,canManage:true,waiver:null};
    else if(path.endsWith("/policy"))body=null;
    else if(path.endsWith("/exceptions"))body=[];
    else if(path.endsWith("/hiring-invoices"))body=state.invoices;
    else if(path.includes("/hiring-invoices/"))body={invoice:state.invoices[0],history:[{id:"1",event:"invoice_issued",previous_status:null,new_status:"issued",created_at:invoice.created_at}]};
    else if(path.startsWith("/api/manual-wise/obligations/"))body={
      id:"invoice-fixture",category:"hiring_invoice",amount:"135.25",currency:"USD",payerId:"fixture-client",
      status:"issued",paymentStatus:"awaiting_payment",payable:true,direction:"incoming",instructions:null,history:[],
      blockedReason:"No approved payment instructions are available. Contact OnSpot billing support.",
    };
    else if(path==="/api/client/offers")body=[];
    else if(path==="/api/contractor-onboarding/original-submission")body={workflowVersion:2,status:'interviewing',canSendOffer:true,finalInterviewPassed:true,stages:[],deposit:null};
    else{body={error:"UNEXPECTED_TEST_QUERY"};code=404;}
    await route.fulfill({status:code,json:body});
  });
  const deniedResponse=mode.startsWith("override-denied")?page.waitForResponse(r=>r.url().includes("/api/admin/hiring-overrides/capabilities")):null;
  await page.goto(`${base}/?mode=${mode}`);
  if(deniedResponse)await deniedResponse;
  return {page,state,errors};
}
// Retired Ready-for-Offer no longer mounts error UI. Keep its historical
// structured-error mapping coverage against the real exported mapper instead.
async function mappedError(page:any,status:number,body:unknown) {
  await page.locator("main").waitFor();
  return page.evaluate(async(input:any)=>{
    const path="/src/components/hiring-payments/paymentTypes.tsx";
    const {getHiringPaymentErrorInfo}=await import(path);
    return getHiringPaymentErrorInfo({status:input.status,code:input.body.code,data:input.body});
  },{status,body});
}
test("Retired pre-offer readiness cannot issue a new fee or pretend to verify a deposit",async()=>{
  const {page,state,errors}=await fixture();
  await page.locator("main").waitFor();
  assert.equal(await page.getByRole("button",{name:"Ready for Offer",exact:true}).count(),0);
  assert.equal(await page.getByText("Payment Verified",{exact:true}).count(),0);
  assert.equal(state.posts.length,0);
  assert.deepEqual(errors,[]);
  await page.close();
});

test("Regular Admin waiver works without a loaded deposit ID and never invokes the retired pre-offer grant",async()=>{
  const {page,state,errors}=await fixture("override");
  try {
    await page.getByRole("button",{name:"Waive deposit",exact:true}).click();
    const dialog=page.getByRole("dialog");
    const confirm=dialog.getByRole("button",{name:"Confirm override"});
    assert.equal(await confirm.isDisabled(),true);
    await dialog.locator("textarea").fill("Approved isolated deposit waiver for regular admin");
    await confirm.click();
    await page.getByText("Approved isolated deposit waiver for regular admin",{exact:true}).waitFor();
    assert.equal(state.posts.length,1);
    assert.equal(state.posts[0].path,"/api/admin/hiring-overrides/waive_deposit");
    assert.equal(state.posts[0].body.submissionId,"original-submission");
    assert.equal(state.posts[0].body.depositId,undefined);
    assert.equal(await page.getByRole("button",{name:"Revert latest"}).count(),0);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
test("Regular Admin Hire now requires explicit terms and sends the existing hired-stage override",async()=>{
  const {page,state,errors}=await fixture("override-early",1440);
  try {
    await page.getByRole("button",{name:"Hire now",exact:true}).click();
    const dialog=page.getByRole("dialog"),confirm=dialog.getByRole("button",{name:"Confirm override"});
    await dialog.locator("textarea").fill("Explicit isolated early-stage hiring exception");
    assert.equal(await confirm.isDisabled(),true);
    await dialog.locator('input[type="number"]').fill("2500");
    await dialog.locator('input[type="date"]').fill("2032-10-01");
    await confirm.click();
    await page.getByText("Explicit isolated early-stage hiring exception",{exact:true}).waitFor();
    assert.equal(state.posts[0].path,"/api/admin/hiring-overrides/skip_stage");
    assert.equal(state.posts[0].body.targetStatus,"hired");
    assert.equal(state.posts[0].body.currency,"USD");
    assert.equal(state.posts[0].body.rate,2500);
    assert.equal(state.posts[0].body.startDate,"2032-10-01");
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
test("Hiring override errors show the clear reason and only the internal job editor link",async()=>{
  const {page,state,errors}=await fixture("override-early",390,null,undefined,{status:409,body:{
    error:"JOB_BILLING_CLASSIFICATION_REQUIRED",
    message:"This legacy job needs billing details before the application can be hired.",
    details:{jobId:"legacy/job-42",jobEditorUrl:"/admin/find-work/jobs/job-42/edit"},
  }});
  try {
    await page.getByRole("button",{name:"Hire now",exact:true}).click();
    const dialog=page.getByRole("dialog"),confirm=dialog.getByRole("button",{name:"Confirm override"});
    await dialog.locator("textarea").fill("Approved isolated legacy hiring exception");
    await dialog.locator('input[type="number"]').fill("2500");
    await dialog.locator('input[type="date"]').fill("2032-10-01");
    await confirm.click();
    const alert=page.getByRole("alert");
    await alert.waitFor();
    assert.match(await alert.innerText(),/This legacy job needs billing details before the application can be hired\./);
    const editJob=alert.getByRole("link",{name:"Edit job"});
    assert.equal(await editJob.getAttribute("href"),"/admin/find-work/jobs/job-42/edit");
    assert.doesNotMatch(await alert.innerText(),/JOB_BILLING_CLASSIFICATION_REQUIRED|legacy\/job-42/);
    assert.equal(state.posts[0].path,"/api/admin/hiring-overrides/skip_stage");
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
test("Regular Admin direct placement defaults to waived deposit and both agreement bypasses",async()=>{
  const {page,state,errors}=await fixture("placement",390);
  try {
    await page.getByRole("button",{name:"Hire now",exact:true}).click();
    const dialog=page.getByRole("dialog");
    await dialog.getByLabel("Talent user ID",{exact:true}).fill("fixture-talent");
    await dialog.locator("select").first().selectOption("job-fixture");
    await dialog.locator('input[type="number"]').fill("2500");
    await dialog.locator('input[type="date"]').fill("2032-10-01");
    await dialog.locator("textarea").fill("Approved isolated administrative direct hire");
    await dialog.getByRole("button",{name:"Hire now",exact:true}).click();
    await dialog.waitFor({state:"detached"});
    assert.equal(state.posts[0].path,"/api/admin/hiring-overrides/direct_placement");
    assert.equal(state.posts[0].body.depositPolicy,"waive");
    assert.equal(state.posts[0].body.skipContractorAgreement,true);
    assert.equal(state.posts[0].body.skipMsa,true);
    assert.equal(state.posts[0].body.clientId,"fixture-client");
    assert.equal(state.posts[0].body.talentId,"fixture-talent");
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
test("The legacy payment card cannot grant the retired payment skip",async()=>{
  const {page,state}=await fixture("legacy-card");
  try {
    await page.getByRole("heading",{name:"Payment verification"}).waitFor();
    assert.equal(await page.getByRole("button",{name:"Skip payment verification",exact:true}).count(),0);
    assert.equal(state.posts.length,0);
  }finally{await page.close();}
});
for(const actor of ["client","talent"])test(`Denied ${actor} capabilities do not expose override controls`,async()=>{
  const {page,state,errors}=await fixture(`override-denied-${actor}`);
  try {
    await page.locator("main").waitFor();
    assert.equal(await page.getByRole("button",{name:"Waive deposit",exact:true}).count(),0);
    assert.equal(await page.getByRole("button",{name:"Hire now",exact:true}).count(),0);
    assert.equal(state.posts.length,0);assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
for(const status of ["issued","verification_pending","paid"]){
  test(`Pre-offer invoice ${status} cannot lock an otherwise eligible offer`,async()=>{
    const {page,errors}=await fixture("offer",390,status);
    await page.getByRole("dialog").waitFor({timeout:10000}).catch(cause=>{throw new Error(`${cause.message}; browser errors: ${JSON.stringify(errors)}`);});
    const rate=page.locator('input[type="number"]').first();await rate.fill("2500");
    await page.locator('input[type="date"]').first().fill("2032-10-01");
    const button=page.getByRole("button",{name:"Send Offer",exact:true});
    assert.equal(await button.isDisabled(),false);
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
  await page.getByText("Historical hiring invoices",{exact:true}).waitFor();
  await page.getByRole("button",{name:/^View invoice$/i}).click();
  await page.getByText("Payment Verified",{exact:true}).waitFor();
  await page.getByText(/invoice issued/i).waitFor();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('[role="dialog"]')!).opacity==="1");
  await page.screenshot({path:"/tmp/hiring-payments-client-invoice.png",fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);await page.close();
});

test("Historical classification error mapping permits only the owned Client job editor",async()=>{
  const {page,errors}=await fixture("",390,null,{status:409,body:{
    code:"JOB_BILLING_CLASSIFICATION_REQUIRED",message:"Raw backend detail must not display",
    details:{missingFields:["engagementType","billingMode"],editPath:"/client/jobs/job-fixture/edit"},
  }});
  try {
    const info=await mappedError(page,409,{code:"JOB_BILLING_CLASSIFICATION_REQUIRED",message:"Raw backend detail must not display",
      details:{missingFields:["engagementType","billingMode"],editPath:"/client/jobs/job-fixture/edit"}});
    assert.equal(info.heading,"Job billing setup required");
    assert.deepEqual(info.missingFields,["Engagement type","Billing mode"]);
    assert.equal(info.editPath,"/client/jobs/job-fixture/edit");
    assert.doesNotMatch(JSON.stringify(info),/Raw backend|JOB_BILLING_CLASSIFICATION_REQUIRED|409:/);
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
});

test("Classification errors without a safe editor show administrator guidance",async()=>{
  for(const editPath of [null,"https://example.test/unsafe","//example.test/unsafe","/admin/jobs/job-fixture/edit"]){
    const {page}=await fixture("",390,null,{status:409,body:{
      code:"JOB_BILLING_CLASSIFICATION_REQUIRED",details:{missingFields:["billingMode"],editPath},
    }});
    try {
      const info=await mappedError(page,409,{code:"JOB_BILLING_CLASSIFICATION_REQUIRED",details:{missingFields:["billingMode"],editPath}});
      assert.equal(info.editPath,null);
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
  test(`Historical invoice error mapping handles ${code} separately`,async()=>{
    const {page,errors}=await fixture("",390,null,{status,body:{code,message:"Raw internal server detail"}});
    try {
      const info=await mappedError(page,status,{code,message:"Raw internal server detail"});
      assert.equal(info.heading,heading);
      assert.doesNotMatch(JSON.stringify(info),/Raw internal server detail|\{"code"/);
      assert.deepEqual(errors,[]);
    } finally {await page.close();}
  });
}
