import { hiringFeePolicyInput, hiringPaymentReviewInput, OFFERABLE_PAYMENT_STAGES } from "../../shared/hiringPayments";
import { FORMAL_PIPELINE_PREDICATE } from "../../shared/formalPipelineSql";

// Inject the database so disposable PostgreSQL fixtures exercise the same service.
export interface HiringPaymentDb {
  query(sql: string, values?: any[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}
interface PaymentPool extends HiringPaymentDb {
  connect(): Promise<HiringPaymentDb & { release(): void }>;
}
export class HiringPaymentError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, unknown>) { super(message); }
}
const fail = (status: number, code: string, message: string): never => { throw new HiringPaymentError(status, code, message); };
const moneyCents = (value: string) => {
  const [whole, decimal = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(decimal.padEnd(2, "0"));
};
export const PAYMENT_REQUIRED_MESSAGE = "Your hiring invoice must be paid and verified before you can send an offer to this talent.";

export async function requireVerifiedHiringPayment(db: HiringPaymentDb, submissionId: string) {
  // Same lock ordering as issuance and review. Holds until caller's transaction ends.
  const { rows: [s] } = await db.query("SELECT * FROM job_submissions WHERE id=$1 FOR UPDATE", [submissionId]);
  if (!s) return fail(404, "APPLICATION_NOT_FOUND", "Application not found.");
  const result = await db.query(`SELECT i.id FROM hiring_pre_offer_invoices i
    JOIN hiring_payment_attempts a ON a.id=i.attempt_id
    WHERE i.submission_id=$1 AND a.submission_id=$1
      AND i.client_id=$2 AND a.client_id=$2 AND i.job_id=$3 AND a.job_id=$3
      AND i.talent_id=$4 AND a.talent_id=$4
      AND i.invoice_type='hiring_pre_offer' AND i.status='paid'
      AND i.verified_at IS NOT NULL AND i.verified_by IS NOT NULL
      AND i.amount>0 AND i.verified_amount=i.amount AND i.verified_currency=i.currency
      AND length(trim(i.verified_reference))>0 AND i.verified_recipient=i.payment_recipient
    FOR SHARE OF i`, [s.id, s.client_id, s.job_id, s.talent_id]);
  if (!result.rows.length) return fail(409, "PRE_OFFER_PAYMENT_REQUIRED", PAYMENT_REQUIRED_MESSAGE);
  return result.rows[0].id as string;
}

// The canonical predicate is pure; importing its DB-backed route loader here would
// initialize an unrelated database in disposable service fixtures.
export class HiringPaymentService {
  constructor(private pool: PaymentPool) {}
  private async transaction<T>(fn: (db: HiringPaymentDb) => Promise<T>) {
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN");
      const result = await fn(db);
      await db.query("COMMIT");
      return result;
    } catch (error) {
      await db.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { db.release(); }
  }
  async actor(db: HiringPaymentDb, id: string, admin = false) {
    const { rows: [actor] } = await db.query("SELECT id,role,admin_sub_role FROM users WHERE id=$1", [id]);
    if (!actor || (admin ? actor.role !== "admin" || actor.admin_sub_role !== null : actor.role !== "client")) {
      return fail(403, "FORBIDDEN", admin ? "Only an explicitly authorized Super Admin may manage hiring payments." : "Client account required.");
    }
    return actor;
  }
  async policy(actorId: string) {
    await this.actor(this.pool, actorId, true);
    return (await this.pool.query("SELECT * FROM hiring_fee_policies ORDER BY created_at DESC,id DESC LIMIT 1")).rows[0] ?? null;
  }
  async configure(actorId: string, input: unknown) {
    const p = hiringFeePolicyInput.safeParse(input);
    if (!p.success) return fail(422, "BILLING_POLICY_INVALID", p.error.issues.map(i => i.message).join(" "));
    return this.transaction(async db => {
      await this.actor(db, actorId, true);
      await db.query("SELECT pg_advisory_xact_lock(hashtext('hiring-fee-policy'))");
      const v = p.data;
      return (await db.query(`INSERT INTO hiring_fee_policies
        (amount,currency,fee_basis,fee_description,tax_treatment,tax_description,due_days,
         payment_method,payment_recipient,payment_instructions,authorized_by,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,clock_timestamp()) RETURNING *`,
      [v.amount,v.currency,v.feeBasis,v.feeDescription,v.taxTreatment,v.taxDescription,v.dueDays,
        v.paymentMethod,v.paymentRecipient,v.paymentInstructions,actorId])).rows[0];
    });
  }
  private async ownedSubmission(db: HiringPaymentDb, actorId: string, id: string) {
    await this.actor(db, actorId);
    const { rows: [s] } = await db.query("SELECT * FROM job_submissions WHERE id=$1 AND client_id=$2 FOR UPDATE", [id, actorId]);
    if (!s) return fail(404, "APPLICATION_NOT_FOUND", "Application not found.");
    return s;
  }
  private async event(db: HiringPaymentDb, invoice: any, actorId: string, event: string, previous: string | null, details: unknown = {}) {
    await db.query(`INSERT INTO hiring_payment_events(invoice_id,actor_id,event,previous_status,new_status,details)
      VALUES($1,$2,$3,$4,$5,$6)`, [invoice.id,actorId,event,previous,invoice.status,JSON.stringify(details)]);
  }
  private async notify(db: HiringPaymentDb, invoice: any, type: string, title: string, message: string, admins = false) {
    await db.query(`INSERT INTO notifications(user_id,type,title,message,related_id,related_type)
      SELECT id,$1,$2,$3,$4,'hiring_pre_offer' FROM users WHERE
      ${admins ? "role='admin' AND admin_sub_role IS NULL" : "id=$5"}`,
    admins ? [type,title,message,invoice.id] : [type,title,message,invoice.id,invoice.client_id]);
  }
  async ready(actorId: string, submissionId: string) {
    return this.transaction(async db => {
      const s = await this.ownedSubmission(db,actorId,submissionId);
      const eligibility = await db.query(`SELECT js.id FROM job_submissions js WHERE js.id=$1 AND js.${FORMAL_PIPELINE_PREDICATE}`, [s.id]);
      if (!OFFERABLE_PAYMENT_STAGES.includes(s.status as any) || !s.talent_id ||
          !eligibility.rows.length) {
        return fail(409, "APPLICATION_NOT_OFFER_ELIGIBLE", "This original application is not eligible for an offer.");
      }
      const { rows: [job] } = await db.query("SELECT id,client_id,status,engagement_type,billing_mode FROM jobs WHERE id=$1",[s.job_id]);
      if (!job || !["Lite","Standard"].includes(job.engagement_type) || !["tracked","guaranteed"].includes(job.billing_mode)) {
        throw new HiringPaymentError(409,"JOB_BILLING_CLASSIFICATION_REQUIRED",
          "The job needs a valid engagement type and billing mode before a hiring invoice can be issued.", {
            jobId: s.job_id,
            engagementType: job?.engagement_type ?? null,
            billingMode: job?.billing_mode ?? null,
            missingFields: [
              ...(["Lite","Standard"].includes(job?.engagement_type) ? [] : ["engagementType"]),
              ...(["tracked","guaranteed"].includes(job?.billing_mode) ? [] : ["billingMode"]),
            ],
            // Reuse the existing owner-aware editor and its approval/lifecycle
            // checks, never a financial override or a guessed classification.
            editPath: job?.client_id === actorId && ["draft","open","published","closed"].includes(job.status)
              ? `/client/jobs/${encodeURIComponent(s.job_id)}/edit` : null,
          });
      }
      // No new interview prerequisite: use the existing formal/stage eligibility.
      const existing = await db.query(`SELECT i.* FROM hiring_pre_offer_invoices i
        JOIN hiring_payment_attempts a ON a.id=i.attempt_id
        WHERE a.submission_id=$1 AND i.status NOT IN ('void','refunded','invalidated') FOR UPDATE OF i`, [s.id]);
      if (existing.rows[0]) {
        const i = existing.rows[0];
        if (i.client_id !== s.client_id || i.talent_id !== s.talent_id || i.job_id !== s.job_id) {
          return fail(409, "HIRING_ATTEMPT_IDENTITY_CHANGED", "The hiring identity changed. OnSpot must review this invoice before proceeding.");
        }
        return this.clientInvoice(i);
      }
      const { rows: [policy] } = await db.query("SELECT * FROM hiring_fee_policies ORDER BY created_at DESC,id DESC LIMIT 1 FOR SHARE");
      if (!policy) return fail(409, "HIRING_BILLING_POLICY_REQUIRED",
        "An authorized hiring fee policy is not configured. Contact OnSpot before an invoice can be issued.");
      const inserted = await db.query(`INSERT INTO hiring_payment_attempts(submission_id,job_id,client_id,talent_id,ready_by)
        VALUES($1,$2,$3,$4,$3) ON CONFLICT(submission_id) DO NOTHING
        RETURNING *`, [s.id,s.job_id,s.client_id,s.talent_id]);
      const attempt = inserted.rows[0] ?? (await db.query("SELECT * FROM hiring_payment_attempts WHERE submission_id=$1",[s.id])).rows[0];
      if (attempt.client_id !== s.client_id || attempt.job_id !== s.job_id || attempt.talent_id !== s.talent_id) {
        return fail(409, "HIRING_ATTEMPT_IDENTITY_CHANGED", "The original hiring identity has changed; OnSpot must review this attempt.");
      }
      const { rows: [invoice] } = await db.query(`INSERT INTO hiring_pre_offer_invoices
        (attempt_id,submission_id,job_id,client_id,talent_id,policy_id,fee_description,amount,currency,
         fee_basis,tax_treatment,tax_description,due_date,payment_method,payment_recipient,payment_instructions)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now()+$13*interval '1 day',$14,$15,$16) RETURNING *`,
      [attempt.id,s.id,s.job_id,s.client_id,s.talent_id,policy.id,policy.fee_description,policy.amount,policy.currency,
        policy.fee_basis,policy.tax_treatment,policy.tax_description,policy.due_days,policy.payment_method,
        policy.payment_recipient,policy.payment_instructions]);
      await this.event(db,invoice,actorId,"invoice_issued",null,{ policyId: policy.id });
      await this.notify(db,invoice,"hiring_invoice","Hiring invoice issued",
        "Your pre-offer hiring invoice is ready. Payment must be independently verified before an offer can be sent.");
      return this.clientInvoice(invoice);
    });
  }
  private clientInvoice(i: any) {
    // Explicit allowlist: no verifier identity, internal comments or Admin notes.
    const fields = ["id","invoice_type","attempt_id","submission_id","job_id","invoice_number","fee_description",
      "amount","currency","fee_basis","tax_treatment","tax_description","status","issued_at","due_date",
      "payment_method","payment_recipient","payment_instructions","payment_reference","verified_at","created_at","updated_at",
      "job_title","ready_at"];
    return Object.fromEntries(fields.filter(k => k in i).map(k => [k,i[k]]));
  }
  async list(actorId: string, admin: boolean, filters: Record<string,string> = {}) {
    await this.actor(this.pool,actorId,admin);
    const params: string[] = [];
    const conditions: string[] = [];
    const add = (column: string, value: string) => { params.push(value); conditions.push(`${column}=$${params.length}`); };
    if (!admin) add("i.client_id",actorId);
    for (const [key,column] of Object.entries({ submissionId:"i.submission_id", status:"i.status", clientId:"i.client_id", talentId:"i.talent_id", jobId:"i.job_id" })) {
      if (filters[key] && (admin || key === "submissionId")) add(column,filters[key]);
    }
    const items = (await this.pool.query(`SELECT i.*,j.title AS job_title,js.applicant_name AS talent_name,
      u.company AS client_name,a.ready_at,
      (i.status IN ('issued','payment_failed') AND i.due_date<now()) AS is_overdue
      FROM hiring_pre_offer_invoices i JOIN job_submissions js ON js.id=i.submission_id
      JOIN jobs j ON j.id=i.job_id JOIN users u ON u.id=i.client_id
      JOIN hiring_payment_attempts a ON a.id=i.attempt_id
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY i.created_at DESC LIMIT 200`,params)).rows;
    return admin ? items : items.map(i => ({ ...this.clientInvoice(i), is_overdue: i.is_overdue }));
  }
  async detail(actorId: string, id: string, admin: boolean) {
    await this.actor(this.pool,actorId,admin);
    const { rows: [invoice] } = await this.pool.query(`SELECT * FROM hiring_pre_offer_invoices
      WHERE id=$1 ${admin ? "" : "AND client_id=$2"}`,admin ? [id] : [id,actorId]);
    if (!invoice) return fail(404,"INVOICE_NOT_FOUND","Invoice not found.");
    const history = (await this.pool.query(`SELECT ${admin ? "*" : "id,event,previous_status,new_status,created_at"}
      FROM hiring_payment_events WHERE invoice_id=$1 ORDER BY id`,[id])).rows;
    return { invoice: admin ? invoice : this.clientInvoice(invoice), history };
  }
  async reference(actorId: string, id: string, reference: unknown) {
    if (typeof reference !== "string" || !reference.trim() || reference.length > 1000) return fail(422,"REFERENCE_REQUIRED","Enter a payment reference (up to 1000 characters).");
    return this.transaction(async db => {
      await this.actor(db,actorId);
      const found = (await db.query("SELECT submission_id FROM hiring_pre_offer_invoices WHERE id=$1 AND client_id=$2",[id,actorId])).rows[0];
      if (!found) return fail(404,"INVOICE_NOT_FOUND","Invoice not found.");
      await this.ownedSubmission(db,actorId,found.submission_id);
      const { rows: [invoice] } = await db.query("SELECT * FROM hiring_pre_offer_invoices WHERE id=$1 FOR UPDATE",[id]);
      if (!["issued","overdue","payment_failed"].includes(invoice.status)) return fail(409,"PAYMENT_REFERENCE_NOT_ALLOWED","This invoice is not awaiting a payment reference.");
      const updated = (await db.query(`UPDATE hiring_pre_offer_invoices SET status='verification_pending',
        payment_reference=$2,updated_at=now() WHERE id=$1 RETURNING *`,[id,reference.trim()])).rows[0];
      await this.event(db,updated,actorId,"payment_reference_submitted",invoice.status,{ reference: reference.trim() });
      await this.notify(db,updated,"hiring_payment_review","Hiring payment requires review",
        "A Client submitted a pre-offer payment reference. Independently verify receipt before confirming.",true);
      return this.clientInvoice(updated);
    });
  }
  async review(actorId: string, id: string, input: unknown) {
    const parsed = hiringPaymentReviewInput.safeParse(input);
    if (!parsed.success) return fail(422,"PAYMENT_REVIEW_INVALID",parsed.error.issues.map(i => i.message).join(" "));
    return this.transaction(async db => {
      await this.actor(db,actorId,true);
      const found = (await db.query("SELECT submission_id FROM hiring_pre_offer_invoices WHERE id=$1",[id])).rows[0];
      if (!found) return fail(404,"INVOICE_NOT_FOUND","Invoice not found.");
      await db.query("SELECT id FROM job_submissions WHERE id=$1 FOR UPDATE",[found.submission_id]);
      const { rows: [invoice] } = await db.query("SELECT * FROM hiring_pre_offer_invoices WHERE id=$1 FOR UPDATE",[id]);
      const p = parsed.data;
      const newStatus = { verify:"paid",reject:"payment_failed",void:"void",refund:"refunded",invalidate:"invalidated" }[p.action];
      if (p.action === "verify" && invoice.status === "paid") {
        if (invoice.verified_reference !== p.verifiedReference || moneyCents(invoice.amount) !== moneyCents(p.verifiedAmount!) ||
            invoice.currency !== p.verifiedCurrency || invoice.payment_recipient !== p.verifiedRecipient) {
          return fail(409,"PAYMENT_ALREADY_VERIFIED","This invoice already has different verification evidence.");
        }
        return invoice;
      }
      const unpaid = ["draft","issued","overdue","verification_pending","payment_failed"].includes(invoice.status);
      if (p.action === "verify" ? !["verification_pending","issued","overdue","payment_failed"].includes(invoice.status)
        : p.action === "reject" ? invoice.status !== "verification_pending"
        : p.action === "void" ? !unpaid
        : invoice.status !== "paid") return fail(409,"INVALID_PAYMENT_TRANSITION","This payment action is not valid for the current invoice status.");
      if (p.action === "verify" && (moneyCents(invoice.amount) !== moneyCents(p.verifiedAmount!) ||
          invoice.currency !== p.verifiedCurrency || invoice.payment_recipient !== p.verifiedRecipient)) {
        return fail(409,"PAYMENT_DETAILS_MISMATCH","Settled amount, currency and recipient must exactly match this invoice.");
      }
      const updated = (await db.query(`UPDATE hiring_pre_offer_invoices SET status=$2,updated_at=now(),
        verified_amount=CASE WHEN $2='paid' THEN $3::numeric ELSE verified_amount END,
        verified_currency=CASE WHEN $2='paid' THEN $4 ELSE verified_currency END,
        verified_reference=CASE WHEN $2='paid' THEN $5 ELSE verified_reference END,
        verified_recipient=CASE WHEN $2='paid' THEN $6 ELSE verified_recipient END,
        verified_at=CASE WHEN $2='paid' THEN now() ELSE verified_at END,
        verified_by=CASE WHEN $2='paid' THEN $7 ELSE verified_by END
        WHERE id=$1 RETURNING *`,[id,newStatus,p.verifiedAmount ?? null,p.verifiedCurrency ?? null,
        p.verifiedReference ?? null,p.verifiedRecipient ?? null,actorId])).rows[0];
      await this.event(db,updated,actorId,`payment_${p.action}`,invoice.status,p);
      if (["refund","invalidate"].includes(p.action)) {
        await db.query(`INSERT INTO hiring_payment_exceptions(submission_id,invoice_id,reason)
          VALUES($1,$2,$3)`,[invoice.submission_id,id,`${p.action}: ${p.reason}`]);
      }
      await this.notify(db,updated,"hiring_invoice","Hiring payment status updated",
        newStatus === "paid" ? "Payment verified. You may now send an eligible formal offer." : `Your hiring invoice status is now ${newStatus}.`);
      return updated;
    });
  }
  async exceptions(actorId: string) {
    await this.actor(this.pool,actorId,true);
    return (await this.pool.query("SELECT * FROM hiring_payment_exceptions ORDER BY created_at DESC LIMIT 200")).rows;
  }
}
