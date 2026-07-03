# T-05 — Race & background option choices

**Priority:** P2 · **Size:** M · **Phase:** 1 · **Depends on:** —

## User story
As a **player** creating a dragonborn, I want to choose my draconic ancestry
(and similar race/background options) in the wizard, so that choice-based
traits are recorded on my character instead of being lost.

## Acceptance criteria
- [x] Content schema validates the generic `optionChoices[]` on races and
      backgrounds (dragonborn Draconic Ancestry already in the bundle).
- [x] Race and Background steps render a dropdown per option choice; Next is
      gated (with hint) until every choice is made; switching race/background
      resets its selections.
- [x] The selection becomes a `Character.features` entry
      (e.g. "Draconic Ancestry: Red (fire)") sourced to the race/background.
- [x] Review step shows the chosen options; tests cover validation + assembly.

## Technical notes
- `characterCreation.ts`: draft gains `raceOptions` / `backgroundOptions`
  records (choiceId → optionId); validation lists unanswered choices.
- Mechanism is generic — future bundles (5etools import) can attach options
  to any race/background without code changes. High-elf cantrip and dwarf
  tool choices join once Phase 2 provides spell/tool lists.
