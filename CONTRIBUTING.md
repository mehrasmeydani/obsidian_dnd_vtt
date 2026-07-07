# Contributing

## Ticketing — GitHub Issues

All work is tracked as **GitHub Issues**, not the old `docs/backlog/` files.

- **New work** → open an Issue with the **Ticket** template (user story +
  acceptance criteria). Bugs use the **Bug report** template.
- **Assign** the Issue to whoever owns it. Use the [project board]/labels to
  see what's in flight.
- `docs/ROADMAP.md` stays as the architecture + phase plan. `docs/backlog/`
  is frozen history — don't add new T-XX files.

### Labels

| Label | Meaning |
|-------|---------|
| `ticket` / `bug` | Issue type (set by template) |
| `p1`…`p4` | Priority band |
| `phase-1` … `phase-3` | Roadmap phase |
| `needs-check` | Merged + CI-green, awaiting manual Obsidian verification |
| `blocked` | Waiting on a dependency (note which Issue in a comment) |

`needs-check` replaces the old `NEEDS-CHECK.md`: filter Issues by that label to
find work awaiting your in-Obsidian confirmation, then close them once verified.

## Branch & PR workflow

1. Branch off `main`. Name it `<type>/<issue#>-<slug>`, e.g.
   `feat/57-encounter-planner`, `fix/52-equip-toggle`.
2. Commit style: imperative summary + a body explaining *why*. End the commit
   message with:
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` when pair-worked.
3. Open a PR against `main`. Fill in the template and link the Issue with
   `Closes #NN` so it auto-closes on merge.
4. **A PR into `main` requires:** the `test-and-build` CI check green **and**
   1 approving review. Direct pushes to `main` are blocked.
5. Prefer **Squash and merge** to keep `main` linear.

## Local checks before pushing

```
npm test        # full suite
npm run build   # includes tsc --noEmit
```

CI runs the same on every push and PR (`.github/workflows/ci.yml`). Keep it
green.
