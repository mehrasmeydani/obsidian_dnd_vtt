# T-10 — Player notes with visibility

**Priority:** P2 · **Size:** M · **Phase:** 1 · **Depends on:** —

## User story
As a **player or DM**, I want session journals and campaign notes that carry a
visibility level (private / party / dm), so that when sync arrives in Phase 3
each participant sees exactly what they should.

## Acceptance criteria
- [x] Note format defined like the character note: ordinary vault Markdown +
      frontmatter marker + visibility field (schema `NoteSchema` already
      exists).
- [x] Command to create a session note (in a configurable folder, defaulting
      near the user's existing `Sessions/` convention).
- [x] Visibility editable via frontmatter; validated on load with graceful
      errors.
- [x] Serializer round-trip tests.

## Technical notes
- Reuse `persistence/` patterns; visibility enforcement is client-side only
  until Phase 3/5 (documented in roadmap §2 note).
