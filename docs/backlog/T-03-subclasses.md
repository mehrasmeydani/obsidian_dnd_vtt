# T-03 — Subclass selection in the creation wizard

**Priority:** P1 · **Size:** M · **Phase:** 1 · **Depends on:** —

## User story
As a **player**, I want to pick my subclass during character creation when my
starting level unlocks it, so that my cleric has a domain and my fighter an
archetype without hand-editing the note afterwards.

## Acceptance criteria
- [x] Content schema validates `subclassLevel` + `subclasses[]` on classes
      (data already present in `srd-5.1.json`, currently ignored).
- [x] Class step shows subclass cards once `level ≥ subclassLevel`
      (cleric/sorcerer/warlock at level 1; druid/wizard at 2; rest at 3);
      below that it shows "unlocks at level N".
- [x] Next is gated (with hint) until a subclass is picked when required;
      changing class or dropping below the level resets/clears the pick.
- [x] `Character.classes[].subclass` records the choice (schema change is
      additive — old notes stay valid); subclass traits become features.
- [x] Review step shows the subclass; matrix tests extended to cover
      required-at-level-1 subclasses.

## Technical notes
- `contentSchema.ts`: `SubclassSchema`; defaults keep bundles without
  subclasses valid. `schema.ts`: optional `subclass` on class entries.
- `characterCreation.ts`: `subclassRequired(draft)`, validation, assembly.
- Wizard: cards in `ClassStep`, blockers in case 1.
- Shipped 2026-07-03 together with [T-18](T-18-class-feature-options.md)
  (feature options), which added `featureChoices` to subclasses too. **Done.**
