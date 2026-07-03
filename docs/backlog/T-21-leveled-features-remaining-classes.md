# T-21 — Leveled features: backfill the remaining classes

**Priority:** P2 · **Size:** L · **Phase:** 1 · **Depends on:** T-19

## User story
As a **player**, I want every class — not just the Barbarian — to grant
its full feature progression at creation, so any starting level of any
class produces a complete character.

## Acceptance criteria
- [ ] All 12 remaining 2014 classes (+ their SRD subclasses) get leveled
      feature data in the T-19 shape, from SRD 5.1 text.
- [ ] Classes with mechanical effects get them applied at assembly where
      they change creation-time numbers (e.g. monk Unarmored Movement
      speed bonus; sorcerer/wizard high-level score-independent features
      are text-only).
- [ ] Caster classes: spell slots/cantrips-known tables are **out of
      scope** here (T-15 spell selection); feature text may reference
      them.
- [ ] Data-integrity tests extended: every class has features beyond
      level 1; levels within 1–20; unique names per level.

## Technical notes
- Grind work, one class file at a time; the 5etools reference JSONs can
  be fetched per class into `docs/reference/5etools/` for cross-checking
  (never shipped).
