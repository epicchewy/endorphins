CREATE FUNCTION reject_account_delete() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'injected erasure failure'; END $$;
 CREATE TRIGGER reject_account_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION reject_account_delete();
