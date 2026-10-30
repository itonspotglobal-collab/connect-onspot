// Only called by the owned PostgreSQL harness. Runs the real npm start command,
// with native PostgreSQL transport, no inherited credentials, and no live data.
import {spawn} from "node:child_process";
import {mkdtemp,writeFile,readFile,readdir,mkdir,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import {createServer} from "node:net";
import {chromium} from "playwright";
const url=new URL(process.env.DATABASE_URL??"");
if(url.hostname!=="127.0.0.1"||url.pathname!=="/onspot_hiring_test"||
  process.env.DATABASE_URL!==process.env.HIRING_FLOW_TEST_DATABASE_URL)
  throw new Error("Production visual check requires the harness-owned disposable database");
const root=await mkdtemp(join(tmpdir(),"investors-production-"));
const require=createRequire(import.meta.url);
// The harness has already constructed the final schema and applied its SQL
// migrations. Represent that snapshot in its disposable ledger, rather than
// incorrectly replaying early reconciliation migrations over the final schema.
const fixtureDb=new(require("pg").Client)({connectionString:process.env.DATABASE_URL});
await fixtureDb.connect();
try{
  await fixtureDb.query("CREATE TABLE IF NOT EXISTS app_schema_migrations(id text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())");
  const ids=(await readdir("migrations")).filter(n=>n.endsWith(".sql")).map(n=>n.slice(0,-4));
  await fixtureDb.query("INSERT INTO app_schema_migrations(id) SELECT unnest($1::text[]) ON CONFLICT DO NOTHING",[ids]);
}finally{await fixtureDb.end();}
const original=import.meta.resolve("@neondatabase/serverless");
const pg=pathToFileURL(require.resolve("pg")).href;
await writeFile(join(root,"native.mjs"),`export * from ${JSON.stringify(original)};import pg from ${JSON.stringify(pg)};export const Pool=pg.Pool;`);
await writeFile(join(root,"loader.mjs"),`export async function resolve(s,c,n){return s==="@neondatabase/serverless"?{url:${JSON.stringify(pathToFileURL(join(root,"native.mjs")).href)},shortCircuit:true}:n(s,c);}`);
await writeFile(join(root,"register.mjs"),`import{register}from"node:module";register(${JSON.stringify(pathToFileURL(join(root,"loader.mjs")).href)});`);
const socket=createServer();await new Promise(r=>socket.listen(0,"127.0.0.1",r));
const port=socket.address().port;await new Promise(r=>socket.close(r));
const dir=resolve("generated-artifacts/investors");await mkdir(dir,{recursive:true});
const label=process.env.INVESTOR_CAPTURE_LABEL==="before"?"before":"after";
let logs="",app,browser;
try {
  app=spawn("npm",["run","start"],{detached:true,env:{...process.env,PORT:String(port),
    NODE_OPTIONS:`--import=${join(root,"register.mjs")}`,RUN_BACKGROUND_JOBS:"false",
    OPENAI_API_KEY:"isolated-test-not-a-real-key",SESSION_SECRET:"isolated-test-session-only",
    REPLIT_DB_URL:"http://127.0.0.1:9",
    REPLIT_DOMAINS:"127.0.0.1",REPL_ID:"isolated-investor-visual-check",
  },stdio:["ignore","pipe","pipe"]});
  for(const stream of [app.stdout,app.stderr])stream.on("data",b=>{logs+=b.toString()});
  const base=`http://127.0.0.1:${port}`;
  let ready=false;
  for(let i=0;i<600;i++) {
    if(app.exitCode!==null)throw new Error(`npm start exited ${app.exitCode}: ${logs.slice(-6000)}`);
    try{const r=await fetch(`${base}/investors`);if(r.ok){ready=true;break}}catch{}
    await new Promise(r=>setTimeout(r,200));
  }
  if(!ready)throw new Error(`npm start readiness timeout: ${logs.slice(-6000)}`);
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const result=[];
  for(const width of [1440,390,320,768,1024]) {
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:"reduce"}),errors=[],network=[];
    page.on("pageerror",e=>errors.push(e.message));
    page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
    page.on("response",r=>{if(r.status()>=400||r.url().includes("/api/public/investor"))network.push({url:r.url().replace(base,"LOCAL_PRODUCTION"),status:r.status()})});
    await page.goto(`${base}/investors`,{waitUntil:"domcontentloaded"});
    await page.locator("h1").waitFor();
    // Trigger real image loading below the fold before evaluating persistence.
    await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,30))}scrollTo(0,0);await document.fonts.ready;});
    await page.waitForTimeout(1500);
    if(width===1440||width===390) {
      await page.screenshot({path:join(dir,`${label}-production-${width}.jpg`),fullPage:true,quality:85});
      await page.screenshot({path:join(dir,`${label}-production-${width}-hero.jpg`),quality:85});
    }
    const metrics=await page.evaluate(()=>({
      width:innerWidth,scrollWidth:document.documentElement.scrollWidth,h1:document.querySelector("h1")?.textContent,
      headings:document.querySelectorAll("h1").length,heroImages:document.querySelectorAll(".investor-open img").length,
      founderImages:document.querySelectorAll(".investor-vision-section .investor-sign img").length,
      brokenImages:[...document.images].filter(i=>i.currentSrc&&(!i.complete||!i.naturalWidth)).map(i=>i.currentSrc),
      styles:Object.fromEntries([".investor-open","h1",".investor-phone-stage",".investor-letter-inset",".investor-cta-panel"].map(s=>{
        const e=document.querySelector(s);if(!e)return[s,null];const c=getComputedStyle(e),r=e.getBoundingClientRect();
        return[s,{fontSize:c.fontSize,fontWeight:c.fontWeight,lineHeight:c.lineHeight,margin:c.margin,background:c.backgroundImage,width:r.width,height:r.height}];
      })),
    }));
    result.push({width,errors,network,...metrics});
    if(label==="after"){
      if(metrics.scrollWidth>width)throw new Error(`Horizontal overflow at ${width}: ${metrics.scrollWidth}`);
      if(metrics.headings!==1||metrics.heroImages!==1)throw new Error(`Hero semantics failed at ${width}`);
      if(metrics.brokenImages.length)throw new Error(`Broken production images at ${width}: ${metrics.brokenImages.join(", ")}`);
    }
    await page.close();
  }
  await writeFile(join(dir,`${label}-production-metrics.json`),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally {
  await browser?.close();
  if(app?.pid){try{process.kill(-app.pid,"SIGTERM")}catch{}}
  await writeFile(join(dir,`${label}-production-server.log`),logs);
  await rm(root,{recursive:true,force:true});
}
