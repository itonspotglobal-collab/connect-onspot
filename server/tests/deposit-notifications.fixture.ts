/** Real disposable PostgreSQL/outbox; Graph transport is a deterministic double. */
import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {pool,query} from "./fixtures/hiring-db";
import {enqueueDepositReminders,parseDepositReminderHours} from "../services/depositReminders";
import {DEFAULT_TEMPLATES} from "../seeds/seedEmailTemplates";
import {renderApplicantEmail} from "../services/emailVariableResolver";
import * as urls from "../lib/appUrl";
import {REVEAL_STATUS_ORDER,revealedStatusesForThreshold} from "../../shared/submissionStatuses";
const client=`reminder-client-${randomUUID()}`,talent=`reminder-talent-${randomUUID()}`,job=`reminder-job-${randomUUID()}`;
let deposit:string,submission:string,offer:string;
const sent:{to:string;subject:string;bodyHtml:string}[]=[];
let deliver:(e:any)=>Promise<void>;
before(async()=>{
  await query(`CREATE TABLE IF NOT EXISTS email_notification_deliveries(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_key text UNIQUE,event_type text,
    recipient_email text,recipient_user_id varchar,sender_email text,template_category text,
    template_id uuid,related_type text,related_id text,status text,attempted_at timestamptz,
    subject text,body_html text,sent_at timestamptz,error text)`);
  for(const [id,role] of [[client,"client"],[talent,"talent"]])await query("INSERT INTO users(id,email,role,first_name) VALUES($1,$2,$3,'PrivateName')",[id,`${id}@fixture.invalid`,role]);
  await query(`INSERT INTO jobs(id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode)
    VALUES($1,$2,'Reminder fixture','Test','Operations','Intermediate','open','approved','Standard','tracked')`,[job,client]);
  submission=(await query(`INSERT INTO job_submissions(job_id,client_id,talent_id,email,applicant_name,status)
    VALUES($1,$2,$3,$4,'Fixture','offer_accepted') RETURNING id`,[job,client,talent,`${talent}@fixture.invalid`])).rows[0].id;
  offer=(await query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode,proposed_start_date)
    VALUES($1,'accepted',2500,'USD','Standard','tracked','2099-01-01') RETURNING id`,[submission])).rows[0].id;
  deposit=(await query(`INSERT INTO security_deposits(offer_id,submission_id,amount,currency,status,created_at)
    VALUES($1,$2,100,'USD','pending',now()-interval '49 hours') RETURNING id`,[offer,submission])).rows[0].id;
  await query(`INSERT INTO platform_settings(key,value) VALUES('deposit_reminder_hours','48,120'),('name_reveal_threshold','hired')
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  for(const t of DEFAULT_TEMPLATES.filter(t=>["hiring_offer_accepted","hiring_talent_accepted","hiring_deposit_required","hiring_deposit_reminder"].includes(t.category)))
    await query(`INSERT INTO applicant_email_templates(name,category,subject,body_html,is_default,is_published,is_archived)
      VALUES($1,$2,$3,$4,true,true,false)`,[t.name,t.category,t.subject,t.bodyHtml]);
  const ast=ts.createSourceFile("dispatch.ts",readFileSync("server/services/hiringLifecycleDispatch.ts","utf8"),ts.ScriptTarget.Latest,true);
  const funcs=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&["notify","deliverEvent","obligationJob"].includes(n.name?.text??"")).map(n=>n.getText(ast)).join("\n");
  const deps={query,pool,...urls,renderApplicantEmail,REVEAL_STATUS_ORDER,revealedStatusesForThreshold,
    isEmailServiceConfigured:()=>true,sendApplicantEmail:async(m:any)=>{sent.push(m);return {success:true};}};
  deliver=new Function(...Object.keys(deps),ts.transpileModule(`${funcs}\nreturn deliverEvent`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(...Object.values(deps));
});
after(()=>pool.end());
const payload=()=>({submissionId:submission,offerId:offer,depositId:deposit,obligationId:deposit,payerId:client,category:"deposit",amount:"100",currency:"USD"});
test("separate acceptance and deposit notifications are recipient-deduplicated and preserve name masking",async()=>{
  const acceptance={event_key:`acceptance:${offer}`,event_type:"offer_accepted",payload:payload()};
  const invoice={event_key:`deposit:${deposit}`,event_type:"deposit_issued",payload:payload()};
  await deliver(acceptance);await deliver(invoice);await deliver(acceptance);await deliver(invoice);
  assert.equal(sent.length,3); // client acceptance, talent confirmation, client invoice
  assert.equal(sent.filter(m=>m.to===`${client}@fixture.invalid`).length,2);
  assert.ok(sent.every(m=>!m.subject.includes("PrivateName")));
  assert.match(sent.find(m=>m.subject.includes("Deposit payment required"))!.bodyHtml,new RegExp(`/client/payments/deposit/${deposit}`));
  assert.equal((await query("SELECT count(*)::int n FROM notifications WHERE event_key LIKE $1 OR event_key LIKE $2",[`acceptance:${offer}:%`,`deposit:${deposit}:%`])).rows[0].n,3);
});
test("48/120-hour reminders enqueue once and delivery stops after settlement or withdrawal",async()=>{
  assert.equal(await enqueueDepositReminders(pool),1);assert.equal(await enqueueDepositReminders(pool),0);
  await query("UPDATE security_deposits SET created_at=now()-interval '121 hours' WHERE id=$1",[deposit]);
  assert.equal(await enqueueDepositReminders(pool),1);
  const e=(await query("SELECT * FROM hiring_lifecycle_events WHERE event_key=$1",[`deposit-reminder:${deposit}:48`])).rows[0];
  await deliver(e);await deliver(e);assert.equal(sent.length,4);
  await query("UPDATE security_deposits SET status='held' WHERE id=$1",[deposit]);
  assert.equal(await enqueueDepositReminders(pool),0);
  await deliver({...e,event_key:"after-held"});assert.equal(sent.length,4);
  await query("UPDATE security_deposits SET status='pending' WHERE id=$1",[deposit]);
  await query("UPDATE job_submissions SET status='withdrawn' WHERE id=$1",[submission]);
  await deliver({...e,event_key:"after-withdrawn"});assert.equal(sent.length,4);
  assert.equal(await enqueueDepositReminders(pool),0);
  assert.deepEqual(parseDepositReminderHours("120,48,48"),[48,120]);
  assert.throws(()=>parseDepositReminderHours("0,garbage"));
});
