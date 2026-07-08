# Backlog → GitHub Issues

Active ticketing lives in
**[GitHub Issues](https://github.com/mehrasmeydani/obsidian_dnd_vtt/issues)**.
That board is the single source of truth; this directory no longer holds
per-ticket files.

## Working the board

- **Pick work:** open issues, sorted by priority label (`p1`…`p4`). Work
  top of a priority band unless a dependency says otherwise.
- **Verification queue:** implemented-but-unverified work carries the
  `needs-check` label — the "test this in Obsidian" list is
  [`is:open label:needs-check`](https://github.com/mehrasmeydani/obsidian_dnd_vtt/issues?q=is%3Aissue+is%3Aopen+label%3Aneeds-check).
  Close the issue once you've confirmed it in the vault.
- **New work:** open an Issue with the Ticket template. Don't create new
  `T-XX` files here.

## Labels

- `p1`–`p4` — priority band.
- `phase-1` … `phase-3` — roadmap phase (see `docs/ROADMAP.md`).
- `needs-check` — implemented, green in CI, awaiting manual verification.
- `ticket` — migrated from the original backlog.

## About `T-XX`

The old backlog used `T-XX` ticket ids. They're **frozen history** —
baked into commit messages and `CLAUDE.md`'s status log, and preserved in
git history. Open issues migrated on 2026-07-07 keep their `T-XX` in the
title (e.g. *"T-16: Level-up editor"*) so old references still resolve.
**Going forward the GitHub issue number is the id** — reference it the
native way in commits (`Fixes #NN`). Don't mint new `T-XX`.

Phases 3–5 (sync server, battle map, dice/polish) stay at the milestone
level in `docs/ROADMAP.md` until they get near.
