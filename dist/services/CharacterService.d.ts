import type { Player } from "../types/player.js";
export declare const STARTING_ROOM_ID = "room-town-square";
export type CharacterCreationResult = {
    success: boolean;
    player?: Player;
    error?: string;
};
/**
 * Check if a character name is already taken
 */
export declare function isNameTaken(name: string): Promise<boolean>;
/**
 * Create a new character for a user
 *
 * @param userId - The user's ID (from auth)
 * @param name - The desired character name
 * @returns CharacterCreationResult with the new player or error
 */
export declare function createCharacter(userId: string, name: string): Promise<CharacterCreationResult>;
/**
 * Get all characters for a user
 */
export declare function getCharactersByUserId(userId: string): Promise<Player[]>;
/**
 * Get a specific character by ID
 */
export declare function getCharacterById(characterId: string): Promise<Player | null>;
//# sourceMappingURL=CharacterService.d.ts.map