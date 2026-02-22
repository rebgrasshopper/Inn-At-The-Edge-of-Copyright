import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { players } from "../db/schema.js";
import * as CommandParser from "../services/CommandParser.js";
import * as FeatureService from "../services/FeatureService.js";
import * as RoomService from "../services/RoomService.js";
/**
 * Get the socket room name for a game room
 * @param roomId - The game room ID
 * @returns Socket room name
 */
export function getSocketRoomName(roomId) {
    return `room:${roomId}`;
}
/**
 * Get the socket room name for a player's private channel
 * @param playerId - The player ID
 * @returns Socket room name for private messages
 */
export function getPlayerRoomName(playerId) {
    return `player:${playerId}`;
}
/**
 * Update player's online status in the database
 * @param playerId - The player ID
 * @param isOnline - Whether the player is online
 */
async function updateOnlineStatus(playerId, isOnline) {
    await db.update(players).set({ isOnline }).where(eq(players.id, playerId));
}
/**
 * Handle player connection - set online, join room, broadcast entry
 * @param _io - Socket.io server instance (unused, kept for API consistency)
 * @param socket - The connected socket
 */
export async function handleConnection(_io, socket) {
    const player = socket.player;
    if (!player || !player.currentRoomId) {
        socket.emit("error", { message: "Invalid player state" });
        socket.disconnect();
        return;
    }
    // Update online status
    await updateOnlineStatus(player.id, true);
    // Join the player's private channel (for whispers)
    socket.join(getPlayerRoomName(player.id));
    // Join the game room's socket room
    const socketRoomName = getSocketRoomName(player.currentRoomId);
    socket.join(socketRoomName);
    // Check for re-hiding features when entering room
    const playersInRoom = await RoomService.getPlayersInRoom(player.currentRoomId);
    // Subtract 1 because the entering player is already counted
    await FeatureService.checkRehideOnRoomEntry(player.currentRoomId, playersInRoom.length - 1);
    // Get room data to send to the player
    const roomData = await RoomService.getRoomWithContents(player.currentRoomId);
    if (!roomData) {
        socket.emit("error", { message: "Room not found" });
        return;
    }
    // Send room data to the connecting player
    const enterData = {
        room: roomData,
        player: player,
    };
    socket.emit("room:enter", enterData);
    // Broadcast to others in the room that this player entered
    socket.to(socketRoomName).emit("system:message", {
        content: `${player.name} has entered.`,
        timestamp: new Date().toISOString(),
    });
}
/**
 * Handle player disconnection - set offline, notify room
 * @param _io - Socket.io server instance (unused, kept for API consistency)
 * @param socket - The disconnecting socket
 */
export async function handleDisconnect(_io, socket) {
    const player = socket.player;
    if (!player)
        return;
    // Update online status
    await updateOnlineStatus(player.id, false);
    // Notify the room
    if (player.currentRoomId) {
        const socketRoomName = getSocketRoomName(player.currentRoomId);
        socket.to(socketRoomName).emit("system:message", {
            content: `${player.name} has left.`,
            timestamp: new Date().toISOString(),
        });
    }
}
/**
 * Handle a command from the player
 * @param io - Socket.io server instance
 * @param socket - The socket that sent the command
 * @param input - The raw command input
 */
export async function handleCommand(io, socket, input) {
    const player = socket.player;
    if (!player || !player.currentRoomId) {
        socket.emit("error", { message: "Invalid player state" });
        return;
    }
    // Get current room
    const room = await RoomService.getRoom(player.currentRoomId);
    if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
    }
    // Parse the command
    const parsed = CommandParser.parse(input);
    // Execute the command
    const result = await CommandParser.execute(parsed, {
        player,
        room,
        socket,
    });
    // Send result message to the player
    if (result.message) {
        const messageData = {
            id: crypto.randomUUID(),
            type: result.success ? "system" : "error",
            content: result.message,
            timestamp: new Date().toISOString(),
        };
        socket.emit("chat:message", messageData);
    }
    // Handle broadcasts
    if (result.broadcast) {
        for (const broadcast of result.broadcast) {
            const targetRoom = broadcast.room;
            if (!targetRoom) {
                // Broadcast to all (rare)
                io.emit(broadcast.event, broadcast.data);
            }
            else if (targetRoom.startsWith("player:")) {
                // Private message to specific player
                io.to(targetRoom).emit(broadcast.event, broadcast.data);
            }
            else if (targetRoom.startsWith("room:")) {
                // Already formatted as socket room
                io.to(targetRoom).emit(broadcast.event, broadcast.data);
            }
            else {
                // Game room ID - convert to socket room name
                io.to(getSocketRoomName(targetRoom)).emit(broadcast.event, broadcast.data);
            }
        }
    }
    // Handle room changes (movement)
    if (parsed.type === "movement" && result.success) {
        await handleRoomChange(io, socket, player);
    }
}
/**
 * Handle room change after movement - update socket rooms
 * @param _io - Socket.io server instance (unused, kept for API consistency)
 * @param socket - The socket that moved
 * @param player - The player who moved
 */
async function handleRoomChange(_io, socket, player) {
    // Get updated player data from DB
    const updatedPlayer = await db
        .select()
        .from(players)
        .where(eq(players.id, player.id))
        .get();
    if (!updatedPlayer || !updatedPlayer.currentRoomId)
        return;
    const oldRoomId = player.currentRoomId;
    const newRoomId = updatedPlayer.currentRoomId;
    if (oldRoomId === newRoomId)
        return;
    // Leave old socket room
    if (oldRoomId) {
        socket.leave(getSocketRoomName(oldRoomId));
    }
    // Join new socket room
    socket.join(getSocketRoomName(newRoomId));
    // Update socket's player reference
    socket.player = {
        ...player,
        currentRoomId: newRoomId,
    };
    // Check for re-hiding features when entering new room
    const playersInNewRoom = await RoomService.getPlayersInRoom(newRoomId);
    await FeatureService.checkRehideOnRoomEntry(newRoomId, playersInNewRoom.length - 1);
    // Get new room data
    const newRoomData = await RoomService.getRoomWithContents(newRoomId);
    if (newRoomData) {
        // Send full room data to the moving player
        const enterData = {
            room: newRoomData,
            player: socket.player,
        };
        socket.emit("room:enter", enterData);
        // Notify others in new room
        socket.to(getSocketRoomName(newRoomId)).emit("system:message", {
            content: `${player.name} has arrived.`,
            timestamp: new Date().toISOString(),
        });
    }
}
/**
 * Broadcast a player update to relevant parties
 * @param io - Socket.io server instance
 * @param playerId - The player who was updated
 * @param changes - The changes to broadcast
 */
export function broadcastPlayerUpdate(io, playerId, changes) {
    const updateData = {
        player: { id: playerId, ...changes },
    };
    // Send to the player's private channel
    io.to(getPlayerRoomName(playerId)).emit("player:update", updateData);
}
/**
 * Broadcast a chat message to a room
 * @param io - Socket.io server instance
 * @param roomId - The game room ID
 * @param message - The message data
 */
export function broadcastToRoom(io, roomId, message) {
    io.to(getSocketRoomName(roomId)).emit("chat:message", message);
}
/**
 * Broadcast a room leave event
 * @param io - Socket.io server instance
 * @param roomId - The game room ID
 * @param data - The leave data
 */
export function broadcastRoomLeave(io, roomId, data) {
    io.to(getSocketRoomName(roomId)).emit("room:leave", data);
}
/**
 * Register all socket event handlers for a connection
 * @param io - Socket.io server instance
 * @param socket - The connected socket
 */
export function registerHandlers(io, socket) {
    // Handle connection setup
    handleConnection(io, socket);
    // Handle commands
    socket.on("command", (input) => {
        handleCommand(io, socket, input);
    });
    // Handle disconnect
    socket.on("disconnect", () => {
        handleDisconnect(io, socket);
    });
}
//# sourceMappingURL=handlers.js.map