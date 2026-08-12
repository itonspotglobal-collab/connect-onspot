-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: sync profile photos into candidates.profile_photo_url
--
-- Talent users who uploaded a photo via Settings before the forward-sync fix
-- was introduced will have a non-null profiles.profile_picture but a null
-- candidates.profile_photo_url. This one-time UPDATE fills the gap by
-- constructing the canonical photo URL from the matching user's id.
--
-- Safe to re-run: the WHERE clause restricts to rows that still need fixing.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE candidates c
SET    profile_photo_url = '/api/profile-picture/' || u.id
FROM   users u
JOIN   profiles p ON p.user_id = u.id
WHERE  lower(c.email) = lower(u.email)
  AND  p.profile_picture IS NOT NULL
  AND  c.profile_photo_url IS NULL;
