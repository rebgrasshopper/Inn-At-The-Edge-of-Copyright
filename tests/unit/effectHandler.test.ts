import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import {
  items,
  playerInventory,
  players,
  rooms,
  users,
} from "../../src/db/schema.js";
import * as EffectHandler from "../../src/services/EffectHandler.js";

describe("EffectHandler", () => {
  let testUserId: string;
  let testPlayerId: string;
  let testRoomId: string;
  let testRoom2Id: string;
  let testItemId: string;

  beforeEach(async () => {
    // Create test user
    testUserId = uuidv4();
    await db.insert(users).values({
      id: testUserId,
      username: `testuser_${Date.now()}`,
      passwordHash: "hash",
      createdAt: new Date(),
    });

    // Create test rooms
    testRoomId = uuidv4();
    testRoom2Id = uuidv4();
    await db.insert(rooms).values([
      {
        id: testRoomId,
        name: "Test Room",
        description: "A test room",
        region: "test",
        exits: {},
      },
      {
        id: testRoom2Id,
        name: "Second Room",
        description: "Another test room",
        region: "test",
        exits: {},
      },
    ]);

    // Create test player
    testPlayerId = uuidv4();
    await db.insert(players).values({
      id: testPlayerId,
      userId: testUserId,
      name: `TestPlayer_${Date.now()}`,
      currentRoomId: testRoomId,
      currentHp: 20,
      maxHp: 20,
      xp: 0,
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
      createdAt: new Date(),
    });

    // Create test item
    testItemId = uuidv4();
    await db.insert(items).values({
      id: testItemId,
      name: "Test Potion",
      pluralName: "Test Potions",
      description: "A test potion",
    });
  });

  afterEach(async () => {
    // Clean up in reverse order of dependencies
    await db
      .delete(playerInventory)
      .where(eq(playerInventory.playerId, testPlayerId));
    await db.delete(players).where(eq(players.id, testPlayerId));
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(items).where(eq(items.id, testItemId));
    await db.delete(rooms).where(eq(rooms.id, testRoomId));
    await db.delete(rooms).where(eq(rooms.id, testRoom2Id));
  });

  describe("applyDamage", () => {
    it("should reduce player HP", async () => {
      const result = await EffectHandler.applyDamage(testPlayerId, 5);

      expect(result.success).toBe(true);
      expect(result.type).toBe("damage");
      expect(result.message).toContain("5");
      expect(result.playerUpdate?.currentHp).toBe(15);

      // Verify in database
      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.currentHp).toBe(15);
    });

    it("should not reduce HP below 0", async () => {
      const result = await EffectHandler.applyDamage(testPlayerId, 100);

      expect(result.success).toBe(true);
      expect(result.playerUpdate?.currentHp).toBe(0);
      expect(result.message).toContain("unconscious");
    });

    it("should include damage type in message", async () => {
      const result = await EffectHandler.applyDamage(testPlayerId, 5, "fire");

      expect(result.message).toContain("fire");
    });

    it("should fail for non-existent player", async () => {
      const result = await EffectHandler.applyDamage("nonexistent", 5);

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });

  describe("applyHeal", () => {
    it("should increase player HP", async () => {
      // First damage the player
      await EffectHandler.applyDamage(testPlayerId, 10);

      const result = await EffectHandler.applyHeal(testPlayerId, 5);

      expect(result.success).toBe(true);
      expect(result.type).toBe("heal");
      expect(result.playerUpdate?.currentHp).toBe(15);
    });

    it("should not exceed maxHp", async () => {
      const result = await EffectHandler.applyHeal(testPlayerId, 100);

      expect(result.success).toBe(true);
      expect(result.message).toContain("full health");
    });

    it("should fail for non-existent player", async () => {
      const result = await EffectHandler.applyHeal("nonexistent", 5);

      expect(result.success).toBe(false);
    });
  });

  describe("awardXp", () => {
    it("should increase player XP", async () => {
      const result = await EffectHandler.awardXp(testPlayerId, 100);

      expect(result.success).toBe(true);
      expect(result.type).toBe("xp");
      expect(result.playerUpdate?.xp).toBe(100);
      expect(result.message).toContain("100");
    });

    it("should fail for non-existent player", async () => {
      const result = await EffectHandler.awardXp("nonexistent", 100);

      expect(result.success).toBe(false);
    });
  });

  describe("modifyStat", () => {
    it("should increase a stat", async () => {
      const result = await EffectHandler.modifyStat(testPlayerId, "str", 2);

      expect(result.success).toBe(true);
      expect(result.type).toBe("stat_modify");
      expect(result.message).toContain("STR");
      expect(result.message).toContain("increases");

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.str).toBe(12);
    });

    it("should decrease a stat", async () => {
      const result = await EffectHandler.modifyStat(testPlayerId, "dex", -3);

      expect(result.success).toBe(true);
      expect(result.message).toContain("decreases");

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.dex).toBe(7);
    });

    it("should not reduce stat below 1", async () => {
      const result = await EffectHandler.modifyStat(testPlayerId, "int", -100);

      expect(result.success).toBe(true);

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.int).toBe(1);
    });

    it("should fail for non-existent player", async () => {
      const result = await EffectHandler.modifyStat("nonexistent", "str", 1);

      expect(result.success).toBe(false);
    });
  });

  describe("giveItem", () => {
    it("should add item to player inventory", async () => {
      const result = await EffectHandler.giveItem(testPlayerId, testItemId, 1);

      expect(result.success).toBe(true);
      expect(result.type).toBe("give_item");
      expect(result.message).toContain("Test Potion");

      const inventory = await db
        .select()
        .from(playerInventory)
        .where(eq(playerInventory.playerId, testPlayerId))
        .get();
      expect(inventory?.quantity).toBe(1);
    });

    it("should stack with existing items", async () => {
      await EffectHandler.giveItem(testPlayerId, testItemId, 2);
      await EffectHandler.giveItem(testPlayerId, testItemId, 3);

      const inventory = await db
        .select()
        .from(playerInventory)
        .where(eq(playerInventory.playerId, testPlayerId))
        .get();
      expect(inventory?.quantity).toBe(5);
    });

    it("should fail for non-existent item", async () => {
      const result = await EffectHandler.giveItem(
        testPlayerId,
        "nonexistent",
        1,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });

  describe("teleport", () => {
    it("should move player to new room", async () => {
      const result = await EffectHandler.teleport(testPlayerId, testRoom2Id);

      expect(result.success).toBe(true);
      expect(result.type).toBe("teleport");
      expect(result.message).toContain("Second Room");
      expect(result.playerUpdate?.currentRoomId).toBe(testRoom2Id);

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.currentRoomId).toBe(testRoom2Id);
    });

    it("should fail for non-existent room", async () => {
      const result = await EffectHandler.teleport(testPlayerId, "nonexistent");

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });

  describe("applyStatus", () => {
    it("should return success with stub message", async () => {
      const result = await EffectHandler.applyStatus(
        testPlayerId,
        "poisoned",
        60,
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe("status");
      expect(result.message).toContain("poisoned");
      expect(result.message).toContain("60 seconds");
    });
  });

  describe("apply", () => {
    it("should apply multiple effects in order", async () => {
      const effects = [
        { type: "damage" as const, amount: 5 },
        { type: "xp" as const, amount: 50 },
      ];

      const results = await EffectHandler.apply(testPlayerId, effects);

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe("damage");
      expect(results[1].type).toBe("xp");

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.currentHp).toBe(15);
      expect(player?.xp).toBe(50);
    });
  });
});
