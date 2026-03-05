# Architecture MVP (v1)

## System
- Frontend: Next.js (apps/web)
- Backend: NestJS (apps/api)
- DB: Postgres (schema `app`)
- API style: tRPC end-to-end (to be wired in week 1)

## Core entities
- Tenant
- User
- Customer
- Order
- Operation
- OperationDependency
- Invoice
- CashflowItem

## Concurrency
- `version` column on mutable entities (Order/Operation/Invoice/CashflowItem)
- Update requires expected version; mismatch => conflict error

## Board model
- Columns: `BACKLOG` + date buckets (YYYY-MM-DD)
- Multi-day operation represented by `start_date`, `end_date`
- Manual order: `sort_index` (integer)

## Cashflow model
- Two records per invoice lifecycle:
  - planned inflow (on issue)
  - actual inflow (on payment)
- Invoice changes trigger deterministic recalculation

## Security
- Required `tenant_id` on all business tables
- API tenant guard on every read/write
- Owner-only destructive actions

## Open implementation tasks
1. Add Prisma schema + migrations
2. Add auth (email/password + magic link)
3. Wire tRPC in Nest + typed client in Next
4. Implement P0 endpoints and board state transitions
