ALTER TABLE workouts DROP CONSTRAINT workouts_snapshot_version_check; UPDATE workouts SET snapshot_version=2;
