# Obsidian D&D VTT

A virtual tabletop for D&D 5e, built as an **Obsidian plugin**: editable
character sheets, notes, battle maps, and multiplayer sync for a self-hosted
group. See [docs/ROADMAP.md](docs/ROADMAP.md) for architecture and the phased plan.

> **Status:** Phase 1 in progress — foundations plus the guided character
> creation wizard are in place. Created characters live in memory until the
> character-note serializer lands.

## Developing

You can build with a local Node toolchain **or** with Docker (no local Node
needed). Docker is the cross-platform path.

### With Docker (recommended, no local Node)

```bash
docker compose run --rm install  # populate node_modules (also gives the IDE types)
docker compose run --rm test     # run the vitest suite
docker compose run --rm build    # write a production main.js into the repo
docker compose up dev            # esbuild watch loop (rebuilds main.js on save)
```

The repo (including `node_modules`) is bind-mounted, so dependencies and
`main.js` land on the host next to `manifest.json` — the IDE gets IntelliSense
and the bundle is ready to load into a vault.

> **Keep this repo on a native filesystem** (a Linux path under WSL, or a plain
> Windows path) rather than a OneDrive-synced folder. OneDrive syncs
> `node_modules`, and under WSL files on `/mnt/c/...` don't deliver inotify
> events, so esbuild's watch (`up dev`) won't fire.

### With local Node (20+)

```bash
npm install
npm test
npm run dev      # watch build
npm run build    # production bundle
```

### Testing

Tests are colocated with the code (`src/**/*.test.ts(x)`) and run with vitest
(`docker compose run --rm test` or `npm test`). Four layers guard against
regressions:

- **Rules math** (`rules/*.test.ts`) — modifiers, proficiency, DCs, and the
  creation-draft logic (point buy, racial bonuses, skill validation).
- **Data contract** (`model/schema.test.ts`) — the Zod schemas that validate
  vault notes and sync payloads; `SCHEMA_VERSION` changes are pinned.
- **Content integrity** (`data/srd.test.ts`) — the static SRD data stays
  internally consistent (unique ids, satisfiable skill choices, sane dice).
- **Matrix + UI** (`characterCreation.matrix.test.ts`, `ui/*.test.tsx`) —
  every race×class×background combination assembles a consistent character,
  and the wizard is driven end to end in jsdom via Testing Library.

CI (`.github/workflows/ci.yml`) runs the suite plus typecheck and a production
build on every push and PR.

### What Docker does *not* run

The plugin UI (sheets, maps) runs inside the **Obsidian desktop app**, not in a
container — Docker here only builds and tests the bundle. The Phase 3 sync
server *will* get its own runtime image for easy self-hosting.

## Loading into Obsidian

Copy (or symlink) `main.js`, `manifest.json`, and `styles.css` into:

```
<your-vault>/.obsidian/plugins/obsidian-dnd-vtt/
```

Enable **D&D VTT** in Settings → Community plugins, then use the ribbon scroll
icon or the "Open character sheet" command.
