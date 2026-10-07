import { after, beforeEach, it, mock } from "node:test";
import assert from "node:assert/strict";

const sent: Array<{to:string;bodyHtml:string;subject:string}> = [];
const statuses: string[] = [];
let released = false;
const oldOrigin = process.env.PUBLIC_APP_URL;
mock.module("../db", { namedExports: { getClient: async () => ({
  query: async (sql:string, params?:unknown[]) => {
    if(sql.includes("SELECT e.id")) return {rows:[{id:"event-123"}]};
    if(sql.includes("SELECT e.*,u.email")) return {rows:[{id:"event-123",email:"fixture@example.test",event_type:"executed"}]};
    if(sql.startsWith("UPDATE contract_delivery_events")) statuses.push(String(params?.[0]));
    return {rows:[]};
  },
  release: () => {released=true;},
}) } });
mock.module("../services/microsoftGraphEmailService", { namedExports: {
  isEmailServiceConfigured:()=>true,
  sendApplicantEmail:async (args:any)=>{sent.push(args);return {success:true};},
} });
const {deliverContractEmails} = await import("../services/contractDeliveryService");
beforeEach(()=>{sent.length=0;statuses.length=0;released=false;process.env.PUBLIC_APP_URL="https://correct-domain.example///";});
after(()=>{if(oldOrigin===undefined) delete process.env.PUBLIC_APP_URL; else process.env.PUBLIC_APP_URL=oldOrigin;});

it("generates the real contract delivery CTA for the exact private contract on the configured origin",async()=>{
  assert.deepEqual(await deliverContractEmails("contract-123"),{status:"accepted"});
  assert.equal(sent.length,1);
  assert.match(sent[0].bodyHtml,/href="https:\/\/correct-domain.example\/contracts\?id=contract-123"/);
  assert.match(sent[0].bodyHtml,/executed/);
  assert.doesNotMatch(sent[0].bodyHtml,/talent.onspotglobal.com/);
  assert.deepEqual(statuses,["accepted"]);
  assert.equal(released,true);
});

it("records failure instead of sending a fallback or malformed link when origin configuration is missing",async()=>{
  delete process.env.PUBLIC_APP_URL;
  assert.deepEqual(await deliverContractEmails("contract-123"),{status:"failed"});
  assert.equal(sent.length,0);
  assert.deepEqual(statuses,["failed"]);
  assert.equal(released,true);
});
