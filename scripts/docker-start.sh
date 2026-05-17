#!/bin/sh
set -e

export DATABASE_URL="${DATABASE_URL:-file:/workspace/data/podhomme.db}"

mkdir -p /workspace/data

echo "==> Running database migrations..."
node_modules/.bin/prisma migrate deploy

echo "==> Starting background worker..."
node_modules/.bin/tsx worker/index.ts &

echo "==> Starting web server..."
exec node_modules/.bin/next start
