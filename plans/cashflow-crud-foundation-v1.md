# Cashflow CRUD foundation v1

## Goal
Move `/cashflow` from a read-only review workspace toward a truthful local operational finance module, while staying strictly inside the current safe repo contract boundary.

## Repo evidence
- Current web surface: `apps/web/src/app/cashflow/page.tsx` is a list-first cashflow workspace with summary cards, horizon/kind filters, invoice-linked traceability, and a secondary handoff back to `/invoices`.
- Current route copy already frames `/cashflow` as the final finance step after invoice review.
- Current tRPC cashflow router in `apps/api/src/trpc/routers/cashflow.router.ts` exposes:
  - `cashflow.list`
  - `cashflow.listRecurringRules`
  - `cashflow.createRecurringRule`
  - `cashflow.updateRecurringRule`
  - `cashflow.pauseRecurringRule`
  - `cashflow.resumeRecurringRule`
  - `cashflow.stopRecurringRule`
- There is no current safe router contract for generic local cashflow item create/edit/delete on `CashflowItem` rows.
- Existing `CashflowItem` rows are currently populated through trusted finance flows like invoice issue/paid service paths, which preserve planned-vs-actual semantics and invoice-linked traceability.

## Truthful scope narrowing
A literal broad `Cashflow CRUD` claim is not supported by the current safe contract.

### Safe today
A narrow first foundation slice can safely make `/cashflow` more operational only around **recurring cashflow rules**, because those already have local create/update/state-transition contracts.

### Not safe today
A local CRUD module for the currently rendered `CashflowItem` list is blocked because current contracts do not expose safe item-level:
- create
- edit/update
- delete

That means the route can become locally operational for **recurring rule management inside the cashflow boundary**, but not for arbitrary cashflow row CRUD without backend/API widening.

## Recommendation
Ship `Cashflow CRUD foundation v1` as a **truthful subset**:
- keep the existing cashflow item list-first workspace intact
- preserve planned vs actual semantics exactly as-is
- preserve invoice-linked traceability exactly as-is
- add local primary CTA `Add cashflow item`, but truthfully scope it to **recurring cashflow rule creation** rather than pretending it creates arbitrary cashflow rows
- expose only the already-supported recurring-rule operations locally:
  - create recurring rule
  - edit recurring rule
  - pause/resume/stop recurring rule
- do not add fake delete affordances
- keep `/board` out of the primary flow, and keep `/invoices` only as explicit secondary source-document handoff

## Recommended smallest shippable slice
### Slice 1, Local recurring-rule operations inside `/cashflow`
Implement a route-local operational panel on `/cashflow` for recurring cashflow rules using only the current safe router contracts.

This slice should include:
1. primary CTA `Add cashflow item`
2. truthful helper copy clarifying that this local create path currently adds a recurring cashflow rule
3. local create form wired only to `cashflow.createRecurringRule`
4. local recurring-rules list on `/cashflow`
5. safe local edit form wired only to `cashflow.updateRecurringRule`
6. safe local state actions wired only to:
   - `cashflow.pauseRecurringRule`
   - `cashflow.resumeRecurringRule`
   - `cashflow.stopRecurringRule`
7. preserve current cashflow item list, summary, filters, and invoice traceability below or alongside the recurring-rule section
8. keep `/invoices` as explicit secondary handoff for linked source documents

## Why this is the best first slice
- it uses already-shipped safe contracts
- it adds real local operations without inventing unsupported cashflow-item CRUD
- it preserves the trusted semantics boundary around planned vs actual invoice-linked rows
- it keeps scope narrow and QA-verifiable

## Explicitly not in scope
- arbitrary cashflow item create/edit/delete
- unlinking or rewriting invoice-linked cashflow rows
- bank matching or reconciliation
- forecasting/scenario tools
- finance model redesign
- workflow redesign
- mass operations
- board/app redesign
- API widening

## Blocker statement for literal item-level CRUD
If the product requirement is specifically “local CRUD for the currently rendered cashflow item rows”, then this slice is blocked by missing safe item-level router contracts for create/update/delete.

## Exact expected file surface
### Required
- `apps/web/src/app/cashflow/page.tsx`
- `apps/web/src/app/cashflow/page.test.tsx`
- `plans/cashflow-crud-foundation-v1.md`

### Optional only if kept tiny and route-local
- one tiny helper/component under `apps/web/src/app/cashflow/`

### Not expected for this slice
- no API/router/service edits if we stay inside recurring-rule contracts already exposed

## Focused validation
Recommended focused test command:
- `npm -w apps/web run test -- --runInBand src/app/cashflow/page.test.tsx`

Add route-local coverage for:
- CTA visibility
- recurring-rule form open/submit flow
- recurring-rule edit flow
- pause/resume/stop actions
- create/update/action failure states
- existing cashflow list/filter states still working

## PM recommendation
Approve the truthful subset implementation:
- operational recurring-rule management inside `/cashflow`
- no claim of generic cashflow item CRUD yet

If PM instead wants true CRUD over cashflow list rows, that requires a separate contract-exposure step first.