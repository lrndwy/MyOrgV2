-- +migrate Up
-- Lanjutan 20260726160000: di beberapa database, tabel anak dibuat oleh
-- auto-migration ORM sehingga SATU-SATUNYA FK-nya bernama "<tabel>_<kolom>_fk"
-- tanpa ON DELETE CASCADE (tidak terdeteksi sebagai duplikat oleh migration
-- sebelumnya). Normalisasi semua FK anak agar sesuai skema awal (CASCADE).

ALTER TABLE announcement_attachment DROP CONSTRAINT IF EXISTS announcement_attachment_announcement_id_fk;
ALTER TABLE announcement_attachment DROP CONSTRAINT IF EXISTS announcement_attachment_announcement_id_fkey;
ALTER TABLE announcement_attachment ADD CONSTRAINT announcement_attachment_announcement_id_fkey
    FOREIGN KEY (announcement_id) REFERENCES announcement(id) ON DELETE CASCADE;

ALTER TABLE role_permission DROP CONSTRAINT IF EXISTS role_permission_role_id_fk;
ALTER TABLE role_permission DROP CONSTRAINT IF EXISTS role_permission_role_id_fkey;
ALTER TABLE role_permission ADD CONSTRAINT role_permission_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE CASCADE;

ALTER TABLE role_permission DROP CONSTRAINT IF EXISTS role_permission_permission_id_fk;
ALTER TABLE role_permission DROP CONSTRAINT IF EXISTS role_permission_permission_id_fkey;
ALTER TABLE role_permission ADD CONSTRAINT role_permission_permission_id_fkey
    FOREIGN KEY (permission_id) REFERENCES permission(id) ON DELETE CASCADE;

ALTER TABLE recruitment_target_division DROP CONSTRAINT IF EXISTS recruitment_target_division_recruitment_id_fk;
ALTER TABLE recruitment_target_division DROP CONSTRAINT IF EXISTS recruitment_target_division_recruitment_id_fkey;
ALTER TABLE recruitment_target_division ADD CONSTRAINT recruitment_target_division_recruitment_id_fkey
    FOREIGN KEY (recruitment_id) REFERENCES recruitment(id) ON DELETE CASCADE;

ALTER TABLE recruitment_target_division DROP CONSTRAINT IF EXISTS recruitment_target_division_division_id_fk;
ALTER TABLE recruitment_target_division DROP CONSTRAINT IF EXISTS recruitment_target_division_division_id_fkey;
ALTER TABLE recruitment_target_division ADD CONSTRAINT recruitment_target_division_division_id_fkey
    FOREIGN KEY (division_id) REFERENCES division(id) ON DELETE CASCADE;

ALTER TABLE recruitment_custom_field DROP CONSTRAINT IF EXISTS recruitment_custom_field_recruitment_id_fk;
ALTER TABLE recruitment_custom_field DROP CONSTRAINT IF EXISTS recruitment_custom_field_recruitment_id_fkey;
ALTER TABLE recruitment_custom_field ADD CONSTRAINT recruitment_custom_field_recruitment_id_fkey
    FOREIGN KEY (recruitment_id) REFERENCES recruitment(id) ON DELETE CASCADE;

ALTER TABLE recruitment_submission DROP CONSTRAINT IF EXISTS recruitment_submission_recruitment_id_fk;
ALTER TABLE recruitment_submission DROP CONSTRAINT IF EXISTS recruitment_submission_recruitment_id_fkey;
ALTER TABLE recruitment_submission ADD CONSTRAINT recruitment_submission_recruitment_id_fkey
    FOREIGN KEY (recruitment_id) REFERENCES recruitment(id) ON DELETE CASCADE;

ALTER TABLE letter_template DROP CONSTRAINT IF EXISTS letter_template_category_id_fk;
ALTER TABLE letter_template DROP CONSTRAINT IF EXISTS letter_template_category_id_fkey;
ALTER TABLE letter_template ADD CONSTRAINT letter_template_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES letter_category(id) ON DELETE CASCADE;

ALTER TABLE push_subscription DROP CONSTRAINT IF EXISTS push_subscription_user_id_fk;
ALTER TABLE push_subscription DROP CONSTRAINT IF EXISTS push_subscription_user_id_fkey;
ALTER TABLE push_subscription ADD CONSTRAINT push_subscription_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;

-- +migrate Down
SELECT 1;
