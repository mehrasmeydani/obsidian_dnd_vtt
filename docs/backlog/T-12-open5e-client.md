# T-12 — Open5e client + refresh command

**Priority:** P2 · **Size:** M · **Phase:** 2 · **Depends on:** T-11

## User story
As a **user**, I want a "Refresh 5e content" command that downloads SRD
content (spells, monsters, items) from Open5e once and caches it locally, so
that the API is only called when I ask — never on startup — and everything
works offline afterwards.

## Acceptance criteria
- [ ] Typed Open5e client (paginated fetch) for spells, monsters, and items;
      responses transformed into content-bundle JSON (schema extended with
      those categories) and written to the content store.
- [ ] Manual command with progress notice; per-category `fetchedAt` recorded;
      re-running replaces the cached bundle.
- [ ] Zero network calls outside the explicit refresh.
- [ ] Transform functions are pure and unit-tested against recorded API
      fixtures (no live API in tests).

## Technical notes
- `requestUrl` from the Obsidian API avoids CORS issues.
- Extending `contentSchema.ts` with spell/monster/item schemas is the bulk of
  the design work — shape them to serve T-14 (browser) and T-15 (spell picks).
