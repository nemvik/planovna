# Planning System Reset v1

## Goal
Make `/board` a clean planning-only workspace instead of a mixed planning+finance surface.

## Current repo evidence
- `/board` is the full `apps/web/src/app/home-workspace.tsx` surface.
- The board already has clear planning primitives in place:
  - board header and intro
  - planning actions
  - board-local shortcuts
  - planning filters/current-view presets
  - the main planning board surface
- The board still contains regrouped finance preview content with invoice/cashflow handoffs.
- Dedicated `/invoices` and `/cashflow` routes already exist and are shipped.

## Safe implementation shape
1. Keep all planning-first board shell elements intact:
   - board header
   - planning actions
   - board-local shortcuts
   - planning filters/current-view shell
   - main planning surface
2. Remove or further regroup finance content so it no longer competes with planning.
3. Keep only lightweight honest handoffs to:
   - `/invoices`
   - `/cashflow`
4. Preserve explicit module boundaries:
   - Board = planning
   - Invoices = invoices
   - Cashflow = cashflow
   - Devices/Capacity remain outside this slice
5. Prefer subtraction and boundary correction over redesign.

## Likely implementation approach
- Update `apps/web/src/app/home-workspace.tsx` only.
- Trim the current embedded finance preview section down to a smaller secondary handoff strip/card, or move it lower and reduce its visual weight further.
- Remove any remaining finance summary treatment that competes visually with the planning surface.
- Keep only concise explanatory copy plus direct links to the dedicated finance modules.
- Add/update focused assertions in `apps/web/src/app/home-workspace.test.tsx` so the current board contract proves:
  - planning remains primary
  - finance is reduced to lightweight handoffs only
  - dedicated finance destinations remain explicit

## Files expected
- `apps/web/src/app/home-workspace.tsx`
- `apps/web/src/app/home-workspace.test.tsx`
- `plans/planning-system-reset-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/home-workspace.test.tsx`

## Explicitly out of scope
- backend/API widening
- planning model redesign
- workflow designer
- APS/resource solver
- new mutation semantics
- broad redesign beyond planning-boundary correction
