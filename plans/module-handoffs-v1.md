# Module Handoffs v1

## Goal
Implement a narrow wording-and-hierarchy cleanup across `/orders`, `/invoices`, and `/cashflow` so CTA labels truthfully reflect whether an action is local to the module or navigates to Board.

## Current repo evidence
- `/orders`, `/invoices`, and `/cashflow` are all dedicated route-local module surfaces.
- Each module currently includes at least one header CTA and/or row-level continuation that may route to `/board`.
- Current CTA wording is not yet standardized across modules.
- Existing module routes are already shipped; this slice is about relabeling and action hierarchy only, not workflow changes.

## Safe implementation shape
1. Audit current CTA usage on:
   - `apps/web/src/app/orders/page.tsx`
   - `apps/web/src/app/invoices/page.tsx`
   - `apps/web/src/app/cashflow/page.tsx`
2. Standardize one honest Board handoff pattern for secondary actions only, such as `Open Board`.
3. Keep local primary action vs Board secondary action grouped consistently.
4. If a module does not truly have a local create flow, do not fake one. Label Board navigation honestly instead.
5. Add only lightweight helper copy where ambiguity would otherwise remain.
6. Do not change workflow semantics, data semantics, or route behavior beyond wording/hierarchy.

## Likely implementation approach
- For each module page, keep the route-local module purpose as primary.
- Relabel any header CTA that currently routes to `/board` so it explicitly communicates Board navigation.
- Where helpful, add a small secondary/tertiary text hint clarifying when planning continues on Board.
- Update focused tests for module CTA labels and href expectations.

## Files expected
- `apps/web/src/app/orders/page.tsx`
- `apps/web/src/app/orders/page.test.tsx`
- `apps/web/src/app/invoices/page.tsx`
- `apps/web/src/app/invoices/page.test.tsx`
- `apps/web/src/app/cashflow/page.tsx`
- `apps/web/src/app/cashflow/page.test.tsx`
- possibly `apps/web/src/app/navigation.test.tsx` only if route-title/CTA expectations need adjustment
- `plans/module-handoffs-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/orders/page.test.tsx src/app/invoices/page.test.tsx src/app/cashflow/page.test.tsx src/app/navigation.test.tsx`

## Explicitly out of scope
- backend/API widening
- new mutation semantics
- planning redesign
- workflow designer
- macro/command system
- per-user personalization
- unsafe bulk actions
- board/app redesign
