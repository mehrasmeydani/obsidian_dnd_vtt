# T-23 — Two-way Markdown data for characters (and future entities)

**Priority:** P2 · **Size:** M · **Phase:** 1–2 · **Depends on:** T-01

## User story
As a **user with an Obsidian-native workflow** (Dataview, Meta Bind,
Templater), I want my character's key data readable and editable as plain
Markdown/frontmatter in the note — not only inside the JSON fence — so
that my existing queries, dashboards, and templates keep working, and an
edit from either side (sheet or Markdown) flows to the other.

## Acceptance criteria
- [x] A defined **projection** of character data into note frontmatter
      (e.g. `hp`, `hp_max`, `ac`, `level`, `class`, `race`, plus the
      user's existing `campaign`/`player`/`type` keys untouched) written
      on every save; the JSON envelope stays the single source of truth.
- [x] Hand-edits to projected frontmatter fields flow back into the
      character on load/refresh (the sheet's modify-watcher already
      reloads; parsing must diff frontmatter against the envelope and
      prefer the newer hand-edit).
- [x] Fields that are derived (AC when not overridden, modifiers) are
      projected read-only: a hand-edit to them is ignored and rewritten,
      documented in the note skeleton.
- [x] Round-trip tests: sheet edit → frontmatter updated; frontmatter
      edit → character updated; user prose and foreign keys preserved;
      conflicting edits resolve deterministically (envelope wins ties).
- [x] Same mechanism designed to extend to future entities (session
      notes T-10, NPCs) without new serializers per type.

## Technical notes
- Extend `persistence/characterNote.ts`: today frontmatter only carries
  the `dnd-vtt: character` marker. Add a projection table (field →
  frontmatter key, direction: two-way | write-only) so the sync stays
  declarative and testable.
- Guard against loops with the existing self-save counter in
  `CharacterSheetView`.
- The user's Templater PC template writes `campaign`/`player`/`type` —
  those must keep round-tripping untouched (already covered by tests).
