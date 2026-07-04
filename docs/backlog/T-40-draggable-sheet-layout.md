# T-40 — Dynamic sheet layout: drag & drop, show/hide tiles

**Priority:** P3 · **Size:** L · **Phase:** 2+ · **Depends on:** T-01, T-32 · **From:** user request (minor feature)

## User story
As a **player**, I want to arrange my character sheet my way — drag
tiles (HP, Combat, Inventory, Spells, Features…) into a different order
and hide the ones I don't use — so the sheet fits how I actually play.

## Acceptance criteria
- [ ] Tiles can be reordered by drag & drop (an explicit "arrange" mode
      or drag handles on tile titles — play controls must not be
      accidentally draggable mid-session).
- [ ] A tile picker lets the player show/hide individual tiles; hidden
      tiles are recoverable from the same picker (nothing is lost).
- [ ] Layout (order + visibility + T-32 collapsed state) persists per
      character in the note's envelope, or per vault in plugin settings —
      decide in the design pass; per-character is preferred so a caster
      and a barbarian can differ.
- [ ] Sane default layout = today's order; a "reset layout" action.
- [ ] Keyboard-accessible reordering (move up/down buttons in arrange
      mode) so drag isn't the only path.
- [ ] jsdom tests: reorder persists, hidden tile disappears and returns,
      reset restores defaults.

## Technical notes
- Minor/nice-to-have: schedule after the P1/P2 queue.
- HTML5 drag-and-drop is enough (no new dependency); tiles already share
  the `dvtt-tile` wrapper, so a `SheetLayout` component owning an ordered
  id list can wrap them generically.
- Persisting in the envelope means a schema-additive `sheetLayout` field
  on Character (order: string[], hidden: string[]); the frontmatter
  projection is NOT needed for this.
