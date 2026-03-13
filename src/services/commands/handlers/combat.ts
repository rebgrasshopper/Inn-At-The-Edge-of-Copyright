/**
 * Combat command handlers for attack and flee.
 */

import type { CommandContext, CommandResult } from "../../../types/command.js";
import * as CombatService from "../../CombatService.js";
import { resolveEntity } from "../../EntityResolver.js";

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

  // Use EntityResolver to find the target
  const result = await resolveEntity(room.id, targetName, ["monster"]);

  if (result.status === "not_found") {
    return {
      success: false,
      message: `You don't see "${targetName}" here.`,
    };
  }

  if (result.status === "wrong_type") {
    return {
      success: false,
      message: `You can't attack the ${result.name}.`,
    };
  }

  // Extract monster instance ID from the resolved entity
  const monsterRecord = result.entity as {
    monster_instances: { id: string };
  };
  const monsterInstanceId = monsterRecord.monster_instances.id;

  // Initiate combat
  const combatResult = await CombatService.initiateCombat(
    player.id,
    monsterInstanceId,
    room.id,
  );

  if (!combatResult.success) {
    return { success: false, message: combatResult.message };
  }

  // Combat service handles the broadcast to other players
  return {
    success: true,
    message: combatResult.message,
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
      data: { player, roomId: room.id, direction: result.destination },
      excludeSender: true,
    });
  }

  return {
    success: true,
    message: result.message,
    broadcast: broadcasts,
  };
}
