# Plan: fix DnD return-to-backlog persistence

## Goal
Fix the persisted move semantics bug where dragging an operation from a dated bucket back to backlog does not survive reload because `startDate` is not being cleared in the update path.

## Intended changes
1. Verify the API update contract/path for nullable `startDate` on operation updates.
2. Implement the minimal fix so backlog moves explicitly persist `startDate: null` (or equivalent server-clearing value) instead of leaving the previous date in place.
3. Keep existing dated->dated, backlog->dated, and within-bucket reorder semantics unchanged.
4. Add focused regression coverage for clearing `startDate` / returning to backlog if practical.
5. Re-run targeted validation and build/tests relevant to the fix.

## Files expected
- `apps/web/src/app/page.tsx` and/or `apps/web/src/app/board-dnd-plan.ts`
- possibly `apps/api/src/modules/operation/operation.service.ts` or router/dto if null-clearing is not already supported
- targeted test file(s) if added/updated

## Validation planned
- targeted API/web tests for null startDate clear path
- workspace build
- git diff --check

## Notes
- No scope expansion beyond fixing backlog return persistence and optional regression coverage.
- Preserve tenant isolation, conflict handling, and fallback manual controls.