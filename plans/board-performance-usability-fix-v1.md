# Board performance/usability fix v1

## Goal
Rapidly reduce Board DOM weight, initial page depth, and slow select/form interactions without changing workflow semantics.

## Highest-confidence verified causes on current board surface
1. **Every card renders all edit forms by default**
   - In `apps/web/src/app/home-workspace.tsx`, each operation card eagerly renders multiple full forms and inputs:
     - code edit form
     - title edit form
     - end-date form
     - sort-index form
     - blocked-reason form
     - dependency management panel with select/options
     - quick-actions panel with 2 selects
     - scheduling form
   - This multiplies DOM nodes and controlled inputs across every operation card.

2. **Dependency selects are especially expensive**
   - Each card builds a `<select>` whose options are derived from filtering the entire `operations` list, per card, during render.
   - That creates repeated O(cards × operations) option generation and a very heavy DOM subtree.

3. **Cards are over-expanded by default**
   - The default card state exposes almost all controls immediately, so the board becomes visually endless even before the user asks to edit anything.
   - This directly matches the reported “tasks/cards too expanded by default” and “page feels almost endless”.

4. **Controlled inputs/selects are mounted for every card from first paint**
   - Even when untouched, all those inputs/selects participate in layout, reconciliation, and interaction cost.
   - This is a strong candidate for slow select interactions and sluggish typing/click response.

5. **Board shell width/depth amplifies the problem**
   - The current grid plus tall cards produces very long vertical pages, which worsens perceived load and scanning cost even before any data mutation happens.

## Smallest highest-impact first slice
### Slice A: collapsed-by-default operation cards with lazy-expanded detail panels
This is the clearest first delivery.

#### What changes
- Keep each card’s **default visible surface** to only:
  - drag handle
  - code + title
  - small status/blocker summary
  - maybe one lightweight metadata line
  - one explicit `Expand details` / `Edit details` toggle
- Move the heavy forms and dependency/select panels into a **collapsed detail section** rendered only when that operation is expanded.
- Keep at most one expanded card at a time, or use per-card expansion with a conservative default of fully collapsed.

#### Why this first
- biggest DOM reduction for the smallest localized code change
- directly solves over-expansion and “endless page” perception
- should materially improve initial render and input/select latency
- does not change workflow semantics or API behavior

## How to reduce DOM weight
1. Do not mount heavy edit forms for collapsed cards.
2. Do not mount dependency option lists until the card is expanded.
3. Keep quick-actions and scheduling controls inside the expanded section.
4. Render summary-only card shells in the default state.
5. If needed in slice B, memoize dependency candidate lists or compute them only for the expanded card.

## How to stop initial over-expansion
1. Cards start collapsed by default.
2. Replace always-visible edit controls with one compact action row.
3. Show only essential operational summary on first view.
4. Prefer one expanded card at a time to limit simultaneous DOM growth.

## How to improve load and interaction latency
### In slice A
- reduce first-paint mounted inputs/selects drastically
- avoid building dependency `<option>` lists for every card
- shorten card height so the browser does less layout/paint work

### Likely slice B after A if still needed
- memoize dependency candidate computation for expanded card only
- split `SortableOperationItem` detail content into a small memoized child
- consider rendering only the visible bucket first if metrics still show lag

## Exact files likely affected
### Required for slice A
- `apps/web/src/app/home-workspace.tsx`
- `apps/web/src/app/home-workspace.test.tsx`
- `plans/board-performance-usability-fix-v1.md`

### Optional only if the extraction stays tiny
- one small route-local helper under `apps/web/src/app/` for collapsed/expanded card content

## Truth boundary
- No workflow redesign
- No backend/API widening
- No planning or finance-model changes
- No new board features
- Only rendering/default-state/usability performance remediation

## Focused validation commands
- `../../node_modules/.bin/jest --runInBand --silent src/app/home-workspace.test.tsx` (from `apps/web`)
- if selectors/navigation are touched: `../../node_modules/.bin/jest --runInBand --silent src/app/navigation.test.tsx` (from `apps/web`)

## Recommendation
Start immediately with **Slice A: collapsed-by-default cards + lazy-mounted detail panels**.
This is the smallest highest-confidence fix for all four reported symptoms:
- heavy DOM
- expanded cards by default
- endless page feel
- slow selects/interactions
