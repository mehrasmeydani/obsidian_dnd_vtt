# T-02 — Character sheet CSS skin

**Priority:** P1 · **Size:** S · **Phase:** 1 · **Depends on:** user-supplied CSS file

## User story
As the **DM/user**, I want the character sheet to follow my own CSS styling,
so that sheets match the look of my campaign vault.

## Acceptance criteria
- [x] The user's stylesheet is integrated into `styles.css` (sheet rules
      replaced; wizard rules kept consistent with it).
- [x] No markup/class-name changes required — `dvtt-*` names stay stable.
- [x] Sheet remains legible in both Obsidian light and dark themes (use the
      skin's palette, fall back to Obsidian CSS variables where it is silent).
- [x] Wizard + sheet visually verified in the live vault (user, 2026-07-03).

## Technical notes
- The user's CSS arrived 2026-07-03 as `dnd-character-sheet-v2.css` — an
  Obsidian **snippet** for their handmade Meta Bind/JS Engine sheet (callout
  tiles, `.mb-*` selectors), not a drop-in `dvtt-*` skin. Decision: **port the
  design**, not the file. Kept as the design spec at
  `docs/reference/dnd-character-sheet-v2.css`.
- Ported: tile pattern (secondary-bg card, 14px radius, centered uppercase
  muted header), HP tile with big current(+temp sup)/max display, combat
  mini-stat cards, and the 6-column per-ability grid (stat header → save row
  → skills) with accent borders for proficiency and accent bonus text for
  expertise. All colors come from Obsidian theme variables, so light/dark
  both work.
- `CharacterSheetPreview` markup restructured to the column layout (new
  `dvtt-tile`/`dvtt-sheet-grid`/`dvtt-mini` classes; existing names kept).
  Regression tests in `CharacterSheetPreview.test.tsx`.
- Still in the design spec but deferred to their features' tickets: rest
  tile + resource pips, weapon cards, spell cards with slot pips (T-01,
  T-15); per-class spell accents should be generalized, not hard-coded.
- Build deployed to the vault plugin folder 2026-07-03; user confirmed the
  look the same day. **Done.**
