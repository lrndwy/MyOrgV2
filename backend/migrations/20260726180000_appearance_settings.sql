-- +migrate Up
-- Idempoten & memperbaiki state parsial: auto-migration di server sempat
-- membuat kolom tanpa DEFAULT sehingga SET NOT NULL gagal pada baris lama.
ALTER TABLE organization_settings
    ADD COLUMN IF NOT EXISTS appearance TEXT;
UPDATE organization_settings SET appearance = '' WHERE appearance IS NULL;
ALTER TABLE organization_settings
    ALTER COLUMN appearance SET DEFAULT '';
ALTER TABLE organization_settings
    ALTER COLUMN appearance SET NOT NULL;

-- +migrate Down
ALTER TABLE organization_settings
    DROP COLUMN IF EXISTS appearance;
