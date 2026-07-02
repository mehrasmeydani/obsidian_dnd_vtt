# T-09 — Flavor fields

**Priority:** P3 · **Size:** S · **Phase:** 1 · **Depends on:** —

## User story
As a **player**, I want alignment, personality traits, ideals, bonds, flaws,
appearance, and backstory on my character, so that the roleplay half of the
sheet lives beside the numbers.

## Acceptance criteria
- [ ] Character schema gains optional flavor fields (additive change).
- [ ] Optional wizard step (skippable) collects them; backgrounds may suggest
      example traits from the content bundle.
- [ ] Sheet displays them (edit mode per T-01); backstory maps naturally to
      the note's prose section rather than JSON where sensible.
- [ ] Round-trip tests through the serializer.

## Technical notes
- Keep long-form text (backstory) as note prose — the note format already
  preserves everything outside the data block; don't duplicate it in JSON.
