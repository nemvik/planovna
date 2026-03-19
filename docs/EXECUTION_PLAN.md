# Plánovna — Execution Plan (CEO view)

## Cíl za 4 týdny
Spustit použitelný MVP provoz pro 1. pilotní firmu: plánování výroby + faktura + cashflow v jednom toku.

## Co bude reálně hotové
1. Zakázka -> operace -> naplánování na boardu
2. Dílna mění stav operací
3. Finance vystaví fakturu a označí úhradu
4. Cashflow ukáže plán vs skutečnost (30+ dní)

## KPI
- 80 % nových zakázek plánováno v systému do 4 týdnů
- Median založení+naplánování <= 5 min
- 100 % faktur vytvoří cashflow položku
- Pozdní zakázky: -10 % (baseline 6 týdnů)

## Delivery rytmus
- Denní krátký status: done / risk / next
- Okamžitá eskalace: tenant izolace, board persist, invoice->cashflow

## Hlavní rizika a mitigation
- Board concurrency: zavádíme optimistic lock + explicit conflict error
- Data konzistence invoice/cashflow: transakční zápisy + integrační testy
- Adopce: UX optimalizace boardu jako priorita nad účetní detaily

## M4 auth baseline (self-serve onboarding)
- Cíl: odstranit ruční onboarding jako hard dependency pro pilot.
- In-scope MVP:
  - veřejná registrace `Owner` účtu (email+heslo),
  - automatické založení tenantu při registraci,
  - okamžité přihlášení po registraci,
  - základní ochrany (duplicitní email, minimální validace hesla, rate-limit na registraci).
- Out-of-scope v této fázi:
  - self-serve pozvánky dalších uživatelů,
  - billing/paywall,
  - email verifikace a 2FA,
  - vlastní provisioning flow mimo jeden default tenant setup.
- Backend touchpointy: auth register endpoint/procedura, tenant bootstrap, role assignment (`Owner`).
- Web touchpointy: registrační formulář + navázání na existující login session flow.
- Riziko: onboarding abuse/spam; mitigace = jednoduchý rate-limit + audit log registrací.

## Rozhodnutí, která držíme
- tRPC end-to-end
- Multi-tenant isolation striktně přes tenant_id + policy guard
- Import mimo MVP
- SLO/RTO detail mimo MVP
