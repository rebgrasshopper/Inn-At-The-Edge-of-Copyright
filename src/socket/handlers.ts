import { eq } from "drizzle-orm";
import type { Server, Socket } from "socket.io";
import { db } from "../db/index.js";
import { players } from "../db/schema.js";
import * as CombatService from "../services/CombatService.js";
import * as CommandParser from "../services/CommandParser.js";
import * as FeatureService from "../services/FeatureService.js";
import * as RoomService from "../services/RoomService.js";
import type { CombatEvent } from "../types/combat.js";
import type { Player } from "../types/player.js";

/** Data sent when a player enters a room */
type RoomEnterData = {
  room: RoomService.MoveResult["room"];
  player: Player;
};

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

/** Data sent for player updates */
type PlayerUpdateData = {
  player: Partial<Player> & { id: string };
};

/** Store io instance for combat broadcasts */
let ioInstance: Server | null = null;

/** Map of playerId -> Socket for death respawn handling */
const playerSockets = new Map<string, Socket>();

/**
 * Get the socket room name for a game room
 * @param roomId - The game room ID
 * @returns Socket room name
 */
export function getSocketRoomName(roomId: string): string {
  return `room:${roomId}`;
}

/**
 * Get the socket room name for a player's private channel
 * @param playerId - The player ID
 * @returns Socket room name for private messages
 */
export function getPlayerRoomName(playerId: string): string {
  return `player:${playerId}`;
}

/**
 * Broadcast a combat event to a room
 * @param roomId - The game room ID
 * @param event - The combat event to broadcast
 * @param excludePlayerId - Optional player ID to exclude from broadcast
 */
function broadcastCombatEvent(
  roomId: string,
  event: CombatEvent,
  excludePlayerId?: string,
): void {
  if (!ioInstance) return;

  const socketRoom = getSocketRoomName(roomId);
  let message: string;

  switch (event.type) {
    case "combat_start":
      message = `${event.attackerName} attacks ${event.defenderName}!`;
      break;
    case "attack":
      message = event.message;
      break;
    case "flee_success":
      message = `${event.playerName} flees ${event.direction}!`;
      break;
    case "flee_fail":
      message = `${event.playerName} tries to flee but fails!`;
      break;
    case "player_death":
      message = `${event.playerName} has been slain by ${event.killerName}!`;
      break;
    case "monster_death":
      message = `${event.killerName} defeats the ${event.monsterName}! (+${event.xpAwarded} XP)`;
      break;
    case "level_up": {
      // Public announcement to the room
      const publicMessage: ChatMessageData = {
        id: crypto.randomUUID(),
        type: "system",
        content: `🎉 ${event.playerName} has reached level ${event.newLevel}!`,
        timestamp: new Date().toISOString(),
      };
      ioInstance.to(socketRoom).emit("chat:message", publicMessage);

      // Private message to the player about attribute points
      const playerSocket = playerSockets.get(event.playerId);
      if (playerSocket) {
        const privateMessage: ChatMessageData = {
          id: crypto.randomUUID(),
          type: "system",
          content: `You gained ${event.attributePoints} attribute points! Use "train" to spend them.`,
          timestamp: new Date().toISOString(),
        };
        playerSocket.emit("chat:message", privateMessage);
      }
      return; // Already handled, don't fall through to default broadcast
    }
    case "combat_end":
      message = event.reason;
      break;
    default:
      return; // Unknown event type, don't broadcast
  }

  const chatMessage: ChatMessageData = {
    id: crypto.randomUUID(),
    type: "system",
    content: message,
    timestamp: new Date().toISOString(),
  };

  // If excluding a player, use their socket to broadcast to others
  if (excludePlayerId) {
    const excludeSocket = playerSockets.get(excludePlayerId);
    if (excludeSocket) {
      excludeSocket.to(socketRoom).emit("chat:message", chatMessage);
      return;
    }
  }

  // No exclusion, broadcast to everyone
  ioInstance.to(socketRoom).emit("chat:message", chatMessage);
}

/**
 * Handle player death - move to respawn room and update client state
 * @param playerId - The player who died
 * @param deathRoomId - The room where death occurred
 * @param respawnRoomId - The room to respawn in
 */
async function handlePlayerDeathRespawn(
  playerId: string,
  deathRoomId: string,
  respawnRoomId: string,
): Promise<void> {
  const socket = playerSockets.get(playerId);
  if (!socket || !ioInstance || !socket.player) return;

  // Leave old socket room
  socket.leave(getSocketRoomName(deathRoomId));

  // Join new socket room
  socket.join(getSocketRoomName(respawnRoomId));

  // Get updated player data from database
  const updatedPlayer = db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!updatedPlayer) return;

  // Update socket's player reference
  socket.player = {
    ...socket.player,
    currentRoomId: respawnRoomId,
    currentHp: updatedPlayer.currentHp,
    xp: updatedPlayer.xp,
  };

  // Get respawn room data
  const respawnRoom = await RoomService.getRoomWithContents(respawnRoomId);
  if (!respawnRoom) return;

  // Send respawn message and new room data to the player
  const respawnMessage: ChatMessageData = {
    id: crypto.randomUUID(),
    type: "system",
    content: "You wake up at the town square, feeling weak but alive. (HP: 1)",
    timestamp: new Date().toISOString(),
  };
  socket.emit("chat:message", respawnMessage);

  // Send room data
  const enterData: RoomEnterData = {
    room: respawnRoom,
    player: socket.player,
  };
  socket.emit("room:enter", enterData);

  // Notify respawn room that player appeared
  socket.to(getSocketRoomName(respawnRoomId)).emit("system:message", {
    content: `${socket.player.name} appears in a flash of light.`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Update player's online status in the database
 * @param playerId - The player ID
 * @param isOnline - Whether the player is online
 */
async function updateOnlineStatus(
  playerId: string,
  isOnline: boolean,
): Promise<void> {
  await db.update(players).set({ isOnline }).where(eq(players.id, playerId));
}

/**
 * Handle player connection - set online, join room, broadcast entry
 * @param _io - Socket.io server instance (unused, kept for API consistency)
 * @param socket - The connected socket
 */
export async function handleConnection(
  _io: Server,
  socket: Socket,
): Promise<void> {
  const player = socket.player;
  if (!player || !player.currentRoomId) {
    socket.emit("error", { message: "Invalid player state" });
    socket.disconnect();
    return;
  }

  // Update online status
  await updateOnlineStatus(player.id, true);

  // Register socket for death respawn handling
  playerSockets.set(player.id, socket);

  // Join the player's private channel (for whispers)
  socket.join(getPlayerRoomName(player.id));

  // Join the game room's socket room
  const socketRoomName = getSocketRoomName(player.currentRoomId);
  socket.join(socketRoomName);

  // Check for re-hiding features when entering room
  const playersInRoom = await RoomService.getPlayersInRoom(
    player.currentRoomId,
  );
  // Subtract 1 because the entering player is already counted
  await FeatureService.checkRehideOnRoomEntry(
    player.currentRoomId,
    playersInRoom.length - 1,
  );

  // Get room data to send to the player
  const roomData = await RoomService.getRoomWithContents(player.currentRoomId);
  if (!roomData) {
    socket.emit("error", { message: "Room not found" });
    return;
  }

  // Send room data to the connecting player
  const enterData: RoomEnterData = {
    room: roomData,
    player: player,
  };
  socket.emit("room:enter", enterData);

  // Broadcast to others in the room that this player entered
  socket.to(socketRoomName).emit("system:message", {
    content: `${player.name} has entered.`,
    timestamp: new Date().toISOString(),
  });

  // Check for monster aggro
  await CombatService.checkMonsterAggro(player.id, player.currentRoomId);
}

/**
 * Handle player disconnection - set offline, handle combat death, notify room
 * @param _io - Socket.io server instance (unused, kept for API consistency)
 * @param socket - The disconnecting socket
 */
export async function handleDisconnect(
  _io: Server,
  socket: Socket,
): Promise<void> {
  const player = socket.player;
  if (!player) return;

  // Clear any pending aggro timers
  CombatService.clearPendingAggro(player.id);

  // Handle combat death on disconnect
  if (CombatService.isPlayerInCombat(player.id)) {
    await CombatService.handleDisconnect(player.id);
  }

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
export async function handleCommand(
  io: Server,
  socket: Socket,
  input: string,
): Promise<void> {
  const player = socket.player;
  if (!player || !player.currentRoomId) {
    socket.emit("error", { message: "Invalid player state" });
    return;
  }

  // Get current room
  const room = await RoomService.getRoomWithContents(player.currentRoomId);
  if (!room) {
    socket.emit("error", { message: "Room not found" });
    return;
  }

  // Parse the command
  const parsed = CommandParser.parse(input);

  // Execute the command
  const result = await CommandParser.execute(input, {
    player,
    room,
    socket,
  });

  // Send result message to the player
  if (result.message) {
    const messageData: ChatMessageData = {
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
      } else if (targetRoom.startsWith("player:")) {
        // Private message to specific player
        io.to(targetRoom).emit(broadcast.event, broadcast.data);
      } else if (targetRoom.startsWith("room:")) {
        // Already formatted as socket room
        io.to(targetRoom).emit(broadcast.event, broadcast.data);
      } else {
        // Game room ID - convert to socket room name
        io.to(getSocketRoomName(targetRoom)).emit(
          broadcast.event,
          broadcast.data,
        );
      }
    }
  }

  // Handle room changes (movement or flee)
  if (parsed.type === "movement" && result.success) {
    await handleRoomChange(io, socket, player);
  } else if (parsed.action === "flee" && result.success) {
    // Flee also causes room change
    await handleRoomChange(io, socket, player);
  }
}

/**
 * Handle room change after movement - update socket rooms
 * @param _io - Socket.io server instance (unused, kept for API consistency)
 * @param socket - The socket that moved
 * @param player - The player who moved
 */
async function handleRoomChange(
  _io: Server,
  socket: Socket,
  player: Player,
): Promise<void> {
  // Get updated player data from DB
  const updatedPlayer = await db
    .select()
    .from(players)
    .where(eq(players.id, player.id))
    .get();

  if (!updatedPlayer || !updatedPlayer.currentRoomId) return;

  const oldRoomId = player.currentRoomId;
  const newRoomId = updatedPlayer.currentRoomId;

  if (oldRoomId === newRoomId) return;

  // Notify others in old room that player left (before leaving socket room)
  if (oldRoomId) {
    // Clear any pending aggro timers from the old room
    CombatService.clearPendingAggro(player.id);

    socket.to(getSocketRoomName(oldRoomId)).emit("system:message", {
      content: `${player.name} has left.`,
      timestamp: new Date().toISOString(),
    });
    // Leave old socket room
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
  await FeatureService.checkRehideOnRoomEntry(
    newRoomId,
    playersInNewRoom.length - 1,
  );

  // Get new room data
  const newRoomData = await RoomService.getRoomWithContents(newRoomId);
  if (newRoomData) {
    // Send full room data to the moving player
    const enterData: RoomEnterData = {
      room: newRoomData,
      player: socket.player,
    };
    socket.emit("room:enter", enterData);

    // Notify others in new room
    socket.to(getSocketRoomName(newRoomId)).emit("system:message", {
      content: `${player.name} has arrived.`,
      timestamp: new Date().toISOString(),
    });

    // Check for monster aggro in new room
    await CombatService.checkMonsterAggro(player.id, newRoomId);
  }
}

/**
 * Broadcast a player update to relevant parties
 * @param io - Socket.io server instance
 * @param playerId - The player who was updated
 * @param changes - The changes to broadcast
 */
export function broadcastPlayerUpdate(
  io: Server,
  playerId: string,
  changes: Partial<Player>,
): void {
  const updateData: PlayerUpdateData = {
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
export function broadcastToRoom(
  io: Server,
  roomId: string,
  message: ChatMessageData,
): void {
  io.to(getSocketRoomName(roomId)).emit("chat:message", message);
}

/**
 * Broadcast a room leave event
 * @param io - Socket.io server instance
 * @param roomId - The game room ID
 * @param data - The leave data
 */
export function broadcastRoomLeave(
  io: Server,
  roomId: string,
  data: RoomLeaveData,
): void {
  io.to(getSocketRoomName(roomId)).emit("room:leave", data);
}

/**
 * Register all socket event handlers for a connection
 * @param io - Socket.io server instance
 * @param socket - The connected socket
 */
export function registerHandlers(io: Server, socket: Socket): void {
  // Store io instance for combat broadcasts
  if (!ioInstance) {
    ioInstance = io;
    CombatService.setBroadcaster(broadcastCombatEvent);
    CombatService.setDeathCallback(handlePlayerDeathRespawn);
  }

  // Handle connection setup
  handleConnection(io, socket);

  // Handle commands
  socket.on("command", (input: string) => {
    handleCommand(io, socket, input);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    handleDisconnect(io, socket);
  });
}
