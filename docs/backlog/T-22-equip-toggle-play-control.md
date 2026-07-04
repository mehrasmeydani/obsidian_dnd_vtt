# T-22 — Equip toggle as a play control

**Priority:** P2 · **Size:** S · **Phase:** 1 · **Depends on:** T-01, T-06

## User story
As a **player**, I want to equip/unequip inventory items directly on the
sheet while playing — raise a shield, don or doff armor — without entering
edit mode, so that my AC (which now derives from equipped gear, T-06)
follows what my character is actually wearing mid-session.

## Acceptance criteria
- [x] Read mode: each inventory item has an equip toggle (today the
      equipped state is only editable in edit mode; read mode just marks
      equipped items with a dot).
- [x] Toggling recomputes derived AC live (equip shield: +2; swap armor:
      new formula) and auto-saves through the normal debounced note save.
- [x] Equipping a second body armor either unequips the first or is
      blocked with a hint — no stacked body armor (shield + body armor is
      fine; `rules/armorClass.ts` already ignores extras, so this is a UX
      guarantee, not a math fix).
- [x] Edit mode keeps the existing full row editor (name/quantity/remove).
- [x] jsdom tests: toggle in read mode, AC updates, single-body-armor rule.

## Technical notes
- `CharacterSheet.tsx` InventoryTile: render the read-mode chips as
  toggle buttons (aria-pressed) or add a checkbox per chip; keep `dvtt-*`
  class names stable and mark equipped state with the existing
  `is-equipped` accent.
- Same "play controls are always live" doctrine as HP/pips/rests (T-01).
