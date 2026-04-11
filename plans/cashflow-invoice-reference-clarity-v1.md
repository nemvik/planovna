# Cashflow invoice reference clarity v1

## Goal
Make `/cashflow` invoice-linked rows explicitly name invoice reference metadata without implying a new detail route.

## Current repo evidence
- `/cashflow` already uses honest finance-to-finance header copy that points users back to `/invoices`.
- Each cashflow row already includes an `Invoice-linked` badge.
- The adjacent row text still uses the generic wording `Reference {invoiceId}`.
- No safe clickable invoice-detail route is currently established from `/cashflow`.

## Safe implementation shape
1. Keep this route-local to `/cashflow` only.
2. Preserve the existing `/invoices` header handoff and current cashflow data/query surface.
3. Refine the row wording so it explicitly names invoice reference metadata, for example `Invoice reference: {invoiceId}`.
4. Keep it non-clickable and honest.
5. Do not invent a new invoice-detail route or any new linking semantics.

## Files expected
- `apps/web/src/app/cashflow/page.tsx`
- `apps/web/src/app/cashflow/page.test.tsx`
- `plans/cashflow-invoice-reference-clarity-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/cashflow/page.test.tsx`

## Explicitly out of scope
- backend/API widening
- finance-model changes
- new routes
- new metrics or data loading
- workflow change
- planning redesign
- board/app redesign
