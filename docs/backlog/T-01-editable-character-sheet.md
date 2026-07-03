# T-01 — Editable character sheet view

**Priority:** P1 · **Size:** L · **Phase:** 1 · **Depends on:** —

## User story
As a **player**, I want to edit my character directly on the sheet (HP, ability
scores, inventory, notes) and have changes saved back to my character note
automatically, so that the sheet is my single place to play from instead of
editing JSON by hand.

## Acceptance criteria
- [x] Sheet has a read mode and an edit mode toggle.
- [x] Editable in edit mode: current/max/temp HP, ability scores, AC, speed,
      proficiency toggles (saves + skills), inventory rows (add/remove/edit
      quantity/equipped), spells list, character notes text.
- [x] Derived values (modifiers, save/skill bonuses, passive perception,
      spell DC) recalculate live and are never directly editable.
- [x] Every change is validated by `CharacterSchema` and auto-saved to the
      character's vault note via the existing serializer (debounced).
- [x] The sheet binds to a note: opening the sheet with a character note
      active loads that character; hand-edits to the note refresh the sheet.
- [x] Regression tests: sheet edit round-trip (jsdom), no lost user prose.

## Technical notes
- Replace `CharacterSheetPreview` usage in `src/ui/CharacterSheetView.tsx`;
  keep the `dvtt-*` class names (T-02 reskins them).
- Persistence goes through `saveCharacterNote` / `parseCharacterNote`.
- Watch the bound `TFile` via `metadataCache`/`vault.on("modify")` and
  ignore self-triggered saves.
