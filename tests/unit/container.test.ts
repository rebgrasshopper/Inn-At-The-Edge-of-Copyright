import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import {
  containerInventory,
  containers,
  items,
  playerInventory,
  players,
  rooms,
  users,
} from "../../src/db/schema.js";
import * as ItemService from "../../src/services/items/index.js";

const testUserId = "test-user-container";
const testPlayerId = "test-player-container";
const testRoomId = "test-room-container";
const testContainerId = "test-container-chest";
const testItemId = "test-item-potion";

async function cleanupTestData() {
  await db.delete(containerInventory);
  await db.delete(playerInventory);
  await db.delete(containers);
  await db.delete(players);
  await db.delete(items);
  await db.delete(rooms);
  await db.delete(users);
}

beforeAll(async () => {
  await cleanupTestData();

  await db.insert(users).values({
    id: testUserId,
    username: "containertestuser",
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });

  await db.insert(rooms).values({
    id: testRoomId,
    name: "Container Test Room",
    description: "A room for testing containers",
    region: "testregion",
    exits: {},
  });

  await db.insert(items).values({
    id: testItemId,
    name: "healing potion",
    pluralName: "healing potions",
    description: "A red potion that heals",
    category: "consumable",
    isBulk: false,
  });
});

afterAll(async () => {
  await cleanupTestData();
});

describe("Container Operations", () => {
  beforeEach(async () => {
    await db.delete(containerInventory);
    await db.delete(playerInventory);
    await db.delete(containers);
    await db.delete(players);

    await db.insert(players).values({
      id: testPlayerId,
      userId: testUserId,
      name: "ContainerTester",
      currentRoomId: testRoomId,
      isOnline: true,
      createdAt: new Date(),
    });

    await db.insert(containers).values({
      id: testContainerId,
      roomId: testRoomId,
      name: "wooden chest",
      description: "A simple wooden chest with iron bindings.",
      isHidden: false,
      isOpen: false,
    });
  });

  describe("openContainer", () => {
    it("should open a closed container", async () => {
      const result = await ItemService.openContainer(
        testRoomId,
        "wooden chest",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("open");
      expect(result.message).toContain("wooden chest");

      const container = await db
        .select()
        .from(containers)
        .where(eq(containers.id, testContainerId))
        .get();
      expect(container?.isOpen).toBe(true);
    });

    it("should fail if container is already open", async () => {
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, testContainerId));

      const result = await ItemService.openContainer(
        testRoomId,
        "wooden chest",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("already open");
    });

    it("should fail if container not found", async () => {
      const result = await ItemService.openContainer(testRoomId, "nonexistent");

      expect(result.success).toBe(false);
      expect(result.message).toContain("don't see");
    });

    it("should match container by partial name", async () => {
      const result = await ItemService.openContainer(testRoomId, "chest");

      expect(result.success).toBe(true);
    });
  });

  describe("closeContainer", () => {
    it("should close an open container", async () => {
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, testContainerId));

      const result = await ItemService.closeContainer(
        testRoomId,
        "wooden chest",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("close");

      const container = await db
        .select()
        .from(containers)
        .where(eq(containers.id, testContainerId))
        .get();
      expect(container?.isOpen).toBe(false);
    });

    it("should fail if container is already closed", async () => {
      const result = await ItemService.closeContainer(
        testRoomId,
        "wooden chest",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("already closed");
    });

    it("should fail if container not found", async () => {
      const result = await ItemService.closeContainer(
        testRoomId,
        "nonexistent",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("don't see");
    });
  });

  describe("examineContainer", () => {
    it("should show description and 'closed' for closed container", async () => {
      const result = await ItemService.examineContainer(
        testRoomId,
        "wooden chest",
      );

      expect(result.success).toBe(true);
      expect(result.description).toContain("iron bindings");
      expect(result.description).toContain("closed");
    });

    it("should show contents when container is open", async () => {
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, testContainerId));

      await db.insert(containerInventory).values({
        id: "ci-test-1",
        containerId: testContainerId,
        itemId: testItemId,
        quantity: 3,
      });

      const result = await ItemService.examineContainer(
        testRoomId,
        "wooden chest",
      );

      expect(result.success).toBe(true);
      expect(result.description).toContain("contains");
      expect(result.description).toContain("3");
      expect(result.description).toContain("healing potions");
    });

    it("should show 'empty' for open container with no items", async () => {
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, testContainerId));

      const result = await ItemService.examineContainer(
        testRoomId,
        "wooden chest",
      );

      expect(result.success).toBe(true);
      expect(result.description).toContain("empty");
    });

    it("should fail if container not found", async () => {
      const result = await ItemService.examineContainer(
        testRoomId,
        "nonexistent",
      );

      expect(result.success).toBe(false);
    });
  });

  describe("putItemInContainer", () => {
    it("should put item from inventory into open container", async () => {
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, testContainerId));

      await db.insert(playerInventory).values({
        id: "pi-test-1",
        playerId: testPlayerId,
        itemId: testItemId,
        quantity: 5,
      });

      const result = await ItemService.putItemInContainer(
        testPlayerId,
        testRoomId,
        "healing potion",
        "wooden chest",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("put");
      expect(result.message).toContain("wooden chest");

      // Verify item is in container
      const containerItems = await db
        .select()
        .from(containerInventory)
        .where(eq(containerInventory.containerId, testContainerId));
      expect(containerItems).toHaveLength(1);
      expect(containerItems[0].quantity).toBe(1);

      // Verify item removed from player inventory
      const playerItems = await db
        .select()
        .from(playerInventory)
        .where(eq(playerInventory.playerId, testPlayerId));
      expect(playerItems[0].quantity).toBe(4);
    });

    it("should fail if container is closed", async () => {
      await db.insert(playerInventory).values({
        id: "pi-test-2",
        playerId: testPlayerId,
        itemId: testItemId,
        quantity: 1,
      });

      const result = await ItemService.putItemInContainer(
        testPlayerId,
        testRoomId,
        "healing potion",
        "wooden chest",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("closed");
    });

    it("should fail if player doesn't have the item", async () => {
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, testContainerId));

      const result = await ItemService.putItemInContainer(
        testPlayerId,
        testRoomId,
        "healing potion",
        "wooden chest",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("don't have");
    });

    it("should put multiple items with quantity", async () => {
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, testContainerId));

      await db.insert(playerInventory).values({
        id: "pi-test-3",
        playerId: testPlayerId,
        itemId: testItemId,
        quantity: 10,
      });

      const result = await ItemService.putItemInContainer(
        testPlayerId,
        testRoomId,
        "healing potion",
        "wooden chest",
        3,
      );

      expect(result.success).toBe(true);
      expect(result.quantity).toBe(3);

      const containerItems = await db
        .select()
        .from(containerInventory)
        .where(eq(containerInventory.containerId, testContainerId));
      expect(containerItems[0].quantity).toBe(3);

      const playerItems = await db
        .select()
        .from(playerInventory)
        .where(eq(playerInventory.playerId, testPlayerId));
      expect(playerItems[0].quantity).toBe(7);
    });
  });

  describe("getItemFromContainer", () => {
    it("should get item from open container", async () => {
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, testContainerId));

      await db.insert(containerInventory).values({
        id: "ci-get-1",
        containerId: testContainerId,
        itemId: testItemId,
        quantity: 3,
      });

      const result = await ItemService.getItemFromContainer(
        testPlayerId,
        testRoomId,
        "healing potion",
        "wooden chest",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("take");
      expect(result.message).toContain("healing potion");

      // Verify item is in player inventory
      const playerItems = await db
        .select()
        .from(playerInventory)
        .where(eq(playerInventory.playerId, testPlayerId));
      expect(playerItems).toHaveLength(1);
      expect(playerItems[0].quantity).toBe(1);

      // Verify item removed from container
      const containerItems = await db
        .select()
        .from(containerInventory)
        .where(eq(containerInventory.containerId, testContainerId));
      expect(containerItems[0].quantity).toBe(2);
    });

    it("should get all items from container with 'all' itemName", async () => {
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, testContainerId));

      // Add a second item type
      const secondItemId = "test-item-rock";
      await db.insert(items).values({
        id: secondItemId,
        name: "small rock",
        pluralName: "small rocks",
        description: "A small rock",
        category: "misc",
        isBulk: true,
      });

      await db.insert(containerInventory).values([
        {
          id: "ci-all-1",
          containerId: testContainerId,
          itemId: testItemId,
          quantity: 2,
        },
        {
          id: "ci-all-2",
          containerId: testContainerId,
          itemId: secondItemId,
          quantity: 5,
        },
      ]);

      const result = await ItemService.getItemFromContainer(
        testPlayerId,
        testRoomId,
        "all",
        "wooden chest",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("healing potions");
      expect(result.message).toContain("small rocks");

      // Verify all items are in player inventory
      const playerItems = await db
        .select()
        .from(playerInventory)
        .where(eq(playerInventory.playerId, testPlayerId));
      expect(playerItems).toHaveLength(2);

      // Verify container is empty
      const containerItems = await db
        .select()
        .from(containerInventory)
        .where(eq(containerInventory.containerId, testContainerId));
      expect(containerItems).toHaveLength(0);

      // Cleanup - delete player inventory first (foreign key), then item
      await db
        .delete(playerInventory)
        .where(eq(playerInventory.itemId, secondItemId));
      await db.delete(items).where(eq(items.id, secondItemId));
    });

    it("should fail to get all from empty container", async () => {
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, testContainerId));

      const result = await ItemService.getItemFromContainer(
        testPlayerId,
        testRoomId,
        "all",
        "wooden chest",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("empty");
    });

    it("should match item by word (fuzzy match)", async () => {
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, testContainerId));

      await db.insert(containerInventory).values({
        id: "ci-fuzzy-1",
        containerId: testContainerId,
        itemId: testItemId,
        quantity: 1,
      });

      // "potion" should match "healing potion"
      const result = await ItemService.getItemFromContainer(
        testPlayerId,
        testRoomId,
        "potion",
        "wooden chest",
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("healing potion");
    });

    it("should fail if container is closed", async () => {
      await db.insert(containerInventory).values({
        id: "ci-closed-1",
        containerId: testContainerId,
        itemId: testItemId,
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

    it("should fail if item not in container", async () => {
      await db
        .update(containers)
        .set({ isOpen: true })
        .where(eq(containers.id, testContainerId));

      const result = await ItemService.getItemFromContainer(
        testPlayerId,
        testRoomId,
        "nonexistent",
        "wooden chest",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("no");
    });
  });
});
