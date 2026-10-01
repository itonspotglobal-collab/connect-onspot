-- Append-only event history for repeated clock exception proposals and reviews.
-- clock_sessions keeps the current state for efficient clock operations; this
-- table preserves every prior proposal and admin decision when that state moves
-- from rejected back to pending.
SELECT pg_temp.reconcile_table('public.clock_exception_reviews', $body$
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
$body$);

SELECT pg_temp.reconcile_index(
  'public.clock_exception_reviews',
  'clock_exception_reviews_session_history',
  $ddl$CREATE INDEX clock_exception_reviews_session_history
    ON clock_exception_reviews (clock_session_id, created_at, id);$ddl$
);

-- Preserve the current state already present when this migration is deployed.
INSERT INTO clock_exception_reviews
  (clock_session_id, action, proposed_end_at, proposal_reason, reviewer_id, decision_reason)
SELECT cs.id, cs.exception_status, cs.proposed_end_at, cs.proposal_reason, cs.resolved_by, cs.resolution_reason
  FROM clock_sessions cs
 WHERE cs.exception_status IN ('approved', 'rejected')
   AND NOT EXISTS (
     SELECT 1
       FROM clock_exception_reviews r
      WHERE r.clock_session_id = cs.id
        AND r.action = cs.exception_status
        AND r.actor_id IS NULL
        AND r.reviewer_id IS NOT DISTINCT FROM cs.resolved_by
        AND r.proposed_end_at IS NOT DISTINCT FROM cs.proposed_end_at
        AND r.proposal_reason IS NOT DISTINCT FROM cs.proposal_reason
        AND r.decision_reason IS NOT DISTINCT FROM cs.resolution_reason
   );

INSERT INTO clock_exception_reviews
  (clock_session_id, action, actor_id, proposed_end_at, proposal_reason)
SELECT cs.id, 'proposed', cs.talent_id, cs.proposed_end_at, cs.proposal_reason
  FROM clock_sessions cs
 WHERE cs.exception_status = 'pending'
   AND NOT EXISTS (
     SELECT 1
       FROM clock_exception_reviews r
      WHERE r.clock_session_id = cs.id
        AND r.action = 'proposed'
        AND r.actor_id IS NOT DISTINCT FROM cs.talent_id
        AND r.reviewer_id IS NULL
        AND r.proposed_end_at IS NOT DISTINCT FROM cs.proposed_end_at
        AND r.proposal_reason IS NOT DISTINCT FROM cs.proposal_reason
        AND r.decision_reason IS NULL
   );

INSERT INTO clock_exception_reviews (clock_session_id, action)
SELECT cs.id, 'detected'
  FROM clock_sessions cs
 WHERE cs.exception_status = 'detected'
   AND NOT EXISTS (
     SELECT 1
       FROM clock_exception_reviews r
      WHERE r.clock_session_id = cs.id
        AND r.action = 'detected'
        AND r.actor_id IS NULL
        AND r.reviewer_id IS NULL
        AND r.proposed_end_at IS NULL
        AND r.proposal_reason IS NULL
        AND r.decision_reason IS NULL
   );