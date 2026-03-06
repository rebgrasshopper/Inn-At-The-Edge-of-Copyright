/**
 * Swimming command handler.
 * Handles starting and stopping swimming in water areas.
 */

import type { CommandContext, CommandResult } from "../../../types/command.js";
import * as CombatService from "../../CombatService.js";
import * as SwimmingService from "../../SwimmingService.js";

/**
 * Handle swim command (start/stop swimming)
 * @param args - Remaining tokens after command verb
 * @param context - Command context with player and room
 * @param rawInput - Original raw input string
 * @returns Command result
 */
export async function handleSwim(
  _args: string[],
  context: CommandContext,
  rawInput: string,
): Promise<CommandResult> {
  const { player, room } = context;
  const firstWord = rawInput.trim().toLowerCase().split(/\s+/)[0];

  // Check for "stop" or "stop swimming"
  if (firstWord === "stop") {
    if (!SwimmingService.isPlayerSwimming(player.id)) {
      return {
        success: false,
        message: "You're not swimming.",
      };
    }

    const result = SwimmingService.stopSwimming(player.id);
    return {
      success: result.success,
      message: result.message,
    };
  }

  // Starting to swim
  // Check if already swimming
  if (SwimmingService.isPlayerSwimming(player.id)) {
    return {
      success: false,
      message: "You're already swimming!",
    };
  }

  // Check if in combat
  if (CombatService.isPlayerInCombat(player.id)) {
    return {
      success: false,
      message: "You can't swim while in combat!",
    };
  }

  // Check if room allows swimming
  if (!SwimmingService.isSwimmableRoom(room.id)) {
    return {
      success: false,
      message: "There's nowhere to swim here.",
    };
  }

  const result = await SwimmingService.startSwimming(
    player.id,
    player.name,
    room.id,
  );

  return {
    success: result.success,
    message: result.message,
  };
}
