# Plánovna

MVP SaaS pro zakázkovou výrobu: plánování operací (board), fakturace a cashflow.

## Product decisions (locked)
- Board: backlog + dny, ruční pořadí (DnD)
- Operace mohou trvat více dní
- Optimistic lock + konflikt = error
- Faktury: roční číselná řada, v MVP editace povolena
- Cashflow: planned + actual jako 2 oddělené položky
- Role: delete pouze Owner
- Auth: email+heslo + magic link
- Měny: CZK, EUR

## MVP Milestones
- M1: Auth + core data + CRUD
- M2: Board DnD + persist + filtry
- M3: Faktury + cashflow vazby
- M4: Stabilizace + monitoring + prod hardening

## Repo layout
- `apps/web` — Next.js frontend
- `apps/api` — NestJS backend
- `packages/shared` — shared types/contracts
- `docs` — product + architecture + runbooks

## Persistent source docs (important)
- `docs/PROJECT_BRIEF_FULL.md` — full persisted assignment (not chat-context dependent)
- `docs/DECISIONS_LOG.md` — locked product/tech decisions
- `docs/EXECUTION_PLAN.md` — CEO-level delivery plan
- `docs/ARCHITECTURE_MVP.md` — implementation architecture
