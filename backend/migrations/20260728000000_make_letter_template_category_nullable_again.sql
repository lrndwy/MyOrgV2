-- +migrate Up
ALTER TABLE letter_templates ALTER COLUMN category_id DROP NOT NULL;
