# Cashflow Workspace v1

## Goal
Implement the smallest useful but visibly substantial `/cashflow` working surface as the next module-level Planovna step.

## Current repo evidence
- `apps/web/src/app/cashflow/page.tsx` is still a lightweight placeholder route.
- The extracted shared workspace already contains trustworthy cashflow route-local data primitives:
  - `CashflowItem`
  - `RecurringCashflowRule`
  - `client.cashflow.list.query()`
  - recurring rule loading and simple cashflow list rendering
- Navigation coverage already verifies the dedicated `/cashflow` route title in `apps/web/src/app/navigation.test.tsx`.

## Safe implementation shape
1. Keep `/cashflow` as a dedicated real module page, not a full finance redesign.
2. Reuse only already-trustworthy route-local cashflow semantics from the current surface.
3. Build a focused workspace with:
   - page header with title `Cashflow`
   - primary CTA `Add cashflow item`
   - a small summary strip using only safe current-route semantics
   - practical lightweight filters (time horizon / type / status only where already truthful)
   - one main list-first working surface (optionally light list/timeline hybrid only if still truthfully derived)
   - explicit loading / empty / error / no-results states
   - light UI polish for hierarchy, spacing, badges, and amount/date scanability
4. Prefer fewer simpler summary cards over pseudo-precision.

## Likely implementation approach
- Replace the placeholder with a client-side route surface that uses the existing access-token pattern and calls the already-available cashflow list path.
- Keep logged-out behavior consistent with the current app entry/auth surface.
- Derive a small set of safe summary metrics from loaded `CashflowItem[]`, such as:
  - total items
  - planned in count
  - actual in count
  - near-term items count
  - next upcoming date/count only if directly supported by current item dates
- Add minimal filters that can be derived truthfully from existing item fields (kind/date; status only if truly exposed).
- Render a list-first workspace emphasizing:
  - kind badge
  - amount
  - date
  - linked invoice id/reference if already present
- Add focused route tests for loading/empty/error/filter/list behavior.

## Files expected
- `apps/web/src/app/cashflow/page.tsx`
- likely new route-local test file(s) under `apps/web/src/app/cashflow/`
- `apps/web/src/app/navigation.test.tsx`
- `plans/cashflow-workspace-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/cashflow/page.test.tsx src/app/navigation.test.tsx`
- broaden only if a minimal shared helper extraction becomes necessary

## Explicitly out of scope
- backend/API widening
- ERP/accounting redesign
- bank matching/reconciliation
- scenario engine
- advanced analytics dashboard
- batch console
- full finance-page redesign
- design-system rewrite
