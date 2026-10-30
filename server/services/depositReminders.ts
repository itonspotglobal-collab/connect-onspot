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
        AND d.created_at<=now()-($1::int*interval '1 hour')
      ORDER BY d.created_at,d.id`,[hour])).rows;
    for(const d of rows)if(await queueHiringLifecycleEvent(db,`deposit-reminder:${d.id}:${hour}`,"deposit_reminder",
      {depositId:d.id,obligationId:d.id,submissionId:d.submission_id,offerId:d.offer_id,payerId:d.client_id,
        category:"deposit",amount:d.amount,currency:d.currency,hours:hour}))queued++;
  }
  return queued;
}
