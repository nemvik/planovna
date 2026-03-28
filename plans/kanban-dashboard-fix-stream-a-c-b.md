# Plan: kanban dashboard fix stream (A -> C -> B)

## Goal
Deliver the first releasable kanban dashboard fix slice for QA, starting with reliable cross-column movement (A), then adjacent audit stability (C), then narrow shared board-column configuration (B), while staying within the approved scope boundaries.

## Stream order
1. Slice A — reliable move between columns
2. Slice C — lazy, explicit audit panel states/retry
3. Slice B — tenant-shared board column configuration MVP

## Slice A intended changes
- Audit current kanban column/drop-state implementation and determine whether current DnD can be stabilized narrowly.
- Implement reliable cross-column movement with:
  - clear valid drop target,
  - valid-column-only move semantics,
  - optimistic UI with clean rollback on save failure/conflict,
  - no duplicate/lost card state,
  - explicit success/error outcome.
- If narrow DnD stabilization proves impractical quickly, fall back to explicit `Přesunout do…` action while preserving the same persistence guarantees.
- Add focused regression validation for move/conflict/failure behavior.

## Slice C intended changes (if A blocked or after A)
- Make audit feed lazy-loaded only after panel open.
- Add explicit loading / empty / delayed / error states and in-panel retry.
- Ensure no unexplained infinite spinner remains.

## Slice B intended changes (after A/C)
- Move board column configuration to tenant-shared scope.
- Narrow MVP: add / rename / reorder / save columns; allow remove/hide only for empty columns.
- Enforce validations: required + unique names, no empty labels.
- Block delete on non-empty column with clear user message.

## Expected files
- web board/dashboard UI files
- possible api service/router/schema files if column config persistence is missing
- targeted tests for move / audit states / column config as applicable

## Validation planned
- targeted tests for first releasable slice
- workspace build
- git diff --check

## Notes
- No workflow designer, per-user personalization, WIP limits, rules engine, swimlanes, APS/resource/capacity logic, reporting/export, or broad redesign.
- If one slice hits a real implementation blocker without PM decision, switch immediately to the next approved adjacent slice.