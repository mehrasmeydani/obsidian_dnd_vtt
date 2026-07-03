import { describe, expect, it } from "vitest";
import { ContentStore } from "./contentStore";
import { BACKGROUNDS, CLASSES, RACES } from "./srd";
import type { ContentBundle, RaceData } from "./contentSchema";

/**
 * Merge/override rules for the content store (T-11): the bundled SRD is the
 * base layer, added bundles override by entity id in load order, and
 * disabled bundles drop out of the merge without being forgotten.
 */

function homebrewRace(id: string, name: string): RaceData {
  return {
    id,
    name,
    speed: 30,
    fixedBonuses: { con: 2 },
    traits: [{ name: "Homebrew Trait" }],
    optionChoices: [],
  };
}

function bundle(name: string, races: RaceData[]): ContentBundle {
  return { name, races, classes: [], backgrounds: [], feats: [], armor: [] };
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
