import type {
  Ability,
  AbilityScores,
  Character,
  ProficiencyLevel,
  Skill,
} from "../model/schema";
import { SKILLS } from "../model/schema";

/**
 * Pure 5e rules math. Everything here is derived from a character's stored
 * inputs — nothing is persisted. Kept dependency-free so it can be unit tested
 * in isolation and reused by the sheet, the map, and the dice roller.
 */

/** Ability modifier: floor((score - 10) / 2). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Proficiency bonus by total character level (1–20+): 2 + floor((level-1)/4). */
export function proficiencyBonus(level: number): number {
  const clamped = Math.max(1, level);
  return 2 + Math.floor((clamped - 1) / 4);
}

/** Total character level across all classes. */
export function totalLevel(character: Character): number {
  return character.classes.reduce((sum, c) => sum + c.level, 0) || 1;
}

/** Format a modifier for display, always signed (e.g. +3, -1, +0). */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Multiplier applied to proficiency bonus for a given proficiency level. */
function proficiencyMultiplier(level: ProficiencyLevel): number {
  switch (level) {
    case "expertise":
      return 2;
    case "proficient":
      return 1;
    case "none":
    default:
      return 0;
  }
}

/** Saving throw bonus for an ability, accounting for proficiency. */
export function savingThrowBonus(character: Character, ability: Ability): number {
  const mod = abilityModifier(character.abilityScores[ability]);
  const prof = character.savingThrows?.[ability] ?? "none";
  return mod + proficiencyMultiplier(prof) * proficiencyBonus(totalLevel(character));
}

/** Skill check bonus, accounting for proficiency and expertise. */
export function skillBonus(character: Character, skill: Skill): number {
  const ability = SKILLS[skill];
  const mod = abilityModifier(character.abilityScores[ability]);
  const prof = character.skills?.[skill] ?? "none";
  return mod + proficiencyMultiplier(prof) * proficiencyBonus(totalLevel(character));
}

/** Spell save DC: 8 + proficiency bonus + spellcasting ability modifier. */
export function spellSaveDc(character: Character): number | null {
  const ability = character.spellcastingAbility;
  if (!ability) return null;
  return (
    8 +
    proficiencyBonus(totalLevel(character)) +
    abilityModifier(character.abilityScores[ability])
  );
}

/** Spell attack bonus: proficiency bonus + spellcasting ability modifier. */
export function spellAttackBonus(character: Character): number | null {
  const ability = character.spellcastingAbility;
  if (!ability) return null;
  return (
    proficiencyBonus(totalLevel(character)) +
    abilityModifier(character.abilityScores[ability])
  );
}

/** Passive perception: 10 + perception skill bonus. */
export function passivePerception(character: Character): number {
  return 10 + skillBonus(character, "perception");
}

/** Initiative bonus (dexterity modifier; no feats/bonuses yet). */
export function initiativeBonus(scores: AbilityScores): number {
  return abilityModifier(scores.dex);
}
