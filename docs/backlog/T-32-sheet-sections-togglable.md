# T-32 — Togglable sheet sections

**Priority:** P1 · **Size:** M · **Phase:** 1 · **Depends on:** T-01 · **From:** user testing (todo #major)

## User story
As a **player**, I don't want features, traits, spells, and inventory in
one endless page — sections should collapse/expand for easier reading.

## Acceptance criteria
- [ ] Features, Spells, Inventory, Proficiencies & languages, and Notes
      tiles are collapsible (chevron in the tile title); state persists per
      view while open.
- [ ] Play-critical tiles (HP/combat/abilities) stay always visible.
- [ ] jsdom tests: collapse hides content, expand restores, controls keep
      working after toggling.
