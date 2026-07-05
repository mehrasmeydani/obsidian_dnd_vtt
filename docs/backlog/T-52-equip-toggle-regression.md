# T-52 — Regression: equipping items is gone again

**Priority:** P1 · **Size:** S · **Phase:** 1 · **Depends on:** T-22, T-36

## User story
As a **player on the sheet**, I want to equip/unequip my armor and
shield again — the toggle has disappeared from the inventory.

## Notes
- User report (`todo`, 2026-07-05, #major), against T-22/T-36.
- **Design correction from the user (mid-fix):** it's not an armor-link
  bug — *everything* should be equippable (greataxe, handaxe, backpack:
  carried on your person vs left in a cart/on a horse). T-36's
  "wearables only" rule is retired; slot limits stay with T-38.

## Resolution (2026-07-05)
- Every inventory item gets the equip toggle again (read-mode chip
  button + edit-mode checkbox). The one-body-armor doffing rule and
  armor-driven AC are unchanged; equipping non-armor gear never moves
  AC.
- Bonus hardening: `linkArmorByName` (rules/armorClass.ts) re-links
  `armorId` by name — applied at assembly and when parsing notes, so
  characters saved before armorId existed get their armor feeding AC
  again; tolerates a trailing " armor" (fixes ranger-2024's "Studded
  leather armor").

## Acceptance criteria
- [x] Root cause identified and covered by regression tests.
- [x] Every item shows the equip toggle (including already-saved notes).
- [ ] User verifies in Obsidian.

## Status: needs-check
