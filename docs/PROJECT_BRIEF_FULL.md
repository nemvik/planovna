# Plánovna — Full Project Brief (persisted)

_Last updated: 2026-03-05_

## 1) Kontext a účel
- Cíl: nahradit roztříštěné Excel řízení výroby/termínů/fakturace/cashflow jedním systémem.
- Problém: neprovázané plánování, propadlé termíny, chyby v cashflow, vysoká režie.
- Pokud se neudělá: škálující chaos, více zpoždění, horší finanční přehled.
- Cílovka: zakázková výroba (1–50 uživatelů), role Planner/Shopfloor/Finance/Owner.

## 2) Cíl a KPI
- Source of truth: Order/Operation -> plán -> faktura -> cashflow.
- MVP hotovo = uživatel umí: založit zakázku+operace, naplánovat na boardu, vystavit fakturu, označit úhradu, vidět cashflow 30+ dní.
- KPI:
  - >=80 % nových zakázek plánováno v systému do 4 týdnů
  - median založit+naplánovat <= 5 min
  - 100 % faktur auto vytvoří cashflow položku
  - pozdní zakázky -10 % (baseline 6 týdnů)

## 3) Milníky (4 týdny)
- M1: auth + core data + customers/orders/operations CRUD
- M2: board DnD + persist + filtry
- M3: faktury + cashflow vazby
- M4: stabilizace + monitoring

## 4) Scope
### In-scope
- multi-tenant SaaS (firma=tenant)
- zákazníci, zakázky, operace
- board backlog + dny (DnD)
- faktury (draft/issued/paid) + PDF
- cashflow plán vs skutečnost

### Out-of-scope (MVP)
- APS/solver
- detailní kapacity strojů/lidí
- ERP/účetní integrace
- párování plateb z banky
- sklad/MRP/nákup

## 5) Must-have / Nice-to-have
- P0: CRUD, board DnD, faktura->cashflow, role+tenant izolace
- P1/P2: routing templates, audit log boardu, recurring cashflow, shortcuts

## 6) Nefunkční požadavky
- Board load: ~1s (30 dní), ~2s (90 dní)
- Tenant izolace striktně
- Optimistic updates
- Dostupnost cíl 99.5 % (MVP bez SLA závazku)
- GDPR minimum + export/delete user

## 7) Zamčená rozhodnutí (product)
- Board: backlog + dny, manuální sort_index, operace může být multi-day
- Bez resource assignment povoleno
- Dependencies mezi operacemi: ano
- Concurrency: optimistic lock + conflict error
- Faktury: roční reset číselné řady, v MVP editace povolena
- Cashflow: planned/actual jako 2 oddělené položky
- Mazání: Owner only
- Tenant onboarding: v M4 minimální self-serve baseline (registrace Owner + auto-vytvoření tenantu), bez pozvánek a bez billing automation
- Auth: email+heslo + magic link; navíc M4 self-serve registrace pro Owner, 2FA mimo MVP
- Měny: CZK + EUR
- API styl: tRPC end-to-end
- Import a SLO detail mimo MVP

## 8) Technický rámec
- FE: Next.js + TS + Tailwind + shadcn/ui + dnd-kit
- BE: NestJS (+ tRPC vrstva)
- DB: Postgres + Prisma
- Monitoring: Sentry + logy

## 9) Rizika
- DnD pořadí + concurrency
- Invoice<->cashflow konzistence
- uživatelská adopce (Excel speed očekávání)

## 10) Provozní pravidla spolupráce
- CEO style: minimum rušení, maximum výsledků
- eskalovat jen zásadní blokery/rozhodnutí
- denní/automatické reportování změn a stavu
- projektová práce běží na W SSD: `/mnt/w/Projects/planovna`
