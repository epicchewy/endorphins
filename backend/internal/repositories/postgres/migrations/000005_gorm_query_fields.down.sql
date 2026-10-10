DROP TABLE workout_search_terms;
DROP INDEX workouts_user_duration_created_id_idx;
ALTER TABLE workouts DROP COLUMN estimated_minutes;
ALTER TABLE workouts DROP COLUMN level;
CREATE INDEX workouts_user_duration_created_id_idx
    ON workouts (user_id, ((plan->>'estimatedMinutes')::integer), created_at DESC, id DESC);
