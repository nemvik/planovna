# REPOMAP

- Generated: 2026-03-05 20:29:17 CET
- Branch: main
- HEAD: 08a8268
- Tracked files: 82
- Last commit changed files: 12

## Architecture index (top dirs)
- apps (69 files)
- docs (5 files)
- scripts (2 files)
- .repomap (2 files)
- package.json (1 files)
- package-lock.json (1 files)
- README.md (1 files)
- .gitignore (1 files)

## Language summary
- .ts (44)
- .json (10)
- .md (9)
- .svg (5)
- .mjs (3)
- .gitignore (3)
- .tsx (2)
- .sh (2)
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
- apps/api/src/common/roles.decorator.ts
- apps/api/src/common/roles.guard.ts
- apps/api/src/modules/auth/auth.controller.ts
- apps/api/src/modules/auth/auth.service.ts
- apps/api/src/modules/auth/dto/auth.dto.ts
- apps/api/src/modules/invoice/invoice.controller.ts
- apps/api/src/modules/invoice/invoice.module.ts
- apps/api/src/modules/invoice/invoice.service.spec.ts
- apps/api/src/modules/invoice/invoice.service.ts
- apps/api/test/auth-invoice-paid.e2e-spec.ts
- apps/api/test/auth-magic-link-role.e2e-spec.ts
- apps/api/test/tenant-isolation.e2e-spec.ts

## Symbols (changed files only)
- apps/api/src/common/roles.decorator.ts:6:export const Roles = (...roles: AuthRole[]) =>
- apps/api/src/common/roles.guard.ts:13:export class RolesGuard implements CanActivate {
- apps/api/src/modules/auth/auth.controller.ts:20:export class AuthController {
- apps/api/src/modules/auth/auth.service.ts:39:export class AuthService {
- apps/api/src/modules/invoice/invoice.controller.ts:18:export class InvoiceController {
- apps/api/src/modules/invoice/invoice.module.ts:15:export class InvoiceModule {}
- apps/api/src/modules/invoice/invoice.service.ts:15:export class InvoiceService {

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
- apps/api/test/auth-invoice-paid.e2e-spec.ts
- apps/api/test/auth-magic-link-role.e2e-spec.ts
- apps/api/test/jest-e2e.json
- apps/api/test/tenant-isolation.e2e-spec.ts
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
- docs/DECISIONS_LOG.md
- docs/EXECUTION_PLAN.md
- docs/PROJECT_BRIEF_FULL.md
- package-lock.json
- package.json
- scripts
- scripts/ci_local_gate.sh
- scripts/update_repomap.sh
