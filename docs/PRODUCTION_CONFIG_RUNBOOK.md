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

### `SENTRY_DSN`
- Optional.
- When set, enables Sentry error monitoring for the API runtime and Next.js server runtime.
- Leave unset to keep the monitoring baseline in log-only mode.
- Treat as a secret.

### `NEXT_PUBLIC_SENTRY_DSN`
- Optional.
- When set, enables Sentry browser-side error monitoring for the web app.
- Leave unset to keep browser monitoring disabled.
- Public by nature in the client bundle; do not treat it as a secret.

### `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
- Optional.
- Label Sentry events by environment (for example `production`, `staging`).

### `SENTRY_RELEASE` / `NEXT_PUBLIC_SENTRY_RELEASE`
- Optional.
- Label Sentry events by release/build identifier.

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

## Monitoring baseline (`Sentry + logy`)
Minimal M4 baseline now consists of:
- API startup/error logging via Nest logger
- API access logs for incoming HTTP requests
- env-gated Sentry capture for API runtime and Next.js runtime when DSNs are configured
- env-gated browser Sentry capture when `NEXT_PUBLIC_SENTRY_DSN` is configured

Safe default when DSNs are unset:
- app continues to boot normally
- logs remain active
- Sentry stays disabled without failing the build/runtime

Minimal verification path:
1. Build the workspace with DSNs unset.
2. Start the API and web normally.
3. Confirm startup log includes either:
   - `API monitoring baseline active: Sentry + access/error logs`, or
   - `API monitoring baseline active: access/error logs (Sentry disabled: missing SENTRY_DSN)`
4. Hit `/health` or `/trpc/auth.login` and confirm access logs are emitted.
5. If DSNs are configured, trigger a handled test error in a non-production environment and confirm it appears in Sentry.

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

### Check schema drift (`app` vs legacy `public`)
Run this after migrations, before release cutovers, and during incident review if an environment may have been initialized from the older divergent schema state.

```bash
npm run db:check:schema-drift
```

The drift check is metadata-only and exits non-zero when either of these is true:
- required Planovna tables or enums are missing from schema `app`, or
- matching Planovna business/auth tables or enums are present in schema `public`.

Expected healthy result:
- required objects exist in `app`
- no Planovna business/auth objects are reported in `public`

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
- invoice guidance text `Review invoice status here, then jump directly to the dedicated invoice or cashflow pages for the next finance step.`
- direct links `Open cashflow page` and `Open invoices page`
- link `Open invoices workspace`
- section `Next cashflow items`
- up to three dated cashflow rows rendered from the shipped `cashflow.list` contract

### Verify dedicated `/cashflow` page
Use the dedicated cashflow route to confirm the app now exposes a cashflow-specific entrypoint beyond the homepage summary.

Minimal verification path:
1. Start the app stack locally.
2. Open `http://127.0.0.1:${PORT:-3000}/cashflow`.
3. Confirm the page renders without a 404 and mounts the shared app shell.

Expected visible markers:
- heading `Cashflow`
- text `Dedicated cashflow view built on the same shipped homepage snapshot contract.`
- direct link `Open invoices page`
- existing homepage/app shell content rendered beneath the cashflow header

### Verify dedicated `/invoices` page
Use the dedicated invoice route to confirm the app now exposes an invoice-specific entrypoint beyond API-only export paths.

Minimal verification path:
1. Start the app stack locally.
2. Open `http://127.0.0.1:${PORT:-3000}/invoices`.
3. Confirm the page renders without a 404 and mounts the shared app shell.

Expected visible markers:
- heading `Invoices`
- text `Dedicated invoice view built on the same shipped homepage finance and export contract.`
- block `Invoice export actions`
- direct link `Open cashflow page`
- link `Open homepage finance workspace`
- block `Invoice status summary`
- block `Recent invoices`
- logged-out marker `Log in on the homepage to load invoice data.`
- empty-data marker `No invoices available yet.`
- existing homepage/app shell content rendered beneath the invoice header

### Verify self-serve Owner registration baseline
Use the shipped homepage registration form to confirm onboarding no longer depends on pre-created operator users.

Minimal verification path:
1. Start the app stack locally.
2. Open `http://127.0.0.1:${PORT:-3000}/`.
3. Submit a fresh company + email + password in the registration form.
4. Confirm the homepage enters authenticated state (`Logged in`).
5. Log out and immediately try the same company+email again.
6. Trigger repeated registration attempts for the same identity until rate-limit protection responds.

Expected visible/API markers:
- success marker (UI): `Logged in`
- duplicate guard marker (UI): `This email is already registered. Please log in instead.`
- duplicate guard marker (API): HTTP `409`
- rate-limit guard marker (UI): `Too many registration attempts. Please wait a moment and try again.`
- rate-limit guard marker (API): HTTP `429`
- no partial onboarding state: duplicate/rate-limited retries must not create extra tenant/user pairs

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
6. Check schema drift before boot:
   ```bash
   npm run db:check:schema-drift
   ```
7. Start the API:
   ```bash
   npm -w apps/api run start:prod
   ```
8. Verify liveness:
   ```bash
   curl http://127.0.0.1:${PORT:-3000}/health
   ```
9. Verify readiness:
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

### Schema drift check fails
A failed `npm run db:check:schema-drift` means the environment does not match the approved `app` schema baseline.

Typical failure modes:
- one or more required Planovna tables/enums are missing from `app`
- duplicate legacy Planovna tables/enums still exist in `public`

Recommended operator remediation path:
1. Stop and back up the database before any manual correction.
2. Run the drift check and save the JSON output.
3. Determine which schema contains the live Planovna data (`app` vs `public`) before changing search paths or dropping objects.
4. If live data is only in `public`, plan a controlled migration/copy into `app` before restart.
5. If `app` is correct and `public` only contains stale duplicates, remove the duplicate legacy objects in a controlled maintenance window.
6. Re-run:
   ```bash
   npm -w apps/api run prisma:migrate:deploy
   npm run db:check:schema-drift
   ```
7. Only then restart the API and re-check `/health` and `/health/ready`.

Important safety note:
- the drift check itself is metadata-only and does not mutate database state
- remediation is intentionally operator-driven because the older divergent `public` schema may contain real production data in some environments

### API boot fails in production
- Confirm `NODE_ENV=production`.
- Confirm `AUTH_TOKEN_SECRET` is set and not equal to `planovna-dev-secret`.
- Check startup logs, then re-run the preflight.
