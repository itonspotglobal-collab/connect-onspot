// Actual Client dialog, isolated Vite/browser; HTTP responses are test doubles.
import {mkdtemp,writeFile,symlink,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {createServer} from "vite";
import {chromium} from "playwright";
import assert from "node:assert/strict";
const root=await mkdtemp(join(tmpdir(),"onspot-interview-ui-"));
let server,browser;
try {
  await symlink(resolve("node_modules"),join(root,"node_modules"),"dir");
  await writeFile(join(root,"index.html"),'<div id="root"></div><script type="module" src="/main.tsx"></script>');
  await writeFile(join(root,"main.tsx"),`
    import React from 'react';import{createRoot}from'react-dom/client';
    import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
    import{RequestInterviewDialog}from'/@fs/${resolve("client/src/components/InterviewWorkflowUi.tsx")}';
    const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
    createRoot(document.getElementById('root')).render(<QueryClientProvider client={cache}>
      <RequestInterviewDialog open onOpenChange={()=>{}} submissionId="fixture-app"
        context={{applicantName:"Fixture Talent",position:"Fixture Job",company:"Fixture",currentStatus:"under_review"}}
        onScheduled={()=>window.schedulingFinished=true}/>
    </QueryClientProvider>);
  `);
  server=await createServer({configFile:false,root,cacheDir:join(root,"vite-cache"),
    resolve:{alias:{"@":resolve("client/src"),"@shared":resolve("shared")}},
    esbuild:{jsx:"automatic"},server:{host:"127.0.0.1",port:0,fs:{allow:[root,process.cwd()]}}});
  await server.listen();
  browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  const page=await browser.newPage(),calls=[];
  await page.route("**/api/**",async route=>{
    const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
    calls.push({path,method,body:request.postDataJSON()});
    let status=200,body={};
    if(path==="/api/client/interviews"&&method==="POST") {
      const attempts=calls.filter(c=>c.path===path&&c.method===method).length;
      if(attempts===1){status=409;body={error:"SHORTLIST_REQUIRED",message:"Shortlist this applicant first"};}
      else body={id:"fixture-interview",status:"proposed"};
    } else if(path==="/api/client/job-submissions"&&method==="GET")
      body=[{id:"fixture-app",status:"under_review",statusVersion:"fixture-version"}];
    else if(path==="/api/client/job-submissions/fixture-app/status") {
      assert.equal(request.postDataJSON().status,"shortlisted");
      assert.equal(request.postDataJSON().expectedVersion,"fixture-version");
      assert.ok(request.postDataJSON().operationId);
      body={success:true,status:"shortlisted"};
    } else throw new Error(`Unexpected test request ${method} ${path}`);
    await route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
  await page.locator('input[type="date"]').fill("2099-01-03");
  await page.locator('input[type="time"]').fill("12:30");
  await page.locator('button[type="submit"]').click();
  await page.getByRole("button",{name:"Shortlist",exact:true}).click();
  await page.waitForFunction(()=>window.schedulingFinished===true);
  assert.deepEqual(calls.map(c=>`${c.method} ${c.path}`),[
    "POST /api/client/interviews","GET /api/client/job-submissions",
    "PATCH /api/client/job-submissions/fixture-app/status","POST /api/client/interviews",
  ]);
  assert.deepEqual(calls[0].body,calls[3].body);
  console.log("PASS actual Client dialog: SHORTLIST_REQUIRED → audited status API → same scheduling request retried.");
  console.log("Isolated browser test with mocked HTTP; not an authenticated account or real-email UAT.");
} finally {
  await browser?.close();await server?.close();await rm(root,{recursive:true,force:true});
}
