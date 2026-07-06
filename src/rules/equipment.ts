import type { Item } from "../model/schema";
import { ARMOR, type ArmorData } from "../data/srd";

/**
 * Equip slots (T-38). An item's slot decides whether it can be equipped
 * and what limit applies:
 *
 * - `hand` — held: weapons, shields, torches. At most 2 equipped.
 * - `body` — worn armor/clothes. At most 1; equipping doffs the current.
 * - `accessory` — rings, cloaks, boots… Unlimited.
 * - no slot — gold, candles, consumables: never equippable.
 *
 * `item.slot` is authoritative when set ("none" = explicitly
 * unequippable); otherwise the slot is inferred from armor data and name
 * heuristics, so items from old notes and hand-typed gear still work.
 * Both the sheet's read-mode chips and edit-mode checkboxes go through
 * `toggleEquipped` below — one rule set, no drift (lesson from T-22/T-36).
 */
export type EquipSlot = "hand" | "body" | "accessory";

/** SRD weapon names (lowercased) — held items beyond what armor data covers. */
const WEAPON_NAMES = new Set(
  [
    "battleaxe", "blowgun", "club", "crossbow", "dagger", "dart", "flail",
    "glaive", "greataxe", "greatclub", "greatsword", "halberd", "handaxe",
    "hand crossbow", "heavy crossbow", "javelin", "lance", "light crossbow",
    "light hammer", "longbow", "longsword", "mace", "maul", "morningstar",
    "net", "pike", "quarterstaff", "rapier", "scimitar", "shortbow",
    "shortsword", "sickle", "sling", "spear", "trident", "war pick",
    "warhammer", "whip",
  ].map((n) => n.toLowerCase()),
);

/** Other held gear, matched as a word within the name. */
const HAND_WORDS = ["torch", "lantern", "wand", "rod", "focus"];

/** Worn-on-body words (armor itself is caught via `armorId`). */
const BODY_WORDS = ["clothes", "robe", "vestments", "costume", "uniform"];

const ACCESSORY_WORDS = [
  "ring", "amulet", "pendant", "necklace", "cloak", "cape", "brooch",
  "boots", "shoes", "belt", "bracers", "gauntlets", "gloves", "circlet",
  "crown", "hat", "helm", "mask", "goggles",
];

const hasWord = (name: string, words: string[]) =>
  words.some((w) => new RegExp(`\\b${w}\\b`).test(name));

/**
 * Infer an item's slot from armor data and name heuristics. Returns
 * undefined for unrecognized items (not equippable until the user sets a
 * slot in edit mode).
 */
export function inferSlot(
  item: Pick<Item, "name" | "armorId">,
  armorList: ArmorData[] = ARMOR,
): EquipSlot | undefined {
  if (item.armorId !== undefined) {
    const armor = armorList.find((a) => a.id === item.armorId);
    if (armor) return armor.type === "shield" ? "hand" : "body";
  }
  const name = item.name.trim().toLowerCase();
  if (WEAPON_NAMES.has(name) || hasWord(name, HAND_WORDS)) return "hand";
  if (hasWord(name, BODY_WORDS)) return "body";
  if (hasWord(name, ACCESSORY_WORDS)) return "accessory";
  return undefined;
}

/** The slot in effect: explicit `item.slot` wins, else inferred. */
export function slotOf(
  item: Pick<Item, "name" | "armorId" | "slot">,
  armorList: ArmorData[] = ARMOR,
): EquipSlot | undefined {
  if (item.slot === "none") return undefined;
  return item.slot ?? inferSlot(item, armorList);
}

/** Number of hands an inventory has occupied. */
const handsUsed = (inventory: Item[], armorList: ArmorData[]) =>
  inventory.filter((i) => i.equipped && slotOf(i, armorList) === "hand").length;

/**
 * Why an item can't be equipped right now, or undefined when it can.
 * Unequipping is always allowed.
 */
export function equipProblem(
  inventory: Item[],
  index: number,
  armorList: ArmorData[] = ARMOR,
): string | undefined {
  const item = inventory[index];
  if (item === undefined || item.equipped) return undefined;
  const slot = slotOf(item, armorList);
  if (slot === undefined) return "Not equippable";
  if (slot === "hand" && handsUsed(inventory, armorList) >= 2) {
    return "Hands full — unequip a held item first";
  }
  return undefined;
}

/**
 * Toggle an item's equipped state under the slot rules. Returns the new
 * inventory, or null when the toggle is not allowed (no slot, hands
 * full). Equipping a body item doffs the currently worn one.
 */
export function toggleEquipped(
  inventory: Item[],
  index: number,
  armorList: ArmorData[] = ARMOR,
): Item[] | null {
  const target = inventory[index];
  if (target === undefined) return null;
  if (!target.equipped && equipProblem(inventory, index, armorList) !== undefined) {
    return null;
  }
  const equipping = !target.equipped;
  const targetSlot = slotOf(target, armorList);
  return inventory.map((item, i) => {
    if (i === index) return { ...item, equipped: equipping };
    if (
      equipping &&
      item.equipped &&
      targetSlot === "body" &&
      slotOf(item, armorList) === "body"
    ) {
      return { ...item, equipped: false };
    }
    return item;
  });
}
