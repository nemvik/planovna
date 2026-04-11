# Invoice PDF destination clarity v1

## Goal
Make the `/invoices` row action truthfully describe the existing PDF/document destination without implying a new in-app invoice detail route.

## Current repo evidence
- `apps/web/src/app/invoices/page.tsx` renders a row-level action whose href comes from `invoice.pdfPath`.
- `apps/web/src/app/invoices/page.test.tsx` currently verifies that the row action points to a `/pdf` destination.
- The current row action label still says `Open detail`, which implies a route that does not exist on the current shipped surface.

## Safe implementation shape
1. Update the row-level action label and any adjacent helper wording only.
2. Make the action explicitly describe the existing PDF/document destination.
3. Preserve the existing `/cashflow` header handoff and current data/query surface.
4. Do not invent or imply a new in-app invoice detail route.
5. Keep scope route-local to `/invoices` only.

## Files expected
- `apps/web/src/app/invoices/page.tsx`
- `apps/web/src/app/invoices/page.test.tsx`
- `plans/invoice-pdf-destination-clarity-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/invoices/page.test.tsx`

## Explicitly out of scope
- backend/API widening
- new routes
- new metrics or data loading
- workflow change
- planning redesign
- board/app redesign
