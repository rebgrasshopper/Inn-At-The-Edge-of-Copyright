/**
 * Admin command handlers.
 * Commands restricted to users with isAdmin flag.
 */

import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../../../db/index.js";
import {
  items,
  monsterInstances,
  monsters,
  playerInventory,
  users,
} from "../../../db/schema.js";
import type { CommandContext, CommandResult } from "../../../types/command.js";
import { fuzzyMatch } from "../../../utils/fuzzyMatch.js";
import * as ChatService from "../../ChatService.js";
import * as CombatService from "../../CombatService.js";
import * as RoomService from "../../RoomService.js";

/**
 * Check if a user is an admin by their userId.
 * @param userId - The user ID to check
 * @returns True if the user is an admin
 */
async function isAdmin(userId: string): Promise<boolean> {
  const user = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return user?.isAdmin ?? false;
}

/**
 * Handle the announce command - broadcasts a message to all players in the region.
 * Admin only. This is the region-wide broadcast that shout used to do.
 * @param args - Command arguments (message)
 * @param context - Command context with player and room info
 * @returns CommandResult with success/failure message and broadcasts
 */
export async function handleAnnounce(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  // Check admin permission
  const admin = await isAdmin(context.player.userId);
  if (!admin) {
    return {
      success: false,
      message: "You don't have permission to use this command.",
    };
  }

  const message = args.join(" ").trim();
  if (!message) {
    return { success: false, message: "What do you want to announce?" };
  }

  const result = await ChatService.announce(context.player.id, message);
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
 * Handle the spawn command - spawns a monster by name in the current room.
 * Admin only.
 * @param args - Command arguments (monster name)
 * @param context - Command context with player and room info
 * @returns CommandResult with success/failure message
 */
export async function handleSpawn(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  // Check admin permission
  const admin = await isAdmin(context.player.userId);
  if (!admin) {
    return {
      success: false,
      message: "You don't have permission to use this command.",
    };
  }

  // Parse monster name from args
  const monsterName = args.join(" ").trim();
  if (!monsterName) {
    // List available monsters
    const allMonsters = await db.select({ name: monsters.name }).from(monsters);
    const names = allMonsters.map((m) => m.name).join(", ");
    return {
      success: false,
      message: `Usage: spawn <monster name>\nAvailable monsters: ${names}`,
    };
  }

  // Find monster by name using fuzzy matching
  const allMonsters = await db.select().from(monsters);
  let matchedMonster = null;

  for (const monster of allMonsters) {
    const result = fuzzyMatch(monsterName, monster.name);
    if (result.matches) {
      matchedMonster = monster;
      break;
    }
  }

  if (!matchedMonster) {
    const names = allMonsters.map((m) => m.name).join(", ");
    return {
      success: false,
      message: `Unknown monster "${monsterName}".\nAvailable monsters: ${names}`,
    };
  }

  // Spawn the monster in the current room
  const roomId = context.room.id;
  await db.insert(monsterInstances).values({
    id: uuidv4(),
    monsterId: matchedMonster.id,
    roomId,
    currentHp: matchedMonster.maxHp,
    spawnedAt: new Date(),
  });

  // Check for monster aggro against the spawning player
  await CombatService.checkMonsterAggro(context.player.id, roomId);

  return {
    success: true,
    message: `A ${matchedMonster.name} appears!`,
  };
}

/**
 * Handle the make command - creates an item and adds it to the admin's inventory.
 * Admin only.
 * @param args - Command arguments (item name)
 * @param context - Command context with player and room info
 * @returns CommandResult with success/failure message
 */
export async function handleMake(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  // Check admin permission
  const admin = await isAdmin(context.player.userId);
  if (!admin) {
    return {
      success: false,
      message: "You don't have permission to use this command.",
    };
  }

  // Parse item name from args
  const itemName = args.join(" ").trim();
  if (!itemName) {
    return {
      success: false,
      message: "Usage: make <item name>",
    };
  }

  // Find item by name using fuzzy matching
  const allItems = await db.select().from(items);
  let matchedItem = null;

  for (const item of allItems) {
    const result = fuzzyMatch(itemName, item.name, item.pluralName);
    if (result.matches) {
      matchedItem = item;
      break;
    }
  }

  if (!matchedItem) {
    return {
      success: false,
      message: `Unknown item "${itemName}".`,
    };
  }

  // Add item to player's inventory
  await db.insert(playerInventory).values({
    id: uuidv4(),
    playerId: context.player.id,
    itemId: matchedItem.id,
    quantity: 1,
  });

  return {
    success: true,
    message: `You conjure a ${matchedItem.name} into your inventory.`,
  };
}
