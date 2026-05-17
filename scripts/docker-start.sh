#!/bin/sh
set -e

export DATABASE_URL="${DATABASE_URL:-file:/workspace/data/podhomme.db}"

# Write .env so prisma.config.ts dotenv loading picks up DATABASE_URL
echo "DATABASE_URL=${DATABASE_URL}" > .env

mkdir -p /workspace/data

echo "[DOCKER START] ==> Running database migrations..."
node_modules/.bin/prisma migrate deploy

echo "[DOCKER START] ==> Starting background worker..."
node_modules/.bin/tsx worker/index.ts &

echo "[DOCKER START] ==> Starting web server..."
exec node_modules/.bin/next start
