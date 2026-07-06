# T-45 — Class options step: all fields collapsible

**Priority:** P3 · **Size:** S · **Phase:** 1 · **Depends on:** T-32

## User story
As a **player on the Class options step**, I want every section
(leveled feature progression, proficiencies, and each choice block) to
fold behind its title, so the step isn't a wall of text now that
imported classes carry full 1–20 progressions.

## Notes
- From the user's testing notes (`todo`, 2026-07-05): "all fields in
  class option should be collapsable #minor".
- The sheet already has `CollapsibleTile` (T-32) — reuse it or a
  lighter wizard variant rather than inventing a second pattern.
- Sensible defaults: choice blocks (subclass, fighting style, weapon
  mastery…) start **open** (they gate Next); the read-only granted
  progression and proficiencies start **collapsed** above level ~3
  where they get long.
- Collapsed state must not hide validation problems: a collapsed
  section containing an unresolved choice should show a marker (reuse
  the red "!" convention from T-30).

## Acceptance criteria
- [x] Every section on the Class options step can be folded/unfolded by
      clicking its title (chevron affordance, keyboard-accessible).
- [x] Collapsed sections with incomplete choices show an incomplete
      marker; the footer hint still names what's missing.
- [x] Wizard walkthrough test covers folding a section and completing a
      choice inside a re-opened one.
- [ ] User verifies in Obsidian.

## Status: needs-check
