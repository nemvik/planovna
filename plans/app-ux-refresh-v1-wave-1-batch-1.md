# App UX Refresh v1, Wave 1, Batch 1

## Goal
Start Wave 1 implementation using the approved Wave 0 shell/pattern contract, applying the new baseline consistently across the signed-in app without redesigning workflows.

## Wave 1 batch 1 objective
Deliver the smallest high-impact normalization slice that users will feel immediately across the signed-in surfaces:
1. shell/nav alignment where needed
2. page header + action-bar normalization
3. summary strip + filter/action-bar normalization
4. loading / empty / error pattern normalization

Then apply that baseline across top-level signed-in surfaces in this order:
- Dashboard
- Orders
- Invoices
- Cashflow
- Board

## Current repo evidence
- Signed-in surfaces already exist for:
  - `apps/web/src/app/page.tsx` (dashboard)
  - `apps/web/src/app/orders/page.tsx`
  - `apps/web/src/app/invoices/page.tsx`
  - `apps/web/src/app/cashflow/page.tsx`
  - `apps/web/src/app/home-workspace.tsx` (board)
- These surfaces already share some visual primitives (`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm`) but are not yet normalized by one explicit shell pattern.
- Loading / empty / error states are implemented independently per page and can be standardized without backend/API changes.
- Navigation already has the new flow-aligned order and active-route state via:
  - `apps/web/src/app/layout.tsx`
  - `apps/web/src/app/app-nav.tsx`

## Recommended sequencing
### Step 1, establish reusable page-shell primitives
Create a tiny route-local/shared app-shell baseline for signed-in pages, likely under `apps/web/src/app/`:
- `AppPageShell` or equivalent wrapper
- `AppPageHeader` with title, intro, primary action, optional secondary action area
- `AppSummaryStrip`
- `AppStatePanel` for loading / empty / error / no-results

This should stay intentionally small and implementation-first, not a component-library program.

### Step 2, apply baseline to lower-risk route-local pages first
Apply to:
- Dashboard
- Orders
- Invoices
- Cashflow

These four surfaces already use similar patterns and can absorb normalization with focused tests.

### Step 3, apply the same shell language to Board last in the batch
Board is the most interaction-heavy surface. For batch 1, limit board changes to shell/header/state normalization only, reusing the same baseline where possible and avoiding workflow changes.

## Smallest high-impact first delivery slice
### Recommended first delivery slice
Normalize the shared page shell and apply it first to:
- Dashboard
- Orders
- Invoices
- Cashflow

Leave Board for the second commit within the same batch or the immediate follow-up, because:
- Board is already more fragile and interaction-heavy
- the other four pages already expose the exact patterns Wave 1 targets
- this gives a visible coherent refresh quickly with lower regression risk

## Expected file surface
### Shared baseline
- likely one or more tiny helpers under `apps/web/src/app/`
  - e.g. `app-page-shell.tsx`
  - e.g. `app-state-panel.tsx`

### Signed-in surfaces to update
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/orders/page.tsx`
- `apps/web/src/app/invoices/page.tsx`
- `apps/web/src/app/cashflow/page.tsx`
- `apps/web/src/app/home-workspace.tsx`

### Focused tests likely touched
- `apps/web/src/app/page.test.tsx`
- `apps/web/src/app/orders/page.test.tsx`
- `apps/web/src/app/invoices/page.test.tsx`
- `apps/web/src/app/cashflow/page.test.tsx`
- `apps/web/src/app/home-workspace.test.tsx`
- `apps/web/src/app/navigation.test.tsx` only if shell/nav presentation contract changes require it

## Normalization rules for batch 1
1. Keep navigation and page titles stable.
2. Use one consistent header composition:
   - eyebrow/section label optional
   - clear title
   - short intro
   - primary CTA
   - optional secondary CTA area
3. Use one consistent summary strip treatment where a page already has truthful summary cards.
4. Use one consistent filter/action-bar treatment where filters already exist.
5. Use one consistent state panel structure for:
   - loading
   - empty
   - error
   - no-results
6. Do not add new metrics or synthetic aggregates just to fill the pattern.
7. Do not change workflow semantics, routes, mutations, or data contracts.

## Planned validation for batch 1 execution
Recommended focused commands once implementation starts:
- `npm -w apps/web run test -- --runInBand src/app/page.test.tsx src/app/orders/page.test.tsx src/app/invoices/page.test.tsx src/app/cashflow/page.test.tsx`
- then board shell validation:
  - `npm -w apps/web run test -- --runInBand src/app/home-workspace.test.tsx`
- include `src/app/navigation.test.tsx` only if needed by shell/nav presentation changes

## Risks / watchouts
- Avoid over-abstracting the helpers. Tiny shared wrappers are enough.
- Do not force summary strips onto surfaces where the semantics are weak.
- Board should be updated last to avoid destabilizing the most complex signed-in surface.
- Preserve current route-local truthful copy and handoff semantics already landed in recent slices.

## Recommendation
Proceed with Wave 1 Batch 1 in two implementation passes:
1. establish the shared signed-in shell baseline and apply it to Dashboard, Orders, Invoices, Cashflow
2. apply the same shell/state normalization to Board

This gives the highest visible UX consistency with the lowest risk of workflow regression.
