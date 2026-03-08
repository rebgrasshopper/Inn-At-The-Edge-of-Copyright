import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { players } from "../db/schema.js";
import type { ChatMessageData } from "../types/socket.js";
import * as RoomService from "./RoomService.js";

export type ChatScope =
  | { type: "room"; roomId: string }
  | { type: "region"; region: string }
  | { type: "player"; playerId: string };

export type ChatResult = {
  success: boolean;
  message?: ChatMessageData;
  scope?: ChatScope;
  roomNotice?: ChatMessageData; // Optional notice to broadcast to room (e.g., "X is whispering to themself")
  error?: string;
};

/**
 * Get player info needed for chat (name, room, region)
 */
async function getPlayerChatInfo(playerId: string) {
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player || !player.currentRoomId) {
    return null;
  }

  const room = await RoomService.getRoom(player.currentRoomId);
  if (!room) {
    return null;
  }

  return {
    id: player.id,
    name: player.name,
    roomId: player.currentRoomId,
    region: room.region,
  };
}

/**
 * Find a player by name in the same room
 * @param name - The name or prefix to search for
 * @param roomId - The room to search in
 * @param excludePlayerId - Optional player ID to exclude from results (e.g., the sender)
 */
async function findPlayerInRoom(
  name: string,
  roomId: string,
  excludePlayerId?: string,
): Promise<{ id: string; name: string } | null> {
  const roomPlayers = await RoomService.getPlayersInRoom(roomId);
  const nameLower = name.toLowerCase();

  // Filter out excluded player for prefix matching
  const candidates = excludePlayerId
    ? roomPlayers.filter((p) => p.id !== excludePlayerId)
    : roomPlayers;

  // Try exact match first, then prefix match
  const exactMatch = candidates.find((p) => p.name.toLowerCase() === nameLower);
  if (exactMatch) {
    return { id: exactMatch.id, name: exactMatch.name };
  }

  const prefixMatch = candidates.find((p) =>
    p.name.toLowerCase().startsWith(nameLower),
  );
  if (prefixMatch) {
    return { id: prefixMatch.id, name: prefixMatch.name };
  }

  return null;
}

/**
 * Broadcast a message to all players in the same room
 * @param playerId - The speaking player's ID
 * @param message - The message content
 * @returns ChatResult with message data and room scope
 */
export async function speak(
  playerId: string,
  message: string,
): Promise<ChatResult> {
  const playerInfo = await getPlayerChatInfo(playerId);
  if (!playerInfo) {
    return { success: false, error: "Player not found or not in a room" };
  }

  if (!message.trim()) {
    return { success: false, error: "Message cannot be empty" };
  }

  const chatMessage: ChatMessageData = {
    id: uuidv4(),
    type: "speech",
    content: message.trim(),
    sender: playerInfo.name,
    timestamp: new Date().toISOString(),
  };

  return {
    success: true,
    message: chatMessage,
    scope: { type: "room", roomId: playerInfo.roomId },
  };
}

/**
 * Broadcast a message to all players in the same region
 * @param playerId - The shouting player's ID
 * @param message - The message content
 * @returns ChatResult with message data and region scope
 */
export async function shout(
  playerId: string,
  message: string,
): Promise<ChatResult> {
  const playerInfo = await getPlayerChatInfo(playerId);
  if (!playerInfo) {
    return { success: false, error: "Player not found or not in a room" };
  }

  if (!message.trim()) {
    return { success: false, error: "Message cannot be empty" };
  }

  const chatMessage: ChatMessageData = {
    id: uuidv4(),
    type: "speech",
    content: message.trim().toUpperCase(), // Shouting is loud!
    sender: playerInfo.name,
    timestamp: new Date().toISOString(),
  };

  return {
    success: true,
    message: chatMessage,
    scope: { type: "region", region: playerInfo.region },
  };
}

/**
 * Send a private message to another player in the same room
 * @param playerId - The whispering player's ID
 * @param targetName - The target player's name (or prefix)
 * @param message - The message content
 * @returns ChatResult with message data and player scope
 */
export async function whisper(
  playerId: string,
  targetName: string,
  message: string,
): Promise<ChatResult> {
  const playerInfo = await getPlayerChatInfo(playerId);
  if (!playerInfo) {
    return { success: false, error: "Player not found or not in a room" };
  }

  if (!message.trim()) {
    return { success: false, error: "Message cannot be empty" };
  }

  if (!targetName.trim()) {
    return { success: false, error: "Who do you want to whisper to?" };
  }

  // Check if trying to whisper to self - allow it but notify the room
  if (targetName.toLowerCase() === playerInfo.name.toLowerCase()) {
    const selfWhisperMessage: ChatMessageData = {
      id: uuidv4(),
      type: "whisper",
      content: message.trim(),
      sender: playerInfo.name,
      timestamp: new Date().toISOString(),
    };

    const roomNotice: ChatMessageData = {
      id: uuidv4(),
      type: "emote",
      content: "is whispering to themself.",
      sender: playerInfo.name,
      timestamp: new Date().toISOString(),
    };

    return {
      success: true,
      message: selfWhisperMessage,
      scope: { type: "player", playerId: playerId }, // Send to self
      roomNotice, // Notify the room
    };
  }

  // Find target player in the same room (exclude self from prefix matching)
  const target = await findPlayerInRoom(
    targetName,
    playerInfo.roomId,
    playerId,
  );
  if (!target) {
    return {
      success: false,
      error: `There's no one named "${targetName}" here.`,
    };
  }

  const chatMessage: ChatMessageData = {
    id: uuidv4(),
    type: "whisper",
    content: message.trim(),
    sender: playerInfo.name,
    timestamp: new Date().toISOString(),
  };

  return {
    success: true,
    message: chatMessage,
    scope: { type: "player", playerId: target.id },
  };
}

/**
 * Broadcast an emote/action to all players in the same room
 * @param playerId - The emoting player's ID
 * @param action - The action description (e.g., "waves hello")
 * @returns ChatResult with message data and room scope
 */
export async function emote(
  playerId: string,
  action: string,
): Promise<ChatResult> {
  const playerInfo = await getPlayerChatInfo(playerId);
  if (!playerInfo) {
    return { success: false, error: "Player not found or not in a room" };
  }

  if (!action.trim()) {
    return { success: false, error: "What do you want to do?" };
  }

  // Format: "PlayerName waves hello."
  const chatMessage: ChatMessageData = {
    id: uuidv4(),
    type: "emote",
    content: action.trim(),
    sender: playerInfo.name,
    timestamp: new Date().toISOString(),
  };

  return {
    success: true,
    message: chatMessage,
    scope: { type: "room", roomId: playerInfo.roomId },
  };
}
