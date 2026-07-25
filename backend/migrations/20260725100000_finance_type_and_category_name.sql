-- +migrate Up
ALTER TABLE "finance_transaction" ADD COLUMN "type" VARCHAR(20) NOT NULL DEFAULT 'expense';
UPDATE "finance_transaction" t SET "type" = c."type" FROM "finance_category" c WHERE t."category_id" = c."id";

-- +migrate Down
ALTER TABLE "finance_transaction" DROP COLUMN IF EXISTS "type";
