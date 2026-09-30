-- Append-only event history for repeated clock exception proposals and reviews.
-- clock_sessions keeps the current state for efficient clock operations; this
-- table preserves every prior proposal and admin decision when that state moves
-- from rejected back to pending.
CREATE TABLE IF NOT EXISTS clock_exception_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clock_session_id uuid NOT NULL REFERENCES clock_sessions(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('detected', 'proposed', 'approved', 'rejected')),
  actor_id varchar REFERENCES users(id) ON DELETE RESTRICT,
  reviewer_id varchar REFERENCES users(id) ON DELETE RESTRICT,
  proposed_end_at timestamptz,
  proposal_reason text,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (action = 'detected' AND actor_id IS NULL AND reviewer_id IS NULL
      AND proposed_end_at IS NULL AND proposal_reason IS NULL AND decision_reason IS NULL)
    OR (action = 'proposed' AND actor_id IS NOT NULL AND reviewer_id IS NULL
      AND proposed_end_at IS NOT NULL AND proposal_reason IS NOT NULL AND decision_reason IS NULL)
    OR (action IN ('approved', 'rejected') AND actor_id IS NULL AND reviewer_id IS NOT NULL
      AND proposed_end_at IS NOT NULL AND proposal_reason IS NOT NULL AND decision_reason IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS clock_exception_reviews_session_history
  ON clock_exception_reviews (clock_session_id, created_at, id);

-- Preserve the current state already present when this migration is deployed.
INSERT INTO clock_exception_reviews
  (clock_session_id, action, proposed_end_at, proposal_reason, reviewer_id, decision_reason)
SELECT id, exception_status, proposed_end_at, proposal_reason, resolved_by, resolution_reason
  FROM clock_sessions
 WHERE exception_status IN ('approved', 'rejected')
ON CONFLICT DO NOTHING;

INSERT INTO clock_exception_reviews
  (clock_session_id, action, actor_id, proposed_end_at, proposal_reason)
SELECT id, 'proposed', talent_id, proposed_end_at, proposal_reason
  FROM clock_sessions
 WHERE exception_status = 'pending'
ON CONFLICT DO NOTHING;

INSERT INTO clock_exception_reviews (clock_session_id, action)
SELECT id, 'detected'
  FROM clock_sessions
 WHERE exception_status = 'detected'
ON CONFLICT DO NOTHING;