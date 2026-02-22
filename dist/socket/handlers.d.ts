import type { Server, Socket } from "socket.io";
import type { Player } from "../types/player.js";
/** Data sent when a player leaves a room */
type RoomLeaveData = {
    playerName: string;
    roomId: string;
};
/** Data sent for chat messages */
type ChatMessageData = {
    id: string;
    type: "system" | "error" | "speak" | "shout" | "whisper" | "emote";
    content: string;
    sender?: string;
    timestamp: string;
};
/**
 * Get the socket room name for a game room
 * @param roomId - The game room ID
 * @returns Socket room name
 */
export declare function getSocketRoomName(roomId: string): string;
/**
 * Get the socket room name for a player's private channel
 * @param playerId - The player ID
 * @returns Socket room name for private messages
 */
export declare function getPlayerRoomName(playerId: string): string;
/**
 * Handle player connection - set online, join room, broadcast entry
 * @param _io - Socket.io server instance (unused, kept for API consistency)
 * @param socket - The connected socket
 */
export declare function handleConnection(_io: Server, socket: Socket): Promise<void>;
/**
 * Handle player disconnection - set offline, notify room
 * @param _io - Socket.io server instance (unused, kept for API consistency)
 * @param socket - The disconnecting socket
 */
export declare function handleDisconnect(_io: Server, socket: Socket): Promise<void>;
/**
 * Handle a command from the player
 * @param io - Socket.io server instance
 * @param socket - The socket that sent the command
 * @param input - The raw command input
 */
export declare function handleCommand(io: Server, socket: Socket, input: string): Promise<void>;
/**
 * Broadcast a player update to relevant parties
 * @param io - Socket.io server instance
 * @param playerId - The player who was updated
 * @param changes - The changes to broadcast
 */
export declare function broadcastPlayerUpdate(io: Server, playerId: string, changes: Partial<Player>): void;
/**
 * Broadcast a chat message to a room
 * @param io - Socket.io server instance
 * @param roomId - The game room ID
 * @param message - The message data
 */
export declare function broadcastToRoom(io: Server, roomId: string, message: ChatMessageData): void;
/**
 * Broadcast a room leave event
 * @param io - Socket.io server instance
 * @param roomId - The game room ID
 * @param data - The leave data
 */
export declare function broadcastRoomLeave(io: Server, roomId: string, data: RoomLeaveData): void;
/**
 * Register all socket event handlers for a connection
 * @param io - Socket.io server instance
 * @param socket - The connected socket
 */
export declare function registerHandlers(io: Server, socket: Socket): void;
export {};
//# sourceMappingURL=handlers.d.ts.map