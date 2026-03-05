#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[gate] 1/4 API unit tests"
npm -w apps/api run test -- --runInBand

echo "[gate] 2/4 API e2e tests"
npm -w apps/api run test:e2e -- --runInBand

echo "[gate] 3/4 Workspace build"
npm run build

echo "[gate] 4/4 Gate passed ✅"
