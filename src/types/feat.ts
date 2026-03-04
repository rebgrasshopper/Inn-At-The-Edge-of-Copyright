/**
 * Feat type representing a character ability or rule modification.
 * @property id - Unique identifier for the feat
 * @property name - Display name of the feat
 * @property prerequisitesText - Original prerequisite text from CSV for display purposes
 * @property shortDescription - Brief description of the feat's effect
 * @property longDescription - Detailed description of the feat
 * @property sourceBook - Source book where the feat originates
 * @property category - Feat category (Combat, Teamwork, etc.)
 * @property effectType - Type of mechanical effect (hp_bonus, ac_bonus, combat_stance, equipment_unlock)
 * @property supportabilityStatus - Whether the feat's prerequisites can be evaluated by current game systems
 */
export type Feat = {
  id: string;
  name: string;
  prerequisitesText: string | null;
  shortDescription: string;
  longDescription: string | null;
  sourceBook: string | null;
  category: string;
  effectType: string | null;
  supportabilityStatus: "supported" | "unsupported" | "partially_supported";
};

/**
 * Parsed prerequisite data for a feat.
 * @property id - Unique identifier for the prerequisite record
 * @property featId - ID of the feat this prerequisite belongs to
 * @property prerequisiteType - Type of prerequisite (stat, level, bab, feat, or unsupported)
 * @property prerequisiteKey - Key for the prerequisite (stat name, feat name, or original text for unsupported)
 * @property prerequisiteValue - Minimum value required for stat/level/bab prerequisites
 */
export type FeatPrerequisite = {
  id: string;
  featId: string;
  prerequisiteType: "stat" | "level" | "bab" | "feat" | "unsupported";
  prerequisiteKey: string | null;
  prerequisiteValue: number | null;
};

/**
 * Record of a feat acquired by a player.
 * @property id - Unique identifier for the player-feat record
 * @property playerId - ID of the player who acquired the feat
 * @property featId - ID of the acquired feat
 * @property acquiredAt - Timestamp when the feat was acquired
 */
export type PlayerFeat = {
  id: string;
  playerId: string;
  featId: string;
  acquiredAt: Date;
};

/**
 * Weapon range classification for determining stance feat applicability.
 * - "melee" - Close-range weapons (swords, axes, etc.)
 * - "ranged" - Distance weapons (bows, crossbows, etc.)
 */
export type WeaponRange = "melee" | "ranged";
