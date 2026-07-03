# T-17 — 2024 (5.5e) edition content

**Priority:** P2 · **Size:** M · **Phase:** 1–2 · **Depends on:** —

## User story
As a **player**, I want to build characters with the revised 2024 (5.5e)
rules content alongside the original 2014 rules, so that characters for
either edition of the game can be created in the same wizard.

## Acceptance criteria
- [x] Content schema carries an `edition` field ("2014" | "2024", default
      "2014"); ids stay unique across editions while names may repeat.
- [x] Wizard class cards show an edition badge so same-named entries are
      distinguishable.
- [x] Barbarian 2024: d12, STR/CON saves, same skill list, ASIs at
      4/8/12/16, A/B starting equipment (gear + 15 gp, or 75 gp), level-1
      features incl. Weapon Mastery, Berserker subclass staged.
- [ ] Remaining 2024 classes (SRD 5.2) added the same way.
- [ ] 2024 species/backgrounds (which grant ability scores via background
      in 5.5e) — needs a design pass: the 2014 racial-bonus model doesn't
      fit; likely an edition-aware branch in draft validation.
- [ ] Character notes record the edition (currently only implied by the
      copied features/equipment).

## Technical notes
- Source of truth for structure: 5etools class JSON saved under
  `docs/reference/5etools/` (reference only — **not shippable**; PHB/XPHB
  text is WotC-copyrighted). Shipped descriptions must be paraphrased or
  taken from SRD 5.2 (CC-BY-4.0).
- Gold has no first-class model yet (T-07); starting-equipment gold is the
  inventory item `Gold (gp)` with a quantity for now.
- Epic Boon (level 19, 2024) is not modeled; asiLevels simply omit 19.
- 2024 Rage details (uses/day, damage scaling) live only in the trait
  description until the sheet models resources (T-01).
