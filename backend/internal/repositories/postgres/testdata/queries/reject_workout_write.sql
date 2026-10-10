ALTER TABLE workouts ADD CONSTRAINT reject_fixture CHECK (id <> 'rejected');
