# T-56 — Starting equipment data quality pass

**Priority:** P3 · **Size:** S · **Phase:** 1 · **Depends on:** T-07

## User story
As a **player**, I want every race/class/background to hand out
sensible starting equipment — some currently have thin or awkward
equipment lists (user report, `todo` 2026-07-05, #minor).

## Notes
- Sweep the SRD bundle's `equipment` blocks (classes: fixed + choices;
  backgrounds: fixed; 2024 gold amounts vs gear) against the SRD text;
  fix gaps. Overlaps with the T-17 "needs further review" list
  (equipment gp values, gear-vs-gold).

## Acceptance criteria
- [ ] Audit + fixes committed; data integrity tests still pass.
- [ ] User verifies a few known-thin entries in Obsidian.

## Status: todo
