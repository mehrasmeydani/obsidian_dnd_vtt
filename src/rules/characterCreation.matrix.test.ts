import { describe, expect, it } from "vitest";
import { ABILITIES, SKILLS, type Skill } from "../model/schema";
import {
  BACKGROUNDS,
  CLASSES,
  RACES,
  type BackgroundData,
  type ClassData,
  type RaceData,
} from "../data/srd";
import { abilityModifier } from "./abilityMath";
import {
  assembleCharacter,
  emptyDraft,
  finalAbilityScores,
  grantedClassFeatures,
  validateDraft,
  type CharacterDraft,
} from "./characterCreation";

/**
 * Regression matrix: every race × class combination must produce a valid,
 * internally consistent level-1 character. This guards the rules pipeline
 * against edits to the SRD data or the assembler — if a future change breaks
 * any combination (e.g. an unsatisfiable skill choice), it fails here rather
 * than in the wizard.
 */

const ALL_SKILLS = Object.keys(SKILLS) as Skill[];
const BASE_SCORES = { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 };

/** Deterministically make the first legal pick for every choice in the draft. */
function completeDraft(
  race: RaceData,
  charClass: ClassData,
  background: BackgroundData,
): CharacterDraft {
  const granted = new Set<Skill>([
    ...(race.grantedSkills ?? []),
    ...background.grantedSkills,
  ]);

  const classPool =
    charClass.skillChoice.from === "any" ? ALL_SKILLS : charClass.skillChoice.from;
  const classSkills = classPool
    .filter((s) => !granted.has(s))
    .slice(0, charClass.skillChoice.count);

  const taken = new Set<Skill>([...granted, ...classSkills]);
  const bonusNeeded =
    (race.skillChoice?.count ?? 0) + (background.skillChoice?.count ?? 0);
  const bonusSkills = ALL_SKILLS.filter((s) => !taken.has(s)).slice(
    0,
    bonusNeeded,
  );

  const racialBonusAbilities = race.bonusChoice
    ? ABILITIES.filter((a) => !(race.fixedBonuses[a] ?? 0)).slice(
        0,
        race.bonusChoice.count,
      )
    : [];

  // Subclass owed at level 1 (cleric domain, sorcerous origin, patron).
  const subclass =
    charClass.subclasses.length > 0 && (charClass.subclassLevel ?? 99) <= 1
      ? charClass.subclasses[0]
      : null;

  // First legal pick for every feature choice active at level 1.
  const featurePicks: Record<string, string[]> = {};
  const claimed = new Set<Skill>([...taken, ...bonusSkills]);
  const expertiseClaimed = new Set<Skill>();
  const level1Choices = [
    ...charClass.featureChoices,
    ...(subclass?.featureChoices ?? []),
  ].filter((c) => c.level <= 1);
  for (const choice of level1Choices) {
    if (choice.kind === "options") {
      featurePicks[choice.id] = choice.options
        .slice(0, choice.count)
        .map((o) => o.name);
    } else if (choice.kind === "skills") {
      const pool = choice.from === "any" ? ALL_SKILLS : choice.from;
      const picks = pool
        .filter((s) => !claimed.has(s))
        .slice(0, choice.count);
      picks.forEach((s) => claimed.add(s));
      featurePicks[choice.id] = picks;
    } else {
      const picks = [...claimed]
        .filter((s) => !expertiseClaimed.has(s))
        .slice(0, choice.count);
      picks.forEach((s) => expertiseClaimed.add(s));
      featurePicks[choice.id] = picks;
    }
  }

  // First option for every race/background "pick one" (T-05).
  const firstOptions = (choices: { id: string; options: { id: string }[] }[]) =>
    Object.fromEntries(choices.map((c) => [c.id, c.options[0].id]));

  return {
    ...emptyDraft(),
    name: `${race.name} ${charClass.name}`,
    race,
    charClass,
    background,
    baseScores: { ...BASE_SCORES },
    racialBonusAbilities,
    raceOptions: firstOptions(race.optionChoices),
    backgroundOptions: firstOptions(background.optionChoices),
    classSkills,
    bonusSkills,
    equipmentChoices: charClass.equipment.choices.map(() => 0),
    subclass,
    featurePicks,
  };
}

const combos = RACES.flatMap((race) =>
  CLASSES.map((charClass) => [race.id, charClass.id, race, charClass] as const),
);

describe.each(BACKGROUNDS.map((bg) => [bg.id, bg] as const))(
  "background %s",
  (_bgId, background) => {
    it.each(combos)("%s %s assembles consistently", (_r, _c, race, charClass) => {
      const draft = completeDraft(race, charClass, background);
      expect(validateDraft(draft)).toEqual([]);

      const character = assembleCharacter(draft, "matrix-id");
      const scores = finalAbilityScores(draft);

      expect(character.abilityScores).toEqual(scores);
      expect(character.maxHp).toBe(
        Math.max(1, charClass.hitDie + abilityModifier(scores.con)),
      );
      expect(character.currentHp).toBe(character.maxHp);
      expect(character.armorClass).toBe(10 + abilityModifier(scores.dex));
      expect(character.speed).toBe(race.speed);
      expect(character.classes).toEqual([
        {
          name: charClass.name,
          level: 1,
          ...(draft.subclass ? { subclass: draft.subclass.name } : {}),
        },
      ]);
      expect(character.spellcastingAbility).toBe(charClass.spellcastingAbility);

      // Exactly the class saves are proficient.
      expect(Object.keys(character.savingThrows).sort()).toEqual(
        [...charClass.savingThrows].sort(),
      );

      // Every granted and chosen skill is proficient, with no extras;
      // expertise picks stay in the map with the upgraded level.
      const skillChoiceIds = new Set(
        [
          ...charClass.featureChoices,
          ...(draft.subclass?.featureChoices ?? []),
        ]
          .filter((c) => c.kind === "skills")
          .map((c) => c.id),
      );
      const expectedSkills = new Set<Skill>([
        ...(race.grantedSkills ?? []),
        ...background.grantedSkills,
        ...draft.classSkills,
        ...draft.bonusSkills,
        ...(Object.entries(draft.featurePicks)
          .filter(([id]) => skillChoiceIds.has(id))
          .flatMap(([, picks]) => picks) as Skill[]),
      ]);
      expect(new Set(Object.keys(character.skills))).toEqual(expectedSkills);

      // All traits and level-1 class/subclass grants arrive as features
      // (option picks included), tagged with their source.
      const optionPickCount = [
        ...charClass.featureChoices,
        ...(draft.subclass?.featureChoices ?? []),
      ]
        .filter((c) => c.kind === "options" && c.level <= 1)
        .reduce((sum, c) => sum + c.count, 0);
      expect(character.features).toHaveLength(
        race.traits.length +
          grantedClassFeatures(charClass, draft.subclass, 1).length +
          background.traits.length +
          optionPickCount +
          race.optionChoices.length +
          background.optionChoices.length,
      );

      // Class proficiencies land on the character (T-20).
      expect(character.proficiencies).toEqual(charClass.proficiencies);
      const featureIds = character.features.map((f) => f.id);
      expect(new Set(featureIds).size).toBe(featureIds.length);

      // Inventory: class fixed gear + first option of each choice + background.
      const expectedGear =
        charClass.equipment.fixed.length +
        charClass.equipment.choices.reduce(
          (sum, c) => sum + c.options[0].length,
          0,
        ) +
        background.equipment.length;
      expect(character.inventory).toHaveLength(expectedGear);
    });
  },
);
