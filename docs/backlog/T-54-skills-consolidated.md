# T-54 — All skill & expertise picks live on the Skills step

**Priority:** P2 · **Size:** S · **Phase:** 1 · **Depends on:** T-28

## User story
As a **player**, I want every skill-proficiency and expertise choice —
including ones granted by class features like College of Lore's Bonus
Proficiencies — gathered on the Skills step, so I see all my skills in
one place; and cross-filtering must work for expertise picks too.

## Notes
- User report (`todo`, 2026-07-05, #minor, against T-28): "move all
  skill prof and expert to skills page so it can all be seen in one
  (bard college of lore) and does not work for expertese".
- The class-options design rule (CLAUDE.md) already assigns skill +
  expertise picks to the Skills step; `kind: "skills"` featureChoices
  apparently still render on the Class options step — move them.
- Bug: expertise pick lists don't participate in T-28 cross-filtering
  (a skill taken elsewhere should hide/filter there per the rules for
  proficiency, and an expertise skill can't be upgraded twice).

## Acceptance criteria
- [ ] Every `kind: "skills"` and `kind: "expertise"` featureChoice
      renders on the Skills step (grouped by origin), none on Class
      options.
- [ ] Expertise lists cross-filter like proficiency lists; dedup across
      levels holds.
- [ ] Wizard walkthrough tests updated; user verifies in Obsidian.

## Status: todo
