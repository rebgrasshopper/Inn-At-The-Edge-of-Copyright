/**
 * Stat calculation service for combat and character mechanics.
 * Handles D&D-style stat modifiers, AC calculation, and attack intervals.
 */

import { getACModifiers, getToughnessBonus } from "./FeatEffectHandler.js";

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

/** Base HP at level 1 */
const BASE_HP = 10;

/** HP gained per level (before CON bonus) */
const HP_PER_LEVEL = 8;

/** Bonus HP per level per point of CON modifier */
const CON_BONUS_PER_LEVEL = 2;

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
 * AC = 10 + DEX modifier + equipment CON bonus + feat bonuses
 * @param dex - DEX stat value
 * @param equipmentConBonus - Total CON bonus from equipped items (default 0)
 * @param playerId - Optional player ID for feat bonus calculation
 * @returns Calculated AC value
 */
export async function calculateAC(
  dex: number,
  equipmentConBonus: number = 0,
  playerId?: string,
): Promise<number> {
  const dexMod = getStatModifier(dex);
  let baseAC = BASE_AC + dexMod + equipmentConBonus;

  // Add feat bonuses if playerId provided
  if (playerId) {
    const acMods = await getACModifiers(playerId);
    baseAC += acMods.dodge + acMods.stance;
  }

  return baseAC;
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
 * Calculate max HP based on level and CON.
 * Formula: BASE_HP + level × (HP_PER_LEVEL + conMod × CON_BONUS_PER_LEVEL) + feat bonuses
 * @param level - Player's level
 * @param con - Player's total CON (base + equipment)
 * @param playerId - Optional player ID for feat bonus calculation
 * @returns Calculated max HP
 * @example calculateMaxHp(1, 10) // 18 (10 + 1×8)
 * @example calculateMaxHp(5, 14) // 80 (10 + 5×(8 + 2×2) = 10 + 5×12)
 */
export async function calculateMaxHp(
  level: number,
  con: number,
  playerId?: string,
): Promise<number> {
  const conMod = getStatModifier(con);
  const hpPerLevel = HP_PER_LEVEL + conMod * CON_BONUS_PER_LEVEL;
  let baseHp = BASE_HP + level * hpPerLevel;

  // Add feat bonuses if playerId provided
  if (playerId) {
    const toughnessBonus = await getToughnessBonus(playerId, level);
    baseHp += toughnessBonus;
  }

  return baseHp;
}

/**
 * Calculate the CON bonus portion of max HP (for display purposes).
 * @param level - Player's level
 * @param con - Player's total CON (base + equipment)
 * @returns HP bonus from CON modifier
 * @example calculateConHpBonus(5, 14) // 20 (5 levels × 2 CON mod × 2 per level)
 */
export function calculateConHpBonus(level: number, con: number): number {
  const conMod = getStatModifier(con);
  return level * conMod * CON_BONUS_PER_LEVEL;
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

// ============================================
// XP and Leveling (PF2e-style)
// ============================================

/** XP required to level up (constant per PF2e) */
export const XP_PER_LEVEL = 1000;

/**
 * Calculate XP reward based on monster level relative to player level (PF2e style).
 * Uses a lookup table based on level difference.
 * @param monsterLevel - The monster's level
 * @param playerLevel - The player's level
 * @returns XP to award
 * @example calculateXpReward(5, 5) // returns 40 (same level)
 * @example calculateXpReward(7, 5) // returns 80 (monster 2 levels higher)
 * @example calculateXpReward(3, 5) // returns 20 (monster 2 levels lower)
 */
export function calculateXpReward(
  monsterLevel: number,
  playerLevel: number,
): number {
  const diff = monsterLevel - playerLevel;

  if (diff <= -4) return 10;
  if (diff === -3) return 15;
  if (diff === -2) return 20;
  if (diff === -1) return 30;
  if (diff === 0) return 40;
  if (diff === 1) return 60;
  if (diff === 2) return 80;
  if (diff === 3) return 120;
  return 160; // diff >= 4
}

export type LevelUpResult = {
  shouldLevel: boolean;
  newLevel: number;
  newXp: number;
  attributePoints: number;
};

/**
 * Check if player should level up and calculate new values.
 * XP resets to surplus after leveling (carry over excess).
 * @param currentXp - Player's current XP
 * @param currentLevel - Player's current level
 * @returns Level up result with new values and attribute points earned
 * @example checkLevelUp(1200, 3) // { shouldLevel: true, newLevel: 4, newXp: 200, attributePoints: 2 }
 * @example checkLevelUp(500, 3) // { shouldLevel: false, newLevel: 3, newXp: 500, attributePoints: 0 }
 */
export function checkLevelUp(
  currentXp: number,
  currentLevel: number,
): LevelUpResult {
  if (currentXp < XP_PER_LEVEL) {
    return {
      shouldLevel: false,
      newLevel: currentLevel,
      newXp: currentXp,
      attributePoints: 0,
    };
  }

  return {
    shouldLevel: true,
    newLevel: currentLevel + 1,
    newXp: currentXp - XP_PER_LEVEL,
    attributePoints: 2,
  };
}
