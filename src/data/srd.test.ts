import { describe, expect, it } from "vitest";
import { ABILITIES } from "../model/schema";
import { BACKGROUNDS, CLASSES, RACES } from "./srd";

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
  it("covers the 9 SRD races", () => {
    expect(RACES).toHaveLength(9);
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
  it("covers the 12 SRD classes", () => {
    expect(CLASSES).toHaveLength(12);
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

      expect(charClass.traits.length).toBeGreaterThan(0);

      // ASI levels: sorted, unique, within 2-20, and at least the PHB baseline.
      const asi = charClass.asiLevels;
      expect(asi.length).toBeGreaterThanOrEqual(5);
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
