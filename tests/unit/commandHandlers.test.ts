/**
 * Tests for command handlers - specifically testing the fixes from dual-user testing.
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import {
  items,
  monsterInstances,
  playerInventory,
  players,
  roomInventory,
  rooms,
  users,
} from "../../src/db/schema.js";
import { handleSpawn } from "../../src/services/commands/handlers/admin.js";
import {
  handleEquip,
  handleExamine,
  handleGet,
  handleLoot,
} from "../../src/services/commands/handlers/items.js";
import { handleMove } from "../../src/services/commands/handlers/movement.js";
import type { CommandContext } from "../../src/types/command.js";
import type { Player } from "../../src/types/player.js";
import type { RoomWithContents } from "../../src/types/room.js";

// Test IDs
const TEST_USER_ID = "test-user-handlers";
const TEST_PLAYER_ID = "test-player-handlers";

// Use monsterInstances in cleanup to prevent import stripping
const _monsterInstancesTable = monsterInstances;
const TEST_PLAYER_2_ID = "test-player-handlers-2";
const TEST_ROOM_ID = "test-room-handlers";
const TEST_ROOM_2_ID = "test-room-handlers-2";

/**
 * Create a minimal mock socket for testing.
 */
function createMockSocket() {
  return {} as CommandContext["socket"];
}

/**
 * Create a test player object matching the Player type.
 */
function createTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: TEST_PLAYER_ID,
    userId: TEST_USER_ID,
    name: "TestPlayer",
    currentRoomId: TEST_ROOM_ID,
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    currentHp: 10,
    maxHp: 10,
    xp: 0,
    level: 1,
    unspentAttributePoints: 0,
    isOnline: true,
    equipment: {
      head: null,
      torso: null,
      body: null,
      legs: null,
      hands: null,
      feet: null,
      mainHand: null,
      offHand: null,
      neck: null,
      ring1: null,
      ring2: null,
      back: null,
    },
    discoveredFeatureIds: [],
    discoveredContainerIds: [],
    ...overrides,
  };
}

/**
 * Create a test room object matching RoomWithContents type.
 */
function createTestRoom(
  overrides: Partial<RoomWithContents> = {},
): RoomWithContents {
  return {
    id: TEST_ROOM_ID,
    name: "Test Room",
    description: "A test room",
    region: "testregion",
    exits: { north: { roomId: TEST_ROOM_2_ID } },
    players: [],
    items: [],
    monsters: [],
    npcs: [],
    containers: [],
    features: [],
    corpses: [],
    ...overrides,
  };
}

/**
 * Create a command context for testing.
 */
function createContext(
  playerOverrides: Partial<Player> = {},
  roomOverrides: Partial<RoomWithContents> = {},
): CommandContext {
  return {
    player: createTestPlayer(playerOverrides),
    room: createTestRoom(roomOverrides),
    socket: createMockSocket(),
  };
}

async function cleanupTestData() {
  // Delete in correct order to respect foreign keys
  await db
    .delete(monsterInstances)
    .where(eq(monsterInstances.roomId, TEST_ROOM_ID));
  await db.delete(roomInventory).where(eq(roomInventory.roomId, TEST_ROOM_ID));
  await db
    .delete(playerInventory)
    .where(eq(playerInventory.playerId, TEST_PLAYER_ID));
  await db
    .delete(playerInventory)
    .where(eq(playerInventory.playerId, TEST_PLAYER_2_ID));
  await db.delete(players).where(eq(players.id, TEST_PLAYER_ID));
  await db.delete(players).where(eq(players.id, TEST_PLAYER_2_ID));
  await db.delete(items).where(eq(items.id, "test-item-sword"));
  await db.delete(items).where(eq(items.id, "test-item-helmet"));
  await db.delete(items).where(eq(items.id, "test-item-helmet-2"));
  await db.delete(rooms).where(eq(rooms.id, TEST_ROOM_ID));
  await db.delete(rooms).where(eq(rooms.id, TEST_ROOM_2_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
}

beforeAll(async () => {
  await cleanupTestData();

  // Create test user (as admin for spawn tests)
  await db.insert(users).values({
    id: TEST_USER_ID,
    username: "handlertestuser",
    passwordHash: "hashedpassword",
    isAdmin: true,
    createdAt: new Date(),
  });

  // Create test rooms
  await db.insert(rooms).values([
    {
      id: TEST_ROOM_ID,
      name: "Test Room",
      description: "A test room",
      region: "testregion",
      exits: { north: { roomId: TEST_ROOM_2_ID } },
    },
    {
      id: TEST_ROOM_2_ID,
      name: "Test Room 2",
      description: "Another test room",
      region: "testregion",
      exits: { south: { roomId: TEST_ROOM_ID } },
    },
  ]);

  // Create test items
  await db.insert(items).values([
    {
      id: "test-item-sword",
      name: "iron sword",
      pluralName: "iron swords",
      description: "A sturdy iron sword",
      category: "weapon",
      equipSlots: ["mainHand", "offHand"],
      weaponDamage: "1d8",
    },
    {
      id: "test-item-helmet",
      name: "iron helmet",
      pluralName: "iron helmets",
      description: "A protective iron helmet",
      category: "armor",
      equipSlots: ["head"],
      acBonus: 2,
    },
  ]);
});

afterAll(async () => {
  await cleanupTestData();
});

describe("Command Handlers - Dual User Testing Fixes", () => {
  beforeEach(async () => {
    // Clean up inventory and players before each test
    await db
      .delete(roomInventory)
      .where(eq(roomInventory.roomId, TEST_ROOM_ID));
    await db
      .delete(playerInventory)
      .where(eq(playerInventory.playerId, TEST_PLAYER_ID));
    await db
      .delete(playerInventory)
      .where(eq(playerInventory.playerId, TEST_PLAYER_2_ID));
    await db.delete(players).where(eq(players.id, TEST_PLAYER_ID));
    await db.delete(players).where(eq(players.id, TEST_PLAYER_2_ID));

    // Create test players
    await db.insert(players).values([
      {
        id: TEST_PLAYER_ID,
        userId: TEST_USER_ID,
        name: "TestPlayer",
        currentRoomId: TEST_ROOM_ID,
        isOnline: true,
        createdAt: new Date(),
      },
      {
        id: TEST_PLAYER_2_ID,
        userId: TEST_USER_ID,
        name: "OtherPlayer",
        currentRoomId: TEST_ROOM_ID,
        isOnline: true,
        createdAt: new Date(),
      },
    ]);
  });

  describe("handleLoot", () => {
    it("should transform 'loot corpse' into 'get all from corpse'", async () => {
      // handleLoot transforms args and calls handleGet
      // Without a corpse, it should fail with appropriate message
      const context = createContext();
      const result = await handleLoot(["corpse"], context);

      // Should fail because there's no corpse, but the transformation happened
      expect(result.success).toBe(false);
      expect(result.message).toContain("corpse");
    });

    it("should return error when no target specified", async () => {
      const context = createContext();
      const result = await handleLoot([], context);

      expect(result.success).toBe(false);
      expect(result.message).toBe("What do you want to loot?");
    });
  });

  describe("handleGet - broadcast on pickup", () => {
    it("should broadcast to room when player picks up item", async () => {
      // Place item in room
      await db.insert(roomInventory).values({
        id: "ri-broadcast-test",
        roomId: TEST_ROOM_ID,
        itemId: "test-item-sword",
        quantity: 1,
      });

      const context = createContext();
      const result = await handleGet(["iron", "sword"], context);

      expect(result.success).toBe(true);
      expect(result.broadcast).toBeDefined();
      expect(result.broadcast).toHaveLength(1);
      expect(result.broadcast![0].event).toBe("chat:message");
      expect(result.broadcast![0].room).toBe(TEST_ROOM_ID);
      expect(
        (result.broadcast![0].data as { content: string }).content,
      ).toContain("TestPlayer picks up");
    });

    it("should not broadcast when pickup fails", async () => {
      const context = createContext();
      const result = await handleGet(["nonexistent"], context);

      expect(result.success).toBe(false);
      expect(result.broadcast).toBeUndefined();
    });
  });

  describe("handleExamine - self vs other player", () => {
    it("should show full stats when examining self", async () => {
      const context = createContext();
      const result = await handleExamine(["self"], context);

      expect(result.success).toBe(true);
      // Self view includes stats
      expect(result.message).toContain("STR:");
      expect(result.message).toContain("DEX:");
      expect(result.message).toContain("HP:");
      expect(result.message).toContain("XP:");
    });

    it("should show full stats when examining own name", async () => {
      const context = createContext();
      const result = await handleExamine(["TestPlayer"], context);

      expect(result.success).toBe(true);
      // Own name resolves to self view
      expect(result.message).toContain("STR:");
      expect(result.message).toContain("DEX:");
    });

    it("should show limited info when examining another player", async () => {
      const context = createContext(
        {},
        {
          players: [
            createTestPlayer({ id: TEST_PLAYER_2_ID, name: "OtherPlayer" }),
          ],
        },
      );
      const result = await handleExamine(["OtherPlayer"], context);

      expect(result.success).toBe(true);
      // Other player view should NOT include stats
      expect(result.message).not.toContain("STR:");
      expect(result.message).not.toContain("DEX:");
      expect(result.message).not.toContain("XP:");
      // Should show name and level
      expect(result.message).toContain("OtherPlayer");
      expect(result.message).toContain("Level");
    });

    it("should show equipment when examining another player", async () => {
      // Equip helmet on other player
      await db
        .update(players)
        .set({ wornHead: "test-item-helmet" })
        .where(eq(players.id, TEST_PLAYER_2_ID));

      const context = createContext(
        {},
        {
          players: [
            createTestPlayer({ id: TEST_PLAYER_2_ID, name: "OtherPlayer" }),
          ],
        },
      );
      const result = await handleExamine(["OtherPlayer"], context);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Wearing:");
      expect(result.message).toContain("iron helmet");
    });

    it("should say 'They don't have anything equipped' for unequipped other player", async () => {
      const context = createContext(
        {},
        {
          players: [
            createTestPlayer({ id: TEST_PLAYER_2_ID, name: "OtherPlayer" }),
          ],
        },
      );
      const result = await handleExamine(["OtherPlayer"], context);

      expect(result.success).toBe(true);
      expect(result.message).toContain("They don't have anything equipped");
    });

    it("should find and examine item in player inventory", async () => {
      // Give player a sword in their inventory
      await db.insert(playerInventory).values({
        id: "pi-examine-test",
        playerId: TEST_PLAYER_ID,
        itemId: "test-item-sword",
        quantity: 1,
      });

      const context = createContext();
      const result = await handleExamine(["iron", "sword"], context);

      expect(result.success).toBe(true);
      expect(result.message).toContain("iron sword");
      expect(result.message).toContain("sturdy iron sword");
    });

    it("should find item in inventory even when not in room", async () => {
      // Give player a sword in their inventory (not in room)
      await db.insert(playerInventory).values({
        id: "pi-examine-inv-only",
        playerId: TEST_PLAYER_ID,
        itemId: "test-item-sword",
        quantity: 1,
      });

      // Room has no items
      const context = createContext({}, { items: [] });
      const result = await handleExamine(["sword"], context);

      expect(result.success).toBe(true);
      expect(result.message).toContain("iron sword");
    });
  });

  describe("handleEquip - already wearing check", () => {
    it("should return 'already wearing' when equipping same item", async () => {
      // Give player a helmet and equip it
      await db.insert(playerInventory).values({
        id: "pi-helmet-test",
        playerId: TEST_PLAYER_ID,
        itemId: "test-item-helmet",
        quantity: 1,
      });
      await db
        .update(players)
        .set({ wornHead: "test-item-helmet" })
        .where(eq(players.id, TEST_PLAYER_ID));

      const context = createContext({
        equipment: {
          head: "test-item-helmet",
          torso: null,
          body: null,
          legs: null,
          hands: null,
          feet: null,
          mainHand: null,
          offHand: null,
          neck: null,
          ring1: null,
          ring2: null,
          back: null,
        },
      });
      const result = await handleEquip(["iron", "helmet"], context);

      expect(result.success).toBe(false);
      expect(result.message).toContain("already wearing");
    });

    it("should prefer unequipped item when duplicates exist", async () => {
      // Create a duplicate helmet item first
      await db.insert(items).values({
        id: "test-item-helmet-dup",
        name: "iron helmet",
        description: "A protective iron helmet (duplicate)",
        category: "armor",
        equipSlots: ["head"],
        acBonus: 2,
      });

      // Give player two helmets - one equipped, one not
      await db.insert(playerInventory).values([
        {
          id: "pi-helmet-equipped",
          playerId: TEST_PLAYER_ID,
          itemId: "test-item-helmet",
          quantity: 1,
        },
        {
          id: "pi-helmet-unequipped",
          playerId: TEST_PLAYER_ID,
          itemId: "test-item-helmet-dup",
          quantity: 1,
        },
      ]);

      // Equip the first one
      await db
        .update(players)
        .set({ wornHead: "test-item-helmet" })
        .where(eq(players.id, TEST_PLAYER_ID));

      const context = createContext({
        equipment: {
          head: "test-item-helmet",
          torso: null,
          body: null,
          legs: null,
          hands: null,
          feet: null,
          mainHand: null,
          offHand: null,
          neck: null,
          ring1: null,
          ring2: null,
          back: null,
        },
      });

      // "wear helmet" should equip the unequipped one, not say "already wearing"
      const result = await handleEquip(["iron", "helmet"], context);

      expect(result.success).toBe(true);
      expect(result.message).toContain("equip");
      expect(result.message).toContain("iron helmet");

      // Cleanup
      await db
        .delete(playerInventory)
        .where(eq(playerInventory.itemId, "test-item-helmet-dup"));
      await db.delete(items).where(eq(items.id, "test-item-helmet-dup"));
    });

    it("should allow equipping different item to same slot", async () => {
      // Give player two helmets
      await db.insert(items).values({
        id: "test-item-helmet-2",
        name: "steel helmet",
        description: "A steel helmet",
        category: "armor",
        equipSlots: ["head"],
        acBonus: 3,
      });
      await db.insert(playerInventory).values([
        {
          id: "pi-helmet-1",
          playerId: TEST_PLAYER_ID,
          itemId: "test-item-helmet",
          quantity: 1,
        },
        {
          id: "pi-helmet-2",
          playerId: TEST_PLAYER_ID,
          itemId: "test-item-helmet-2",
          quantity: 1,
        },
      ]);
      await db
        .update(players)
        .set({ wornHead: "test-item-helmet" })
        .where(eq(players.id, TEST_PLAYER_ID));

      const context = createContext({
        equipment: {
          head: "test-item-helmet",
          torso: null,
          body: null,
          legs: null,
          hands: null,
          feet: null,
          mainHand: null,
          offHand: null,
          neck: null,
          ring1: null,
          ring2: null,
          back: null,
        },
      });
      const result = await handleEquip(["steel", "helmet"], context);

      expect(result.success).toBe(true);
      expect(result.message).toContain("equip");
      expect(result.message).toContain("steel helmet");

      // Cleanup - delete inventory first, then item
      await db
        .delete(playerInventory)
        .where(eq(playerInventory.itemId, "test-item-helmet-2"));
      await db.delete(items).where(eq(items.id, "test-item-helmet-2"));
    });
  });

  describe("handleMove - direction in broadcast", () => {
    it("should include direction in room:leave broadcast", async () => {
      const context = createContext();
      const result = await handleMove(["north"], context, "north");

      expect(result.success).toBe(true);
      expect(result.broadcast).toBeDefined();

      // Find the room:leave broadcast
      const leaveBroadcast = result.broadcast?.find(
        (b) => b.event === "room:leave",
      );
      expect(leaveBroadcast).toBeDefined();
      expect(leaveBroadcast!.room).toBe(TEST_ROOM_ID);
      expect((leaveBroadcast!.data as { direction: string }).direction).toBe(
        "north",
      );
    });

    it("should include player info in room:leave broadcast", async () => {
      const context = createContext();
      const result = await handleMove(["north"], context, "north");

      const leaveBroadcast = result.broadcast?.find(
        (b) => b.event === "room:leave",
      );
      expect(leaveBroadcast).toBeDefined();
      expect((leaveBroadcast!.data as { player: Player }).player.name).toBe(
        "TestPlayer",
      );
    });
  });

  describe("handleSpawn - monster spawn broadcast", () => {
    it("should broadcast to room when monster is spawned", async () => {
      // User is already admin from beforeAll
      const context = createContext();
      const result = await handleSpawn(["wolf"], context);

      expect(result.success).toBe(true);
      expect(result.message).toContain("wolf");
      expect(result.message).toContain("appears");

      // Should have a broadcast to the room
      expect(result.broadcast).toBeDefined();
      expect(result.broadcast).toHaveLength(1);
      expect(result.broadcast![0].event).toBe("chat:message");
      expect(result.broadcast![0].room).toBe(TEST_ROOM_ID);
      expect(
        (result.broadcast![0].data as { content: string }).content,
      ).toContain("emerges from the shadows");
    });
  });
});
