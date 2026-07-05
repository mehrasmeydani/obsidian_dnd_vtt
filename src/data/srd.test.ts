import { describe, expect, it } from "vitest";
import { ABILITIES } from "../model/schema";
import { BACKGROUNDS, CLASSES, RACES } from "./srd";

/** The entity with `id`, or throw — keeps test failures readable. */
function byId<T extends { id: string }>(list: T[], id: string): T {
  const found = list.find((e) => e.id === id);
  if (!found) throw new Error(`No entity ${id}`);
  return found;
}

/**
 * Data-integrity regression tests for the static SRD content. The wizard and
 * assembler trust this data (unique ids, satisfiable skill choices, sane hit
 * dice), so a bad edit here would surface as confusing UI bugs — catch it at
 * the source instead.
 */

function ids(list: { id: string }[]): string[] {
  return list.map((x) => x.id);
}

describe("ids", () => {
  it.each([
    ["races", RACES],
    ["classes", CLASSES],
    ["backgrounds", BACKGROUNDS],
  ] as const)("%s have unique, kebab-case ids", (_label, list) => {
    const all = ids(list);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("races", () => {
  it("covers the 9 SRD 5.1 races plus 5 SRD 5.2 (2024) species", () => {
    expect(RACES.filter((r) => r.edition === "2014")).toHaveLength(9);
    expect(RACES.filter((r) => r.edition === "2024")).toHaveLength(5);
  });

  it.each(RACES.map((r) => [r.id, r] as const))(
    "%s has valid bonuses, speed, and traits",
    (_id, race) => {
      expect([25, 30]).toContain(race.speed);
      expect(race.traits.length).toBeGreaterThan(0);
      for (const trait of race.traits) expect(trait.name).toBeTruthy();

      for (const [ability, bonus] of Object.entries(race.fixedBonuses)) {
        expect(ABILITIES).toContain(ability);
        expect(bonus).toBeGreaterThan(0);
      }

      if (race.bonusChoice) {
        // The choice must be satisfiable by abilities without a fixed bonus.
        const free = ABILITIES.filter((a) => !(race.fixedBonuses[a] ?? 0));
        expect(race.bonusChoice.count).toBeLessThanOrEqual(free.length);
        expect(race.bonusChoice.amount).toBeGreaterThan(0);
      }

      if (race.skillChoice && race.skillChoice.from !== "any") {
        expect(race.skillChoice.count).toBeLessThanOrEqual(
          race.skillChoice.from.length,
        );
      }
    },
  );
});

describe("classes", () => {
  it("covers the 12 SRD 5.1 classes plus all 12 as 2024 variants", () => {
    expect(CLASSES.filter((c) => c.edition === "2014")).toHaveLength(12);
    expect(
      CLASSES.filter((c) => c.edition === "2024")
        .map((c) => c.id)
        .sort(),
    ).toEqual(
      [
        "barbarian-2024",
        "bard-2024",
        "cleric-2024",
        "druid-2024",
        "fighter-2024",
        "monk-2024",
        "paladin-2024",
        "ranger-2024",
        "rogue-2024",
        "sorcerer-2024",
        "warlock-2024",
        "wizard-2024",
      ].sort(),
    );
  });

  it.each(CLASSES.map((c) => [c.id, c] as const))(
    "%s has a valid hit die, saves, and skill choice",
    (_id, charClass) => {
      expect([6, 8, 10, 12]).toContain(charClass.hitDie);

      const [a, b] = charClass.savingThrows;
      expect(a).not.toBe(b);

      const { count, from } = charClass.skillChoice;
      expect(count).toBeGreaterThan(0);
      if (from !== "any") {
        // Choice must be satisfiable and free of duplicates.
        expect(new Set(from).size).toBe(from.length);
        expect(count).toBeLessThanOrEqual(from.length);
      }

      // Features: at least one at level 1, all levels in range, and scaling
      // tiers (same name, several levels) never repeat a level.
      expect(charClass.features.some((f) => f.level === 1)).toBe(true);
      const featureSets = [
        charClass.features,
        ...charClass.subclasses.map((s) => s.features),
      ];
      for (const features of featureSets) {
        const seen = new Set<string>();
        for (const feature of features) {
          expect(feature.name).toBeTruthy();
          expect(feature.level).toBeGreaterThanOrEqual(1);
          expect(feature.level).toBeLessThanOrEqual(20);
          const key = `${feature.name}@${feature.level}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }

      // Every class grants weapon proficiencies; armor/tools may be empty.
      expect(charClass.proficiencies.weapons.length).toBeGreaterThan(0);

      // Resource tables are sorted by level with no duplicate rows.
      for (const resource of charClass.resources) {
        const levels = resource.levels.map((r) => r.level);
        expect([...levels].sort((a, b) => a - b)).toEqual(levels);
        expect(new Set(levels).size).toBe(levels.length);
      }

      // ASI levels: sorted, unique, within 2-20, and at least the edition's
      // baseline (2024 classes get 4 ASIs; level 19 is an Epic Boon instead).
      const asi = charClass.asiLevels;
      expect(asi.length).toBeGreaterThanOrEqual(
        charClass.edition === "2024" ? 4 : 5,
      );
      expect([...asi].sort((a, b) => a - b)).toEqual(asi);
      expect(new Set(asi).size).toBe(asi.length);
      for (const level of asi) {
        expect(level).toBeGreaterThanOrEqual(2);
        expect(level).toBeLessThanOrEqual(20);
      }

      // Equipment: every choice offers 2+ options, every bundle has items,
      // every item is named with a sane quantity.
      const allBundles = [
        charClass.equipment.fixed,
        ...charClass.equipment.choices.flatMap((c) => c.options),
      ];
      for (const choice of charClass.equipment.choices) {
        expect(choice.options.length).toBeGreaterThanOrEqual(2);
      }
      for (const bundle of allBundles.slice(1)) {
        expect(bundle.length).toBeGreaterThan(0);
      }
      for (const item of allBundles.flat()) {
        expect(item.name).toBeTruthy();
        if (item.quantity !== undefined) {
          expect(item.quantity).toBeGreaterThan(0);
        }
      }
    },
  );

  it.each(CLASSES.map((c) => [c.id, c] as const))(
    "%s has a subclass and satisfiable feature choices",
    (_id, charClass) => {
      // Every class ships at least one subclass with a valid unlock level.
      expect(charClass.subclasses.length).toBeGreaterThan(0);
      expect(charClass.subclassLevel).toBeGreaterThanOrEqual(1);
      expect(charClass.subclassLevel).toBeLessThanOrEqual(3);

      // Choice ids are unique across the class and all of its subclasses.
      const allChoices = [
        ...charClass.featureChoices,
        ...charClass.subclasses.flatMap((s) => s.featureChoices),
      ];
      const ids = allChoices.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);

      for (const choice of allChoices) {
        if (choice.kind === "options") {
          // Satisfiable, with uniquely named options.
          expect(choice.count).toBeLessThanOrEqual(choice.options.length);
          const names = choice.options.map((o) => o.name);
          expect(new Set(names).size).toBe(names.length);
        } else if (choice.kind === "skills" && choice.from !== "any") {
          expect(choice.count).toBeLessThanOrEqual(choice.from.length);
        } else if (choice.kind === "expertise") {
          // Must be satisfiable from the class's own skill picks alone.
          expect(choice.count).toBeLessThanOrEqual(
            charClass.skillChoice.count,
          );
        }
      }

      // Choices sharing options (Metamagic at 3/10/17, fighting styles on
      // class + Champion) must stay satisfiable when every pick has to be
      // distinct across the cluster (T-51).
      const optionChoices = allChoices.filter((c) => c.kind === "options");
      for (const choice of optionChoices) {
        const cluster = optionChoices.filter((other) =>
          other.options.some((o) =>
            choice.options.some((co) => co.name === o.name),
          ),
        );
        const union = new Set(
          cluster.flatMap((c) => c.options.map((o) => o.name)),
        );
        const totalPicks = cluster.reduce((sum, c) => sum + c.count, 0);
        expect(totalPicks).toBeLessThanOrEqual(union.size);
      }
    },
  );

  it("ships the T-51 class choices at the right levels", () => {
    const levels = (classId: string, name: string) =>
      byId(CLASSES, classId)
        .featureChoices.filter((c) => c.name === name)
        .map((c) => [c.level, c.count]);

    // Metamagic: 2 options at 3 (2014) / 2 (2024), one more at 10 and 17.
    expect(levels("sorcerer", "Metamagic")).toEqual([[3, 2], [10, 1], [17, 1]]);
    expect(levels("sorcerer-2024", "Metamagic")).toEqual([
      [2, 2], [10, 1], [17, 1],
    ]);

    // Invocations known: 8 by level 18 (2014), 10 by level 18 (2024).
    const total = (classId: string) =>
      levels(classId, "Eldritch Invocations").reduce((s, [, n]) => s + n, 0);
    expect(total("warlock")).toBe(8);
    expect(total("warlock-2024")).toBe(10);

    // Invocations with prerequisites carry advisory prereq text.
    const invocations = byId(CLASSES, "warlock").featureChoices.find(
      (c) => c.name === "Eldritch Invocations",
    );
    if (invocations?.kind !== "options") throw new Error("kind");
    const ascendant = invocations.options.find(
      (o) => o.name === "Ascendant Step",
    );
    expect(ascendant?.prereq).toBe("9th-level warlock");

    // Champion owes a second Fighting Style at 10 from the class's pool.
    const champion = byId(CLASSES, "fighter").subclasses.find(
      (s) => s.id === "champion",
    );
    expect(
      champion?.featureChoices.map((c) => [c.name, c.level]),
    ).toContainEqual(["Additional Fighting Style", 10]);

    // Ranger re-picks: favored enemy at 6/14, natural explorer at 6/10.
    expect(levels("ranger", "Favored Enemy").map(([l]) => l)).toEqual([
      1, 6, 14,
    ]);
    expect(levels("ranger", "Natural Explorer").map(([l]) => l)).toEqual([
      1, 6, 10,
    ]);
  });
});

describe("2014 Barbarian progression (T-19)", () => {
  const barbarian = CLASSES.find((c) => c.id === "barbarian")!;

  it("carries the full 1-20 class feature table", () => {
    const at = (name: string) =>
      barbarian.features
        .filter((f) => f.name === name)
        .map((f) => f.level)
        .sort((a, b) => a - b);
    expect(at("Rage")).toEqual([1]);
    expect(at("Unarmored Defense")).toEqual([1]);
    expect(at("Reckless Attack")).toEqual([2]);
    expect(at("Danger Sense")).toEqual([2]);
    expect(at("Extra Attack")).toEqual([5]);
    expect(at("Fast Movement")).toEqual([5]);
    expect(at("Feral Instinct")).toEqual([7]);
    expect(at("Brutal Critical")).toEqual([9, 13, 17]);
    expect(at("Relentless Rage")).toEqual([11]);
    expect(at("Persistent Rage")).toEqual([15]);
    expect(at("Indomitable Might")).toEqual([18]);
    expect(at("Primal Champion")).toEqual([20]);
  });

  it("carries the Berserker subclass features at 3/6/10/14", () => {
    const berserker = barbarian.subclasses.find(
      (s) => s.id === "path-of-the-berserker",
    )!;
    expect(
      berserker.features.map((f) => [f.name, f.level]),
    ).toEqual([
      ["Frenzy", 3],
      ["Mindless Rage", 6],
      ["Intimidating Presence", 10],
      ["Retaliation", 14],
    ]);
  });

  it("models the Rage table (uses and damage) as a resource", () => {
    const rage = barbarian.resources.find((r) => r.id === "rage")!;
    expect(rage.per).toBe("long-rest");
    expect(rage.levels).toEqual([
      { level: 1, uses: 2, note: "+2 rage damage" },
      { level: 3, uses: 3, note: "+2 rage damage" },
      { level: 6, uses: 4, note: "+2 rage damage" },
      { level: 9, uses: 4, note: "+3 rage damage" },
      { level: 12, uses: 5, note: "+3 rage damage" },
      { level: 16, uses: 5, note: "+4 rage damage" },
      { level: 17, uses: 6, note: "+4 rage damage" },
      { level: 20, uses: "unlimited", note: "+4 rage damage" },
    ]);
  });

  it("grants barbarian armor and weapon proficiencies (T-20)", () => {
    expect(barbarian.proficiencies).toEqual({
      armor: ["Light armor", "Medium armor", "Shields"],
      weapons: ["Simple weapons", "Martial weapons"],
      tools: [],
    });
  });
});

describe("leveled feature progressions for every class (T-21)", () => {
  it("every class carries features beyond level 1", () => {
    for (const cls of CLASSES) {
      const maxLevel = Math.max(...cls.features.map((f) => f.level));
      // The 2024 (SRD 5.2) classes ship at level-1 depth until T-17 finishes
      // backfilling their 2..20 feature progressions.
      if (cls.edition === "2024") continue;
      expect(maxLevel, `${cls.id} max feature level`).toBeGreaterThanOrEqual(18);
      expect(cls.features.length, `${cls.id} feature count`).toBeGreaterThanOrEqual(5);
    }
  });

  it("keeps every feature level within 1-20", () => {
    for (const cls of CLASSES) {
      for (const feature of cls.features) {
        expect(feature.level, `${cls.id} ${feature.name}`).toBeGreaterThanOrEqual(1);
        expect(feature.level, `${cls.id} ${feature.name}`).toBeLessThanOrEqual(20);
      }
      for (const sub of cls.subclasses) {
        for (const feature of sub.features) {
          expect(feature.level, `${sub.id} ${feature.name}`).toBeGreaterThanOrEqual(1);
          expect(feature.level, `${sub.id} ${feature.name}`).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it("never repeats a feature name within the same level", () => {
    const assertUnique = (owner: string, features: { name: string; level: number }[]) => {
      const seen = new Set<string>();
      for (const feature of features) {
        const key = `${feature.level}:${feature.name}`;
        expect(seen.has(key), `${owner} duplicates ${key}`).toBe(false);
        seen.add(key);
      }
    };
    for (const cls of CLASSES) {
      assertUnique(cls.id, cls.features);
      for (const sub of cls.subclasses) assertUnique(sub.id, sub.features);
    }
  });

  it("every 2014 subclass carries features at its subclass level and beyond", () => {
    for (const cls of CLASSES.filter((c) => c.edition === "2014")) {
      for (const sub of cls.subclasses) {
        expect(sub.features.length, sub.id).toBeGreaterThanOrEqual(4);
        const levels = sub.features.map((f) => f.level);
        expect(Math.min(...levels), sub.id).toBe(cls.subclassLevel ?? 1);
        expect(Math.max(...levels), sub.id).toBeGreaterThanOrEqual(14);
      }
    }
  });

  it("monk Unarmored Movement carries scaling speed-bonus effects", () => {
    const monk = CLASSES.find((c) => c.id === "monk")!;
    const tiers = monk.features
      .filter((f) => f.name === "Unarmored Movement")
      .map((f) => [f.level, f.effects[0]]);
    expect(tiers).toEqual([
      [2, { kind: "speed-bonus", amount: 10 }],
      [6, { kind: "speed-bonus", amount: 15 }],
      [10, { kind: "speed-bonus", amount: 20 }],
      [14, { kind: "speed-bonus", amount: 25 }],
      [18, { kind: "speed-bonus", amount: 30 }],
    ]);
  });

  it("models the new scaling resource pools", () => {
    const resource = (classId: string, resourceId: string) =>
      CLASSES.find((c) => c.id === classId)!.resources.find(
        (r) => r.id === resourceId,
      )!;
    expect(resource("monk", "ki").levels).toHaveLength(19);
    expect(resource("monk", "ki").levels[0]).toEqual({ level: 2, uses: 2 });
    expect(resource("monk", "ki").levels[18]).toEqual({ level: 20, uses: 20 });
    expect(resource("fighter", "action-surge").levels).toEqual([
      { level: 2, uses: 1 },
      { level: 17, uses: 2 },
    ]);
    expect(resource("druid", "wild-shape").levels).toEqual([
      { level: 2, uses: 2 },
      { level: 20, uses: "unlimited" },
    ]);
    expect(resource("paladin", "lay-on-hands").levels[19]).toEqual({
      level: 20,
      uses: 100,
      note: "hit points of healing",
    });
    expect(resource("sorcerer", "sorcery-points").levels[0].level).toBe(2);
  });
});

describe("backgrounds", () => {
  it("grants or offers at least two skills each", () => {
    for (const bg of BACKGROUNDS) {
      const total = bg.grantedSkills.length + (bg.skillChoice?.count ?? 0);
      expect(total).toBeGreaterThanOrEqual(2);
    }
  });

  it("custom background allows a free-text name", () => {
    expect(BACKGROUNDS.find((b) => b.id === "custom")?.customName).toBe(true);
  });
});
