-- Nullable additions preserve all historical investor requests.
ALTER TABLE investor_requests ADD COLUMN IF NOT EXISTS phone varchar(32);
ALTER TABLE investor_requests ADD COLUMN IF NOT EXISTS inquiry text;
