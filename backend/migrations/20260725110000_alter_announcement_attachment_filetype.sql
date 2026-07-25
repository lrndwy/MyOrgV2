-- +migrate Up
ALTER TABLE "announcement_attachment" ALTER COLUMN "file_type" TYPE VARCHAR(100);

-- +migrate Down
ALTER TABLE "announcement_attachment" ALTER COLUMN "file_type" TYPE VARCHAR(20);
