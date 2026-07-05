# T-49 — Wizard lists: 5e and 5.5e as separate sections

**Priority:** P2 · **Size:** S · **Phase:** 1 · **Depends on:** T-17

## User story
As a **player picking a race/class/background**, I want the 2024 (5.5e)
entries in their own section above/below the 2014 (5e) ones instead of
shuffled together, so the two rule sets read as two catalogs.

## Notes
- User report (`todo`, 2026-07-05, #major): "separate the data in 2
  higher and lower section for 5e vs 5.5e instead of next to one
  another."
- Group the card grids on the Race, Class and Background steps by
  edition with a small section heading ("5.5e (2024)" first — newer
  rules on top — then "5e (2014)"); keep the per-card badges.
- Entries without an edition (homebrew defaults to 2014) land in the
  2014 section.

## Acceptance criteria
- [ ] Race/Class/Background steps render two labeled sections when both
      editions are present; one flat list when only one edition exists.
- [ ] Wizard walkthrough tests still pass (selectors unaffected).
- [ ] User verifies in Obsidian.

## Status: todo
