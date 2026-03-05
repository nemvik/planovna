# REPOMAP

- Generated: 2026-03-05 15:25:11 CET
- Branch: master
- HEAD: d626239
- Tracked files: 62
- Last commit changed files: 22

## Architecture index (top dirs)
- apps (52 files)
- docs (3 files)
- .repomap (2 files)
- scripts (1 files)
- package.json (1 files)
- package-lock.json (1 files)
- README.md (1 files)
- .gitignore (1 files)

## Language summary
- .ts (27)
- .json (10)
- .md (7)
- .svg (5)
- .mjs (3)
- .gitignore (3)
- .tsx (2)
- .sh (1)
- .prisma (1)
- .prettierrc (1)
- .ico (1)
- .css (1)

## Entrypoints & key infra
- apps/api/package.json
- apps/api/src/main.ts
- apps/web/package.json
- package.json

## Last commit impact
- .repomap/REPOMAP.md
- .repomap/repomap.json
- apps/api/src/app.module.ts
- apps/api/src/common/conflict.error.ts
- apps/api/src/common/errors/conflict.error.ts
- apps/api/src/common/optimistic-lock/assert-version.ts
- apps/api/src/common/tenant-context.ts
- apps/api/src/modules/customer/customer.controller.ts
- apps/api/src/modules/customer/customer.dto.ts
- apps/api/src/modules/customer/customer.module.ts
- apps/api/src/modules/customer/customer.service.ts
- apps/api/src/modules/customer/dto/customer.dto.ts
- apps/api/src/modules/operation/dto/operation.dto.ts
- apps/api/src/modules/operation/operation.controller.ts
- apps/api/src/modules/operation/operation.dto.ts
- apps/api/src/modules/operation/operation.module.ts
- apps/api/src/modules/operation/operation.service.ts
- apps/api/src/modules/order/dto/order.dto.ts
- apps/api/src/modules/order/order.controller.ts
- apps/api/src/modules/order/order.dto.ts
- apps/api/src/modules/order/order.module.ts
- apps/api/src/modules/order/order.service.ts

## Symbols (changed files only)
- apps/api/src/app.module.ts:13:export class AppModule {}
- apps/api/src/common/conflict.error.ts:10:export class VersionConflictError extends Error {
- apps/api/src/common/errors/conflict.error.ts:1:export class VersionConflictError extends Error {
- apps/api/src/common/optimistic-lock/assert-version.ts:3:export function assertVersion(
- apps/api/src/common/tenant-context.ts:3:export function requireTenantId(tenantId?: string): string {
- apps/api/src/modules/customer/customer.controller.ts:11:export class CustomerController {
- apps/api/src/modules/customer/customer.module.ts:10:export class CustomerModule {}
- apps/api/src/modules/customer/customer.service.ts:9:export class CustomerService {
- apps/api/src/modules/operation/operation.controller.ts:11:export class OperationController {
- apps/api/src/modules/operation/operation.module.ts:10:export class OperationModule {}
- apps/api/src/modules/operation/operation.service.ts:9:export class OperationService {
- apps/api/src/modules/order/order.controller.ts:11:export class OrderController {
- apps/api/src/modules/order/order.module.ts:10:export class OrderModule {}
- apps/api/src/modules/order/order.service.ts:9:export class OrderService {

## Compact tree (depth<=4, token-saver)
- .gitignore
- .repomap
- .repomap/REPOMAP.md
- .repomap/repomap.json
- README.md
- apps
- apps/api
- apps/api/.gitignore
- apps/api/.prettierrc
- apps/api/README.md
- apps/api/eslint.config.mjs
- apps/api/nest-cli.json
- apps/api/package.json
- apps/api/prisma
- apps/api/prisma.config.ts
- apps/api/prisma/schema.prisma
- apps/api/src
- apps/api/src/app.controller.spec.ts
- apps/api/src/app.controller.ts
- apps/api/src/app.module.ts
- apps/api/src/app.service.ts
- apps/api/src/common
- apps/api/src/main.ts
- apps/api/src/modules
- apps/api/test
- apps/api/test/app.e2e-spec.ts
- apps/api/test/jest-e2e.json
- apps/api/tsconfig.build.json
- apps/api/tsconfig.json
- apps/web
- apps/web/.gitignore
- apps/web/README.md
- apps/web/eslint.config.mjs
- apps/web/next.config.ts
- apps/web/package.json
- apps/web/postcss.config.mjs
- apps/web/public
- apps/web/public/file.svg
- apps/web/public/globe.svg
- apps/web/public/next.svg
- apps/web/public/vercel.svg
- apps/web/public/window.svg
- apps/web/src
- apps/web/src/app
- apps/web/tsconfig.json
- docs
- docs/ARCHITECTURE_MVP.md
- docs/BACKLOG_M1.md
- docs/EXECUTION_PLAN.md
- package-lock.json
- package.json
- scripts
- scripts/update_repomap.sh
