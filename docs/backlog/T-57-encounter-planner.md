# T-57 — Encounter planner (future phase)

**Priority:** P3 · **Size:** XL · **Phase:** 3+ · **Depends on:** T-14, imported bestiary

## User story
As a **DM**, I want to plan encounters inside Obsidian: pick monsters
from the imported bestiary, balance them against my party's levels, and
save the encounter as a note I can run at the table.

## Why now (as a ticket)
The importer now ingests full bestiaries (`monster` arrays — 953 stat
blocks from MM+XMM against the reference data), so the data layer for
this exists. The feature itself belongs with the Phase 3+ battle-map
track (`docs/ROADMAP.md`) — this ticket parks the design so it's not
lost.

## Sketch (own session(s) — XL, break down before starting)
1. **Monster browser** — the T-14 content browser grown a bestiary tab
   (search by name/CR/type; stat-block detail view).
2. **Encounter note** — a `dnd-vtt: encounter` note type: monster list
   with counts, party reference (campaign Pc folder), notes; prose
   preserved like character notes.
3. **Balance math** — XP thresholds by party level (2014 DMG table)
   and/or 2024 XP budgets; encounter difficulty readout as you add
   monsters.
4. **Run mode (later, battle-map adjacent)** — initiative order, per-
   monster HP tracking, conditions; feeds the Phase 4 battle map.

## Open design questions
- 2014 vs 2024 encounter-building math (they differ; probably follow
  the note's campaign edition).
- Where run-state lives (in the encounter note vs ephemeral).

## Acceptance criteria (v1)
- [ ] Browse imported monsters; add to an encounter note with counts.
- [ ] Difficulty estimate vs a party (levels entered or read from the
      campaign's Pc folder).
- [ ] Encounter notes round-trip like character notes.

## Status: todo
