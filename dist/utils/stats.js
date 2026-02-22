/**
 * Default stats for new characters
 * All stats start at 10 (average human in Pathfinder terms)
 */
export const DEFAULT_STATS = {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
};
/**
 * Default HP for new characters
 * Based on CON modifier + base (simplified for MVP)
 */
export const DEFAULT_HP = 10;
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
export function generateStats(_options) {
    // For MVP, just return defaults
    // Future: switch on options.method or options.characterClass
    return { ...DEFAULT_STATS };
}
/**
 * Calculate starting HP for a character
 *
 * Currently returns default HP.
 * Future: could factor in CON modifier, character class hit die, etc.
 *
 * @param _stats - The character's stats (for future CON-based calculation)
 * @returns Starting HP value
 */
export function calculateStartingHp(_stats) {
    // For MVP, just return default
    // Future: return DEFAULT_HP + Math.floor((stats.con - 10) / 2)
    return DEFAULT_HP;
}
//# sourceMappingURL=stats.js.map