/**
 * Core feat management service.
 * Handles feat queries, prerequisite checking, and acquisition.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  featPrerequisites,
  feats,
  playerFeats,
  players,
} from "../db/schema.js";
import type { Feat } from "../types/feat.js";
import { babToLevel } from "./feats/prerequisiteParser.js";

/** Prerequisite check result */
export type PrerequisiteResult = {
  met: boolean;
  unmetRequirements: string[];
};

/**
 * Calculate BAB (Base Attack Bonus) from player level.
 * Formula: BAB = floor(level / 3)
 * @param level - The player's level (1-99)
 * @returns The player's BAB value
 */
export function calculateBAB(level: number): number {
  return Math.floor(level / 3);
}

/**
 * Get all feats a player has acquired.
 * @param playerId - The player's ID
 * @returns Array of feat records with name and description
 */
export async function getPlayerFeats(playerId: string): Promise<Feat[]> {
  const results = await db
    .select({
      id: feats.id,
      name: feats.name,
      prerequisitesText: feats.prerequisitesText,
      shortDescription: feats.shortDescription,
      longDescription: feats.longDescription,
      sourceBook: feats.sourceBook,
      category: feats.category,
      effectType: feats.effectType,
      supportabilityStatus: feats.supportabilityStatus,
    })
    .from(playerFeats)
    .innerJoin(feats, eq(playerFeats.featId, feats.id))
    .where(eq(playerFeats.playerId, playerId));

  return results as Feat[];
}

/**
 * Normalize a string for feat name matching by removing articles.
 * This handles cases where the command parser strips "the", "a", "an" from input.
 * @param str - The string to normalize
 * @returns Normalized string with articles removed and whitespace collapsed
 */
function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Get feat details by name (case-insensitive fuzzy match).
 * Tries exact match first, then normalized match (ignoring articles),
 * then partial match if no exact match found.
 * @param featName - The feat name to search
 * @returns Feat record or null if not found
 */
export async function getFeatByName(
  featName: string,
  supportedOnly = false,
): Promise<Feat | null> {
  const searchTerm = featName.toLowerCase();
  const normalizedSearch = normalizeForSearch(featName);

  // Try exact match first (case-insensitive)
  const exactMatch = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.name}) = ${searchTerm}`)
    .limit(1);

  if (exactMatch.length > 0) {
    const feat = exactMatch[0] as Feat;
    if (supportedOnly && feat.supportabilityStatus !== "supported") {
      return null;
    }
    return feat;
  }

  // Try normalized match (ignoring articles like "the", "a", "an")
  // This handles cases where command parser stripped articles from input
  const allFeats = await db.select().from(feats);
  const normalizedMatch = allFeats.find(
    (f) => normalizeForSearch(f.name) === normalizedSearch,
  );

  if (normalizedMatch) {
    if (supportedOnly && normalizedMatch.supportabilityStatus !== "supported") {
      return null;
    }
    return normalizedMatch as Feat;
  }

  // Try partial match (case-insensitive fuzzy match using LIKE)
  const partialMatch = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.name}) LIKE ${"%" + searchTerm + "%"}`)
    .limit(1);

  if (partialMatch.length > 0) {
    const feat = partialMatch[0] as Feat;
    if (supportedOnly && feat.supportabilityStatus !== "supported") {
      return null;
    }
    return feat;
  }

  // Try partial match with normalized search term
  const normalizedPartialMatch = allFeats.find((f) =>
    normalizeForSearch(f.name).includes(normalizedSearch),
  );

  if (normalizedPartialMatch) {
    if (
      supportedOnly &&
      normalizedPartialMatch.supportabilityStatus !== "supported"
    ) {
      return null;
    }
    return normalizedPartialMatch as Feat;
  }

  return null;
}

/**
 * Check if a player has a specific feat by name.
 * @param playerId - The player's ID
 * @param featName - The feat name (case-insensitive)
 * @returns True if player has the feat
 */
export async function hasFeat(
  playerId: string,
  featName: string,
): Promise<boolean> {
  // First find the feat by name
  const feat = await getFeatByName(featName);
  if (!feat) {
    return false;
  }

  return hasFeatById(playerId, feat.id);
}

/**
 * Check if a player has a specific feat by ID.
 * More efficient than hasFeat when you know the feat ID.
 * @param playerId - The player's ID
 * @param featId - The feat's ID
 * @returns True if player has the feat
 */
export async function hasFeatById(
  playerId: string,
  featId: string,
): Promise<boolean> {
  const playerFeat = await db
    .select({ id: playerFeats.id })
    .from(playerFeats)
    .where(
      sql`${playerFeats.playerId} = ${playerId} AND ${playerFeats.featId} = ${featId}`,
    )
    .limit(1);

  return playerFeat.length > 0;
}

/**
 * Check if a player meets all prerequisites for a feat.
 * Evaluates stat, level, BAB, and feat prerequisites against the player's current state.
 * @param playerId - The player's ID
 * @param featId - The feat's ID
 * @returns Result with met status and list of unmet requirements
 */
export async function checkPrerequisites(
  playerId: string,
  featId: string,
): Promise<PrerequisiteResult> {
  // Get the player's stats and level
  const player = await db
    .select({
      str: players.str,
      dex: players.dex,
      con: players.con,
      int: players.int,
      wis: players.wis,
      cha: players.cha,
      level: players.level,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (player.length === 0) {
    return {
      met: false,
      unmetRequirements: ["Player not found"],
    };
  }

  const playerStats = player[0];

  // Get all prerequisites for this feat
  const prerequisites = await db
    .select({
      type: featPrerequisites.prerequisiteType,
      key: featPrerequisites.prerequisiteKey,
      value: featPrerequisites.prerequisiteValue,
    })
    .from(featPrerequisites)
    .where(eq(featPrerequisites.featId, featId));

  const unmetRequirements: string[] = [];

  for (const prereq of prerequisites) {
    switch (prereq.type) {
      case "stat": {
        // Verify stat requirements against player stats
        const statKey = prereq.key?.toLowerCase() as
          | "str"
          | "dex"
          | "con"
          | "int"
          | "wis"
          | "cha";
        const requiredValue = prereq.value ?? 0;
        const playerValue = playerStats[statKey] ?? 0;

        if (playerValue < requiredValue) {
          const statName = statKey.charAt(0).toUpperCase() + statKey.slice(1);
          unmetRequirements.push(
            `${statName} ${requiredValue} (you have ${playerValue})`,
          );
        }
        break;
      }

      case "level": {
        // Verify level requirements against player level
        const requiredLevel = prereq.value ?? 0;
        if (playerStats.level < requiredLevel) {
          unmetRequirements.push(
            `Level ${requiredLevel} (you are level ${playerStats.level})`,
          );
        }
        break;
      }

      case "bab": {
        // Convert BAB to level requirement and verify
        const requiredBAB = prereq.value ?? 0;
        const requiredLevel = babToLevel(requiredBAB);
        if (playerStats.level < requiredLevel) {
          unmetRequirements.push(
            `Base Attack Bonus +${requiredBAB} (requires level ${requiredLevel}, you are level ${playerStats.level})`,
          );
        }
        break;
      }

      case "feat": {
        // Verify feat requirements against player_feats
        const requiredFeatName = prereq.key;
        if (requiredFeatName) {
          const hasRequiredFeat = await hasFeat(playerId, requiredFeatName);
          if (!hasRequiredFeat) {
            unmetRequirements.push(`${requiredFeatName} feat`);
          }
        }
        break;
      }

      case "unsupported":
        // Skip unsupported prerequisites - these are handled by supportability status
        break;

      default:
        // Unknown prerequisite type - skip
        break;
    }
  }

  return {
    met: unmetRequirements.length === 0,
    unmetRequirements,
  };
}

/**
 * Get feats available for a player to acquire.
 * Filters by: supported status, not already owned, prerequisites met.
 * @param playerId - The player's ID
 * @returns Array of acquirable feats
 */
export async function getAvailableFeats(playerId: string): Promise<Feat[]> {
  // 1. Get all feats with supportabilityStatus = "supported"
  const supportedFeats = await db
    .select()
    .from(feats)
    .where(eq(feats.supportabilityStatus, "supported"));

  // 2. Get the player's current feats (to exclude already owned)
  const ownedFeats = await getPlayerFeats(playerId);
  const ownedFeatIds = new Set(ownedFeats.map((f) => f.id));

  // 3. Filter out already owned feats
  const notOwnedFeats = supportedFeats.filter((f) => !ownedFeatIds.has(f.id));

  // 4. For each supported feat not already owned, check prerequisites
  const availableFeats: Feat[] = [];
  for (const feat of notOwnedFeats) {
    const prereqResult = await checkPrerequisites(playerId, feat.id);
    if (prereqResult.met) {
      availableFeats.push(feat as Feat);
    }
  }

  return availableFeats;
}

/**
 * Grant a feat slot to a player (called on level-up to even levels).
 * Increments the player's unspent_feat_slots by 1.
 * @param playerId - The player's ID
 * @throws Error if player is not found
 */
export async function grantFeatSlot(playerId: string): Promise<void> {
  await db
    .update(players)
    .set({
      unspentFeatSlots: sql`${players.unspentFeatSlots} + 1`,
    })
    .where(eq(players.id, playerId));
}

/** Feat acquisition result */
export type AcquireFeatResult = {
  success: boolean;
  message: string;
};

/**
 * Attempt to acquire a feat for a player.
 * Validates: has slots, meets prerequisites, doesn't already have it.
 * @param playerId - The player's ID
 * @param featId - The feat's ID
 * @returns Result with success status and message
 * @throws Error if player or feat is not found
 */
export async function acquireFeat(
  playerId: string,
  featId: string,
): Promise<AcquireFeatResult> {
  // 1. Get the player's unspent_feat_slots
  const playerResult = await db
    .select({
      unspentFeatSlots: players.unspentFeatSlots,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (playerResult.length === 0) {
    return {
      success: false,
      message: "Player not found.",
    };
  }

  const { unspentFeatSlots } = playerResult[0];

  // 2. Check if player has slots (return error if 0)
  if (unspentFeatSlots <= 0) {
    return {
      success: false,
      message:
        "You don't have any feat slots available. Gain more by leveling up.",
    };
  }

  // 3. Get the feat by ID
  const featResult = await db
    .select()
    .from(feats)
    .where(eq(feats.id, featId))
    .limit(1);

  if (featResult.length === 0) {
    return {
      success: false,
      message: "Feat not found.",
    };
  }

  const feat = featResult[0];

  // 4. Check if player already has the feat (return error if yes)
  const existingPlayerFeat = await db
    .select({ id: playerFeats.id })
    .from(playerFeats)
    .where(
      sql`${playerFeats.playerId} = ${playerId} AND ${playerFeats.featId} = ${featId}`,
    )
    .limit(1);

  if (existingPlayerFeat.length > 0) {
    return {
      success: false,
      message: `You already have the ${feat.name} feat.`,
    };
  }

  // 5. Check prerequisites (return error with unmet list if not met)
  const prereqResult = await checkPrerequisites(playerId, featId);
  if (!prereqResult.met) {
    const unmetList = prereqResult.unmetRequirements.join(", ");
    return {
      success: false,
      message: `You don't meet the prerequisites for ${feat.name}: ${unmetList}`,
    };
  }

  // 6. Decrement unspent_feat_slots
  await db
    .update(players)
    .set({
      unspentFeatSlots: sql`${players.unspentFeatSlots} - 1`,
    })
    .where(eq(players.id, playerId));

  // 7. Create player_feats record with current timestamp
  const newPlayerFeatId = crypto.randomUUID();
  await db.insert(playerFeats).values({
    id: newPlayerFeatId,
    playerId,
    featId,
    acquiredAt: new Date(),
  });

  // 8. Return success message
  return {
    success: true,
    message: `You have acquired the ${feat.name} feat!`,
  };
}

/**
 * Get feats filtered by category.
 * @param category - Category name (e.g., "Combat", "Teamwork")
 * @param supportedOnly - If true, only return supported feats (default: false)
 * @returns Array of feats in the category
 */
export async function getFeatsByCategory(
  category: string,
  supportedOnly = false,
): Promise<Feat[]> {
  const searchCategory = category.toLowerCase();

  if (supportedOnly) {
    const results = await db
      .select()
      .from(feats)
      .where(
        sql`lower(${feats.category}) = ${searchCategory} AND ${feats.supportabilityStatus} = 'supported'`,
      );
    return results as Feat[];
  }

  const results = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.category}) = ${searchCategory}`);
  return results as Feat[];
}

/**
 * Get all unique feat categories with feat counts.
 * @returns Array of category names with feat counts
 */
export async function getCategories(): Promise<
  Array<{ name: string; count: number }>
> {
  const results = await db
    .select({
      name: feats.category,
      count: sql<number>`count(*)`,
    })
    .from(feats)
    .groupBy(feats.category)
    .orderBy(feats.category);

  return results;
}

/**
 * Check if a feat is a stance feat.
 * Stance feats have effect_type = "combat_stance".
 * @param featId - The feat's ID
 * @returns True if the feat is a stance feat
 */
export async function isStanceFeat(featId: string): Promise<boolean> {
  const result = await db
    .select({ effectType: feats.effectType })
    .from(feats)
    .where(eq(feats.id, featId))
    .limit(1);

  if (result.length === 0) {
    return false;
  }

  return result[0].effectType === "combat_stance";
}

/** Stance operation result */
export type StanceResult = {
  success: boolean;
  message: string;
};

/**
 * Set the active stance for a player.
 * Validates that the player has the feat and that it's a stance feat.
 * @param playerId - The player's ID
 * @param featId - The stance feat's ID, or null to deactivate
 * @returns Result with success status and message
 */
export async function setActiveStance(
  playerId: string,
  featId: string | null,
): Promise<StanceResult> {
  // If deactivating stance
  if (featId === null) {
    // Check if player has an active stance
    const currentStance = await getActiveStance(playerId);
    if (!currentStance) {
      return {
        success: false,
        message: "You don't have a stance active.",
      };
    }

    await db
      .update(players)
      .set({ activeStance: null })
      .where(eq(players.id, playerId));

    return {
      success: true,
      message: `You deactivate your ${currentStance.name} stance.`,
    };
  }

  // Get the feat
  const featResult = await db
    .select()
    .from(feats)
    .where(eq(feats.id, featId))
    .limit(1);

  if (featResult.length === 0) {
    return {
      success: false,
      message: "Feat not found.",
    };
  }

  const feat = featResult[0];

  // Check if it's a stance feat
  if (feat.effectType !== "combat_stance") {
    return {
      success: false,
      message: `${feat.name} is not a stance feat.`,
    };
  }

  // Check if player has this feat
  const hasThisFeat = await hasFeat(playerId, feat.name);
  if (!hasThisFeat) {
    return {
      success: false,
      message: `You don't have the ${feat.name} feat.`,
    };
  }

  // Check if already active
  const currentStance = await getActiveStance(playerId);
  if (currentStance && currentStance.id === featId) {
    return {
      success: false,
      message: `${feat.name} is already active.`,
    };
  }

  // Set the active stance
  await db
    .update(players)
    .set({ activeStance: featId })
    .where(eq(players.id, playerId));

  return {
    success: true,
    message: `You adopt the ${feat.name} stance.`,
  };
}

/**
 * Get the active stance for a player.
 * @param playerId - The player's ID
 * @returns The active stance feat, or null if no stance is active
 */
export async function getActiveStance(playerId: string): Promise<Feat | null> {
  const playerResult = await db
    .select({ activeStance: players.activeStance })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (playerResult.length === 0 || !playerResult[0].activeStance) {
    return null;
  }

  const stanceFeatId = playerResult[0].activeStance;

  const featResult = await db
    .select()
    .from(feats)
    .where(eq(feats.id, stanceFeatId))
    .limit(1);

  if (featResult.length === 0) {
    return null;
  }

  return featResult[0] as Feat;
}
