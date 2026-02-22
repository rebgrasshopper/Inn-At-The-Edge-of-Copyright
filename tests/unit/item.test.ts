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
  playerInventory,
  players,
  roomInventory,
  rooms,
  users,
} from "../../src/db/schema.js";
import * as ItemService from "../../src/services/ItemService.js";

const testUserId = "test-user-item";
const testPlayerId = "test-player-item";
const testPlayer2Id = "test-player-item-2";
const testRoomId = "test-room-item";

async function cleanupTestData() {
  await db.delete(containerInventory);
  await db.delete(monsterInstances);
  await db.delete(monsterSpawns);
  await db.delete(roomInventory);
  await db.delete(playerInventory);
  await db.delete(features);
  await db.delete(containers);
  await db.delete(npcs);
  await db.delete(players);
  await db.delete(monsters);
  await db.delete(items);
  await db.delete(rooms);
  await db.delete(users);
}

beforeAll(async () => {
  await cleanupTestData();

  // Create test user
  await db.insert(users).values({
    id: testUserId,
    username: "itemtestuser",
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });

  // Create test room
  await db.insert(rooms).values({
    id: testRoomId,
    name: "Item Test Room",
    description: "A room for testing items",
    region: "testregion",
    exits: {},
  });

  // Create test items
  await db.insert(items).values([
    {
      id: "item-test-sword",
      name: "test sword",
      pluralName: "test swords",
      description: "A sword for testing",
      category: "weapon",
      isBulk: false,
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d6",
      weaponType: "slashing",
      strEffect: 2,
    },
    {
      id: "item-test-coin",
      name: "gold coin",
      pluralName: "gold coins",
      description: "Shiny gold coins",
      category: "currency",
      isBulk: true,
    },
    {
      id: "item-test-potion",
      name: "healing potion",
      pluralName: "healing potions",
      description: "A red potion that heals",
      category: "consumable",
      isBulk: false,
      hpEffect: 10,
    },
  ]);

  // Create a container
  await db.insert(containers).values({
    id: "container-test-chest",
    roomId: testRoomId,
    name: "wooden chest",
    description: "A simple wooden chest",
    isHidden: false,
    isOpen: false,
  });
});

afterAll(async () => {
  await cleanupTestData();
});

describe("ItemService", () => {
  beforeEach(async () => {
    // Clean up inventory tables before each test
    await db.delete(containerInventory);
    await db.delete(roomInventory);
    await db.delete(playerInventory);
    await db.delete(players);

    // Create test players
    await db.insert(players).values([
      {
        id: testPlayerId,
        userId: testUserId,
        name: "ItemTester",
        currentRoomId: testRoomId,
        isOnline: true,
        createdAt: new Date(),
      },
      {
        id: testPlayer2Id,
        userId: testUserId,
        name: "ItemReceiver",
        currentRoomId: testRoomId,
        isOnline: true,
        createdAt: new Date(),
      },
    ]);
  });

  describe("getItem", () => {
    it("should pick up an item from the room", async () => {
      // Place item in room
      await db.insert(roomInventory).values({
        id: "ri-1",
        roomId: testRoomId,
        itemId: "item-test-sword",
        quantity: 1,
      });

      const result = await ItemService.getItem(
        testPlayerId,
        testRoomId,
        "test sword",
      );

      expect(result.success).toBe(true);
      expect(result.item?.name).toBe("test sword");
      expect(result.quantity).toBe(1);
      expect(result.message).toContain("pick up");

      // Verify item is in player inventory
      const inventory = await ItemService.getInventory(testPlayerId);
      expect(inventory).toHaveLength(1);
      expect(inventory[0].item.name).toBe("test sword");
    });

    it("should pick up all when using plural form for bulk items", async () => {
      await db.insert(roomInventory).values({
        id: "ri-2",
        roomId: testRoomId,
        itemId: "item-test-coin",
        quantity: 10,
      });

      const result = await ItemService.getItem(
        testPlayerId,
        testRoomId,
        "gold coins", // plural form
      );

      expect(result.success).toBe(true);
      expect(result.quantity).toBe(10);
      expect(result.message).toContain("10");
    });

    it("should pick up only 1 non-bulk item by default", async () => {
      await db.insert(roomInventory).values({
        id: "ri-3",
        roomId: testRoomId,
        itemId: "item-test-potion",
        quantity: 5,
      });

      const result = await ItemService.getItem(
        testPlayerId,
        testRoomId,
        "healing potion",
      );

      expect(result.success).toBe(true);
      expect(result.quantity).toBe(1);

      // Verify 4 remain in room
      const roomItems = await db
        .select()
        .from(roomInventory)
        .where(eq(roomInventory.roomId, testRoomId));
      expect(roomItems[0].quantity).toBe(4);
    });

    it("should fail if requesting more than available", async () => {
      await db.insert(roomInventory).values({
        id: "ri-4",
        roomId: testRoomId,
        itemId: "item-test-coin",
        quantity: 3,
      });

      const result = await ItemService.getItem(
        testPlayerId,
        testRoomId,
        "gold coin",
        5,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("only 3");
    });

    it("should fail if item not in room", async () => {
      const result = await ItemService.getItem(
        testPlayerId,
        testRoomId,
        "nonexistent",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("don't see");
    });

    it("should match items by prefix", async () => {
      await db.insert(roomInventory).values({
        id: "ri-5",
        roomId: testRoomId,
        itemId: "item-test-sword",
        quantity: 1,
      });

      const result = await ItemService.getItem(
        testPlayerId,
        testRoomId,
        "test",
      );

      expect(result.success).toBe(true);
      expect(result.item?.name).toBe("test sword");
    });

    it("should match items by word in name", async () => {
      await db.insert(roomInventory).values({
        id: "ri-word-1",
        roomId: testRoomId,
        itemId: "item-test-potion",
        quantity: 1,
      });

      // "potion" should match "healing potion"
      const result = await ItemService.getItem(
        testPlayerId,
        testRoomId,
        "potion",
      );

      expect(result.success).toBe(true);
      expect(result.item?.name).toBe("healing potion");
    });

    it("should take 1 when using singular form", async () => {
      await db.insert(roomInventory).values({
        id: "ri-singular",
        roomId: testRoomId,
        itemId: "item-test-coin",
        quantity: 10,
      });

      // "coin" (singular) should take only 1
      const result = await ItemService.getItem(
        testPlayerId,
        testRoomId,
        "coin",
      );

      expect(result.success).toBe(true);
      expect(result.quantity).toBe(1);

      // Verify 9 remain in room
      const roomItems = await db
        .select()
        .from(roomInventory)
        .where(eq(roomInventory.roomId, testRoomId));
      expect(roomItems[0].quantity).toBe(9);
    });

    it("should take all when using plural form", async () => {
      await db.insert(roomInventory).values({
        id: "ri-plural",
        roomId: testRoomId,
        itemId: "item-test-coin",
        quantity: 10,
      });

      // "coins" (plural) should take all
      const result = await ItemService.getItem(
        testPlayerId,
        testRoomId,
        "coins",
      );

      expect(result.success).toBe(true);
      expect(result.quantity).toBe(10);

      // Verify none remain in room
      const roomItems = await db
        .select()
        .from(roomInventory)
        .where(eq(roomInventory.roomId, testRoomId));
      expect(roomItems).toHaveLength(0);
    });
  });

  describe("dropItem", () => {
    it("should drop an item from inventory to room", async () => {
      // Give player an item
      await db.insert(playerInventory).values({
        id: "pi-1",
        playerId: testPlayerId,
        itemId: "item-test-sword",
        quantity: 1,
      });

      const result = await ItemService.dropItem(
        testPlayerId,
        testRoomId,
        "test sword",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("drop");

      // Verify item is in room
      const roomItems = await db
        .select()
        .from(roomInventory)
        .where(eq(roomInventory.roomId, testRoomId));
      expect(roomItems).toHaveLength(1);
      expect(roomItems[0].itemId).toBe("item-test-sword");
    });

    it("should fail if player doesn't have the item", async () => {
      const result = await ItemService.dropItem(
        testPlayerId,
        testRoomId,
        "test sword",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("don't have");
    });
  });

  describe("examineItem", () => {
    it("should return item description from room", async () => {
      await db.insert(roomInventory).values({
        id: "ri-6",
        roomId: testRoomId,
        itemId: "item-test-sword",
        quantity: 1,
      });

      const result = await ItemService.examineItem(
        testPlayerId,
        testRoomId,
        "test sword",
      );

      expect(result.success).toBe(true);
      expect(result.description).toContain("sword for testing");
    });

    it("should include stats for own items", async () => {
      await db.insert(playerInventory).values({
        id: "pi-2",
        playerId: testPlayerId,
        itemId: "item-test-sword",
        quantity: 1,
      });

      const result = await ItemService.examineItem(
        testPlayerId,
        testRoomId,
        "test sword",
        true, // searchOwn
      );

      expect(result.success).toBe(true);
      expect(result.description).toContain("+2 STR");
      expect(result.description).toContain("1d6");
    });

    it("should not include stats for room items", async () => {
      await db.insert(roomInventory).values({
        id: "ri-7",
        roomId: testRoomId,
        itemId: "item-test-sword",
        quantity: 1,
      });

      const result = await ItemService.examineItem(
        testPlayerId,
        testRoomId,
        "test sword",
      );

      expect(result.success).toBe(true);
      expect(result.description).not.toContain("+2 STR");
    });

    it("should fail if item not found", async () => {
      const result = await ItemService.examineItem(
        testPlayerId,
        testRoomId,
        "nonexistent",
      );

      expect(result.success).toBe(false);
      expect(result.description).toContain("don't see");
    });
  });

  describe("getInventory", () => {
    it("should return empty array for empty inventory", async () => {
      const inventory = await ItemService.getInventory(testPlayerId);
      expect(inventory).toHaveLength(0);
    });

    it("should return all items in inventory", async () => {
      await db.insert(playerInventory).values([
        {
          id: "pi-3",
          playerId: testPlayerId,
          itemId: "item-test-sword",
          quantity: 1,
        },
        {
          id: "pi-4",
          playerId: testPlayerId,
          itemId: "item-test-coin",
          quantity: 50,
        },
      ]);

      const inventory = await ItemService.getInventory(testPlayerId);

      expect(inventory).toHaveLength(2);
      expect(
        inventory.find((i) => i.item.name === "test sword")?.quantity,
      ).toBe(1);
      expect(inventory.find((i) => i.item.name === "gold coin")?.quantity).toBe(
        50,
      );
    });
  });

  describe("getItemFromContainer", () => {
    it("should get item from open container", async () => {
      // Open the chest
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, "container-test-chest"));

      // Put item in chest
      await db.insert(containerInventory).values({
        id: "ci-1",
        containerId: "container-test-chest",
        itemId: "item-test-potion",
        quantity: 2,
      });

      const result = await ItemService.getItemFromContainer(
        testPlayerId,
        testRoomId,
        "healing potion",
        "wooden chest",
      );

      expect(result.success).toBe(true);
      expect(result.item?.name).toBe("healing potion");
      expect(result.message).toContain("from the wooden chest");
    });

    it("should fail if container is closed", async () => {
      // Ensure chest is closed
      await db
        .update(containers)
        .set({ isOpen: false })
        .where(eq(containers.id, "container-test-chest"));

      await db.insert(containerInventory).values({
        id: "ci-2",
        containerId: "container-test-chest",
        itemId: "item-test-potion",
        quantity: 1,
      });

      const result = await ItemService.getItemFromContainer(
        testPlayerId,
        testRoomId,
        "healing potion",
        "wooden chest",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("closed");
    });

    it("should fail if container not found", async () => {
      const result = await ItemService.getItemFromContainer(
        testPlayerId,
        testRoomId,
        "healing potion",
        "nonexistent",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("don't see");
    });
  });

  describe("giveItem", () => {
    it("should transfer item to another player", async () => {
      await db.insert(playerInventory).values({
        id: "pi-5",
        playerId: testPlayerId,
        itemId: "item-test-sword",
        quantity: 1,
      });

      const result = await ItemService.giveItem(
        testPlayerId,
        testRoomId,
        "ItemReceiver",
        "test sword",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("give");
      expect(result.message).toContain("ItemReceiver");

      // Verify giver no longer has item
      const giverInventory = await ItemService.getInventory(testPlayerId);
      expect(giverInventory).toHaveLength(0);

      // Verify receiver has item
      const receiverInventory = await ItemService.getInventory(testPlayer2Id);
      expect(receiverInventory).toHaveLength(1);
      expect(receiverInventory[0].item.name).toBe("test sword");
    });

    it("should fail if target player not in room", async () => {
      await db.insert(playerInventory).values({
        id: "pi-6",
        playerId: testPlayerId,
        itemId: "item-test-sword",
        quantity: 1,
      });

      const result = await ItemService.giveItem(
        testPlayerId,
        testRoomId,
        "NonexistentPlayer",
        "test sword",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("no one named");
    });

    it("should fail if trying to give to self", async () => {
      await db.insert(playerInventory).values({
        id: "pi-7",
        playerId: testPlayerId,
        itemId: "item-test-sword",
        quantity: 1,
      });

      const result = await ItemService.giveItem(
        testPlayerId,
        testRoomId,
        "ItemTester",
        "test sword",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("yourself");
    });
  });
});
