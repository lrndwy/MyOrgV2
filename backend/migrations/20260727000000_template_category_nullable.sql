-- +migrate Up
ALTER TABLE letter_template ALTER COLUMN category_id DROP NOT NULL;
