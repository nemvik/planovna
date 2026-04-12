# Cashflow Flow Completion Framing v1

## Goal
Implement a narrow wording-only cleanup in the `/cashflow` shell so Cashflow is clearly framed as the final finance timeline step after invoice review.

## Current repo evidence
- `/cashflow` is already a shipped dedicated module.
- The header currently truthfully points back to `/invoices` for the source finance document.
- The remaining gap is shell framing: the intro stays mostly generic list-first wording and does not clearly anchor Cashflow as the final step in the broader flow.
- Current route tests already cover the `/cashflow` shell and can absorb a narrow copy update.

## Safe implementation shape
1. Keep this route-local to `/cashflow` only.
2. Preserve the existing back-link to `/invoices`.
3. Preserve the current list/data/query surface, filters, metrics, and row semantics.
4. Update only header/supporting wording so Cashflow is framed as the finance timeline step after invoice review.
5. Do not add routes, data loading, workflow semantics, or redesign.

## Files expected
- `apps/web/src/app/cashflow/page.tsx`
- `apps/web/src/app/cashflow/page.test.tsx`
- `plans/cashflow-flow-completion-framing-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/cashflow/page.test.tsx`

## Explicitly out of scope
- backend/API widening
- new routes
- new dashboard metrics or data loading
- workflow change
- planning redesign
- finance-model changes
- board/app redesign
