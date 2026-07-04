import { describe, expect, it } from "vitest";
import { BACKGROUNDS, CLASSES, FEATS, RACES } from "../data/srd";
import { armorClass } from "./armorClass";
import {
  POINT_BUY_BUDGET,
  asiCount,
  asiPointsTotal,
  assembleCharacter,
  bonusSkillCount,
  emptyDraft,
  finalAbilityScores,
  grantedClassFeatures,
  pointBuyCost,
  pointBuyTotal,
  startingHp,
  subclassRequired,
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
    equipmentChoices: [0, 0, 0, 0],
    featurePicks: { "fighting-style": ["Archery"] },
    // Language/tool picks owed by hill dwarf + acolyte (T-08).
    raceOptions: { "dwarf-tools": "smiths-tools" },
    backgroundOptions: {
      "acolyte-language-1": "abyssal",
      "acolyte-language-2": "celestial",
    },
  };
}

/** validDraft raised past level 3, where the fighter owes a subclass. */
function leveledDraft(level: number): CharacterDraft {
  return {
    ...validDraft(),
    level,
    subclass: byId(CLASSES, "fighter").subclasses[0],
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
      raceOptions: { "half-elf-language": "giant" },
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
      raceOptions: { "half-elf-language": "giant" },
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
      raceOptions: { "half-elf-language": "giant" },
      backgroundOptions: {},
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

describe("startingHp", () => {
  it("gives full hit die + CON at level 1", () => {
    expect(startingHp(10, 3, 1)).toBe(13);
    expect(startingHp(6, -5, 1)).toBe(1); // floored at 1
  });

  it("adds average rolls (die/2 + 1) + CON per level after the first", () => {
    // d8, CON +2: 10 at level 1, then 4 × (5 + 2)
    expect(startingHp(8, 2, 5)).toBe(38);
  });

  it("floors each level's gain at 1", () => {
    // d6, CON -5: every level contributes the minimum 1
    expect(startingHp(6, -5, 3)).toBe(3);
  });
});

describe("levels and ability score improvements", () => {
  it("counts ASIs by class table (fighter gets extras)", () => {
    const fighter = byId(CLASSES, "fighter");
    const wizard = byId(CLASSES, "wizard");
    expect(asiCount(fighter, 1)).toBe(0);
    expect(asiCount(fighter, 4)).toBe(1);
    expect(asiCount(fighter, 6)).toBe(2);
    expect(asiCount(fighter, 20)).toBe(7);
    expect(asiCount(wizard, 20)).toBe(5);
  });

  it("requires exactly two points per ASI", () => {
    const draft: CharacterDraft = leveledDraft(4);
    expect(asiPointsTotal(draft)).toBe(2);
    expect(validateDraft(draft)).toContain(
      "Assign exactly 2 ability score improvement points.",
    );

    draft.asiBonuses = { str: 2 };
    expect(validateDraft(draft)).toEqual([]);
  });

  it("rejects improvements past the score cap of 20", () => {
    const draft: CharacterDraft = {
      ...leveledDraft(4),
      baseScores: { str: 19, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
      asiBonuses: { str: 2 },
    };
    expect(validateDraft(draft)).toContain(
      "Improvements cannot raise a score above 20.",
    );
  });

  it("rejects levels outside 1-20", () => {
    expect(validateDraft({ ...validDraft(), level: 0 })).toContain(
      "Level must be between 1 and 20.",
    );
    expect(validateDraft({ ...validDraft(), level: 21 }).length).toBeGreaterThan(
      0,
    );
  });

  it("assembles a higher-level character with scaled HP and class level", () => {
    const draft: CharacterDraft = {
      ...leveledDraft(4),
      asiBonuses: { con: 2 }, // con 14 + 2 racial + 2 ASI = 18 (mod +4)
    };
    const character = assembleCharacter(draft, "test-id");
    expect(character.classes).toEqual([
      { name: "Fighter", level: 4, subclass: "Champion" },
    ]);
    // L1: 10 + 4 = 14; L2-4: 3 × (6 + 4) = 30
    expect(character.maxHp).toBe(44);
  });
});

describe("starting equipment", () => {
  it("collects class fixed gear, chosen bundles, and background gear", () => {
    const character = assembleCharacter(validDraft(), "test-id");
    const names = character.inventory.map((i) => i.name);
    expect(names).toContain("Chain mail"); // fighter choice 1, option 0
    expect(names).toContain("Longsword"); // choice 2, option 0 (with shield)
    expect(names).toContain("Shield");
    expect(names).toContain("Vestments"); // acolyte background
    const incense = character.inventory.find((i) => i.name === "Incense stick");
    expect(incense?.quantity).toBe(5);
  });

  it("honors non-default equipment picks", () => {
    const draft: CharacterDraft = {
      ...validDraft(),
      equipmentChoices: [1, 0, 0, 0], // leather armor + longbow + 20 arrows
    };
    const character = assembleCharacter(draft, "test-id");
    const names = character.inventory.map((i) => i.name);
    expect(names).toContain("Longbow");
    expect(names).not.toContain("Chain mail");
    expect(
      character.inventory.find((i) => i.name === "Arrows")?.quantity,
    ).toBe(20);
  });

  it("rejects drafts with missing or out-of-range picks", () => {
    expect(
      validateDraft({ ...validDraft(), equipmentChoices: [0, 0] }),
    ).toContain("Choose your starting equipment.");
    expect(
      validateDraft({ ...validDraft(), equipmentChoices: [9, 0, 0, 0] }),
    ).toContain("Choose your starting equipment.");
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
    // Chain mail (sole body armor) and shield start equipped: AC 16 + 2.
    expect(
      character.inventory.find((i) => i.name === "Chain mail")?.equipped,
    ).toBe(true);
    expect(
      character.inventory.find((i) => i.name === "Shield")?.equipped,
    ).toBe(true);
    expect(armorClass(character)).toBe(18);
    expect(character.armorClassOverride).toBeUndefined();
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
    expect(secondWind?.description).toMatch(/bonus action/i);
  });

  it("sets the spellcasting ability for casters", () => {
    const draft: CharacterDraft = {
      ...validDraft(),
      charClass: byId(CLASSES, "wizard"),
      classSkills: ["arcana", "history"],
      equipmentChoices: [0, 0, 0],
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
      backgroundOptions: {},
    };
    expect(assembleCharacter(draft, "test-id").background).toBe("Caravan Guard");
  });

  it("floors starting HP at 1", () => {
    const draft: CharacterDraft = {
      ...validDraft(),
      race: byId(RACES, "high-elf"), // no con bonus
      raceOptions: { "elf-language": "giant" },
      charClass: byId(CLASSES, "wizard"),
      classSkills: ["arcana", "history"],
      baseScores: { str: 10, dex: 10, con: 1, int: 15, wis: 10, cha: 10 },
      equipmentChoices: [0, 0, 0],
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

describe("2024 (5.5e) class variants", () => {
  /** A complete draft using the 2024 Barbarian (one A/B equipment choice). */
  function barbarian2024Draft(): CharacterDraft {
    return {
      ...validDraft(),
      charClass: byId(CLASSES, "barbarian-2024"),
      classSkills: ["athletics", "perception"],
      equipmentChoices: [0],
      featurePicks: { "weapon-mastery": ["Greataxe", "Handaxe"] },
    };
  }

  it("keeps both editions of the Barbarian in the bundle", () => {
    const b2014 = byId(CLASSES, "barbarian");
    const b2024 = byId(CLASSES, "barbarian-2024");
    expect(b2014.name).toBe("Barbarian");
    expect(b2024.name).toBe("Barbarian");
    expect(b2014.edition).toBe("2014");
    expect(b2024.edition).toBe("2024");
  });

  it("gives the 2024 Barbarian 4 ASIs by level 20 (level 19 is an Epic Boon)", () => {
    expect(asiCount(byId(CLASSES, "barbarian-2024"), 20)).toBe(4);
    expect(asiCount(byId(CLASSES, "barbarian"), 20)).toBe(5);
    expect(
      asiPointsTotal({ ...barbarian2024Draft(), level: 20 }),
    ).toBe(8);
  });

  it("assembles equipment option A: greataxe, handaxes, pack, and 15 gp", () => {
    const character = assembleCharacter(barbarian2024Draft(), "test-id");
    const byName = Object.fromEntries(
      character.inventory.map((i) => [i.name, i.quantity]),
    );
    expect(byName["Greataxe"]).toBe(1);
    expect(byName["Handaxe"]).toBe(4);
    expect(byName["Explorer's pack"]).toBe(1);
    expect(byName["Gold (gp)"]).toBe(15);
  });

  it("assembles equipment option B: 75 gp instead of gear", () => {
    const character = assembleCharacter(
      { ...barbarian2024Draft(), equipmentChoices: [1] },
      "test-id",
    );
    const gold = character.inventory.find((i) => i.name === "Gold (gp)");
    expect(gold?.quantity).toBe(75);
    expect(character.inventory.map((i) => i.name)).not.toContain("Greataxe");
  });

  it("copies Weapon Mastery onto the character as a Barbarian feature", () => {
    const character = assembleCharacter(barbarian2024Draft(), "test-id");
    const mastery = character.features.find((f) => f.name === "Weapon Mastery");
    expect(mastery?.source).toBe("Barbarian");
    expect(character.features.map((f) => f.name)).toContain("Rage");
  });
});

describe("languages & tool proficiencies (T-08)", () => {
  it("collects granted and chosen languages and tools, deduplicated", () => {
    const character = assembleCharacter(validDraft(), "test-id");
    expect(character.languages).toEqual([
      "Common",
      "Dwarvish",
      "Abyssal",
      "Celestial",
    ]);
    expect(character.proficiencies.tools).toEqual(["Smith's tools"]);
    // Language/tool picks don't become features.
    expect(
      character.features.some((f) => f.name.includes("Extra language")),
    ).toBe(false);
  });

  it("rejects a language picked twice or already granted", () => {
    const draft: CharacterDraft = {
      ...validDraft(),
      backgroundOptions: {
        "acolyte-language-1": "dwarvish", // hill dwarf already knows it
        "acolyte-language-2": "celestial",
      },
    };
    expect(validateDraft(draft)).toContain(
      "Dwarvish is already known — pick a different language.",
    );
  });
});

describe("race & background option choices (T-05)", () => {
  /** A dragonborn draft that owes the Draconic Ancestry pick. */
  function dragonbornDraft(): CharacterDraft {
    return {
      ...validDraft(),
      race: byId(RACES, "dragonborn"),
      raceOptions: {},
    };
  }

  it("requires an answer for every option choice", () => {
    expect(validateDraft(dragonbornDraft())).toContain(
      "Choose a Draconic Ancestry.",
    );
    const answered: CharacterDraft = {
      ...dragonbornDraft(),
      raceOptions: { "dragonborn-ancestry": "red" },
    };
    expect(validateDraft(answered)).toEqual([]);
  });

  it("rejects picks that are not among the options or belong elsewhere", () => {
    const bogus: CharacterDraft = {
      ...dragonbornDraft(),
      raceOptions: { "dragonborn-ancestry": "prismatic" },
    };
    expect(validateDraft(bogus)).toContain(
      "The Draconic Ancestry pick is not one of its options.",
    );

    const stale: CharacterDraft = {
      ...validDraft(), // hill dwarf has no option choices
      raceOptions: { "dragonborn-ancestry": "red" },
    };
    expect(validateDraft(stale)).toContain(
      "An option pick does not belong to the chosen race.",
    );
  });

  it("puts the chosen option on the character as a race-sourced feature", () => {
    const character = assembleCharacter(
      {
        ...dragonbornDraft(),
        raceOptions: { "dragonborn-ancestry": "red" },
      },
      "test-id",
    );
    const ancestry = character.features.find((f) =>
      f.name.startsWith("Draconic Ancestry:"),
    );
    expect(ancestry).toMatchObject({
      name: "Draconic Ancestry: Red (fire)",
      source: "Dragonborn",
    });
    expect(ancestry?.description).toMatch(/breath weapon/i);
  });
});

describe("feats as an ASI alternative (T-04)", () => {
  const grappler = FEATS.find((f) => f.id === "grappler")!;

  it("ships Grappler in the SRD bundle", () => {
    expect(grappler).toBeDefined();
  });

  it("removes a flipped level's 2 points from the pool, even before a pick", () => {
    const draft = leveledDraft(6); // fighter: ASIs at 4 and 6
    expect(asiPointsTotal(draft)).toBe(4);
    draft.asiFeats = { 4: null };
    expect(asiPointsTotal(draft)).toBe(2);
    draft.asiFeats = { 4: null, 6: grappler };
    expect(asiPointsTotal(draft)).toBe(0);
  });

  it("requires a feat pick for a level flipped to feat", () => {
    const draft: CharacterDraft = { ...leveledDraft(4), asiFeats: { 4: null } };
    expect(validateDraft(draft)).toContain(
      "Choose a feat for the level-4 improvement.",
    );
    draft.asiFeats = { 4: grappler };
    expect(validateDraft(draft)).toEqual([]);
  });

  it("rejects feats on levels without an earned improvement", () => {
    const draft = { ...leveledDraft(4), asiFeats: { 6: grappler } };
    expect(validateDraft(draft)).toContain(
      "No ability score improvement is earned at level 6.",
    );
  });

  it("rejects taking the same feat twice", () => {
    const draft = {
      ...leveledDraft(6),
      asiFeats: { 4: grappler, 6: grappler },
    };
    expect(validateDraft(draft)).toContain("Each feat can only be taken once.");
  });

  it("rejects feats without a class", () => {
    const draft = { ...emptyDraft(), asiFeats: { 4: grappler } };
    expect(validateDraft(draft)).toContain(
      "Choose a class before spending improvements on feats.",
    );
  });

  it("mixes points and a feat, and puts the feat on the character", () => {
    const draft: CharacterDraft = {
      ...leveledDraft(6),
      asiFeats: { 6: grappler },
      asiBonuses: { str: 2 }, // the level-4 improvement stays on points
    };
    expect(validateDraft(draft)).toEqual([]);
    const character = assembleCharacter(draft, "test-id");
    expect(character.abilityScores.str).toBe(17); // 15 base + 2 ASI
    const feat = character.features.find((f) => f.name === "Grappler");
    expect(feat).toMatchObject({
      id: "feat-grappler",
      source: "Feat",
      level: 6,
    });
    expect(feat?.description).toMatch(/grappl/i);
  });
});

describe("leveled class features (T-19) and proficiencies (T-20)", () => {
  const barbarian = () => byId(CLASSES, "barbarian");
  const berserker = () => barbarian().subclasses[0];

  /** A human barbarian (Path of the Berserker from level 3 up). */
  function barbarianDraft(level: number): CharacterDraft {
    return {
      ...validDraft(),
      race: byId(RACES, "human"), // +1 all abilities, speed 30
      raceOptions: { "human-language": "elvish" },
      charClass: barbarian(),
      level,
      subclass: level >= 3 ? berserker() : null,
      classSkills: ["athletics", "perception"],
      equipmentChoices: [0, 0],
      featurePicks: {},
    };
  }

  it("collapses scaling tiers to the highest one reached", () => {
    const names = (level: number) =>
      grantedClassFeatures(barbarian(), null, level).map(
        (g) => `${g.feature.name}@${g.feature.level}`,
      );
    expect(names(1)).toEqual(["Rage@1", "Unarmored Defense@1"]);
    expect(names(9)).toContain("Brutal Critical@9");
    expect(names(13)).toContain("Brutal Critical@13");
    expect(names(13)).not.toContain("Brutal Critical@9");
    expect(
      names(20).filter((n) => n.startsWith("Brutal Critical")),
    ).toEqual(["Brutal Critical@17"]);
  });

  it("assembles a level-9 berserker with tiered features, speed, and rage pool", () => {
    const draft: CharacterDraft = {
      ...barbarianDraft(9),
      asiBonuses: { str: 4 }, // ASIs at 4 and 8
    };
    expect(validateDraft(draft)).toEqual([]);
    const character = assembleCharacter(draft, "test-id");

    // Fast Movement (level 5): 30 racial + 10.
    expect(character.speed).toBe(40);

    const brutal = character.features.filter(
      (f) => f.name === "Brutal Critical",
    );
    expect(brutal).toHaveLength(1);
    expect(brutal[0].level).toBe(9);
    expect(brutal[0].description).toMatch(/one additional weapon damage die/);

    const names = character.features.map((f) => f.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Reckless Attack",
        "Danger Sense",
        "Extra Attack",
        "Feral Instinct",
        "Frenzy",
        "Mindless Rage",
      ]),
    );
    // Not yet: level 10+ features.
    expect(names).not.toContain("Intimidating Presence");
    expect(names).not.toContain("Relentless Rage");

    expect(character.resources).toEqual([
      {
        id: "rage",
        name: "Rage",
        max: 4,
        used: 0,
        per: "long-rest",
        note: "+3 rage damage",
      },
    ]);
  });

  it("assembles a level-20 berserker: full feature set, Primal Champion +4/+4, unlimited rage", () => {
    const draft: CharacterDraft = {
      ...barbarianDraft(20),
      // Human +1 all: str 16, con 15 before ASIs. 5 ASIs = 10 points.
      asiBonuses: { str: 4, con: 5, dex: 1 },
    };
    expect(validateDraft(draft)).toEqual([]);
    const character = assembleCharacter(draft, "test-id");

    // Primal Champion: +4 STR/CON over the draft's capped-at-20 finals.
    expect(finalAbilityScores(draft).str).toBe(20);
    expect(finalAbilityScores(draft).con).toBe(20);
    expect(character.abilityScores.str).toBe(24);
    expect(character.abilityScores.con).toBe(24);

    // HP uses the improved CON (mod +7): d12 at 1, then 19 × (7 + 7).
    expect(character.maxHp).toBe(startingHp(12, 7, 20));

    expect(character.speed).toBe(40);

    const names = character.features.map((f) => f.name);
    for (const expected of [
      "Rage",
      "Unarmored Defense",
      "Reckless Attack",
      "Danger Sense",
      "Extra Attack",
      "Fast Movement",
      "Feral Instinct",
      "Brutal Critical",
      "Relentless Rage",
      "Persistent Rage",
      "Indomitable Might",
      "Primal Champion",
      "Frenzy",
      "Mindless Rage",
      "Intimidating Presence",
      "Retaliation",
    ]) {
      expect(names).toContain(expected);
    }
    const brutal = character.features.find((f) => f.name === "Brutal Critical");
    expect(brutal?.level).toBe(17);
    expect(brutal?.description).toMatch(/three additional/);

    expect(character.resources[0].max).toBe("unlimited");
    expect(character.resources[0].note).toBe("+4 rage damage");
  });

  it("does not raise a score already at the feature's cap past it", () => {
    // STR 20 + 4 caps at 24; CON left at 16+... stays under the cap.
    const draft: CharacterDraft = {
      ...barbarianDraft(20),
      asiBonuses: { str: 4, dex: 5, wis: 1 }, // con stays 15
    };
    const character = assembleCharacter(draft, "test-id");
    expect(character.abilityScores.str).toBe(24);
    expect(character.abilityScores.con).toBe(19); // 15 + 4, under the 24 cap
  });

  it("copies class armor/weapon/tool proficiencies onto the character (T-20)", () => {
    const character = assembleCharacter(validDraft(), "test-id");
    expect(character.proficiencies).toEqual({
      armor: ["All armor", "Shields"],
      weapons: ["Simple weapons", "Martial weapons"],
      // Class tools plus the hill dwarf's artisan-tool pick (T-08).
      tools: ["Smith's tools"],
    });
  });

  it("records unarmored defense on barbarians (CON, shield ok) and monks (WIS, no shield)", () => {
    const barbarian = assembleCharacter(barbarianDraft(1), "test-id");
    expect(barbarian.unarmoredDefense).toEqual({
      ability: "con",
      shield: true,
    });
    // Human barbarian, dex 13+1=14, con 14+1=15: AC 10 + 2 + 2.
    expect(armorClass(barbarian)).toBe(14);

    const monkDraft: CharacterDraft = {
      ...validDraft(),
      charClass: byId(CLASSES, "monk"),
      classSkills: ["acrobatics", "stealth"],
      equipmentChoices: byId(CLASSES, "monk").equipment.choices.map(() => 0),
    };
    const monk = assembleCharacter(monkDraft, "test-id");
    expect(monk.unarmoredDefense).toEqual({ ability: "wis", shield: false });

    const fighter = assembleCharacter(validDraft(), "test-id");
    expect(fighter.unarmoredDefense).toBeUndefined();
  });

  it("applies monk Unarmored Movement speed tiers and the Ki pool at assembly (T-21)", () => {
    const monk = byId(CLASSES, "monk");
    const draft = (level: number): CharacterDraft => ({
      ...validDraft(),
      race: byId(RACES, "human"), // speed 30
      raceOptions: { "human-language": "elvish" },
      charClass: monk,
      level,
      subclass: level >= 3 ? monk.subclasses[0] : null,
      classSkills: ["acrobatics", "stealth"],
      equipmentChoices: monk.equipment.choices.map(() => 0),
      // 2 points per earned ASI, spread to stay under the 20 cap.
      asiBonuses: (() => {
        const points = monk.asiLevels.filter((l) => l <= level).length * 2;
        return points > 0
          ? { dex: Math.min(points, 4), wis: Math.max(0, points - 4) }
          : {};
      })(),
    });

    // Level 1: no Unarmored Movement yet.
    expect(assembleCharacter(draft(1), "id").speed).toBe(30);
    // Level 6 tier: +15.
    const level6 = assembleCharacter(draft(6), "id");
    expect(level6.speed).toBe(45);
    expect(level6.resources.find((r) => r.id === "ki")).toMatchObject({
      max: 6,
      per: "short-rest",
    });
    // Level 18 tier: +30, and only the highest tier is granted.
    const level18 = assembleCharacter(draft(18), "id");
    expect(level18.speed).toBe(60);
    expect(
      level18.features.filter((f) => f.name === "Unarmored Movement"),
    ).toHaveLength(1);
    expect(
      level18.features.map((f) => f.name),
    ).toEqual(expect.arrayContaining(["Quivering Palm", "Empty Body"]));
  });

  it("supports rolled HP: per-level rolls, CON applied, minimum 1 (T-07)", () => {
    // Human barbarian level 3, con 15+1=16 → +3... use draft's own scores.
    const draft: CharacterDraft = {
      ...barbarianDraft(3),
      hpMode: "rolled",
      hpRolls: [1, 12],
    };
    expect(validateDraft(draft)).toEqual([]);
    const character = assembleCharacter(draft, "id");
    const con = Math.floor((character.abilityScores.con - 10) / 2);
    // Level 1: 12+con; level 2: max(1, 1+con); level 3: max(1, 12+con).
    expect(character.maxHp).toBe(
      Math.max(1, 12 + con) + Math.max(1, 1 + con) + Math.max(1, 12 + con),
    );
  });

  it("validates rolled HP: count and range (T-07)", () => {
    const missing: CharacterDraft = {
      ...barbarianDraft(3),
      hpMode: "rolled",
      hpRolls: [7],
    };
    expect(validateDraft(missing)).toContain(
      "Roll your hit points (2 rolls needed).",
    );

    const outOfRange: CharacterDraft = {
      ...barbarianDraft(3),
      hpMode: "rolled",
      hpRolls: [13, 0],
    };
    expect(validateDraft(outOfRange)).toContain(
      "Hit point rolls must be between 1 and 12.",
    );

    const stale: CharacterDraft = {
      ...barbarianDraft(3),
      hpMode: "average",
      hpRolls: [7, 7],
    };
    expect(validateDraft(stale)).toContain(
      "Hit point rolls are set but the HP mode is average.",
    );
  });

  it("supports starting gold instead of the equipment package (T-07)", () => {
    const draft: CharacterDraft = {
      ...barbarianDraft(1),
      equipmentMode: "gold",
      goldRoll: 60, // barbarian 2d4 × 10: 20..80
      equipmentChoices: [], // no picks needed in gold mode
    };
    expect(validateDraft(draft)).toEqual([]);
    const character = assembleCharacter(draft, "id");
    expect(character.inventory).toEqual([
      {
        id: "gold-gp",
        name: "Gold (gp)",
        quantity: 60,
        equipped: false,
      },
    ]);
  });

  it("validates starting gold: roll required and within the formula's range (T-07)", () => {
    const unrolled: CharacterDraft = {
      ...barbarianDraft(1),
      equipmentMode: "gold",
      goldRoll: null,
    };
    expect(validateDraft(unrolled)).toContain("Roll your starting gold.");

    const impossible: CharacterDraft = {
      ...barbarianDraft(1),
      equipmentMode: "gold",
      goldRoll: 999, // barbarian max is 80
    };
    expect(validateDraft(impossible)).toContain("Roll your starting gold.");
  });

  it("every 2014 class carries a startingGold formula (T-07)", () => {
    for (const cls of CLASSES.filter((c) => c.edition === "2014")) {
      expect(cls.startingGold, cls.id).toBeDefined();
    }
  });

  it("gives level-1 characters only level-1 features and the level-1 rage pool", () => {
    const character = assembleCharacter(barbarianDraft(1), "test-id");
    const classFeatures = character.features.filter(
      (f) => f.source === "Barbarian",
    );
    expect(classFeatures.map((f) => f.name).sort()).toEqual([
      "Rage",
      "Unarmored Defense",
    ]);
    expect(character.speed).toBe(30);
    expect(character.resources[0]).toMatchObject({ max: 2, used: 0 });
  });
});

describe("subclasses and feature choices", () => {
  it("requires a subclass once the class's subclass level is reached", () => {
    // Cleric picks a domain at level 1.
    const cleric: CharacterDraft = {
      ...validDraft(),
      charClass: byId(CLASSES, "cleric"),
      classSkills: ["history", "medicine"],
      equipmentChoices: byId(CLASSES, "cleric").equipment.choices.map(() => 0),
      featurePicks: {},
    };
    expect(validateDraft(cleric)).toContain("Choose a subclass.");
    expect(subclassRequired(cleric)).toBe(true);

    // Fighter doesn't owe one until level 3.
    expect(subclassRequired(validDraft())).toBe(false);
    expect(validateDraft(validDraft())).toEqual([]);
  });

  it("rejects a subclass set before its level or from another class", () => {
    const early: CharacterDraft = {
      ...validDraft(),
      subclass: byId(CLASSES, "fighter").subclasses[0],
    };
    expect(validateDraft(early)).toContain(
      "Fighter has no subclass at level 1.",
    );

    const wrong: CharacterDraft = {
      ...leveledDraft(3),
      subclass: byId(CLASSES, "rogue").subclasses[0],
    };
    expect(validateDraft(wrong)).toContain(
      "The chosen subclass does not belong to the class.",
    );
  });

  it("copies subclass traits and records the subclass on the class entry", () => {
    const character = assembleCharacter(leveledDraft(3), "test-id");
    expect(character.classes).toEqual([
      { name: "Fighter", level: 3, subclass: "Champion" },
    ]);
    const improvedCritical = character.features.find(
      (f) => f.name === "Improved Critical",
    );
    expect(improvedCritical?.source).toBe("Champion");
  });

  it("turns option picks into features (fighting style)", () => {
    const character = assembleCharacter(validDraft(), "test-id");
    const style = character.features.find(
      (f) => f.name === "Fighting Style: Archery",
    );
    expect(style?.source).toBe("Fighter");
    expect(style?.description).toMatch(/ranged/);
  });

  it("gates and validates option picks", () => {
    const missing: CharacterDraft = { ...validDraft(), featurePicks: {} };
    expect(validateDraft(missing)).toContain(
      "Choose 1 option for Fighting Style.",
    );

    const bogus: CharacterDraft = {
      ...validDraft(),
      featurePicks: { "fighting-style": ["Flying"] },
    };
    expect(validateDraft(bogus)).toContain(
      "A Fighting Style pick is not one of its options.",
    );

    // The pact boon is owed at level 3, not at level 1.
    const warlock: CharacterDraft = {
      ...validDraft(),
      charClass: byId(CLASSES, "warlock"),
      classSkills: ["arcana", "deception"],
      equipmentChoices: byId(CLASSES, "warlock").equipment.choices.map(() => 0),
      featurePicks: {},
      subclass: byId(CLASSES, "warlock").subclasses[0],
    };
    expect(validateDraft(warlock)).toEqual([]);
    const warlock3: CharacterDraft = { ...warlock, level: 3 };
    expect(validateDraft(warlock3)).toContain(
      "Choose 1 option for Pact Boon.",
    );
  });

  it("upgrades expertise picks and rejects non-proficient ones", () => {
    const rogue: CharacterDraft = {
      ...validDraft(),
      charClass: byId(CLASSES, "rogue"),
      classSkills: ["stealth", "acrobatics", "deception", "perception"],
      equipmentChoices: byId(CLASSES, "rogue").equipment.choices.map(() => 0),
      featurePicks: { expertise: ["stealth", "perception"] },
    };
    expect(validateDraft(rogue)).toEqual([]);
    const character = assembleCharacter(rogue, "test-id");
    expect(character.skills.stealth).toBe("expertise");
    expect(character.skills.perception).toBe("expertise");
    expect(character.skills.acrobatics).toBe("proficient");

    const bad: CharacterDraft = {
      ...rogue,
      featurePicks: { expertise: ["stealth", "athletics"] },
    };
    expect(validateDraft(bad)).toContain(
      "Expertise picks must be proficient skills.",
    );
  });

  it("rejects the same skill gaining expertise twice at level 6", () => {
    const rogue6: CharacterDraft = {
      ...validDraft(),
      charClass: byId(CLASSES, "rogue"),
      level: 6,
      subclass: byId(CLASSES, "rogue").subclasses[0],
      asiBonuses: { dex: 2 },
      classSkills: ["stealth", "acrobatics", "deception", "perception"],
      equipmentChoices: byId(CLASSES, "rogue").equipment.choices.map(() => 0),
      featurePicks: {
        expertise: ["stealth", "perception"],
        "expertise-6": ["stealth", "acrobatics"],
      },
    };
    expect(validateDraft(rogue6)).toContain(
      "Each skill can only gain expertise once.",
    );
  });

  it("adds skill proficiencies from skills-kind choices (Lore bard)", () => {
    const bard: CharacterDraft = {
      ...validDraft(),
      charClass: byId(CLASSES, "bard"),
      level: 3,
      subclass: byId(CLASSES, "bard").subclasses[0],
      classSkills: ["performance", "persuasion", "deception"],
      equipmentChoices: byId(CLASSES, "bard").equipment.choices.map(() => 0),
      featurePicks: {
        expertise: ["performance", "persuasion"],
        "lore-proficiencies": ["arcana", "history", "nature"],
      },
    };
    expect(validateDraft(bard)).toEqual([]);
    const character = assembleCharacter(bard, "test-id");
    expect(character.skills.arcana).toBe("proficient");
    expect(character.skills.history).toBe("proficient");
    expect(character.classes[0].subclass).toBe("College of Lore");
  });
});
