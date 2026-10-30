import type { HiringPaymentDb } from "./hiringPaymentService";
import { queueHiringLifecycleEvent } from "./hiringLifecycleEvents";

export function parseDepositReminderHours(value: unknown): number[] {
  const text=typeof value==="string"?value:"48,120";
  if(!/^\d+(,\d+)*$/.test(text))throw new Error("deposit_reminder_hours must be comma-separated positive whole hours");
  const hours=Array.from(new Set(text.split(",").map(Number))).sort((a,b)=>a-b);
  if(hours.some(h=>!Number.isSafeInteger(h)||h<1||h>8760)||hours.length>12)throw new Error("Invalid deposit reminder schedule");
  return hours;
}

/** No sending here. Unique transactional event keys make multiple workers safe. */
export async function enqueueDepositReminders(db:HiringPaymentDb) {
  const setting=(await db.query("SELECT value FROM platform_settings WHERE key='deposit_reminder_hours'")).rows[0]?.value;
  const hours=parseDepositReminderHours(setting);
  let queued=0;
  for(const hour of hours) {
    const rows=(await db.query(`SELECT d.id,d.amount,d.currency,js.id AS submission_id,js.client_id,
      o.id AS offer_id FROM security_deposits d
      LEFT JOIN hiring_contracts hc ON hc.id=d.hiring_contract_id
      JOIN job_submissions js ON js.id=coalesce(d.submission_id,hc.submission_id)
      JOIN offers o ON o.id=coalesce(d.offer_id,hc.offer_id)
      WHERE d.status='pending' AND o.status IN ('accepted','offer_accepted')
        AND js.status NOT IN ('withdrawn','rejected','declined')
        AND NOT EXISTS(SELECT 1 FROM hiring_payment_waivers w WHERE w.deposit_id=d.id AND w.scope='deposit'
          AND w.waiver_type='defer' AND w.revoked_at IS NULL)
        AND d.created_at<=now()-($1::int*interval '1 hour')
      ORDER BY d.created_at,d.id`,[hour])).rows;
    for(const d of rows)if(await queueHiringLifecycleEvent(db,`deposit-reminder:${d.id}:${hour}`,"deposit_reminder",
      {depositId:d.id,obligationId:d.id,submissionId:d.submission_id,offerId:d.offer_id,payerId:d.client_id,
        category:"deposit",amount:d.amount,currency:d.currency,hours:hour}))queued++;
  }
  return queued;
}

export async function enqueueDeferredDepositReminders(db:HiringPaymentDb) {
  let queued=0;
  for(const days of [3,7,14]) {
    const rows=(await db.query(`SELECT d.id,d.amount,d.currency,w.id AS waiver_id,w.deposit_due_at,
      w.submission_id,w.client_id FROM hiring_payment_waivers w JOIN security_deposits d ON d.id=w.deposit_id
      JOIN offers o ON o.id=d.offer_id JOIN job_submissions js ON js.id=w.submission_id
      WHERE w.scope='deposit' AND w.waiver_type='defer' AND w.revoked_at IS NULL AND d.status='pending'
      AND o.status IN('accepted','offer_accepted') AND js.status NOT IN('withdrawn','rejected','declined')
      AND w.granted_at<=now()-($1::int*interval '1 day')`,[days])).rows;
    for(const w of rows)queued+=Number(await queueHiringLifecycleEvent(db,`deferred-deposit-reminder:${w.waiver_id}:${days}`,"deposit_reminder",
      {submissionId:w.submission_id,depositId:w.id,payerId:w.client_id,amount:w.amount,currency:w.currency,
        dueDate:w.deposit_due_at,waiverId:w.waiver_id,deferred:true,days}));
  }
  const overdue=(await db.query(`SELECT w.id,w.submission_id,w.deposit_due_at FROM hiring_payment_waivers w
    JOIN security_deposits d ON d.id=w.deposit_id WHERE w.scope='deposit' AND w.waiver_type='defer'
    AND w.revoked_at IS NULL AND d.status='pending' AND w.deposit_due_at<=now()-interval '14 days'`)).rows;
  for(const w of overdue)queued+=Number(await queueHiringLifecycleEvent(db,`deferred-deposit-overdue:${w.id}`,"onboarding_setup_alert",
    {submissionId:w.submission_id,waiverId:w.id,reason:`Deferred deposit is 14 days overdue. Agreed due date: ${new Date(w.deposit_due_at).toISOString().slice(0,10)}`}));
  return queued;
}
