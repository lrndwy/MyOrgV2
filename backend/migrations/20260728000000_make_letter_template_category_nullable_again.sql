-- Perbaiki isu: kolom category_id di letter_templates masih NOT NULL.
-- Pastikan kolom category_id di tabel letter_templates menjadi nullable.
ALTER TABLE letter_templates ALTER COLUMN category_id DROP NOT NULL;
