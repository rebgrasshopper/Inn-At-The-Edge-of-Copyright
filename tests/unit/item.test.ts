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
  players,
  roomInventory,
  rooms,
  users,
} from "../../src/db/schema.js";
import * as ItemService from "../../src/services/items/index.js";

// Dummy usage to prevent auto-removal of playerFeats import
const _playerFeatsTable = playerFeats;

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
  await db.delete(playerFeats);
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
      size: 2, // medium
    },
    {
      id: "item-test-coin",
      name: "gold coin",
      pluralName: "gold coins",
      description: "Shiny gold coins",
      category: "currency",
      isBulk: true,
      size: 0, // tiny
    },
    {
      id: "item-test-potion",
      name: "healing potion",
      pluralName: "healing potions",
      description: "A red potion that heals",
      category: "consumable",
      isBulk: false,
      hpEffect: 10,
      size: 1, // small
    },
    {
      id: "item-test-boulder",
      name: "huge boulder",
      pluralName: "huge boulders",
      description: "A massive boulder too heavy to lift",
      category: "scenery",
      isBulk: false,
      size: 4, // huge - cannot be taken
    },
    {
      id: "item-test-greatsword",
      name: "greatsword",
      pluralName: "greatswords",
      description: "A large two-handed sword",
      category: "weapon",
      isBulk: false,
      equipSlots: ["mainHand"],
      weaponDamage: "2d6",
      weaponType: "slashing",
      size: 3, // large
    },
  ]);

  // Create containers with different sizes
  await db.insert(containers).values([
    {
      id: "container-test-chest",
      roomId: testRoomId,
      name: "wooden chest",
      description: "A simple wooden chest",
      isHidden: false,
      isOpen: false,
      size: 4 as const, // huge - can hold large items
    },
    {
      id: "container-test-pouch",
      roomId: testRoomId,
      name: "small pouch",
      description: "A tiny leather pouch",
      isHidden: false,
      isOpen: false,
      size: 2 as const, // medium - can only hold small/tiny items
    },
  ]);
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
    await db.delete(playerFeats);
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

    it("should return 'can't take that' for features", async () => {
      // Create a feature in the room
      await db.insert(features).values({
        id: "feature-test-lever",
        roomId: testRoomId,
        name: "rusty lever",
        description: "A rusty lever on the wall",
        triggerVerbs: ["pull", "push"],
        triggerTarget: "lever",
        isHidden: false,
      });

      const result = await ItemService.getItem(
        testPlayerId,
        testRoomId,
        "lever",
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("You can't take that.");
    });

    it("should return 'can't take that' for containers", async () => {
      const result = await ItemService.getItem(
        testPlayerId,
        testRoomId,
        "wooden chest",
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("You can't take that.");
    });

    it("should prioritize items over features with same name", async () => {
      // Create a feature named "lever"
      await db.insert(features).values({
        id: "feature-test-lever-2",
        roomId: testRoomId,
        name: "lever",
        description: "A lever on the wall",
        triggerVerbs: ["pull"],
        triggerTarget: "lever",
        isHidden: false,
      });

      // Also create an item named "lever" in the room
      await db.insert(items).values({
        id: "item-test-lever",
        name: "lever",
        description: "A detached lever",
        category: "misc",
        isBulk: false,
      });
      await db.insert(roomInventory).values({
        id: "ri-lever",
        roomId: testRoomId,
        itemId: "item-test-lever",
        quantity: 1,
      });

      // Should pick up the item, not fail with "can't take that"
      const result = await ItemService.getItem(
        testPlayerId,
        testRoomId,
        "lever",
      );

      expect(result.success).toBe(true);
      expect(result.item?.name).toBe("lever");
      expect(result.message).toContain("pick up");
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

  describe("size validation", () => {
    describe("getItem - huge items", () => {
      it("should prevent picking up huge items", async () => {
        await db.insert(roomInventory).values({
          id: "ri-huge-1",
          roomId: testRoomId,
          itemId: "item-test-boulder",
          quantity: 1,
        });

        const result = await ItemService.getItem(
          testPlayerId,
          testRoomId,
          "huge boulder",
        );

        expect(result.success).toBe(false);
        expect(result.message).toContain("too large to carry");
      });

      it("should allow picking up large items", async () => {
        await db.insert(roomInventory).values({
          id: "ri-large-1",
          roomId: testRoomId,
          itemId: "item-test-greatsword",
          quantity: 1,
        });

        const result = await ItemService.getItem(
          testPlayerId,
          testRoomId,
          "greatsword",
        );

        expect(result.success).toBe(true);
        expect(result.item?.name).toBe("greatsword");
      });
    });

    describe("putItemInContainer - size constraints", () => {
      it("should allow putting small items in medium container", async () => {
        // Open the pouch
        await db
          .update(containers)
          .set({ isOpen: true })
          .where(eq(containers.id, "container-test-pouch"));

        // Give player a small item (potion)
        await db.insert(playerInventory).values({
          id: "pi-size-1",
          playerId: testPlayerId,
          itemId: "item-test-potion",
          quantity: 1,
        });

        const result = await ItemService.putItemInContainer(
          testPlayerId,
          testRoomId,
          "healing potion",
          "small pouch",
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain("put");
      });

      it("should allow putting tiny items in medium container", async () => {
        await db
          .update(containers)
          .set({ isOpen: true })
          .where(eq(containers.id, "container-test-pouch"));

        await db.insert(playerInventory).values({
          id: "pi-size-2",
          playerId: testPlayerId,
          itemId: "item-test-coin",
          quantity: 5,
        });

        const result = await ItemService.putItemInContainer(
          testPlayerId,
          testRoomId,
          "gold coins",
          "small pouch",
        );

        expect(result.success).toBe(true);
      });

      it("should prevent putting medium items in medium container", async () => {
        await db
          .update(containers)
          .set({ isOpen: true })
          .where(eq(containers.id, "container-test-pouch"));

        await db.insert(playerInventory).values({
          id: "pi-size-3",
          playerId: testPlayerId,
          itemId: "item-test-sword",
          quantity: 1,
        });

        const result = await ItemService.putItemInContainer(
          testPlayerId,
          testRoomId,
          "test sword",
          "small pouch",
        );

        expect(result.success).toBe(false);
        expect(result.message).toContain("too large to fit");
        expect(result.message).toContain("medium item");
        expect(result.message).toContain("medium container");
      });

      it("should prevent putting large items in medium container", async () => {
        await db
          .update(containers)
          .set({ isOpen: true })
          .where(eq(containers.id, "container-test-pouch"));

        await db.insert(playerInventory).values({
          id: "pi-size-4",
          playerId: testPlayerId,
          itemId: "item-test-greatsword",
          quantity: 1,
        });

        const result = await ItemService.putItemInContainer(
          testPlayerId,
          testRoomId,
          "greatsword",
          "small pouch",
        );

        expect(result.success).toBe(false);
        expect(result.message).toContain("too large to fit");
      });

      it("should allow putting large items in huge container", async () => {
        await db
          .update(containers)
          .set({ isOpen: true })
          .where(eq(containers.id, "container-test-chest"));

        await db.insert(playerInventory).values({
          id: "pi-size-5",
          playerId: testPlayerId,
          itemId: "item-test-greatsword",
          quantity: 1,
        });

        const result = await ItemService.putItemInContainer(
          testPlayerId,
          testRoomId,
          "greatsword",
          "wooden chest",
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain("put");
      });
    });
  });
});
