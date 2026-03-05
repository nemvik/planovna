#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[gate] 1/3 API tests"
npm -w apps/api run test -- --runInBand

echo "[gate] 2/3 Workspace build"
npm run build

echo "[gate] 3/3 Gate passed ✅"
