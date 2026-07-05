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

## Audit table (2026-07-06)

Every choose-N-options grant above level 1 across the SRD classes:

| Class (edition) | Choice | Levels (count) | Disposition |
|---|---|---|---|
| Sorcerer 2014 | Metamagic | 3 (×2), 10, 17 | **shipped** — 8 SRD 5.1 options |
| Sorcerer 2024 | Metamagic | 2 (×2), 10, 17 | **shipped** — 8 SRD 5.2 options (Seeking/Transmuted are not SRD) |
| Warlock 2014 | Eldritch Invocations | 2 (×2), 5, 7, 9, 12, 15, 18 → 8 known | **shipped** — 32 SRD 5.1 options, advisory `prereq` text on cards |
| Warlock 2014 | Pact Boon | 3 | already shipped (T-21) |
| Warlock 2024 | Eldritch Invocations (pact boons are invocations) | 1, 2 (×2), 5 (×2), 7, 9, 12, 15, 18 → 10 known | **shipped** — 21 SRD 5.2 options incl. the three Pacts |
| Fighter 2014 (Champion) | Additional Fighting Style | 10 | **shipped** — same pool as the class choice, cross-deduped |
| Ranger 2014 | Favored Enemy | 6, 14 (extra picks) | **shipped** — cross-deduped with the level-1 pick |
| Ranger 2014 | Natural Explorer | 6, 10 (extra picks) | **shipped** — same |
| Fighter — Battle Master maneuvers | — | — | **not SRD** (Champion is the only SRD fighter subclass in both editions); arrives via the importer once `optionalfeatures.json` is ingested (plan step 4) |
| Bard Magical Secrets · Circle of the Land bonus cantrip · Mystic Arcanum | spell picks | various | deferred to **T-15** (spell selection) |
| 2024 classes other than barbarian/sorcerer/warlock | — | — | progressions still level-1-only; their choice audit rolls into **T-17** |

Mechanics shipped with this round:
- `prereq` advisory text on options (`FeatureOptionSchema`), rendered
  muted/italic on the card; the player validates it themselves in v1.
- Cross-choice dedup for shared pools: an option picked in one choice is
  an error if re-picked in another (`featureChoiceProblems`) and is
  *hidden* in the other groups (the T-28 pattern); an SRD integrity test
  proves every shared-pool cluster stays satisfiable.
- Raw `optionalfeatures.json` staged in `docs/reference/5etools/`
  (git-ignored) for the importer follow-up.

## Acceptance criteria
- [x] Audit table complete; SRD Metamagic options pickable on the
      sorcerer at the right levels in both editions.
- [x] At least invocations/maneuvers modeled or explicitly ticketed
      (invocations shipped in both editions; maneuvers are not SRD →
      importer follow-up).
- [x] Tests (rules dedup, SRD integrity, wizard walkthrough) — user
      verification pending.

## Status: needs-check
