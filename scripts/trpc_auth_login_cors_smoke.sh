#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOST="127.0.0.1"
PORT="${PLANOVNA_CORS_SMOKE_PORT:-4321}"
ALLOWED_ORIGIN="${PLANOVNA_CORS_SMOKE_ALLOWED_ORIGIN:-https://allowed.planovna.test}"
BLOCKED_ORIGIN="${PLANOVNA_CORS_SMOKE_BLOCKED_ORIGIN:-https://blocked.planovna.test}"
REQUEST_HEADERS="${PLANOVNA_CORS_SMOKE_REQUEST_HEADERS:-authorization,content-type}"
BOOT_TIMEOUT_SECONDS="${PLANOVNA_CORS_SMOKE_TIMEOUT_SECONDS:-30}"
AUTH_TOKEN_SECRET="${PLANOVNA_CORS_SMOKE_AUTH_TOKEN_SECRET:-planovna-smoke-secret}"
API_URL="${PLANOVNA_CORS_SMOKE_API_URL:-http://${HOST}:${PORT}}"
TRPC_URL="${API_URL%/}/trpc/auth.login"
HEALTH_URL="${API_URL%/}/health"
API_DIST_ENTRY="$ROOT_DIR/apps/api/dist/src/main.js"

TMP_DIR="$(mktemp -d)"
LOG_FILE="$TMP_DIR/api.log"
HEADERS_FILE="$TMP_DIR/headers.txt"
BODY_FILE="$TMP_DIR/body.txt"
API_PID=""
STARTED_API=0

cleanup() {
  if [[ "$STARTED_API" == "1" ]] && [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill -- -"$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi

  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

fail() {
  echo "[smoke] $*" >&2
  if [[ -s "$LOG_FILE" ]]; then
    echo "[smoke] last API log lines:" >&2
    tail -n 80 "$LOG_FILE" >&2 || true
  fi
  exit 1
}

header_value() {
  node - "$1" "$2" <<'EOF'
const fs = require('node:fs');

const filePath = process.argv[2];
const headerName = process.argv[3].toLowerCase();
const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
let value = '';

for (const line of lines) {
  const separatorIndex = line.indexOf(':');

  if (separatorIndex === -1) {
    continue;
  }

  const currentName = line.slice(0, separatorIndex).trim().toLowerCase();

  if (currentName === headerName) {
    value = line.slice(separatorIndex + 1).trim();
  }
}

process.stdout.write(value);
EOF
}

assert_equals() {
  local expected="$1"
  local actual="$2"
  local label="$3"

  if [[ "$actual" != "$expected" ]]; then
    fail "$label mismatch: expected '$expected', got '$actual'"
  fi
}

assert_empty() {
  local actual="$1"
  local label="$2"

  if [[ -n "$actual" ]]; then
    fail "$label should be absent, got '$actual'"
  fi
}

start_api() {
  if [[ -n "${PLANOVNA_CORS_SMOKE_API_URL:-}" ]]; then
    echo "[smoke] using existing API at ${API_URL%/}"
    return 0
  fi

  if [[ ! -f "$API_DIST_ENTRY" ]]; then
    echo "[smoke] building apps/api for start:prod"
    npm -w apps/api run build
  fi

  : >"$LOG_FILE"
  echo "[smoke] starting API on ${API_URL%/}"
  setsid env NODE_ENV=production PORT="$PORT" API_CORS_ALLOWED_ORIGINS="$ALLOWED_ORIGIN" AUTH_TOKEN_SECRET="$AUTH_TOKEN_SECRET" npm -w apps/api run start:prod >"$LOG_FILE" 2>&1 &
  API_PID="$!"
  STARTED_API=1
}

wait_for_api() {
  local deadline=$((SECONDS + BOOT_TIMEOUT_SECONDS))

  while (( SECONDS < deadline )); do
    if [[ "$STARTED_API" == "1" ]] && ! kill -0 "$API_PID" 2>/dev/null; then
      wait "$API_PID" || true
      fail "API exited before health endpoint became ready"
    fi

    local http_code
    http_code="$(curl --silent --output "$BODY_FILE" --write-out '%{http_code}' "$HEALTH_URL" || true)"

    if [[ "$http_code" == "200" ]]; then
      echo "[smoke] API responded at $HEALTH_URL"
      return 0
    fi

    sleep 1
  done

  fail "timeout waiting for $HEALTH_URL"
}

run_preflight() {
  local origin="$1"
  curl --silent --show-error --output "$BODY_FILE" --dump-header "$HEADERS_FILE" --write-out '%{http_code}' -X OPTIONS "$TRPC_URL" -H "Origin: $origin" -H 'Access-Control-Request-Method: POST' -H "Access-Control-Request-Headers: $REQUEST_HEADERS"
}

assert_allowed_origin_preflight() {
  echo "[smoke] checking allowed-origin preflight"
  local http_code
  http_code="$(run_preflight "$ALLOWED_ORIGIN")"

  assert_equals "204" "$http_code" 'allowed preflight status'
  assert_equals "$ALLOWED_ORIGIN" "$(header_value "$HEADERS_FILE" 'access-control-allow-origin')" 'allowed origin header'
  assert_equals 'true' "$(header_value "$HEADERS_FILE" 'access-control-allow-credentials')" 'allow credentials header'
  assert_equals "$REQUEST_HEADERS" "$(header_value "$HEADERS_FILE" 'access-control-allow-headers')" 'allow headers header'
}

assert_blocked_origin_preflight() {
  echo "[smoke] checking blocked-origin preflight"
  local http_code
  http_code="$(run_preflight "$BLOCKED_ORIGIN")"

  if [[ ! "$http_code" =~ ^[24][0-9]{2}$ ]]; then
    fail "blocked preflight returned unexpected status '$http_code'"
  fi

  assert_empty "$(header_value "$HEADERS_FILE" 'access-control-allow-origin')" 'blocked allow-origin header'
  assert_empty "$(header_value "$HEADERS_FILE" 'access-control-allow-credentials')" 'blocked allow-credentials header'
  assert_empty "$(header_value "$HEADERS_FILE" 'access-control-allow-headers')" 'blocked allow-headers header'
}

start_api
wait_for_api
assert_allowed_origin_preflight
assert_blocked_origin_preflight

echo "[smoke] /trpc/auth.login CORS contract OK"
