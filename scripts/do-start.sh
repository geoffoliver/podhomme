#!/usr/bin/env bash
# DigitalOcean App Platform startup script.
# Runs migrations, starts the background refresh worker, then starts the web server.
set -euo pipefail

# Ensure the data directory exists. If a persistent volume is mounted at
# /workspace/data (recommended), this is a no-op on subsequent deploys.
mkdir -p /workspace/data

echo "[DO START] ==> Running database migrations..."
yarn prisma migrate deploy

echo "[DO START] ==> Starting background worker..."
yarn worker &

echo "[DO START] ==> Starting web server..."
exec yarn start
