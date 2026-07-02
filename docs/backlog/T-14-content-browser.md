# T-14 — Content browser view

**Priority:** P3 · **Size:** L · **Phase:** 2 · **Depends on:** T-11, T-12 (or T-13 for data)

## User story
As a **DM or player**, I want a searchable browser for spells, monsters, and
items inside Obsidian, so that rules lookups happen at the table without
leaving the vault or opening a wiki.

## Acceptance criteria
- [ ] New ItemView with category tabs (spells / monsters / items), text
      search, and key filters (spell level/class; monster CR; item type).
- [ ] Detail pane renders the full entry; in-memory index over the content
      store keeps search instant.
- [ ] "Insert link/summary into active note" action for prep work.
- [ ] Works fully offline from cached bundles; jsdom tests for search +
      filter logic.

## Technical notes
- Index with a simple Map/normalized-string search first; bring in a search
  lib only if it proves too slow on full Open5e data.
