-- +migrate Up

-- Make created_by_id nullable and add ON DELETE SET NULL on all tables referencing user(id)
-- so that hard-deleting a user won't violate FK constraints.

ALTER TABLE "event" ALTER COLUMN created_by_id DROP NOT NULL;
ALTER TABLE "event" DROP CONSTRAINT IF EXISTS event_created_by_id_fkey;
ALTER TABLE "event" ADD CONSTRAINT event_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES "user"(id) ON DELETE SET NULL;

ALTER TABLE "violation" ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE "violation" DROP CONSTRAINT IF EXISTS violation_user_id_fkey;
ALTER TABLE "violation" ADD CONSTRAINT violation_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE SET NULL;

ALTER TABLE "violation" ALTER COLUMN issued_by_id DROP NOT NULL;
ALTER TABLE "violation" DROP CONSTRAINT IF EXISTS violation_issued_by_id_fkey;
ALTER TABLE "violation" ADD CONSTRAINT violation_issued_by_id_fkey FOREIGN KEY (issued_by_id) REFERENCES "user"(id) ON DELETE SET NULL;

ALTER TABLE "recruitment" ALTER COLUMN created_by_id DROP NOT NULL;
ALTER TABLE "recruitment" DROP CONSTRAINT IF EXISTS recruitment_created_by_id_fkey;
ALTER TABLE "recruitment" ADD CONSTRAINT recruitment_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES "user"(id) ON DELETE SET NULL;

ALTER TABLE "letter" ALTER COLUMN created_by_id DROP NOT NULL;
ALTER TABLE "letter" DROP CONSTRAINT IF EXISTS letter_created_by_id_fkey;
ALTER TABLE "letter" ADD CONSTRAINT letter_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES "user"(id) ON DELETE SET NULL;

ALTER TABLE "announcement" ALTER COLUMN created_by_id DROP NOT NULL;
ALTER TABLE "announcement" DROP CONSTRAINT IF EXISTS announcement_created_by_id_fkey;
ALTER TABLE "announcement" ADD CONSTRAINT announcement_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES "user"(id) ON DELETE SET NULL;

ALTER TABLE "finance_transaction" ALTER COLUMN created_by_id DROP NOT NULL;
ALTER TABLE "finance_transaction" DROP CONSTRAINT IF EXISTS finance_transaction_created_by_id_fkey;
ALTER TABLE "finance_transaction" ADD CONSTRAINT finance_transaction_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES "user"(id) ON DELETE SET NULL;

ALTER TABLE "storage_file" ALTER COLUMN created_by_id DROP NOT NULL;
ALTER TABLE "storage_file" DROP CONSTRAINT IF EXISTS storage_file_created_by_id_fk;
ALTER TABLE "storage_file" ADD CONSTRAINT storage_file_created_by_id_fk FOREIGN KEY (created_by_id) REFERENCES "user"(id) ON DELETE SET NULL;

ALTER TABLE "permission_request" DROP CONSTRAINT IF EXISTS permission_request_reviewed_by_id_fkey;
ALTER TABLE "permission_request" ADD CONSTRAINT permission_request_reviewed_by_id_fkey FOREIGN KEY (reviewed_by_id) REFERENCES "user"(id) ON DELETE SET NULL;

-- +migrate Down

ALTER TABLE "event" ALTER COLUMN created_by_id SET NOT NULL;
ALTER TABLE "event" DROP CONSTRAINT IF EXISTS event_created_by_id_fkey;
ALTER TABLE "event" ADD CONSTRAINT event_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES "user"(id);

ALTER TABLE "violation" ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE "violation" DROP CONSTRAINT IF EXISTS violation_user_id_fkey;
ALTER TABLE "violation" ADD CONSTRAINT violation_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id);

ALTER TABLE "violation" ALTER COLUMN issued_by_id SET NOT NULL;
ALTER TABLE "violation" DROP CONSTRAINT IF EXISTS violation_issued_by_id_fkey;
ALTER TABLE "violation" ADD CONSTRAINT violation_issued_by_id_fkey FOREIGN KEY (issued_by_id) REFERENCES "user"(id);

ALTER TABLE "recruitment" ALTER COLUMN created_by_id SET NOT NULL;
ALTER TABLE "recruitment" DROP CONSTRAINT IF EXISTS recruitment_created_by_id_fkey;
ALTER TABLE "recruitment" ADD CONSTRAINT recruitment_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES "user"(id);

ALTER TABLE "letter" ALTER COLUMN created_by_id SET NOT NULL;
ALTER TABLE "letter" DROP CONSTRAINT IF EXISTS letter_created_by_id_fkey;
ALTER TABLE "letter" ADD CONSTRAINT letter_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES "user"(id);

ALTER TABLE "announcement" ALTER COLUMN created_by_id SET NOT NULL;
ALTER TABLE "announcement" DROP CONSTRAINT IF EXISTS announcement_created_by_id_fkey;
ALTER TABLE "announcement" ADD CONSTRAINT announcement_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES "user"(id);

ALTER TABLE "finance_transaction" ALTER COLUMN created_by_id SET NOT NULL;
ALTER TABLE "finance_transaction" DROP CONSTRAINT IF EXISTS finance_transaction_created_by_id_fkey;
ALTER TABLE "finance_transaction" ADD CONSTRAINT finance_transaction_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES "user"(id);

ALTER TABLE "storage_file" ALTER COLUMN created_by_id SET NOT NULL;
ALTER TABLE "storage_file" DROP CONSTRAINT IF EXISTS storage_file_created_by_id_fk;
ALTER TABLE "storage_file" ADD CONSTRAINT storage_file_created_by_id_fk FOREIGN KEY (created_by_id) REFERENCES "user"(id);

ALTER TABLE "permission_request" DROP CONSTRAINT IF EXISTS permission_request_reviewed_by_id_fkey;
ALTER TABLE "permission_request" ADD CONSTRAINT permission_request_reviewed_by_id_fkey FOREIGN KEY (reviewed_by_id) REFERENCES "user"(id);
