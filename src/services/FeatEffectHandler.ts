/**
 * Applies feat effects to game mechanics.
 * Hardcoded logic for v1 feats.
 */

import {
  FEAT_COMBAT_EXPERTISE,
  FEAT_DEADLY_AIM,
  FEAT_DODGE,
  FEAT_POWER_ATTACK,
  FEAT_TOUGHNESS,
  FEAT_TWO_WEAPON_FIGHTING,
} from "../constants/featIds.js";
import type { WeaponRange } from "../types/feat.js";
import { getActiveStance, hasFeatById } from "./FeatService.js";

/** AC modifier from feats */
export type ACModifier = {
  dodge: number; // From Dodge feat
  stance: number; // From Combat Expertise stance (when active)
};

/** Attack modifier from feats */
export type AttackModifier = {
  stance: number; // From any active stance (-1 for all stance feats)
};

/** Damage modifier from feats */
export type DamageModifier = {
  stance: number; // From Power Attack or Deadly Aim (when active and weapon matches)
};

/**
 * Calculate Toughness HP bonus for a player.
 * Formula: +3 HP, +1 HP per level beyond 3rd
 * @param playerId - The player's ID
 * @param level - The player's current level
 * @returns HP bonus (0 if player doesn't have Toughness)
 */
export async function getToughnessBonus(
  playerId: string,
  level: number,
): Promise<number> {
  const hasToughness = await hasFeatById(playerId, FEAT_TOUGHNESS);
  if (!hasToughness) {
    return 0;
  }

  // +3 HP base, +1 HP per level beyond 3rd
  const baseBonus = 3;
  const levelBonus = Math.max(0, level - 3);
  return baseBonus + levelBonus;
}

/**
 * Get AC modifiers from feats for a player.
 * @param playerId - The player's ID
 * @returns AC modifiers from Dodge and active stance
 */
export async function getACModifiers(playerId: string): Promise<ACModifier> {
  const result: ACModifier = {
    dodge: 0,
    stance: 0,
  };

  // Check for Dodge feat (+1 AC)
  const hasDodge = await hasFeatById(playerId, FEAT_DODGE);
  if (hasDodge) {
    result.dodge = 1;
  }

  // Check for Combat Expertise stance (+1 AC when active)
  const activeStance = await getActiveStance(playerId);
  if (activeStance && activeStance.id === FEAT_COMBAT_EXPERTISE) {
    result.stance = 1;
  }

  return result;
}

/**
 * Get attack modifiers from feats for a player.
 * All stance feats apply a -1 attack penalty when active.
 * @param playerId - The player's ID
 * @returns Attack modifiers from active stance
 */
export async function getAttackModifiers(
  playerId: string,
): Promise<AttackModifier> {
  const result: AttackModifier = {
    stance: 0,
  };

  // Any active stance applies -1 attack penalty
  const activeStance = await getActiveStance(playerId);
  if (activeStance) {
    result.stance = -1;
  }

  return result;
}

/**
 * Get damage modifiers from feats for a player.
 * Power Attack: +2 damage with melee weapons when active.
 * Deadly Aim: +2 damage with ranged weapons when active.
 * @param playerId - The player's ID
 * @param weaponRange - The range of the weapon being used
 * @returns Damage modifiers from Power Attack or Deadly Aim
 */
export async function getDamageModifiers(
  playerId: string,
  weaponRange: WeaponRange,
): Promise<DamageModifier> {
  const result: DamageModifier = {
    stance: 0,
  };

  const activeStance = await getActiveStance(playerId);
  if (!activeStance) {
    return result;
  }

  // Power Attack: +2 damage with melee weapons
  if (activeStance.id === FEAT_POWER_ATTACK && weaponRange === "melee") {
    result.stance = 2;
  }

  // Deadly Aim: +2 damage with ranged weapons
  if (activeStance.id === FEAT_DEADLY_AIM && weaponRange === "ranged") {
    result.stance = 2;
  }

  return result;
}

/**
 * Check if a player can dual wield (has Two-Weapon Fighting).
 * @param playerId - The player's ID
 * @returns True if player can equip weapons in both hands
 */
export async function canDualWield(playerId: string): Promise<boolean> {
  return hasFeatById(playerId, FEAT_TWO_WEAPON_FIGHTING);
}
