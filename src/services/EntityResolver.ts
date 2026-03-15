/**
 * Centralized entity resolver for finding things in a room by name.
 * Provides unified "wrong type" messaging when a player tries to interact
 * with something that exists but isn't valid for the action.
 */

import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  containers,
  corpses,
  features,
  items,
  monsterInstances,
  monsters,
  npcs,
  playerInventory,
  players,
  roomInventory,
} from "../db/schema.js";
import { fuzzyMatch } from "../utils/fuzzyMatch.js";

/** Entity types that can be resolved */
export type EntityType =
  | "item"
  | "monster"
  | "npc"
  | "player"
  | "feature"
  | "container"
  | "corpse";

/** A matched entity with its type and display name */
type EntityMatch = {
  type: EntityType;
  entity: unknown;
  name: string;
};

/** Result of resolving an entity */
export type ResolveResult =
  | { status: "found"; type: EntityType; entity: unknown; name: string }
  | { status: "wrong_type"; type: EntityType; name: string }
  | { status: "not_found" };

/** Default priority order for wrong_type matches */
const DEFAULT_PRIORITY: EntityType[] = [
  "item",
  "monster",
  "npc",
  "player",
  "feature",
  "container",
  "corpse",
];

/**
 * Find matching items in a room or player inventory.
 * @param roomId - The room to search
 * @param targetName - The name to match
 * @param playerId - Optional player ID to also search their inventory
 * @returns First matching item or null
 */
async function findItem(
  roomId: string,
  targetName: string,
  playerId?: string,
): Promise<EntityMatch | null> {
  // Search room inventory
  const roomItems = await db
    .select()
    .from(roomInventory)
    .innerJoin(items, eq(roomInventory.itemId, items.id))
    .where(eq(roomInventory.roomId, roomId));

  for (const record of roomItems) {
    const result = fuzzyMatch(
      targetName,
      record.items.name,
      record.items.pluralName,
    );
    if (result.matches) {
      return {
        type: "item",
        entity: record.items,
        name: record.items.name,
      };
    }
  }

  // Also search player inventory if playerId provided
  if (playerId) {
    const playerItems = await db
      .select()
      .from(playerInventory)
      .innerJoin(items, eq(playerInventory.itemId, items.id))
      .where(eq(playerInventory.playerId, playerId));

    for (const record of playerItems) {
      const result = fuzzyMatch(
        targetName,
        record.items.name,
        record.items.pluralName,
      );
      if (result.matches) {
        return {
          type: "item",
          entity: record.items,
          name: record.items.name,
        };
      }
    }
  }

  return null;
}

/**
 * Find matching monsters in a room.
 * Only returns alive monsters (currentHp > 0).
 * @param roomId - The room to search
 * @param targetName - The name to match
 * @returns First matching alive monster or null
 */
async function findMonster(
  roomId: string,
  targetName: string,
): Promise<EntityMatch | null> {
  const roomMonsters = await db
    .select()
    .from(monsterInstances)
    .innerJoin(monsters, eq(monsterInstances.monsterId, monsters.id))
    .where(eq(monsterInstances.roomId, roomId));

  const lowerTarget = targetName.toLowerCase();

  for (const record of roomMonsters) {
    // Skip dead monsters
    if (record.monster_instances.currentHp <= 0) {
      continue;
    }

    const monsterName = record.monsters.name.toLowerCase();
    if (
      monsterName === lowerTarget ||
      monsterName.includes(lowerTarget) ||
      lowerTarget.includes(monsterName)
    ) {
      return {
        type: "monster",
        entity: record,
        name: record.monsters.name,
      };
    }
  }
  return null;
}

/**
 * Find matching NPCs in a room.
 * @param roomId - The room to search
 * @param targetName - The name to match
 * @returns First matching NPC or null
 */
async function findNpc(
  roomId: string,
  targetName: string,
): Promise<EntityMatch | null> {
  const roomNpcs = await db.select().from(npcs).where(eq(npcs.roomId, roomId));

  const result = fuzzyMatch(targetName, "npc");
  if (result.matches) {
    // Generic "npc" search - return first NPC
    if (roomNpcs.length > 0) {
      return {
        type: "npc",
        entity: roomNpcs[0],
        name: roomNpcs[0].name,
      };
    }
  }

  for (const npc of roomNpcs) {
    const npcResult = fuzzyMatch(targetName, npc.name);
    if (npcResult.matches) {
      return {
        type: "npc",
        entity: npc,
        name: npc.name,
      };
    }
  }
  return null;
}

/**
 * Find matching online players in a room.
 * @param roomId - The room to search
 * @param targetName - The name to match
 * @returns First matching player or null
 */
async function findPlayer(
  roomId: string,
  targetName: string,
): Promise<EntityMatch | null> {
  const roomPlayers = await db
    .select()
    .from(players)
    .where(and(eq(players.currentRoomId, roomId), eq(players.isOnline, true)));

  for (const player of roomPlayers) {
    const result = fuzzyMatch(targetName, player.name);
    if (result.matches) {
      return {
        type: "player",
        entity: player,
        name: player.name,
      };
    }
  }
  return null;
}

/**
 * Find matching visible features in a room.
 * Includes globally visible features and personal discoveries for the player.
 * @param roomId - The room to search
 * @param targetName - The name to match
 * @param playerId - Optional player ID to include their personal discoveries
 * @returns First matching feature or null
 */
async function findFeature(
  roomId: string,
  targetName: string,
  playerId?: string,
): Promise<EntityMatch | null> {
  // Get player's discovered feature IDs if playerId provided
  let discoveredIds: string[] = [];
  if (playerId) {
    const player = await db
      .select({ discoveredFeatureIds: players.discoveredFeatureIds })
      .from(players)
      .where(eq(players.id, playerId))
      .get();
    discoveredIds = (player?.discoveredFeatureIds as string[]) ?? [];
  }

  // Get all features in room
  const roomFeatures = await db
    .select()
    .from(features)
    .where(eq(features.roomId, roomId));

  // Filter to visible features (not hidden OR in player's discoveries)
  const visibleFeatures = roomFeatures.filter(
    (f) => !f.isHidden || discoveredIds.includes(f.id),
  );

  for (const feature of visibleFeatures) {
    const result = fuzzyMatch(targetName, feature.name);
    if (result.matches) {
      return {
        type: "feature",
        entity: feature,
        name: feature.name,
      };
    }
  }
  return null;
}

/**
 * Find matching visible containers in a room.
 * Includes globally visible containers and personal discoveries for the player.
 * @param roomId - The room to search
 * @param targetName - The name to match
 * @param playerId - Optional player ID to include their personal discoveries
 * @returns First matching container or null
 */
async function findContainer(
  roomId: string,
  targetName: string,
  playerId?: string,
): Promise<EntityMatch | null> {
  // Get player's discovered container IDs if playerId provided
  let discoveredIds: string[] = [];
  if (playerId) {
    const player = await db
      .select({ discoveredContainerIds: players.discoveredContainerIds })
      .from(players)
      .where(eq(players.id, playerId))
      .get();
    discoveredIds = (player?.discoveredContainerIds as string[]) ?? [];
  }

  // Get all containers in room
  const roomContainers = await db
    .select()
    .from(containers)
    .where(eq(containers.roomId, roomId));

  // Filter to visible containers (not hidden OR in player's discoveries)
  const visibleContainers = roomContainers.filter(
    (c) => !c.isHidden || discoveredIds.includes(c.id),
  );

  const nameLower = targetName.toLowerCase();

  for (const container of visibleContainers) {
    // Check main name
    const result = fuzzyMatch(targetName, container.name);
    if (result.matches) {
      return {
        type: "container",
        entity: container,
        name: container.name,
      };
    }

    // Check aliases
    const aliases = (container.aliases as string[] | null) || [];
    for (const alias of aliases) {
      if (alias.toLowerCase().startsWith(nameLower)) {
        return {
          type: "container",
          entity: container,
          name: container.name,
        };
      }
    }
  }
  return null;
}

/**
 * Find matching corpses in a room.
 * Returns the oldest corpse that matches (for consistent "wrong type" messaging).
 * @param roomId - The room to search
 * @param targetName - The name to match
 * @returns First matching corpse or null
 */
async function findCorpse(
  roomId: string,
  targetName: string,
): Promise<EntityMatch | null> {
  const roomCorpses = await db
    .select()
    .from(corpses)
    .innerJoin(players, eq(corpses.playerId, players.id))
    .where(eq(corpses.roomId, roomId));

  if (roomCorpses.length === 0) return null;

  const targetLower = targetName.toLowerCase().trim();

  // Check for "corpse of X" pattern
  const corpseOfMatch = targetLower.match(/^corpse\s+of\s+(.+)$/);
  if (corpseOfMatch) {
    const nameQuery = corpseOfMatch[1];
    const match = roomCorpses.find((c) =>
      c.players.name.toLowerCase().startsWith(nameQuery),
    );
    if (match) {
      return {
        type: "corpse",
        entity: match,
        name: `corpse of ${match.players.name}`,
      };
    }
    return null;
  }

  // Just "corpse" - return oldest (first in array, assuming ordered by createdAt)
  if (targetLower === "corpse" || targetLower === "corpses") {
    // Sort by createdAt to get oldest first
    const sorted = [...roomCorpses].sort(
      (a, b) => a.corpses.createdAt.getTime() - b.corpses.createdAt.getTime(),
    );
    const oldest = sorted[0];
    return {
      type: "corpse",
      entity: oldest,
      name: `corpse of ${oldest.players.name}`,
    };
  }

  return null;
}

/**
 * Gather all matching entities in a room.
 * Runs all finder functions in parallel and returns a map of matches.
 * @param roomId - The room to search
 * @param targetName - The name to match
 * @param playerId - Optional player ID for inventory and personal discovery searches
 * @returns Map of entity type to first match
 */
async function gatherAllMatches(
  roomId: string,
  targetName: string,
  playerId?: string,
): Promise<Map<EntityType, EntityMatch>> {
  const [item, monster, npc, player, feature, container, corpse] =
    await Promise.all([
      findItem(roomId, targetName, playerId),
      findMonster(roomId, targetName),
      findNpc(roomId, targetName),
      findPlayer(roomId, targetName),
      findFeature(roomId, targetName, playerId),
      findContainer(roomId, targetName, playerId),
      findCorpse(roomId, targetName),
    ]);

  const matches = new Map<EntityType, EntityMatch>();

  if (item) matches.set("item", item);
  if (monster) matches.set("monster", monster);
  if (npc) matches.set("npc", npc);
  if (player) matches.set("player", player);
  if (feature) matches.set("feature", feature);
  if (container) matches.set("container", container);
  if (corpse) matches.set("corpse", corpse);

  return matches;
}

/**
 * Resolve an entity in a room by name.
 * Searches all visible entity types and returns the first match.
 *
 * @param roomId - The room to search
 * @param targetName - The name to search for (fuzzy matched)
 * @param allowedTypes - Entity types that are valid for this action (in priority order)
 * @param playerId - Optional player ID for inventory and personal discovery searches
 * @returns ResolveResult indicating found, wrong_type, or not_found
 *
 * @example
 * // For attack command - only monsters and players are valid targets
 * const result = await resolveEntity(roomId, "goblin", ["monster", "player"]);
 * if (result.status === "wrong_type") {
 *   return `You can't attack the ${result.name}.`;
 * }
 *
 * @example
 * // For examine command - include player inventory search
 * const result = await resolveEntity(roomId, "sword", ["item", "monster", "npc"], playerId);
 */
export async function resolveEntity(
  roomId: string,
  targetName: string,
  allowedTypes: EntityType[],
  playerId?: string,
): Promise<ResolveResult> {
  // Gather all matches in parallel
  const matches = await gatherAllMatches(roomId, targetName, playerId);

  // Check allowed types in caller's priority order
  for (const type of allowedTypes) {
    const match = matches.get(type);
    if (match) {
      return {
        status: "found",
        type,
        entity: match.entity,
        name: match.name,
      };
    }
  }

  // Check for wrong-type match using default priority
  for (const type of DEFAULT_PRIORITY) {
    if (!allowedTypes.includes(type)) {
      const match = matches.get(type);
      if (match) {
        return {
          status: "wrong_type",
          type,
          name: match.name,
        };
      }
    }
  }

  // Nothing found
  return { status: "not_found" };
}
