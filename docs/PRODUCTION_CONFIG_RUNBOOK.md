# Production Configuration Runbook

This runbook makes the production runtime contract explicit before boot.

## Required environment variables

### `AUTH_TOKEN_SECRET`
- Required in production.
- Must be non-empty.
- Must **not** use the development fallback value `planovna-dev-secret`.
- Purpose: signs and verifies bearer tokens and magic-link token hashes.
- Treat as a secret.

### `DATABASE_URL`
- Required for full readiness in production.
- Must be non-empty.
- Purpose: database connection string used by Prisma readiness checks and future runtime data access.
- Treat as a secret.

## Optional environment variables

### `PORT`
- Optional.
- Defaults to `3000` when unset.

### `NODE_ENV`
- Recommended value: `production`.
- The app already enforces the `AUTH_TOKEN_SECRET` production guardrail when `NODE_ENV=production`.

### `API_CORS_ALLOWED_ORIGINS`
- Optional.
- When set, use a comma-separated list of explicit `http://` or `https://` origins.
- Each entry must be a single origin only; do not include empty entries, paths, query strings, or fragments.
- Example: `API_CORS_ALLOWED_ORIGINS=https://app.planovna.example,https://admin.planovna.example`

## Probe contract

### `GET /health`
- Lightweight liveness probe.
- Returns `200` when the API process is up.
- Does **not** perform dependency checks.

Expected payload:

```json
{
  "status": "ready",
  "service": "api"
}
```

### `GET /health/ready`
- Readiness probe.
- Verifies database dependency availability.
- Returns `200` when dependencies are ready.
- Returns `503` when the database is missing or unreachable.

Ready payload example:

```json
{
  "status": "ready",
  "service": "api",
  "dependencies": {
    "database": {
      "status": "up"
    }
  }
}
```

Not-ready payload example:

```json
{
  "status": "not_ready",
  "service": "api",
  "dependencies": {
    "database": {
      "status": "down",
      "code": "DATABASE_UNAVAILABLE",
      "reason": "database unreachable"
    }
  }
}
```

If `DATABASE_URL` is missing, readiness returns:

```json
{
  "status": "not_ready",
  "service": "api",
  "dependencies": {
    "database": {
      "status": "down",
      "code": "DATABASE_URL_MISSING",
      "reason": "database configuration missing"
    }
  }
}
```

## Preflight command

Run this before `start:prod` on every production deploy:

```bash
npm run prod:preflight
```

The preflight script:
- fails with a non-zero exit code when required values are missing,
- prints a clear missing-keys summary,
- rejects the development fallback auth secret,
- treats `API_CORS_ALLOWED_ORIGINS` as optional, but validates it when present.

Direct invocation is also supported:

```bash
bash ./scripts/prod_config_preflight.sh
```

## CORS smoke check

Use this after deploys, ingress changes, or CORS allowlist updates to confirm the live `POST /trpc/auth.login` endpoint answers preflight requests correctly.

Run from the repo root:

```bash
npm run smoke:cors:auth-login
```

Default behavior:
- boots the production API locally when `PLANOVNA_CORS_SMOKE_API_URL` is unset,
- checks an allowed origin preflight against `/trpc/auth.login`,
- checks a blocked origin preflight against the same endpoint.

Common overrides:
- `PLANOVNA_CORS_SMOKE_API_URL`: target an already running API instead of booting a local one.
- `PLANOVNA_CORS_SMOKE_ALLOWED_ORIGIN`: override the origin expected to be allowed.
- `PLANOVNA_CORS_SMOKE_BLOCKED_ORIGIN`: override the origin expected to remain blocked.

Example against a live API:

```bash
PLANOVNA_CORS_SMOKE_API_URL=https://api.planovna.example \
PLANOVNA_CORS_SMOKE_ALLOWED_ORIGIN=https://app.planovna.example \
PLANOVNA_CORS_SMOKE_BLOCKED_ORIGIN=https://blocked.planovna.example \
npm run smoke:cors:auth-login
```

## Prisma migration commands

Run these from the repo root or via `npm -w apps/api run ...`.

### Generate Prisma client
```bash
npm -w apps/api run prisma:generate
```

### Apply committed migrations
```bash
npm -w apps/api run prisma:migrate:deploy
```

### Check migration status
```bash
npm -w apps/api run prisma:migrate:status
```

### Seed demo tenant baseline
Dry-run without DB writes:
```bash
npm run seed:demo -- --dry-run
```

Apply the demo tenant seed:
```bash
npm run seed:demo
```

The root `seed:demo` command delegates to the shipped Prisma seed entrypoint in `apps/api` and is safe to re-run because it uses idempotent upserts for the demo baseline.

### Export invoice PDF baseline
Use the authenticated invoice PDF endpoint to verify the minimal PDF export path.

Example against a running API:
```bash
curl -sS \
  -H "Authorization: Bearer <token>" \
  -o invoice.pdf \
  -D - \
  http://127.0.0.1:${PORT:-3000}/invoices/<invoiceId>/pdf
```

Expected result:
- HTTP `200`
- header `Content-Type: application/pdf`
- header `Content-Disposition: attachment; filename="invoice-...pdf"`
- saved file starts with the PDF signature `%PDF-`

### Verify homepage cashflow summary baseline
Use the existing demo/homepage flow to confirm the user-visible cashflow snapshot is present.

Minimal verification path:
1. Start the app stack locally.
2. Log in on the homepage with a tenant that already has cashflow-backed invoices.
3. Confirm the homepage shows a `Cashflow snapshot` section.

Expected visible markers:
- card `Planned in`
- card `Actual in`
- section `Next cashflow items`
- up to three dated cashflow rows rendered from the shipped `cashflow.list` contract

`prisma:migrate:deploy` is the production-safe command for applying committed migrations against `DATABASE_URL` without creating new migration files on the server.

## Recommended deployment order

1. Export or inject production environment variables.
2. Run the preflight:
   ```bash
   npm run prod:preflight
   ```
3. Build the workspace:
   ```bash
   npm run build
   ```
4. Generate the Prisma client from the committed schema:
   ```bash
   npm -w apps/api run prisma:generate
   ```
5. Apply committed migrations against `DATABASE_URL`:
   ```bash
   npm -w apps/api run prisma:migrate:deploy
   ```
6. Start the API:
   ```bash
   npm -w apps/api run start:prod
   ```
7. Verify liveness:
   ```bash
   curl http://127.0.0.1:${PORT:-3000}/health
   ```
8. Verify readiness:
   ```bash
   curl -i http://127.0.0.1:${PORT:-3000}/health/ready
   ```

## Secret handling

- Keep `AUTH_TOKEN_SECRET` and `DATABASE_URL` outside git.
- Inject them from the deployment platform secret store or host-level environment.
- Never hardcode production secrets in source, docs, shell history, or CI logs.
- Use separate secret values per environment.
- Prefer long random values for `AUTH_TOKEN_SECRET`.

## Secret rotation

### `AUTH_TOKEN_SECRET`
Rotating this invalidates existing signed tokens. Plan a controlled re-login window.

Recommended rotation steps:
1. Generate a new strong secret.
2. Update the secret in the deployment environment.
3. Run `npm run prod:preflight`.
4. Restart the API.
5. Confirm `/health` is live.
6. Confirm `/health/ready` is ready.
7. Expect existing sessions to require re-authentication.

### `DATABASE_URL`
Rotate according to the database provider process.

Recommended rotation steps:
1. Provision the new database credential or endpoint.
2. Update `DATABASE_URL` in the deployment environment.
3. Run `npm run prod:preflight`.
4. Restart the API.
5. Confirm `/health` is live.
6. Confirm `/health/ready` is ready.

## Failure modes

### Preflight fails
- Read the missing/invalid variable summary.
- Fix the environment.
- Re-run `npm run prod:preflight`.

### Liveness fails
- The API process is not booted cleanly.
- Check startup logs and process supervision.

### Readiness fails in production
- Confirm `DATABASE_URL` is set.
- Confirm the database host is reachable from the API runtime.
- Confirm credentials and network policy/firewall rules.
- Check startup and request logs, then re-run the preflight.

### API boot fails in production
- Confirm `NODE_ENV=production`.
- Confirm `AUTH_TOKEN_SECRET` is set and not equal to `planovna-dev-secret`.
- Check startup logs, then re-run the preflight.
