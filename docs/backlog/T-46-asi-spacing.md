# T-46 — Abilities step: ability score improvement spacing broken

**Priority:** P1 · **Size:** XS · **Phase:** 1 · **Depends on:** —

## User story
As a **player on the Abilities step**, I want the Ability Score
Improvement block laid out cleanly, so the +/- controls and labels
don't crowd or misalign.

## Notes
- User report (`todo`, 2026-07-05): "spacing issue in ability score
  improvement in abilities #major". Inspect the ASI/feat block CSS
  (`dvtt-*` rules) — likely a wrapping/gap issue now that each ASI
  level renders its own "+2 points or a feat" chooser.

## Acceptance criteria
- [ ] ASI blocks on the Abilities step have consistent spacing at
      normal and narrow pane widths.
- [ ] User verifies in Obsidian.

## Status: todo
