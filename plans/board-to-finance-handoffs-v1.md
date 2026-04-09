# Board-to-Finance Handoffs v1

## Goal
Implement the smallest useful board-first cleanup on `/board` so planning stays primary while deeper finance detail is reduced/regrouped behind honest handoffs to the shipped `/invoices` and `/cashflow` modules.

## Current repo evidence
- `/board` is the full `HomeWorkspace` surface.
- `HomeWorkspace` currently mixes board/planning UI with embedded finance sections, including invoice and cashflow-related blocks.
- Dedicated `/invoices` and `/cashflow` module routes already exist and are shipped.
- This makes a safe subtraction + handoff cleanup feasible without backend/API changes.

## Safe implementation shape
1. Keep `/board` clearly planning-first.
2. Reprioritize board/planning content visually and interaction-wise.
3. Reduce or regroup embedded finance blocks so they no longer compete with planning.
4. Keep only lightweight finance cues/previews where they are already safe.
5. Add explicit secondary handoff CTAs to the dedicated modules:
   - `Open invoices`
   - `Open cashflow`
6. Ensure the board remains usable even if finance preview data is missing or fails.
7. Prefer trimming/regrouping unnecessary finance detail over preserving it in the main board focus.

## Likely implementation approach
- Adjust `apps/web/src/app/home-workspace.tsx` only.
- Move or compress invoice/cashflow-heavy sections into lighter preview cards or a secondary area.
- Keep planning board controls and board workspace shell visually earlier and more prominent.
- Replace competing embedded finance detail with concise preview text and explicit links to `/invoices` and `/cashflow`.
- Add focused shared-workspace coverage only where the new handoff copy/layout contract is testable safely.

## Files expected
- `apps/web/src/app/home-workspace.tsx`
- `apps/web/src/app/home-workspace.test.tsx`
- `plans/board-to-finance-handoffs-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/home-workspace.test.tsx`

## Explicitly out of scope
- backend/API widening
- finance-model redesign
- new readiness semantics
- workflow designer
- macro/command system
- per-user personalization
- unsafe bulk actions
- board/app redesign
