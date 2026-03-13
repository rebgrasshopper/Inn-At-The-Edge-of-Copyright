import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import { monsterInstances, monsters, rooms } from "../../src/db/schema.js";
import { checkRoomRespawns } from "../../src/services/SpawnService.js";

describe("SpawnService", () => {
  const testRoomId = `spawn-test-room-${randomUUID()}`;
  const testMonsterId = `spawn-test-monster-${randomUUID()}`;
  let testInstanceId: string;

  beforeEach(async () => {
    // Create test room
    await db.insert(rooms).values({
      id: testRoomId,
      name: "Spawn Test Room",
      description: "A room for testing spawns",
      region: "spawn-test-region",
      exits: {},
    });

    // Create test monster with 5 second respawn for fast testing
    await db.insert(monsters).values({
      id: testMonsterId,
      name: "Test Goblin",
      description: "A test goblin",
      maxHp: 10,
      xpReward: 10,
      level: 1,
      respawnSeconds: 1, // 1 second for fast testing
    });

    // Create a live monster instance
    testInstanceId = randomUUID();
    await db.insert(monsterInstances).values({
      id: testInstanceId,
      monsterId: testMonsterId,
      roomId: testRoomId,
      currentHp: 10,
      spawnedAt: new Date(),
      killedAt: null,
    });
  });

  afterEach(async () => {
    // Clean up test data
    await db
      .delete(monsterInstances)
      .where(eq(monsterInstances.roomId, testRoomId));
    await db.delete(monsters).where(eq(monsters.id, testMonsterId));
    await db.delete(rooms).where(eq(rooms.id, testRoomId));
  });

  describe("checkRoomRespawns", () => {
    it("should not respawn alive monsters", async () => {
      const respawned = await checkRoomRespawns(testRoomId);

      expect(respawned).toHaveLength(0);

      // Verify monster is still alive
      const instance = await db
        .select()
        .from(monsterInstances)
        .where(eq(monsterInstances.id, testInstanceId))
        .get();
      expect(instance?.currentHp).toBe(10);
      expect(instance?.killedAt).toBeNull();
    });

    it("should not respawn recently killed monsters", async () => {
      // Kill the monster just now
      await db
        .update(monsterInstances)
        .set({ currentHp: 0, killedAt: new Date() })
        .where(eq(monsterInstances.id, testInstanceId));

      const respawned = await checkRoomRespawns(testRoomId);

      expect(respawned).toHaveLength(0);

      // Verify monster is still dead
      const instance = await db
        .select()
        .from(monsterInstances)
        .where(eq(monsterInstances.id, testInstanceId))
        .get();
      expect(instance?.currentHp).toBe(0);
      expect(instance?.killedAt).not.toBeNull();
    });

    it("should respawn monsters after respawn time has passed", async () => {
      // Kill the monster 2 seconds ago (respawn time is 1 second)
      const killedAt = new Date(Date.now() - 2000);
      await db
        .update(monsterInstances)
        .set({ currentHp: 0, killedAt })
        .where(eq(monsterInstances.id, testInstanceId));

      const respawned = await checkRoomRespawns(testRoomId);

      expect(respawned).toHaveLength(1);
      expect(respawned[0]).toBe("Test Goblin");

      // Verify monster is now alive
      const instance = await db
        .select()
        .from(monsterInstances)
        .where(eq(monsterInstances.id, testInstanceId))
        .get();
      expect(instance?.currentHp).toBe(10);
      expect(instance?.killedAt).toBeNull();
    });

    it("should respawn multiple monsters independently", async () => {
      // Create a second monster instance
      const secondInstanceId = randomUUID();
      await db.insert(monsterInstances).values({
        id: secondInstanceId,
        monsterId: testMonsterId,
        roomId: testRoomId,
        currentHp: 10,
        spawnedAt: new Date(),
        killedAt: null,
      });

      // Kill first monster 2 seconds ago (should respawn)
      const oldKilledAt = new Date(Date.now() - 2000);
      await db
        .update(monsterInstances)
        .set({ currentHp: 0, killedAt: oldKilledAt })
        .where(eq(monsterInstances.id, testInstanceId));

      // Kill second monster just now (should NOT respawn)
      await db
        .update(monsterInstances)
        .set({ currentHp: 0, killedAt: new Date() })
        .where(eq(monsterInstances.id, secondInstanceId));

      const respawned = await checkRoomRespawns(testRoomId);

      // Only the first monster should respawn
      expect(respawned).toHaveLength(1);

      // Verify first monster is alive
      const first = await db
        .select()
        .from(monsterInstances)
        .where(eq(monsterInstances.id, testInstanceId))
        .get();
      expect(first?.currentHp).toBe(10);

      // Verify second monster is still dead
      const second = await db
        .select()
        .from(monsterInstances)
        .where(eq(monsterInstances.id, secondInstanceId))
        .get();
      expect(second?.currentHp).toBe(0);

      // Clean up second instance
      await db
        .delete(monsterInstances)
        .where(eq(monsterInstances.id, secondInstanceId));
    });

    it("should return empty array for room with no monsters", async () => {
      const emptyRoomId = `spawn-test-empty-${randomUUID()}`;
      await db.insert(rooms).values({
        id: emptyRoomId,
        name: "Empty Room",
        description: "No monsters here",
        region: "spawn-test-region",
        exits: {},
      });

      const respawned = await checkRoomRespawns(emptyRoomId);

      expect(respawned).toHaveLength(0);

      // Clean up
      await db.delete(rooms).where(eq(rooms.id, emptyRoomId));
    });
  });
});
