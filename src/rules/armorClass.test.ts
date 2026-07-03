import { describe, expect, it } from "vitest";
import { emptyCharacter, type Character, type Item } from "../model/schema";
import { armorClass } from "./armorClass";

/**
 * Every AC derivation path (T-06): override, body armor per type (light /
 * medium capped / heavy no-DEX), shields, unarmored defense (with and
 * without shield permission), and the 10 + DEX fallback.
 */

function withDex(dex: number, patch: Partial<Character> = {}): Character {
  return {
    ...emptyCharacter("ac-test", "Tester"),
    abilityScores: { str: 10, dex, con: 14, int: 10, wis: 16, cha: 10 },
    ...patch,
  };
}

function armor(id: string, equipped = true): Item {
  return { id, name: id, quantity: 1, equipped, armorId: id };
}

describe("armorClass", () => {
  it("falls back to 10 + DEX with nothing equipped", () => {
    expect(armorClass(withDex(14))).toBe(12);
    expect(armorClass(withDex(8))).toBe(9); // negative DEX applies
  });

  it("uses light armor with full DEX", () => {
    const c = withDex(18, { inventory: [armor("leather-armor")] });
    expect(armorClass(c)).toBe(15); // 11 + 4
  });

  it("caps DEX at 2 in medium armor (negative DEX still applies)", () => {
    expect(
      armorClass(withDex(18, { inventory: [armor("scale-mail")] })),
    ).toBe(16); // 14 + capped 2
    expect(
      armorClass(withDex(8, { inventory: [armor("scale-mail")] })),
    ).toBe(13); // 14 - 1
  });

  it("ignores DEX entirely in heavy armor", () => {
    expect(
      armorClass(withDex(18, { inventory: [armor("chain-mail")] })),
    ).toBe(16);
    expect(
      armorClass(withDex(6, { inventory: [armor("chain-mail")] })),
    ).toBe(16); // even negative DEX
  });

  it("adds an equipped shield on top of any formula", () => {
    expect(
      armorClass(
        withDex(14, { inventory: [armor("chain-mail"), armor("shield")] }),
      ),
    ).toBe(18);
    expect(armorClass(withDex(14, { inventory: [armor("shield")] }))).toBe(14);
    // Unequipped gear contributes nothing.
    expect(
      armorClass(withDex(14, { inventory: [armor("chain-mail", false)] })),
    ).toBe(12);
  });

  it("uses barbarian unarmored defense (CON, shield allowed)", () => {
    const barbarian = withDex(14, {
      unarmoredDefense: { ability: "con", shield: true },
    });
    expect(armorClass(barbarian)).toBe(14); // 10 + 2 + 2
    expect(
      armorClass({ ...barbarian, inventory: [armor("shield")] }),
    ).toBe(16); // shield keeps the formula
    // Wearing armor beats the formula.
    expect(
      armorClass({ ...barbarian, inventory: [armor("chain-mail")] }),
    ).toBe(16);
  });

  it("drops monk unarmored defense when a shield is equipped", () => {
    const monk = withDex(14, {
      unarmoredDefense: { ability: "wis", shield: false },
    });
    expect(armorClass(monk)).toBe(15); // 10 + 2 + 3
    expect(armorClass({ ...monk, inventory: [armor("shield")] })).toBe(14); // 10 + 2 + shield
  });

  it("lets the manual override win outright", () => {
    const c = withDex(18, {
      inventory: [armor("plate"), armor("shield")],
      armorClassOverride: 25,
    });
    expect(armorClass(c)).toBe(25);
  });

  it("ignores unknown armor ids (homebrew items without data)", () => {
    const c = withDex(14, {
      inventory: [{ id: "x", name: "X", quantity: 1, equipped: true, armorId: "mystery" }],
    });
    expect(armorClass(c)).toBe(12);
  });
});
