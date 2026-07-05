# T-44 — Content fold: deeper data must win over staged SRD stubs

**Priority:** P1 · **Size:** M · **Phase:** 2 · **Depends on:** T-17, T-43

## User story
As a **user with a full 5etools import**, I want the wizard's 2024 class
cards to show the complete class and subclass progressions from my import
instead of the SRD's staged level-1 stand-ins, so that a 2024 Berserker
(or any 2024 character above level 1) isn't missing its features.

## Problem (verified 2026-07-05, via ContentStore + reference import)
The same-name/same-edition class fold (T-43 round) has two precedence
holes that hit **all 12** 2024 SRD cards:

1. **Subclass name ties: "existing card wins" blocks the import.** The
   12 staged SRD 5.2 subclasses each carry one level-3 feature, so they
   beat their fully-featured imported counterparts by name:
   `Path of the Berserker` shows `3:Frenzy` while the imported XPHB
   Berserker (features to L14) is discarded. Same for College of Lore,
   Life Domain, Circle of the Land, Champion, Warrior of the Open Hand,
   Oath of Devotion, Hunter, Thief, Draconic Sorcery, Fiend Patron,
   Evoker. (2014 cards are unaffected — SRD 5.1 subclasses carry full
   T-21 progressions.)
2. **Class features are never folded.** Every 2024 SRD class is
   level-1-depth (T-17 shipped them that way; backfill was deferred);
   the imported XPHB classes carry full 1–20 features. The fold only
   merges subclasses, so a level-5 2024 Barbarian has no L2+ class
   features even with a complete import installed.

## Acceptance criteria
- [ ] Subclass name tie in the fold: keep the *deeper* record (higher max
      feature level); the existing card still wins true ties, preserving
      SRD curation where SRD data is complete (2014).
- [ ] Class-feature fold: when the base card's features stop at level 1
      and the incoming same-name/same-edition class carries a deeper
      progression, adopt the incoming feature list — but **preserve SRD
      feature effects** by re-attaching effects from same-named SRD
      features (Unarmored Defense's `unarmored-defense` effect drives AC;
      losing it would break derived stats).
- [ ] Never adopt incoming `featureChoices`/equipment/proficiencies/
      resources wholesale — the SRD card keeps those (imports don't
      model choices; the Weapon Mastery / Divine Order pickers must
      survive).
- [ ] Regression tests: a shallow-SRD + deep-import fold produces a deep
      card with SRD effects and choices intact; a deep-SRD (2014) card is
      unchanged by an import.
- [ ] User verifies in Obsidian: 2024 Berserker shows 3/6/10/14 features;
      a level-5 2024 Barbarian gets its full class progression.

## Non-goals / alternatives considered
- **Wholesale replace SRD card with the import** — rejected: imports have
  no feature effects, no featureChoices (loses the Weapon Mastery/Divine
  Order/Fighting Style pickers), and weaker equipment data.
- **The real long-term fix is finishing the T-17 backfill** (hand-author
  the full SRD 5.2 progressions): once the SRD cards are deep, the
  depth rule naturally keeps preferring them, and users without imports
  get full progressions too. This ticket is the merge-rule fix so
  imports work correctly *now* and as a permanent guard for any shallow
  bundle entry.

## Status: todo
