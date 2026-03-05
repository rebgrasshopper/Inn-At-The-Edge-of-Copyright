import { test } from "@fast-check/vitest";
import { randomUUID } from "crypto";
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
  playerFeats,
  playerInventory,
  players as playersTable,
  roomInventory,
  rooms,
  users,
} from "../../src/db/schema.js";
import * as RoomService from "../../src/services/RoomService.js";
import type { Direction } from "../../src/types/room.js";
import {
  directionArb,
  exitsWithBlockedArb,
} from "../generators/room.generator.js";

// Dummy usage to prevent auto-removal of playerFeats import
const _playerFeatsTable = playerFeats;

const DIRECTIONS: Direction[] = [
  "north",
  "south",
  "east",
  "west",
  "up",
  "down",
];

let testUserId: string;

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
  await db.delete(playersTable);
  await db.delete(monsters);
  await db.delete(items);
  await db.delete(rooms);
  await db.delete(users);
}

beforeAll(async () => {
  await cleanupTestData();

  testUserId = randomUUID();
  await db.insert(users).values({
    id: testUserId,
    username: `proptest_room_${randomUUID().slice(0, 8)}`,
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });
});

afterAll(async () => {
  await cleanupTestData();
});

describe("Room Property Tests", () => {
  /**
   * Feature: mud-game-rebuild, Property 8: Room Contents Completeness
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any room with entities (players, items, monsters, NPCs, containers, features),
   * getRoomWithContents SHALL return all non-hidden entities of each type.
   */
  describe("Property 8: Room Contents Completeness", () => {
    test.prop(
      [
        fc.integer({ min: 0, max: 3 }), // player count
        fc.integer({ min: 0, max: 3 }), // item count
        fc.integer({ min: 0, max: 2 }), // monster count
        fc.integer({ min: 0, max: 2 }), // npc count
        fc.integer({ min: 0, max: 2 }), // container count (visible)
        fc.integer({ min: 0, max: 2 }), // feature count (visible)
      ],
      { numRuns: 20 },
    )(
      "getRoomWithContents returns all non-hidden entities",
      async (
        playerCount,
        itemCount,
        monsterCount,
        npcCount,
        containerCount,
        featureCount,
      ) => {
        const roomId = `prop8-room-${randomUUID().slice(0, 8)}`;

        // Create room
        await db.insert(rooms).values({
          id: roomId,
          name: "Property Test Room",
          description: "A room for property testing",
          region: "proptest",
          exits: {},
        });

        // Create items if needed
        const itemIds: string[] = [];
        for (let i = 0; i < itemCount; i++) {
          const itemId = `prop8-item-${randomUUID().slice(0, 8)}`;
          itemIds.push(itemId);
          await db.insert(items).values({
            id: itemId,
            name: `test item ${i}`,
            description: "A test item",
          });
          await db.insert(roomInventory).values({
            id: randomUUID(),
            roomId,
            itemId,
            quantity: 1,
          });
        }

        // Create monster definition and instances
        const monsterDefId = `prop8-monster-def-${randomUUID().slice(0, 8)}`;
        if (monsterCount > 0) {
          await db.insert(monsters).values({
            id: monsterDefId,
            name: "test monster",
            description: "A test monster",
            maxHp: 10,
            xpReward: 10,
          });
        }
        for (let i = 0; i < monsterCount; i++) {
          await db.insert(monsterInstances).values({
            id: randomUUID(),
            monsterId: monsterDefId,
            roomId,
            currentHp: 10,
            spawnedAt: new Date(),
          });
        }

        // Create NPCs
        for (let i = 0; i < npcCount; i++) {
          await db.insert(npcs).values({
            id: `prop8-npc-${randomUUID().slice(0, 8)}`,
            name: `test npc ${i}`,
            description: "A test NPC",
            roomId,
          });
        }

        // Create visible containers
        for (let i = 0; i < containerCount; i++) {
          await db.insert(containers).values({
            id: `prop8-container-${randomUUID().slice(0, 8)}`,
            roomId,
            name: `test container ${i}`,
            description: "A test container",
            isHidden: false,
          });
        }

        // Create visible features
        for (let i = 0; i < featureCount; i++) {
          await db.insert(features).values({
            id: `prop8-feature-${randomUUID().slice(0, 8)}`,
            roomId,
            name: `test feature ${i}`,
            description: "A test feature",
            triggerVerbs: ["test"],
            triggerTarget: "feature",
            isHidden: false,
            isDiscovered: false,
          });
        }

        // Create online players
        for (let i = 0; i < playerCount; i++) {
          await db.insert(playersTable).values({
            id: `prop8-player-${randomUUID().slice(0, 8)}`,
            userId: testUserId,
            name: `PropPlayer${randomUUID().slice(0, 6)}`,
            currentRoomId: roomId,
            isOnline: true,
            createdAt: new Date(),
          });
        }

        // Get room with contents
        const room = await RoomService.getRoomWithContents(roomId);

        // Verify counts match
        expect(room).not.toBeNull();
        expect(room!.players).toHaveLength(playerCount);
        expect(room!.items).toHaveLength(itemCount);
        expect(room!.monsters).toHaveLength(monsterCount);
        expect(room!.npcs).toHaveLength(npcCount);
        expect(room!.containers).toHaveLength(containerCount);
        expect(room!.features).toHaveLength(featureCount);

        // Cleanup
        await cleanupTestData();
        await db.insert(users).values({
          id: testUserId,
          username: `proptest_room_${randomUUID().slice(0, 8)}`,
          passwordHash: "hashedpassword",
          createdAt: new Date(),
        });
      },
    );
  });

  /**
   * Feature: mud-game-rebuild, Property 9: Movement Validity
   * **Validates: Requirements 3.3, 3.4**
   *
   * For any player movement attempt, movePlayer SHALL succeed if and only if
   * the exit exists in that direction AND is not blocked.
   */
  describe("Property 9: Movement Validity", () => {
    test.prop([exitsWithBlockedArb, directionArb], { numRuns: 20 })(
      "movePlayer succeeds iff exit exists and is not blocked",
      async (exits, attemptedDirection) => {
        const room1Id = `prop9-room1-${randomUUID().slice(0, 8)}`;
        const room2Id = `prop9-room2-${randomUUID().slice(0, 8)}`;
        const playerId = `prop9-player-${randomUUID().slice(0, 8)}`;

        // Create destination room
        await db.insert(rooms).values({
          id: room2Id,
          name: "Destination Room",
          description: "A destination room",
          region: "proptest",
          exits: {},
        });

        // Ensure any exit roomIds point to our destination room
        const normalizedExits = { ...exits };
        for (const dir of Object.keys(normalizedExits) as Direction[]) {
          normalizedExits[dir] = {
            ...normalizedExits[dir]!,
            roomId: room2Id,
          };
        }

        // Create source room with exits
        await db.insert(rooms).values({
          id: room1Id,
          name: "Source Room",
          description: "A source room",
          region: "proptest",
          exits: normalizedExits,
        });

        // Create player in source room
        await db.insert(playersTable).values({
          id: playerId,
          userId: testUserId,
          name: `PropMover${randomUUID().slice(0, 6)}`,
          currentRoomId: room1Id,
          isOnline: true,
          createdAt: new Date(),
        });

        // Attempt move
        const result = await RoomService.movePlayer(
          playerId,
          attemptedDirection,
        );

        // Determine expected outcome
        const exit = normalizedExits[attemptedDirection];
        const exitExists = exit !== undefined;
        const exitBlocked = exit?.blocked === true;
        const shouldSucceed = exitExists && !exitBlocked;

        // Verify outcome matches expectation
        expect(result.success).toBe(shouldSucceed);

        if (shouldSucceed) {
          expect(result.room).not.toBeNull();
          expect(result.room!.id).toBe(room2Id);
        } else if (!exitExists) {
          expect(result.error).toBe("There's no exit in that direction.");
        } else if (exitBlocked) {
          expect(result.error).toBe("The way is blocked.");
        }

        // Cleanup
        await cleanupTestData();
        await db.insert(users).values({
          id: testUserId,
          username: `proptest_room_${randomUUID().slice(0, 8)}`,
          passwordHash: "hashedpassword",
          createdAt: new Date(),
        });
      },
    );
  });
});
