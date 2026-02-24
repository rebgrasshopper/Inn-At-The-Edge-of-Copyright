/**
 * Stat calculation service for combat and character mechanics.
 * Handles D&D-style stat modifiers, AC calculation, and attack intervals.
 */

/** Minimum attack interval in milliseconds */
const MIN_ATTACK_INTERVAL = 1500;

/** Maximum attack interval in milliseconds */
const MAX_ATTACK_INTERVAL = 5000;

/** Base attack interval in milliseconds (for DEX modifier of 0) */
const BASE_ATTACK_INTERVAL = 3000;

/** Milliseconds adjustment per point of DEX modifier */
const INTERVAL_PER_DEX_MOD = 200;

/** Base AC before modifiers */
const BASE_AC = 10;

/**
 * Calculate D&D-style stat modifier from a raw stat value
 * @param stat - Raw stat value (e.g., 10, 14, 8)
 * @returns Modifier value: floor((stat - 10) / 2)
 * @example getStatModifier(10) // returns 0
 * @example getStatModifier(14) // returns 2
 * @example getStatModifier(8) // returns -1
 */
export function getStatModifier(stat: number): number {
  return Math.floor((stat - 10) / 2);
}

/**
 * Calculate Armor Class for a combatant
 * AC = 10 + DEX modifier + equipment CON bonus
 * @param dex - DEX stat value
 * @param equipmentConBonus - Total CON bonus from equipped items (default 0)
 * @returns Calculated AC value
 */
export function calculateAC(
  dex: number,
  equipmentConBonus: number = 0,
): number {
  const dexMod = getStatModifier(dex);
  return BASE_AC + dexMod + equipmentConBonus;
}

/**
 * Calculate attack interval in milliseconds based on DEX
 * Higher DEX = faster attacks (lower interval)
 * Formula: 3000 - (dexModifier * 200), clamped to [1500, 5000]
 * @param dex - DEX stat value
 * @returns Attack interval in milliseconds
 * @example calculateAttackInterval(10) // returns 3000 (DEX mod 0)
 * @example calculateAttackInterval(18) // returns 2200 (DEX mod +4)
 * @example calculateAttackInterval(6) // returns 3400 (DEX mod -2)
 */
export function calculateAttackInterval(dex: number): number {
  const dexMod = getStatModifier(dex);
  const interval = BASE_ATTACK_INTERVAL - dexMod * INTERVAL_PER_DEX_MOD;
  return Math.max(MIN_ATTACK_INTERVAL, Math.min(MAX_ATTACK_INTERVAL, interval));
}

/**
 * Calculate damage modifier from STR stat
 * @param str - STR stat value
 * @returns Damage modifier to add to weapon damage
 */
export function getDamageModifier(str: number): number {
  return getStatModifier(str);
}

/**
 * Calculate total equipment CON bonus from equipped items
 * @param equippedItems - Array of equipped items with conEffect values
 * @returns Total CON bonus from all equipped items
 */
export function calculateEquipmentConBonus(
  equippedItems: Array<{ conEffect?: number | null }>,
): number {
  return equippedItems.reduce(
    (total, item) => total + (item.conEffect ?? 0),
    0,
  );
}

/**
 * Calculate XP penalty on death (10% of current XP, minimum 0)
 * @param currentXp - Player's current XP
 * @returns XP after penalty applied
 */
export function calculateXpAfterDeath(currentXp: number): number {
  const penalty = Math.floor(currentXp * 0.1);
  return Math.max(0, currentXp - penalty);
}

/**
 * Calculate flee DC based on level difference
 * DC = 10 + (monsterLevel - playerLevel) * 2
 * @param playerLevel - Player's level
 * @param monsterLevel - Monster's level (defaults to 1 if not specified)
 * @returns DC for the flee check
 */
export function calculateFleeDC(
  playerLevel: number,
  monsterLevel: number = 1,
): number {
  return 10 + (monsterLevel - playerLevel) * 2;
}
