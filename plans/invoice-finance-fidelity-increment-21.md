# Invoice / finance fidelity increment 21

## Goal
Add one compact read-only customer billing-address summary block in the homepage/detail invoice metadata area using only trustworthy invoice-level customer billing-address snapshot data, with explicit fallback when the snapshot is missing or too incomplete to be safely meaningful.

## Current repo evidence
- Current homepage invoice payload visibly includes identity/party/currency/period/context/document-status/source/tax-treatment/language/payment-method/issuer-contact/billing-address/supplier-tax-id/customer-tax-id/totals/payment/due/timeline fields.
- The visible source-of-truth path does not clearly expose a dedicated customer billing-address snapshot field yet.
- The safe slice must therefore avoid inferring or substituting address lines from live customer/entity defaults, CRM, country, tax ID, or other indirect signals.

## Safe narrow model
1. Use only invoice-level customer billing-address snapshot lines already attached to the invoice payload if present.
2. Render only present trustworthy lines.
3. Require a minimally meaningful snapshot before display.
4. If the snapshot is missing or too incomplete, show explicit fallback text.
5. Never substitute live customer/entity defaults.
6. Never infer address lines from CRM, country, tax ID, or any other indirect signal.
7. Keep the feature compact, read-only, and secondary in the existing metadata/detail area.

## Scope
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/page.test.tsx`
- `plans/invoice-finance-fidelity-increment-21.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/page.test.tsx -t "cashflow snapshot|invoice|payment|due|timeline|reference|number|party|customer|supplier|currency|period|note|status|source|origin|tax|language|locale|contact|address|tax-id"`
- broaden only if shared homepage rendering paths require it

## Explicitly out of scope
- address editing
- customer/entity navigation redesign
- maps/geocoding/validation
- accounting/ERP integrations
- tax engine
- invoice lifecycle editing
- cashflow list redesign
