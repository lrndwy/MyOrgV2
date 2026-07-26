-- +migrate Up
-- Auto-migration ORM gokil pernah menambahkan FK duplikat bernama
-- "<tabel>_<kolom>_fk" TANPA klausa ON DELETE, menimpa perilaku CASCADE /
-- SET NULL dari skema awal ("_fkey"). Duplikat inilah yang membuat DELETE
-- event gagal (SQLSTATE 23503). Bersihkan semua duplikat semacam itu:
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname, con.conrelid::regclass AS tbl
    FROM pg_constraint con
    WHERE con.contype = 'f'
      AND con.conname LIKE '%\_fk'
      AND EXISTS (
        SELECT 1
        FROM pg_constraint other
        WHERE other.contype = 'f'
          AND other.conrelid = con.conrelid
          AND other.conkey = con.conkey
          AND other.oid <> con.oid
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- Pastikan FK anak-anak event dan user kembali ke perilaku CASCADE sesuai
-- skema awal, apa pun kondisi constraint sebelumnya.
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_event_id_fk;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_event_id_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE;

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_user_id_fk;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_user_id_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

ALTER TABLE permission_request DROP CONSTRAINT IF EXISTS permission_request_event_id_fk;
ALTER TABLE permission_request DROP CONSTRAINT IF EXISTS permission_request_event_id_fkey;
ALTER TABLE permission_request ADD CONSTRAINT permission_request_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE;

ALTER TABLE permission_request DROP CONSTRAINT IF EXISTS permission_request_user_id_fk;
ALTER TABLE permission_request DROP CONSTRAINT IF EXISTS permission_request_user_id_fkey;
ALTER TABLE permission_request ADD CONSTRAINT permission_request_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

-- +migrate Down
SELECT 1;
