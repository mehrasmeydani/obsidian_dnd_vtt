# T-48 — Loot picker: browse & add items in the creator and the sheet

**Priority:** P2 · **Size:** L · **Phase:** 2 · **Depends on:** T-11, T-12

## User story
As a **player**, I want a section to choose loot/items — both on the
Equipment step of the creator and on the character sheet — pulling from
the content store's item catalog (Open5e magic items, imported 5etools
items, SRD armor), so gearing up doesn't mean typing free-text names.

## Plan (own session — L)
1. **Catalog surface:** a searchable item list component (name filter,
   type/rarity facets) reading `ContentStore.items` + `armor`. Reused in
   both hosts.
2. **Creator:** an "Additional loot" block on the Equipment step; picks
   append to the draft inventory alongside class/background equipment
   (armor picks link `armorId` so equip/AC works).
3. **Sheet:** an "Add item" affordance on the Inventory tile (edit mode
   or always-live like play controls — decide with user) opening the
   same picker; respects Wearing/Bags split and T-38 slots when those
   land.
4. Quantity + gold cost display where the data has it; no purchase
   math (gold deduction) in v1 — note it as an option.
5. Tests: picker filtering, draft assembly with loot, sheet add flow.

## Open design questions (ask before building)
- Should adding loot in the creator deduct starting gold (shop mode) or
  be free-form (DM-granted)?
- Sheet: picker always available or edit-mode only?

## Acceptance criteria
- [ ] Item picker in creator (Equipment step) and sheet (Inventory).
- [ ] Armor picked as loot participates in equip/AC.
- [ ] Tests; user verifies in Obsidian.

## Data note (2026-07-05)
The 5etools importer now ingests `item`/`baseitem` (2,658 items incl.
all mundane gear and magic items) and the spell files were pulled into
the user's vault import folder — the catalog this picker browses is
real now. Mundane baseitems carry no prose (5etools keeps damage/
properties structured, not as entries); enriching those descriptions
is in scope here.

## Status: todo
