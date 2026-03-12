# M1 Backlog (Week 1)

## P0
- [ ] Setup monorepo scripts and shared lint/test commands
- [ ] Add Prisma + Postgres connection + initial migration
- [ ] Implement Tenant/User/Role model
- [ ] Implement auth skeleton (email+password + magic-link token tables)
- [ ] CRUD: Customer
- [ ] CRUD: Order
- [ ] CRUD: Operation
- [ ] Add optimistic lock helper (`version` checks)
- [ ] Seed script for demo tenant
- [x] Configure CORS for split frontend/backend domains (stage/prod), including credentials/origin allowlist from env

## Tests
- [ ] Integration tests for tenant isolation
- [ ] Integration tests for version conflict
- [ ] Smoke test: create customer/order/operation flow
- [x] Cross-origin smoke test: web -> API works on different domains without CORS failure
- [ ] Add frontend E2E smoke tests (Playwright): login, board load, operation edit, persistence after reload
- [ ] Add UX regression checks for key flows (empty state, loading state, error state, responsive layout)

## Exit criteria M1
- API CRUD for core entities works in stage
- Tenant isolation test green
- Auth login path usable in dev
