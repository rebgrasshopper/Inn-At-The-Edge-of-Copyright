/**
 * Spawn service for managing monster respawns.
 * Handles checking and reviving dead monsters when players enter rooms.
 */

import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { monsterInstances, monsters } from "../db/schema.js";

/** Broadcaster function for spawn events */
export type SpawnBroadcaster = (roomId: string, monsterName: string) => void;

let broadcaster: SpawnBroadcaster | null = null;

/**
 * Set the broadcaster function for spawn events
 * @param fn - Function to broadcast spawn events to rooms
 */
export function setBroadcaster(fn: SpawnBroadcaster): void {
  broadcaster = fn;
}

/**
 * Broadcast a monster spawn event if broadcaster is set
 */
function broadcastSpawn(roomId: string, monsterName: string): void {
  if (broadcaster) {
    broadcaster(roomId, monsterName);
  }
}

/**
 * Check for and respawn any dead monsters in a room whose respawn time has passed.
 * Called when a player enters a room.
 * @param roomId - The room to check for respawns
 * @param shouldBroadcast - Whether to broadcast spawn messages (default true)
 * @returns Array of monster names that were respawned
 */
export async function checkRoomRespawns(
  roomId: string,
  shouldBroadcast = true,
): Promise<string[]> {
  const now = new Date();
  const respawnedMonsters: string[] = [];

  // Find all dead monster instances in this room with their monster data
  const deadMonsters = await db
    .select({
      instanceId: monsterInstances.id,
      killedAt: monsterInstances.killedAt,
      monsterId: monsterInstances.monsterId,
      monsterName: monsters.name,
      maxHp: monsters.maxHp,
      respawnSeconds: monsters.respawnSeconds,
    })
    .from(monsterInstances)
    .innerJoin(monsters, eq(monsterInstances.monsterId, monsters.id))
    .where(
      and(
        eq(monsterInstances.roomId, roomId),
        eq(monsterInstances.currentHp, 0),
        isNotNull(monsterInstances.killedAt),
      ),
    );

  for (const deadMonster of deadMonsters) {
    if (!deadMonster.killedAt) continue;

    // Calculate respawn threshold
    const respawnThreshold = new Date(
      deadMonster.killedAt.getTime() + deadMonster.respawnSeconds * 1000,
    );

    // Check if enough time has passed
    if (now >= respawnThreshold) {
      // Revive the monster
      await db
        .update(monsterInstances)
        .set({
          currentHp: deadMonster.maxHp,
          killedAt: null,
          spawnedAt: now,
        })
        .where(eq(monsterInstances.id, deadMonster.instanceId));

      respawnedMonsters.push(deadMonster.monsterName);
      if (shouldBroadcast) {
        broadcastSpawn(roomId, deadMonster.monsterName);
      }
    }
  }

  return respawnedMonsters;
}
