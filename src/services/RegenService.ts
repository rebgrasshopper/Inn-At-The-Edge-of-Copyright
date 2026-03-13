/**
 * Regeneration service for HP and mana recovery.
 * Uses on-action checking rather than background timers.
 * Regen is always active but slower in combat.
 */

import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { players } from "../db/schema.js";
import { isPlayerInCombat } from "./CombatService.js";

/**
 * Regen timing constants.
 * Out of combat: mana ~30 min to full, HP ~45 min to full (1% per tick)
 * In combat: double the interval (half speed)
 */

/** Seconds between mana regen ticks (out of combat) - 1% per 18s = ~30 min to full */
const MANA_REGEN_INTERVAL_OOC = 18;

/** Seconds between HP regen ticks (out of combat) - 1% per 27s = ~45 min to full */
const HP_REGEN_INTERVAL_OOC = 27;

/** Combat multiplier for regen intervals (2x = half speed) */
const COMBAT_REGEN_MULTIPLIER = 2;

/** Percentage of max restored per tick */
const REGEN_PERCENT_PER_TICK = 1;

/** Minimum amount restored per tick (ensures progress even at low max values) */
const MIN_REGEN_PER_TICK = 1;

/** Result of restoring player resources */
export type RestoreResult = {
  hpRestored: number;
  manaRestored: number;
  newHp: number;
  newMana: number;
};

/** Result of a regen check */
export type RegenResult = RestoreResult;

/**
 * Restore HP and/or mana to a player, capped at their max values.
 * Use this for potions, healing spells, items, or any direct restoration.
 *
 * @param playerId - The player's ID
 * @param hpAmount - Amount of HP to restore (0 to skip)
 * @param manaAmount - Amount of mana to restore (0 to skip)
 * @returns Result with actual amounts restored and new totals
 */
export async function restorePlayerResources(
  playerId: string,
  hpAmount: number,
  manaAmount: number,
): Promise<RestoreResult | null> {
  const player = await db
    .select({
      currentHp: players.currentHp,
      maxHp: players.maxHp,
      mana: players.mana,
      maxMana: players.maxMana,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) return null;

  // Cap at max values
  const hpRestored = Math.min(hpAmount, player.maxHp - player.currentHp);
  const manaRestored = Math.min(manaAmount, player.maxMana - player.mana);

  // Nothing to restore
  if (hpRestored <= 0 && manaRestored <= 0) {
    return {
      hpRestored: 0,
      manaRestored: 0,
      newHp: player.currentHp,
      newMana: player.mana,
    };
  }

  const newHp = player.currentHp + hpRestored;
  const newMana = player.mana + manaRestored;

  await db
    .update(players)
    .set({ currentHp: newHp, mana: newMana })
    .where(eq(players.id, playerId));

  return {
    hpRestored,
    manaRestored,
    newHp,
    newMana,
  };
}

/**
 * Check and apply regeneration for a player.
 * Should be called on player actions (movement, commands, etc.)
 * Regen is always active but half speed in combat.
 *
 * @param playerId - The player's ID
 * @returns Regen result with amounts restored, or null if no regen occurred
 */
export async function checkAndApplyRegen(
  playerId: string,
): Promise<RegenResult | null> {
  const inCombat = isPlayerInCombat(playerId);

  // Get player's current state
  const player = await db
    .select({
      currentHp: players.currentHp,
      maxHp: players.maxHp,
      mana: players.mana,
      maxMana: players.maxMana,
      lastRegenAt: players.lastRegenAt,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) return null;

  const now = new Date();
  const lastRegen = player.lastRegenAt || now;
  const secondsElapsed = Math.floor(
    (now.getTime() - lastRegen.getTime()) / 1000,
  );

  // No time has passed
  if (secondsElapsed <= 0) return null;

  // Calculate intervals based on combat state
  const manaInterval = inCombat
    ? MANA_REGEN_INTERVAL_OOC * COMBAT_REGEN_MULTIPLIER
    : MANA_REGEN_INTERVAL_OOC;
  const hpInterval = inCombat
    ? HP_REGEN_INTERVAL_OOC * COMBAT_REGEN_MULTIPLIER
    : HP_REGEN_INTERVAL_OOC;

  // Calculate regen ticks
  const manaTicks = Math.floor(secondsElapsed / manaInterval);
  const hpTicks = Math.floor(secondsElapsed / hpInterval);

  // Nothing to regen yet
  if (manaTicks === 0 && hpTicks === 0) return null;

  // Calculate percentage-based amounts with minimum of 1 per tick
  const manaPerTick = Math.max(
    MIN_REGEN_PER_TICK,
    Math.floor((player.maxMana * REGEN_PERCENT_PER_TICK) / 100),
  );
  const hpPerTick = Math.max(
    MIN_REGEN_PER_TICK,
    Math.floor((player.maxHp * REGEN_PERCENT_PER_TICK) / 100),
  );

  const manaToRestore = manaTicks * manaPerTick;
  const hpToRestore = hpTicks * hpPerTick;

  // Use the shared restore function
  const result = await restorePlayerResources(
    playerId,
    hpToRestore,
    manaToRestore,
  );

  if (!result) return null;

  // Update lastRegenAt
  await db
    .update(players)
    .set({ lastRegenAt: now })
    .where(eq(players.id, playerId));

  // Return null if nothing was actually restored
  if (result.hpRestored === 0 && result.manaRestored === 0) {
    return null;
  }

  return result;
}

/**
 * Reset regen timer for a player (call on login to start fresh)
 * @param playerId - The player's ID
 */
export async function resetRegenTimer(playerId: string): Promise<void> {
  await db
    .update(players)
    .set({ lastRegenAt: new Date() })
    .where(eq(players.id, playerId));
}

/**
 * Format a regen result as a message for the player
 * @param result - The regen result
 * @returns Formatted message or null if nothing to report
 */
export function formatRegenMessage(result: RegenResult | null): string | null {
  if (!result) return null;

  const parts: string[] = [];

  if (result.hpRestored > 0) {
    parts.push(`${result.hpRestored} HP`);
  }
  if (result.manaRestored > 0) {
    parts.push(`${result.manaRestored} mana`);
  }

  if (parts.length === 0) return null;

  return `You recover ${parts.join(" and ")}.`;
}
