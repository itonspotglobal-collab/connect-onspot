/** Isolated React/Vite fixture with mocked API transport, not real-account UAT. */
import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {createServer,type ViteDevServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium,type Browser} from "playwright";
let vite:ViteDevServer,browser:Browser,origin:string,cache:string;
const docId="10000000-0000-4000-8000-000000000001",oldId="20000000-0000-4000-8000-000000000001",sha="a".repeat(64);
before(async()=>{
  cache=mkdtempSync(join(tmpdir(),"msa-ui-"));
  vite=await createServer({configFile:false,root:resolve("client"),cacheDir:cache,
    optimizeDeps:{entries:["src/components/ClientMsaAuthoring.tsx","src/pages/ClientMsa.tsx"]},
    resolve:{alias:{"@":resolve("client/src"),"@shared":resolve("shared")}},
    plugins:[react(),{name:"msa-test-harness",
      resolveId(id){if(id==="/__msa.tsx")return id;},
      load(id){if(id!=="/__msa.tsx")return;return `import React from "react";import{createRoot}from"react-dom/client";
        import{QueryClient,QueryClientProvider,useQuery}from"@tanstack/react-query";
        import ClientMsa from"/src/pages/ClientMsa";
        import{ClientMsaAuthoring}from"/src/components/ClientMsaAuthoring";import"/src/index.css";
        const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});
        function Admin(){const q=useQuery({queryKey:["list"],queryFn:async()=>fetch("/api/admin/client-msas").then(r=>r.json())});
          return q.data?<ClientMsaAuthoring engagement={q.data.engagements[0]} documents={q.data.documents} signerProfile={q.data.signerProfile} onChanged={()=>q.refetch()}/>:<p>Loading</p>}
        createRoot(document.getElementById("root")).render(<QueryClientProvider client={qc}><main className="p-6"><button onClick={()=>qc.invalidateQueries()}>Refresh fixture</button>{location.search.includes("admin")?<Admin/>:<ClientMsa/>}</main></QueryClientProvider>);`;},
      configureServer(server){server.middlewares.use(async(req,res,next)=>{
        if(req.url?.split("?")[0]!=="/__msa")return next();res.setHeader("Content-Type","text/html");
        res.end(await server.transformIndexHtml("/__msa",'<html><body><div id="root"></div><script type="module" src="/__msa.tsx"></script></body></html>'));
      });}
    }],server:{host:"127.0.0.1",port:0}});
  await vite.listen();origin=`http://127.0.0.1:${(vite.httpServer!.address() as any).port}`;
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
});
after(async()=>{await browser?.close();await vite?.close();if(cache)rmSync(cache,{recursive:true,force:true});});
test("Client reviews personalized PDF, signs exact hash, sees non-blocking countersign and returns from archive",async()=>{
  const page=await browser.newPage({viewport:{width:402,height:874}});
  let signed=false;const sent:any[]=[];
  await page.route("**/api/**",async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith("/pdf"))return route.fulfill({status:200,contentType:"application/pdf",body:"%PDF-1.4\n%%EOF"});
    if(url.pathname.endsWith("/sign")){sent.push(route.request().postDataJSON());signed=true;return route.fulfill({json:{id:"signature"}});}
    return route.fulfill({json:{document:{id:docId,version:"fixture-client-v1",sha256:sha,effectiveAt:"2026-01-01",viewUrl:`/api/client/msa/${docId}/pdf`},
      signature:signed?{id:"signature",signerName:"Fixture Client",signedAt:"2026-01-02"}:null,
      requiresSignature:!signed,issued:true,personalized:true,countersignature:null,countersignatureBlocksActivation:false,
      signerProfile:{userId:"fixture-client",legalName:"Profile Client",title:"Profile Director"},
      history:[{id:oldId,version:"legacy-v1",sha256:"b".repeat(64),effectiveAt:"2025-01-01",signedAt:"2025-01-02",signerName:"Fixture Client",personalized:false,status:"historical",viewUrl:`/api/client/msa/${oldId}/pdf`}] }});
  });
  await page.goto(`${origin}/__msa`);
  await page.getByText("Your client-specific agreement",{exact:true}).waitFor();
  await page.locator('iframe[title="Client MSA version fixture-client-v1"]').waitFor();
  assert.equal(await page.getByLabel("Full legal name",{exact:true}).inputValue(),"Profile Client");
  await page.getByLabel("Full legal name",{exact:true}).fill("Fixture Client");
  await page.getByLabel(/^Title/).fill("Manual Director");
  const canvas=page.getByLabel("Optional signature drawing area");
  await canvas.scrollIntoViewIfNeeded();
  const bounds=(await canvas.boundingBox())!;
  await page.mouse.move(bounds.x+15,bounds.y+25);await page.mouse.down();
  await page.mouse.move(bounds.x+55,bounds.y+40,{steps:5});await page.mouse.up();
  assert.equal(await page.getByRole("button",{name:"Sign current agreement"}).isDisabled(),true,"drawing never replaces consent");
  await page.getByRole("button",{name:"Clear drawn signature"}).click();
  await canvas.scrollIntoViewIfNeeded();
  const secondBounds=(await canvas.boundingBox())!;
  await page.mouse.move(secondBounds.x+20,secondBounds.y+20);await page.mouse.down();
  await page.mouse.move(secondBounds.x+70,secondBounds.y+45,{steps:5});await page.mouse.up();
  assert.equal(await page.getByRole("button",{name:"Clear drawn signature"}).isEnabled(),true);
  await page.getByRole("button",{name:"Refresh fixture",exact:true}).click();
  assert.equal(await page.getByLabel("Full legal name",{exact:true}).inputValue(),"Fixture Client","refetch must preserve edits");
  await page.getByRole("checkbox").check();
  await page.getByRole("button",{name:"Sign current agreement"}).click();
  await page.getByText("OnSpot countersignature is pending.",{exact:false}).waitFor();
  assert.equal(sent.length,1);assert.equal(sent[0].documentId,docId);assert.equal(sent[0].documentSha256,sha);
  assert.equal(sent[0].signerTitle,"Manual Director");assert.match(sent[0].drawnSignature,/^data:image\/png;base64,/);
  const png=Buffer.from(sent[0].drawnSignature.slice(22),"base64");assert.equal(png.readUInt32BE(16),1000);assert.equal(png.readUInt32BE(20),320);
  assert.equal(await page.getByRole("button",{name:"Open executed copy",exact:true}).count(),0,"a Client-only signature is not a fully executed MSA");
  assert.match(await page.locator("body").innerText(),/not required for activation/);
  await page.getByRole("button",{name:"Review signed copy"}).click();
  await page.locator('iframe[title="OnSpot MSA version legacy-v1"]').waitFor();
  await page.getByRole("button",{name:"Back to current agreement"}).click();
  await page.locator('iframe[title="Client MSA version fixture-client-v1"]').waitFor();
  await page.close();
});
test("Admin countersign requires review, name and consent; fresh generation needs explicit confirmation",async()=>{
  const page=await browser.newPage();
  let countersigned=false;const posts:any[]=[];
  const engagement={clientId:"fixture-client",submissionId:"fixture-submission",jobTitle:"Fixture role",clientName:"Fixture LLC"};
  await page.route("**/api/**",async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname.endsWith("/pdf"))return route.fulfill({status:200,contentType:"application/pdf",body:"%PDF-1.4\n%%EOF"});
    if(request.method()==="POST"){posts.push({path:url.pathname,body:request.postDataJSON()});if(url.pathname.endsWith("/countersign"))countersigned=true;return route.fulfill({json:{id:"fixture-signature"}});}
    if(url.pathname.endsWith("/authoring"))return route.fulfill({json:{draft:{id:"draft",status:"sent",rendered_document_id:docId},templates:[{id:"fixture-template",name:"Approved fixture MSA",version:"1"}]}});
    return route.fulfill({json:{engagements:[engagement],documents:[{id:docId,version:"fixture-v1",filename:"msa.pdf",sha256:sha,effectiveAt:"2026-01-01",
      clientId:engagement.clientId,clientName:engagement.clientName,status:"issued",templateVersion:"1",submissionId:engagement.submissionId,
      clientSignerName:"Fixture Client",clientSignedAt:"2026-01-02",onspotSignerName:countersigned?"Fixture OnSpot":null,onspotSignedAt:countersigned?"2026-01-03":null,viewUrl:`/api/client/msa/${docId}/pdf` }],countersignatureBlocksActivation:false}});
  });
  await page.goto(`${origin}/__msa?admin`);
  const button=page.getByRole("button",{name:"Record OnSpot countersignature"});await button.waitFor();assert.equal(await button.isDisabled(),true);
  await page.getByLabel("OnSpot legal name",{exact:true}).fill("Fixture OnSpot");
  await page.getByRole("checkbox").check();
  assert.equal(await button.isDisabled(),true,"review is mandatory");
  await page.getByRole("button",{name:"Open exact signed PDF"}).click();
  await button.click();
  assert.equal(posts[0].path,`/api/admin/msa-documents/${docId}/countersign`);
  assert.deepEqual(posts[0].body,{documentSha256:sha,legalName:"Fixture OnSpot",consent:true,drawnSignature:null});
  await page.getByText("OnSpot countersignature recorded.",{exact:false}).waitFor();
  await page.getByRole("button",{name:"Prepare a new version"}).click();
  assert.equal(posts.length,1,"opening replacement confirmation must not create a version");
  await page.getByLabel("Approved MSA template",{exact:true}).selectOption("fixture-template");
  await page.getByRole("button",{name:"Confirm and create fresh version"}).click();
  assert.equal(posts[1].body.submissionId,engagement.submissionId);
  assert.equal(posts[1].body.templateId,"fixture-template");
  await page.close();
});
test("unsaved authoring changes block issuing an already reviewed PDF",async()=>{
  const page=await browser.newPage();
  const engagement={clientId:"fixture-client",submissionId:"fixture-submission",jobTitle:"Fixture role",clientName:"Fixture LLC"};
  await page.route("**/api/**",async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith("/pdf"))return route.fulfill({status:200,contentType:"application/pdf",body:"%PDF-1.4\n%%EOF"});
    if(url.pathname.endsWith("/preview"))return route.fulfill({json:{html:"<p>Changed</p>",missingKeys:[],unknownKeys:[]}});
    if(url.pathname.endsWith("/authoring"))return route.fulfill({json:{
      draft:{id:"draft",status:"draft",revision:1,rendered_document_id:docId,kind:"msa",template_id:"fixture-template",
        field_values:{"client.legalEntityName":{value:"Fixture LLC",source:"profile",missing:false}},
        field_overrides:{},body_overrides:{}},templates:[],fields:[{key:"client.legalEntityName",label:"Client legal entity",type:"string",source:"client profile",required:true,editableBy:"preparer"}],
      clauses:[],preview:{html:"<p>Fixture LLC</p>",missingKeys:[],unknownKeys:[]},isAdmin:true }});
    return route.fulfill({json:{engagements:[engagement],documents:[{id:docId,version:"fixture-v1",filename:"msa.pdf",sha256:sha,effectiveAt:"2026-01-01",
      clientId:engagement.clientId,clientName:engagement.clientName,status:"draft",templateVersion:"1",submissionId:engagement.submissionId,
      clientSignedAt:null,onspotSignedAt:null,viewUrl:`/api/client/msa/${docId}/pdf`}]}});
  });
  await page.goto(`${origin}/__msa?admin`);
  await page.getByRole("button",{name:"Open exact draft PDF"}).click();
  await page.getByLabel("Issue review reason").fill("Fixture legal review");
  const issue=page.getByRole("button",{name:"Issue reviewed MSA"});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll("button")).some(b=>b.textContent?.includes("Issue reviewed MSA")&&!b.disabled));
  await page.getByLabel("Client legal entity").fill("Unsaved change");
  assert.equal(await issue.isDisabled(),true);
  await page.close();
});
