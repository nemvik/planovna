# Invoices Workspace v1

## Goal
Implement the smallest useful but visibly substantial `/invoices` working surface as the next major visible product step after the homepage/module split.

## Current repo evidence
- `apps/web/src/app/invoices/page.tsx` is still a lightweight module placeholder.
- The extracted shared workspace already contains invoice loading, invoice-derived summaries, due/payment helpers, list rendering, metadata rows, and invoice-level trust rules inside `apps/web/src/app/home-workspace.tsx`.
- Navigation coverage already verifies the dedicated `/invoices` route title in `apps/web/src/app/navigation.test.tsx`.

## Safe implementation shape
1. Keep `/invoices` as a dedicated real module page, not a full redesign and not a copy of the entire board workspace.
2. Reuse invoice-level data/trust helpers already proven on the shared workspace path where possible.
3. Build a focused invoices surface with:
   - page shell with clear title and primary CTA `New invoice`
   - summary strip with 3–5 operational metrics derived from trustworthy current invoice list state
   - minimal practical filter/search bar
   - main invoice list with stronger hierarchy and urgency/status cues
   - clear open-to-detail behavior
   - explicit loading / empty / error / no-results states
   - light UI refresh for cards, list spacing, controls, and badges
4. Preserve current finance boundaries:
   - no ERP/accounting expansion
   - no tax engine redesign
   - no batch console
   - no reconciliation/payment collection surface
   - no end-to-end invoice detail redesign
   - no full design-system rewrite

## Likely implementation approach
- Create an invoice-focused client module or local route surface under `apps/web/src/app/invoices/` that reuses the existing tRPC invoice list path and trusted display helpers.
- Derive safe metrics from invoice list state only (e.g. all, unpaid, overdue, paid, drafts) without extending backend contracts unless absolutely necessary.
- Add a concise search/filter state for practical controls only.
- Render invoice cards/rows with:
  - invoice number / identity
  - customer-facing name when already trustworthy on the invoice path
  - gross amount prominence
  - due/payment urgency summary
  - compact badges
  - open-to-detail action via existing safe destination (likely PDF/detail link already present on the invoice path)
- Add focused tests for the route contract and the main module states.

## Files expected
- `apps/web/src/app/invoices/page.tsx`
- likely one or more new route-local helpers/components/tests under `apps/web/src/app/invoices/`
- `apps/web/src/app/navigation.test.tsx`
- possibly shared invoice helper extraction only if needed to avoid risky duplication

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/navigation.test.tsx`
- focused invoice-route tests for the new `/invoices` surface
- broaden only if shared helpers/components require it

## Risks / notes
- The current invoice UI logic lives inside the extracted shared workspace, so the safest path may involve a small extraction of read-only invoice helpers/components rather than duplicating logic inline.
- Any extraction must stay narrow and avoid changing the shipped board/dashboard behavior.
