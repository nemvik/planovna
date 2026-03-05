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

## Tests
- [ ] Integration tests for tenant isolation
- [ ] Integration tests for version conflict
- [ ] Smoke test: create customer/order/operation flow

## Exit criteria M1
- API CRUD for core entities works in stage
- Tenant isolation test green
- Auth login path usable in dev
