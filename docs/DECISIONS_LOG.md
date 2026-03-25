# Plánovna — Decisions Log

## 2026-03-05
- API: tRPC end-to-end
- Concurrency: optimistic lock (version), conflict => error
- Cashflow model: PLANNED + ACTUAL separate items
- Board: backlog + date columns, manual order, multi-day ops allowed
- Auth: email+password + magic link
- Currencies: CZK, EUR
- Owner-only delete actions

## 2026-03-25
- Tenant onboarding baseline for MVP: self-serve public Owner registration with automatic tenant creation
- Out of MVP onboarding scope: self-serve invites, billing automation, email verification, 2FA
- Public onboarding aligned to the shipped tRPC auth surface; legacy REST `/auth/register` remains as compatibility shim

## 2026-03-08
- Production auth boot guardrail: API startup must fail fast in production unless `AUTH_TOKEN_SECRET` is explicitly set to a non-default value; smoke automation proves both reject-without-secret and healthy boot-with-secret paths.
