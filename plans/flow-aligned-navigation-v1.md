# Flow-Aligned Navigation v1

## Goal
Implement a narrow shell-only navigation consistency slice so the persistent nav matches the shipped product flow: Dashboard, then Orders -> Board -> Invoices -> Cashflow, with clear active-route state.

## Current repo evidence
- `apps/web/src/app/layout.tsx` owns the persistent top-level nav shell.
- Current shipped flow messaging in the dashboard/module copy now teaches: Orders -> Board -> Invoices -> Cashflow.
- `apps/web/src/app/navigation.test.tsx` currently verifies module route titles, but not nav ordering or active-route state.

## Safe implementation shape
1. Keep `Dashboard` as the hub entry.
2. Reorder the post-dashboard nav sequence to:
   - Orders
   - Board
   - Invoices
   - Cashflow
3. Add clear active-page state in the shell.
4. Preserve existing routes and labels.
5. Keep this shell-only: no data loading, no new routes, no workflow changes.
6. Use a tiny nav helper only if strictly needed for active-route detection.

## Likely implementation approach
- Update `apps/web/src/app/layout.tsx` nav item order.
- Add active-route styling/attributes using the current pathname, likely via a tiny client nav helper if needed because layout itself is server-rendered.
- Extend `apps/web/src/app/navigation.test.tsx` to verify nav ordering and active state with the smallest necessary surface.

## Files expected
- `apps/web/src/app/layout.tsx`
- likely one tiny helper component under `apps/web/src/app/` if active-route detection requires client hooks
- `apps/web/src/app/navigation.test.tsx`
- `plans/flow-aligned-navigation-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/navigation.test.tsx`

## Explicitly out of scope
- backend/API widening
- new routes
- new dashboard metrics or data loading
- workflow change
- planning redesign
- board/app redesign
