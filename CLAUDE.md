# Claude context — Obsidian D&D VTT

D&D 5e virtual tabletop as an Obsidian plugin (React + Zod + esbuild).
Architecture and phased plan: `docs/ROADMAP.md`. The actionable work queue
is `docs/backlog/README.md` — a board of T-XX ticket files (user story +
acceptance criteria); pick from the top, update statuses as you go.

## Status (as of 2026-07-04, end of the big backlog round)

**Verification flow:** work the user hasn't confirmed in Obsidian sits at
status `needs-check` on the board, itemized in
`docs/backlog/NEEDS-CHECK.md` — the user flips items to `done` after
testing. The user's raw testing notes arrive in the repo-root `todo`
file; turn each into a T-XX ticket before fixing.

**Shipped this round (all needs-check):** T-10 session notes ·
T-12 Open5e refresh (spells/monsters/items schemas + store categories) ·
T-13 5etools importer (`data/fiveEtoolsImport.ts`, import folder setting) ·
T-21 full 1–20 progressions for all 12 remaining 2014 classes + resources ·
T-22 equip toggle · T-23 frontmatter projection (`persistence/frontmatter.ts`,
hp/hp_max/race two-way; ac/level/class write-only) · T-24 campaigns
(`persistence/campaigns.ts`, Create-campaign command, active campaign
routes new notes, `campaign` key stamped only when absent) · T-07 rolled
HP + starting gold (`rules/dice.ts`, `startingGold` on classes) ·
T-08 languages/tools (`grants` on optionChoices; `Character.languages`) ·
from user testing: T-25 level field, T-26 ASI labels, T-28 skill
cross-filtering (taken skills are *hidden* in other lists), T-32
collapsible sheet tiles (`CollapsibleTile`), T-33 features grouped by
origin, T-34 rest confirm, T-36 wearing/bags + equip only wearables.

**Open next:** T-30 free wizard navigation + T-31 live preview (both
change wizard gating — expect test churn in the walkthroughs), T-27 dice
roll animation (CSS-only approach planned), T-35 defenses/conditions,
then T-09 flavor fields, T-17 finish (2024 classes/species/backgrounds —
big content grind), T-14 browser, T-15 spells, T-16 level-up.

## Status (older detail, still accurate)

Phase 0 done; Phase 1 mostly done:
- Creation wizard: name/race → class (+ starting level 1–20) → class options
  (subclass cards once `level ≥ subclassLevel`, plus fighting styles, pact
  boon, weapon mastery… — choice kinds options/skills/expertise via
  `featureChoices` in the content schema; expertise renders on the Skills
  step instead, since it picks from the skills chosen there) → background →
  abilities (standard array / point buy / manual, racial picks, ASI points)
  → skills (+ expertise) → equipment (pick-one choices) → review. Step
  headers are clickable; a hint beside the disabled Next button always
  explains what's missing. Warlock invocations are NOT modeled yet (needs
  prerequisites, see T-18 notes).
- Characters persist as vault notes: `dnd-vtt: character` frontmatter marker +
  Envelope JSON in a ```dnd-vtt-character fence. User prose and foreign
  frontmatter are preserved on update (`src/persistence/characterNote.ts`).
  Commands: "Create character", "Open character sheet", "Load character from
  active note". Setting: characters folder.
- Sheet view is editable (T-01): `src/ui/CharacterSheet.tsx` replaces the old
  preview. Play controls (damage/heal with temp-first order, resource pips,
  short/long rest, spell prepared) are always live; an Edit toggle unlocks
  name/scores/AC/speed/max HP, save + skill proficiency toggles, inventory,
  spells, and notes. Derived values are always computed. The view binds a
  vault note (wizard finish, "Load character from active note", or the
  active note on open), debounces saves 800 ms through the prose-preserving
  serializer, and refreshes on external edits (self-writes skipped via a
  counter).
- Feats (T-04): each earned ASI level is its own "+2 points or a feat" choice
  on the Abilities step (draft `asiFeats`, level → FeatData|null); chosen
  feats become features with source "Feat". Bundles validate top-level
  `feats[]` (SRD ships Grappler).
- Race/background option choices (T-05): generic `optionChoices[]` on races
  and backgrounds (dragonborn Draconic Ancestry live), dropdown per choice on
  the Race/Background steps, picks become features.
- Armor-aware AC (T-06): AC is derived, never stored —
  `rules/armorClass.ts` picks equipped body armor (+DEX per type cap) +
  shield, else class Unarmored Defense (`unarmoredDefense` on Character, set
  from an `unarmored-defense` feature effect; monk loses it with a shield),
  else 10+DEX; `armorClassOverride` wins outright (old notes' stored
  `armorClass` is ignored on parse). Bundles validate `armor[]`; assembly
  links gear to armor by name (`Item.armorId`) and auto-equips a sole body
  armor/shield.
- Content store (T-11): `src/data/contentStore.ts` merges the bundled SRD
  with user bundles (`<plugin dir>/data/content/*.json`, validated at load;
  invalid files skipped with a notice) by entity id, later bundles override.
  The wizard reads merged content via its `content` prop (defaults to SRD);
  settings list bundles (name/source/fetchedAt) with per-bundle toggles
  persisted in `disabledBundles`.
- Leveled class features (T-19) + proficiencies-as-data (T-20) are in: class
  JSON now uses `features: [{level, name, description, effects?}]` (scaling
  tiers share a name; the highest tier ≤ level wins), plus `proficiencies`
  {armor/weapons/tools} and scaling `resources` (the Rage table). Barbarian
  2014 + Berserker carry the full 1–20 progression; other classes are
  level-1-only until T-21. Assembly applies feature effects (Fast Movement
  speed, Primal Champion +4 with cap 24 — after the draft's cap-20 ASI math),
  copies proficiencies, and fills `Character.resources`; the Class options
  step shows the granted progression + proficiencies read-only.
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

- Tests: `npm test` works on the WSL host (Node 18); 442 tests across rules,
  schema pinning, SRD data integrity, a 234-case race×class×background
  assembly matrix (auto-grows with the bundle; auto-picks level-1 subclasses
  and feature choices), note-format round-trips, and jsdom wizard/sheet
  walkthroughs (Testing Library). Add regression tests with every feature.
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

- **Class options page design rule** (user, 2026-07-03): the Class options
  step is the class detail view — everything the class *grants* (leveled
  features, armor/weapon proficiencies) appears there read-only, and every
  class *choice* is made there. The only choices on other steps: ability
  scores/ASIs (Abilities) and skill proficiency + expertise picks (Skills).
  Proficiency/expertise picks must dedup across levels — a skill can never
  be taken or upgraded twice (enforced in featureChoiceProblems + UI).

- The user steers scope; when they ask "could we X", answer with a design
  first — they sometimes want a plan/backlog entry, not an implementation.
- Summarize what shipped at the end of every work round; unsummarized work
  gets re-requested.
- New creator features must update: content schema (+ bundle data), draft
  validation (`validateDraft`), wizard step + Next-button hints, review step,
  and the test matrix.
