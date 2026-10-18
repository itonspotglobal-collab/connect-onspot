import assert from "node:assert/strict";
import { before,after,test } from "node:test";
import { mkdtempSync,rmSync } from "node:fs";
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
          ? <AdminWisePayments/>:<ManualWisePaymentPanel category="invoice" id="fixture-invoice"/>}</div>
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
    if(path==="/api/manual-wise/obligations/invoice/fixture-invoice")return fulfill(r,obligation);
    if(path==="/api/admin/manual-wise/submissions")return fulfill(r,{items:[]});
    if(path==="/api/admin/manual-wise/config")return fulfill(r,{items:[]});
    if(path==="/api/admin/manual-wise/payouts")return fulfill(r,{items:[]});
    return fulfill(r,{error:"Unexpected fixture request"},501);
  });
  await page.goto(base+(admin?"/admin":"/client"));
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
