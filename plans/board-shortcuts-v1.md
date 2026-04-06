# Board Shortcuts v1

## Goal
Implement the smallest useful shortcut layer on top of the current shipped board surface as a visible board-first speed improvement.

## Current repo evidence
- The current shipped board surface lives in `apps/web/src/app/home-workspace.tsx`.
- Existing safe board actions already available on the surface include:
  - manual `Move to…` / bucket move using the existing update mutation and valid target-bucket rules
  - `Load operations`
  - `Open audit log`
  - `Edit board columns`
  - existing DnD board movement
- Existing copy already includes `operationMoveToBucketLabel` and board header buttons for audit log and board columns.
- Current shared-workspace tests are in `apps/web/src/app/home-workspace.test.tsx`.

## Safe implementation shape
1. Keep shortcuts as faster access to already-existing actions only.
2. Add a lightweight shortcut-discovery entry in the board header (`Shortcuts` / `? Shortcuts`) that lists only safe existing actions.
3. Add card/row quick-action affordances for the most common already-existing board actions.
4. Provide an explicit `Move to…` fast path as a clear non-DnD fallback using the existing move action and valid target-column rules.
5. Omit anything not already safely available on the shipped board surface.
6. If multi-select/bulk actions are not already supported, keep them out.
7. If an audit/history shortcut is not already safe on the current surface, omit it; otherwise use the existing audit-log affordance only.

## Likely implementation approach
- Extend the board header area in `home-workspace.tsx` with a small shortcuts toggle/disclosure.
- Reuse existing move/update helpers and available bucket configuration to expose a clear `Move to…` control per operation card/row.
- Keep the quick actions limited to actions already on the board surface, such as opening audit log, editing board columns, loading operations, and moving an operation.
- Add focused tests for shortcut discovery and the non-DnD move path only if they can be exercised safely in the current harness.

## Files expected
- `apps/web/src/app/home-workspace.tsx`
- `apps/web/src/app/home-workspace.test.tsx`
- `plans/board-shortcuts-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/home-workspace.test.tsx`

## Explicitly out of scope
- backend/API widening
- new mutation semantics
- workflow designer
- macro system
- per-user shortcut customization
- global command palette redesign
- full board redesign
- multi-select / bulk actions
