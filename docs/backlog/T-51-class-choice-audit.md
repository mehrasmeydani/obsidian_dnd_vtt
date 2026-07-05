# T-51 — Class choice audit: Metamagic and other missing pickers

**Priority:** P1 · **Size:** L · **Phase:** 1 · **Depends on:** T-21

## User story
As a **sorcerer (and every other class) in the creator**, I want all
the choices my class actually grants — Metamagic options, warlock
invocations, battle master maneuvers, druid/cleric extras — to be
pickable, not just listed as feature text.

## Problem
T-21 shipped full leveled *features*, but several classes gain
*choices* at level ≥ 2 that were never modeled as `featureChoices`:
- Sorcerer: Metamagic (2 options at L3-2014/L2? — check per edition;
  more at 10/17).
- Warlock: Eldritch Invocations (T-18 noted the prerequisite problem).
- Battle Master: maneuvers; Ranger: favored enemy/terrain variants; …
- Option *text* lives in 5etools `optionalfeatures.json`, which the
  importer doesn't ingest yet — SRD subsets must be hand-authored.

## Plan (own session — L, content grind + one mechanic)
1. Audit every 2014+2024 SRD class for choose-N-options grants above
   level 1; table them in this ticket.
2. Model as leveled `featureChoices` (kind `options`) — the schema
   already supports level-gated choices; verify the wizard shows
   choices for levels ≤ starting level and dedups re-picks.
3. Prerequisites (invocations need pact/level): minimal `prereq` text
   field rendered on the card, validated manually by the player in v1;
   hard validation is a follow-up.
4. Importer follow-up: ingest `optionalfeatures.json` so imported
   classes get real option text (separate ticket if large).

## Acceptance criteria
- [ ] Audit table complete; SRD Metamagic options pickable on the
      sorcerer at the right levels in both editions.
- [ ] At least invocations/maneuvers modeled or explicitly ticketed.
- [ ] Tests + user verification.

## Status: todo
