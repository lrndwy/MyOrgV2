#!/bin/sh
set -e

echo "[entrypoint] running migrations..."
/app/app migrate || echo "[entrypoint] migrate skipped or failed (may be no pending migrations)"

echo "[entrypoint] starting server..."
exec /app/app serve
