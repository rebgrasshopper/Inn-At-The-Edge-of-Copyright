import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import {
  items,
  monsterInstances,
  monsters,
  playerInventory,
  players,
  rooms,
} from "../db/schema.js";
import type { EffectResult, PlayerEffect } from "../types/feature.js";
import type { PlayerStats } from "../types/player.js";

/** Time in milliseconds for hidden features to re-hide (2 hours) */
export const REHIDE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/**
 * Apply damage to a player, reducing their currentHp
 * @param playerId - The player to damage
 * @param amount - Amount of damage to apply
 * @param damageType - Optional damage type (e.g., "fire", "poison")
 * @returns EffectResult with success status and message
 */
export async function applyDamage(
  playerId: string,
  amount: number,
  damageType?: string,
): Promise<EffectResult> {
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) {
    return { type: "damage", success: false, message: "Player not found." };
  }

  const newHp = Math.max(0, player.currentHp - amount);
  await db
    .update(players)
    .set({ currentHp: newHp })
    .where(eq(players.id, playerId));

  const typeStr = damageType ? ` ${damageType}` : "";
  const message =
    newHp === 0
      ? `You take ${amount}${typeStr} damage and fall unconscious!`
      : `You take ${amount}${typeStr} damage. (HP: ${newHp}/${player.maxHp})`;

  return {
    type: "damage",
    success: true,
    message,
    playerUpdate: { currentHp: newHp },
  };
}

/**
 * Heal a player, increasing their currentHp up to maxHp
 * @param playerId - The player to heal
 * @param amount - Amount of healing to apply
 * @returns EffectResult with success status and message
 */
export async function applyHeal(
  playerId: string,
  amount: number,
): Promise<EffectResult> {
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) {
    return { type: "heal", success: false, message: "Player not found." };
  }

  const newHp = Math.min(player.maxHp, player.currentHp + amount);
  const actualHeal = newHp - player.currentHp;

  if (actualHeal === 0) {
    return {
      type: "heal",
      success: true,
      message: "You are already at full health.",
    };
  }

  await db
    .update(players)
    .set({ currentHp: newHp })
    .where(eq(players.id, playerId));

  const message = `You are healed for ${actualHeal} HP. (HP: ${newHp}/${player.maxHp})`;

  return {
    type: "heal",
    success: true,
    message,
    playerUpdate: { currentHp: newHp },
  };
}

/**
 * Award XP to a player
 * @param playerId - The player to award XP to
 * @param amount - Amount of XP to award
 * @returns EffectResult with success status and message
 */
export async function awardXp(
  playerId: string,
  amount: number,
): Promise<EffectResult> {
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) {
    return { type: "xp", success: false, message: "Player not found." };
  }

  const newXp = player.xp + amount;
  await db.update(players).set({ xp: newXp }).where(eq(players.id, playerId));

  // TODO: Check for level up based on XP thresholds
  const message = `You gain ${amount} XP! (Total: ${newXp})`;

  return {
    type: "xp",
    success: true,
    message,
    playerUpdate: { xp: newXp },
  };
}

/**
 * Modify a player's stat permanently
 * @param playerId - The player to modify
 * @param stat - The stat to modify (str, dex, con, int, wis, cha)
 * @param amount - Amount to add (can be negative)
 * @returns EffectResult with success status and message
 */
export async function modifyStat(
  playerId: string,
  stat: keyof PlayerStats,
  amount: number,
): Promise<EffectResult> {
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) {
    return {
      type: "stat_modify",
      success: false,
      message: "Player not found.",
    };
  }

  // Get current value - stat is guaranteed to be one of the valid keys
  const currentValue = player[stat];
  const newValue = Math.max(1, currentValue + amount); // Stats can't go below 1

  // Build update object
  await db
    .update(players)
    .set({ [stat]: newValue })
    .where(eq(players.id, playerId));

  const statName = stat.toUpperCase();
  const message = `Your ${statName} ${amount > 0 ? "increases" : "decreases"} by ${Math.abs(amount)}! (${statName}: ${newValue})`;

  return {
    type: "stat_modify",
    success: true,
    message,
  };
}

/**
 * Give an item to a player
 * @param playerId - The player to give the item to
 * @param itemId - The ID of the item to give
 * @param quantity - How many to give (default 1)
 * @returns EffectResult with success status and message
 */
export async function giveItem(
  playerId: string,
  itemId: string,
  quantity: number = 1,
): Promise<EffectResult> {
  // Verify the item exists
  const item = await db.select().from(items).where(eq(items.id, itemId)).get();

  if (!item) {
    return { type: "give_item", success: false, message: "Item not found." };
  }

  // Check if player already has this item
  const existingInventory = await db
    .select()
    .from(playerInventory)
    .where(
      and(
        eq(playerInventory.playerId, playerId),
        eq(playerInventory.itemId, itemId),
      ),
    )
    .get();

  if (existingInventory) {
    await db
      .update(playerInventory)
      .set({ quantity: existingInventory.quantity + quantity })
      .where(eq(playerInventory.id, existingInventory.id));
  } else {
    await db.insert(playerInventory).values({
      id: uuidv4(),
      playerId,
      itemId,
      quantity,
    });
  }

  const itemName =
    quantity === 1 ? item.name : item.pluralName || `${item.name}s`;
  const message =
    quantity === 1
      ? `You receive ${itemName}.`
      : `You receive ${quantity} ${itemName}.`;

  return {
    type: "give_item",
    success: true,
    message,
  };
}

/**
 * Teleport a player to a different room
 * @param playerId - The player to teleport
 * @param roomId - The destination room ID
 * @returns EffectResult with success status and message
 */
export async function teleport(
  playerId: string,
  roomId: string,
): Promise<EffectResult> {
  // Verify the room exists
  const room = await db.select().from(rooms).where(eq(rooms.id, roomId)).get();

  if (!room) {
    return {
      type: "teleport",
      success: false,
      message: "Destination not found.",
    };
  }

  await db
    .update(players)
    .set({ currentRoomId: roomId })
    .where(eq(players.id, playerId));

  const message = `You are teleported to ${room.name}!`;

  return {
    type: "teleport",
    success: true,
    message,
    playerUpdate: { currentRoomId: roomId },
  };
}

/**
 * Apply a status effect to a player (stub for now)
 * @param _playerId - The player to apply the status to (unused until status system implemented)
 * @param status - The status name
 * @param duration - Optional duration in seconds
 * @returns EffectResult with success status and message
 */
export async function applyStatus(
  _playerId: string,
  status: string,
  duration?: number,
): Promise<EffectResult> {
  // TODO: Implement status effects system with statuses table
  const durationStr = duration ? ` for ${duration} seconds` : "";
  const message = `You are now ${status}${durationStr}. (Status effects not yet fully implemented)`;

  return {
    type: "status",
    success: true,
    message,
  };
}

/**
 * Unblock an exit in the player's current room
 * @param playerId - The player (used to get current room)
 * @param direction - The direction to unblock
 * @returns EffectResult with success status and message
 */
export async function unblockExit(
  playerId: string,
  direction: string,
): Promise<EffectResult> {
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player || !player.currentRoomId) {
    return {
      type: "unblock_exit",
      success: false,
      message: "Player not found.",
    };
  }

  const room = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, player.currentRoomId))
    .get();

  if (!room || !room.exits) {
    return { type: "unblock_exit", success: false, message: "Room not found." };
  }

  type ExitData = { roomId: string; blocked?: boolean; blockMessage?: string };
  const exits = room.exits as Record<string, ExitData>;
  const exit = exits[direction];

  if (!exit) {
    return {
      type: "unblock_exit",
      success: false,
      message: `No exit to the ${direction}.`,
    };
  }

  if (!exit.blocked) {
    return {
      type: "unblock_exit",
      success: true,
      message: `The ${direction} exit is already open.`,
    };
  }

  // Unblock the exit
  exit.blocked = false;
  delete exit.blockMessage;

  await db
    .update(rooms)
    .set({ exits })
    .where(eq(rooms.id, player.currentRoomId));

  const message = `The way ${direction} is now open!`;

  return {
    type: "unblock_exit",
    success: true,
    message,
  };
}

/**
 * Spawn a monster in a room
 * @param playerId - The player triggering the spawn (used to get current room if roomId not specified)
 * @param monsterId - The monster type ID to spawn
 * @param roomId - Optional room ID (defaults to player's current room)
 * @returns EffectResult with success status and message
 */
export async function spawnMonster(
  playerId: string,
  monsterId: string,
  roomId?: string,
): Promise<EffectResult> {
  // Get target room
  let targetRoomId = roomId;
  if (!targetRoomId) {
    const player = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .get();
    targetRoomId = player?.currentRoomId ?? undefined;
  }

  if (!targetRoomId) {
    return {
      type: "spawn_monster",
      success: false,
      message: "No room to spawn monster in.",
    };
  }

  // Get monster template
  const monster = await db
    .select()
    .from(monsters)
    .where(eq(monsters.id, monsterId))
    .get();

  if (!monster) {
    return {
      type: "spawn_monster",
      success: false,
      message: "Monster type not found.",
    };
  }

  // Create monster instance (non-permanent by default)
  await db.insert(monsterInstances).values({
    id: uuidv4(),
    monsterId,
    roomId: targetRoomId,
    currentHp: monster.maxHp,
    spawnedAt: new Date(),
    permanent: false,
  });

  return {
    type: "spawn_monster",
    success: true,
    message: `A ${monster.name} appears!`,
  };
}

/**
 * Apply an array of effects to a player
 * @param playerId - The player to apply effects to
 * @param effects - Array of effects to apply
 * @returns Array of EffectResults
 */
export async function apply(
  playerId: string,
  effects: PlayerEffect[],
): Promise<EffectResult[]> {
  const results: EffectResult[] = [];

  for (const effect of effects) {
    let result: EffectResult;

    switch (effect.type) {
      case "damage":
        result = await applyDamage(playerId, effect.amount, effect.damageType);
        break;
      case "heal":
        result = await applyHeal(playerId, effect.amount);
        break;
      case "xp":
        result = await awardXp(playerId, effect.amount);
        break;
      case "stat_modify":
        result = await modifyStat(playerId, effect.stat, effect.amount);
        break;
      case "give_item":
        result = await giveItem(playerId, effect.itemId, effect.quantity);
        break;
      case "teleport":
        result = await teleport(playerId, effect.roomId);
        break;
      case "status":
        result = await applyStatus(playerId, effect.status, effect.duration);
        break;
      case "unblock_exit":
        result = await unblockExit(playerId, effect.direction);
        break;
      case "spawn_monster":
        result = await spawnMonster(playerId, effect.monsterId, effect.roomId);
        break;
      default:
        result = {
          type: "unknown",
          success: false,
          message: `Unknown effect type: ${(effect as PlayerEffect).type}`,
        };
    }

    results.push(result);
  }

  return results;
}
