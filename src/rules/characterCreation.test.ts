import { describe, expect, it } from "vitest";
import { BACKGROUNDS, CLASSES, RACES } from "../data/srd";
import {
  POINT_BUY_BUDGET,
  assembleCharacter,
  bonusSkillCount,
  emptyDraft,
  finalAbilityScores,
  pointBuyCost,
  pointBuyTotal,
  validateDraft,
  type CharacterDraft,
} from "./characterCreation";

function byId<T extends { id: string }>(list: T[], id: string): T {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`No entry ${id}`);
  return found;
}

/** A complete, valid draft: hill dwarf fighter acolyte on the standard array. */
function validDraft(): CharacterDraft {
  return {
    ...emptyDraft(),
    name: "Borin",
    race: byId(RACES, "hill-dwarf"),
    charClass: byId(CLASSES, "fighter"),
    background: byId(BACKGROUNDS, "acolyte"),
    baseScores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    classSkills: ["athletics", "perception"],
  };
}

describe("point buy", () => {
  it("prices scores per the PHB table", () => {
    expect(pointBuyCost(8)).toBe(0);
    expect(pointBuyCost(13)).toBe(5);
    expect(pointBuyCost(14)).toBe(7);
    expect(pointBuyCost(15)).toBe(9);
  });

  it("rejects scores outside 8-15", () => {
    expect(pointBuyCost(7)).toBeNull();
    expect(pointBuyCost(16)).toBeNull();
  });

  it("totals a full score set", () => {
    // 15/15/15 + 8/8/8 = 27, exactly the budget
    expect(
      pointBuyTotal({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 }),
    ).toBe(POINT_BUY_BUDGET);
    expect(
      pointBuyTotal({ str: 18, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }),
    ).toBeNull();
  });
});

describe("finalAbilityScores", () => {
  it("applies fixed racial bonuses", () => {
    const draft = validDraft(); // hill dwarf: +2 con, +1 wis
    const scores = finalAbilityScores(draft);
    expect(scores.con).toBe(16);
    expect(scores.wis).toBe(13);
    expect(scores.str).toBe(15);
  });

  it("applies chosen bonuses for races with a bonus choice", () => {
    const draft: CharacterDraft = {
      ...validDraft(),
      race: byId(RACES, "half-elf"), // +2 cha fixed, +1 to two chosen
      racialBonusAbilities: ["dex", "con"],
    };
    const scores = finalAbilityScores(draft);
    expect(scores.cha).toBe(12);
    expect(scores.dex).toBe(14);
    expect(scores.con).toBe(15);
  });
});

describe("validateDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateDraft(validDraft())).toEqual([]);
  });

  it("requires name, race, class, and background", () => {
    const errors = validateDraft(emptyDraft());
    expect(errors).toContain("Character needs a name.");
    expect(errors).toContain("Choose a race.");
    expect(errors).toContain("Choose a class.");
    expect(errors).toContain("Choose a background.");
  });

  it("enforces the class skill count and list", () => {
    const draft = validDraft();
    draft.classSkills = ["athletics"];
    expect(validateDraft(draft)).toContain("Choose 2 class skills.");

    draft.classSkills = ["athletics", "arcana"]; // arcana not a fighter skill
    expect(validateDraft(draft)).toContain(
      "A chosen class skill is not on the class list.",
    );
  });

  it("enforces racial bonus ability picks", () => {
    const draft: CharacterDraft = {
      ...validDraft(),
      race: byId(RACES, "half-elf"),
      bonusSkills: ["stealth", "deception"],
    };
    expect(validateDraft(draft)).toContain(
      "Pick 2 abilities for the racial bonus.",
    );

    draft.racialBonusAbilities = ["cha", "dex"]; // cha already has the fixed +2
    expect(validateDraft(draft)).toContain(
      "Racial bonus abilities must differ from the fixed racial bonuses.",
    );
  });

  it("counts bonus skill picks from race and background together", () => {
    const halfElf: CharacterDraft = {
      ...validDraft(),
      race: byId(RACES, "half-elf"), // Skill Versatility: choose any 2
      background: byId(BACKGROUNDS, "custom"), // choose any 2
      racialBonusAbilities: ["dex", "con"],
    };
    expect(bonusSkillCount(halfElf)).toBe(4);
    expect(validateDraft(halfElf)).toContain("Choose 4 additional skills.");

    halfElf.bonusSkills = ["stealth", "deception", "insight", "arcana"];
    expect(validateDraft(halfElf)).toEqual([]);
  });

  it("rejects duplicate or already-granted skills", () => {
    const draft = validDraft();
    draft.classSkills = ["athletics", "insight"]; // acolyte grants insight
    expect(validateDraft(draft)).toContain(
      "A chosen skill is already granted by race or background.",
    );
  });
});

describe("assembleCharacter", () => {
  it("builds a schema-valid level-1 character", () => {
    const character = assembleCharacter(validDraft(), "test-id");

    expect(character.name).toBe("Borin");
    expect(character.race).toBe("Hill Dwarf");
    expect(character.background).toBe("Acolyte");
    expect(character.classes).toEqual([{ name: "Fighter", level: 1 }]);
    // Hill dwarf: con 14 + 2 = 16 (mod +3); fighter d10 => 13 HP
    expect(character.maxHp).toBe(13);
    expect(character.currentHp).toBe(13);
    // dex 13 => mod +1 => AC 11 unarmored
    expect(character.armorClass).toBe(11);
    expect(character.speed).toBe(25);
    expect(character.savingThrows).toEqual({
      str: "proficient",
      con: "proficient",
    });
    expect(character.skills).toEqual({
      insight: "proficient",
      religion: "proficient",
      athletics: "proficient",
      perception: "proficient",
    });
    expect(character.spellcastingAbility).toBeUndefined();
  });

  it("copies racial traits, class features, and background features onto the character", () => {
    const character = assembleCharacter(validDraft(), "test-id");
    const names = character.features.map((f) => f.name);
    expect(names).toContain("Dwarven Toughness"); // race
    expect(names).toContain("Second Wind"); // class
    expect(names).toContain("Shelter of the Faithful"); // background

    const secondWind = character.features.find((f) => f.name === "Second Wind");
    expect(secondWind?.source).toBe("Fighter");
    expect(secondWind?.id).toBe("fighter-second-wind");
    expect(secondWind?.description).toMatch(/Bonus action/);
  });

  it("sets the spellcasting ability for casters", () => {
    const draft: CharacterDraft = {
      ...validDraft(),
      charClass: byId(CLASSES, "wizard"),
      classSkills: ["arcana", "history"],
    };
    const character = assembleCharacter(draft, "test-id");
    expect(character.spellcastingAbility).toBe("int");
  });

  it("uses the custom background name when provided", () => {
    const draft: CharacterDraft = {
      ...validDraft(),
      background: byId(BACKGROUNDS, "custom"),
      backgroundName: "Caravan Guard",
      bonusSkills: ["survival", "intimidation"],
    };
    expect(assembleCharacter(draft, "test-id").background).toBe("Caravan Guard");
  });

  it("floors starting HP at 1", () => {
    const draft: CharacterDraft = {
      ...validDraft(),
      race: byId(RACES, "high-elf"), // no con bonus
      charClass: byId(CLASSES, "wizard"),
      classSkills: ["arcana", "history"],
      baseScores: { str: 10, dex: 10, con: 1, int: 15, wis: 10, cha: 10 },
    };
    // wizard d6 + con mod (1 => -5) would be 1; clamp keeps it >= 1
    expect(assembleCharacter(draft, "test-id").maxHp).toBe(1);
  });

  it("throws on an invalid draft", () => {
    expect(() => assembleCharacter(emptyDraft(), "test-id")).toThrow(
      /Invalid character draft/,
    );
  });
});
