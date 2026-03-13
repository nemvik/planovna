# M1 Backlog (Week 1)

## P0
- [x] Setup monorepo scripts and shared lint/test commands
- [x] Add Prisma + Postgres connection + initial migration
- [x] Implement Tenant/User/Role model
- [x] Implement auth skeleton (email+password + magic-link token tables)
- [x] CRUD: Customer
- [x] CRUD: Order
- [x] CRUD: Operation
- [x] Add optimistic lock helper (`version` checks)
- [x] Seed script for demo tenant
- [x] Configure CORS for split frontend/backend domains (stage/prod), including credentials/origin allowlist from env

## Tests
- [x] Integration tests for tenant isolation
- [x] Integration tests for version conflict
- [x] Smoke test: create customer/order/operation flow
- [x] Cross-origin smoke test: web -> API works on different domains without CORS failure
- [x] Add frontend E2E smoke tests (Playwright): login, board load, operation edit, persistence after reload
- [x] Add UX regression checks for key flows (empty state, loading state, error state, responsive layout)

## Exit criteria M1
- API CRUD for core entities works in stage
- Tenant isolation test green
- Auth login path usable in dev
