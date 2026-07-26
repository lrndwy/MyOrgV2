-- +migrate Up
CREATE TABLE IF NOT EXISTS wallet (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    initial_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE finance_transaction
    ADD COLUMN IF NOT EXISTS wallet_id BIGINT REFERENCES wallet(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_transaction_wallet_id ON finance_transaction(wallet_id);

-- +migrate Down
DROP INDEX IF EXISTS idx_finance_transaction_wallet_id;
ALTER TABLE finance_transaction DROP COLUMN IF EXISTS wallet_id;
DROP TABLE IF EXISTS wallet;
