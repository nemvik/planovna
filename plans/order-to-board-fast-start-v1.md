# Order-to-Board Fast Start v1

## Goal
Implement the smallest useful progression-first follow-up on the Orders surface so the next step from an order into Board planning is more obvious without widening scope.

## Current repo evidence
- `/orders` already exists as a route-local, list-first workspace.
- The current Orders route already has a safe row-level continuation to `/board` via `Continue in planning` links.
- The current header CTA was normalized in Module Handoffs v1 to an honest Board handoff label.
- The empty state currently tells users only that no orders are available yet, without clearly clarifying the next truthful step into Board planning.

## Safe implementation shape
1. Keep this progression-first, not workflow-first.
2. Improve Orders-surface CTA hierarchy and helper copy only.
3. Use only existing safe `/board` destinations already present on the current shipped surface.
4. Make Board continuation clearer in three places where truthful:
   - header/helper copy
   - row-level handoff wording
   - empty/starting-state guidance
5. Keep local actions local and Board continuation secondary and honestly labeled.
6. If any surface/state lacks a safe Board destination, omit the CTA rather than inventing readiness semantics.

## Likely implementation approach
- Refine `/orders` header copy to position Orders as the start and Board as the next step.
- Relabel row-level planning continuation to a clearer Board-specific action such as `Continue planning on Board`.
- Strengthen empty/starting-state guidance with explicit truthful next-step copy toward Board.
- Update focused Orders route tests only.

## Files expected
- `apps/web/src/app/orders/page.tsx`
- `apps/web/src/app/orders/page.test.tsx`
- `plans/order-to-board-fast-start-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/orders/page.test.tsx`

## Explicitly out of scope
- backend/API widening
- planning redesign
- workflow designer
- macro/command system
- per-user personalization
- unsafe bulk actions
- board/app redesign
- new order state machine
