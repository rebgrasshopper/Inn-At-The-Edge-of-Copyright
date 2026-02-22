import type { EffectResult, PlayerEffect } from "../types/feature.js";
import type { PlayerStats } from "../types/player.js";
/** Time in milliseconds for hidden features to re-hide (2 hours) */
export declare const REHIDE_TIMEOUT_MS: number;
/**
 * Apply damage to a player, reducing their currentHp
 * @param playerId - The player to damage
 * @param amount - Amount of damage to apply
 * @param damageType - Optional damage type (e.g., "fire", "poison")
 * @returns EffectResult with success status and message
 */
export declare function applyDamage(playerId: string, amount: number, damageType?: string): Promise<EffectResult>;
/**
 * Heal a player, increasing their currentHp up to maxHp
 * @param playerId - The player to heal
 * @param amount - Amount of healing to apply
 * @returns EffectResult with success status and message
 */
export declare function applyHeal(playerId: string, amount: number): Promise<EffectResult>;
/**
 * Award XP to a player
 * @param playerId - The player to award XP to
 * @param amount - Amount of XP to award
 * @returns EffectResult with success status and message
 */
export declare function awardXp(playerId: string, amount: number): Promise<EffectResult>;
/**
 * Modify a player's stat permanently
 * @param playerId - The player to modify
 * @param stat - The stat to modify (str, dex, con, int, wis, cha)
 * @param amount - Amount to add (can be negative)
 * @returns EffectResult with success status and message
 */
export declare function modifyStat(playerId: string, stat: keyof PlayerStats, amount: number): Promise<EffectResult>;
/**
 * Give an item to a player
 * @param playerId - The player to give the item to
 * @param itemId - The ID of the item to give
 * @param quantity - How many to give (default 1)
 * @returns EffectResult with success status and message
 */
export declare function giveItem(playerId: string, itemId: string, quantity?: number): Promise<EffectResult>;
/**
 * Teleport a player to a different room
 * @param playerId - The player to teleport
 * @param roomId - The destination room ID
 * @returns EffectResult with success status and message
 */
export declare function teleport(playerId: string, roomId: string): Promise<EffectResult>;
/**
 * Apply a status effect to a player (stub for now)
 * @param _playerId - The player to apply the status to (unused until status system implemented)
 * @param status - The status name
 * @param duration - Optional duration in seconds
 * @returns EffectResult with success status and message
 */
export declare function applyStatus(_playerId: string, status: string, duration?: number): Promise<EffectResult>;
/**
 * Unblock an exit in the player's current room
 * @param playerId - The player (used to get current room)
 * @param direction - The direction to unblock
 * @returns EffectResult with success status and message
 */
export declare function unblockExit(playerId: string, direction: string): Promise<EffectResult>;
/**
 * Apply an array of effects to a player
 * @param playerId - The player to apply effects to
 * @param effects - Array of effects to apply
 * @returns Array of EffectResults
 */
export declare function apply(playerId: string, effects: PlayerEffect[]): Promise<EffectResult[]>;
//# sourceMappingURL=EffectHandler.d.ts.map