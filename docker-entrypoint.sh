#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma || npx prisma db push --schema=packages/db/prisma/schema.prisma --accept-data-loss
fi

exec "$@"
