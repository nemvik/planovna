# Invoices Flow Framing v1

## Goal
Implement a narrow route-local wording cleanup so `/invoices` is clearly framed as the finance review step between planning and cashflow.

## Current repo evidence
- `/invoices` already has an honest `Open cashflow` CTA.
- `/invoices` already includes helper copy: `Use cashflow when you need the next finance follow-up after invoice review.`
- The remaining gap is the generic header intro, which does not explicitly anchor Invoices in the broader flow.
- The current route test already covers the shell and can absorb a narrow copy update.

## Safe implementation shape
1. Keep this route-local to `/invoices` only.
2. Preserve the existing `Open cashflow` handoff.
3. Preserve the current PDF/document affordance, routes, data/query surface, filters, metrics, and row semantics.
4. Update only header/supporting wording so Invoices is clearly framed as the finance review step between planning and cashflow.
5. Do not add routes, data loading, workflow semantics, or redesign.

## Files expected
- `apps/web/src/app/invoices/page.tsx`
- `apps/web/src/app/invoices/page.test.tsx`
- `plans/invoices-flow-framing-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/invoices/page.test.tsx`

## Explicitly out of scope
- backend/API widening
- new routes
- dashboard metrics or data-loading changes
- workflow change
- finance-model change
- board/app redesign
