# T-16 — Level-up editor & multiclassing

**Priority:** P4 · **Size:** XL · **Phase:** post-MVP · **Depends on:** T-01, T-03, T-04, T-15

## User story
As a **player** whose character survived, I want a guided level-up flow on the
sheet (HP roll/average, new features, ASI/feat, new spells — and eventually a
second class), so that advancement is as safe and validated as creation.

## Acceptance criteria
- [ ] "Level up" action on the sheet walks through: HP gain, features gained
      at the new level (from content bundle), ASI/feat when due, spell picks
      for casters.
- [ ] Multiclassing: add a class with 5e prerequisite checks; shared spell
      slot math; `Character.classes[]` already supports multiple entries.
- [ ] Every step validates; result saves through the serializer.
- [ ] The creation wizard stays creation-only — leveling lives here.

## Technical notes
- Needs per-level feature tables in the content bundle (5etools import makes
  this rich; SRD gives a baseline).
- Largest single feature in the backlog — split before implementation.
