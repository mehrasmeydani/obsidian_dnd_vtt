import {
  ABILITIES,
  CharacterSchema,
  type Ability,
  type AbilityScores,
  type Character,
  type Feature,
  type Item,
  type ProficiencyLevel,
  type Skill,
} from "../model/schema";
import type {
  BackgroundData,
  ClassData,
  EquipmentItem,
  RaceData,
  Trait,
} from "../data/srd";
import { abilityModifier } from "./abilityMath";

/**
 * Pure logic for the guided character creation flow. The wizard UI builds a
 * `CharacterDraft` step by step; everything here validates the draft and turns
 * it into a schema-valid level-1 `Character`. No Obsidian or React imports so
 * it stays unit-testable.
 */

/** The PHB standard array for ability scores. */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

const POINT_BUY_COSTS: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

/** Point-buy cost of a single score, or null when the score is out of range. */
export function pointBuyCost(score: number): number | null {
  return POINT_BUY_COSTS[score] ?? null;
}

/** Total point-buy cost of a score set, or null if any score is out of range. */
export function pointBuyTotal(scores: AbilityScores): number | null {
  let total = 0;
  for (const ability of ABILITIES) {
    const cost = pointBuyCost(scores[ability]);
    if (cost === null) return null;
    total += cost;
  }
  return total;
}

/** Ability scores cannot be raised above this by ASIs (5e rule). */
export const ABILITY_SCORE_CAP = 20;

export const MAX_LEVEL = 20;

/** Everything the wizard collects before a character exists. */
export interface CharacterDraft {
  name: string;
  race: RaceData | null;
  charClass: ClassData | null;
  background: BackgroundData | null;
  /** Overrides the background name when the background allows it. */
  backgroundName: string;
  /** Starting level, 1-20. */
  level: number;
  /** Scores before racial bonuses. */
  baseScores: AbilityScores;
  /** Abilities picked for the race's "+N to X abilities of your choice". */
  racialBonusAbilities: Ability[];
  /** +1s from Ability Score Improvements (2 points per ASI level reached). */
  asiBonuses: Partial<Record<Ability, number>>;
  /** Skills picked from the class list. */
  classSkills: Skill[];
  /** Skills picked from "choose any" pools (race and/or background). */
  bonusSkills: Skill[];
  /** Chosen option index for each of the class's equipment choices. */
  equipmentChoices: number[];
}

export function emptyDraft(): CharacterDraft {
  return {
    name: "",
    race: null,
    charClass: null,
    background: null,
    backgroundName: "",
    level: 1,
    baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    racialBonusAbilities: [],
    asiBonuses: {},
    classSkills: [],
    bonusSkills: [],
    equipmentChoices: [],
  };
}

/** Number of Ability Score Improvements the class has gained by `level`. */
export function asiCount(charClass: ClassData, level: number): number {
  return charClass.asiLevels.filter((l) => l <= level).length;
}

/** Total +1 points the draft's ASIs grant (two per improvement). */
export function asiPointsTotal(draft: CharacterDraft): number {
  return draft.charClass ? 2 * asiCount(draft.charClass, draft.level) : 0;
}

/** +1 points already assigned to abilities. */
export function asiPointsSpent(draft: CharacterDraft): number {
  return ABILITIES.reduce((sum, a) => sum + (draft.asiBonuses[a] ?? 0), 0);
}

/**
 * Max HP at `level`: full hit die at level 1, average (die/2 + 1) per level
 * after, CON modifier each level, minimum 1 per level. Rolled HP is a future
 * option (see roadmap backlog).
 */
export function startingHp(hitDie: number, conMod: number, level: number): number {
  let hp = Math.max(1, hitDie + conMod);
  for (let l = 2; l <= level; l++) {
    hp += Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
  }
  return hp;
}

/** Base scores plus racial bonuses (fixed and chosen) plus ASI points. */
export function finalAbilityScores(draft: CharacterDraft): AbilityScores {
  const scores = { ...draft.baseScores };
  if (draft.race) {
    for (const ability of ABILITIES) {
      scores[ability] += draft.race.fixedBonuses[ability] ?? 0;
    }
    const amount = draft.race.bonusChoice?.amount ?? 0;
    for (const ability of draft.racialBonusAbilities) {
      scores[ability] += amount;
    }
  }
  for (const ability of ABILITIES) {
    scores[ability] += draft.asiBonuses[ability] ?? 0;
  }
  return scores;
}

/** Skills granted outright by the chosen race and background. */
export function grantedSkills(draft: CharacterDraft): Skill[] {
  return [
    ...(draft.race?.grantedSkills ?? []),
    ...(draft.background?.grantedSkills ?? []),
  ];
}

/** How many "choose any skill" picks the draft owes (race + background). */
export function bonusSkillCount(draft: CharacterDraft): number {
  return (
    (draft.race?.skillChoice?.count ?? 0) +
    (draft.background?.skillChoice?.count ?? 0)
  );
}

/**
 * All problems with the draft, as human-readable messages. An empty array
 * means `assembleCharacter` will succeed.
 */
export function validateDraft(draft: CharacterDraft): string[] {
  const errors: string[] = [];

  if (!draft.name.trim()) errors.push("Character needs a name.");
  if (!draft.race) errors.push("Choose a race.");
  if (!draft.charClass) errors.push("Choose a class.");
  if (!draft.background) errors.push("Choose a background.");

  if (
    !Number.isInteger(draft.level) ||
    draft.level < 1 ||
    draft.level > MAX_LEVEL
  ) {
    errors.push(`Level must be between 1 and ${MAX_LEVEL}.`);
  }

  for (const ability of ABILITIES) {
    const score = draft.baseScores[ability];
    if (!Number.isInteger(score) || score < 1 || score > 30) {
      errors.push(`${ability.toUpperCase()} must be between 1 and 30.`);
    }
  }

  if (draft.race?.bonusChoice) {
    const { count } = draft.race.bonusChoice;
    const picks = draft.racialBonusAbilities;
    if (picks.length !== count) {
      errors.push(`Pick ${count} abilities for the racial bonus.`);
    }
    if (new Set(picks).size !== picks.length) {
      errors.push("Racial bonus abilities must be different.");
    }
    if (picks.some((a) => (draft.race?.fixedBonuses[a] ?? 0) > 0)) {
      errors.push(
        "Racial bonus abilities must differ from the fixed racial bonuses.",
      );
    }
  } else if (draft.racialBonusAbilities.length > 0) {
    errors.push("This race has no ability bonus choice.");
  }

  if (draft.charClass) {
    const total = asiPointsTotal(draft);
    const spent = asiPointsSpent(draft);
    if (spent !== total) {
      errors.push(`Assign exactly ${total} ability score improvement points.`);
    }
    const finals = finalAbilityScores(draft);
    for (const ability of ABILITIES) {
      const points = draft.asiBonuses[ability] ?? 0;
      if (points < 0 || !Number.isInteger(points)) {
        errors.push("Ability score improvements must be whole, positive points.");
        break;
      }
      if (points > 0 && finals[ability] > ABILITY_SCORE_CAP) {
        errors.push(
          `Improvements cannot raise a score above ${ABILITY_SCORE_CAP}.`,
        );
        break;
      }
    }
  } else if (asiPointsSpent(draft) > 0) {
    errors.push("Choose a class before assigning improvement points.");
  }

  if (draft.charClass) {
    const choices = draft.charClass.equipment.choices;
    const valid =
      draft.equipmentChoices.length === choices.length &&
      draft.equipmentChoices.every(
        (pick, i) =>
          Number.isInteger(pick) && pick >= 0 && pick < choices[i].options.length,
      );
    if (!valid) errors.push("Choose your starting equipment.");
  }

  const granted = new Set(grantedSkills(draft));

  if (draft.charClass) {
    const { count, from } = draft.charClass.skillChoice;
    if (draft.classSkills.length !== count) {
      errors.push(`Choose ${count} class skills.`);
    }
    if (from !== "any") {
      const allowed = new Set(from);
      if (draft.classSkills.some((s) => !allowed.has(s))) {
        errors.push("A chosen class skill is not on the class list.");
      }
    }
  }

  const needed = bonusSkillCount(draft);
  if (draft.bonusSkills.length !== needed) {
    errors.push(
      needed > 0
        ? `Choose ${needed} additional skills.`
        : "No additional skill picks are available.",
    );
  }

  const chosen = [...draft.classSkills, ...draft.bonusSkills];
  if (new Set(chosen).size !== chosen.length) {
    errors.push("Each skill can only be chosen once.");
  }
  if (chosen.some((s) => granted.has(s))) {
    errors.push("A chosen skill is already granted by race or background.");
  }

  return errors;
}

/**
 * Build the final level-1 character from a complete draft. Throws when the
 * draft is invalid — call `validateDraft` first to surface errors in the UI.
 */
export function assembleCharacter(draft: CharacterDraft, id: string): Character {
  const errors = validateDraft(draft);
  if (errors.length > 0) {
    throw new Error(`Invalid character draft: ${errors.join(" ")}`);
  }
  // validateDraft guarantees these are set.
  const race = draft.race as RaceData;
  const charClass = draft.charClass as ClassData;
  const background = draft.background as BackgroundData;

  const abilityScores = finalAbilityScores(draft);
  const maxHp = startingHp(
    charClass.hitDie,
    abilityModifier(abilityScores.con),
    draft.level,
  );

  const savingThrows: Partial<Record<Ability, ProficiencyLevel>> = {};
  for (const ability of charClass.savingThrows) {
    savingThrows[ability] = "proficient";
  }

  const skills: Partial<Record<Skill, ProficiencyLevel>> = {};
  for (const skill of [
    ...grantedSkills(draft),
    ...draft.classSkills,
    ...draft.bonusSkills,
  ]) {
    skills[skill] = "proficient";
  }

  const backgroundName =
    background.customName && draft.backgroundName.trim()
      ? draft.backgroundName.trim()
      : background.name;

  // Racial traits, class features, and background features all become
  // Character.features, tagged with their source. Phase 2 swaps the static
  // SRD traits for Open5e content without touching this shape.
  const features = [
    ...traitsToFeatures(race.name, race.traits),
    ...traitsToFeatures(charClass.name, charClass.traits),
    ...traitsToFeatures(backgroundName, background.traits),
  ];

  // Class fixed gear + the chosen option from each choice + background gear.
  const inventory: Item[] = [];
  const addGear = (items: EquipmentItem[]) => {
    for (const item of items) {
      inventory.push({
        id: `${slugify(item.name)}-${inventory.length}`,
        name: item.name,
        quantity: item.quantity ?? 1,
        equipped: false,
      });
    }
  };
  addGear(charClass.equipment.fixed);
  charClass.equipment.choices.forEach((choice, i) => {
    addGear(choice.options[draft.equipmentChoices[i]]);
  });
  addGear(background.equipment);

  return CharacterSchema.parse({
    id,
    name: draft.name.trim(),
    race: race.name,
    background: backgroundName,
    classes: [{ name: charClass.name, level: draft.level }],
    abilityScores,
    savingThrows,
    skills,
    maxHp,
    currentHp: maxHp,
    armorClass: 10 + abilityModifier(abilityScores.dex),
    speed: race.speed,
    spellcastingAbility: charClass.spellcastingAbility,
    features,
    inventory,
  });
}

function traitsToFeatures(source: string, traits: Trait[]): Feature[] {
  return traits.map((trait) => ({
    id: `${slugify(source)}-${slugify(trait.name)}`,
    name: trait.name,
    source,
    description: trait.description,
  }));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
