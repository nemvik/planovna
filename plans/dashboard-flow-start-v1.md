# Dashboard Flow Start v1

## Goal
Implement the smallest useful dashboard-only copy/hierarchy refinement that makes the post-login product flow clearer.

## Current repo evidence
- `apps/web/src/app/page.tsx` already renders an auth-aware lightweight dashboard after login.
- The current hero still foregrounds Board as the default next step.
- Dashboard module cards already exist for Board, Orders, Invoices, and Cashflow.
- `apps/web/src/app/page.test.tsx` already verifies logged-in dashboard CTA links.
- No extra dashboard data loading is present or needed.

## Safe implementation shape
1. Keep implementation inside the dashboard surface only.
2. Reframe hero copy so the flow is explained succinctly as:
   - Orders -> Board -> Invoices -> Cashflow
3. Make `Open orders` the primary hero CTA.
4. Make `Open board` the secondary hero CTA.
5. Replace generic continuation wording with explicit destination labels.
6. Refine module-card copy so each card answers when the user should go there.
7. Order dashboard cards by flow, with Orders first.
8. Do not introduce any new metrics, data loading, routes, or workflow semantics.

## Files expected
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/page.test.tsx`
- `plans/dashboard-flow-start-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/page.test.tsx`

## Explicitly out of scope
- backend/API widening
- new dashboard metrics or data loading
- new routes
- planning redesign
- workflow-designer
- macro/command system
- personalization
- unsafe bulk actions
- board/app redesign
