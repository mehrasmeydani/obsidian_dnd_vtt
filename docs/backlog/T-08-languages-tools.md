# T-08 — Languages & tool proficiencies

**Priority:** P3 · **Size:** S · **Phase:** 1 · **Depends on:** —

## User story
As a **player**, I want my racial and background languages and tool
proficiencies recorded during creation, so that my sheet answers "do I speak
Dwarvish?" without checking the books.

## Acceptance criteria
- [x] Content bundle: races/backgrounds declare granted languages/tools and
      "choose N" language/tool slots.
- [x] Character schema gains `languages: string[]` and `toolProficiencies:
      string[]` (additive change).
- [x] Wizard: picks appear on the race/background steps (reusing the generic
      option-choice UI from T-05); granted ones shown as chips.
- [x] Sheet displays them; tests cover granting + choosing.

## Technical notes
- Reuse the `optionChoices` mechanism from T-05 where possible rather than
  inventing a parallel one.
