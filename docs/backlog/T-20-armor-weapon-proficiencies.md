# T-20 — Armor & weapon proficiencies as content data

**Priority:** P2 · **Size:** S · **Phase:** 1 · **Depends on:** —

## User story
As a **player**, I want my class's armor and weapon proficiencies
(barbarian: light/medium armor + shields, simple + martial weapons) on
my character, so the sheet and future AC/attack math know what I can
use.

## Acceptance criteria
- [x] Content schema: `proficiencies: { armor: [...], weapons: [...],
      tools: [...] }` on classes (races/backgrounds can adopt the same
      shape later — dwarf weapon training, background tools with T-08).
- [x] Data for all 13 classes from the SRD.
- [x] Assembly copies them onto the character (new Character fields —
      additive schema change).
- [x] Class options step shows them as granted chips (per the user:
      grants are displayed there, they are **not** a pick — 5e RAW).
- [x] Sheet preview lists them.

## Technical notes
- Decision 2026-07-03: the "-C" on armor in the user's field guide
  resolved to "all class choices render in Class options"; armor itself
  stays a grant. Choosing which owned armor is *equipped* (and deriving
  AC from it) remains T-06, which should consume this data.
