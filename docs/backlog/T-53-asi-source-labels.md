# T-53 — Ability bonus labels name their source (class ASI vs background)

**Priority:** P3 · **Size:** XS · **Phase:** 1 · **Depends on:** T-26

## User story
As a **player on the Abilities step**, I want each bonus labeled by
where it comes from — "+1 ASI (class)" vs "+1 background" — since 2024
backgrounds also grant increases and a bare "ASI" is ambiguous now.

## Notes
- User report (`todo`, 2026-07-05, #minor), refining T-26: "asi to
  class instead as asi can be from background too also split those".
- Rows already show separate `+N racial` / `+N background` / `+N ASI`
  deltas; rename the ASI delta to name the class and keep the split
  per source.

## Acceptance criteria
- [ ] Ability rows label class ASI points as class-sourced; background
      increases stay separately labeled; both can appear on one row.
- [ ] User verifies in Obsidian.

## Status: todo
