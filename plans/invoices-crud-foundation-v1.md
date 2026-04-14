# Invoices CRUD foundation v1

## Goal
Move `/invoices` from a review/list workspace toward a real operational invoices module, but keep the first implementation slice narrow, truthful, and within current repo contracts.

## Repo evidence
- Current web surface: `apps/web/src/app/invoices/page.tsx` is a list-first invoices workspace with finance review framing and a secondary handoff to `/cashflow`.
- Current server contract in `apps/api/src/trpc/routers/invoice.router.ts` exposes:
  - `invoice.list`
  - `invoice.issue` (create/issue path)
  - `invoice.paid` (mark-paid path)
- There is no current safe router contract for invoice edit/update/delete.
- Therefore, a truthful first CRUD-foundation slice can safely cover:
  - local create path using existing `invoice.issue`
  - list/review surface
  - one existing post-create/post-review state action (`mark paid`) only if it fits the UI slice cleanly
- Full CRUD is currently blocked by missing safe update/delete route contracts if we interpret CRUD literally.

## No-blocker / blocker status
- No blocker for a narrow first shippable foundation slice.
- Blocker for full CRUD parity in one batch:
  - safe edit/update route not currently exposed
  - safe delete route not currently exposed
- Recommendation: treat v1 as CRUD foundation, not full CRUD completion.

## Recommended first smallest shippable slice
### Slice 1, Create + list-first module foundation
Implement a local `New invoice` path inside `/invoices` using the already-shipped `invoice.issue` mutation, while preserving the current invoice fidelity review baseline.

This slice should include:
1. local primary CTA `New invoice`
2. compact create panel / drawer / inline form on `/invoices`
3. form fields only for the current safe create contract required by `CreateInvoiceSchema`
4. successful create returning users to the existing list/review workspace
5. explicit empty/loading/error/form-error states
6. keep `Open cashflow` as secondary finance continuation
7. remove any remaining Board-default framing for invoice creation on this route

### Why this is the best first slice
- it creates a real local operational path on `/invoices`
- it uses an already-shipped mutation contract
- it avoids pretending edit/delete exists when it does not
- it preserves the current invoice review/fidelity work already shipped
- it is reviewable and low-risk

## Explicitly not in slice 1
- invoice edit/update
- invoice delete
- tax/ERP/accounting redesign
- payment reconciliation
- batch/mass operations
- workflow redesign
- board/app redesign

## Exact expected file surface
### Required
- `apps/web/src/app/invoices/page.tsx`
- `apps/web/src/app/invoices/page.test.tsx`
- `plans/invoices-crud-foundation-v1.md`

### Optional only if implementation stays tiny and improves structure
- a tiny route-local helper/component under `apps/web/src/app/invoices/`
  - for example a local form component or input mapper
- no API/router files in slice 1 unless PM explicitly opens contract work

## Required assumptions
1. `CreateInvoiceSchema` is sufficient for a minimally useful local create path.
2. The route may present create inline on `/invoices` without adding a new route.
3. Current invoice list refresh after create can be handled client-side from the existing list query flow.

## Optional assumptions
1. If `invoice.paid` fits naturally and cleanly, it can remain visible as an existing state action, but it should not expand the slice if it complicates the create foundation.
2. If current schema fields are too numerous for a polished full form, the first slice may use a reduced safe set only if that still satisfies the server schema truthfully.

## Recommended sequencing
1. inspect `CreateInvoiceSchema` + current invoice form needs
2. add local `New invoice` CTA and open/close state
3. add minimal create form using the existing mutation only
4. refresh list on success and preserve current review rows
5. keep cashflow handoff secondary
6. add focused route tests for:
   - create CTA visibility
   - create form open/submit flow
   - success refresh
   - error handling
   - existing list/review still works

## Focused validation
Recommended exact commands for execution:
- `npm -w apps/web run test -- --runInBand src/app/invoices/page.test.tsx`
- broaden only if a tiny route-local helper is extracted

## PM decision note
If PM wants literal CRUD coverage in this workstream, a separate contract-exposure step is required first for safe invoice update/delete operations. My recommendation is to approve Slice 1 as the narrow first delivery of `Invoices CRUD foundation v1`, then evaluate contract exposure for edit/delete as a follow-up slice.
