# Claude context — Obsidian D&D VTT

D&D 5e virtual tabletop as an Obsidian plugin (React + Zod + esbuild).
Architecture and phased plan: `docs/ROADMAP.md`. The actionable work queue
is `docs/backlog/README.md` — a board of T-XX ticket files (user story +
acceptance criteria); pick from the top, update statuses as you go.

## Status (as of 2026-07-03, commit b8336a7)

Phase 0 done; Phase 1 mostly done:
- Creation wizard: name/race → class (+ starting level 1–20) → background →
  abilities (standard array / point buy / manual, racial picks, ASI points) →
  skills → equipment (pick-one choices) → review. Step headers are clickable;
  a hint beside the disabled Next button always explains what's missing.
- Characters persist as vault notes: `dnd-vtt: character` frontmatter marker +
  Envelope JSON in a ```dnd-vtt-character fence. User prose and foreign
  frontmatter are preserved on update (`src/persistence/characterNote.ts`).
  Commands: "Create character", "Open character sheet", "Load character from
  active note". Setting: characters folder.
- Sheet view is still the read-only preview, now restyled to the user's sheet
  design (T-02, awaiting their visual check). **Next big items: editable sheet
  view; subclasses/feats/race-options (data groundwork already in the bundle,
  schema ignores it until implemented); Phase 2 content store.**
- The user's CSS arrived (2026-07-03) as `docs/reference/dnd-character-sheet-v2.css`
  — a snippet for their handmade Meta Bind sheet, used as the **design spec**,
  not dropped in. Its look is ported to `dvtt-*` rules in `styles.css`; it also
  specifies the editable sheet's feature set (HP controls, rests, resource
  pips, weapon/spell cards) for T-01/T-15. Keep `dvtt-*` class names stable.

## Layout

- `src/model/schema.ts` — Zod source of truth (Character, Note, Envelope,
  SCHEMA_VERSION). Derived values are computed, never stored.
- `src/rules/` — pure 5e math (`abilityMath.ts`) and draft→Character logic
  (`characterCreation.ts`). No Obsidian/React imports here.
- `src/data/` — `contentSchema.ts` (Zod for content bundles) + `content/srd/`
  (game data split per entity: one JSON per class — subclasses inside — and
  per race; small background/feat lists whole; **content is data, not code**;
  new files must be listed in the `content/srd/index.ts` manifest) + `srd.ts`
  (thin validated loader). Classes carry an `edition` field ("2014"/"2024");
  the 2024 Barbarian is in (T-17 tracks the rest). Future 5etools/Open5e
  importers emit this same bundle format; only SRD content may ship with the
  plugin (5.1 and 5.2 are both CC-BY). Raw 5etools JSON for reference lives
  in `docs/reference/5etools/` and must never ship.
- `src/persistence/` — pure note format (`characterNote.ts`) split from
  vault I/O (`characterStore.ts`).
- `src/ui/` — React views mounted into ItemViews via `mount.tsx`.

## Workflow

- Tests: `npm test` works on the WSL host (Node 18); 357 tests across rules,
  schema pinning, SRD data integrity, a 234-case race×class×background
  assembly matrix (auto-grows with the bundle), note-format round-trips, and
  jsdom wizard/sheet walkthroughs (Testing Library). Add regression tests
  with every feature.
- Build: `npm run build` (host Node 18+ OK) or `docker compose run --rm build`
  (node:20-slim image; compose runs as host UID so bind-mounted files stay
  user-owned). CI (`.github/workflows/ci.yml`) runs npm ci + test + build.
- **Lockfile caution:** package-lock.json must keep all-platform optional
  binaries (rollup/esbuild). It was once regenerated after an Alpine-container
  update dropped the glibc variants and broke CI (npm bug #4828). If CI fails
  with "Cannot find module @rollup/rollup-linux-x64-gnu": regenerate the lock
  from scratch on glibc.
- Deploy for manual testing: copy `main.js` + `styles.css` (and `manifest.json`
  once) to `/mnt/c/Users/mehra/OneDrive/Desktop/dnd_git/.obsidian/plugins/obsidian-dnd-vtt/`,
  then reload the plugin in Obsidian (toggle off/on or "Reload app without
  saving"). The user's vault: campaigns are `<Name> dnd/` folders (PCs in
  `Hell dnd/Pc`); their Templater template writes `campaign`/`player`/`type`
  frontmatter that our serializer must keep preserving.
- Commit style: imperative summary + body explaining why; push to origin main
  (checks run on push). The user watches CI — keep it green.

## Working agreements

- The user steers scope; when they ask "could we X", answer with a design
  first — they sometimes want a plan/backlog entry, not an implementation.
- Summarize what shipped at the end of every work round; unsummarized work
  gets re-requested.
- New creator features must update: content schema (+ bundle data), draft
  validation (`validateDraft`), wizard step + Next-button hints, review step,
  and the test matrix.
