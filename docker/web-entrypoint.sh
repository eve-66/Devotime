#!/bin/sh
set -eu

npm run prisma:generate

until npx prisma migrate deploy; do
  echo "Waiting for postgres to accept connections..."
  sleep 2
done

exec npm run dev -- --hostname 0.0.0.0
