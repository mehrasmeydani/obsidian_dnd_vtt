# Obsidian D&D VTT

A virtual tabletop for D&D 5e, built as an **Obsidian plugin**: editable
character sheets, notes, battle maps, and multiplayer sync for a self-hosted
group. See [docs/ROADMAP.md](docs/ROADMAP.md) for architecture and the phased plan.

> **Status:** Phase 0 (foundations) — plugin scaffold, shared data model, and
> rules engine are in place and tested.

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
