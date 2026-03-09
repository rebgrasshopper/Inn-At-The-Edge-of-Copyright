import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  corpses,
  items,
  monsterInstances,
  monsters,
  npcs,
  players,
  roomInventory,
  rooms,
} from "../db/schema.js";
import type { Container } from "../types/container.js";
import type { Feature } from "../types/feature.js";
import type { ItemStack } from "../types/item.js";
import type { MonsterInstance } from "../types/monster.js";
import type { NPC } from "../types/npc.js";
import type { Player } from "../types/player.js";
import type {
  Direction,
  Exit,
  Room,
  RoomCorpse,
  RoomWithContents,
} from "../types/room.js";
import { toPlayer } from "./CharacterService.utils.js";

export type MoveResult = {
  success: boolean;
  room?: RoomWithContents;
  error?: string;
};

/**
 * Get a room by ID (basic room data only)
 * @param roomId - The room's unique identifier
 * @returns The room or null if not found
 */
export async function getRoom(roomId: string): Promise<Room | null> {
  const record = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .get();

  if (!record) return null;

  return {
    id: record.id,
    name: record.name,
    description: record.description,
    navDescription: record.navDescription || undefined,
    region: record.region,
    exits: (record.exits as Partial<Record<Direction, Exit>>) || {},
  };
}

/**
 * Get all online players in a room
 * @param roomId - The room's unique identifier
 * @returns Array of online players in the room
 */
export async function getPlayersInRoom(roomId: string): Promise<Player[]> {
  const records = await db
    .select()
    .from(players)
    .where(eq(players.currentRoomId, roomId));

  return records.filter((r) => r.isOnline).map(toPlayer);
}

/**
 * Get all rooms in a region (for region-wide broadcasts like shouting)
 * @param region - The region name
 * @returns Array of rooms in the region
 */
export async function getRoomsByRegion(region: string): Promise<Room[]> {
  const records = await db.select().from(rooms).where(eq(rooms.region, region));

  return records.map((record) => ({
    id: record.id,
    name: record.name,
    description: record.description,
    region: record.region,
    exits: (record.exits as Partial<Record<Direction, Exit>>) || {},
  }));
}

/**
 * Get a room with all its contents (players, items, monsters, NPCs, containers, features)
 * @param roomId - The room's unique identifier
 * @param playerId - Optional player ID to include their personal discoveries
 * @returns The room with all contents or null if room not found
 */
export async function getRoomWithContents(
  roomId: string,
  playerId?: string,
): Promise<RoomWithContents | null> {
  const room = await getRoom(roomId);
  if (!room) return null;

  // Import FeatureService functions for personal discovery support
  const { getFeaturesInRoom, getContainersInRoom } =
    await import("./FeatureService.js");

  // Fetch all contents in parallel
  const [
    roomPlayers,
    roomItemRecords,
    roomMonsterRecords,
    roomNpcs,
    roomContainersFiltered,
    roomFeaturesFiltered,
    roomCorpses,
  ] = await Promise.all([
    getPlayersInRoom(roomId),
    db
      .select()
      .from(roomInventory)
      .innerJoin(items, eq(roomInventory.itemId, items.id))
      .where(eq(roomInventory.roomId, roomId)),
    db
      .select()
      .from(monsterInstances)
      .innerJoin(monsters, eq(monsterInstances.monsterId, monsters.id))
      .where(eq(monsterInstances.roomId, roomId)),
    db.select().from(npcs).where(eq(npcs.roomId, roomId)),
    getContainersInRoom(roomId, playerId),
    getFeaturesInRoom(roomId, playerId),
    db
      .select()
      .from(corpses)
      .innerJoin(players, eq(corpses.playerId, players.id))
      .where(eq(corpses.roomId, roomId)),
  ]);

  // Transform items to ItemStack format
  const roomItems: ItemStack[] = roomItemRecords.map((record) => ({
    item: {
      id: record.items.id,
      name: record.items.name,
      pluralName: record.items.pluralName || undefined,
      description: record.items.description,
      category: record.items.category || undefined,
      isBulk: record.items.isBulk || undefined,
      size: record.items.size,
      attackBonus: record.items.attackBonus || undefined,
      damageBonus: record.items.damageBonus || undefined,
      acBonus: record.items.acBonus || undefined,
      effects: {
        str: record.items.strEffect || undefined,
        dex: record.items.dexEffect || undefined,
        con: record.items.conEffect || undefined,
        int: record.items.intEffect || undefined,
        wis: record.items.wisEffect || undefined,
        cha: record.items.chaEffect || undefined,
        hp: record.items.hpEffect || undefined,
      },
    },
    quantity: record.room_inventory.quantity,
  }));

  // Transform monster instances
  const roomMonsters: MonsterInstance[] = roomMonsterRecords.map((record) => ({
    id: record.monster_instances.id,
    monster: {
      id: record.monsters.id,
      name: record.monsters.name,
      description: record.monsters.description,
      stats: {
        str: record.monsters.str,
        dex: record.monsters.dex,
        con: record.monsters.con,
        int: record.monsters.int,
        wis: record.monsters.wis,
        cha: record.monsters.cha,
      },
      maxHp: record.monsters.maxHp,
      xpReward: record.monsters.xpReward,
      aggroScore: record.monsters.aggroScore,
      weaponDamage: record.monsters.weaponDamage || "1d4",
      level: record.monsters.level,
    },
    roomId: record.monster_instances.roomId,
    currentHp: record.monster_instances.currentHp,
  }));

  // Transform NPCs
  const transformedNpcs: NPC[] = roomNpcs.map((record) => ({
    id: record.id,
    name: record.name,
    description: record.description,
    roomId: record.roomId,
  }));

  // Containers and features are already filtered by FeatureService (includes personal discoveries)
  const transformedContainers: Container[] = roomContainersFiltered;
  const transformedFeatures: Feature[] = roomFeaturesFiltered;

  // Transform corpses
  const transformedCorpses: RoomCorpse[] = roomCorpses.map((record) => ({
    id: record.corpses.id,
    playerId: record.corpses.playerId,
    playerName: record.players.name,
    roomId: record.corpses.roomId,
  }));

  // Compose full description: description + revealed container/feature texts + navDescription
  const containerRevealedTexts = transformedContainers
    .filter((c): c is Container & { revealedText: string } => !!c.revealedText)
    .map((c) => c.revealedText);

  const featureRevealedTexts = transformedFeatures
    .filter((f): f is Feature & { revealedText: string } => !!f.revealedText)
    .map((f) => f.revealedText);

  const revealedTexts = [...containerRevealedTexts, ...featureRevealedTexts];

  const descriptionParts = [room.description];
  if (revealedTexts.length > 0) {
    descriptionParts.push(...revealedTexts);
  }
  if (room.navDescription) {
    descriptionParts.push(room.navDescription);
  }
  const fullDescription = descriptionParts.join(" ");

  return {
    ...room,
    fullDescription,
    players: roomPlayers,
    items: roomItems,
    monsters: roomMonsters,
    npcs: transformedNpcs,
    containers: transformedContainers,
    features: transformedFeatures,
    corpses: transformedCorpses,
  };
}

/**
 * Move a player in a direction, validating the exit exists and is not blocked
 * @param playerId - The player's unique identifier
 * @param direction - The direction to move
 * @returns MoveResult with the new room contents on success, or error message on failure
 */
export async function movePlayer(
  playerId: string,
  direction: Direction,
): Promise<MoveResult> {
  // Get the player's current room
  const playerRecord = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!playerRecord) {
    return { success: false, error: "Player not found" };
  }

  if (!playerRecord.currentRoomId) {
    return { success: false, error: "Player is not in a room" };
  }

  // Get the current room to check exits
  const currentRoom = await getRoom(playerRecord.currentRoomId);
  if (!currentRoom) {
    return { success: false, error: "Current room not found" };
  }

  // Check if exit exists in that direction
  const exit = currentRoom.exits[direction];
  if (!exit) {
    return { success: false, error: "There's no exit in that direction." };
  }

  // Check if exit is blocked
  if (exit.blocked) {
    return {
      success: false,
      error: exit.blockMessage || "The way is blocked.",
    };
  }

  // Update player's room
  await db
    .update(players)
    .set({ currentRoomId: exit.roomId })
    .where(eq(players.id, playerId));

  // Get the new room with contents (include player's personal discoveries)
  const newRoom = await getRoomWithContents(exit.roomId, playerId);
  if (!newRoom) {
    return { success: false, error: "Destination room not found" };
  }

  return { success: true, room: newRoom };
}
