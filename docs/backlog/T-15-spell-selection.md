# T-15 — Spell selection in the creation wizard

**Priority:** P3 · **Size:** L · **Phase:** 2 · **Depends on:** T-12 (spell data), T-03 (subclasses)

## User story
As a **player** creating a caster, I want to choose my cantrips and
known/prepared spells during creation, appropriate to my class and level, so
that my character is playable the moment the wizard finishes.

## Acceptance criteria
- [ ] Content bundle: per-class spell list references + progression (cantrips
      known, spells known/prepared, slots by level).
- [ ] New wizard step for casters only: pick cantrips and spells with counts
      enforced and gated by blockers/hints; searchable list.
- [ ] Picks land in `Character.spells` (schema already has it) with
      `sourceSlug` back-references; review step shows them.
- [ ] Non-casters skip the step entirely; tests cover a known-caster (bard),
      a prepared-caster (cleric), and a non-caster.

## Technical notes
- Prepared casters technically choose daily — creation records the initial
  prepared set; the sheet (T-01) handles later changes.
