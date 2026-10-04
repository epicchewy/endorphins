ALTER TABLE workouts ADD COLUMN idempotency_key text CHECK (length(idempotency_key) BETWEEN 1 AND 128);
ALTER TABLE workouts ADD COLUMN input_fingerprint text;
ALTER TABLE workouts ADD CONSTRAINT workouts_idempotency_pair CHECK ((idempotency_key IS NULL) = (input_fingerprint IS NULL) AND (input_fingerprint IS NULL OR length(input_fingerprint) = 64));
ALTER TABLE workouts ADD CONSTRAINT workouts_owner_idempotency UNIQUE (user_id, idempotency_key);

CREATE INDEX workouts_user_duration_created_id_idx ON workouts (user_id, ((plan->>'estimatedMinutes')::integer), created_at DESC, id DESC);

-- Keep only the subject digest needed to reject late sessions and events.
CREATE TABLE deleted_accounts (
 subject_hash text PRIMARY KEY CHECK (length(subject_hash) = 64),
 deleted_at timestamptz NOT NULL DEFAULT now()
);
