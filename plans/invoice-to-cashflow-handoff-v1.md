# Invoice-to-Cashflow Handoff v1

## Goal
Implement the smallest useful finance-to-finance wording and affordance cleanup between `/invoices` and `/cashflow` without widening scope.

## Current repo evidence
- `/invoices` and `/cashflow` are already shipped dedicated finance modules.
- Current module handoff copy still includes Board-oriented phrasing that can now be clarified for finance-to-finance continuation.
- `/cashflow` currently renders raw `invoiceId` as a primary row affordance (`Invoice inv-1`), which is technically traceable but not ideal user-facing wording.
- There is no clearly established safe clickable invoice-detail route from `/cashflow` beyond the existing module routes already present.

## Safe implementation shape
1. Keep this as wording-and-affordance cleanup only.
2. Audit and relabel header/CTA copy on `/invoices` and `/cashflow` so finance continuation points honestly to the finance destination instead of defaulting to Board framing.
3. Keep genuinely module-local actions primary.
4. Add explicit finance-to-finance handoff affordances only where the current route already safely supports the destination:
   - `/invoices` may safely hand off to `/cashflow`
   - `/cashflow` may reference invoice linkage honestly, but should not invent a clickable invoice-detail path if one does not already exist
5. Improve cashflow row readability so raw `invoiceId` is no longer the main user-facing affordance:
   - use a lightweight `Invoice-linked` style label/badge
   - preserve traceability honestly if no safe click-through exists
6. Do not change workflow semantics, linking semantics, or backend contracts.

## Likely implementation approach
- Update `/invoices` header CTA/copy so the Board handoff is no longer the default finance continuation when the module already has a natural `/cashflow` counterpart.
- Update `/cashflow` header/helper copy similarly.
- Replace `Invoice {invoiceId}` primary row wording on `/cashflow` with a more readable traceability treatment, keeping it non-clickable unless a safe route already exists.
- Update focused tests for `/invoices` and `/cashflow` only.

## Files expected
- `apps/web/src/app/invoices/page.tsx`
- `apps/web/src/app/invoices/page.test.tsx`
- `apps/web/src/app/cashflow/page.tsx`
- `apps/web/src/app/cashflow/page.test.tsx`
- `plans/invoice-to-cashflow-handoff-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/invoices/page.test.tsx src/app/cashflow/page.test.tsx`

## Explicitly out of scope
- backend/API widening
- finance-model redesign
- payment/reconciliation expansion
- planning redesign
- board/app redesign
- inferred linking from indirect signals
