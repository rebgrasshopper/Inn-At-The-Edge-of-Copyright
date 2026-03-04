import * as fc from "fast-check";

/**
 * Generator for player levels (1-99)
 */
export const playerLevelArb = fc.integer({ min: 1, max: 99 });

/**
 * Generator for Pathfinder levels (1-20)
 */
export const pfLevelArb = fc.integer({ min: 1, max: 20 });

/**
 * Generator for BAB values (0-33, since max level 99 / 3 = 33)
 */
export const babValueArb = fc.integer({ min: 0, max: 33 });

/**
 * Generator for stat values (1-99)
 */
export const statValueArb = fc.integer({ min: 1, max: 99 });

/**
 * Generator for full player stats object
 */
export const playerStatsArb = fc.record({
  str: statValueArb,
  dex: statValueArb,
  con: statValueArb,
  int: statValueArb,
  wis: statValueArb,
  cha: statValueArb,
});

/**
 * Generator for weapon range values
 */
export const weaponRangeArb = fc.constantFrom(
  "melee",
  "ranged",
) as fc.Arbitrary<"melee" | "ranged">;

/**
 * Generator for feat category names (from the 6 starter feats)
 */
export const featCategoryArb = fc.constantFrom("Combat");

/**
 * Generator for unspent feat slots (0-10)
 */
export const unspentFeatSlotsArb = fc.integer({ min: 0, max: 10 });

/**
 * Generator for positive feat slots (1-10)
 */
export const positiveFeatSlotsArb = fc.integer({ min: 1, max: 10 });

/**
 * Generator for even levels (2, 4, 6, ... 98)
 */
export const evenLevelArb = fc.integer({ min: 1, max: 49 }).map((n) => n * 2);

/**
 * Generator for odd levels (1, 3, 5, ... 99)
 */
export const oddLevelArb = fc
  .integer({ min: 0, max: 49 })
  .map((n) => n * 2 + 1);
