# T-52 — Regression: equipping items is gone again

**Priority:** P1 · **Size:** S · **Phase:** 1 · **Depends on:** T-22, T-36

## User story
As a **player on the sheet**, I want to equip/unequip my armor and
shield again — the toggle has disappeared from the inventory.

## Notes
- User report (`todo`, 2026-07-05, #major), against T-22/T-36.
- T-36 intentionally narrowed the toggle to armor-linked items
  (`Item.armorId`); suspicion: characters whose gear lost/never got
  `armorId` (2024 classes? imported content? loot added by hand) show
  no toggles at all — the narrowing turns into "nothing is equippable".
- Investigate: 2024 class equipment data linking, assembly's
  auto-link-by-name, and notes saved before armorId existed.

## Acceptance criteria
- [ ] Root cause identified and covered by a regression test.
- [ ] Armor/shield items show the equip toggle again on affected
      characters (including already-saved notes).
- [ ] User verifies in Obsidian.

## Status: todo
