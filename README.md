# Obsidian D&D VTT

A virtual tabletop for D&D 5e, built as an **Obsidian plugin**: editable
character sheets, notes, battle maps, and multiplayer sync for a self-hosted
group. See [docs/ROADMAP.md](docs/ROADMAP.md) for architecture and the phased plan.

> **Status:** Phase 1 in progress — the guided creation wizard (races,
> classes, backgrounds, levels, equipment) saves characters as vault notes
> and loads them back. Next: the editable sheet view.

## Content & licensing

**The plugin ships rules structure, not books.** The only game content
bundled with the plugin is from the D&D **System Reference Documents**
(SRD 5.1 for 2014 rules, SRD 5.2 for 2024 rules), which Wizards of the
Coast publishes under **CC-BY-4.0** — that's why each class ships with
exactly one subclass, and why non-SRD material (other subclasses, feats,
spells, races from the PHB/XPHB and other books) is never included.

Everything beyond the SRD reaches your vault through **your own data**:

- **"Import 5etools data"** converts JSON files *you supply* into local
  content bundles inside your own plugin folder.
- **"Refresh 5e content from Open5e"** fetches only SRD-licensed
  documents from the Open5e API.

Imported content is stored locally, is never uploaded, bundled, or
redistributed by the plugin, and is **your responsibility**: only import
material you legally own, and don't share the resulting bundle files.
The plugin authors take no responsibility for content users import.

Full details — code license (MIT), the required SRD CC-BY-4.0
attribution, and the imported-content policy — live in
[LICENSE.md](LICENSE.md).

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

### With local Node (18+)

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
