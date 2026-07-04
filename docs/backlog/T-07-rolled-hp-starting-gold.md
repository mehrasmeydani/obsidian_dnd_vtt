# T-07 — Rolled HP and starting gold

**Priority:** P3 · **Size:** S · **Phase:** 1 · **Depends on:** —

## User story
As a **player**, I want to roll my hit points per level and optionally take
starting gold instead of the equipment package, so that the wizard supports
the way my table actually plays.

## Acceptance criteria
- [x] Abilities/Class step offers HP mode: average (default) or rolled;
      rolled mode rolls per level with visible results and a reroll button,
      minimum 1 per level, CON applied.
- [x] Equipment step offers "take starting gold instead": class-specific
      gold roll (e.g. fighter 5d4×10) replaces package + choices.
- [x] Gold lands in inventory as a currency item until a proper currency
      field exists.
- [x] Draft validation and tests cover both modes.

## Technical notes
- Dice helper must be injectable/seedable for deterministic tests.
- Class gold formulas live in the content bundle (`startingGold` on classes).
