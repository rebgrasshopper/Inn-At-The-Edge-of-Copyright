import type { Player } from "../types/player.js";
import type { Direction, Room, RoomWithContents } from "../types/room.js";
export type MoveResult = {
    success: boolean;
    room?: RoomWithContents;
    error?: string;
};
/**
 * Get a room by ID (basic room data only)
 * @param roomId - The room's unique identifier
 * @returns The room or null if not found
 */
export declare function getRoom(roomId: string): Promise<Room | null>;
/**
 * Get all online players in a room
 * @param roomId - The room's unique identifier
 * @returns Array of online players in the room
 */
export declare function getPlayersInRoom(roomId: string): Promise<Player[]>;
/**
 * Get all rooms in a region (for region-wide broadcasts like shouting)
 * @param region - The region name
 * @returns Array of rooms in the region
 */
export declare function getRoomsByRegion(region: string): Promise<Room[]>;
/**
 * Get a room with all its contents (players, items, monsters, NPCs, containers, features)
 * @param roomId - The room's unique identifier
 * @returns The room with all contents or null if room not found
 */
export declare function getRoomWithContents(roomId: string): Promise<RoomWithContents | null>;
/**
 * Move a player in a direction, validating the exit exists and is not blocked
 * @param playerId - The player's unique identifier
 * @param direction - The direction to move
 * @returns MoveResult with the new room contents on success, or error message on failure
 */
export declare function movePlayer(playerId: string, direction: Direction): Promise<MoveResult>;
//# sourceMappingURL=RoomService.d.ts.map