# T-42 — Import 5etools fluff as lore text

**Priority:** P3 · **Size:** S · **Phase:** 2 · **Depends on:** T-13 · **Feeds:** T-29 hover cards, wizard cards

## User story
As a **player** using imported content, I want the books' descriptive
prose — class introductions, subclass flavor, race and background lore —
attached to the imported entities, so the wizard cards and future hover
cards (T-29) read like the books instead of bare stat lines.

## Acceptance criteria
- [ ] Content schema: classes, subclasses, races, and backgrounds gain an
      optional `lore` field (rendered plain text, additive).
- [ ] The 5etools importer maps the fluff files users supply
      (`fluff-class-*.json`, `fluff-races.json`, `fluff-backgrounds.json`),
      matching entries to their mechanical siblings by name + source
      (`classFluff`/`subclassFluff`/`raceFluff`/`backgroundFluff`);
      unmatched fluff is reported by name, never silently dropped.
- [ ] Image references are **dropped** (they hotlink 5etools' hosting —
      out of scope and out of policy).
- [ ] Wizard race/class cards show the first lore paragraph when present
      (truncated); the full text waits for T-29's hover component.
- [ ] Same licensing posture as all imports: fluff is verbatim book
      prose — never bundled, user-supplied, local-only (LICENSE.md §3).
- [ ] Tests: fixture mapping (match, mismatch report, image dropping),
      schema round-trip, one wizard-card jsdom check.

## Technical notes
- `renderEntries` already flattens the fluff `entries` trees; the work is
  the name+source join and plumbing the field through.
- Fluff files arrive in the same import folder scan — no new command.
- Keep `lore` out of assembled characters (it's browsing content, not
  character data); the wizard reads it straight off the content entities.
