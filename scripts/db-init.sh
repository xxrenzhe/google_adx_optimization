#!/usr/bin/env sh
set -euo pipefail

PRISMA="./node_modules/prisma/build/index.js"
FLAGS="--schema=./prisma/schema.prisma --skip-generate"

if [ "${DB_ACCEPT_DATA_LOSS:-0}" = "1" ]; then
  FLAGS="$FLAGS --accept-data-loss"
fi

echo "[db-init] DATABASE_URL=${DATABASE_URL:+(set)}"
echo "[db-init] Using flags: $FLAGS"

if [ -f "$PRISMA" ]; then
  echo "[db-init] Using local Prisma CLI"
  node "$PRISMA" db push $FLAGS
else
  echo "[db-init] Falling back to npx prisma"
  npx prisma db push $FLAGS
fi

if [ "${DB_BOOTSTRAP:-1}" = "1" ]; then
  echo "[db-init] Running bootstrap script"
  node ./scripts/bootstrap.js
fi

echo "[db-init] Done"

