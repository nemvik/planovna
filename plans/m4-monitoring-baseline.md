# Plan: M4 minimal monitoring baseline

## Goal
Audit current monitoring/logging against the brief requirement `Monitoring: Sentry + logy`, then implement only the missing minimal pilot-ready baseline.

## Intended changes
1. Verify current repo state for monitoring/logging on API and web.
2. If missing, add minimal Sentry wiring for API and web behind env/config so it is safe when DSNs are absent.
3. Ensure a basic logging baseline remains available (structured/default Nest/Next runtime logs, startup/error capture hooks, minimal docs/runbook notes).
4. Add only the smallest config/docs updates needed for operators to enable and verify the baseline.
5. Validate via build/tests and focused env-safe checks.

## Files expected
- docs/runbook/brief-adjacent docs if needed
- api bootstrap/main files if Sentry is absent
- web instrumentation/bootstrap files if Sentry is absent
- package manifests / lockfile only if dependencies are actually missing

## Validation planned
- targeted grep/audit evidence
- install deps only if needed
- workspace build
- focused tests if any touched area has existing coverage
- env-safe verification that app boots/builds without DSN configured

## Notes
- No invention of broader observability stack beyond the brief baseline.
- If baseline is already effectively present, stop at verified gap report and recommendation.
