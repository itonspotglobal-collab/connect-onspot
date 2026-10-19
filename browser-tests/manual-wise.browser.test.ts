import assert from "node:assert/strict";
import { before,after,test } from "node:test";
import { mkdtempSync,rmSync,readFileSync,mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
import { createServer,type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium,type Browser,type Route } from "playwright";
let vite:ViteDevServer,browser:Browser,base:string;
const cache=mkdtempSync(join(tmpdir(),"wise-browser-"));
before(async()=>{
  vite=await createServer({configFile:false,root:resolve("client"),cacheDir:cache,
    resolve:{alias:{"@":resolve("client/src"),"@shared":resolve("shared")}},
    optimizeDeps:{noDiscovery:true,include:["react","react-dom","react-dom/client","react/jsx-runtime","react/jsx-dev-runtime","@tanstack/react-query",
      "@radix-ui/react-dialog","@radix-ui/react-slot","axios","lucide-react","clsx","tailwind-merge","class-variance-authority"]},
    plugins:[react(),{name:"wise-fixture",resolveId(id){if(id==="/__wise.tsx")return id;},
      load(id){if(id!=="/__wise.tsx")return;return `
        import React from 'react';import {createRoot} from 'react-dom/client';
        import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
        import {ManualWisePaymentPanel} from '/src/components/manual-wise/ManualWisePaymentPanel.tsx';
        import {AdminWisePayments} from '/src/components/manual-wise/AdminWisePayments.tsx';
        import '/src/index.css';
        createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
          <div style={{padding:16,maxWidth:1100,margin:'auto'}}>{location.pathname==='/admin'
          ? <AdminWisePayments/>:<ManualWisePaymentPanel category={new URLSearchParams(location.search).get('category') || 'invoice'} id="fixture-invoice"/>}</div>
        </QueryClientProvider>);`;},
      configureServer(server){server.middlewares.use(async(req,res,next)=>{
        if(!req.headers.accept?.includes("text/html"))return next();
        res.setHeader("Content-Type","text/html");res.end(await server.transformIndexHtml("/",
          '<html><body><div id="root"></div><script type="module" src="/__wise.tsx"></script></body></html>'));
      });}}],
    server:{host:"127.0.0.1",port:0}});
  await vite.listen();base=`http://127.0.0.1:${(vite.httpServer!.address() as any).port}`;
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const warmup=await open();
  await warmup.waitForLoadState("networkidle");
  await warmup.close();
});
after(async()=>{await browser?.close();await vite?.close();rmSync(cache,{recursive:true,force:true});});
const incoming=()=>({category:"invoice",id:"fixture-invoice",reference:"INV-FIXTURE",amount:"100.00",currency:"USD",
  payerId:"client",status:"sent",paymentStatus:"awaiting_payment",payable:true,direction:"incoming",
  instructions:{id:"cfg",recipient:"Fixture destination",instructions:"Fixture written instructions only",
    referenceInstructions:"Use invoice reference",qrFileId:null,currency:"USD"},history:[] as any[]});
const fulfill=(r:Route,json:unknown,status=200)=>r.fulfill({status,json});
async function open(width=1280,obligation:any=incoming(),admin=false) {
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.addInitScript(()=>{(window as any).__name=(fn:unknown)=>fn;localStorage.setItem("onspot_jwt_token","fixture-token");});
  await page.route("**/api/**",async r=>{
    const path=new URL(r.request().url()).pathname;
    if(path===`/api/manual-wise/obligations/${obligation.category || "invoice"}/fixture-invoice`)return fulfill(r,obligation);
    if(path==="/api/manual-wise/files/official-qr" || path==="/api/admin/manual-wise/config/qr/official")return r.fulfill({contentType:"image/png",body:readFileSync("attached_assets/wise-qr-code_1792385025903.png")});
    if(path==="/api/admin/manual-wise/submissions")return fulfill(r,{items:[]});
    if(path==="/api/admin/manual-wise/config")return fulfill(r,{items:[]});
    if(path==="/api/admin/manual-wise/payouts")return fulfill(r,{items:[]});
    return fulfill(r,{error:"Unexpected fixture request"},501);
  });
  await page.goto(base+(admin?"/admin":`/client?category=${obligation.category || "invoice"}`));
  return page;
}
for(const width of [390,1280])test(`incoming proof form at ${width}px uses missing QR placeholder, requires receipt, and reports pending not paid`,async()=>{
  const value=incoming(),page=await open(width,value);
  await page.getByText(/QR code not configured/).waitFor();
  assert.equal(await page.locator("img").count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const submit=page.getByRole("button",{name:"Submit Payment Proof",exact:true});
  assert.equal(await submit.isDisabled(),true);
  await page.getByLabel("Transfer reference").fill("WISE-FIXTURE-CLAIM");
  await page.getByLabel(/Receipt file/).setInputFiles({name:"receipt.png",mimeType:"image/png",
    buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLYsAAAAASUVORK5CYII=","base64")});
  await page.route("**/api/manual-wise/obligations/invoice/fixture-invoice/proofs",async r=>{
    assert.equal(r.request().headers().authorization,"Bearer fixture-token");
    assert.match(r.request().headers()["content-type"],/^multipart\/form-data; boundary=/);
    assert.match(r.request().postData()!,/WISE-FIXTURE-CLAIM/);
    Object.assign(value,{paymentStatus:"verification_pending",payable:false,
      history:[{id:"proof",status:"verification_pending",reference:"WISE-FIXTURE-CLAIM",amount:"100.00",currency:"USD",
        receipt_id:null,receipt_name:"receipt.png",created_at:"2026-01-01T00:00:00Z",rejection_reason:null}]});
    return fulfill(r,{id:"proof",status:"verification_pending"},201);
  });
  await submit.click();
  await page.getByText(/Uploading it does not mark this obligation paid/).waitFor();
  assert.equal(await page.getByText("Your payment has been verified and confirmed.",{exact:true}).count(),0);
  await page.close();
});
test("unconfigured destination and unfinalized amount never offer payment or invent zero",async()=>{
  const page=await open(390,{...incoming(),amount:"",instructions:null,payable:false,blockedReason:"Finalized quote required."});
  await page.getByText("Amount not finalized",{exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Submit Payment Proof"}).count(),0);
  assert.equal(await page.locator("img").count(),0);
  assert.equal(await page.getByText("$0.00",{exact:true}).count(),0);
  await page.close();
});
test("rejected proof reason is visible and corrected receipt can be submitted",async()=>{
  const page=await open(390,{...incoming(),paymentStatus:"rejected",history:[{id:"rejected",status:"rejected",
    reference:"old",amount:"100",currency:"USD",receipt_id:null,receipt_name:"old.pdf",created_at:"2026-01-01T00:00:00Z",
    rejection_reason:"Payment not found at approved destination"}]});
  await page.getByText("Payment not found at approved destination",{exact:false}).first().waitFor();
  assert.equal(await page.getByLabel(/Receipt file/).count(),1);
  await page.close();
});
test("admin review requires independent settlement confirmation and sends validated evidence",async()=>{
  const page=await open(1280,incoming(),true);
  const item={id:"submission",category:"invoice",obligation_id:"fixture-invoice",status:"verification_pending",
    amount:"100.00",currency:"USD",reference:"WISE-CLAIM",receipt_id:null,receipt_name:null,
    payer_name:"Fixture Payer",payer_email:"payer@fixture.invalid",expected_recipient:"Fixture destination",
    created_at:"2026-01-01T00:00:00Z",history:[]};
  await page.route("**/api/admin/manual-wise/submissions*",r=>fulfill(r,{items:[item]}));
  await page.reload();
  await page.getByRole("button",{name:/Review/}).first().click();
  const dialog=page.getByRole("dialog");
  const verify=dialog.getByRole("button",{name:"Verify settled payment"});
  assert.equal(await verify.isDisabled(),true);
  await dialog.getByLabel("Reason / review note").fill("Independent Wise record checked");
  await dialog.getByLabel("Confirmed amount").fill("100.00");
  await dialog.getByLabel("Confirmed currency").fill("USD");
  await dialog.getByLabel("Independently confirmed reference").fill("WISE-SETTLED");
  await dialog.getByLabel("Confirmed recipient").fill("Fixture destination");
  await dialog.getByLabel("Settlement date and time").fill("2026-01-01T12:00");
  await dialog.getByRole("checkbox").check();
  let body:any;
  await page.route("**/api/admin/manual-wise/submissions/submission/review",r=>{
    body=r.request().postDataJSON();return fulfill(r,{id:"submission",status:"paid"});
  });
  await verify.click();await dialog.waitFor({state:"hidden"});
  assert.equal(body.independentlyVerified,true);assert.equal(body.verifiedReference,"WISE-SETTLED");
  await page.close();
});
for(const category of ["inquiry","hiring_invoice","invoice","monthly_invoice","deposit","replenishment"]) {
  for(const width of [390,1280])test(`official QR stays complete and downloads unchanged for ${category} at ${width}px`,async()=>{
    const value=incoming();value.category=category;
    value.instructions.qrFileId="official-qr" as any;
    const page=await open(width,value);
    const img=page.getByAltText("Authorized incoming Wise payment QR code");
    await img.waitFor();
    assert.equal(await img.evaluate((el:HTMLImageElement)=>el.complete && el.naturalWidth===800 && el.naturalHeight===800),true);
    const box=(await img.boundingBox())!;
    assert.ok(Math.abs(box.width-box.height)<1);
    assert.ok(box.width>=240 && box.width<=280);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const downloadPromise=page.waitForEvent("download");
    await page.getByRole("button",{name:"Download QR Code",exact:true}).click();
    const download=await downloadPromise;
    const bytes=readFileSync((await download.path())!);
    assert.equal(createHash("sha256").update(bytes).digest("hex"),"d11eb23bb6b58d4f6fb3fe531969dede65ef22086a439e8f0655e7a937d5df6e");
    if((category==="inquiry" && width===1280) || (category==="invoice" && width===390)) {
      mkdirSync("generated-artifacts/wise-qr",{recursive:true});
      await page.screenshot({path:`generated-artifacts/wise-qr/${category}-${width}.png`,fullPage:true});
    }
    await page.close();
  });
}
test("outgoing, blocked, terminal and mismatched-currency payloads never render or download collection QR",async()=>{
  for(const change of [{direction:"outgoing",category:"payout"},{currency:"PHP"},{status:"void",payable:false},
    {status:"paid",paymentStatus:"paid",payable:false},{blockedReason:"Destination requires approval"}]) {
    const value={...incoming(),...change};value.instructions.qrFileId="official-qr" as any;
    const page=await open(390,value);
    await page.getByText("Payable amount",{exact:true}).waitFor();
    assert.equal(await page.getByAltText("Authorized incoming Wise payment QR code").count(),0);
    assert.equal(await page.getByRole("button",{name:"Download QR Code",exact:true}).count(),0);
    await page.close();
  }
});
test("admin can preview and stage supplied QR without inventing or automatically saving receiving details",async()=>{
  const page=await open(1280,incoming(),true);
  await page.route("**/api/admin/manual-wise/config/qr/official",r=>r.request().method()==="POST"
    ? fulfill(r,{id:"official-qr"},201)
    : r.fulfill({contentType:"image/png",body:readFileSync("attached_assets/wise-qr-code_1792385025903.png")}));
  await page.reload();
  let saved=false;
  await page.route("**/api/admin/manual-wise/config",r=>{
    if(r.request().method()==="POST")saved=true;
    return fulfill(r,{items:[]});
  });
  await page.getByRole("button",{name:"Use supplied OnSpot QR",exact:true}).click();
  await page.getByText("Supplied OnSpot QR staged. Review its protected server preview before saving a draft.",{exact:true}).waitFor();
  assert.equal(saved,false);
  assert.equal(await page.getByRole("button",{name:"Save draft",exact:true}).isDisabled(),true);
  await page.close();
});

for(const width of [390,1280])test(`admin replacement draft, explicit activation, history, restoration and deactivation at ${width}px`,async()=>{
  const page=await open(width,incoming(),true);
  const original=readFileSync("attached_assets/wise-qr-code_1792385025903.png");
  const old={id:"old-usd",currency:"USD",supported_currencies:["USD"],recipient:"Fixture original recipient",
    instructions:"Fixture original instructions. No real transfers.",reference_instructions:"Fixture invoice reference",
    qr_file_id:"old-qr",active:true,config_status:"active",created_by:"fixture-admin",created_at:"2026-10-18T00:00:00Z",
    uploaded_by:"fixture-admin",uploaded_at:"2026-10-18T00:00:00Z",activated_by:"fixture-admin",activated_at:"2026-10-18T01:00:00Z"};
  let rows:any[]=[old],uploads=0,saves=0,activations=0,restores=0;
  const fileRequests:string[]=[];
  await page.route("**/api/manual-wise/files/**",r=>{
    fileRequests.push(new URL(r.request().url()).pathname.split("/").pop()!);
    return r.fulfill({contentType:"image/png",body:original});
  });
  await page.route(/\/api\/admin\/manual-wise\/config(?:\/.*)?$/,async r=>{
    const path=new URL(r.request().url()).pathname;
    if(path.endsWith("/qr/official"))return r.fulfill({contentType:"image/png",body:original});
    if(path.endsWith("/qr")){
      uploads++;assert.ok(r.request().postDataBuffer()!.includes(original));
      return fulfill(r,{id:"replacement-qr"},201);
    }
    if(r.request().method()==="GET")return fulfill(r,{items:rows});
    const body=r.request().postDataJSON();
    if(path.endsWith("/activate")){
      assert.deepEqual([body.confirmImageReviewed,body.confirmReceivingAccount,body.confirmCurrencies,body.confirmInstructions],[true,true,true,true]);
      assert.ok(body.reason.trim());activations++;
      const source=rows.find(row=>row.id===path.split("/").at(-2));
      assert.equal(source.config_status,"draft");
      const activated=source.supported_currencies.map((currency:string)=>{
        const previous=rows.find(row=>row.active && row.currency===currency);
        if(previous){previous.active=false;previous.config_status="inactive";previous.deactivation_reason=body.reason;}
        return {...source,id:`activation-${activations}-${currency}`,currency,active:true,config_status:"active",
          source_config_id:source.id,previous_version_id:previous?.id??null,activated_by:"fixture-admin",activated_at:"2026-10-19T01:00:00Z"};
      });
      source.config_status="reviewed";rows.unshift(...activated);return fulfill(r,{items:activated});
    }
    if(path.endsWith("/restore")){
      restores++;assert.ok(body.reason);
      const source=rows.find(row=>row.id===path.split("/").at(-2));
      const draft={...source,id:"restored-draft",active:false,config_status:"draft",source_config_id:source.id};
      rows.unshift(draft);return fulfill(r,draft);
    }
    if(path.endsWith("/deactivate")){
      const selected=rows.find(row=>row.id===path.split("/").at(-2));
      rows.filter(row=>row.active && (row.id===selected.id || row.source_config_id===selected.source_config_id))
        .forEach(row=>{row.active=false;row.config_status="inactive";row.revoked_at="2026-10-19T02:00:00Z";row.deactivation_reason=body.reason;});
      return fulfill(r,selected);
    }
    saves++;assert.equal(body.active,false);assert.equal(body.qrFileId,"replacement-qr");
    const draft={...body,id:"replacement-draft",supported_currencies:body.supportedCurrencies,
      reference_instructions:body.referenceInstructions,qr_file_id:body.qrFileId,config_status:"draft",
      uploaded_by:"fixture-admin",uploaded_at:"2026-10-19T00:00:00Z"};
    rows.unshift(draft);return fulfill(r,draft);
  });
  await page.reload();
  const active=page.locator('section[aria-labelledby="active-wise-heading"]');
  await active.getByAltText("Active USD Wise QR").waitFor();
  await page.getByLabel("Choose QR image",{exact:true}).setInputFiles({name:"replacement.png",mimeType:"image/png",buffer:original});
  await page.getByAltText("Selected QR image preview").waitFor();
  assert.equal(uploads,0);assert.equal(activations,0);
  await page.getByRole("button",{name:"Upload QR image",exact:true}).click();
  await page.getByAltText("Uploaded protected QR preview before draft save").waitFor();
  assert.equal(uploads,1);assert.ok(fileRequests.includes("replacement-qr"));
  assert.equal(await active.getByText("USD · Fixture original recipient",{exact:true}).count(),1);
  await page.getByLabel("Primary currency",{exact:true}).fill("USD");
  await page.getByLabel("Supported currencies").fill("USD, invalid");
  await page.getByLabel("Receiving account recipient",{exact:true}).fill("Fixture reviewed replacement");
  await page.getByLabel("Transfer instructions",{exact:true}).fill("Fixture replacement instructions. No real transfers.");
  assert.equal(await page.getByRole("button",{name:"Save draft",exact:true}).isDisabled(),true);
  await page.getByLabel("Supported currencies").fill("USD, CAD");
  await page.getByLabel("Reference instructions",{exact:true}).fill("Fixture revised invoice reference");
  await page.getByRole("button",{name:"Save draft",exact:true}).click();
  await page.getByText("Draft saved. It is not active and will not collect customer payments until separately reviewed and activated.",{exact:true}).waitFor();
  assert.equal(saves,1);assert.equal(activations,0);
  assert.equal(await active.getByText("USD · Fixture original recipient",{exact:true}).count(),1);
  await page.getByRole("button",{name:"Review this draft",exact:true}).click();
  const activateButton=page.getByRole("button",{name:"Activate reviewed configuration",exact:true});
  assert.equal(await activateButton.isDisabled(),true);
  const reviewPanel=page.getByTestId("wise-configuration-review");
  const checks=reviewPanel.getByRole("checkbox");
  await checks.nth(0).check();await checks.nth(1).check();await checks.nth(2).check();
  await page.getByLabel("Activation reason",{exact:true}).fill("Fixture receiving details independently reviewed");
  assert.equal(await activateButton.isDisabled(),true);
  await checks.nth(3).check();
  assert.equal(await activateButton.isDisabled(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  mkdirSync("generated-artifacts/wise-qr-lifecycle",{recursive:true});
  await reviewPanel.screenshot({path:`generated-artifacts/wise-qr-lifecycle/review-${width}.png`});
  await activateButton.click();
  await page.getByText("Configuration activated. Customer collection now uses the activated configuration.",{exact:true}).waitFor();
  await active.getByText("USD · Fixture reviewed replacement",{exact:true}).waitFor();
  await active.getByAltText("Active CAD Wise QR").waitFor();
  assert.equal(activations,1);
  const history=page.locator('section[aria-labelledby="history-heading"]');
  await history.getByText("USD · Fixture original recipient",{exact:true}).waitFor();
  await history.getByLabel("Reason to restore as a draft").fill("Fixture original destination reconfirmed");
  await history.getByRole("button",{name:"Restore as draft",exact:true}).click();
  await page.getByText("Historical configuration copied as a new draft. It still requires a separate review and activation.",{exact:true}).waitFor();
  assert.equal(restores,1);assert.equal(activations,1);
  await active.getByText("USD · Fixture reviewed replacement",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Review this draft",exact:true}).click();
  assert.equal(await activateButton.isDisabled(),true);
  assert.equal(await reviewPanel.getByRole("checkbox").nth(1).isChecked(),false);
  for(let i=0;i<4;i++)await reviewPanel.getByRole("checkbox").nth(i).check();
  await page.getByLabel("Activation reason",{exact:true}).fill("Fixture restored receiving details newly reviewed");
  await activateButton.click();
  await active.getByText("USD · Fixture original recipient",{exact:true}).waitFor();
  assert.equal(activations,2);
  await page.getByLabel("Reason to deactivate USD",{exact:true}).fill("Fixture destination revoked");
  const usd=active.locator("article").filter({has:page.getByText("USD · Fixture original recipient",{exact:true})});
  await usd.getByRole("button",{name:"Deactivate",exact:true}).click();
  await page.getByText(/Configuration deactivated\. Customer collection is blocked/).waitFor();
  assert.equal(await active.getByAltText("Active USD Wise QR").count(),0);
  assert.equal(await active.getByAltText("Active CAD Wise QR").count(),1);
  await page.close();
});

test("a missing, forbidden, or undecodable protected QR blocks image confirmation and activation",async()=>{
  for(const status of [200,403,404]) {
    const page=await open(390,incoming(),true);
    let activated=false;
    const draft={id:"unreadable-draft",currency:"USD",supported_currencies:["USD"],recipient:"Fixture recipient",
      instructions:"Fixture instructions only",reference_instructions:"Fixture reference",
      qr_file_id:"unreadable-qr",active:false,config_status:"draft"};
    await page.route("**/api/admin/manual-wise/config",r=>fulfill(r,{items:[draft]}));
    await page.route("**/api/admin/manual-wise/config/*/activate",r=>{activated=true;return fulfill(r,{error:"Must not reach activation"},422);});
    await page.route("**/api/manual-wise/files/**",r=>r.fulfill({status,contentType:status===200?"image/png":"application/json",
      body:status===200?"not actually an image":JSON.stringify({error:"Fixture protected-image refusal"})}));
    await page.reload();
    await page.getByRole("button",{name:"Review this draft",exact:true}).click();
    const panel=page.getByTestId("wise-configuration-review");
    await panel.getByRole("alert").waitFor();
    assert.equal(await panel.getByRole("checkbox").nth(0).isDisabled(),true);
    for(let i=1;i<4;i++)await panel.getByRole("checkbox").nth(i).check();
    await page.getByLabel("Activation reason",{exact:true}).fill("Fixture all other details reviewed");
    assert.equal(await page.getByRole("button",{name:"Activate reviewed configuration",exact:true}).isDisabled(),true);
    assert.equal(activated,false);
    await page.close();
  }
});
