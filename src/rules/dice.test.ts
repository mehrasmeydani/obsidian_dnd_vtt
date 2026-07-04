import { describe, expect, it } from "vitest";
import { goldRollLabel, rollDice, rollDie, rollGold } from "./dice";

/** T-07: dice are injectable/seedable so tests stay deterministic. */

/** A cycling deterministic rng. */
function fakeRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("rollDie / rollDice", () => {
  it("maps the rng onto 1..sides", () => {
    expect(rollDie(6, () => 0)).toBe(1);
    expect(rollDie(6, () => 0.999)).toBe(6);
    expect(rollDice(3, 4, fakeRng([0, 0.5, 0.999]))).toEqual([1, 3, 4]);
  });

  it("stays in range with the default rng", () => {
    for (let i = 0; i < 200; i++) {
      const roll = rollDie(8);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(8);
    }
  });
});

describe("starting gold", () => {
  const fighter = { count: 5, sides: 4, multiplier: 10 };

  it("labels the formula", () => {
    expect(goldRollLabel(fighter)).toBe("5d4 × 10 gp");
    expect(goldRollLabel({ count: 5, sides: 4, multiplier: 1 })).toBe("5d4 gp");
  });

  it("rolls count × d(sides) × multiplier", () => {
    expect(rollGold(fighter, () => 0)).toBe(50);
    expect(rollGold(fighter, () => 0.999)).toBe(200);
  });
});
