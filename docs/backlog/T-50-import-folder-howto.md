# T-50 — Importer: friendly how-to when the 5etools folder is missing

**Priority:** P3 · **Size:** XS · **Phase:** 2 · **Depends on:** T-13

## User story
As a **user running "Import 5etools data" with no data in place**, I
want the notice to tell me what to do (create the folder named in
settings, drop my own 5etools JSON files there) instead of just
failing quietly.

## Notes
- Legal guardrail: the how-to explains the *mechanics* (folder name,
  JSON files, where the setting lives) only — it must not link to or
  instruct obtaining WotC-copyrighted data; users supply their own
  files (see LICENSE.md import policy).

## Acceptance criteria
- [ ] Missing/empty import folder → notice with folder path + one-line
      instructions; no external links.
- [ ] User verifies in Obsidian.

## Status: todo
