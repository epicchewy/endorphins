DROP TABLE deleted_accounts;
DROP INDEX workouts_user_duration_created_id_idx;
ALTER TABLE workouts DROP CONSTRAINT workouts_owner_idempotency;
ALTER TABLE workouts DROP CONSTRAINT workouts_idempotency_pair;
ALTER TABLE workouts DROP COLUMN input_fingerprint;
ALTER TABLE workouts DROP COLUMN idempotency_key;
