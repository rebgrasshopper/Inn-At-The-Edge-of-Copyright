import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { players } from "../db/schema.js";
import type { Player } from "../types/player.js";
import { validateCharacterName } from "../utils/characterValidation.js";
import { calculateStartingHp, generateStats } from "../utils/stats.js";

// Starting room for new characters
export const STARTING_ROOM_ID = "room-town-square";

export type CharacterCreationResult = {
  success: boolean;
  player?: Player;
  error?: string;
};

/**
 * Check if a character name is already taken
 */
export async function isNameTaken(name: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(players)
    .where(eq(players.name, name.trim()))
    .get();

  return !!existing;
}

/**
 * Create a new character for a user
 *
 * @param userId - The user's ID (from auth)
 * @param name - The desired character name
 * @returns CharacterCreationResult with the new player or error
 */
export async function createCharacter(
  userId: string,
  name: string,
): Promise<CharacterCreationResult> {
  // Validate the name format
  const validation = validateCharacterName(name);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const trimmedName = name.trim();

  // Check uniqueness
  if (await isNameTaken(trimmedName)) {
    return { success: false, error: "Character name is already taken" };
  }

  // Generate stats (currently defaults, extensible for future)
  const stats = generateStats();
  const startingHp = calculateStartingHp(stats);

  // Create the character
  const playerId = uuidv4();

  try {
    await db.insert(players).values({
      id: playerId,
      userId,
      name: trimmedName,
      currentRoomId: STARTING_ROOM_ID,
      str: stats.str,
      dex: stats.dex,
      con: stats.con,
      int: stats.int,
      wis: stats.wis,
      cha: stats.cha,
      currentHp: startingHp,
      maxHp: startingHp,
      xp: 0,
      level: 1,
      isOnline: false,
      createdAt: new Date(),
    });

    const player: Player = {
      id: playerId,
      userId,
      name: trimmedName,
      currentRoomId: STARTING_ROOM_ID,
      stats,
      currentHp: startingHp,
      maxHp: startingHp,
      xp: 0,
      level: 1,
      isOnline: false,
    };

    return { success: true, player };
  } catch (error) {
    console.error("Character creation error:", error);
    return { success: false, error: "Failed to create character" };
  }
}

/**
 * Get all characters for a user
 */
export async function getCharactersByUserId(userId: string): Promise<Player[]> {
  const records = await db
    .select()
    .from(players)
    .where(eq(players.userId, userId));

  return records.map((record) => ({
    id: record.id,
    userId: record.userId,
    name: record.name,
    currentRoomId: record.currentRoomId,
    stats: {
      str: record.str,
      dex: record.dex,
      con: record.con,
      int: record.int,
      wis: record.wis,
      cha: record.cha,
    },
    currentHp: record.currentHp,
    maxHp: record.maxHp,
    xp: record.xp,
    level: record.level,
    isOnline: record.isOnline,
  }));
}

/**
 * Get a specific character by ID
 */
export async function getCharacterById(
  characterId: string,
): Promise<Player | null> {
  const record = await db
    .select()
    .from(players)
    .where(eq(players.id, characterId))
    .get();

  if (!record) return null;

  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    currentRoomId: record.currentRoomId,
    stats: {
      str: record.str,
      dex: record.dex,
      con: record.con,
      int: record.int,
      wis: record.wis,
      cha: record.cha,
    },
    currentHp: record.currentHp,
    maxHp: record.maxHp,
    xp: record.xp,
    level: record.level,
    isOnline: record.isOnline,
  };
}
