import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  backgroundFromFiveEtools,
  classesFromFiveEtools,
  featFromFiveEtools,
  itemFromFiveEtools,
  importFiveEtools,
  raceFromFiveEtools,
  renderEntries,
  resolveCopies,
  spellFromFiveEtools,
  stripTags,
} from "./fiveEtoolsImport";
import { parseContentBundle } from "./contentSchema";

/**
 * T-13 tests: the converter is pure and runs against fixture snippets of
 * the 5etools format (plus the checked-in reference files as an
 * integration sweep — reference data never ships). Unmappable records are
 * reported by name, never silently dropped.
 */

// --- Markup ------------------------------------------------------------

describe("stripTags", () => {
  it("prefers display text and falls back to the name", () => {
    expect(stripTags("a {@item battleaxe|phb} and {@skill History}")).toBe(
      "a battleaxe and History",
    );
    expect(stripTags("{@item arrows (20)|phb|20 arrows}")).toBe("20 arrows");
    expect(stripTags("{@dice 5d4 × 10|5d4 × 10|Starting Gold}")).toBe(
      "Starting Gold",
    );
  });
});

describe("renderEntries", () => {
  it("flattens nested entries, lists, and items", () => {
    const text = renderEntries([
      "You gain the following benefits:",
      {
        type: "list",
        items: [
          "Advantage on grapples.",
          { type: "item", name: "Pin:", entry: "Make another {@skill Athletics} check." },
        ],
      },
      { type: "entries", name: "Detail", entries: ["More text."] },
    ]);
    expect(text).toContain("You gain the following benefits:");
    expect(text).toContain("Advantage on grapples.");
    expect(text).toContain("Pin: Make another Athletics check.");
    expect(text).toContain("Detail. More text.");
  });

  it("renders tables as caption, header, and rows (Wild Magic Surge…)", () => {
    const text = renderEntries({
      type: "table",
      caption: "Wild Magic Surge",
      colLabels: ["{@dice d100}", "Effect"],
      rows: [
        ["01-02", "Roll again next turn."],
        ["03-04", "You see {@condition invisible} creatures."],
      ],
    });
    expect(text).toContain("Wild Magic Surge");
    expect(text).toContain("d100 | Effect");
    expect(text).toContain("01-02 | Roll again next turn.");
    expect(text).toContain("03-04 | You see invisible creatures.");
  });

  it("renders ability DC and attack-mod blocks as formulas", () => {
    expect(
      renderEntries({ type: "abilityDc", name: "Spell", attributes: ["wis"] }),
    ).toBe("Spell save DC = 8 + your proficiency bonus + your Wisdom modifier");
    expect(
      renderEntries({
        type: "abilityAttackMod",
        name: "Spell",
        attributes: ["int", "cha"],
      }),
    ).toBe(
      "Spell attack modifier = your proficiency bonus + your Intelligence or Charisma modifier",
    );
  });
});

// --- Races --------------------------------------------------------------

const DWARF = {
  name: "Dwarf",
  source: "PHB",
  speed: 25,
  ability: [{ con: 2 }],
  entries: [
    { name: "Darkvision", type: "entries", entries: ["You can see in the dark."] },
    { name: "Dwarven Resilience", type: "entries", entries: ["Poison resistance."] },
  ],
};

const HALF_ELF = {
  name: "Half-Elf",
  source: "PHB",
  speed: 30,
  ability: [{ cha: 2, choose: { from: ["str", "dex", "con", "int", "wis"], count: 2 } }],
  skillProficiencies: [{ any: 2 }],
  entries: [],
};

describe("raceFromFiveEtools", () => {
  it("maps fixed bonuses, speed, and traits", () => {
    const race = raceFromFiveEtools(DWARF);
    expect(race).toMatchObject({
      id: "5etools-race-dwarf-phb",
      name: "Dwarf",
      speed: 25,
      fixedBonuses: { con: 2 },
    });
    expect(race.traits.map((t) => t.name)).toEqual([
      "Darkvision",
      "Dwarven Resilience",
    ]);
  });

  it("maps choose-N ability bonuses and any-skill choices", () => {
    const race = raceFromFiveEtools(HALF_ELF);
    expect(race.bonusChoice).toEqual({ count: 2, amount: 1 });
    expect(race.skillChoice).toEqual({ count: 2, from: "any" });
  });

  it("rejects _copy variants with a reason", () => {
    expect(() =>
      raceFromFiveEtools({ name: "Variant", _copy: { name: "Dwarf" } }),
    ).toThrow(/_copy/);
  });
});

// --- Classes --------------------------------------------------------------

const FIGHTER_FILE = {
  class: [
    {
      name: "Fighter",
      source: "PHB",
      hd: { number: 1, faces: 10 },
      proficiency: ["str", "con"],
      startingProficiencies: {
        armor: ["light", "medium", "heavy", "shield"],
        weapons: ["simple", "martial"],
        skills: [{ choose: { from: ["acrobatics", "athletics", "history"], count: 2 } }],
      },
      startingEquipment: {
        defaultData: [
          { a: ["chain mail|phb"], b: ["leather armor|phb", "longbow|phb"] },
          { a: [{ equipmentType: "weaponMartial" }, "shield|phb"], b: [{ equipmentType: "weaponMartial", quantity: 2 }] },
          { _: ["dungeoneer's pack|phb"] },
        ],
      },
      classFeatures: [
        "Fighting Style|Fighter||1",
        "Second Wind|Fighter||1",
        "Action Surge|Fighter||2",
        { classFeature: "Martial Archetype|Fighter||3", gainSubclassFeature: true },
        "Ability Score Improvement|Fighter||4",
        "Extra Attack|Fighter||5",
        "Ability Score Improvement|Fighter||6",
      ],
    },
  ],
  subclass: [
    {
      name: "Champion",
      shortName: "Champion",
      source: "PHB",
      className: "Fighter",
      classSource: "PHB",
      subclassFeatures: [
        "Champion|Fighter||Champion||3",
        "Improved Critical|Fighter||Champion||3",
        "Remarkable Athlete|Fighter||Champion||7",
      ],
    },
  ],
  classFeature: [
    {
      name: "Second Wind",
      className: "Fighter",
      level: 1,
      source: "PHB",
      entries: ["You have a limited well of stamina: regain {@dice 1d10} + your fighter level."],
    },
  ],
  subclassFeature: [
    {
      name: "Improved Critical",
      className: "Fighter",
      subclassShortName: "Champion",
      level: 3,
      source: "PHB",
      entries: ["Your weapon attacks score a critical hit on a roll of 19 or 20."],
    },
  ],
};

describe("classesFromFiveEtools", () => {
  const { classes, skipped } = classesFromFiveEtools(FIGHTER_FILE);
  const fighter = classes[0];

  it("maps the class core (hit die, saves, skills, proficiencies)", () => {
    expect(skipped).toEqual([]);
    expect(fighter).toMatchObject({
      id: "5etools-class-fighter-phb",
      name: "Fighter",
      edition: "2014",
      hitDie: 10,
      savingThrows: ["str", "con"],
      skillChoice: { count: 2, from: ["acrobatics", "athletics", "history"] },
    });
    expect(fighter.proficiencies.armor).toContain("Heavy armor");
    expect(fighter.proficiencies.weapons).toEqual([
      "Simple weapons",
      "Martial weapons",
    ]);
  });

  it("derives ASI levels and the subclass level from feature refs", () => {
    expect(fighter.asiLevels).toEqual([4, 6]);
    expect(fighter.subclassLevel).toBe(3);
    expect(fighter.features.map((f) => f.name)).not.toContain(
      "Ability Score Improvement",
    );
  });

  it("attaches feature descriptions from the lookup table", () => {
    const secondWind = fighter.features.find((f) => f.name === "Second Wind");
    expect(secondWind?.level).toBe(1);
    expect(secondWind?.description).toContain("1d10 + your fighter level");
  });

  it("maps subclasses with their leveled features", () => {
    expect(fighter.subclasses).toHaveLength(1);
    const champion = fighter.subclasses[0];
    expect(champion.name).toBe("Champion");
    const improvedCritical = champion.features.find(
      (f) => f.name === "Improved Critical",
    );
    expect(improvedCritical?.level).toBe(3);
    expect(improvedCritical?.description).toContain("19 or 20");
  });

  it("maps starting equipment fixed items and pick-one choices", () => {
    expect(fighter.equipment.fixed).toEqual([{ name: "dungeoneer's pack" }]);
    expect(fighter.equipment.choices).toHaveLength(2);
    expect(fighter.equipment.choices[0].options[0]).toEqual([
      { name: "chain mail" },
    ]);
    expect(fighter.equipment.choices[1].options[1]).toEqual([
      { name: "Any martial weapon", quantity: 2 },
    ]);
  });

  it("reports classes it cannot map by name", () => {
    const { classes: none, skipped: reasons } = classesFromFiveEtools({
      class: [{ name: "Broken Class", source: "HB" }],
    });
    expect(none).toEqual([]);
    expect(reasons[0]).toContain("Broken Class");
  });

  it("ignores sidekick pseudo-classes by design", () => {
    const { classes: none, skipped: reasons } = classesFromFiveEtools({
      class: [{ name: "Expert Sidekick", source: "TCE" }],
    });
    expect(none).toEqual([]);
    expect(reasons[0]).toContain("ignored — sidekick classes are not supported");
  });

  it("follows feature refs nested inside a wrapper feature's entries", () => {
    // 5etools wraps a subclass's real mechanics: the level-3 "Path of X"
    // record is flavor plus refSubclassFeature pointers (Wild Magic's
    // Magic Awareness / Wild Surge). They must arrive as features too.
    const file = {
      class: [FIGHTER_FILE.class[0]],
      subclass: [
        {
          name: "Wrapped",
          shortName: "Wrapped",
          source: "PHB",
          className: "Fighter",
          classSource: "PHB",
          subclassFeatures: ["Wrapped|Fighter||Wrapped||3"],
        },
      ],
      classFeature: FIGHTER_FILE.classFeature,
      subclassFeature: [
        {
          name: "Wrapped",
          className: "Fighter",
          subclassShortName: "Wrapped",
          level: 3,
          source: "PHB",
          entries: [
            "Flavor text only.",
            {
              type: "refSubclassFeature",
              subclassFeature: "Hidden Mechanic|Fighter||Wrapped|PHB|3",
            },
          ],
        },
        {
          name: "Hidden Mechanic",
          className: "Fighter",
          subclassShortName: "Wrapped",
          level: 3,
          source: "PHB",
          entries: ["The actual level-3 rules text."],
        },
      ],
    };
    const { classes } = classesFromFiveEtools(file);
    const wrapped = classes[0].subclasses.find((s) => s.name === "Wrapped");
    expect(wrapped?.features.map((f) => `${f.level}:${f.name}`)).toEqual([
      "3:Wrapped",
      "3:Hidden Mechanic",
    ]);
    expect(
      wrapped?.features.find((f) => f.name === "Hidden Mechanic")?.description,
    ).toContain("actual level-3 rules text");
  });

  it("resolves _copy subclass stubs against same-file bases (T-43)", () => {
    // The XPHB-style re-listing: a copy stub re-parents the PHB Champion
    // under a second class; it must arrive with the base's features.
    const file = {
      class: [
        FIGHTER_FILE.class[0],
        { ...FIGHTER_FILE.class[0], source: "XPHB" },
      ],
      subclass: [
        ...FIGHTER_FILE.subclass,
        {
          name: "Champion",
          shortName: "Champion",
          source: "PHB",
          className: "Fighter",
          classSource: "XPHB",
          _copy: {
            name: "Champion",
            source: "PHB",
            shortName: "Champion",
            className: "Fighter",
            classSource: "PHB",
          },
        },
      ],
      classFeature: FIGHTER_FILE.classFeature,
      subclassFeature: FIGHTER_FILE.subclassFeature,
    };
    const { classes, skipped } = classesFromFiveEtools(file);
    const fighter2024 = classes.find((c) => c.edition === "2024");
    expect(fighter2024?.subclasses.map((s) => s.name)).toEqual(["Champion"]);
    // The resolved copy carries the base's leveled features.
    expect(
      fighter2024?.subclasses[0].features.map((f) => `${f.level}:${f.name}`),
    ).toEqual(["3:Champion", "3:Improved Critical", "7:Remarkable Athlete"]);
    expect(skipped.filter((line) => line.includes("_copy"))).toEqual([]);
  });

  it("skips a _copy subclass whose base is not in the file", () => {
    const file = {
      class: [FIGHTER_FILE.class[0]],
      subclass: [
        ...FIGHTER_FILE.subclass,
        {
          name: "Orphan Copy",
          shortName: "Orphan Copy",
          source: "XGE",
          className: "Fighter",
          classSource: "PHB",
          _copy: { name: "Not In This File", source: "PHB" },
        },
      ],
      classFeature: FIGHTER_FILE.classFeature,
      subclassFeature: FIGHTER_FILE.subclassFeature,
    };
    const { classes, skipped } = classesFromFiveEtools(file);
    expect(classes[0].subclasses.map((s) => s.name)).toEqual(["Champion"]);
    expect(
      skipped.find((line) => line.includes("Orphan Copy")),
    ).toContain("unresolved _copy");
  });

  it("applies _mod entry edits when resolving a _copy (T-43)", () => {
    const raceFile = [
      {
        name: "Dwarf",
        source: "PHB",
        speed: 25,
        ability: [{ con: 2 }],
        entries: [
          { name: "Darkvision", type: "entries", entries: ["See in the dark."] },
          { name: "Stonecunning", type: "entries", entries: ["Know stone."] },
        ],
      },
      {
        name: "Variant Dwarf",
        source: "HB",
        _copy: {
          name: "Dwarf",
          source: "PHB",
          _mod: {
            entries: [
              {
                mode: "replaceArr",
                replace: "Stonecunning",
                items: {
                  name: "Metalcunning",
                  type: "entries",
                  entries: ["Know metal instead."],
                },
              },
              {
                mode: "appendArr",
                items: { name: "Extra Trait", type: "entries", entries: ["More."] },
              },
            ],
          },
        },
      },
    ];
    const { records, skipped } = resolveCopies(raceFile, "race");
    expect(skipped).toEqual([]);
    const variant = raceFromFiveEtools(
      records.find((r) => (r as { name: string }).name === "Variant Dwarf"),
    );
    expect(variant.speed).toBe(25); // inherited from the base
    expect(variant.traits.map((t) => t.name)).toEqual([
      "Darkvision",
      "Metalcunning",
      "Extra Trait",
    ]);
  });

  it("maps 5etools editions: 'one' → 2024, 'classic'/absent → 2014", () => {
    const base = FIGHTER_FILE.class[0];
    const { classes } = classesFromFiveEtools({
      class: [
        { ...base, name: "Artificer", source: "EFA", edition: "one" },
        { ...base, name: "Artificer", source: "TCE", edition: "classic" },
        { ...base, name: "Mystic", source: "UATheMysticClass", edition: "classic" },
        { ...base, name: "Fighter", source: "XPHB" }, // legacy files: no field
      ],
    });
    expect(classes.map((c) => [c.name, c.edition])).toEqual([
      ["Artificer", "2024"],
      ["Artificer", "2014"],
      ["Mystic", "2014"],
      ["Fighter", "2024"],
    ]);
  });
});

// --- Backgrounds / feats ---------------------------------------------------

describe("backgroundFromFiveEtools", () => {
  const ACOLYTE = {
    name: "Acolyte",
    source: "PHB",
    skillProficiencies: [{ insight: true, religion: true }],
    startingEquipment: [
      {
        _: [
          { item: "holy symbol|phb", displayName: "holy symbol (a gift)" },
          { special: "sticks of incense", quantity: 5 },
          "common clothes|phb",
        ],
      },
      { a: [{ item: "book|phb", displayName: "prayer book" }], b: [{ special: "prayer wheel" }] },
    ],
    entries: [
      {
        type: "list",
        items: [
          { type: "item", name: "Skill Proficiencies:", entry: "{@skill Insight}, {@skill Religion}" },
        ],
      },
      {
        name: "Feature: Shelter of the Faithful",
        type: "entries",
        entries: ["You command the respect of those who share your faith."],
        data: { isFeature: true },
      },
    ],
  };

  it("maps skills, equipment, and the background feature", () => {
    const background = backgroundFromFiveEtools(ACOLYTE);
    expect(background.grantedSkills.sort()).toEqual(["insight", "religion"]);
    expect(background.equipment).toEqual([
      { name: "holy symbol (a gift)" },
      { name: "sticks of incense", quantity: 5 },
      { name: "common clothes" },
      { name: "prayer book" },
    ]);
    expect(background.traits).toEqual([
      {
        name: "Shelter of the Faithful",
        description: "You command the respect of those who share your faith.",
      },
    ]);
    expect(background.description).toContain("Insight, Religion");
  });
});

describe("featFromFiveEtools", () => {
  it("maps name and rendered description", () => {
    const feat = featFromFiveEtools({
      name: "Grappler",
      source: "PHB",
      entries: ["You've developed grappling skills.", { type: "list", items: ["Advantage on grapples."] }],
    });
    expect(feat.id).toBe("5etools-feat-grappler-phb");
    expect(feat.description).toContain("Advantage on grapples.");
  });
});

// --- Items -------------------------------------------------------------

describe("itemFromFiveEtools", () => {
  it("maps a magic item with type code, rarity and attunement", () => {
    const item = itemFromFiveEtools({
      name: "Ring of Protection",
      source: "DMG",
      type: "RG|DMG",
      rarity: "rare",
      reqAttune: true,
      entries: ["You gain a +1 bonus to AC and saving throws."],
    });
    expect(item).toMatchObject({
      id: "5etools-item-ring-of-protection-dmg",
      name: "Ring of Protection",
      type: "Ring",
      rarity: "rare",
      requiresAttunement: true,
    });
    expect(item.description).toContain("+1 bonus to AC");
  });

  it("treats wondrous items, conditional attunement, and 'none' rarity", () => {
    const item = itemFromFiveEtools({
      name: "Holy Avenger Cloak",
      source: "TST",
      wondrous: true,
      rarity: "none",
      reqAttune: "by a paladin",
      entries: [],
    });
    expect(item.type).toBe("Wondrous item");
    expect(item.rarity).toBeUndefined();
    expect(item.requiresAttunement).toBe(true);
  });

  it("maps a mundane baseitem", () => {
    const item = itemFromFiveEtools({
      name: "Longsword",
      source: "PHB",
      type: "M",
      rarity: "none",
    });
    expect(item.type).toBe("Melee weapon");
    expect(item.requiresAttunement).toBe(false);
  });
});

// --- Spells ------------------------------------------------------------

describe("spellFromFiveEtools", () => {
  const FIREBALL = {
    name: "Fireball",
    source: "PHB",
    level: 3,
    school: "V",
    time: [{ number: 1, unit: "action" }],
    range: { type: "point", distance: { type: "feet", amount: 150 } },
    components: { v: true, s: true, m: "a tiny ball of bat guano and sulfur" },
    duration: [{ type: "instant" }],
    entries: ["A bright streak flashes from your pointing finger."],
    entriesHigherLevel: [
      { type: "entries", name: "At Higher Levels", entries: ["+1d6 per slot level above 3rd."] },
    ],
    classes: { fromClassList: [{ name: "Sorcerer", source: "PHB" }, { name: "Wizard", source: "PHB" }] },
  };

  it("maps a leveled spell", () => {
    const spell = spellFromFiveEtools(FIREBALL);
    expect(spell).toMatchObject({
      id: "5etools-spell-fireball-phb",
      name: "Fireball",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M (a tiny ball of bat guano and sulfur)",
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      classes: ["sorcerer", "wizard"],
    });
    expect(spell.higherLevels).toContain("+1d6");
  });

  it("maps concentration durations and ritual meta", () => {
    const spell = spellFromFiveEtools({
      name: "Detect Magic",
      level: 1,
      school: "D",
      time: [{ number: 1, unit: "action" }],
      range: { type: "point", distance: { type: "self" } },
      components: { v: true, s: true },
      duration: [
        { type: "timed", duration: { type: "minute", amount: 10 }, concentration: true },
      ],
      meta: { ritual: true },
      entries: ["You sense magic within 30 feet."],
    });
    expect(spell.duration).toBe("Concentration, up to 10 minutes");
    expect(spell.concentration).toBe(true);
    expect(spell.ritual).toBe(true);
    expect(spell.range).toBe("Self");
  });
});

// --- Whole files ------------------------------------------------------------

describe("importFiveEtools", () => {
  it("aggregates several files into one valid bundle and reports skips", () => {
    const { bundle, skipped } = importFiveEtools([
      { name: "races.json", json: { race: [DWARF, { name: "Broken" }] } },
      { name: "class-fighter.json", json: FIGHTER_FILE },
      { name: "weird.json", json: { monster: [], deity: [] } },
    ]);

    expect(bundle.races.map((r) => r.name)).toEqual(["Dwarf"]);
    expect(bundle.classes.map((c) => c.name)).toEqual(["Fighter"]);
    expect(skipped.some((line) => line.includes("Broken"))).toBe(true);
    expect(skipped.some((line) => line.includes("weird.json"))).toBe(true);

    expect(() =>
      parseContentBundle(JSON.parse(JSON.stringify(bundle))),
    ).not.toThrow();
  });

  // The reference data is WotC-copyrighted and git-ignored (local-only,
  // see docs/reference/README.md): this sweep runs when a developer has
  // their own copy on disk and skips cleanly everywhere else (CI).
  const REFERENCE_DIR = join(__dirname, "../../docs/reference/5etools");

  it.skipIf(!existsSync(join(REFERENCE_DIR, "races.json")))(
    "converts the real 5etools reference files into a valid bundle",
    () => {
    const reference = (file: string): unknown =>
      JSON.parse(readFileSync(join(REFERENCE_DIR, file), "utf8"));
    const { bundle, skipped } = importFiveEtools([
      { name: "races.json", json: reference("races.json") },
      { name: "backgrounds.json", json: reference("backgrounds.json") },
      { name: "feats.json", json: reference("feats.json") },
      { name: "class-fighter.json", json: reference("class-fighter.json") },
      { name: "class-wizard.json", json: reference("class-wizard.json") },
    ]);

    expect(bundle.races.length).toBeGreaterThan(20);
    expect(bundle.backgrounds.length).toBeGreaterThan(10);
    expect(bundle.feats.length).toBeGreaterThan(20);
    expect(bundle.classes.map((c) => c.name)).toContain("Fighter");
    expect(bundle.classes.map((c) => c.name)).toContain("Wizard");

    const fighter = bundle.classes.find(
      (c) => c.id === "5etools-class-fighter-phb",
    );
    expect(fighter?.asiLevels).toContain(4);
    expect(fighter?.subclassLevel).toBe(3);
    expect(fighter?.subclasses.length).toBeGreaterThan(0);

    // Nothing silently dropped: whatever failed is named in the report.
    for (const line of skipped) expect(typeof line).toBe("string");
    expect(() =>
      parseContentBundle(JSON.parse(JSON.stringify(bundle))),
    ).not.toThrow();
  });
});
