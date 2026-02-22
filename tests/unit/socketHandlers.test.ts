import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import { players, rooms, users } from "../../src/db/schema.js";
import {
  getPlayerRoomName,
  getSocketRoomName,
} from "../../src/socket/handlers.js";

describe("Socket Handlers", () => {
  describe("getSocketRoomName", () => {
    it("should prefix room ID with 'room:'", () => {
      const roomId = "test-room-123";
      expect(getSocketRoomName(roomId)).toBe("room:test-room-123");
    });

    it("should handle empty string", () => {
      expect(getSocketRoomName("")).toBe("room:");
    });

    it("should handle UUIDs", () => {
      const uuid = uuidv4();
      expect(getSocketRoomName(uuid)).toBe(`room:${uuid}`);
    });
  });

  describe("getPlayerRoomName", () => {
    it("should prefix player ID with 'player:'", () => {
      const playerId = "player-456";
      expect(getPlayerRoomName(playerId)).toBe("player:player-456");
    });

    it("should handle UUIDs", () => {
      const uuid = uuidv4();
      expect(getPlayerRoomName(uuid)).toBe(`player:${uuid}`);
    });
  });
});

describe("Socket Handler Integration", () => {
  const testUserId = uuidv4();
  const testPlayerId = uuidv4();
  const testRoomId = uuidv4();

  beforeEach(async () => {
    // Clean up test data
    await db.delete(players).where(eq(players.id, testPlayerId));
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(rooms).where(eq(rooms.id, testRoomId));

    // Create test room
    await db.insert(rooms).values({
      id: testRoomId,
      name: "Test Room",
      description: "A test room",
      region: "test-region",
      exits: {},
    });

    // Create test user
    await db.insert(users).values({
      id: testUserId,
      username: `testuser_${Date.now()}`,
      passwordHash: "hash",
      createdAt: new Date(),
    });

    // Create test player
    await db.insert(players).values({
      id: testPlayerId,
      userId: testUserId,
      name: `TestPlayer_${Date.now()}`,
      currentRoomId: testRoomId,
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
      currentHp: 10,
      maxHp: 10,
      xp: 0,
      level: 1,
      isOnline: false,
      createdAt: new Date(),
    });
  });

  describe("Online status updates", () => {
    it("should update player online status in database", async () => {
      // Verify initial state
      const before = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(before?.isOnline).toBe(false);

      // Simulate setting online
      await db
        .update(players)
        .set({ isOnline: true })
        .where(eq(players.id, testPlayerId));

      const after = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(after?.isOnline).toBe(true);

      // Simulate setting offline
      await db
        .update(players)
        .set({ isOnline: false })
        .where(eq(players.id, testPlayerId));

      const final = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(final?.isOnline).toBe(false);
    });
  });

  describe("Room membership", () => {
    it("should track player room correctly", async () => {
      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();

      expect(player?.currentRoomId).toBe(testRoomId);
      expect(getSocketRoomName(player!.currentRoomId!)).toBe(
        `room:${testRoomId}`,
      );
    });
  });
});
