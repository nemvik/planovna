#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PLANOVNA_SMOKE_PORT:-4310}"
HOST="127.0.0.1"
HEALTH_URL="http://${HOST}:${PORT}/health"
BOOT_TIMEOUT_SECONDS="${PLANOVNA_SMOKE_TIMEOUT_SECONDS:-30}"

TMP_DIR="$(mktemp -d)"
LOG_FILE="$TMP_DIR/api.log"
BODY_FILE="$TMP_DIR/health.json"
API_PID=""

cleanup() {
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill -- -"$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

echo "[smoke] booting production API on ${HOST}:${PORT}"
setsid env PORT="$PORT" npm -w apps/api run start:prod >"$LOG_FILE" 2>&1 &
API_PID="$!"

deadline=$((SECONDS + BOOT_TIMEOUT_SECONDS))
while ((SECONDS < deadline)); do
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "[smoke] production API exited before becoming ready"
    tail -n 80 "$LOG_FILE" || true
    exit 1
  fi

  http_code="$(curl --silent --output "$BODY_FILE" --write-out '%{http_code}' "$HEALTH_URL" || true)"

  if [[ "$http_code" == "200" ]]; then
    if ! node -e '
      const fs = require("node:fs");
      const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      if (body.status !== "ready" || body.service !== "api") process.exit(1);
    ' "$BODY_FILE"; then
      echo "[smoke] payload mismatch at $HEALTH_URL"
      cat "$BODY_FILE"
      exit 1
    fi

    echo "[smoke] health contract OK at $HEALTH_URL"
    exit 0
  fi

  if [[ "$http_code" =~ ^[0-9]{3}$ ]] && [[ "$http_code" != "000" ]]; then
    echo "[smoke] unexpected HTTP status from $HEALTH_URL: $http_code"
    if [[ -s "$BODY_FILE" ]]; then
      cat "$BODY_FILE"
    fi
    exit 1
  fi

  sleep 1
done

echo "[smoke] boot timeout after ${BOOT_TIMEOUT_SECONDS}s waiting for $HEALTH_URL"
echo "[smoke] last API log lines:"
tail -n 80 "$LOG_FILE" || true
exit 1
