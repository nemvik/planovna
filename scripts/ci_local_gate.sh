#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[gate] 1/5 API unit tests"
npm -w apps/api run test -- --runInBand

echo "[gate] 2/5 API e2e tests"
npm -w apps/api run test:e2e -- --runInBand

echo "[gate] 3/5 Workspace build"
npm run build

echo "[gate] 4/5 Production boot health smoke"
bash ./scripts/prod_boot_health_smoke.sh

echo "[gate] 5/5 Gate passed ✅"
