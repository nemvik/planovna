# Board Flow Framing v1

## Goal
Implement a narrow board-shell wording cleanup so `/board` is framed clearly as the planning step between Orders and later finance follow-up.

## Current repo evidence
- `apps/web/src/app/home-workspace.tsx` is the current `/board` surface.
- The board shell still describes the surface mainly in technical backlog/date-bucket terms.
- Dashboard, navigation, and `/orders` already teach the broader flow: Orders -> Board -> Invoices -> Cashflow.
- `/board` already has downstream handoffs to `/invoices` and `/cashflow` in the current shipped shell.

## Safe implementation shape
1. Keep this route-local to the existing board shell only.
2. Update intro/helper wording so the board is clearly framed as the planning step.
3. Keep current downstream finance handoffs intact.
4. Do not change routes, data loading, workflow semantics, or layout structure beyond wording/helper emphasis.

## Files expected
- `apps/web/src/app/home-workspace.tsx`
- `apps/web/src/app/home-workspace.test.tsx`
- `plans/board-flow-framing-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/home-workspace.test.tsx`

## Explicitly out of scope
- backend/API widening
- new routes
- new metrics or data loading
- workflow change
- planning redesign
- finance-model changes
- board/app redesign
