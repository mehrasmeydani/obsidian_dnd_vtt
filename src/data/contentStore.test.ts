import { describe, expect, it } from "vitest";
import { ContentStore } from "./contentStore";
import { BACKGROUNDS, CLASSES, RACES } from "./srd";
import type {
  ClassData,
  ContentBundle,
  RaceData,
  SubclassData,
} from "./contentSchema";

/**
 * Merge/override rules for the content store (T-11): the bundled SRD is the
 * base layer, added bundles override by entity id in load order, and
 * disabled bundles drop out of the merge without being forgotten.
 */

function homebrewRace(id: string, name: string): RaceData {
  return {
    id,
    name,
    edition: "2014",
    speed: 30,
    fixedBonuses: { con: 2 },
    traits: [{ name: "Homebrew Trait" }],
    languages: [],
    tools: [],
    optionChoices: [],
  };
}

function bundle(name: string, races: RaceData[]): ContentBundle {
  return {
    name,
    races,
    classes: [],
    backgrounds: [],
    feats: [],
    armor: [],
    spells: [],
    monsters: [],
    items: [],
  };
}

function subclass(id: string, name: string): SubclassData {
  return { id, name, features: [], featureChoices: [] };
}

/** A minimal imported-style class (a distinct id from any SRD entry). */
function importedClass(
  id: string,
  name: string,
  edition: "2014" | "2024",
  subclasses: SubclassData[],
): ClassData {
  return {
    id,
    name,
    edition,
    hitDie: 12,
    savingThrows: ["str", "con"],
    skillChoice: { count: 2, from: "any" },
    features: [],
    proficiencies: { armor: [], weapons: [], tools: [] },
    resources: [],
    asiLevels: [4],
    equipment: { fixed: [], choices: [] },
    subclassLevel: subclasses.length > 0 ? 3 : undefined,
    subclasses,
    featureChoices: [],
  };
}

function classBundle(name: string, classes: ClassData[]): ContentBundle {
  return { ...bundle(name, []), classes };
}

describe("ContentStore", () => {
  it("serves the bundled SRD by default", () => {
    const store = new ContentStore();
    expect(store.races).toEqual(RACES);
    expect(store.classes).toEqual(CLASSES);
    expect(store.backgrounds).toEqual(BACKGROUNDS);
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]).toMatchObject({ id: "srd", builtin: true });
  });

  it("appends new entities from added bundles", () => {
    const store = new ContentStore();
    store.addBundle("homebrew.json", bundle("Homebrew", [
      homebrewRace("goblin", "Goblin"),
    ]));
    expect(store.races).toHaveLength(RACES.length + 1);
    expect(store.races.find((r) => r.id === "goblin")?.name).toBe("Goblin");
    // Other entity types are untouched.
    expect(store.classes).toEqual(CLASSES);
  });

  it("overrides SRD entities by id, keeping their position", () => {
    const store = new ContentStore();
    store.addBundle("homebrew.json", bundle("Homebrew", [
      homebrewRace("human", "Variant Human"),
    ]));
    expect(store.races).toHaveLength(RACES.length);
    const humanIndex = store.races.findIndex((r) => r.id === "human");
    expect(humanIndex).toBe(RACES.findIndex((r) => r.id === "human"));
    expect(store.races[humanIndex].name).toBe("Variant Human");
  });

  it("lets later bundles override earlier ones", () => {
    const store = new ContentStore();
    store.addBundle("a.json", bundle("A", [homebrewRace("goblin", "Goblin A")]));
    store.addBundle("b.json", bundle("B", [homebrewRace("goblin", "Goblin B")]));
    expect(store.races.find((r) => r.id === "goblin")?.name).toBe("Goblin B");
  });

  it("re-adding an id replaces the bundle in place", () => {
    const store = new ContentStore();
    store.addBundle("a.json", bundle("A v1", [homebrewRace("goblin", "Old")]));
    store.addBundle("a.json", bundle("A v2", [homebrewRace("goblin", "New")]));
    expect(store.list()).toHaveLength(2);
    expect(store.races.find((r) => r.id === "goblin")?.name).toBe("New");
  });

  it("excludes disabled bundles from the merge and re-includes on enable", () => {
    const store = new ContentStore();
    store.addBundle("homebrew.json", bundle("Homebrew", [
      homebrewRace("goblin", "Goblin"),
    ]));
    store.setEnabled("homebrew.json", false);
    expect(store.races.find((r) => r.id === "goblin")).toBeUndefined();
    expect(store.list().find((e) => e.id === "homebrew.json")?.enabled).toBe(
      false,
    );

    store.setEnabled("homebrew.json", true);
    expect(store.races.find((r) => r.id === "goblin")).toBeDefined();
  });

  it("can load a bundle disabled (persisted setting) without merging it", () => {
    const store = new ContentStore();
    store.addBundle(
      "homebrew.json",
      bundle("Homebrew", [homebrewRace("goblin", "Goblin")]),
      false,
    );
    expect(store.races.find((r) => r.id === "goblin")).toBeUndefined();
  });

  it("never disables the built-in SRD", () => {
    const store = new ContentStore();
    store.setEnabled("srd", false);
    expect(store.races).toEqual(RACES);
  });
});

describe("subclass folding (same class name + edition)", () => {
  it("folds an imported class's new subclasses into the SRD card", () => {
    const store = new ContentStore();
    store.addBundle(
      "phb-import.json",
      classBundle("PHB import", [
        importedClass("class-barbarian-phb", "Barbarian", "2014", [
          subclass("path-of-the-berserker-phb", "Path of the Berserker"),
          subclass("path-of-the-totem-warrior-phb", "Path of the Totem Warrior"),
        ]),
      ]),
    );

    // One Barbarian 2014 card, not two.
    const barbarians = store.classes.filter(
      (c) => c.name === "Barbarian" && c.edition === "2014",
    );
    expect(barbarians).toHaveLength(1);
    expect(barbarians[0].id).toBe("barbarian"); // the SRD entry stays canonical
    // Its subclass list gains the import's new entry; the same-named
    // Berserker is not duplicated.
    expect(barbarians[0].subclasses.map((s) => s.name).sort()).toEqual([
      "Path of the Berserker",
      "Path of the Totem Warrior",
    ]);
    expect(
      barbarians[0].subclasses.filter(
        (s) => s.name === "Path of the Berserker",
      ),
    ).toHaveLength(1);
    // The SRD's own Berserker (with its curated features) wins the tie.
    expect(
      barbarians[0].subclasses.find((s) => s.name === "Path of the Berserker")
        ?.id,
    ).toBe("path-of-the-berserker");
  });

  it("keeps same-named classes of different editions as separate cards", () => {
    const store = new ContentStore();
    store.addBundle(
      "xphb-import.json",
      classBundle("XPHB import", [
        importedClass("class-barbarian-xphb", "Barbarian", "2024", [
          subclass("path-of-the-world-tree-xphb", "Path of the World Tree"),
        ]),
      ]),
    );
    // The 2024 import folds into the 2024 card only; 2014 is untouched.
    const b2014 = store.classes.find(
      (c) => c.name === "Barbarian" && c.edition === "2014",
    );
    const b2024 = store.classes.find(
      (c) => c.name === "Barbarian" && c.edition === "2024",
    );
    expect(b2014?.subclasses.map((s) => s.name)).toEqual([
      "Path of the Berserker",
    ]);
    expect(b2024?.subclasses.map((s) => s.name).sort()).toEqual([
      "Path of the Berserker",
      "Path of the World Tree",
    ]);
  });

  it("still overrides outright when the id matches", () => {
    const store = new ContentStore();
    const replacement = importedClass("barbarian", "Barbarian", "2014", [
      subclass("only-sub", "Only Sub"),
    ]);
    store.addBundle("override.json", classBundle("Override", [replacement]));
    const barbarian = store.classes.find((c) => c.id === "barbarian");
    expect(barbarian?.subclasses.map((s) => s.name)).toEqual(["Only Sub"]);
  });

  it("does not fold from disabled bundles", () => {
    const store = new ContentStore();
    store.addBundle(
      "phb-import.json",
      classBundle("PHB import", [
        importedClass("class-barbarian-phb", "Barbarian", "2014", [
          subclass("path-of-the-totem-warrior-phb", "Path of the Totem Warrior"),
        ]),
      ]),
      false,
    );
    const barbarian = store.classes.find((c) => c.id === "barbarian");
    expect(barbarian?.subclasses.map((s) => s.name)).toEqual([
      "Path of the Berserker",
    ]);
  });
});
