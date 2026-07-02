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

  return {
    ...emptyDraft(),
    name: `${race.name} ${charClass.name}`,
    race,
    charClass,
    background,
    baseScores: { ...BASE_SCORES },
    racialBonusAbilities,
    classSkills,
    bonusSkills,
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
      expect(character.classes).toEqual([{ name: charClass.name, level: 1 }]);
      expect(character.spellcastingAbility).toBe(charClass.spellcastingAbility);

      // Exactly the class saves are proficient.
      expect(Object.keys(character.savingThrows).sort()).toEqual(
        [...charClass.savingThrows].sort(),
      );

      // Every granted and chosen skill is proficient, with no extras.
      const expectedSkills = new Set<Skill>([
        ...(race.grantedSkills ?? []),
        ...background.grantedSkills,
        ...draft.classSkills,
        ...draft.bonusSkills,
      ]);
      expect(new Set(Object.keys(character.skills))).toEqual(expectedSkills);

      // All traits arrive as features, tagged with their source.
      expect(character.features).toHaveLength(
        race.traits.length + charClass.traits.length + background.traits.length,
      );
      const featureIds = character.features.map((f) => f.id);
      expect(new Set(featureIds).size).toBe(featureIds.length);
    });
  },
);
