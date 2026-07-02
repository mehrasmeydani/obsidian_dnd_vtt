# T-02 — Character sheet CSS skin

**Priority:** P1 · **Size:** S · **Phase:** 1 · **Depends on:** user-supplied CSS file

## User story
As the **DM/user**, I want the character sheet to follow my own CSS styling,
so that sheets match the look of my campaign vault.

## Acceptance criteria
- [ ] The user's stylesheet is integrated into `styles.css` (sheet rules
      replaced; wizard rules kept consistent with it).
- [ ] No markup/class-name changes required — `dvtt-*` names stay stable.
- [ ] Sheet remains legible in both Obsidian light and dark themes (use the
      skin's palette, fall back to Obsidian CSS variables where it is silent).
- [ ] Wizard + sheet visually verified in the live vault.

## Technical notes
- Blocked until the CSS file arrives (expected ~2026-07-04).
- If the skin targets different class names, add them alongside `dvtt-*`
  rather than renaming.
