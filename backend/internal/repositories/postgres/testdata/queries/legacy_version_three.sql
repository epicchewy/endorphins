ALTER TABLE workouts ADD CONSTRAINT workouts_user_id_fkey FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE;
 ALTER TABLE workouts ADD CONSTRAINT workouts_owner_id UNIQUE(user_id,id);
 ALTER TABLE workout_completions ADD CONSTRAINT workout_completions_user_id_fkey FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE;
 ALTER TABLE workout_completions ADD CONSTRAINT workout_completions_user_id_workout_id_fkey FOREIGN KEY(user_id,workout_id) REFERENCES workouts(user_id,id) ON DELETE CASCADE;
 CREATE TABLE schema_migrations(version bigint NOT NULL PRIMARY KEY,dirty boolean NOT NULL);
 INSERT INTO schema_migrations VALUES(3,false);
