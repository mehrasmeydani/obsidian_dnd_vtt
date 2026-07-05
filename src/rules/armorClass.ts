import type { Character } from "../model/schema";
import { ARMOR, type ArmorData } from "../data/srd";
import { abilityModifier } from "./abilityMath";

/**
 * Derived armor class (T-06). Priority:
 *
 * 1. `armorClassOverride`, when set — homebrew formulas win outright.
 * 2. Equipped body armor: base AC + DEX per its cap (heavy armor ignores
 *    DEX entirely, medium caps it, light adds it all).
 * 3. The class's Unarmored Defense (10 + DEX + ability) — unless it forbids
 *    shields (monk) and one is equipped.
 * 4. 10 + DEX.
 *
 * An equipped shield adds its bonus on top of 2–4 (for 3, only when the
 * formula allows it).
 */
/**
 * Link inventory items to armor data by name (T-52): items from notes
 * saved before `armorId` existed — or added by hand — carry none, which
 * silently drops them from the AC formula. Case-insensitive exact name
 * match, with a trailing " armor" tolerated ("Studded leather armor" →
 * "Studded Leather"). Already-linked items are left alone.
 */
export function linkArmorByName<T extends { name: string; armorId?: string }>(
  items: T[],
  armorList: ArmorData[] = ARMOR,
): T[] {
  const byName = new Map(armorList.map((a) => [a.name.toLowerCase(), a]));
  const lookup = (name: string) =>
    byName.get(name) ?? byName.get(name.replace(/ armou?r$/, ""));
  return items.map((item) => {
    if (item.armorId !== undefined) return item;
    const armor = lookup(item.name.trim().toLowerCase());
    return armor ? { ...item, armorId: armor.id } : item;
  });
}

export function armorClass(
  character: Character,
  armorList: ArmorData[] = ARMOR,
): number {
  if (character.armorClassOverride !== undefined) {
    return character.armorClassOverride;
  }

  const byId = new Map(armorList.map((a) => [a.id, a]));
  const equipped = character.inventory
    .filter((item) => item.equipped && item.armorId)
    .map((item) => byId.get(item.armorId as string))
    .filter((a): a is ArmorData => a !== undefined);
  const body = equipped.find((a) => a.type !== "shield");
  const shield = equipped.find((a) => a.type === "shield");

  const dexMod = abilityModifier(character.abilityScores.dex);
  const unarmored = character.unarmoredDefense;

  let base: number;
  let shieldBonus = shield?.baseAc ?? 0;
  if (body) {
    const dex =
      body.type === "heavy"
        ? 0
        : body.dexCap !== undefined
          ? Math.min(dexMod, body.dexCap)
          : dexMod;
    base = body.baseAc + dex;
  } else if (unarmored && (unarmored.shield || !shield)) {
    base = 10 + dexMod + abilityModifier(character.abilityScores[unarmored.ability]);
  } else {
    base = 10 + dexMod;
  }
  return base + shieldBonus;
}
