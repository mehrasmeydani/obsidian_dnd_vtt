# Obsidian D&D VTT — Architecture & Roadmap

A virtual tabletop for D&D 5e, built as an **Obsidian plugin** that every participant
(DM and players) runs. Sessions sync through a **self-hosted shared server** for a
single group. 5e content is fetched from an open API and cached locally. Notes and
character sheets are real vault files.

---

## 1. Confirmed decisions

| Decision | Choice |
|---|---|
| Core form | Obsidian **plugin** (desktop; Node access available) |
| Participants | DM **and** players all run the plugin |
| Topology | Self-hosted, **single group**, shared sync server |
| 5e content | **Hybrid** — fetch from open API, cache to local store |
| Character sheet | **Full editable** 5e sheet, auto-calculated, CSS-styled |
| Map (MVP scope) | Grid + token drag, fog of war, measurement + drawing |
| Map (out of MVP) | Dynamic lighting / line-of-sight (later) |
| First slice to build | **Character sheets + notes** (local, no networking) |

---

## 2. Recommended stack

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** | Required by the Obsidian plugin API. |
| Bundler | **esbuild** | Obsidian community standard; fast, hot-reload friendly. |
| UI in views | **React**, mounted inside Obsidian `ItemView`s | Character sheet + map are complex, stateful UIs. |
| Schema/validation | **Zod** | One source of truth for the shared data format; runtime + type safety. |
| Map rendering | **Konva** (2D canvas) for MVP | Layers, draggable tokens, shapes, fog masks out of the box. Migrate to **PixiJS** (WebGL) only if perf demands it. |
| Shared data / sync | **Yjs (CRDT)** over a **y-websocket** relay | Conflict-free, offline-tolerant "shared data format." Naturally fits notes + live map state. |
| Sync server | Small **Node** `y-websocket` server, self-hosted by the DM (VPS or DM machine + tunnel) | Single-group, minimal ops. |
| 5e API source | **Open5e** (`api.open5e.com`) | Open SRD content, filterable, bulk-downloadable. Fallback: `dnd5eapi.co`. |
| Local cache | **JSON / SQLite** in the plugin data folder | Offline-capable; refreshed from API on demand. |
| Char sheet storage | Markdown note: YAML frontmatter + embedded JSON block | Human-readable, diffable, native to the vault. |

**Note on "DM vs player view":** for a trusted home group, MVP gates hidden info
(unrevealed fog, DM notes) **client-side by role**. This is not cheat-proof — a
determined player could inspect synced state. Server-authoritative visibility is a
Phase 5 hardening item.

---

## 3. Shared data model (define first)

Zod schemas + inferred TS types, versioned for migration:

- `Character` — abilities, proficiencies, skills, saves, HP, AC, inventory, spells, features, class/level/race/background.
- `Note` — id, title, body (Markdown), owner, visibility (`private` | `party` | `dm`).
- `MapScene` — background image, grid (size/offset/type), walls (future), fog mask.
- `Token` — id, sceneId, position, size, image, ownerId, linked `Character`/monster.
- `Session` (room) — id, members + roles (`dm` | `player`), active scene, dice log.
- `Envelope` — versioned wrapper for all synced docs (schema version + payload).

Derived values (modifiers, proficiency bonus, spell save DC, passive perception) are
**computed**, never stored, so the sheet can't drift.

---

## 4. Milestones & subtasks

### Phase 0 — Foundations
- [x] Scaffold plugin: `manifest.json`, `main.ts`, esbuild config, hot-reload dev loop.
- [x] Add React + mount helper for `ItemView`-hosted React roots.
- [x] Define Zod schemas / TS types for the shared data model (§3).
- [x] Base CSS design tokens (works in Obsidian light & dark themes).
- [x] Ability-math library (modifiers, prof bonus, DCs) + unit tests.

### Phase 1 — Character sheets + notes  *(MVP — build first, fully local)*
- [ ] Character note format: frontmatter + JSON block; read/write serializer.
- [x] Guided **character creation** flow (race → class → background → abilities → skills). *(Static SRD data for now; result held in memory until the serializer lands.)*
  - [x] Step-header navigation: jump directly to any completed step.

#### Character creation — completeness backlog
The wizard currently produces a bare level-1 character. Still to add, roughly
in build order (items marked *(Phase 2)* want Open5e content first):

- [ ] **Starting equipment**: class + background equipment packages and
      choices (e.g. "(a) greataxe or (b) any martial weapon"), written into
      `inventory`.
- [ ] **Armor-aware AC**: compute AC from equipped armor/shield (and monk/
      barbarian unarmored defense) instead of flat 10 + DEX.
- [ ] **Starting level selection (1–20)**: per-level HP (average or rolled),
      proficiency bonus, and ability score improvements at ASI levels.
- [ ] **Spell selection for casters** *(Phase 2)*: cantrips + spells
      known/prepared at the chosen level, from the content browser.
- [ ] **Level-1 subclass choices** *(Phase 2 for content)*: cleric domain,
      sorcerer origin, warlock patron.
- [ ] **Languages & tool proficiencies** from race/background.
- [ ] **Starting currency**: background gold, or roll class gold instead of
      taking the equipment package.
- [ ] **Flavor fields**: alignment, personality/ideals/bonds/flaws,
      appearance, backstory.
- [ ] **Variant human / feats** *(needs feat data)*.
- [ ] **Multiclassing** *(post-MVP; ties into a level-up editor, not the
      creation wizard)*.
- [ ] Editable 5e **sheet view** (React): abilities, skills, saves, HP/AC, inventory, spells, features — with live auto-calc.
- [ ] **CSS sheet renderer**: styled read mode + edit mode toggle.
- [ ] Player **notes**: session journal + linked notes, using vault Markdown; visibility field.
- [ ] Validation + graceful handling of malformed/edited notes.

### Phase 2 — 5e data (hybrid cache)
- [ ] Open5e client + typed fetch layer.
- [ ] Local cache (JSON/SQLite) with manual "refresh content" command.
- [ ] Searchable **content browser** view (spells / monsters / items) inside Obsidian.
- [ ] Wire content into character creation (populate spells, items, class features).

### Phase 3 — Sync foundation (multiplayer)
- [ ] `y-websocket` relay server + self-host docs.
- [ ] Session/room model, roles, join flow, presence ("who's online").
- [ ] Sync characters + notes across clients via Yjs; role-based visibility filter.
- [ ] Offline edit → reconnect merge behavior verified.

### Phase 4 — Battle map
- [ ] Map scene view (Konva): image upload, grid config, snap-to-grid.
- [ ] Token layer: drag, ownership, link to character/monster; sync positions.
- [ ] Measurement (ruler) + AoE templates (cone/circle/line) + freehand draw/ping.
- [ ] **Fog of war**: DM reveal brush; player view shows only revealed regions.
- [ ] DM view vs player view (role-gated layers).

### Phase 5 — Polish & hardening
- [ ] Server-authoritative fog/visibility (anti-peek).
- [ ] Dice roller + shared roll log (click a stat/attack to roll to session).
- [ ] Packaging, install guide, README; optional community-plugin submission.
- [ ] Dynamic lighting / line-of-sight (stretch).

---

## 5. Key risks / open questions to revisit
- **Sync server hosting**: DM-machine + tunnel vs. always-on VPS — decide before Phase 3.
- **Content licensing**: stay within SRD/Open5e terms; no proprietary WotC data bundled.
- **Fog secrecy**: client-side gating is MVP-acceptable for a home group; harden in Phase 5.
- **Map performance**: revisit Konva→PixiJS if large maps / many tokens stutter.
- **Mobile Obsidian**: desktop-only initially (Node server + heavy canvas); note in manifest.
