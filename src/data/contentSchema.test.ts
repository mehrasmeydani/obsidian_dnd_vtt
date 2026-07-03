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
        traits: [{ name: "Feature" }],
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
});
