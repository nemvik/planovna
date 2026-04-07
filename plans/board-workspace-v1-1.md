# Board Workspace v1.1

## Goal
Implement a narrow board-first adoption/speed improvement on the current shipped board surface without backend/API widening.

## Current repo evidence
- The current shipped board surface already has:
  - route-local filter state (`query`, `status`, `bucket`)
  - explicit reset action
  - active-filter summary/chips with clear-one controls
  - distinct operation load states (`loading`, `empty`, `forbidden`, `error`)
  - board shortcuts v1 already added on top of the current shell
- Existing board semantics safely support presets derived from current filters/state only.
- Safe preset candidates that can be truthfully built from shipped semantics are:
  - `All work`
  - `Blocked`
  - `Ready now`
- `Needs attention` / `Due soon` are not clearly supported by current board semantics and should be omitted unless proven from existing state only.

## Safe implementation shape
1. Keep the existing board as the primary surface.
2. Improve the board header/shell only:
   - clearer current-scope / current view label
   - concise visible filter-state summary
   - explicit `Clear filters` action
   - small built-in operational views as session-only quick filter presets
3. Build presets only from current shipped filter semantics:
   - `All work` => default filters
   - `Blocked` => status `BLOCKED`
   - `Ready now` => status `READY`
4. Do not introduce any new data model, persistence model, or backend contract.
5. Sharpen the distinction between:
   - loading
   - empty board
   - no results (filtered empty)
   - error

## Likely implementation approach
- Extend `apps/web/src/app/home-workspace.tsx` around the existing board filter/header shell.
- Add a small board-workspace shell strip with:
  - current-view label derived from active filters / selected preset
  - preset buttons that only call `setFilters(...)`
  - explicit clear/reset action using existing filter reset semantics
- Reuse the existing active filter chips/summary rather than inventing a new filter model.
- Update `apps/web/src/app/home-workspace.test.tsx` with focused assertions for:
  - preset-driven filtering
  - current-view label visibility
  - clearer no-results vs empty-board states if practical

## Files expected
- `apps/web/src/app/home-workspace.tsx`
- `apps/web/src/app/home-workspace.test.tsx`
- `plans/board-workspace-v1-1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/home-workspace.test.tsx`

## Explicitly out of scope
- backend/API widening
- workflow designer
- macro/command system
- per-user personalization
- unsafe bulk actions
- new mutation semantics
- board/app redesign
