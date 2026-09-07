ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS popup_presented_at timestamp;

CREATE INDEX IF NOT EXISTS notifications_unpresented_hired_popup_idx
ON notifications (user_id, created_at)
WHERE type = 'job_application_status_changed'
  AND popup_presented_at IS NULL
  AND event_key LIKE 'talent-hired:%';