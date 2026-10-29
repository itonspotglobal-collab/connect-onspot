import type {Pool,PoolClient} from "pg";
import {synchronizeFindWorkInterview,FindWorkCalendarError} from "./findWorkCalendarService";

/** Called only AFTER the business transaction commits. Graph failure is not interview failure. */
export async function syncInterviewCalendarAfterCommit(
  pool:Pick<Pool,"connect">|PoolClient,id:string,force=false,synchronize= synchronizeFindWorkInterview,
) {
  let db;
  try {
    db="release" in pool?pool:await pool.connect();
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`interview-calendar:${id}`]);
    if(force)await db.query("UPDATE interviews SET calendar_managed=true WHERE id=$1",[id]);
    await db.query("SAVEPOINT calendar_attempt");
    try {
      const row=await synchronize(db,id,force);
      const status=row.calendar_event_id?"synced":"skipped";
      const saved=(await db.query(`UPDATE interviews SET calendar_sync_status=$2,calendar_sync_error=NULL
        WHERE id=$1 RETURNING *`,[id,status])).rows[0];
      await db.query("COMMIT");
      return saved;
    } catch(error) {
      await db.query("ROLLBACK TO SAVEPOINT calendar_attempt");
      const code=error instanceof FindWorkCalendarError?error.code:"calendar_event_failure";
      const safe=/^[a-z_]{1,80}$/.test(code)?code:"calendar_event_failure";
      const row=(await db.query(`UPDATE interviews SET calendar_sync_status='failed',calendar_sync_error=$2
        WHERE id=$1 RETURNING *`,[id,safe])).rows[0];
      await db.query(`INSERT INTO notifications(user_id,type,title,message,related_id,related_type,event_key)
        SELECT u.id,'interview_calendar_sync_failed','Interview saved — calendar sync needs attention',
          $1,$2,'url',$3||':'||u.id FROM users u
        WHERE u.role='admin' AND (u.admin_sub_role IS NULL OR u.admin_sub_role='talent_acquisition')
        ON CONFLICT(event_key) DO NOTHING`,[
        safe==="calendar_time_conflict"?"Shared calendar conflict warning. The interview remains confirmed; review and retry calendar sync.":
          "The interview was saved. Open Interviews to retry calendar synchronization.",
        `/admin/interviews?interviewId=${encodeURIComponent(id)}`,`interview-calendar-failed:${id}:${safe}`]);
      await db.query("COMMIT");
      return row;
    }
  } catch {
    await db?.query("ROLLBACK").catch(()=>{});
    console.warn("[interview-calendar] post-commit sync unavailable; saved interview retained");
    return null;
  } finally {if(!("release" in pool))db?.release();}
}
