# Public homepage / landing page v1

## Goal
Implement the smallest useful but visibly credible public Planovna homepage that explains the product, targets the right audience, presents strong registration/login CTAs above the fold, highlights the core flow/modules (Orders, Board, Invoices, Cashflow), adds lightweight reassurance, and repeats the CTA near the bottom.

## Current repo evidence
- `apps/web/src/app/page.tsx` currently acts as an auth-aware app entry.
- Logged-in users already see a lightweight dashboard hub.
- The current logged-out experience is not yet a dedicated public landing page.
- `apps/web/src/app/page.test.tsx` already covers the auth-aware `/` behavior and can be updated for the new public contract.
- `apps/web/src/app/layout.tsx` already provides a light global shell, so this slice can stay within the homepage surface.

## Safe implementation shape
1. Keep `/` auth-aware:
   - logged-in users continue to see the current dashboard hub
   - logged-out users see the new public landing page
2. Build one public homepage only, no extra marketing routes.
3. Above the fold, include:
   - what Planovna is
   - who it is for
   - strong registration and login CTAs
4. Mid-page, explain the main flow/modules:
   - Orders
   - Board
   - Invoices
   - Cashflow
5. Add a lightweight reassurance layer using only safe/product-grounded claims.
6. Repeat the CTA near the bottom with a minimal footer.
7. Keep polish modest and implementation-first, not a marketing redesign.

## Files expected
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/page.test.tsx`
- `plans/public-homepage-v1.md`

## Planned validation
- `npm -w apps/web run test -- --runInBand src/app/page.test.tsx`

## Explicitly out of scope
- multi-page marketing site
- CMS/blog/docs overhaul
- SEO mega-project
- pricing architecture project
- backend/auth contract changes
- full brand redesign
