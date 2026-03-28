# Kanban fix stream slice B — shared homepage board-column configuration

## Goal
Add narrow tenant-level shared homepage kanban column configuration so all users in the same tenant see the same configured columns and can add, rename, reorder, and save them.

## Confirmed scope
- tenant-shared homepage board-column configuration
- add / rename / reorder / save columns
- remove or hide only an unused column
- block deletion of a non-empty column with a clear user-facing message
- validation: required, unique, non-empty column names

## Explicitly out of scope
- reassign wizard for non-empty columns
- per-user personalization
- workflow designer
- WIP limits / rules engine
- APS/resource/capacity planning
- unrelated board changes
- slice B must not disturb already-shipped slices A and C

## Repo evidence and likely impact
Current repo has no persisted board-column config model; homepage buckets are derived from operation dates/start dates and status filters. Implementing tenant-shared configurable columns therefore needs a persisted config contract and homepage rendering updates, not only a UI tweak.

## Planned files
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/operation/operation.service.ts`
- `apps/api/src/trpc/routers/operation.router.ts`
- `apps/api/test/trpc-operation.e2e-spec.ts`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/page.test.tsx`
- generated Prisma artifacts if required by repo workflow

## Implementation plan
1. Add a tenant-scoped persisted board-column config model with stable ordering, visibility/removal semantics, and enough metadata to decide whether a column is unused.
2. Extend the operation service + tRPC router with list/save procedures for board-column config, tenant-scoped and validated server-side.
3. Enforce server validation for required unique non-empty names and reject deletion/hide of non-empty columns with a clear error message.
4. Update homepage kanban UI to load shared column config, edit it in a narrow management surface, reorder locally, save via tRPC, and render operations against the shared column list.
5. Keep non-empty column delete blocked with a user-facing message; permit remove/hide only for unused columns.
6. Add focused API and homepage tests for validation, delete guard, reorder/save flow, and shared rendering behavior.

## Planned validation
- focused API e2e for board-column config contracts
- focused homepage test(s) for column editor save/reorder/delete guard behavior
- existing focused homepage command for slice-C regression protection as needed
