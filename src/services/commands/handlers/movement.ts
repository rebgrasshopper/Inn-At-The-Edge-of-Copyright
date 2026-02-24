/**
 * Movement command handler.
 */

import type { CommandContext, CommandResult } from "../../../types/command.js";
import type { Direction } from "../../../types/room.js";
import * as CombatService from "../../CombatService.js";
import * as RoomService from "../../RoomService.js";

/** Direction aliases */
const DIRECTION_MAP: Record<string, Direction> = {
  north: "north",
  n: "north",
  south: "south",
  s: "south",
  east: "east",
  e: "east",
  west: "west",
  w: "west",
  up: "up",
  u: "up",
  down: "down",
  d: "down",
};

/**
 * Handle movement command
 * @param args - Remaining tokens after command verb
 * @param context - Command context with player and room
 * @param rawInput - Original raw input string
 * @returns Command result
 */
export async function handleMove(
  args: string[],
  context: CommandContext,
  rawInput: string,
): Promise<CommandResult> {
  const { player, room } = context;

  // Check if player is in combat - must flee instead of walking away
  const combat = CombatService.getCombatForPlayer(player.id);
  if (combat) {
    // Find the monster(s) attacking the player
    const monsters = Array.from(combat.participants.values()).filter(
      (p) => p.type === "monster",
    );
    const monsterName = monsters[0]?.name || "something";
    return {
      success: false,
      message: `You should probably focus on the ${monsterName} attacking you! (Try "flee" to escape)`,
    };
  }

  // Check if the first token of raw input is a direction (e.g., "north" or "n")
  const firstToken = rawInput.trim().toLowerCase().split(/\s+/)[0];
  let direction: Direction | undefined;

  if (DIRECTION_MAP[firstToken]) {
    // Direct direction input like "north" or "n"
    direction = DIRECTION_MAP[firstToken];
  } else if (args.length > 0 && DIRECTION_MAP[args[0]]) {
    // "go north" or "move north"
    direction = DIRECTION_MAP[args[0]];
  }

  if (!direction) {
    return { success: false, message: "Which direction do you want to go?" };
  }

  const result = await RoomService.movePlayer(player.id, direction);

  if (!result.success) {
    return { success: false, message: result.error };
  }

  // Build broadcasts for room enter/leave
  const broadcasts = [];

  // Notify old room that player left
  broadcasts.push({
    event: "room:leave",
    room: room.id,
    data: { playerName: player.name, roomId: room.id },
  });

  // Notify new room that player entered
  if (result.room) {
    broadcasts.push({
      event: "room:enter",
      room: result.room.id,
      data: { room: result.room, player },
    });
  }

  return {
    success: true,
    message: result.room ? `You move ${direction}.` : undefined,
    broadcast: broadcasts,
  };
}
