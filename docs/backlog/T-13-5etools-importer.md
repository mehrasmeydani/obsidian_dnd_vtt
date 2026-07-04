# T-13 — 5etools importer

**Priority:** P2 · **Size:** M · **Phase:** 2 · **Depends on:** T-11

## User story
As a **DM** with my own 5etools data, I want to convert its JSON into plugin
content bundles, so that my full collection (races, classes, subclasses,
feats, backgrounds, spells, items) is available in the wizard and browser
without hand-transcription.

## Acceptance criteria
- [x] Command "Import 5etools data": pick file(s) from the vault (or a
      configured folder), convert to content-bundle JSON, validate via
      `parseContentBundle`, write into the content store.
- [x] Mapping covers races (incl. ability bonuses, options), classes
      (subclasses, ASI levels, equipment where present), backgrounds, feats,
      spells; unmappable entries are reported by name, not silently dropped.
- [x] Import is repeatable (re-import replaces that bundle).
- [x] Converter is pure and tested against fixture snippets of the 5etools
      format.
- [x] **Licensing:** importer ships, data does not — user supplies their own
      files; docs state only SRD content may be redistributed with the plugin.

## Technical notes
- 5etools schema is large and quirky (e.g. `{"@dice": ...}` markup) — start
  with the subset the wizard consumes; expand per user need.
