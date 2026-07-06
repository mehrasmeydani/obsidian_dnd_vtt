import { describe, expect, it } from "vitest";
import type { Item } from "../model/schema";
import { equipProblem, inferSlot, slotOf, toggleEquipped } from "./equipment";

const item = (partial: Partial<Item> & { name: string }): Item => ({
  id: partial.name.toLowerCase().replace(/\W+/g, "-"),
  quantity: 1,
  equipped: false,
  ...partial,
});

describe("inferSlot (T-38)", () => {
  it("maps armor data: shields to hand, body armor to body", () => {
    expect(inferSlot(item({ name: "Shield", armorId: "shield" }))).toBe("hand");
    expect(inferSlot(item({ name: "Leather armor", armorId: "leather-armor" }))).toBe("body");
  });

  it("recognizes weapons and held gear by name", () => {
    for (const name of ["Longsword", "greataxe", "Light crossbow", "Torch", "Arcane focus"]) {
      expect(inferSlot(item({ name }))).toBe("hand");
    }
  });

  it("recognizes worn clothes and accessories by name", () => {
    expect(inferSlot(item({ name: "Common clothes" }))).toBe("body");
    expect(inferSlot(item({ name: "Robe" }))).toBe("body");
    expect(inferSlot(item({ name: "Signet ring" }))).toBe("accessory");
    expect(inferSlot(item({ name: "Cloak of protection" }))).toBe("accessory");
  });

  it("leaves gold, candles, and unknown gear unslotted", () => {
    for (const name of ["Gold (gp)", "Candle", "Rope", "Rations"]) {
      expect(inferSlot(item({ name }))).toBeUndefined();
    }
  });
});

describe("slotOf", () => {
  it("explicit slot wins over inference; 'none' disables it", () => {
    expect(slotOf(item({ name: "Longsword", slot: "accessory" }))).toBe("accessory");
    expect(slotOf(item({ name: "Longsword", slot: "none" }))).toBeUndefined();
    expect(slotOf(item({ name: "Rope", slot: "hand" }))).toBe("hand");
  });
});

describe("toggleEquipped rules", () => {
  it("blocks a third hand item and reports why", () => {
    const inv = [
      item({ name: "Longsword", equipped: true }),
      item({ name: "Shield", armorId: "shield", equipped: true }),
      item({ name: "Dagger" }),
    ];
    expect(equipProblem(inv, 2)).toMatch(/Hands full/);
    expect(toggleEquipped(inv, 2)).toBeNull();
    // Unequipping is always allowed even with full hands.
    expect(toggleEquipped(inv, 0)?.[0].equipped).toBe(false);
  });

  it("equipping body armor doffs the current one only", () => {
    const inv = [
      item({ name: "Leather armor", armorId: "leather-armor", equipped: true }),
      item({ name: "Shield", armorId: "shield", equipped: true }),
      item({ name: "Scale mail", armorId: "scale-mail" }),
    ];
    const next = toggleEquipped(inv, 2);
    expect(next?.map((i) => i.equipped)).toEqual([false, true, true]);
  });

  it("accessories stack without limit", () => {
    const inv = [
      item({ name: "Ring of warmth", equipped: true }),
      item({ name: "Cloak of billowing", equipped: true }),
      item({ name: "Signet ring" }),
    ];
    expect(toggleEquipped(inv, 2)?.[2].equipped).toBe(true);
  });

  it("unslotted items can never equip", () => {
    const inv = [item({ name: "Gold (gp)" })];
    expect(equipProblem(inv, 0)).toBe("Not equippable");
    expect(toggleEquipped(inv, 0)).toBeNull();
  });
});
