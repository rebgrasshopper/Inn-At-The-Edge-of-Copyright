/**
 * Spell service for managing magic spells and casting.
 * Handles spell lookup, mana costs, proficiency, and spell effects.
 */

import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  players,
  playerSpells,
  spells,
  type SpellEffect,
} from "../db/schema.js";
import { rollDamageWithDetails } from "./DiceService.js";
import { getStatModifier } from "./StatService.js";

/** Result of a spell cast attempt */
export type CastResult = {
  success: boolean;
  message: string;
  damage?: number;
  healing?: number;
  manaSpent: number;
  rollInfo?: string;
  failed?: boolean; // True if spell fizzled due to proficiency
};

/** Spell data with player proficiency info */
export type PlayerSpellData = {
  id: string;
  name: string;
  description: string;
  manaCost: number;
  minInt: number;
  scalingLevel: number | null;
  effect: SpellEffect | null;
  targetType: string;
  successfulCasts: number;
  learnedAt: Date;
};

/**
 * Get all spells a player has learned
 * @param playerId - The player's ID
 * @returns Array of spells with proficiency data
 */
export async function getPlayerSpells(
  playerId: string,
): Promise<PlayerSpellData[]> {
  const results = await db
    .select({
      id: spells.id,
      name: spells.name,
      description: spells.description,
      manaCost: spells.manaCost,
      minInt: spells.minInt,
      scalingLevel: spells.scalingLevel,
      effect: spells.effect,
      targetType: spells.targetType,
      successfulCasts: playerSpells.successfulCasts,
      learnedAt: playerSpells.learnedAt,
    })
    .from(playerSpells)
    .innerJoin(spells, eq(playerSpells.spellId, spells.id))
    .where(eq(playerSpells.playerId, playerId));

  return results;
}

/**
 * Get a specific spell by name (case-insensitive, supports partial match)
 * @param spellName - The spell name to search for
 * @returns The spell data or null if not found
 */
export async function getSpellByName(
  spellName: string,
): Promise<typeof spells.$inferSelect | null> {
  const allSpells = await db.select().from(spells);
  const lowerName = spellName.toLowerCase();

  // Try exact match first
  const exact = allSpells.find((s) => s.name.toLowerCase() === lowerName);
  if (exact) return exact;

  // Try prefix match
  const prefix = allSpells.find((s) =>
    s.name.toLowerCase().startsWith(lowerName),
  );
  if (prefix) return prefix;

  // Try contains match
  const contains = allSpells.find((s) =>
    s.name.toLowerCase().includes(lowerName),
  );
  return contains || null;
}

/**
 * Check if a player knows a specific spell
 * @param playerId - The player's ID
 * @param spellId - The spell's ID
 * @returns The player spell record or null
 */
export async function getPlayerSpell(
  playerId: string,
  spellId: string,
): Promise<typeof playerSpells.$inferSelect | null> {
  const result = await db
    .select()
    .from(playerSpells)
    .where(
      and(
        eq(playerSpells.playerId, playerId),
        eq(playerSpells.spellId, spellId),
      ),
    )
    .get();

  return result || null;
}

/**
 * Calculate spell failure chance based on successful casts
 * Formula: max(0, 25 - (successfulCasts / 2))
 * Mastery at 50 successful casts (0% failure)
 * @param successfulCasts - Number of successful casts
 * @returns Failure percentage (0-25)
 */
export function calculateFailureChance(successfulCasts: number): number {
  return Math.max(0, 25 - Math.floor(successfulCasts / 2));
}

/**
 * Check if a spell cast fails due to proficiency
 * @param successfulCasts - Number of successful casts
 * @returns True if the spell fizzles
 */
export function checkSpellFailure(successfulCasts: number): boolean {
  const failureChance = calculateFailureChance(successfulCasts);
  if (failureChance === 0) return false;
  const roll = Math.floor(Math.random() * 100);
  return roll < failureChance;
}

/**
 * Calculate number of missiles/projectiles for scaling spells
 * Formula: 1 + floor((casterLevel - 1) / scalingLevel)
 * @param casterLevel - The caster's level
 * @param scalingLevel - Levels per additional missile (e.g., 4 = +1 at 5, 9, 13...)
 * @returns Number of missiles to fire
 */
export function calculateMissileCount(
  casterLevel: number,
  scalingLevel: number | null,
): number {
  if (!scalingLevel || scalingLevel <= 0) return 1;
  return 1 + Math.floor((casterLevel - 1) / scalingLevel);
}

/**
 * Increment successful cast count for a player's spell
 * @param playerId - The player's ID
 * @param spellId - The spell's ID
 */
export async function incrementSuccessfulCasts(
  playerId: string,
  spellId: string,
): Promise<void> {
  const current = await getPlayerSpell(playerId, spellId);
  if (!current) return;

  await db
    .update(playerSpells)
    .set({ successfulCasts: current.successfulCasts + 1 })
    .where(
      and(
        eq(playerSpells.playerId, playerId),
        eq(playerSpells.spellId, spellId),
      ),
    );
}

/**
 * Deduct mana from a player
 * @param playerId - The player's ID
 * @param amount - Amount of mana to deduct
 * @returns True if successful, false if insufficient mana
 */
export async function deductMana(
  playerId: string,
  amount: number,
): Promise<boolean> {
  const player = await db
    .select({ mana: players.mana })
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player || player.mana < amount) return false;

  await db
    .update(players)
    .set({ mana: player.mana - amount })
    .where(eq(players.id, playerId));

  return true;
}

/**
 * Calculate damage for a damage spell
 * @param effect - The spell effect
 * @param intMod - Caster's INT modifier
 * @param missileCount - Number of missiles (for scaling spells)
 * @returns Total damage and roll info
 */
export function calculateSpellDamage(
  effect: SpellEffect & { type: "damage" },
  intMod: number,
  missileCount: number,
): { total: number; rollInfo: string } {
  let totalDamage = 0;
  const rolls: string[] = [];

  for (let i = 0; i < missileCount; i++) {
    const roll = rollDamageWithDetails(effect.dice);
    if (roll) {
      let damage = roll.total;
      if (effect.modifier === "int") {
        damage += intMod;
      }
      damage = Math.max(1, damage); // Minimum 1 damage per missile
      totalDamage += damage;
      rolls.push(
        `${effect.dice}${effect.modifier === "int" ? `+${intMod}` : ""} = ${damage}`,
      );
    }
  }

  const rollInfo =
    missileCount > 1
      ? `${missileCount} bolts: ${rolls.join(", ")}`
      : rolls[0] || "";

  return { total: totalDamage, rollInfo };
}

/**
 * Calculate healing for a healing spell
 * @param effect - The spell effect
 * @param intMod - Caster's INT modifier
 * @returns Total healing and roll info
 */
export function calculateSpellHealing(
  effect: SpellEffect & { type: "heal" },
  intMod: number,
): { total: number; rollInfo: string } {
  const roll = rollDamageWithDetails(effect.dice);
  if (!roll) return { total: 0, rollInfo: "" };

  let healing = roll.total;
  if (effect.modifier === "int") {
    healing += intMod;
  }
  healing = Math.max(1, healing); // Minimum 1 healing

  const rollInfo = `${effect.dice}${effect.modifier === "int" ? `+${intMod}` : ""} = ${healing}`;
  return { total: healing, rollInfo };
}

/**
 * Teach a spell to a player
 * @param playerId - The player's ID
 * @param spellId - The spell's ID
 * @returns True if successful, false if already known or spell doesn't exist
 */
export async function learnSpell(
  playerId: string,
  spellId: string,
): Promise<boolean> {
  // Check if already known
  const existing = await getPlayerSpell(playerId, spellId);
  if (existing) return false;

  // Check spell exists
  const spell = await db
    .select()
    .from(spells)
    .where(eq(spells.id, spellId))
    .get();
  if (!spell) return false;

  // Add to player's spells
  await db.insert(playerSpells).values({
    id: crypto.randomUUID(),
    playerId,
    spellId,
    successfulCasts: 0,
    learnedAt: new Date(),
  });

  return true;
}

/**
 * Check if a player has enough INT to learn a spell
 * @param playerInt - Player's INT stat
 * @param spellMinInt - Spell's minimum INT requirement
 * @returns True if player meets the requirement
 */
export function meetsIntRequirement(
  playerInt: number,
  spellMinInt: number,
): boolean {
  return playerInt >= spellMinInt;
}

/**
 * Get the maximum number of spells a player can know
 * Formula: INT modifier + 2 (minimum 1)
 * @param int - Player's INT stat
 * @returns Maximum spell capacity
 */
export function getSpellCapacity(int: number): number {
  const intMod = getStatModifier(int);
  return Math.max(1, intMod + 2);
}

/** Data for a preferred damage spell */
export type PreferredSpellData = {
  spell: typeof spells.$inferSelect;
  playerSpell: typeof playerSpells.$inferSelect;
} | null;

/**
 * Get the player's preferred damage spell for auto-attack.
 * Returns the first damage spell they know that they have mana for.
 * Future: Allow player to configure which spell to prefer.
 * @param playerId - The player's ID
 * @returns The preferred spell data or null if none available
 */
export async function getPreferredDamageSpell(
  playerId: string,
): Promise<PreferredSpellData> {
  // Get player's current mana
  const player = await db
    .select({ mana: players.mana })
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) return null;

  // Get all player's spells with spell data
  const playerSpellsData = await getPlayerSpells(playerId);

  // Find first damage spell they have mana for
  for (const ps of playerSpellsData) {
    if (ps.effect?.type === "damage" && player.mana >= ps.manaCost) {
      // Get full spell record
      const spell = await db
        .select()
        .from(spells)
        .where(eq(spells.id, ps.id))
        .get();

      if (spell) {
        const playerSpellRecord = await getPlayerSpell(playerId, spell.id);
        if (playerSpellRecord) {
          return { spell, playerSpell: playerSpellRecord };
        }
      }
    }
  }

  return null;
}
