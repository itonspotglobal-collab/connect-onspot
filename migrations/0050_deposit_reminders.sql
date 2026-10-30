INSERT INTO platform_settings(key,value)
VALUES('deposit_reminder_hours','48,120') ON CONFLICT(key) DO NOTHING;
