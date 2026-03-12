#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  AUTH_TOKEN_SECRET
  DATABASE_URL
)

missing_vars=()
invalid_vars=()

optional_vars=(
  'PORT (default: 3000)'
  'NODE_ENV (recommended: production)'
  'API_CORS_ALLOWED_ORIGINS (optional comma-separated http/https origins)'
)

trimmed_value() {
  local value="${1-}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

validate_cors_allowed_origins() {
  local raw_value="$1"
  local value
  local origin

  value="$(trimmed_value "$raw_value")"

  if [[ -z "$value" ]]; then
    invalid_vars+=(
      'API_CORS_ALLOWED_ORIGINS (must not be empty when set)'
    )
    return
  fi

  IFS=',' read -r -a cors_origins <<< "$raw_value"

  for origin in "${cors_origins[@]}"; do
    origin="$(trimmed_value "$origin")"

    if [[ -z "$origin" ]]; then
      invalid_vars+=(
        'API_CORS_ALLOWED_ORIGINS (must not contain empty entries)'
      )
      return
    fi

    if [[ ! "$origin" =~ ^https?://[^/,:?#[:space:]]+(:[0-9]{1,5})?$ ]] && [[ ! "$origin" =~ ^https?://\[[0-9A-Fa-f:]+\](:[0-9]{1,5})?$ ]]; then
      invalid_vars+=(
        'API_CORS_ALLOWED_ORIGINS (entries must be comma-separated http/https origins without paths, queries, or fragments)'
      )
      return
    fi
  done
}

for var_name in "${required_vars[@]}"; do
  raw_value="${!var_name-}"
  value="$(trimmed_value "$raw_value")"

  if [[ -z "$value" ]]; then
    missing_vars+=("$var_name")
    continue
  fi

  case "$var_name" in
    AUTH_TOKEN_SECRET)
      if [[ "$value" == 'planovna-dev-secret' ]]; then
        invalid_vars+=("$var_name (must not use the development fallback value)")
      fi
      ;;
  esac
done

if [[ ${API_CORS_ALLOWED_ORIGINS+x} ]]; then
  validate_cors_allowed_origins "$API_CORS_ALLOWED_ORIGINS"
fi

if (( ${#missing_vars[@]} == 0 )) && (( ${#invalid_vars[@]} == 0 )); then
  echo 'Production config preflight OK'
  echo
  echo 'Validated required variables:'
  for var_name in "${required_vars[@]}"; do
    echo "- $var_name"
  done
  echo
  echo 'Optional variables:'
  for item in "${optional_vars[@]}"; do
    echo "- $item"
  done
  exit 0
fi

echo 'Production config preflight FAILED'

if (( ${#missing_vars[@]} > 0 )); then
  echo
  echo 'Missing required variables:'
  for var_name in "${missing_vars[@]}"; do
    echo "- $var_name"
  done
fi

if (( ${#invalid_vars[@]} > 0 )); then
  echo
  echo 'Invalid variable values:'
  for item in "${invalid_vars[@]}"; do
    echo "- $item"
  done
fi

echo
cat <<'EOF'
Expected minimum production environment:
- AUTH_TOKEN_SECRET=<strong secret>
- DATABASE_URL=<database connection string>

Run again after exporting the required values.
EOF

exit 1
