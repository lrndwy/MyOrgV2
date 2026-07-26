#!/bin/sh
set -e

echo "[entrypoint] running migrations..."
# Hanya apply migrasi yang ada di repo. JANGAN makemigrations di sini:
# auto-generate saat boot menghasilkan migrasi tanpa DEFAULT/CASCADE yang
# berulang kali merusak prod (FK duplikat, kolom NOT NULL gagal). Setiap
# perubahan model wajib disertai file migrasi di backend/migrations/.
/app/app migrate || echo "[entrypoint] migrate skipped or failed (may be no pending migrations)"

echo "[entrypoint] starting server..."
exec /app/app serve
