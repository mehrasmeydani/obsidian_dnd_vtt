# Reference material (partly local-only)

- `dnd-character-sheet-v2.css` — the user's handmade Meta Bind sheet CSS,
  used as the design spec for the plugin sheet (T-02). Tracked.
- `5etools/` — **git-ignored, local-only.** Raw 5etools JSON used to
  cross-check structure when writing SRD content files. It contains
  non-SRD, WotC-copyrighted text, so it is never committed, shipped, or
  redistributed. To populate it, fetch the files you own from your own
  5etools data (e.g. `class-*.json`, `races.json`, `backgrounds.json`,
  `feats.json`); the importer integration test in
  `src/data/fiveEtoolsImport.test.ts` runs against them when present and
  skips cleanly when absent.

Only SRD 5.1 / 5.2 (CC-BY-4.0) content may go into `src/data/content/`.
Everything else reaches users through the "Import 5etools data" command,
using files they supply themselves.
