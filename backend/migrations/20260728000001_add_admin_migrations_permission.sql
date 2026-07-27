-- +migrate Up
INSERT INTO permissions (code, module, description, created_at, updated_at) VALUES
('admin.migrations.view', 'admin', 'Melihat status migrasi database', NOW(), NOW());
