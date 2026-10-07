-- Also remove constraints from databases that ran the original migrations.
ALTER TABLE workout_completions DROP CONSTRAINT IF EXISTS workout_completions_user_id_workout_id_fkey;
ALTER TABLE workout_completions DROP CONSTRAINT IF EXISTS workout_completions_user_id_fkey;
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_user_id_fkey;
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_owner_id;
