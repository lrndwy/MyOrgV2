-- Pisahkan kategori dari template surat:
-- category_id pada letter_templates sekarang nullable.
ALTER TABLE letter_templates ALTER COLUMN category_id DROP NOT NULL;
