#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[gate] 1/7 Install dependencies if needed"
if [[ ! -x ./node_modules/.bin/jest ]]; then
  npm ci
fi

echo "[gate] 2/7 Generate Prisma client"
npm -w apps/api run prisma:generate

echo "[gate] 3/7 Apply committed migrations"
npm -w apps/api run prisma:migrate:deploy

echo "[gate] 4/7 API unit tests"
npm -w apps/api run test -- --runInBand

echo "[gate] 5/7 API e2e tests"
npm -w apps/api run test:e2e -- --runInBand

echo "[gate] 6/7 Workspace build"
npm run build

echo "[gate] 7/7 Production boot health smoke"
bash ./scripts/prod_boot_health_smoke.sh

echo "[gate] Gate passed ✅"
