# Plan: schema drift detection + remediation guidance

## Goal
Add explicit detection for environments that still carry the older divergent `public`-schema Planovna objects instead of the approved `app` schema baseline, and document operator remediation steps.

## Intended changes
1. Add a repo-run check script that inspects Postgres metadata for required Planovna objects in `app` and flags duplicate/drifted objects in `public`.
2. Make the script fail clearly when:
   - required Planovna tables are missing from `app`, or
   - duplicate Planovna business/auth tables are present in `public`.
3. Add operator-facing remediation guidance to the production runbook for drifted environments.
4. Add focused test coverage for the detection logic where practical.
5. Keep the legacy REST `/auth/register` shim untouched in this change.

## Files expected
- `scripts/...` drift check script
- `package.json` and/or `apps/api/package.json` if a runnable command is added
- `docs/PRODUCTION_CONFIG_RUNBOOK.md`
- optional focused test file(s)

## Validation planned
- run the new drift check against the current approved `app` schema environment
- run targeted tests for any extracted detection logic
- run `git diff --check`

## Risks / notes
- detection must be metadata-only and not mutate DB state
- remediation doc must distinguish between safe detection and manual/operator migration steps
- this should not alter the released auth/onboarding flow or remove the REST shim
