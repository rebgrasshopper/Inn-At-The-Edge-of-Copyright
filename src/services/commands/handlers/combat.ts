/**
 * Combat command handlers for attack and flee.
 */

import type { CommandContext, CommandResult } from "../../../types/command.js";
import * as CombatService from "../../CombatService.js";

/**
 * Find a monster in the room by name (partial match)
 * @param room - The room context
 * @param targetName - The target name to search for
 * @returns The monster instance ID if found, null otherwise
 */
function findMonsterByName(
  room: CommandContext["room"],
  targetName: string,
): string | null {
  const lowerTarget = targetName.toLowerCase();

  for (const monster of room.monsters) {
    const monsterName = monster.monster.name.toLowerCase();
    if (
      monsterName === lowerTarget ||
      monsterName.includes(lowerTarget) ||
      lowerTarget.includes(monsterName)
    ) {
      return monster.id;
    }
  }

  return null;
}

/**
 * Handle attack command
 * @param args - Remaining tokens after command verb (target name)
 * @param context - Command context with player and room
 * @param _rawInput - Original raw input string (unused)
 * @returns Command result
 */
export async function handleAttack(
  args: string[],
  context: CommandContext,
  _rawInput: string,
): Promise<CommandResult> {
  const { player, room } = context;

  if (args.length === 0) {
    return { success: false, message: "Attack what?" };
  }

  const targetName = args.join(" ");

  // Check if already in combat
  if (CombatService.isPlayerInCombat(player.id)) {
    return {
      success: false,
      message: "You're already in combat!",
    };
  }

  // Find the monster in the room
  const monsterInstanceId = findMonsterByName(room, targetName);

  if (!monsterInstanceId) {
    return {
      success: false,
      message: `You don't see "${targetName}" here.`,
    };
  }

  // Initiate combat
  const result = await CombatService.initiateCombat(
    player.id,
    monsterInstanceId,
    room.id,
  );

  if (!result.success) {
    return { success: false, message: result.message };
  }

  return {
    success: true,
    message: result.message,
    broadcast: [
      {
        event: "combat:start",
        room: room.id,
        data: {
          attackerId: player.id,
          attackerName: player.name,
          targetId: monsterInstanceId,
        },
      },
    ],
  };
}

/**
 * Handle flee command
 * @param _args - Remaining tokens (unused for flee)
 * @param context - Command context with player and room
 * @param _rawInput - Original raw input string (unused)
 * @returns Command result
 */
export async function handleFlee(
  _args: string[],
  context: CommandContext,
  _rawInput: string,
): Promise<CommandResult> {
  const { player, room } = context;

  // Check if in combat
  if (!CombatService.isPlayerInCombat(player.id)) {
    return {
      success: false,
      message: "You're not in combat.",
    };
  }

  // Attempt to flee
  const result = await CombatService.attemptFlee(player.id);

  if (!result.success) {
    return { success: false, message: result.message };
  }

  // Build broadcasts
  const broadcasts = [];

  // Notify old room that player fled
  broadcasts.push({
    event: "combat:flee",
    room: room.id,
    data: { playerName: player.name, direction: result.destination },
  });

  // If successful, player moved to new room
  if (result.destination) {
    broadcasts.push({
      event: "room:leave",
      room: room.id,
      data: { playerName: player.name, roomId: room.id },
    });
  }

  return {
    success: true,
    message: result.message,
    broadcast: broadcasts,
  };
}
