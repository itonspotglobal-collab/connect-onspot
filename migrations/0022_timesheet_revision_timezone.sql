-- Pin the timezone used to calculate each immutable approval snapshot.
SELECT pg_temp.reconcile_column('public.timesheet_revisions', 'work_timezone', 'text');

SELECT pg_temp.pause_known_trigger(
  'public.timesheet_revisions',
  'timesheet_revisions_immutable',
  $ddl$CREATE TRIGGER timesheet_revisions_immutable
    BEFORE UPDATE OR DELETE ON timesheet_revisions
    FOR EACH ROW EXECUTE FUNCTION reject_timesheet_history_mutation();$ddl$
);
UPDATE timesheet_revisions tr
   SET work_timezone = tp.work_timezone
  FROM timesheet_periods tp
 WHERE tp.id = tr.timesheet_period_id
   AND tr.work_timezone IS NULL;
SELECT pg_temp.resume_known_trigger('public.timesheet_revisions', 'timesheet_revisions_immutable');