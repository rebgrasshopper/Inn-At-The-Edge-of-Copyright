import type { PlayerStats } from "../types/player.js";
/**
 * Default stats for new characters
 * All stats start at 10 (average human in Pathfinder terms)
 */
export declare const DEFAULT_STATS: PlayerStats;
/**
 * Default HP for new characters
 * Based on CON modifier + base (simplified for MVP)
 */
export declare const DEFAULT_HP = 10;
/**
 * Generate stats for a new character
 *
 * Currently returns default stats (all 10s).
 * This function is designed to be extended later for:
 * - Character class defaults (wizard, fighter, etc.)
 * - Random rolling (4d6 drop lowest, etc.)
 * - Point buy system
 *
 * @param _options - Reserved for future use (class, method, etc.)
 * @returns PlayerStats object
 */
export declare function generateStats(_options?: {
    characterClass?: string;
    method?: "default" | "random" | "pointbuy";
}): PlayerStats;
/**
 * Calculate starting HP for a character
 *
 * Currently returns default HP.
 * Future: could factor in CON modifier, character class hit die, etc.
 *
 * @param _stats - The character's stats (for future CON-based calculation)
 * @returns Starting HP value
 */
export declare function calculateStartingHp(_stats: PlayerStats): number;
//# sourceMappingURL=stats.d.ts.map