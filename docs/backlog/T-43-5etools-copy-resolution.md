# T-43 — 5etools importer: resolve `_copy` variants

**Priority:** P2 · **Size:** M · **Phase:** 2 · **Depends on:** T-13

## User story
As a **user importing my 5etools data**, I want records that 5etools
stores as `_copy` variants (Variant Criminal, the XPHB re-listings of old
subclasses, setting reskins of races) to import as full entries instead of
being skipped, so that my imported content matches what 5etools shows.

## Background
5etools encodes many records as *diffs*: `_copy: {name, source, …}` names
a base record, and an optional `_mod` describes edits (append/replace/
remove entries). The importer used to skip all of them (64-line skip log,
26 backgrounds + 16 races + every XPHB subclass stub). The stubs matter
most: without them, 2014-only subclasses (Mastermind, Scout, Swashbuckler,
Inquisitive…) can't be used with 2024 classes at all.

## Acceptance criteria
- [x] A `_copy` record whose base is in the same file resolves: deep clone
      of the base, the copy's own top-level fields win, `_copy` removed.
- [x] Copy-of-copy chains resolve (multi-pass, capped).
- [x] `_mod` array operations apply: appendArr, prependArr, insertArr,
      removeArr, replaceArr (by name or index). Unknown modes/targets
      skip the record with a logged reason (no half-applied edits).
- [x] XPHB subclass stubs resolve to the base subclass under the 2024
      class, so its feature refs import in full.
- [x] Unresolvable copies (base in another file / unknown mode) keep the
      existing skip-with-reason behavior.
- [ ] User verifies in Obsidian after re-import: variant backgrounds
      appear; 2024 classes list the old subclasses.

## Technical notes
- Resolution is a pre-pass (`resolveCopies`) over each record array
  (race/background/feat/spell in `importFiveEtools`, class/subclass in
  `classesFromFiveEtools`) — converters are untouched and still reject
  any `_copy` that survives (base missing).
- Base matching uses every non-underscore string field of the `_copy`
  spec (name, source, className, classSource, shortName…), which is how
  5etools identifies records.
- `_preserve` (page numbers, reprint metadata) is deliberately ignored.
- Cross-file bases (e.g. a UA file copying a PHB race when only one is
  in the import folder) stay unsupported — same-file covers the observed
  skip log entirely when the standard 5etools data files are present.

## Status: needs-check
