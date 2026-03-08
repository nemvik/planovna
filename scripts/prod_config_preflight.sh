#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  AUTH_TOKEN_SECRET
  DATABASE_URL
)

missing_vars=()
invalid_vars=()

trimmed_value() {
  local value="${1-}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
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

if (( ${#missing_vars[@]} == 0 )) && (( ${#invalid_vars[@]} == 0 )); then
  echo 'Production config preflight OK'
  echo
  echo 'Validated required variables:'
  for var_name in "${required_vars[@]}"; do
    echo "- $var_name"
  done
  echo
  echo 'Optional variables:'
  echo '- PORT (default: 3000)'
  echo '- NODE_ENV (recommended: production)'
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
