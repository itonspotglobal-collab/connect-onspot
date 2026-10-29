import type { Pool } from "pg";
import { FORMAL_PIPELINE_PREDICATE } from "./formalPipelineGuard";
import { OnboardingError, lockOnboarding } from "./contractorOnboardingPolicy";

/** One transaction and authorization path for Client and recruiting Admin writers. */
export async function recordInterviewOutcome(pool:Pick<Pool,"connect">,actorId:string,id:string,body:any,typeOnly=false,adminRoute=false) {
  const db=await pool.connect();
  try {
    await db.query("BEGIN");
    const actor=(await db.query("SELECT role,admin_sub_role FROM users WHERE id=$1",[actorId])).rows[0];
    const admin=actor?.role==="admin"&&(actor.admin_sub_role===null||actor.admin_sub_role==="talent_acquisition");
    if(adminRoute&&!admin)throw new OnboardingError(403,"FORBIDDEN","Interview permissions are required.");
    if(!admin&&actor?.role!=="client")throw new OnboardingError(403,"FORBIDDEN","Interview permissions are required.");
    const context=(await db.query("SELECT submission_id FROM interviews WHERE id=$1",[id])).rows[0];
    if(!context)throw new OnboardingError(404,"INTERVIEW_NOT_FOUND","Interview not found.");
    await lockOnboarding(db,context.submission_id);
    const i=(await db.query(`SELECT i.*,js.client_id,js.status AS submission_status
      FROM interviews i JOIN job_submissions js ON js.id=i.submission_id
      WHERE i.id=$1 AND ($2::boolean OR js.client_id=$3) AND js.${FORMAL_PIPELINE_PREDICATE}
      FOR UPDATE OF js,i`,[id,admin,actorId])).rows[0];
    if(!i)throw new OnboardingError(404,"INTERVIEW_NOT_FOUND","Interview not found or forbidden.");
    if(["offer_accepted","contract_sent","contract_signed","hired","withdrawn","rejected"].includes(i.submission_status))
      throw new OnboardingError(409,"submission_not_interviewable","This application has moved beyond interviewing.");
    const type=body.interviewType??i.interview_type;
    if(!["initial","technical","final","culture","other"].includes(type))
      throw new OnboardingError(400,"INVALID_INTERVIEW_TYPE","Choose a valid interview type.");
    if(i.status==="cancelled"||i.outcome&&(!typeOnly&&i.outcome!=="pending"||typeOnly||type!==i.interview_type))
      throw new OnboardingError(409,"OUTCOME_LOCKED","A recorded outcome or its interview type cannot be changed.");
    if(!typeOnly) {
      if(!["advance","reject","pending"].includes(body.outcome))
        throw new OnboardingError(400,"INVALID_OUTCOME","Choose Advance, Reject or Pending.");
      if(i.outcome==="pending"&&!["advance","reject"].includes(body.outcome))
        throw new OnboardingError(409,"OUTCOME_LOCKED","Pending can only be resolved to Advance or Reject.");
      if(!(i.status==="confirmed"||i.status==="completed"&&i.outcome==="pending")||
        !i.confirmed_time||new Date(i.confirmed_time).getTime()>Date.now())
        throw new OnboardingError(409,"INTERVIEW_NOT_STARTED","Record an outcome only after a confirmed interview has started.");
    } else if(i.status==="completed") {
      throw new OnboardingError(409,"OUTCOME_LOCKED","The interview type is locked after an outcome.");
    }
    if(body.internalNotes!==undefined&&(typeof body.internalNotes!=="string"||body.internalNotes.length>5000))
      throw new OnboardingError(400,"INVALID_NOTES","Internal notes must be text of at most 5000 characters.");
    const row=(await db.query(typeOnly
      ?`UPDATE interviews SET interview_type=$2,updated_at=now() WHERE id=$1 RETURNING *`
      :`UPDATE interviews SET interview_type=$2,outcome=$3,status='completed',internal_notes=COALESCE($4,internal_notes),
        completed_at=now(),updated_at=now() WHERE id=$1 RETURNING *`,
      typeOnly?[id,type]:[id,type,body.outcome,body.internalNotes??null])).rows[0];
    const rejected=!typeOnly&&body.outcome==="reject";
    if(rejected)await db.query("UPDATE job_submissions SET status='rejected',updated_at=now() WHERE id=$1",[i.submission_id]);
    await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
      VALUES($1,$2,$3,$4,$5)`,[i.submission_id,i.submission_status,rejected?"rejected":i.submission_status,
      typeOnly?`Interview round ${i.round_number} type changed to ${type}`:
        `Interview round ${i.round_number} (${type}) outcome: ${body.outcome}`,actorId]);
    await db.query("COMMIT");
    return row;
  } catch(error) {await db.query("ROLLBACK").catch(()=>{});throw error;}
  finally {db.release();}
}
