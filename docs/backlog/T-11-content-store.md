# T-11 — Local content store (bundles in plugin data)

**Priority:** P1 · **Size:** M · **Phase:** 2 · **Depends on:** —

## User story
As a **user**, I want the plugin to load game content from local JSON bundles
in my plugin data folder as well as the built-in SRD, so that content fetched
or imported once is available offline forever and I can add homebrew by
dropping in a file.

## Acceptance criteria
- [ ] Content store loads every `*.json` bundle from
      `.obsidian/plugins/obsidian-dnd-vtt/data/content/` at startup, each
      validated by `parseContentBundle`; invalid bundles are skipped with a
      notice naming the file and the problem.
- [ ] Bundles merge over the built-in SRD by `id` (later sources override);
      merged content feeds the wizard everywhere it reads RACES/CLASSES/etc.
- [ ] Bundle metadata (`name`, source, fetchedAt) is shown in settings, with
      per-bundle enable/disable.
- [ ] No network access involved; unit tests for merge/override behavior.

## Technical notes
- Refactor `src/data/srd.ts` consumers to read from a `ContentStore` service
  the plugin owns, seeded with the bundled SRD.
- This is the foundation T-12 (Open5e) and T-13 (5etools) write into.
