# Plan: literal board drag-and-drop for MVP

## Goal
Implement actual board drag-and-drop on the shipped homepage board so the product matches the locked MVP brief requiring board DnD, while preserving the existing persistence semantics, optimistic update/conflict behavior, and tenant isolation.

## Intended changes
1. Add a drag-and-drop library dependency for the web app (likely `@dnd-kit/core` + sortable helpers).
2. Refactor homepage board rendering into drag-aware bucket/operation components or local helpers.
3. Implement drag start/over/end handling so an operation can be moved between backlog/date buckets and reordered within a bucket.
4. Preserve existing persistence semantics by translating DnD results into the current `operation.update` mutation shape (`startDate`, `sortIndex`, existing version handling, reload/conflict path).
5. Keep existing non-DnD controls unless PM wants explicit cleanup later; DnD is the required gap closure.
6. Add/update focused web tests where practical for drag rendering/interaction logic.
7. Run targeted validation plus full relevant gate/build checks if feasible.

## Files expected
- `apps/web/package.json`
- `apps/web/src/app/page.tsx`
- possible new web board component/helper files under `apps/web/src/app/`
- possible new/updated tests under `apps/web/src/...`

## Validation planned
- install dependencies
- web/app build
- focused tests for board helpers/components if added
- relevant existing API/web regression checks as practical
- verify no type/build regressions

## Risks / notes
- Need to map drag reorder to stable `sortIndex` updates without breaking existing ordering assumptions.
- Need to preserve optimistic locking/version conflict handling already in place.
- Should avoid changing server contracts unless truly necessary.
