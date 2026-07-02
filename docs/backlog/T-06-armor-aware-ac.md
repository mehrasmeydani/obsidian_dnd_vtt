# T-06 — Armor-aware armor class

**Priority:** P2 · **Size:** M · **Phase:** 1 · **Depends on:** T-01 (equipped state editing)

## User story
As a **player**, I want my AC to be computed from the armor and shield I have
equipped (including unarmored defense for monks and barbarians), so that the
sheet shows my real AC instead of a flat 10 + DEX.

## Acceptance criteria
- [ ] Armor data (base AC, DEX cap, type) added to the content bundle for the
      SRD armors used in starting equipment.
- [ ] AC derives from: equipped armor (+ DEX per its cap) + equipped shield,
      or class unarmored defense (barbarian 10+DEX+CON, monk 10+DEX+WIS),
      whichever the character qualifies for; falls back to 10 + DEX.
- [ ] Wizard review and sheet show the derived AC; armor granted by starting
      equipment starts equipped when it is the only armor.
- [ ] AC becomes a derived value (not stored); character schema keeps a
      manual-override field for homebrew cases.
- [ ] Rules tests: each computation path + override.

## Technical notes
- New pure helper in `src/rules/` (e.g. `armorClass.ts`); item schema gains
  an optional armor reference. Migration: existing notes keep their stored
  `armorClass` as the override until re-saved.
