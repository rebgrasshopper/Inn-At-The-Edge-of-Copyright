import { test } from "@fast-check/vitest";
import { eq } from "drizzle-orm";
import * as fc from "fast-check";
import { afterAll, beforeAll, describe, expect } from "vitest";
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
import { quantityArb } from "../generators/item.generator.js";

const testUserId = "test-user-item-prop";

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

  await db.insert(users).values({
    id: testUserId,
    username: "itemproptestuser",
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });
});

afterAll(async () => {
  await cleanupTestData();
});

describe("ItemService Property Tests", () => {
  /**
   * Property 13: Item Transfer Round-Trip
   * For any item in a room, getting it SHALL move it to the player's inventory
   * and remove it from the room; subsequently dropping it SHALL move it back
   * to the room and remove it from the player's inventory.
   */
  describe("Property 13: Item Transfer Round-Trip", () => {
    test.prop([quantityArb], { numRuns: 20 })(
      "getting then dropping an item returns it to the room unchanged",
      async (quantity) => {
        const roomId = `prop-room-${Date.now()}-${Math.random()}`;
        const playerId = `prop-player-${Date.now()}-${Math.random()}`;
        const itemId = `prop-item-${Date.now()}-${Math.random()}`;

        // Setup
        await db.insert(rooms).values({
          id: roomId,
          name: "Test Room",
          description: "A test room",
          region: "testregion",
          exits: {},
        });

        await db.insert(items).values({
          id: itemId,
          name: `test item ${Date.now()}`,
          description: "A test item",
          isBulk: true, // Use bulk so we get all
        });

        await db.insert(players).values({
          id: playerId,
          userId: testUserId,
          name: `Player${Date.now()}`,
          currentRoomId: roomId,
          isOnline: true,
          createdAt: new Date(),
        });

        await db.insert(roomInventory).values({
          id: `ri-${Date.now()}-${Math.random()}`,
          roomId,
          itemId,
          quantity,
        });

        try {
          // Get item from room
          const getResult = await ItemService.getItem(
            playerId,
            roomId,
            `test item`,
            "all",
          );
          expect(getResult.success).toBe(true);
          expect(getResult.quantity).toBe(quantity);

          // Verify item is in player inventory
          const inventory = await ItemService.getInventory(playerId);
          expect(inventory).toHaveLength(1);
          expect(inventory[0].quantity).toBe(quantity);

          // Verify item is NOT in room
          const roomItemsAfterGet = await db
            .select()
            .from(roomInventory)
            .where(eq(roomInventory.roomId, roomId));
          expect(roomItemsAfterGet).toHaveLength(0);

          // Drop item back to room
          const dropResult = await ItemService.dropItem(
            playerId,
            roomId,
            `test item`,
            "all",
          );
          expect(dropResult.success).toBe(true);
          expect(dropResult.quantity).toBe(quantity);

          // Verify item is back in room with same quantity
          const roomItemsAfterDrop = await db
            .select()
            .from(roomInventory)
            .where(eq(roomInventory.roomId, roomId));
          expect(roomItemsAfterDrop).toHaveLength(1);
          expect(roomItemsAfterDrop[0].quantity).toBe(quantity);

          // Verify item is NOT in player inventory
          const inventoryAfterDrop = await ItemService.getInventory(playerId);
          expect(inventoryAfterDrop).toHaveLength(0);
        } finally {
          // Cleanup
          await db
            .delete(roomInventory)
            .where(eq(roomInventory.roomId, roomId));
          await db
            .delete(playerInventory)
            .where(eq(playerInventory.playerId, playerId));
          await db.delete(players).where(eq(players.id, playerId));
          await db.delete(items).where(eq(items.id, itemId));
          await db.delete(rooms).where(eq(rooms.id, roomId));
        }
      },
    );
  });

  /**
   * Property 14: Item Examination Consistency
   * For any item (in inventory or room), examining it SHALL return the item's
   * stored description without modification.
   */
  describe("Property 14: Item Examination Consistency", () => {
    test.prop(
      [
        fc
          .string({ minLength: 10, maxLength: 200 })
          .filter((s) => s.trim().length > 0),
      ],
      { numRuns: 20 },
    )(
      "examining an item returns its stored description",
      async (description) => {
        const roomId = `prop-room-${Date.now()}-${Math.random()}`;
        const playerId = `prop-player-${Date.now()}-${Math.random()}`;
        const itemId = `prop-item-${Date.now()}-${Math.random()}`;
        const itemName = `testitem${Date.now()}`;

        // Setup
        await db.insert(rooms).values({
          id: roomId,
          name: "Test Room",
          description: "A test room",
          region: "testregion",
          exits: {},
        });

        await db.insert(items).values({
          id: itemId,
          name: itemName,
          description: description.trim(),
        });

        await db.insert(players).values({
          id: playerId,
          userId: testUserId,
          name: `Player${Date.now()}`,
          currentRoomId: roomId,
          isOnline: true,
          createdAt: new Date(),
        });

        await db.insert(roomInventory).values({
          id: `ri-${Date.now()}-${Math.random()}`,
          roomId,
          itemId,
          quantity: 1,
        });

        try {
          const result = await ItemService.examineItem(
            playerId,
            roomId,
            itemName,
          );

          expect(result.success).toBe(true);
          expect(result.description).toBe(description.trim());
        } finally {
          // Cleanup
          await db
            .delete(roomInventory)
            .where(eq(roomInventory.roomId, roomId));
          await db.delete(players).where(eq(players.id, playerId));
          await db.delete(items).where(eq(items.id, itemId));
          await db.delete(rooms).where(eq(rooms.id, roomId));
        }
      },
    );
  });

  /**
   * Property 15: Inventory Query Completeness
   * For any player, the inventory query SHALL return exactly the items in their
   * playerInventory records with correct quantities.
   */
  describe("Property 15: Inventory Query Completeness", () => {
    test.prop([fc.array(quantityArb, { minLength: 1, maxLength: 5 })], {
      numRuns: 20,
    })(
      "inventory returns all items with correct quantities",
      async (quantities) => {
        const roomId = `prop-room-${Date.now()}-${Math.random()}`;
        const playerId = `prop-player-${Date.now()}-${Math.random()}`;
        const itemIds: string[] = [];

        // Setup
        await db.insert(rooms).values({
          id: roomId,
          name: "Test Room",
          description: "A test room",
          region: "testregion",
          exits: {},
        });

        await db.insert(players).values({
          id: playerId,
          userId: testUserId,
          name: `Player${Date.now()}`,
          currentRoomId: roomId,
          isOnline: true,
          createdAt: new Date(),
        });

        // Create items and add to inventory
        for (let i = 0; i < quantities.length; i++) {
          const itemId = `prop-item-${Date.now()}-${i}-${Math.random()}`;
          itemIds.push(itemId);

          await db.insert(items).values({
            id: itemId,
            name: `item${i}${Date.now()}`,
            description: `Test item ${i}`,
          });

          await db.insert(playerInventory).values({
            id: `pi-${Date.now()}-${i}-${Math.random()}`,
            playerId,
            itemId,
            quantity: quantities[i],
          });
        }

        try {
          const inventory = await ItemService.getInventory(playerId);

          // Should have exactly the right number of items
          expect(inventory).toHaveLength(quantities.length);

          // Each item should have the correct quantity
          for (let i = 0; i < quantities.length; i++) {
            const found = inventory.find((inv) => inv.item.id === itemIds[i]);
            expect(found).toBeDefined();
            expect(found!.quantity).toBe(quantities[i]);
          }
        } finally {
          // Cleanup
          await db
            .delete(playerInventory)
            .where(eq(playerInventory.playerId, playerId));
          await db.delete(players).where(eq(players.id, playerId));
          for (const itemId of itemIds) {
            await db.delete(items).where(eq(items.id, itemId));
          }
          await db.delete(rooms).where(eq(rooms.id, roomId));
        }
      },
    );
  });
});
