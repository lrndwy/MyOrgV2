-- +migrate Up
ALTER TABLE organization_settings
    ADD COLUMN IF NOT EXISTS appearance TEXT NOT NULL DEFAULT '';

-- +migrate Down
ALTER TABLE organization_settings
    DROP COLUMN IF EXISTS appearance;
