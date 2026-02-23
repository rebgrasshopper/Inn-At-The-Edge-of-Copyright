/**
 * Chat command handlers.
 */

import type { CommandContext, CommandResult } from "../../../types/command.js";
import * as ChatService from "../../ChatService.js";
import * as RoomService from "../../RoomService.js";

/**
 * Handle say/speak command
 */
export async function handleSay(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player } = context;
  const message = args.join(" ");

  if (!message) {
    return { success: false, message: "What do you want to say?" };
  }

  const result = await ChatService.speak(player.id, message);
  if (!result.success) {
    return { success: false, message: result.error };
  }

  const broadcasts = [];
  if (result.message && result.scope?.type === "room") {
    broadcasts.push({
      event: "chat:message",
      room: result.scope.roomId,
      data: result.message,
    });
  }

  return { success: true, broadcast: broadcasts };
}

/**
 * Handle shout/yell command
 */
export async function handleShout(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player } = context;
  const message = args.join(" ");

  if (!message) {
    return { success: false, message: "What do you want to shout?" };
  }

  const result = await ChatService.shout(player.id, message);
  if (!result.success) {
    return { success: false, message: result.error };
  }

  const broadcasts = [];
  if (result.message && result.scope?.type === "region") {
    // Get all rooms in the region for broadcasting
    const regionRooms = await RoomService.getRoomsByRegion(result.scope.region);
    for (const regionRoom of regionRooms) {
      broadcasts.push({
        event: "chat:message",
        room: regionRoom.id,
        data: result.message,
      });
    }
  }

  return { success: true, broadcast: broadcasts };
}

/**
 * Handle whisper/tell command
 */
export async function handleWhisper(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player, room } = context;

  if (args.length === 0) {
    return { success: false, message: "Who do you want to whisper to?" };
  }

  const targetName = args[0];
  const message = args.slice(1).join(" ");

  if (!message) {
    return { success: false, message: "What do you want to whisper?" };
  }

  const result = await ChatService.whisper(player.id, targetName, message);
  if (!result.success) {
    return { success: false, message: result.error };
  }

  const broadcasts = [];
  // Send whisper to target
  if (result.message && result.scope?.type === "player") {
    broadcasts.push({
      event: "chat:message",
      room: `player:${result.scope.playerId}`,
      data: result.message,
    });
    // Also send to sender so they see their own whisper
    broadcasts.push({
      event: "chat:message",
      room: `player:${player.id}`,
      data: result.message,
    });
  }
  // Send room notice if present (e.g., "X is whispering to themself")
  if (result.roomNotice) {
    broadcasts.push({
      event: "chat:message",
      room: room.id,
      data: result.roomNotice,
    });
  }

  return { success: true, broadcast: broadcasts };
}

/**
 * Handle emote/me command
 */
export async function handleEmote(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player } = context;
  const action = args.join(" ");

  if (!action) {
    return { success: false, message: "What do you want to do?" };
  }

  const result = await ChatService.emote(player.id, action);
  if (!result.success) {
    return { success: false, message: result.error };
  }

  const broadcasts = [];
  if (result.message && result.scope?.type === "room") {
    broadcasts.push({
      event: "chat:message",
      room: result.scope.roomId,
      data: result.message,
    });
  }

  return { success: true, broadcast: broadcasts };
}
