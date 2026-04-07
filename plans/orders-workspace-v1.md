# Orders Workspace v1

## Goal
Implement the smallest useful but visibly substantial `/orders` working surface as the next module-level Planovna step.

## Current repo evidence
- There is no dedicated `apps/web/src/app/orders/` route yet in the current checkout.
- The extracted shared workspace already contains the safe current order data surface:
  - `OrderSummary`
  - `client.order.list.query()`
  - route-local order loading used for routing-template and planning entry workflows
- Current `OrderSummary` contract safely exposes:
  - `id`
  - `code`
  - `title`
  - `status`
  - `dueDate?`
  - `notes?`
- Navigation coverage currently verifies dedicated titles for `/invoices` and `/cashflow`, but not `/orders` yet.

## Safe implementation shape
1. Add a dedicated `/orders` route as a real order-first working surface.
2. Keep it list-first and route-local.
3. Include:
   - page header with title `Orders`
   - primary CTA `New order`
   - practical search/filter bar using only already-safe route-local semantics
   - main orders list with stronger row hierarchy and scanability
   - optional lightweight summary only if it can be truthfully derived from the current order list contract
   - explicit row-level continuation only where already safely supported by existing route/app flows
   - explicit loading / empty / error / no-results states
4. If richer summary/continuation semantics are not already truthful, prefer fewer simpler elements.

## Likely implementation approach
- Create `apps/web/src/app/orders/page.tsx` as a client route using the existing access-token pattern and `client.order.list.query()`.
- Keep logged-out behavior aligned with the existing auth/app entry path.
- Derive only safe route-local filters from the current order contract, likely:
  - search by code/title
  - status filter
- Render a list-first workspace emphasizing:
  - order code
  - title
  - status badge
  - due date when present
  - notes preview when present
- Use a safe continuation action only if an existing route is already appropriate (likely board/planning continuation rather than inventing order detail UI).
- Add focused route tests plus navigation coverage for the new module route.

## Files expected
- `apps/web/src/app/orders/page.tsx`
- likely `apps/web/src/app/orders/page.test.tsx`
- `apps/web/src/app/navigation.test.tsx`
- `plans/orders-workspace-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/orders/page.test.tsx src/app/navigation.test.tsx`
- broaden only if a minimal shared helper extraction becomes necessary

## Explicitly out of scope
- backend/API widening
- workflow designer
- macro/command system
- per-user personalization
- unsafe bulk actions
- ERP/accounting expansion
- board/app redesign
- full order-detail redesign
