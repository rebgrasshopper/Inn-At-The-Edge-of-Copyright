/**
 * Tests for EntityResolver - finding entities in rooms by name.
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import {
  monsterInstances,
  monsters,
  players,
  rooms,
  users,
} from "../../src/db/schema.js";
import { resolveEntity } from "../../src/services/EntityResolver.js";

// Test IDs
const TEST_USER_ID = "test-user-entity-resolver";
const TEST_PLAYER_ID = "test-player-entity-resolver";
const TEST_ROOM_ID = "test-room-entity-resolver";
const TEST_MONSTER_ID = "test-monster-entity-resolver";
const TEST_MONSTER_INSTANCE_ID = "test-monster-instance-entity-resolver";

async function cleanupTestData() {
  await db
    .delete(monsterInstances)
    .where(eq(monsterInstances.id, TEST_MONSTER_INSTANCE_ID));
  await db.delete(monsters).where(eq(monsters.id, TEST_MONSTER_ID));
  await db.delete(players).where(eq(players.id, TEST_PLAYER_ID));
  await db.delete(rooms).where(eq(rooms.id, TEST_ROOM_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
}

beforeAll(async () => {
  await cleanupTestData();

  // Create test user
  await db.insert(users).values({
    id: TEST_USER_ID,
    username: "entityresolveruser",
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });

  // Create test room
  await db.insert(rooms).values({
    id: TEST_ROOM_ID,
    name: "Entity Resolver Test Room",
    description: "A room for testing entity resolution",
    region: "testregion",
    exits: {},
  });

  // Create test player
  await db.insert(players).values({
    id: TEST_PLAYER_ID,
    userId: TEST_USER_ID,
    name: "EntityTestPlayer",
    currentRoomId: TEST_ROOM_ID,
    isOnline: true,
    createdAt: new Date(),
  });

  // Create test monster type
  await db.insert(monsters).values({
    id: TEST_MONSTER_ID,
    name: "test orc",
    description: "A test orc",
    level: 1,
    maxHp: 10,
    str: 12,
    dex: 10,
    con: 12,
    weaponDamage: "1d6",
    aggroScore: 0,
  });
});

afterAll(async () => {
  await cleanupTestData();
});

beforeEach(async () => {
  // Clean up monster instance before each test
  await db
    .delete(monsterInstances)
    .where(eq(monsterInstances.id, TEST_MONSTER_INSTANCE_ID));
});

describe("EntityResolver", () => {
  describe("findMonster", () => {
    it("should find alive monster by name", async () => {
      // Create alive monster instance
      await db.insert(monsterInstances).values({
        id: TEST_MONSTER_INSTANCE_ID,
        monsterId: TEST_MONSTER_ID,
        roomId: TEST_ROOM_ID,
        currentHp: 10,
        spawnedAt: new Date(),
        permanent: true,
      });

      const result = await resolveEntity(TEST_ROOM_ID, "orc", ["monster"]);

      expect(result.status).toBe("found");
      expect(result.type).toBe("monster");
      expect(result.name).toBe("test orc");
    });

    it("should not find dead monster (HP = 0)", async () => {
      // Create dead monster instance
      await db.insert(monsterInstances).values({
        id: TEST_MONSTER_INSTANCE_ID,
        monsterId: TEST_MONSTER_ID,
        roomId: TEST_ROOM_ID,
        currentHp: 0,
        spawnedAt: new Date(),
        killedAt: new Date(),
        permanent: true,
      });

      const result = await resolveEntity(TEST_ROOM_ID, "orc", ["monster"]);

      expect(result.status).toBe("not_found");
    });

    it("should not find monster with negative HP", async () => {
      // Create monster with negative HP (edge case)
      await db.insert(monsterInstances).values({
        id: TEST_MONSTER_INSTANCE_ID,
        monsterId: TEST_MONSTER_ID,
        roomId: TEST_ROOM_ID,
        currentHp: -5,
        spawnedAt: new Date(),
        killedAt: new Date(),
        permanent: true,
      });

      const result = await resolveEntity(TEST_ROOM_ID, "orc", ["monster"]);

      expect(result.status).toBe("not_found");
    });

    it("should find monster with partial name match", async () => {
      // Create alive monster instance
      await db.insert(monsterInstances).values({
        id: TEST_MONSTER_INSTANCE_ID,
        monsterId: TEST_MONSTER_ID,
        roomId: TEST_ROOM_ID,
        currentHp: 10,
        spawnedAt: new Date(),
        permanent: true,
      });

      const result = await resolveEntity(TEST_ROOM_ID, "test", ["monster"]);

      expect(result.status).toBe("found");
      expect(result.name).toBe("test orc");
    });

    it("should return not_found when no monster in room", async () => {
      // No monster instance created
      const result = await resolveEntity(TEST_ROOM_ID, "orc", ["monster"]);

      expect(result.status).toBe("not_found");
    });
  });
});
