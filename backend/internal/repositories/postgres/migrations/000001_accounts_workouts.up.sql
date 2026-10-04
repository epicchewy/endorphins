CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id text NOT NULL UNIQUE CHECK (length(clerk_user_id) BETWEEN 1 AND 255),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workouts (
    id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    snapshot_version smallint NOT NULL DEFAULT 1 CHECK (snapshot_version = 1),
    plan jsonb NOT NULL CHECK (jsonb_typeof(plan) = 'object')
);

CREATE INDEX workouts_user_created_id_idx ON workouts (user_id, created_at DESC, id DESC);
