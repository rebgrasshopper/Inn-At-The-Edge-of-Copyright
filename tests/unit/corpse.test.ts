/**
 * Tests for CorpseService
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import {
  corpseInventory,
  corpses,
  items,
  playerInventory,
  players,
  rooms,
  users,
} from "../../src/db/schema.js";
import * as CorpseService from "../../src/services/CorpseService.js";

const testUserId = "test-user-corpse";
const testUserId2 = "test-user-corpse-2";
const testPlayerId = "test-player-corpse";
const testPlayerId2 = "test-player-corpse-2";
const testRoomId = "test-room-corpse";
const testItemId = "test-item-corpse-sword";

async function cleanupTestData() {
  // Only delete our specific test data, not all data
  await db.delete(corpseInventory);
  await db.delete(corpses);
  await db
    .delete(playerInventory)
    .where(eq(playerInventory.playerId, testPlayerId));
  await db
    .delete(playerInventory)
    .where(eq(playerInventory.playerId, testPlayerId2));
  await db.delete(players).where(eq(players.id, testPlayerId));
  await db.delete(players).where(eq(players.id, testPlayerId2));
  await db.delete(items).where(eq(items.id, testItemId));
  await db.delete(rooms).where(eq(rooms.id, testRoomId));
  await db.delete(users).where(eq(users.id, testUserId));
  await db.delete(users).where(eq(users.id, testUserId2));
}

beforeAll(async () => {
  await cleanupTestData();

  await db.insert(users).values([
    {
      id: testUserId,
      username: "corpsetestuser",
      passwordHash: "hashedpassword",
      createdAt: new Date(),
    },
    {
      id: testUserId2,
      username: "corpsetestuser2",
      passwordHash: "hashedpassword",
      createdAt: new Date(),
    },
  ]);

  await db.insert(rooms).values({
    id: testRoomId,
    name: "Corpse Test Room",
    description: "A room for testing corpses",
    region: "testregion",
    exits: {},
  });

  await db.insert(items).values({
    id: testItemId,
    name: "rusty sword",
    description: "A rusty old sword",
    category: "weapon",
  });
});

afterAll(async () => {
  await cleanupTestData();
});

describe("CorpseService", () => {
  beforeEach(async () => {
    // Only delete our specific test data, not all data
    // First get all corpses for our test players
    const testCorpses = await db
      .select({ id: corpses.id })
      .from(corpses)
      .where(eq(corpses.roomId, testRoomId));
    for (const corpse of testCorpses) {
      await db
        .delete(corpseInventory)
        .where(eq(corpseInventory.corpseId, corpse.id));
    }
    await db.delete(corpses).where(eq(corpses.roomId, testRoomId));
    await db
      .delete(playerInventory)
      .where(eq(playerInventory.playerId, testPlayerId));
    await db
      .delete(playerInventory)
      .where(eq(playerInventory.playerId, testPlayerId2));
    await db.delete(players).where(eq(players.id, testPlayerId));
    await db.delete(players).where(eq(players.id, testPlayerId2));

    await db.insert(players).values([
      {
        id: testPlayerId,
        userId: testUserId,
        name: "CorpseTestDjim",
        currentRoomId: testRoomId,
        isOnline: true,
        createdAt: new Date(),
      },
      {
        id: testPlayerId2,
        userId: testUserId2,
        name: "CorpseTestBob",
        currentRoomId: testRoomId,
        isOnline: true,
        createdAt: new Date(),
      },
    ]);
  });

  describe("findCorpseInRoom", () => {
    it("should return error when no corpses in room", async () => {
      const result = await CorpseService.findCorpseInRoom(testRoomId, "corpse");

      expect(result.found).toBe(false);
      if (!result.found) {
        expect(result.error).toContain("no corpses");
      }
    });

    it("should find single corpse with 'corpse'", async () => {
      const corpseId = await CorpseService.createCorpse(
        testPlayerId,
        testRoomId,
      );

      const result = await CorpseService.findCorpseInRoom(testRoomId, "corpse");

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.corpse.id).toBe(corpseId);
        expect(result.corpse.playerName).toBe("CorpseTestDjim");
      }
    });

    it("should find corpse with 'corpse of X'", async () => {
      await CorpseService.createCorpse(testPlayerId, testRoomId);

      const result = await CorpseService.findCorpseInRoom(
        testRoomId,
        "corpse of corpsetestdjim",
      );

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.corpse.playerName).toBe("CorpseTestDjim");
      }
    });

    it("should return first corpse when multiple have same player name", async () => {
      // Create two corpses for same player
      const firstCorpseId = await CorpseService.createCorpse(
        testPlayerId,
        testRoomId,
      );
      await CorpseService.createCorpse(testPlayerId, testRoomId);

      const result = await CorpseService.findCorpseInRoom(testRoomId, "corpse");

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.corpse.id).toBe(firstCorpseId);
      }
    });

    it("should ask for disambiguation when corpses have different player names", async () => {
      await CorpseService.createCorpse(testPlayerId, testRoomId);
      await CorpseService.createCorpse(testPlayerId2, testRoomId);

      const result = await CorpseService.findCorpseInRoom(testRoomId, "corpse");

      expect(result.found).toBe(false);
      if (!result.found) {
        expect(result.error).toContain("Which corpse?");
        expect(result.error).toContain("CorpseTestDjim");
        expect(result.error).toContain("CorpseTestBob");
      }
    });

    it("should find specific corpse when disambiguating with 'corpse of X'", async () => {
      await CorpseService.createCorpse(testPlayerId, testRoomId);
      const bobCorpseId = await CorpseService.createCorpse(
        testPlayerId2,
        testRoomId,
      );

      const result = await CorpseService.findCorpseInRoom(
        testRoomId,
        "corpse of corpsetestbob",
      );

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.corpse.id).toBe(bobCorpseId);
        expect(result.corpse.playerName).toBe("CorpseTestBob");
      }
    });

    it("should return error for non-existent player corpse", async () => {
      await CorpseService.createCorpse(testPlayerId, testRoomId);

      const result = await CorpseService.findCorpseInRoom(
        testRoomId,
        "corpse of alice",
      );

      expect(result.found).toBe(false);
      if (!result.found) {
        expect(result.error).toContain("no corpse of");
      }
    });

    it("should return error for unrecognized target", async () => {
      await CorpseService.createCorpse(testPlayerId, testRoomId);

      const result = await CorpseService.findCorpseInRoom(
        testRoomId,
        "dead body",
      );

      expect(result.found).toBe(false);
      if (!result.found) {
        expect(result.error).toContain("don't see");
      }
    });
  });

  describe("lootItemByName with fuzzy matching", () => {
    it("should find item by word match", async () => {
      const corpseId = await CorpseService.createCorpse(
        testPlayerId,
        testRoomId,
      );
      await db.insert(corpseInventory).values({
        id: "ci-fuzzy-test",
        corpseId,
        itemId: testItemId,
        quantity: 1,
      });

      const corpse = await CorpseService.getCorpseWithInventory(corpseId);
      expect(corpse).not.toBeNull();

      // "sword" should match "rusty sword"
      const result = await CorpseService.lootItemByName(
        testPlayerId,
        corpse!,
        "sword",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("rusty sword");
    });

    it("should delete corpse after looting all items with multiple item types", async () => {
      // Create second and third items for this test
      const itemId2 = "test-item-corpse-coin";
      const itemId3 = "test-item-corpse-rock";
      await db.insert(items).values([
        {
          id: itemId2,
          name: "gold coin",
          pluralName: "gold coins",
          description: "A shiny gold coin",
          category: "currency",
        },
        {
          id: itemId3,
          name: "small rock",
          pluralName: "small rocks",
          description: "A small rock",
          category: "misc",
        },
      ]);

      const corpseId = await CorpseService.createCorpse(
        testPlayerId,
        testRoomId,
      );

      // Add 3 different item types to corpse
      await db.insert(corpseInventory).values([
        { id: "ci-multi-1", corpseId, itemId: testItemId, quantity: 1 },
        { id: "ci-multi-2", corpseId, itemId: itemId2, quantity: 3 },
        { id: "ci-multi-3", corpseId, itemId: itemId3, quantity: 5 },
      ]);

      const corpse = await CorpseService.getCorpseWithInventory(corpseId);
      expect(corpse).not.toBeNull();
      expect(corpse!.inventory).toHaveLength(3);

      // Loot all items
      const result = await CorpseService.lootItemByName(
        testPlayerId,
        corpse!,
        "all",
      );

      expect(result.success).toBe(true);

      // Verify corpse is deleted
      const corpseAfter = await CorpseService.getCorpseWithInventory(corpseId);
      expect(corpseAfter).toBeNull();

      // Cleanup
      await db
        .delete(playerInventory)
        .where(eq(playerInventory.itemId, itemId2));
      await db
        .delete(playerInventory)
        .where(eq(playerInventory.itemId, itemId3));
      await db.delete(items).where(eq(items.id, itemId2));
      await db.delete(items).where(eq(items.id, itemId3));
    });

    it("should return corpseDeleted info when corpse is emptied", async () => {
      const corpseId = await CorpseService.createCorpse(
        testPlayerId,
        testRoomId,
      );
      await db.insert(corpseInventory).values({
        id: "ci-delete-info-test",
        corpseId,
        itemId: testItemId,
        quantity: 1,
      });

      const corpse = await CorpseService.getCorpseWithInventory(corpseId);
      expect(corpse).not.toBeNull();

      const result = await CorpseService.lootItemByName(
        testPlayerId,
        corpse!,
        "all",
      );

      expect(result.success).toBe(true);
      expect(result.corpseDeleted).toBeDefined();
      expect(result.corpseDeleted?.playerName).toBe("CorpseTestDjim");
      expect(result.corpseDeleted?.roomId).toBe(testRoomId);
    });

    it("should take all items when using plural form", async () => {
      const coinItemId = "test-item-plural-coin";
      await db.insert(items).values({
        id: coinItemId,
        name: "gold coin",
        pluralName: "gold coins",
        description: "A shiny gold coin",
        category: "currency",
      });

      const corpseId = await CorpseService.createCorpse(
        testPlayerId,
        testRoomId,
      );
      await db.insert(corpseInventory).values({
        id: "ci-plural-test",
        corpseId,
        itemId: coinItemId,
        quantity: 5,
      });

      const corpse = await CorpseService.getCorpseWithInventory(corpseId);
      expect(corpse).not.toBeNull();

      // "coins" (plural) should take all 5
      const result = await CorpseService.lootItemByName(
        testPlayerId,
        corpse!,
        "coins",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("5");
      expect(result.message).toContain("gold coins");

      // Verify player got all 5
      const playerItems = await db
        .select()
        .from(playerInventory)
        .where(eq(playerInventory.itemId, coinItemId))
        .get();
      expect(playerItems?.quantity).toBe(5);

      // Cleanup
      await db
        .delete(playerInventory)
        .where(eq(playerInventory.itemId, coinItemId));
      await db.delete(items).where(eq(items.id, coinItemId));
    });

    it("should take only 1 item when using singular form", async () => {
      const coinItemId = "test-item-singular-coin";
      await db.insert(items).values({
        id: coinItemId,
        name: "gold coin",
        pluralName: "gold coins",
        description: "A shiny gold coin",
        category: "currency",
      });

      const corpseId = await CorpseService.createCorpse(
        testPlayerId,
        testRoomId,
      );
      await db.insert(corpseInventory).values({
        id: "ci-singular-test",
        corpseId,
        itemId: coinItemId,
        quantity: 5,
      });

      const corpse = await CorpseService.getCorpseWithInventory(corpseId);
      expect(corpse).not.toBeNull();

      // "coin" (singular) should take only 1
      const result = await CorpseService.lootItemByName(
        testPlayerId,
        corpse!,
        "coin",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("gold coin");
      expect(result.message).not.toContain("5");

      // Verify player got only 1
      const playerItems = await db
        .select()
        .from(playerInventory)
        .where(eq(playerInventory.itemId, coinItemId))
        .get();
      expect(playerItems?.quantity).toBe(1);

      // Cleanup
      await db
        .delete(playerInventory)
        .where(eq(playerInventory.itemId, coinItemId));
      await db
        .delete(corpseInventory)
        .where(eq(corpseInventory.corpseId, corpseId));
      await db.delete(corpses).where(eq(corpses.id, corpseId));
      await db.delete(items).where(eq(items.id, coinItemId));
    });
  });

  describe("createCorpse", () => {
    it("should set expiresAt to 24 hours after creation", async () => {
      const beforeCreate = new Date();
      const corpseId = await CorpseService.createCorpse(
        testPlayerId,
        testRoomId,
      );
      const afterCreate = new Date();

      const corpseRecord = await db
        .select()
        .from(corpses)
        .where(eq(corpses.id, corpseId))
        .get();

      expect(corpseRecord).not.toBeNull();
      expect(corpseRecord!.expiresAt).toBeDefined();

      // expiresAt should be ~24 hours after createdAt
      const expectedExpiry = new Date(
        corpseRecord!.createdAt.getTime() + 24 * 60 * 60 * 1000,
      );
      expect(corpseRecord!.expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });
  });

  describe("cleanupExpiredCorpses", () => {
    it("should delete expired corpses and return their info", async () => {
      // Create a corpse with expired timestamp
      const corpseId = "expired-corpse-test";
      const pastDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      await db.insert(corpses).values({
        id: corpseId,
        playerId: testPlayerId,
        roomId: testRoomId,
        createdAt: pastDate,
        unlocksAt: pastDate,
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      });

      // Add some items to the corpse
      await db.insert(corpseInventory).values({
        id: "ci-expired-test",
        corpseId,
        itemId: testItemId,
        quantity: 1,
      });

      const result = await CorpseService.cleanupExpiredCorpses();

      expect(result).toHaveLength(1);
      expect(result[0].playerName).toBe("CorpseTestDjim");
      expect(result[0].roomId).toBe(testRoomId);

      // Verify corpse is deleted
      const corpseAfter = await db
        .select()
        .from(corpses)
        .where(eq(corpses.id, corpseId))
        .get();
      expect(corpseAfter).toBeUndefined();

      // Verify inventory is deleted
      const inventoryAfter = await db
        .select()
        .from(corpseInventory)
        .where(eq(corpseInventory.corpseId, corpseId));
      expect(inventoryAfter).toHaveLength(0);
    });

    it("should not delete non-expired corpses", async () => {
      const corpseId = await CorpseService.createCorpse(
        testPlayerId,
        testRoomId,
      );

      const result = await CorpseService.cleanupExpiredCorpses();

      expect(result).toHaveLength(0);

      // Verify corpse still exists
      const corpseAfter = await db
        .select()
        .from(corpses)
        .where(eq(corpses.id, corpseId))
        .get();
      expect(corpseAfter).toBeDefined();
    });
  });
});
