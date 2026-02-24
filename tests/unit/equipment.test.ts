import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import {
  items,
  playerInventory,
  players,
  rooms,
  users,
} from "../../src/db/schema.js";
import * as ItemService from "../../src/services/items/index.js";

const testUserId = "test-user-equipment";
const testPlayerId = "test-player-equipment";
const testRoomId = "test-room-equipment";

async function cleanupTestData() {
  await db.delete(playerInventory);
  await db.delete(players);
  await db.delete(items);
  await db.delete(rooms);
  await db.delete(users);
}

beforeAll(async () => {
  await cleanupTestData();

  await db.insert(users).values({
    id: testUserId,
    username: "equipmenttestuser",
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });

  await db.insert(rooms).values({
    id: testRoomId,
    name: "Equipment Test Room",
    description: "A room for testing equipment",
    region: "testregion",
    exits: {},
  });

  await db.insert(items).values([
    {
      id: "item-test-sword",
      name: "iron sword",
      description: "A sturdy iron sword",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d8",
      strEffect: 2,
    },
    {
      id: "item-test-shield",
      name: "wooden shield",
      description: "A simple wooden shield",
      category: "armor",
      equipSlots: ["offHand"],
      conEffect: 1,
    },
    {
      id: "item-test-helmet",
      name: "iron helmet",
      description: "A protective iron helmet",
      category: "armor",
      equipSlots: ["head"],
      conEffect: 2,
    },
    {
      id: "item-test-ring",
      name: "gold ring",
      description: "A shiny gold ring",
      category: "accessory",
      equipSlots: ["ring"],
    },
    {
      id: "item-test-potion",
      name: "healing potion",
      description: "A red potion",
      category: "consumable",
      // No equipSlots - not equippable
    },
  ]);
});

afterAll(async () => {
  await cleanupTestData();
});

describe("Equipment Operations", () => {
  beforeEach(async () => {
    await db.delete(playerInventory);
    await db.delete(players);

    await db.insert(players).values({
      id: testPlayerId,
      userId: testUserId,
      name: "EquipmentTester",
      currentRoomId: testRoomId,
      isOnline: true,
      createdAt: new Date(),
    });
  });

  describe("equipItem", () => {
    it("should equip an item from inventory", async () => {
      await db.insert(playerInventory).values({
        id: "pi-sword",
        playerId: testPlayerId,
        itemId: "item-test-sword",
        quantity: 1,
      });

      const result = await ItemService.equipItem(testPlayerId, "iron sword");

      expect(result.success).toBe(true);
      expect(result.message).toContain("equip");
      expect(result.message).toContain("iron sword");

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.wornMainHand).toBe("item-test-sword");
    });

    it("should equip to specific slot when specified", async () => {
      await db.insert(playerInventory).values({
        id: "pi-sword-2",
        playerId: testPlayerId,
        itemId: "item-test-sword",
        quantity: 1,
      });

      const result = await ItemService.equipItem(
        testPlayerId,
        "iron sword",
        "offhand",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("offHand");

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.wornOffHand).toBe("item-test-sword");
    });

    it("should fail if item not in inventory", async () => {
      const result = await ItemService.equipItem(testPlayerId, "iron sword");

      expect(result.success).toBe(false);
      expect(result.message).toContain("don't have");
    });

    it("should fail if item is not equippable", async () => {
      await db.insert(playerInventory).values({
        id: "pi-potion",
        playerId: testPlayerId,
        itemId: "item-test-potion",
        quantity: 1,
      });

      const result = await ItemService.equipItem(
        testPlayerId,
        "healing potion",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("can't equip");
    });

    it("should fail if item can't go in specified slot", async () => {
      await db.insert(playerInventory).values({
        id: "pi-helmet",
        playerId: testPlayerId,
        itemId: "item-test-helmet",
        quantity: 1,
      });

      const result = await ItemService.equipItem(
        testPlayerId,
        "iron helmet",
        "mainhand",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("can't equip");
      expect(result.message).toContain("head");
    });

    it("should swap items when slot is occupied", async () => {
      // First equip a sword
      await db.insert(playerInventory).values({
        id: "pi-sword-3",
        playerId: testPlayerId,
        itemId: "item-test-sword",
        quantity: 1,
      });
      await ItemService.equipItem(testPlayerId, "iron sword");

      // Now equip a shield to offhand (sword should stay in mainhand)
      await db.insert(playerInventory).values({
        id: "pi-shield",
        playerId: testPlayerId,
        itemId: "item-test-shield",
        quantity: 1,
      });
      const result = await ItemService.equipItem(testPlayerId, "wooden shield");

      expect(result.success).toBe(true);

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.wornMainHand).toBe("item-test-sword");
      expect(player?.wornOffHand).toBe("item-test-shield");
    });

    it("should prefer empty slot when auto-selecting", async () => {
      // Equip sword to mainhand first
      await db.insert(playerInventory).values({
        id: "pi-sword-4",
        playerId: testPlayerId,
        itemId: "item-test-sword",
        quantity: 2,
      });
      await ItemService.equipItem(testPlayerId, "iron sword", "mainhand");

      // Equip another sword - should go to offhand (empty)
      const result = await ItemService.equipItem(testPlayerId, "iron sword");

      expect(result.success).toBe(true);
      expect(result.message).toContain("offHand");

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.wornMainHand).toBe("item-test-sword");
      expect(player?.wornOffHand).toBe("item-test-sword");
    });
  });

  describe("unequipItem", () => {
    beforeEach(async () => {
      // Equip a sword for unequip tests
      await db.insert(playerInventory).values({
        id: "pi-sword-unequip",
        playerId: testPlayerId,
        itemId: "item-test-sword",
        quantity: 1,
      });
      await db
        .update(players)
        .set({ wornMainHand: "item-test-sword" })
        .where(eq(players.id, testPlayerId));
    });

    it("should unequip by item name", async () => {
      const result = await ItemService.unequipItem(testPlayerId, "iron sword");

      expect(result.success).toBe(true);
      expect(result.message).toContain("unequip");
      expect(result.message).toContain("iron sword");

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.wornMainHand).toBeNull();
    });

    it("should unequip by slot name", async () => {
      const result = await ItemService.unequipItem(testPlayerId, "mainhand");

      expect(result.success).toBe(true);
      expect(result.message).toContain("unequip");

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.wornMainHand).toBeNull();
    });

    it("should fail if nothing equipped in slot", async () => {
      const result = await ItemService.unequipItem(testPlayerId, "offhand");

      expect(result.success).toBe(false);
      expect(result.message).toContain("don't have anything equipped");
    });

    it("should fail if item not equipped", async () => {
      const result = await ItemService.unequipItem(
        testPlayerId,
        "wooden shield",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("don't have");
      expect(result.message).toContain("equipped");
    });

    it("should accept slot aliases", async () => {
      const result = await ItemService.unequipItem(testPlayerId, "weapon");

      expect(result.success).toBe(true);

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.wornMainHand).toBeNull();
    });
  });

  describe("getEquipmentList", () => {
    it("should return 'nothing equipped' when empty", async () => {
      const result = await ItemService.getEquipmentList(testPlayerId);

      expect(result.success).toBe(true);
      expect(result.message).toContain("don't have anything equipped");
    });

    it("should list all equipped items", async () => {
      await db.insert(playerInventory).values([
        {
          id: "pi-sword-list",
          playerId: testPlayerId,
          itemId: "item-test-sword",
          quantity: 1,
        },
        {
          id: "pi-helmet-list",
          playerId: testPlayerId,
          itemId: "item-test-helmet",
          quantity: 1,
        },
      ]);

      await db
        .update(players)
        .set({
          wornMainHand: "item-test-sword",
          wornHead: "item-test-helmet",
        })
        .where(eq(players.id, testPlayerId));

      const result = await ItemService.getEquipmentList(testPlayerId);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Main Hand");
      expect(result.message).toContain("iron sword");
      expect(result.message).toContain("Head");
      expect(result.message).toContain("iron helmet");
    });
  });

  describe("getEquippedItems", () => {
    it("should return empty array when nothing equipped", async () => {
      const equipped = await ItemService.getPlayerEquipment(testPlayerId);

      expect(equipped).not.toBeNull();
      expect(equipped?.mainHand).toBeNull();
      expect(equipped?.head).toBeNull();
    });

    it("should return equipped item IDs", async () => {
      await db
        .update(players)
        .set({
          wornMainHand: "item-test-sword",
          wornOffHand: "item-test-shield",
        })
        .where(eq(players.id, testPlayerId));

      const equipped = await ItemService.getPlayerEquipment(testPlayerId);

      expect(equipped?.mainHand).toBe("item-test-sword");
      expect(equipped?.offHand).toBe("item-test-shield");
    });
  });
});
