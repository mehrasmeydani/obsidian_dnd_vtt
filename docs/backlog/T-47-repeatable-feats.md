# T-47 — Repeatable feats (data flag, patched as encountered)

**Priority:** P2 · **Size:** S · **Phase:** 1 · **Depends on:** T-04

## User story
As a **player**, I want feats that 5e allows taking multiple times
(Elemental Adept, Martial Adept…) to be pickable more than once, with a
single obvious place to mark a feat as repeatable so the list can be
extended as we hit them instead of auditing every feat up front.

## Design
- `repeatable: boolean` (default `false`) on `FeatDataSchema` — one
  flag in the content data, exactly the "place I can easily add the
  option" the user asked for. Importers pass it through when 5etools
  marks it; otherwise users flip it in their bundle JSON.
- Draft/validation: the duplicate-feat check (ASI feats + origin feat)
  skips feats with `repeatable: true`; assembly may emit the same
  feature name twice (grouped rendering already tolerates it).

## Acceptance criteria
- [ ] Schema flag + duplicate check exemption + tests.
- [ ] SRD data: flag any bundled feats that are repeatable per SRD text.
- [ ] User verifies in Obsidian.

## Status: todo
