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
- Required in production.
- Must be non-empty.
- Purpose: database connection string used by Prisma.
- Treat as a secret.

## Optional environment variables

### `PORT`
- Optional.
- Defaults to `3000` when unset.

### `NODE_ENV`
- Recommended value: `production`.
- The app already enforces the `AUTH_TOKEN_SECRET` production guardrail when `NODE_ENV=production`.

## Preflight command

Run this before `start:prod` on every production deploy:

```bash
npm run prod:preflight
```

The preflight script:
- fails with a non-zero exit code when required values are missing,
- prints a clear missing-keys summary,
- rejects the development fallback auth secret.

Direct invocation is also supported:

```bash
bash ./scripts/prod_config_preflight.sh
```

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
4. Start the API:
   ```bash
   npm -w apps/api run start:prod
   ```
5. Verify readiness:
   ```bash
   curl http://127.0.0.1:${PORT:-3000}/health
   ```

Expected readiness payload:

```json
{
  "status": "ready",
  "service": "api"
}
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
5. Confirm `/health` is ready.
6. Expect existing sessions to require re-authentication.

### `DATABASE_URL`
Rotate according to the database provider process.

Recommended rotation steps:
1. Provision the new database credential or endpoint.
2. Update `DATABASE_URL` in the deployment environment.
3. Run `npm run prod:preflight`.
4. Restart the API.
5. Confirm the service boots and `/health` is ready.

## Failure modes

### Preflight fails
- Read the missing/invalid variable summary.
- Fix the environment.
- Re-run `npm run prod:preflight`.

### API boot fails in production
- Confirm `NODE_ENV=production`.
- Confirm `AUTH_TOKEN_SECRET` is set and not equal to `planovna-dev-secret`.
- Confirm `DATABASE_URL` is set.
- Check startup logs, then re-run the preflight.
