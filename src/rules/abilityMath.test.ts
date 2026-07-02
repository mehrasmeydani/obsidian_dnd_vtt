import { describe, expect, it } from "vitest";
import { emptyCharacter, type Character } from "../model/schema";
import {
  abilityModifier,
  formatModifier,
  initiativeBonus,
  passivePerception,
  proficiencyBonus,
  savingThrowBonus,
  skillBonus,
  spellAttackBonus,
  spellSaveDc,
} from "./abilityMath";

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return { ...emptyCharacter("test-id", "Tester"), ...overrides };
}

describe("abilityModifier", () => {
  it.each([
    [1, -5],
    [8, -1],
    [10, 0],
    [11, 0],
    [14, 2],
    [15, 2],
    [20, 5],
    [30, 10],
  ])("score %i -> modifier %i", (score, expected) => {
    expect(abilityModifier(score)).toBe(expected);
  });
});

describe("proficiencyBonus", () => {
  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [8, 3],
    [9, 4],
    [12, 4],
    [13, 5],
    [17, 6],
    [20, 6],
  ])("level %i -> +%i", (level, expected) => {
    expect(proficiencyBonus(level)).toBe(expected);
  });
});

describe("formatModifier", () => {
  it("always signs the value", () => {
    expect(formatModifier(3)).toBe("+3");
    expect(formatModifier(0)).toBe("+0");
    expect(formatModifier(-2)).toBe("-2");
  });
});

describe("savingThrowBonus", () => {
  it("adds proficiency when proficient", () => {
    const c = makeCharacter({
      classes: [{ name: "Fighter", level: 5 }], // prof bonus +3
      abilityScores: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 10 },
      savingThrows: { str: "proficient", con: "proficient" },
    });
    // STR mod +3, prof +3 => +6
    expect(savingThrowBonus(c, "str")).toBe(6);
    // DEX not proficient => +0
    expect(savingThrowBonus(c, "dex")).toBe(0);
  });
});

describe("skillBonus", () => {
  it("doubles proficiency for expertise", () => {
    const c = makeCharacter({
      classes: [{ name: "Rogue", level: 1 }], // prof bonus +2
      abilityScores: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
      skills: { stealth: "expertise", acrobatics: "proficient" },
    });
    // DEX mod +3; stealth expertise (2x prof +4) => +7
    expect(skillBonus(c, "stealth")).toBe(7);
    // acrobatics proficient (+2) => +5
    expect(skillBonus(c, "acrobatics")).toBe(5);
    // arcana untrained (INT mod +0) => +0
    expect(skillBonus(c, "arcana")).toBe(0);
  });
});

describe("spellcasting", () => {
  it("computes save DC and attack bonus from the casting ability", () => {
    const c = makeCharacter({
      classes: [{ name: "Wizard", level: 5 }], // prof +3
      abilityScores: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
      spellcastingAbility: "int",
    });
    // 8 + prof 3 + INT mod 4 = 15
    expect(spellSaveDc(c)).toBe(15);
    // prof 3 + INT mod 4 = 7
    expect(spellAttackBonus(c)).toBe(7);
  });

  it("returns null when the character is not a caster", () => {
    const c = makeCharacter({ spellcastingAbility: undefined });
    expect(spellSaveDc(c)).toBeNull();
    expect(spellAttackBonus(c)).toBeNull();
  });
});

describe("passivePerception", () => {
  it("is 10 + perception bonus", () => {
    const c = makeCharacter({
      classes: [{ name: "Ranger", level: 1 }],
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
      skills: { perception: "proficient" },
    });
    // 10 + (WIS +2 + prof +2) = 14
    expect(passivePerception(c)).toBe(14);
  });
});

describe("initiativeBonus", () => {
  it("uses the dexterity modifier", () => {
    expect(
      initiativeBonus({ str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 }),
    ).toBe(4);
  });
});
