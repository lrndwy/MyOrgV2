-- Buat tabel gokil_db_versions jika belum ada
CREATE TABLE IF NOT EXISTS gokil_db_versions (
    id BIGSERIAL PRIMARY KEY,
    version BIGINT UNIQUE NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
