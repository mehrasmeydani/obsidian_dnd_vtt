import { describe, expect, it } from "vitest";
import { parseContentBundle, type ContentBundle } from "./contentSchema";
import { srdRaw } from "./content/srd/index";

/**
 * Regression tests for the content-bundle format. Every content source —
 * the bundled SRD, hand-edited JSON, or a future 5etools/Open5e import —
 * passes through parseContentBundle, so this is the gate that keeps bad
 * data out of the wizard and rules engine.
 */

function minimalBundle(): ContentBundle {
  return {
    name: "Test",
    races: [
      {
        id: "test-race",
        name: "Test Race",
        speed: 30,
        fixedBonuses: { str: 1 },
        traits: [{ name: "Trait" }],
      },
    ],
    classes: [
      {
        id: "test-class",
        name: "Test Class",
        edition: "2014",
        hitDie: 8,
        savingThrows: ["str", "con"],
        skillChoice: { count: 2, from: "any" },
        features: [{ name: "Feature", level: 1, effects: [] }],
        proficiencies: { armor: [], weapons: ["Simple weapons"], tools: [] },
        resources: [],
        asiLevels: [4, 8],
        equipment: {
          fixed: [{ name: "Rock" }],
          choices: [{ options: [[{ name: "Stick" }], [{ name: "Rope" }]] }],
        },
        subclasses: [],
        featureChoices: [],
      },
    ],
    backgrounds: [
      {
        id: "test-bg",
        name: "Test BG",
        grantedSkills: ["insight"],
        description: "Test",
        traits: [],
        equipment: [],
      },
    ],
    feats: [],
  };
}

describe("parseContentBundle", () => {
  it("accepts the bundled SRD content", () => {
    const bundle = parseContentBundle(srdRaw);
    expect(bundle.name).toBe("SRD");
    expect(bundle.races).toHaveLength(9);
    // 12 SRD 5.1 classes + the 2024 (SRD 5.2) Barbarian variant.
    expect(bundle.classes).toHaveLength(13);
  });

  it("accepts a minimal well-formed bundle", () => {
    expect(() => parseContentBundle(minimalBundle())).not.toThrow();
  });

  it("rejects unknown skills and abilities", () => {
    const badSkill = minimalBundle();
    badSkill.backgrounds[0].grantedSkills = ["flying" as never];
    expect(() => parseContentBundle(badSkill)).toThrow();

    const badAbility = minimalBundle();
    badAbility.classes[0].savingThrows = ["str", "luck" as never];
    expect(() => parseContentBundle(badAbility)).toThrow();
  });

  it("rejects structurally broken equipment", () => {
    const oneOption = minimalBundle();
    // A "choice" with a single option is not a choice.
    oneOption.classes[0].equipment.choices = [
      { options: [[{ name: "Stick" }]] },
    ];
    expect(() => parseContentBundle(oneOption)).toThrow();

    const emptyBundleOption = minimalBundle();
    emptyBundleOption.classes[0].equipment.choices = [
      { options: [[], [{ name: "Rope" }]] },
    ];
    expect(() => parseContentBundle(emptyBundleOption)).toThrow();
  });

  it("rejects out-of-range numbers", () => {
    const badAsi = minimalBundle();
    badAsi.classes[0].asiLevels = [1]; // ASIs start at level 2+
    expect(() => parseContentBundle(badAsi)).toThrow();

    const badQuantity = minimalBundle();
    badQuantity.classes[0].equipment.fixed = [{ name: "Rock", quantity: 0 }];
    expect(() => parseContentBundle(badQuantity)).toThrow();
  });

  it("rejects class features with levels outside 1-20", () => {
    for (const level of [0, 21]) {
      const bad = minimalBundle();
      bad.classes[0].features = [{ name: "Feature", level, effects: [] }];
      expect(() => parseContentBundle(bad)).toThrow();
    }
  });

  it("defaults proficiencies and resources when omitted", () => {
    const raw = minimalBundle() as unknown as {
      classes: Record<string, unknown>[];
    };
    delete raw.classes[0].proficiencies;
    delete raw.classes[0].resources;
    const bundle = parseContentBundle(raw);
    expect(bundle.classes[0].proficiencies).toEqual({
      armor: [],
      weapons: [],
      tools: [],
    });
    expect(bundle.classes[0].resources).toEqual([]);
  });

  it("accepts scaling resources with numeric and unlimited uses", () => {
    const bundle = minimalBundle();
    bundle.classes[0].resources = [
      {
        id: "rage",
        name: "Rage",
        per: "long-rest",
        levels: [
          { level: 1, uses: 2, note: "+2 rage damage" },
          { level: 20, uses: "unlimited" },
        ],
      },
    ];
    expect(() => parseContentBundle(bundle)).not.toThrow();

    const badUses = minimalBundle();
    badUses.classes[0].resources = [
      {
        id: "rage",
        name: "Rage",
        per: "long-rest",
        levels: [{ level: 1, uses: 0 }],
      },
    ] as never;
    expect(() => parseContentBundle(badUses)).toThrow();
  });

  it("validates feature effects", () => {
    const bundle = minimalBundle();
    bundle.classes[0].features = [
      {
        name: "Primal Champion",
        level: 20,
        effects: [
          { kind: "ability-increase", abilities: ["str", "con"], amount: 4, max: 24 },
          { kind: "speed-bonus", amount: 10 },
        ],
      },
    ];
    expect(() => parseContentBundle(bundle)).not.toThrow();

    const badEffect = minimalBundle();
    badEffect.classes[0].features = [
      {
        name: "Broken",
        level: 1,
        effects: [{ kind: "fly-speed", amount: 30 } as never],
      },
    ];
    expect(() => parseContentBundle(badEffect)).toThrow();
  });
});
