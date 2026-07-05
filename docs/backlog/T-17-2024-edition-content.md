# T-17 — 2024 (5.5e) edition content

**Priority:** P2 · **Size:** M · **Phase:** 1–2 · **Depends on:** —

## User story
As a **player**, I want to build characters with the revised 2024 (5.5e)
rules content alongside the original 2014 rules, so that characters for
either edition of the game can be created in the same wizard.

## Acceptance criteria
- [x] Content schema carries an `edition` field ("2014" | "2024", default
      "2014"); ids stay unique across editions while names may repeat.
- [x] Wizard class cards show an edition badge so same-named entries are
      distinguishable.
- [x] Barbarian 2024: d12, STR/CON saves, same skill list, ASIs at
      4/8/12/16, A/B starting equipment (gear + 15 gp, or 75 gp), level-1
      features incl. Weapon Mastery, Berserker subclass staged.
- [x] Remaining 2024 classes (SRD 5.2) added the same way — all 11 shipped
      at **level-1 depth** (matching barbarian-2024): Bard, Cleric, Druid,
      Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard.
      Each carries edition="2024", subclassLevel 3 (all 2024 subclasses),
      one staged SRD 5.2 subclass, ASI levels (Fighter 4/6/8/12/14/16,
      Rogue 4/8/10/12/16, rest 4/8/12/16 — 19 Epic Boon omitted), Weapon
      Mastery for the martials (Fighter ×3, Paladin/Ranger/Rogue ×2),
      Fighting Style (Fighter), Divine Order (Cleric) / Primal Order (Druid)
      as options choices, Expertise (Rogue), and paraphrased (non-WotC)
      descriptions. Wired into `content/srd/index.ts`; the assembly matrix
      auto-covers all 12 × race × background at level 1. **Status
      needs-check** — see "Needs further review" below.
      **Still level-1 only** (T-21-style 2..20 progression backfill is a
      separate follow-up; the T-21 test skips edition="2024").
- [x] 2024 species/backgrounds — **built (2026-07-05).** Backgrounds carry
      ability increases (`fixedBonuses`/`bonusChoice`, applied additively
      with racial bonuses — editions mix freely) and an optional origin-feat
      pick; 2024 species carry no ability bonuses. Shipped: 5 species (Human,
      Elf, Dwarf, Halfling, Orc) and 4 backgrounds (Acolyte, Criminal, Sage,
      Soldier), plus 11 origin feats (`origin: true` on `FeatData`). Wizard:
      edition badges on race/class/background cards; origin-feat dropdown on
      the Background step; a shared `AbilityBonusPicker` for race+background
      bonus choices on the Abilities step; per-ability "+N background" label;
      step gating + review. Rules: `finalAbilityScores` sums both sources;
      `bonusChoiceProblems` + `originFeatProblems` validate. The 5etools
      importer tags race/background/feat editions and origin feats.
      **needs-check** — see review notes.
- [x] Character notes record the edition — top-level `edition:
      "2014"|"2024"` on `CharacterSchema` (additive, default "2014";
      SCHEMA_VERSION unchanged), stamped from `charClass.edition` in
      `assembleCharacter`, and projected write-only to the `edition`
      frontmatter key (`characterNote.ts`). Tests in
      `characterCreation.test.ts` + `characterNote.test.ts`.

## 2024 species/backgrounds — review notes (built 2026-07-05)
Verify in Obsidian; game-rules accuracy isn't test-covered:
- **Background ability increases** ship as fixed +1 to each of the three
  listed abilities (e.g. Acolyte +INT/+WIS/+CHA). The 2024 "+2/+1 to two of
  three" split is **not** modeled (the generic bonus shape can't express the
  asymmetric amount); a background *can* also carry a `bonusChoice`, wired
  through the shared picker, if you want a chooseable variant.
- **Free edition mixing has no guard:** a 2014 species (has bonuses) + a
  2024 background (has bonuses) stacks both — by design, but easy to do by
  accident. The Abilities step's per-line "+N racial / +N background" labels
  make it visible.
- **Origin feats** are a free pick from the whole origin-feat pool (11
  feats), not restricted to each background's canonical feat. Feat
  *effects* aren't mechanized (e.g. Tough's HP, Alert's initiative) — they
  land as descriptive features only.
- **Species traits** are descriptive only (Dwarven Toughness HP, Elf
  lineage spells, Human "Versatile" origin feat aren't mechanized). Elf
  ships with Perception as its fixed Keen Senses skill (no choice yet).
- **Background gear** uses a single flat package incl. a `Gold (gp)` item;
  the 2024 "gear package **or** gold" choice isn't modeled.
- **Importer:** 2024 background ability increases + origin feats aren't
  extracted from 5etools yet (defaults to none — see the T-17 TODO in
  `fiveEtoolsImport.ts`).

## 2024 species/backgrounds — original build plan (now implemented)
User decisions (2026-07-05):
1. **Ability scores:** generic bonuses on both race *and* background,
   applied additively. Add optional `fixedBonuses` + `bonusChoice` (the
   race shape) to `BackgroundDataSchema`; `finalAbilityScores` sums race
   and background bonuses. 2024 species carry empty `fixedBonuses`; 2024
   backgrounds carry the ability increases. Needs a parallel
   `backgroundBonusAbilities` draft field + validation mirroring the racial
   one, a Background-step picker, and a review-step line.
   - *Review:* the generic `{count, amount}` shape can't express the 2024
     "+2/+1 to two of three listed" split. Simplest faithful encoding for
     shipped SRD 5.2 backgrounds: fixed +1 to each of the three listed
     abilities (a legal choice), noting the +2/+1 option isn't modeled — or
     extend `bonusChoice` with an optional `from` restriction.
2. **Edition mixing:** allowed freely — no gating of the race/background
   lists by class edition. Mixing a 2014 race (has bonuses) with a 2024
   background (has bonuses) double-dips; accepted as the user's
   responsibility. (No validation guard.)
3. **Origin feat:** player picks from the origin-feat list on the
   Background step (not auto-granted). New choice + validation + UI; reuse
   the `FeatData` model and the T-04 "feat becomes a feature" path.
4. **Note edition:** done (top-level `Character.edition`, above).

## Needs further review (2024 class data, level-1 depth)
Tests only verify schema validity + assembly consistency, not game-rules
accuracy. Verify these in Obsidian before flipping to done:
- **Starting equipment A/B packages** — the signature gear lists and the
  flat "Gold (gp)" amounts (option B) are plausible fills, not transcribed
  from SRD 5.2. Verify contents and gp values per class.
- **Weapon Mastery counts** — Fighter 3, Paladin/Ranger/Rogue 2. Confirm
  no other 2024 class should get it and the counts are right.
- **Fighting Style option list** (Fighter) — shipped a core subset; 2024
  adds more (Blind Fighting, Interception, Thrown Weapon Fighting,
  Unarmed Fighting…). Confirm the intended list.
- **Subclass staging** — one SRD 5.2 subclass each with only its level-3
  feature(s), paraphrased (College of Lore, Life Domain, Circle of the
  Land, Champion, Warrior of the Open Hand, Oath of Devotion, Hunter,
  Thief, Draconic Sorcery, Fiend Patron, Evoker). Names/features want a
  rules pass.
- **Skill lists & saves** per class — cross-check against SRD 5.2 (some
  2024 class skill lists changed vs 2014, e.g. Cleric).
- **Druid/Monk/Rogue weapon-proficiency strings** — paraphrased ("Martial
  weapons with the Finesse or Light property") rather than an enumerated,
  machine-checkable list. Fine for display, not for future validation.
- **Warlock Eldritch Invocations** — shipped as a described feature only
  (no pick), consistent with 2014 not modeling invocations (see T-18).
- **Monk Unarmored Defense** carries the `unarmored-defense` effect (WIS,
  no shield); confirm AC derives correctly on the sheet.

## Technical notes
- Source of truth for structure: 5etools class JSON saved under
  `docs/reference/5etools/` (reference only — **not shippable**; PHB/XPHB
  text is WotC-copyrighted). Shipped descriptions must be paraphrased or
  taken from SRD 5.2 (CC-BY-4.0).
- Gold has no first-class model yet (T-07); starting-equipment gold is the
  inventory item `Gold (gp)` with a quantity for now.
- Epic Boon (level 19, 2024) is not modeled; asiLevels simply omit 19.
- 2024 Rage details (uses/day, damage scaling) live only in the trait
  description until the sheet models resources (T-01).
