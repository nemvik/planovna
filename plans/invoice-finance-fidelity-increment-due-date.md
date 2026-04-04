# Invoice / finance fidelity increment: due-date summary

## Goal
Add one compact read-only due-date metadata row on invoice detail using only the already-shipped trustworthy explicit `dueAt` value from the current detail path.

## Repo evidence
- Current source-of-truth ref checked: `cb778ecb45d49f57cf24351ea270d5b15f06de40`
- `apps/web/src/app/home-workspace.tsx` already exposes `dueAt?: string` on `InvoiceSummary`.
- The current due-summary surface already builds a trustworthy due date from `invoice.dueAt`.
- The current milestone timeline also already uses `invoice.dueAt` directly.
- This means an explicit trustworthy due-date value is already available on the detail path without backend/API widening.

## Safe implementation shape
1. Add one compact metadata card/row in the existing invoice detail metadata area.
2. Use only `invoice.dueAt`.
3. If `dueAt` is present, display it via the existing display-date formatter.
4. If `dueAt` is missing, show explicit fallback: `Datum splatnosti této faktury není dostupné.`
5. Do not substitute `issuedAt`, `createdAt`, payment state, status, or any indirect signal.
6. Do not change milestone semantics or any backend/API contract.

## Files expected
- `apps/web/src/app/home-workspace.tsx`
- `apps/web/src/app/home-workspace.test.tsx`
- `plans/invoice-finance-fidelity-increment-due-date.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/home-workspace.test.tsx`

## Explicitly out of scope
- backend/API widening
- milestone semantics changes
- invoice lifecycle editing
- send-workflow redesign
- cashflow redesign
- full invoice detail redesign
