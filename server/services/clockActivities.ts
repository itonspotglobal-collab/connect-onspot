import { ACTIVITY_TYPES, contractBreakRules, type ActivityType } from "./sessionPaidTime";
type Query = (sql: string, values?: any[]) => Promise<{ rows: any[] }>;
export async function ensureWorkActivity(query: Query, sessionId: string) {
  await query(`INSERT INTO clock_session_activities(clock_session_id,activity_type,started_at,is_paid)
    SELECT id,'work',started_at,true FROM clock_sessions WHERE id=$1
    AND NOT EXISTS (SELECT 1 FROM clock_session_activities WHERE clock_session_id=$1)`, [sessionId]);
}
export async function notifyActivityOverLimits(query: Query, talentId?: string) {
  // The activity claim and canonical bell insert commit together; concurrent
  // polling/workers cannot notify twice. No status is switched automatically.
  await query(`WITH claimed AS (
    UPDATE clock_session_activities a SET over_limit_notified_at=clock_timestamp()
    FROM clock_sessions cs WHERE cs.id=a.clock_session_id
      AND ($1::text IS NULL OR cs.talent_id=$1)
      AND a.max_minutes IS NOT NULL AND a.over_limit_notified_at IS NULL
      AND COALESCE(a.ended_at,clock_timestamp()) > a.started_at + a.max_minutes * interval '1 minute'
    RETURNING a.id,a.activity_type,cs.talent_id)
    INSERT INTO notifications(user_id,type,title,message,related_id)
    SELECT talent_id,'clock_activity_over_limit','Clock activity over limit',
      'Your ' || activity_type || ' has exceeded its configured duration. Your status has not been changed.',id::text FROM claimed`,
  [talentId ?? null]);
}
export async function switchClockActivity(query: Query, talentId: string, activityType: ActivityType) {
  if (!ACTIVITY_TYPES.includes(activityType)) return { status: 422, error: "Choose Working, Lunch, Break or Meeting." };
  await query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [talentId]);
  const contracts = await query(`SELECT hc.*,COALESCE(hc.work_timezone,j.time_zone) AS activity_work_timezone
    FROM hiring_contracts hc JOIN clock_sessions cs ON cs.hiring_contract_id=hc.id
    JOIN job_submissions js ON js.id=hc.submission_id JOIN jobs j ON j.id=js.job_id
    WHERE cs.talent_id=$1 AND cs.ended_at IS NULL AND cs.exception_status IS DISTINCT FROM 'approved' FOR UPDATE OF hc`, [talentId]);
  const sessions = await query(`SELECT * FROM clock_sessions WHERE talent_id=$1 AND ended_at IS NULL
    AND exception_status IS DISTINCT FROM 'approved' FOR UPDATE`, [talentId]);
  if (!sessions.rows[0] || !contracts.rows[0]) return { status: 409, error: "Time In before switching activity." };
  const session = sessions.rows[0], contract = contracts.rows[0], rules = contractBreakRules(contract);
  await ensureWorkActivity(query, session.id);
  const open = (await query("SELECT * FROM clock_session_activities WHERE clock_session_id=$1 AND ended_at IS NULL FOR UPDATE", [session.id])).rows[0];
  if (open?.activity_type === activityType) return { status: 409, error: `You are already ${activityType === "work" ? "working" : `on ${activityType}`}.` };
  if (activityType === "lunch" || activityType === "break") {
    // Limits are per engagement work-zone day, across all its sessions.
    const count = (await query(`SELECT count(*)::int AS count FROM clock_session_activities a
      JOIN clock_sessions cs ON cs.id=a.clock_session_id
      WHERE cs.talent_id=$1 AND cs.hiring_contract_id=$2 AND a.activity_type=$3
      AND (a.started_at AT TIME ZONE $4)::date=(clock_timestamp() AT TIME ZONE $4)::date`,
    [talentId, contract.id, activityType, contract.activity_work_timezone])).rows[0].count;
    const max = activityType === "lunch" ? 1 : rules.breaksPerDay;
    if (count >= max) return { status: 409, error: activityType === "lunch"
      ? "You have already taken lunch for this work day." : `You have reached the ${max} breaks allowed for this work day.` };
  }
  const paid = activityType === "work" ? true : rules[`${activityType}Paid`];
  const max = activityType === "lunch" ? rules.lunchMaxMinutes : activityType === "break" ? rules.breakMaxMinutes : null;
  const inserted = await query(`WITH instant AS MATERIALIZED (SELECT clock_timestamp() AS at),
    closed AS (UPDATE clock_session_activities SET ended_at=(SELECT at FROM instant)
      WHERE clock_session_id=$1 AND ended_at IS NULL RETURNING id)
    INSERT INTO clock_session_activities(clock_session_id,activity_type,started_at,is_paid,max_minutes)
    SELECT $1,$2,instant.at,$3,$4 FROM instant CROSS JOIN (SELECT count(*) FROM closed) dependency RETURNING *`,
  [session.id, activityType, paid, max]);
  return { status: 200, activity: inserted.rows[0] };
}
