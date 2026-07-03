# T-18 — Option-bearing class features in the wizard

**Priority:** P1 · **Size:** M · **Phase:** 1 · **Depends on:** T-03

## User story
As a **player**, I want every class feature that asks for a choice —
fighting style, expertise, pact boon, weapon mastery, dragon ancestor —
to actually be choosable in the creation wizard, so that no part of my
character has to be hand-edited afterwards.

## Acceptance criteria
- [x] Content schema: `featureChoices` on classes and subclasses, three
      kinds — `options` (named picks → features), `skills` (new
      proficiencies), `expertise` (upgrade proficient skills). Each has an
      unlock `level` and a pick `count`.
- [x] Data (SRD 2014 + 2024 Barbarian): Fighting Style (fighter 1,
      paladin 2, ranger 2), Favored Enemy + Natural Explorer (ranger 1),
      Expertise (rogue 1/6, bard 3/10), Pact Boon (warlock 3), Weapon
      Mastery + Primal Knowledge (2024 barbarian 1/3), Dragon Ancestor
      (Draconic Bloodline 1), Circle of the Land terrain (2), Hunter's
      Prey (3), Lore bard Bonus Proficiencies (3).
- [x] New wizard step "Class options" directly after Class, containing the
      subclass cards (T-03) and the options/skills-kind choices. Expertise
      choices render on the Skills step instead — their pool is the skills
      chosen there. Next-gating hints shared with `validateDraft` via
      `featureChoiceProblems(draft, kinds?)`. Class/subclass/level changes
      prune stale picks.
- [x] Assembly: option picks become features ("Fighting Style: Dueling"),
      skills picks become proficiencies, expertise picks set the
      `expertise` proficiency level; review shows "(expertise)" markers.
- [x] Validation: counts, allowed values, expertise-from-proficient, no
      skill counted twice, no double expertise across choices.
- [x] Tests: srd data integrity (unique/satisfiable choices), unit
      coverage per kind, matrix auto-picks level-1 choices, jsdom
      walkthrough for a level-3 rogue (Thief + expertise).

## Out of scope / follow-ups
- Warlock **eldritch invocations** (level 2+): a large option list with
  level/pact prerequisites — deferred; model needs a `prerequisite` field.
- Rogue expertise alternative (thieves' tools) — tools aren't modeled
  (T-08).
- Feats at ASI levels stay T-04; cantrip/spell picks stay T-15.
- Choices unlocked between creation levels belong to the level-up editor
  (T-16).
