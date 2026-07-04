# T-35 — Resistances, immunities, and conditions

**Priority:** P2 · **Size:** M · **Phase:** 1 · **Depends on:** T-01 · **From:** user testing (todo #major)

## User story
As a **player**, I want damage resistances/immunities/vulnerabilities and
active conditions on the sheet, so mid-combat questions ("am I poisoned?
do I resist fire?") are answered at a glance.

## Acceptance criteria
- [ ] Character schema gains resistances/immunities/vulnerabilities
      (strings, edit-mode editable) and active conditions (additive).
- [ ] Sheet Defenses tile: edit mode edits the lists; conditions are an
      always-live play control (toggle chips from the 14 standard 5e
      conditions + exhaustion).
- [ ] Round-trip + jsdom tests.
