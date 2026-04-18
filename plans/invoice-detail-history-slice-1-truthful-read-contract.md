# Invoice detail/history / slice 1 truthful single-invoice read contract plan

## Goal
Deliver a truthful read-only `/invoices/[invoiceId]` detail view backed by an exact single-invoice read path, not cached list-only client state.

## Current repo evidence
- `apps/api/src/trpc/routers/invoice.router.ts` currently exposes `list`, `issue`, `paid`, `update`, `cancel` only.
- `apps/api/src/modules/invoice/invoice.service.ts` already has the exact invoice row selection logic needed for read shapes inside `list()` and write-return paths, but no dedicated single-invoice read method.
- `apps/web/src/app/invoices/page.tsx` is list-first and already renders the truthful read-only field subset we want to reuse: `id`, `number`, `status`, `amountGross`, `currency`, `buyerDisplayName?`, `issuedAt?`, `dueAt?`, `paidAt?`, `pdfPath`, `version`.
- Current repo therefore has one exact gap: no auth-scoped single-invoice read contract.

## Narrow contract change
Add a new read-only API path:
- `invoice.getById`
- input: `{ invoiceId: string }`
- auth-scoped by current tenant through existing `invoiceReadProcedure`
- return: same current invoice summary/detail-safe surface already used on `/invoices`
  - `id`
  - `number`
  - `status`
  - `amountGross`
  - `currency`
  - `buyerDisplayName?` if already available via current mapping path
  - `issuedAt?`
  - `dueAt?`
  - `paidAt?`
  - `pdfPath`
  - `version`

## Why this is still narrow
- No mutation work.
- No edit/delete/cancel/mark-paid behavior on detail route.
- No event timeline.
- No totals/VAT breakdown widening beyond current summary-safe surface.
- No Board/workflow redesign.
- No new model/schema change.

## Expected touchpoints
### API
- `apps/api/src/modules/invoice/dto/invoice.dto.ts`
  - add `GetInvoiceByIdSchema`
- `apps/api/src/modules/invoice/invoice.service.ts`
  - add `getById(actorTenantId, invoiceId)`
  - reuse existing row-to-record mapping and tenant scoping
- `apps/api/src/trpc/routers/invoice.router.ts`
  - add `getById` query on `invoiceReadProcedure`
- `apps/api/test/trpc-invoice.e2e-spec.ts`
  - add focused auth/tenant/not-found/success coverage for `invoice.getById`

### Web
- `apps/web/src/app/invoices/page.tsx`
  - add truthful in-app detail link separate from PDF link
- `apps/web/src/app/invoices/page.test.tsx`
  - verify separate detail vs PDF destinations remain explicit
- `apps/web/src/app/invoices/[invoiceId]/page.tsx`
  - new route-local read-only detail page
  - fetch through `invoice.getById`
- `apps/web/src/app/invoices/[invoiceId]/page.test.tsx`
  - focused read-only route coverage

## Focused tests
### API
- authorized owner/finance can read same-tenant invoice by id
- unauthorized caller blocked
- wrong-tenant or missing invoice returns forbidden/not-found behavior matching current invoice read policy

### Web
- `/invoices` shows `Open details` separately from `Open PDF`
- `/invoices/[invoiceId]` renders read-only invoice snapshot fields only
- no edit/delete/cancel/mark-paid controls on detail route
- missing invoice shows truthful unavailable state

## Main risk
- scope creep from single-invoice read into full invoice workspace/history timeline
- mitigation: detail route must stay read-only and render only the approved current field set

## Verdict
Current repo supports this slice.
The only exact widening required is a narrow single-invoice read contract (`invoice.getById`) plus the route-local detail page that consumes it.
No broader amount/totals/VAT/currency/cashflow/PDF/model widening is required.