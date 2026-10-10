-- Keep immutable snapshots intact and project the fields used by GORM queries.
ALTER TABLE workouts ADD COLUMN level integer;
ALTER TABLE workouts ADD COLUMN estimated_minutes integer;
UPDATE workouts SET
    level = (plan->>'level')::integer,
    estimated_minutes = (plan->>'estimatedMinutes')::integer;
ALTER TABLE workouts ALTER COLUMN level SET NOT NULL;
ALTER TABLE workouts ALTER COLUMN estimated_minutes SET NOT NULL;

DROP INDEX workouts_user_duration_created_id_idx;
CREATE INDEX workouts_user_duration_created_id_idx
    ON workouts (user_id, estimated_minutes, created_at DESC, id DESC);

CREATE TABLE workout_search_terms (
    user_id uuid NOT NULL,
    workout_id text NOT NULL,
    position integer NOT NULL,
    name text NOT NULL,
    PRIMARY KEY (user_id, workout_id, position)
);

-- Match the repository's focus, block names, then exercise names ordering.
INSERT INTO workout_search_terms (user_id, workout_id, position, name)
SELECT w.user_id, w.id, term.position, lower(term.name)
FROM workouts w
CROSS JOIN LATERAL jsonb_array_elements_text(
    jsonb_path_query_array(w.plan, '$.focus') ||
    jsonb_path_query_array(w.plan, '$.blocks[*].name') ||
    jsonb_path_query_array(w.plan, '$.blocks[*].exercises[*].name')
) WITH ORDINALITY AS term(name, position)
WHERE term.name IS NOT NULL;
