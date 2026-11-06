/** Component integration with synthetic identities and intercepted APIs, not real-account UAT. */
import assert from "node:assert/strict";
import {before,after,test} from "node:test";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {createServer,type ViteDevServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium,type Browser} from "playwright";

let vite:ViteDevServer,browser:Browser,base:string;
const cache=mkdtempSync(join(tmpdir(),"hiring-workflow-browser-"));
before(async()=>{
  vite=await createServer({configFile:false,root:resolve("client"),cacheDir:cache,
    define:{"process.env.NODE_ENV":JSON.stringify("test")},
    resolve:{alias:{"@":resolve("client/src"),"@shared":resolve("shared")}},
    optimizeDeps:{noDiscovery:true,include:["react","react-dom/client","react/jsx-runtime","@tanstack/react-query","lucide-react","wouter","clsx","tailwind-merge"]},
    plugins:[react(),{name:"hiring-workflow-fixture",enforce:"pre",
      resolveId(id){if(id==="/__workflow.tsx")return id;},
      load(id){if(id!=="/__workflow.tsx")return;return `
        import React from 'react';import{createRoot}from'react-dom/client';
        import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
        import{InterviewDecisionPanel}from'/src/components/InterviewDecisionPanel.tsx';
        import{ContractorOnboardingTracker}from'/src/components/ContractorOnboarding.tsx';
        import{OverrideControls}from'/src/components/admin-hiring-overrides/OverrideControls.tsx';
        import{Toaster}from'/src/components/ui/toaster.tsx';import'/src/index.css';
        const params=new URLSearchParams(location.search),mode=params.get('mode'),admin=params.get('admin')==='true';
        const interview={id:'round-fixture',submission_id:'app-fixture',round_number:2,interview_type:'final',
          status:mode==='started'?'confirmed':mode==='completed'?'completed':'proposed',outcome:mode==='completed'?'advance':null,
          confirmed_time:mode==='started'?'2020-01-01T09:00:00Z':null};
        const labels=['Application','Shortlisted','Interview','Final interview','Offer','Invoice','Payment verified / waived','Agreements','Active'];
        const data={policy:'deposit_first',submissionId:'app-fixture',status:'interviewing',isTalent:mode==='talent',
          stages:labels.map((label,i)=>({key:['application','shortlisted','interview','final_interview','offer','invoice','payment_verified','agreements','active'][i],
            label,complete:i<3,current:i===3,actor:i<3?'Talent':'Client / Admin',overridden:i===2})),
          stageMissing:['Complete a final interview','Record Advance outcome'],missing:[],nextActor:'Client / Admin',
          shortlistSatisfied:true,canSendOffer:false,offerAccepted:false,deposit:null,contract:null,msa:{},conditions:{}};
        createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>
          <main style={{padding:16,maxWidth:params.get('narrow')?'540px':undefined}}>
          {mode==='bypass'?<OverrideControls submissionId="app-fixture"/>:mode==='tracker'||mode==='talent'?<ContractorOnboardingTracker data={data} compact={params.get('compact')==='true'}/>:
          <InterviewDecisionPanel interview={interview} admin={admin} onRejectBeforeStart={()=>window.__rejected=true} onScheduleNext={()=>window.__scheduled=true}/>}
          </main><Toaster/></QueryClientProvider>);
      `;},
      configureServer(server){server.middlewares.use(async(req,res,next)=>{
        if(!req.headers.accept?.includes("text/html"))return next();
        res.setHeader("Content-Type","text/html");
        res.end(await server.transformIndexHtml("/",'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/__workflow.tsx"></script></body></html>'));
      });}
    }],server:{host:"127.0.0.1",port:0}});
  await vite.listen();base=`http://127.0.0.1:${(vite.httpServer!.address() as any).port}`;
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
});
after(async()=>{await browser?.close();await vite?.close();rmSync(cache,{recursive:true,force:true});});
async function fixture(mode:string,width=380,admin=false,extra="") {
  const page=await browser.newPage({viewport:{width,height:950}});
  const requests:any[]=[];const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem("onspot_jwt_token","synthetic-fixture"));
  const steps=[
    {stageKey:"shortlisted",targetStatus:"shortlisted",action:"skip_stage",label:"Shortlist",description:"Shortlist this application."},
    {stageKey:"interview",targetStatus:"interviewing",action:"skip_stage",label:"Interview",description:"Bypass the interview prerequisite."},
  ];
  let stepIndex=0;
  await page.route("**/api/**",async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    let body:any={};
    if(request.method()==="PATCH"||request.method()==="POST") {
      requests.push({path,body:request.postDataJSON()});body={success:true};
      if(path.endsWith("skip_next_step"))stepIndex++;
    } else if(path.endsWith("/capabilities"))body={canManage:admin,canRevert:admin};
    else if(path.endsWith("/next-step"))body={step:steps[stepIndex]??null};
    else if(path==="/api/admin/hiring-overrides")body={items:[]};
    await route.fulfill({json:body});
  });
  await page.goto(`${base}/?mode=${mode}&admin=${admin}${extra}`,{waitUntil:"networkidle"});
  return {page,requests,errors};
}

for(const admin of [false,true])test(`Proposed final interview shows disabled Advance, Reject and known limitation (${admin?"Admin":"Client"})`,async()=>{
  const {page,requests,errors}=await fixture("proposed",380,admin);
  try {
    const advance=page.getByRole("button",{name:"Advance to offer",exact:true});
    assert.equal(await advance.isDisabled(),true);
    assert.equal(await page.getByRole("button",{name:"Reject",exact:true}).isEnabled(),true);
    const notice=page.getByTestId("interview-skip-known-limitation");
    assert.match(await notice.innerText(),/Skipping an interview isn't available yet/);
    assert.match(await notice.innerText(),/Known limitation/);
    assert.equal((await notice.innerText()).includes("admins can use"),admin);
    assert.match(await page.locator("main").innerText(),/Available once the talent confirms/);
    await page.getByRole("button",{name:"Reject",exact:true}).click();
    assert.equal(await page.evaluate(()=>(window as any).__rejected),true);
    assert.equal(requests.length,0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
});
test("Started interview confirms explicit final advance using the existing outcome endpoint",async()=>{
  const {page,requests,errors}=await fixture("started");
  try {
    assert.equal(await page.getByTestId("interview-skip-known-limitation").count(),0);
    await page.getByRole("button",{name:"Advance to offer",exact:true}).click();
    await page.getByRole("dialog").waitFor();
    await page.getByLabel("Internal notes (optional)").fill("Synthetic decision notes");
    await page.getByRole("button",{name:"Confirm advance",exact:true}).click();
    await page.getByText("Final interview passed",{exact:true}).waitFor();
    assert.equal(requests[0].path,"/api/client/interviews/round-fixture/outcome");
    assert.deepEqual(requests[0].body,{outcome:"advance",internalNotes:"Synthetic decision notes",interviewType:"final"});
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
});
test("Mobile tracker collapses completed steps but preserves full labels, checklist and timeline semantics",async()=>{
  const {page,errors}=await fixture("tracker");
  try {
    assert.match(await page.locator("main").innerText(),/Step 4 of 9/);
    assert.equal(await page.locator('ol [aria-current="step"]').count(),1);
    await page.getByRole("button",{name:"Show all 9 steps"}).click();
    assert.equal(await page.locator("ol > li").count(),9);
    assert.match(await page.locator("main ol").innerText(),/Bypassed by Admin/);
    assert.equal(await page.getByText("Complete a final interview",{exact:true}).count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
});
test("Narrow containers use vertical timeline even on a desktop viewport",async()=>{
  const {page,errors}=await fixture("tracker",1400,false,"&narrow=true");
  try {
    assert.equal(await page.getByRole("button",{name:"Show all 9 steps"}).count(),1);
    await page.setViewportSize({width:380,height:950});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
});
test("Talent tracker keeps invoice/payment stages out of its timeline",async()=>{
  const {page}=await fixture("talent");
  try {
    await page.getByRole("button",{name:"Show all 7 steps"}).click();
    assert.doesNotMatch(await page.locator("main ol").innerText(),/Payment verified|Invoice/);
  } finally {await page.close();}
});
test("Admin stepwise bypass submits one frozen step then refreshes to the following step",async()=>{
  const {page,requests,errors}=await fixture("bypass",380,true);
  try {
    await page.getByRole("button",{name:"Skip this step: Shortlist",exact:true}).click();
    const dialog=page.getByRole("dialog");
    assert.match(await dialog.innerText(),/This skips one step only/);
    assert.equal(await dialog.locator("select").count(),0);
    await dialog.getByRole("textbox",{name:/Reason/}).fill("Synthetic approved exception");
    const notify=dialog.getByRole("checkbox",{name:/Notify client and talent/});
    assert.equal(await notify.isChecked(),false);
    await dialog.getByRole("button",{name:/Confirm/}).click();
    await page.getByRole("button",{name:"Skip this step: Interview",exact:true}).waitFor();
    assert.equal(requests.length,1);
    assert.equal(requests[0].path,"/api/admin/hiring-overrides/skip_next_step");
    assert.equal(requests[0].body.expectedStageKey,"shortlisted");
    assert.equal(requests[0].body.expectedTargetStatus,"shortlisted");
    assert.equal(requests[0].body.notifyParties,false);
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
});
test("Client capabilities never expose bypass controls",async()=>{
  const {page,requests}=await fixture("bypass",380,false);
  try {assert.equal(await page.getByRole("button",{name:/Skip this step|Hire now|Waive deposit/}).count(),0);assert.equal(requests.length,0);}
  finally {await page.close();}
});
