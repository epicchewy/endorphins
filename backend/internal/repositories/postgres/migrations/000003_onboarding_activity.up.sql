ALTER TABLE users ADD COLUMN default_level smallint NOT NULL DEFAULT 1 CHECK (default_level BETWEEN 1 AND 5);
ALTER TABLE users ADD COLUMN onboarding_completed_at timestamptz;

CREATE TABLE workout_completions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    workout_id text NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT now(),
    undone_at timestamptz,
    idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
    UNIQUE (user_id, idempotency_key)
);
CREATE INDEX workout_completions_user_date_idx ON workout_completions (user_id, completed_at DESC, id DESC) WHERE undone_at IS NULL;
