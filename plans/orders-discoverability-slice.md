# Orders discoverability slice

## Goal
Surface the already-shipped Orders module more clearly in the app shell and dashboard hub as a small but meaningful user-facing follow-up.

## Current repo evidence
- The persistent nav in `apps/web/src/app/layout.tsx` currently surfaces `Dashboard`, `Board`, `Invoices`, and `Cashflow`, but not `Orders`.
- The dashboard hub in `apps/web/src/app/page.tsx` currently includes module cards for `Board`, `Invoices`, and `Cashflow`, but not `Orders`.
- The current dashboard tests in `apps/web/src/app/page.test.tsx` verify the logged-in hub links for those existing modules.
- Orders Workspace v1 is already shipped as a dedicated `/orders` route, so this slice is pure discoverability, not a new module build.

## Safe implementation shape
1. Add `Orders` to persistent navigation using the same top-level nav pattern as the existing modules.
2. Add an Orders module card to the dashboard hub using the current module-card pattern.
3. Keep copy simple and consistent:
   - position Orders as the start of the flow
   - CTA: `Open orders`
4. Keep any planning handoff hint lightweight and only where the current dashboard-card copy pattern already supports it.
5. Do not introduce new metrics, new data loading, or any IA redesign beyond surfacing the already-existing module.

## Files expected
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/page.test.tsx`
- `plans/orders-discoverability-slice.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/page.test.tsx`

## Explicitly out of scope
- backend/API widening
- new aggregate metrics
- planning redesign
- IA rebuild beyond surfacing the existing Orders module
- board/app redesign
