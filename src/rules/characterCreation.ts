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
import {
  ARMOR,
  type BackgroundData,
  type ClassData,
  type ClassFeature,
  type EquipmentItem,
  type FeatData,
  type FeatureChoice,
  type RaceData,
  type SubclassData,
  type Trait,
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
  /** Abilities picked for the background's "+N to X abilities" (2024). */
  backgroundBonusAbilities: Ability[];
  /** Origin feat chosen for a 2024 background (null until picked). */
  originFeat: FeatData | null;
  /** +1s from Ability Score Improvements (2 points per ASI level reached). */
  asiBonuses: Partial<Record<Ability, number>>;
  /**
   * ASI levels spent on a feat instead of points, keyed by the ASI level
   * (4/8/… per class). `null` marks a level flipped to "feat" with no feat
   * picked yet — a validation error until resolved. Each feat spent removes
   * that level's 2 points from the pool.
   */
  asiFeats: Record<number, FeatData | null>;
  /** Race "pick one" answers, choiceId → optionId (Draconic Ancestry…). */
  raceOptions: Record<string, string>;
  /** Background "pick one" answers, choiceId → optionId. */
  backgroundOptions: Record<string, string>;
  /** Skills picked from the class list. */
  classSkills: Skill[];
  /** Skills picked from "choose any" pools (race and/or background). */
  bonusSkills: Skill[];
  /** Chosen option index for each of the class's equipment choices. */
  equipmentChoices: number[];
  /**
   * How max HP is determined (T-07): the fixed average (default) or dice
   * rolled per level above 1st (level 1 is always the full hit die).
   */
  hpMode: "average" | "rolled";
  /** Hit-die results for levels 2..level when `hpMode` is "rolled". */
  hpRolls: number[];
  /**
   * Class equipment package (default) or the class's starting-gold roll
   * instead (T-07) — gold replaces the class package, its choices, and the
   * background gear, matching the "buy your own gear" rule.
   */
  equipmentMode: "package" | "gold";
  /** The rolled gold total when `equipmentMode` is "gold". */
  goldRoll: number | null;
  /** Chosen subclass, once `level >= charClass.subclassLevel`. */
  subclass: SubclassData | null;
  /**
   * Picks per feature choice, keyed by the choice's id. Values are option
   * names for "options" choices and skill ids for "skills"/"expertise".
   */
  featurePicks: Record<string, string[]>;
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
    backgroundBonusAbilities: [],
    originFeat: null,
    asiBonuses: {},
    asiFeats: {},
    raceOptions: {},
    backgroundOptions: {},
    classSkills: [],
    bonusSkills: [],
    equipmentChoices: [],
    hpMode: "average",
    hpRolls: [],
    equipmentMode: "package",
    goldRoll: null,
    subclass: null,
    featurePicks: {},
  };
}

/** Whether the draft's class and level call for a subclass pick. */
export function subclassRequired(draft: CharacterDraft): boolean {
  return (
    !!draft.charClass &&
    draft.charClass.subclasses.length > 0 &&
    draft.charClass.subclassLevel !== undefined &&
    draft.level >= draft.charClass.subclassLevel
  );
}

/**
 * Feature choices the draft owes at its level: the class's own, plus the
 * chosen subclass's once the subclass applies.
 */
export function activeFeatureChoices(draft: CharacterDraft): FeatureChoice[] {
  if (!draft.charClass) return [];
  const owed = draft.charClass.featureChoices.filter(
    (c) => c.level <= draft.level,
  );
  if (subclassRequired(draft) && draft.subclass) {
    owed.push(
      ...draft.subclass.featureChoices.filter((c) => c.level <= draft.level),
    );
  }
  return owed;
}

/** A granted class/subclass feature tagged with who grants it. */
export interface GrantedFeature {
  source: string;
  feature: ClassFeature;
}

/**
 * Every class and subclass feature granted at `level`, in level order.
 * Same-named entries are tiers of one scaling feature (Brutal Critical at
 * 9/13/17): only the highest tier with `level <= level` survives.
 */
export function grantedClassFeatures(
  charClass: ClassData,
  subclass: SubclassData | null,
  level: number,
): GrantedFeature[] {
  const all: GrantedFeature[] = [
    ...charClass.features.map((feature) => ({ source: charClass.name, feature })),
    ...(subclass
      ? subclass.features.map((feature) => ({ source: subclass.name, feature }))
      : []),
  ].filter((g) => g.feature.level <= level);

  // Tier collapse: keep only the highest tier per source+name.
  const byKey = new Map<string, GrantedFeature>();
  for (const granted of all) {
    const key = `${granted.source} ${granted.feature.name}`;
    const existing = byKey.get(key);
    if (!existing || existing.feature.level <= granted.feature.level) {
      byKey.set(key, granted);
    }
  }
  return [...byKey.values()].sort((a, b) => a.feature.level - b.feature.level);
}

/** Skills picked through "skills"-kind feature choices. */
export function featureSkillPicks(draft: CharacterDraft): Skill[] {
  return activeFeatureChoices(draft)
    .filter((c) => c.kind === "skills")
    .flatMap((c) => (draft.featurePicks[c.id] ?? []) as Skill[]);
}

/** Every skill the draft is proficient in — the pool expertise picks from. */
export function draftProficientSkills(draft: CharacterDraft): Skill[] {
  return [
    ...grantedSkills(draft),
    ...draft.classSkills,
    ...draft.bonusSkills,
    ...featureSkillPicks(draft),
  ];
}

/**
 * Drop expertise picks whose underlying skill proficiency is gone (T-37):
 * unchecking a proficient skill must release its expertise pick, otherwise
 * the draft carries a stale, invisible pick that fails validation with no
 * way to clear it from the UI. Returns the same draft when nothing changed.
 */
export function pruneStaleExpertise(draft: CharacterDraft): CharacterDraft {
  const proficient = new Set<string>(draftProficientSkills(draft));
  let changed = false;
  const featurePicks = { ...draft.featurePicks };
  for (const choice of activeFeatureChoices(draft)) {
    if (choice.kind !== "expertise") continue;
    const picks = featurePicks[choice.id] ?? [];
    const kept = picks.filter((skill) => proficient.has(skill));
    if (kept.length !== picks.length) {
      featurePicks[choice.id] = kept;
      changed = true;
    }
  }
  return changed ? { ...draft, featurePicks } : draft;
}

/** Number of Ability Score Improvements the class has gained by `level`. */
export function asiCount(charClass: ClassData, level: number): number {
  return earnedAsiLevels(charClass, level).length;
}

/** The ASI levels the class has reached by `level` (barbarian 8: [4, 8]). */
export function earnedAsiLevels(charClass: ClassData, level: number): number[] {
  return charClass.asiLevels.filter((l) => l <= level);
}

/**
 * Total +1 points the draft's ASIs grant: two per improvement, minus the
 * improvements spent on a feat instead (T-04) — a level flipped to "feat"
 * costs its points even before the feat is picked.
 */
export function asiPointsTotal(draft: CharacterDraft): number {
  if (!draft.charClass) return 0;
  const improvements = asiCount(draft.charClass, draft.level);
  const featSpends = Object.keys(draft.asiFeats).length;
  return 2 * Math.max(0, improvements - featSpends);
}

/** +1 points already assigned to abilities. */
export function asiPointsSpent(draft: CharacterDraft): number {
  return ABILITIES.reduce((sum, a) => sum + (draft.asiBonuses[a] ?? 0), 0);
}

/**
 * Max HP at `level`: full hit die at level 1 always; levels after add the
 * average (die/2 + 1) — or, when `rolls` is given (T-07 rolled mode), the
 * rolled die result per level. CON modifier applies each level, minimum 1
 * per level.
 */
export function startingHp(
  hitDie: number,
  conMod: number,
  level: number,
  rolls?: number[],
): number {
  let hp = Math.max(1, hitDie + conMod);
  for (let l = 2; l <= level; l++) {
    const die = rolls ? rolls[l - 2] : Math.floor(hitDie / 2) + 1;
    hp += Math.max(1, die + conMod);
  }
  return hp;
}

/** The number of hit-die rolls a rolled-HP draft owes (levels 2..level). */
export function hpRollsNeeded(level: number): number {
  return Math.max(0, level - 1);
}

/**
 * Everything wrong with the draft's HP mode (T-07), shared by
 * `validateDraft` and the Abilities step's gating.
 */
export function hpProblems(draft: CharacterDraft): string[] {
  if (draft.hpMode !== "rolled") {
    return draft.hpRolls.length > 0
      ? ["Hit point rolls are set but the HP mode is average."]
      : [];
  }
  if (!draft.charClass) return ["Choose a class before rolling hit points."];
  const needed = hpRollsNeeded(draft.level);
  if (draft.hpRolls.length !== needed) {
    return [`Roll your hit points (${needed} roll${needed === 1 ? "" : "s"} needed).`];
  }
  const hitDie = draft.charClass.hitDie;
  if (
    draft.hpRolls.some(
      (roll) => !Number.isInteger(roll) || roll < 1 || roll > hitDie,
    )
  ) {
    return [`Hit point rolls must be between 1 and ${hitDie}.`];
  }
  return [];
}

/**
 * Everything wrong with the draft's equipment mode (T-07), shared by
 * `validateDraft` and the Equipment step's gating.
 */
export function goldProblems(draft: CharacterDraft): string[] {
  if (draft.equipmentMode !== "gold") return [];
  if (!draft.charClass) return ["Choose a class before taking starting gold."];
  const formula = draft.charClass.startingGold;
  if (!formula) {
    return [`${draft.charClass.name} has no starting-gold option.`];
  }
  const min = formula.count * formula.multiplier;
  const max = formula.count * formula.sides * formula.multiplier;
  if (
    draft.goldRoll === null ||
    !Number.isInteger(draft.goldRoll) ||
    draft.goldRoll < min ||
    draft.goldRoll > max
  ) {
    return ["Roll your starting gold."];
  }
  return [];
}

/**
 * Base scores plus racial and background bonuses (fixed and chosen) plus
 * ASI points. Race and background increases stack (2024 puts bumps on the
 * background; editions mix freely, so both are applied — user decision).
 */
export function finalAbilityScores(draft: CharacterDraft): AbilityScores {
  const scores = { ...draft.baseScores };
  const applyBonuses = (
    fixedBonuses: Partial<Record<Ability, number>> | undefined,
    bonusAmount: number,
    chosen: Ability[],
  ) => {
    for (const ability of ABILITIES) {
      scores[ability] += fixedBonuses?.[ability] ?? 0;
    }
    for (const ability of chosen) {
      scores[ability] += bonusAmount;
    }
  };
  if (draft.race) {
    applyBonuses(
      draft.race.fixedBonuses,
      draft.race.bonusChoice?.amount ?? 0,
      draft.racialBonusAbilities,
    );
  }
  if (draft.background) {
    applyBonuses(
      draft.background.fixedBonuses,
      draft.background.bonusChoice?.amount ?? 0,
      draft.backgroundBonusAbilities,
    );
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
 * Problems with a "+N to M abilities of your choice" pick, shared by the
 * race and background ability bonuses (2024 puts them on the background).
 * `adjective` qualifies the bonus in messages ("racial" / "background");
 * the entity noun ("race" / "background") is derived from it.
 */
export function bonusChoiceProblems(
  entity: {
    bonusChoice?: { count: number; amount: number };
    fixedBonuses: Partial<Record<Ability, number>>;
  } | null,
  picks: Ability[],
  adjective: "racial" | "background",
): string[] {
  const errors: string[] = [];
  if (entity?.bonusChoice) {
    const { count } = entity.bonusChoice;
    if (picks.length !== count) {
      errors.push(`Pick ${count} abilities for the ${adjective} bonus.`);
    }
    if (new Set(picks).size !== picks.length) {
      errors.push(`${capitalize(adjective)} bonus abilities must be different.`);
    }
    if (picks.some((a) => (entity.fixedBonuses[a] ?? 0) > 0)) {
      errors.push(
        `${capitalize(adjective)} bonus abilities must differ from the fixed ${adjective} bonuses.`,
      );
    }
  } else if (picks.length > 0) {
    const noun = adjective === "racial" ? "race" : "background";
    errors.push(`This ${noun} has no ability bonus choice.`);
  }
  return errors;
}

/**
 * Problems with the 2024 origin feat a background may grant (T-17). The pick
 * must come from the origin-feat pool, and no feat may be taken twice (an
 * origin feat can't also be an ASI feat).
 */
export function originFeatProblems(draft: CharacterDraft): string[] {
  const errors: string[] = [];
  const wanted = draft.background?.originFeat ?? false;
  if (wanted && !draft.originFeat) {
    errors.push("Choose an origin feat for your background.");
  }
  if (!wanted && draft.originFeat) {
    errors.push("This background does not grant an origin feat.");
  }
  if (draft.originFeat && draft.originFeat.origin !== true) {
    errors.push("The origin feat pick is not an origin feat.");
  }
  if (draft.originFeat) {
    const asiFeatIds = Object.values(draft.asiFeats)
      .filter((f): f is FeatData => f !== null)
      .map((f) => f.id);
    if (asiFeatIds.includes(draft.originFeat.id)) {
      errors.push("Each feat can only be taken once.");
    }
  }
  return errors;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
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

  errors.push(
    ...bonusChoiceProblems(draft.race, draft.racialBonusAbilities, "racial"),
  );
  errors.push(
    ...bonusChoiceProblems(
      draft.background,
      draft.backgroundBonusAbilities,
      "background",
    ),
  );
  errors.push(...originFeatProblems(draft));

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
  } else if (Object.keys(draft.asiFeats).length > 0) {
    errors.push("Choose a class before spending improvements on feats.");
  }

  errors.push(...featProblems(draft));

  if (draft.charClass && draft.equipmentMode === "package") {
    const choices = draft.charClass.equipment.choices;
    const valid =
      draft.equipmentChoices.length === choices.length &&
      draft.equipmentChoices.every(
        (pick, i) =>
          Number.isInteger(pick) && pick >= 0 && pick < choices[i].options.length,
      );
    if (!valid) errors.push("Choose your starting equipment.");
  }
  errors.push(...hpProblems(draft));
  errors.push(...goldProblems(draft));

  // Subclass: owed once the class's subclass level is reached; never earlier.
  if (subclassRequired(draft)) {
    if (!draft.subclass) {
      errors.push("Choose a subclass.");
    } else if (
      !draft.charClass?.subclasses.some((s) => s.id === draft.subclass?.id)
    ) {
      errors.push("The chosen subclass does not belong to the class.");
    }
  } else if (draft.subclass) {
    errors.push(
      draft.charClass
        ? `${draft.charClass.name} has no subclass at level ${draft.level}.`
        : "Choose a class before a subclass.",
    );
  }

  errors.push(...featureChoiceProblems(draft));
  errors.push(...optionChoiceProblems(draft));
  errors.push(...languageToolProblems(draft));

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

  const chosen = [
    ...draft.classSkills,
    ...draft.bonusSkills,
    ...featureSkillPicks(draft),
  ];
  if (new Set(chosen).size !== chosen.length) {
    errors.push("Each skill can only be chosen once.");
  }
  if (chosen.some((s) => granted.has(s))) {
    errors.push("A chosen skill is already granted by race or background.");
  }

  return errors;
}

/**
 * Every language (or tool proficiency) the draft has from race/background
 * grants plus language/tool option picks (T-08), duplicates included —
 * validation flags those.
 */
export function draftLanguagesOrTools(
  draft: CharacterDraft,
  kind: "language" | "tool",
): string[] {
  const out: string[] = [];
  const sides = [
    [draft.race, draft.raceOptions] as const,
    [draft.background, draft.backgroundOptions] as const,
  ];
  for (const [entity, picks] of sides) {
    if (!entity) continue;
    out.push(...(kind === "language" ? entity.languages : entity.tools));
    for (const choice of entity.optionChoices) {
      if (choice.grants !== kind) continue;
      const option = choice.options.find((o) => o.id === picks[choice.id]);
      if (option) out.push(option.name);
    }
  }
  return out;
}

/**
 * Duplicate languages/tool proficiencies across grants and picks (T-08):
 * a language can never be learned twice. Shared by `validateDraft` and the
 * race/background steps' gating.
 */
export function languageToolProblems(draft: CharacterDraft): string[] {
  const errors: string[] = [];
  for (const kind of ["language", "tool"] as const) {
    const all = draftLanguagesOrTools(draft, kind);
    const seen = new Set<string>();
    for (const name of all) {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        errors.push(
          kind === "language"
            ? `${name} is already known — pick a different language.`
            : `${name} is already a proficiency — pick a different tool.`,
        );
      }
      seen.add(key);
    }
  }
  return errors;
}

/**
 * Everything wrong with the "pick one" answers owed to the chosen race or
 * background (T-05), as user-facing messages. `which` narrows to the choices
 * a single wizard step owns; omitted, both are checked (review/validate).
 */
export function optionChoiceProblems(
  draft: CharacterDraft,
  which?: "race" | "background",
): string[] {
  const errors: string[] = [];
  const sides = [
    which !== "background" &&
      ([draft.race, draft.raceOptions, "race"] as const),
    which !== "race" &&
      ([draft.background, draft.backgroundOptions, "background"] as const),
  ];
  for (const side of sides) {
    if (!side) continue;
    const [entity, picks, label] = side;
    const choices = entity?.optionChoices ?? [];
    const known = new Set(choices.map((c) => c.id));
    for (const id of Object.keys(picks)) {
      if (!known.has(id)) {
        errors.push(`An option pick does not belong to the chosen ${label}.`);
        break;
      }
    }
    for (const choice of choices) {
      const pick = picks[choice.id];
      if (!pick) {
        errors.push(`Choose a ${choice.name}.`);
      } else if (!choice.options.some((o) => o.id === pick)) {
        errors.push(`The ${choice.name} pick is not one of its options.`);
      }
    }
  }
  return errors;
}

/**
 * Everything wrong with the draft's per-improvement feat picks (T-04), as
 * user-facing messages. Shared by `validateDraft` and the Abilities step's
 * gating so the Next-button hints match the review-step errors.
 */
export function featProblems(draft: CharacterDraft): string[] {
  if (!draft.charClass) return [];
  const errors: string[] = [];
  const earned = new Set(earnedAsiLevels(draft.charClass, draft.level));

  for (const [key, feat] of Object.entries(draft.asiFeats)) {
    const level = Number(key);
    if (!earned.has(level)) {
      errors.push(
        `No ability score improvement is earned at level ${level}.`,
      );
      continue;
    }
    if (feat === null) {
      errors.push(`Choose a feat for the level-${level} improvement.`);
    }
  }

  const ids = Object.values(draft.asiFeats)
    .filter((f): f is FeatData => f !== null)
    .map((f) => f.id);
  if (new Set(ids).size !== ids.length) {
    errors.push("Each feat can only be taken once.");
  }

  return errors;
}

/**
 * Everything wrong with the draft's feature-choice picks, as user-facing
 * messages. Shared by `validateDraft` and the wizard's step gating so the
 * Next-button hints match the review-step errors. `kinds` narrows the check
 * to the choices a single wizard step owns (expertise gates the Skills step;
 * the rest gate the Class-options step).
 */
export function featureChoiceProblems(
  draft: CharacterDraft,
  kinds?: FeatureChoice["kind"][],
): string[] {
  const errors: string[] = [];
  const relevant = activeFeatureChoices(draft).filter(
    (c) => !kinds || kinds.includes(c.kind),
  );
  for (const choice of relevant) {
    const picks = draft.featurePicks[choice.id] ?? [];
    const what = choice.kind === "options" ? "option" : "skill";
    if (picks.length !== choice.count) {
      errors.push(
        `Choose ${choice.count} ${what}${choice.count === 1 ? "" : "s"} for ${choice.name}.`,
      );
      continue;
    }
    if (new Set(picks).size !== picks.length) {
      errors.push(`${choice.name} picks must be different.`);
    }
    if (choice.kind === "options") {
      const allowed = new Set(choice.options.map((o) => o.name));
      if (picks.some((p) => !allowed.has(p))) {
        errors.push(`A ${choice.name} pick is not one of its options.`);
      }
    } else if (choice.kind === "skills") {
      const allowed =
        choice.from === "any" ? null : new Set<string>(choice.from);
      if (allowed && picks.some((p) => !allowed.has(p))) {
        errors.push(`A ${choice.name} pick is not on its skill list.`);
      }
    } else {
      // Expertise upgrades skills the draft is already proficient in.
      const proficient = new Set<string>(draftProficientSkills(draft));
      if (picks.some((p) => !proficient.has(p))) {
        errors.push(`${choice.name} picks must be proficient skills.`);
      }
    }
  }

  // A skill cannot gain expertise twice (e.g. rogue level 1 + level 6 picks).
  if (!kinds || kinds.includes("expertise")) {
    const expertisePicks = activeFeatureChoices(draft)
      .filter((c) => c.kind === "expertise")
      .flatMap((c) => draft.featurePicks[c.id] ?? []);
    if (new Set(expertisePicks).size !== expertisePicks.length) {
      errors.push("Each skill can only gain expertise once.");
    }
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

  const subclass = subclassRequired(draft) ? draft.subclass : null;
  const granted = grantedClassFeatures(charClass, subclass, draft.level);

  // Feature effects change derived numbers after the (cap-20) draft math:
  // Primal Champion raises STR/CON to at most its own cap of 24, and does so
  // before HP so the improved CON counts; Fast Movement adds to speed.
  const abilityScores = finalAbilityScores(draft);
  let speed = race.speed;
  for (const { feature } of granted) {
    for (const effect of feature.effects) {
      if (effect.kind === "speed-bonus") {
        speed += effect.amount;
      } else if (effect.kind === "ability-increase") {
        for (const ability of effect.abilities) {
          abilityScores[ability] = Math.max(
            abilityScores[ability],
            Math.min(abilityScores[ability] + effect.amount, effect.max),
          );
        }
      }
      // "unarmored-defense" is handled below with the inventory.
    }
  }

  const maxHp = startingHp(
    charClass.hitDie,
    abilityModifier(abilityScores.con),
    draft.level,
    draft.hpMode === "rolled" ? draft.hpRolls : undefined,
  );

  // Scaling resource pools (Rage): the highest table row at this level wins.
  const resources = charClass.resources.flatMap((resource) => {
    const row = [...resource.levels]
      .filter((r) => r.level <= draft.level)
      .sort((a, b) => a.level - b.level)
      .pop();
    if (!row) return [];
    return [
      {
        id: resource.id,
        name: resource.name,
        max: row.uses,
        used: 0,
        per: resource.per,
        ...(row.note ? { note: row.note } : {}),
      },
    ];
  });

  const savingThrows: Partial<Record<Ability, ProficiencyLevel>> = {};
  for (const ability of charClass.savingThrows) {
    savingThrows[ability] = "proficient";
  }

  const skills: Partial<Record<Skill, ProficiencyLevel>> = {};
  for (const skill of draftProficientSkills(draft)) {
    skills[skill] = "proficient";
  }
  // Expertise picks upgrade already-proficient skills.
  for (const choice of activeFeatureChoices(draft)) {
    if (choice.kind !== "expertise") continue;
    for (const skill of (draft.featurePicks[choice.id] ?? []) as Skill[]) {
      skills[skill] = "expertise";
    }
  }

  const backgroundName =
    background.customName && draft.backgroundName.trim()
      ? draft.backgroundName.trim()
      : background.name;

  // Racial traits, class features, and background features all become
  // Character.features, tagged with their source (and, for class features,
  // the level they were gained at). Phase 2 swaps the static SRD traits for
  // Open5e content without touching this shape.
  const features = [
    ...traitsToFeatures(race.name, race.traits),
    ...granted.map(({ source, feature }) => ({
      id: `${slugify(source)}-${slugify(feature.name)}`,
      name: feature.name,
      source,
      description: feature.description,
      level: feature.level,
    })),
    ...traitsToFeatures(backgroundName, background.traits),
  ];
  // Race/background "pick one" answers: language and tool picks (T-08) land
  // on the language/tool lists; the rest become features of their own
  // ("Draconic Ancestry: Red (fire)"), sourced to who offered the choice.
  const languages = [...race.languages, ...background.languages];
  const extraTools = [...race.tools, ...background.tools];
  const optionSides = [
    { source: race.name, choices: race.optionChoices, picks: draft.raceOptions },
    {
      source: backgroundName,
      choices: background.optionChoices,
      picks: draft.backgroundOptions,
    },
  ];
  for (const { source, choices, picks } of optionSides) {
    for (const choice of choices) {
      const option = choice.options.find((o) => o.id === picks[choice.id]);
      if (!option) continue; // validation guarantees this doesn't happen
      if (choice.grants === "language") {
        languages.push(option.name);
        continue;
      }
      if (choice.grants === "tool") {
        extraTools.push(option.name);
        continue;
      }
      features.push({
        id: `${slugify(source)}-${slugify(choice.name)}-${slugify(option.name)}`,
        name: `${choice.name}: ${option.name}`,
        source,
        description: option.description ?? choice.description,
      });
    }
  }
  // Feats spent in place of ASI points, tagged with the level they were
  // taken at (validation guarantees none are null here).
  for (const [levelKey, feat] of Object.entries(draft.asiFeats)) {
    if (!feat) continue;
    features.push({
      id: `feat-${feat.id}`,
      name: feat.name,
      source: "Feat",
      description: feat.description,
      level: Number(levelKey),
    });
  }
  // Origin feat from a 2024 background (T-17), sourced to the background;
  // validation guarantees it isn't also an ASI feat.
  if (draft.originFeat) {
    features.push({
      id: `feat-${draft.originFeat.id}`,
      name: draft.originFeat.name,
      source: backgroundName,
      description: draft.originFeat.description,
    });
  }
  // "Options" picks become features of their own ("Fighting Style: Dueling"),
  // sourced to the class or subclass that offered the choice.
  for (const choice of activeFeatureChoices(draft)) {
    if (choice.kind !== "options") continue;
    const source = charClass.featureChoices.some((c) => c.id === choice.id)
      ? charClass.name
      : (subclass?.name ?? charClass.name);
    for (const pick of draft.featurePicks[choice.id] ?? []) {
      const option = choice.options.find((o) => o.name === pick);
      features.push({
        id: `${slugify(source)}-${slugify(choice.name)}-${slugify(pick)}`,
        name: `${choice.name}: ${pick}`,
        source,
        description: option?.description ?? choice.description,
      });
    }
  }

  // Class fixed gear + the chosen option from each choice + background gear.
  // Armor-like items are linked to their armor data by name (drives AC).
  const armorByName = new Map(ARMOR.map((a) => [a.name.toLowerCase(), a]));
  const inventory: Item[] = [];
  const addGear = (items: EquipmentItem[]) => {
    for (const item of items) {
      const armor = armorByName.get(item.name.toLowerCase());
      inventory.push({
        id: `${slugify(item.name)}-${inventory.length}`,
        name: item.name,
        quantity: item.quantity ?? 1,
        equipped: false,
        ...(armor ? { armorId: armor.id } : {}),
      });
    }
  };
  if (draft.equipmentMode === "gold") {
    // Starting gold instead of gear (T-07): a currency item until a proper
    // currency field exists.
    inventory.push({
      id: "gold-gp",
      name: "Gold (gp)",
      quantity: draft.goldRoll as number,
      equipped: false,
    });
  } else {
    addGear(charClass.equipment.fixed);
    charClass.equipment.choices.forEach((choice, i) => {
      addGear(choice.options[draft.equipmentChoices[i]]);
    });
    addGear(background.equipment);
  }

  // Starting armor is worn when unambiguous: the only body armor (and the
  // only shield) start equipped.
  const armorType = (item: Item) =>
    item.armorId ? armorByName.get(item.name.toLowerCase())?.type : undefined;
  const bodyArmor = inventory.filter((i) => {
    const type = armorType(i);
    return type !== undefined && type !== "shield";
  });
  const shields = inventory.filter((i) => armorType(i) === "shield");
  if (bodyArmor.length === 1) bodyArmor[0].equipped = true;
  if (shields.length === 1) shields[0].equipped = true;

  // Unarmored Defense, when a granted feature carries the effect.
  const unarmoredDefense = granted
    .flatMap(({ feature }) => feature.effects)
    .find((e) => e.kind === "unarmored-defense");

  return CharacterSchema.parse({
    id,
    name: draft.name.trim(),
    race: race.name,
    background: backgroundName,
    edition: charClass.edition,
    classes: [
      {
        name: charClass.name,
        level: draft.level,
        ...(subclass ? { subclass: subclass.name } : {}),
      },
    ],
    abilityScores,
    savingThrows,
    skills,
    maxHp,
    currentHp: maxHp,
    ...(unarmoredDefense
      ? {
          unarmoredDefense: {
            ability: unarmoredDefense.ability,
            shield: unarmoredDefense.shield,
          },
        }
      : {}),
    speed,
    spellcastingAbility: charClass.spellcastingAbility,
    features,
    languages: [...new Set(languages)],
    proficiencies: {
      ...charClass.proficiencies,
      tools: [...new Set([...charClass.proficiencies.tools, ...extraTools])],
    },
    resources,
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
