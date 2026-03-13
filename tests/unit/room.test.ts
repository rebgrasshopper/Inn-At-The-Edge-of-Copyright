import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import {
  containerInventory,
  containers,
  features,
  items,
  monsterInstances,
  monsterSpawns,
  monsters,
  npcs,
  playerFeats,
  playerInventory,
  players as playersTable,
  roomInventory,
  rooms,
  users,
} from "../../src/db/schema.js";
import * as RoomService from "../../src/services/RoomService.js";

// Dummy usage to prevent auto-removal of playerFeats import
const _playerFeatsTable = playerFeats;

// Test data IDs
const testUserId = "test-user-room";
const testPlayerId = "test-player-room";
const testRoom1Id = "test-room-1";
const testRoom2Id = "test-room-2";
const testRoom3Id = "test-room-3";
const testItemId = "test-item-sword";
const testMonsterId = "test-monster-goblin";
const testNpcId = "test-npc-merchant";
const testContainerId = "test-container-chest";
const testFeatureId = "test-feature-fountain";

async function cleanupTestData() {
  // Delete only our test data, respecting foreign keys
  await db
    .delete(containerInventory)
    .where(eq(containerInventory.containerId, testContainerId));
  await db
    .delete(monsterInstances)
    .where(eq(monsterInstances.monsterId, testMonsterId));
  await db
    .delete(monsterSpawns)
    .where(eq(monsterSpawns.monsterId, testMonsterId));
  await db.delete(roomInventory).where(eq(roomInventory.roomId, testRoom1Id));
  await db
    .delete(playerInventory)
    .where(eq(playerInventory.playerId, testPlayerId));
  await db.delete(features).where(eq(features.id, testFeatureId));
  await db.delete(containers).where(eq(containers.id, testContainerId));
  await db.delete(npcs).where(eq(npcs.id, testNpcId));
  await db.delete(playerFeats).where(eq(playerFeats.playerId, testPlayerId));
  await db.delete(playersTable).where(eq(playersTable.id, testPlayerId));
  await db.delete(monsters).where(eq(monsters.id, testMonsterId));
  await db.delete(items).where(eq(items.id, testItemId));
  await db.delete(rooms).where(eq(rooms.id, testRoom1Id));
  await db.delete(rooms).where(eq(rooms.id, testRoom2Id));
  await db.delete(rooms).where(eq(rooms.id, testRoom3Id));
  await db.delete(users).where(eq(users.id, testUserId));
}

beforeAll(async () => {
  await cleanupTestData();

  // Create test user
  await db.insert(users).values({
    id: testUserId,
    username: "roomtestuser",
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });

  // Create test rooms
  await db.insert(rooms).values([
    {
      id: testRoom1Id,
      name: "Test Room 1",
      description: "A test room with exits",
      region: "roomtest-region",
      exits: {
        north: { roomId: testRoom2Id },
        east: {
          roomId: testRoom3Id,
          blocked: true,
          blockMessage: "The door is locked.",
        },
      },
    },
    {
      id: testRoom2Id,
      name: "Test Room 2",
      description: "Another test room",
      region: "roomtest-region",
      exits: { south: { roomId: testRoom1Id } },
    },
    {
      id: testRoom3Id,
      name: "Test Room 3",
      description: "A room behind a locked door",
      region: "otherregion",
      exits: { west: { roomId: testRoom1Id } },
    },
  ]);

  // Create test item
  await db.insert(items).values({
    id: testItemId,
    name: "test sword",
    description: "A test sword",
    category: "weapon",
    attackBonus: 1,
    damageBonus: 1,
  });

  // Create test monster definition
  await db.insert(monsters).values({
    id: testMonsterId,
    name: "test goblin",
    description: "A test goblin",
    str: 8,
    dex: 12,
    con: 10,
    int: 6,
    wis: 8,
    cha: 6,
    maxHp: 8,
    xpReward: 25,
  });

  // Create test NPC
  await db.insert(npcs).values({
    id: testNpcId,
    name: "Test Merchant",
    description: "A test merchant",
    roomId: testRoom1Id,
  });

  // Create test container (visible)
  await db.insert(containers).values({
    id: testContainerId,
    roomId: testRoom1Id,
    name: "test chest",
    description: "A test chest",
    isHidden: false,
  });

  // Create test feature (visible)
  await db.insert(features).values({
    id: testFeatureId,
    roomId: testRoom1Id,
    name: "test fountain",
    description: "A test fountain",
    triggerVerbs: ["drink"],
    triggerTarget: "fountain",
    successMessage: "You drink from the fountain.",
    isHidden: false,
    isDiscovered: false,
  });
});

afterAll(async () => {
  await cleanupTestData();
});

describe("RoomService", () => {
  describe("getRoom", () => {
    it("should return a room by ID", async () => {
      const room = await RoomService.getRoom(testRoom1Id);

      expect(room).not.toBeNull();
      expect(room!.id).toBe(testRoom1Id);
      expect(room!.name).toBe("Test Room 1");
      expect(room!.region).toBe("roomtest-region");
      expect(room!.exits.north).toEqual({ roomId: testRoom2Id });
    });

    it("should return null for non-existent room", async () => {
      const room = await RoomService.getRoom("non-existent-room");
      expect(room).toBeNull();
    });

    it("should include blocked exit info", async () => {
      const room = await RoomService.getRoom(testRoom1Id);

      expect(room!.exits.east).toEqual({
        roomId: testRoom3Id,
        blocked: true,
        blockMessage: "The door is locked.",
      });
    });
  });

  describe("getPlayersInRoom", () => {
    beforeEach(async () => {
      await db.delete(playerInventory);
      await db.delete(playerFeats);
      await db.delete(playersTable);
    });

    it("should return only online players", async () => {
      // Create online and offline players
      await db.insert(playersTable).values([
        {
          id: "online-player",
          userId: testUserId,
          name: "Online Player",
          currentRoomId: testRoom1Id,
          isOnline: true,
          createdAt: new Date(),
        },
        {
          id: "offline-player",
          userId: testUserId,
          name: "Offline Player",
          currentRoomId: testRoom1Id,
          isOnline: false,
          createdAt: new Date(),
        },
      ]);

      const players = await RoomService.getPlayersInRoom(testRoom1Id);

      expect(players).toHaveLength(1);
      expect(players[0].name).toBe("Online Player");
      expect(players[0].isOnline).toBe(true);
    });

    it("should return empty array for room with no players", async () => {
      const players = await RoomService.getPlayersInRoom(testRoom2Id);
      expect(players).toHaveLength(0);
    });
  });

  describe("getRoomsByRegion", () => {
    it("should return all rooms in a region", async () => {
      const rooms = await RoomService.getRoomsByRegion("roomtest-region");

      expect(rooms).toHaveLength(2);
      expect(rooms.map((r) => r.id)).toContain(testRoom1Id);
      expect(rooms.map((r) => r.id)).toContain(testRoom2Id);
    });

    it("should return empty array for non-existent region", async () => {
      const rooms = await RoomService.getRoomsByRegion("nonexistent");
      expect(rooms).toHaveLength(0);
    });
  });

  describe("getRoomWithContents", () => {
    beforeEach(async () => {
      await db.delete(monsterInstances);
      await db.delete(roomInventory);
      await db.delete(playerInventory);
      await db.delete(playerFeats);
      await db.delete(playersTable);
    });

    it("should return room with all contents", async () => {
      // Add player to room
      await db.insert(playersTable).values({
        id: testPlayerId,
        userId: testUserId,
        name: "Test Player",
        currentRoomId: testRoom1Id,
        isOnline: true,
        createdAt: new Date(),
      });

      // Add item to room
      await db.insert(roomInventory).values({
        id: randomUUID(),
        roomId: testRoom1Id,
        itemId: testItemId,
        quantity: 2,
      });

      // Add monster instance to room
      await db.insert(monsterInstances).values({
        id: randomUUID(),
        monsterId: testMonsterId,
        roomId: testRoom1Id,
        currentHp: 8,
        spawnedAt: new Date(),
      });

      const room = await RoomService.getRoomWithContents(testRoom1Id);

      expect(room).not.toBeNull();
      expect(room!.players).toHaveLength(1);
      expect(room!.players[0].name).toBe("Test Player");
      expect(room!.items).toHaveLength(1);
      expect(room!.items[0].item.name).toBe("test sword");
      expect(room!.items[0].quantity).toBe(2);
      expect(room!.monsters).toHaveLength(1);
      expect(room!.monsters[0].monster.name).toBe("test goblin");
      expect(room!.npcs).toHaveLength(1);
      expect(room!.npcs[0].name).toBe("Test Merchant");
      expect(room!.containers).toHaveLength(1);
      expect(room!.containers[0].name).toBe("test chest");
      expect(room!.features).toHaveLength(1);
      expect(room!.features[0].name).toBe("test fountain");
    });

    it("should return null for non-existent room", async () => {
      const room = await RoomService.getRoomWithContents("non-existent");
      expect(room).toBeNull();
    });

    it("should exclude hidden containers", async () => {
      // Add hidden container
      await db.insert(containers).values({
        id: "hidden-container",
        roomId: testRoom1Id,
        name: "hidden cache",
        description: "A hidden cache",
        isHidden: true,
      });

      const room = await RoomService.getRoomWithContents(testRoom1Id);

      // Should only have the visible container
      expect(room!.containers).toHaveLength(1);
      expect(room!.containers[0].name).toBe("test chest");

      // Cleanup
      await db.delete(containers).where(eq(containers.id, "hidden-container"));
    });

    it("should exclude hidden features", async () => {
      // Add hidden feature
      await db.insert(features).values({
        id: "hidden-feature",
        roomId: testRoom1Id,
        name: "hidden lever",
        description: "A hidden lever",
        triggerVerbs: ["pull"],
        triggerTarget: "lever",
        isHidden: true,
        isDiscovered: false,
      });

      const room = await RoomService.getRoomWithContents(testRoom1Id);

      // Should only have the visible feature
      expect(room!.features).toHaveLength(1);
      expect(room!.features[0].name).toBe("test fountain");

      // Cleanup
      await db.delete(features).where(eq(features.id, "hidden-feature"));
    });
  });

  describe("movePlayer", () => {
    beforeEach(async () => {
      await db.delete(playerInventory);
      await db.delete(playerFeats);
      await db.delete(playersTable);

      // Create test player in room 1
      await db.insert(playersTable).values({
        id: testPlayerId,
        userId: testUserId,
        name: "Test Player",
        currentRoomId: testRoom1Id,
        isOnline: true,
        createdAt: new Date(),
      });
    });

    it("should move player to valid exit", async () => {
      const result = await RoomService.movePlayer(testPlayerId, "north");

      expect(result.success).toBe(true);
      expect(result.room).not.toBeNull();
      expect(result.room!.id).toBe(testRoom2Id);
      expect(result.room!.name).toBe("Test Room 2");
    });

    it("should fail for non-existent direction", async () => {
      const result = await RoomService.movePlayer(testPlayerId, "west");

      expect(result.success).toBe(false);
      expect(result.error).toBe("There's no exit in that direction.");
    });

    it("should fail for blocked exit with custom message", async () => {
      const result = await RoomService.movePlayer(testPlayerId, "east");

      expect(result.success).toBe(false);
      expect(result.error).toBe("The door is locked.");
    });

    it("should fail for non-existent player", async () => {
      const result = await RoomService.movePlayer("non-existent", "north");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Player not found");
    });

    it("should update player's currentRoomId after move", async () => {
      await RoomService.movePlayer(testPlayerId, "north");

      const room1Players = await RoomService.getPlayersInRoom(testRoom1Id);
      const room2Players = await RoomService.getPlayersInRoom(testRoom2Id);

      expect(room1Players).toHaveLength(0);
      expect(room2Players).toHaveLength(1);
      expect(room2Players[0].id).toBe(testPlayerId);
    });
  });
});
