# Invoice / finance fidelity increment: issue-date summary

## Goal
Add one compact read-only issue-date metadata row on invoice detail using only the already-shipped trustworthy explicit `issuedAt` value from the current detail path.

## Repo evidence
- Current source-of-truth ref checked: `65db090779c403b4f188d47fc412ffcffa62387b`
- `apps/web/src/app/home-workspace.tsx` already exposes `issuedAt?: string` on `InvoiceSummary`.
- The current milestone timeline already uses `invoice.issuedAt` directly when building `timelineByInvoiceId`.
- This means an explicit trustworthy issue-date value is already available on the detail path without backend/API widening.

## Safe implementation shape
1. Add one compact metadata card/row in the existing invoice detail metadata area.
2. Use only `invoice.issuedAt`.
3. If `issuedAt` is present, display it via the existing display-date formatter.
4. If `issuedAt` is missing, show explicit fallback: `Datum vystavení této faktury není dostupné.`
5. Do not substitute `createdAt`, `sentAt`, `dueAt`, status, invoice number, or any indirect signal.
6. Do not change milestone semantics or any backend/API contract.

## Files expected
- `apps/web/src/app/home-workspace.tsx`
- `apps/web/src/app/home-workspace.test.tsx`
- `plans/invoice-finance-fidelity-increment-issue-date.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/home-workspace.test.tsx`

## Explicitly out of scope
- backend/API widening
- milestone semantics changes
- invoice lifecycle editing
- cashflow redesign
- full invoice detail redesign
