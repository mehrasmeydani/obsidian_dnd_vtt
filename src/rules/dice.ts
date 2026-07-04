/**
 * Minimal dice rolling (T-07). The random source is injectable so tests
 * (and future "seeded session" features) stay deterministic; production
 * callers use the default `Math.random`.
 */

/** A random source: returns [0, 1) like `Math.random`. */
export type Rng = () => number;

/** One die roll, 1..sides. */
export function rollDie(sides: number, rng: Rng = Math.random): number {
  return 1 + Math.floor(rng() * sides);
}

/** `count` die rolls, each 1..sides. */
export function rollDice(
  count: number,
  sides: number,
  rng: Rng = Math.random,
): number[] {
  return Array.from({ length: count }, () => rollDie(sides, rng));
}

/** A class's starting-gold roll, e.g. fighter 5d4 × 10. */
export interface GoldRoll {
  count: number;
  sides: number;
  multiplier: number;
}

/** "5d4 × 10 gp" — display label for a gold formula. */
export function goldRollLabel(formula: GoldRoll): string {
  return formula.multiplier > 1
    ? `${formula.count}d${formula.sides} × ${formula.multiplier} gp`
    : `${formula.count}d${formula.sides} gp`;
}

/** Roll starting gold: (count × d(sides)) × multiplier. */
export function rollGold(formula: GoldRoll, rng: Rng = Math.random): number {
  return (
    rollDice(formula.count, formula.sides, rng).reduce((a, b) => a + b, 0) *
    formula.multiplier
  );
}
