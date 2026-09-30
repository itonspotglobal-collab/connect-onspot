-- Pin the timezone used to calculate each immutable approval snapshot.
ALTER TABLE timesheet_revisions ADD COLUMN work_timezone text;

ALTER TABLE timesheet_revisions DISABLE TRIGGER timesheet_revisions_immutable;
UPDATE timesheet_revisions tr
   SET work_timezone = tp.work_timezone
  FROM timesheet_periods tp
 WHERE tp.id = tr.timesheet_period_id
   AND tr.work_timezone IS NULL;
ALTER TABLE timesheet_revisions ENABLE TRIGGER timesheet_revisions_immutable;