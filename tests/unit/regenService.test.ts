import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import { players, rooms, users } from "../../src/db/schema.js";
import * as RegenService from "../../src/services/RegenService.js";

const testUserId = "test-user-regen";
const testPlayerId = "test-player-regen";
const testRoomId = "test-room-regen";

async function cleanupTestData() {
  await db.delete(players).where(eq(players.id, testPlayerId));
  await db.delete(rooms).where(eq(rooms.id, testRoomId));
  await db.delete(users).where(eq(users.id, testUserId));
}

async function createTestPlayer(
  overrides: Partial<typeof players.$inferInsert> = {},
) {
  const defaults = {
    id: testPlayerId,
    userId: testUserId,
    name: "RegenTestPlayer",
    currentRoomId: testRoomId,
    level: 1,
    xp: 0,
    currentHp: 10,
    maxHp: 20,
    mana: 5,
    maxMana: 10,
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    unspentAttributePoints: 0,
    lastRegenAt: new Date(),
    createdAt: new Date(),
  };

  await db.insert(players).values({ ...defaults, ...overrides });
}

beforeAll(async () => {
  await cleanupTestData();

  // Create test user
  await db.insert(users).values({
    id: testUserId,
    username: "regentestuser",
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });

  // Create test room
  await db.insert(rooms).values({
    id: testRoomId,
    name: "Regen Test Room",
    description: "A room for testing regeneration",
    region: "testregion",
    exits: {},
  });
});

afterAll(async () => {
  await cleanupTestData();
});

beforeEach(async () => {
  // Clean up player before each test
  await db.delete(players).where(eq(players.id, testPlayerId));
});

describe("RegenService", () => {
  describe("formatRegenMessage", () => {
    it("should return null for null input", () => {
      expect(RegenService.formatRegenMessage(null)).toBeNull();
    });

    it("should format HP only message", () => {
      const result = RegenService.formatRegenMessage({
        hpRestored: 5,
        manaRestored: 0,
        newHp: 15,
        newMana: 10,
      });
      expect(result).toBe("You recover 5 HP.");
    });

    it("should format mana only message", () => {
      const result = RegenService.formatRegenMessage({
        hpRestored: 0,
        manaRestored: 3,
        newHp: 20,
        newMana: 8,
      });
      expect(result).toBe("You recover 3 mana.");
    });

    it("should format combined HP and mana message", () => {
      const result = RegenService.formatRegenMessage({
        hpRestored: 5,
        manaRestored: 3,
        newHp: 15,
        newMana: 8,
      });
      expect(result).toBe("You recover 5 HP and 3 mana.");
    });

    it("should return null when nothing restored", () => {
      const result = RegenService.formatRegenMessage({
        hpRestored: 0,
        manaRestored: 0,
        newHp: 20,
        newMana: 10,
      });
      expect(result).toBeNull();
    });
  });

  describe("restorePlayerResources", () => {
    it("should return null for non-existent player", async () => {
      const result = await RegenService.restorePlayerResources(
        "non-existent-player",
        10,
        10,
      );
      expect(result).toBeNull();
    });

    it("should restore HP up to max", async () => {
      await createTestPlayer({
        currentHp: 10,
        maxHp: 20,
        mana: 10,
        maxMana: 10,
      });

      const result = await RegenService.restorePlayerResources(
        testPlayerId,
        15,
        0,
      );

      expect(result).not.toBeNull();
      expect(result!.hpRestored).toBe(10); // Only 10 needed to reach max
      expect(result!.newHp).toBe(20);
    });

    it("should restore mana up to max", async () => {
      await createTestPlayer({
        currentHp: 20,
        maxHp: 20,
        mana: 3,
        maxMana: 10,
      });

      const result = await RegenService.restorePlayerResources(
        testPlayerId,
        0,
        15,
      );

      expect(result).not.toBeNull();
      expect(result!.manaRestored).toBe(7); // Only 7 needed to reach max
      expect(result!.newMana).toBe(10);
    });

    it("should restore both HP and mana", async () => {
      await createTestPlayer({
        currentHp: 10,
        maxHp: 20,
        mana: 5,
        maxMana: 10,
      });

      const result = await RegenService.restorePlayerResources(
        testPlayerId,
        5,
        3,
      );

      expect(result).not.toBeNull();
      expect(result!.hpRestored).toBe(5);
      expect(result!.manaRestored).toBe(3);
      expect(result!.newHp).toBe(15);
      expect(result!.newMana).toBe(8);
    });

    it("should return 0 restored when already at max", async () => {
      await createTestPlayer({
        currentHp: 20,
        maxHp: 20,
        mana: 10,
        maxMana: 10,
      });

      const result = await RegenService.restorePlayerResources(
        testPlayerId,
        10,
        10,
      );

      expect(result).not.toBeNull();
      expect(result!.hpRestored).toBe(0);
      expect(result!.manaRestored).toBe(0);
      expect(result!.newHp).toBe(20);
      expect(result!.newMana).toBe(10);
    });

    it("should persist changes to database", async () => {
      await createTestPlayer({
        currentHp: 10,
        maxHp: 20,
        mana: 5,
        maxMana: 10,
      });

      await RegenService.restorePlayerResources(testPlayerId, 5, 3);

      const player = await db
        .select({ currentHp: players.currentHp, mana: players.mana })
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();

      expect(player!.currentHp).toBe(15);
      expect(player!.mana).toBe(8);
    });
  });

  describe("resetRegenTimer", () => {
    it("should set lastRegenAt to current time", async () => {
      const pastTime = new Date(Date.now() - 60000); // 1 minute ago
      await createTestPlayer({ lastRegenAt: pastTime });

      const beforeReset = Math.floor(Date.now() / 1000) * 1000; // Round to seconds
      await RegenService.resetRegenTimer(testPlayerId);
      const afterReset = Math.ceil(Date.now() / 1000) * 1000 + 1000; // Round up + 1 second buffer

      const player = await db
        .select({ lastRegenAt: players.lastRegenAt })
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();

      expect(player!.lastRegenAt).not.toBeNull();
      const regenTime = player!.lastRegenAt!.getTime();
      expect(regenTime).toBeGreaterThanOrEqual(beforeReset);
      expect(regenTime).toBeLessThanOrEqual(afterReset);
    });
  });

  describe("checkAndApplyRegen", () => {
    it("should return null for non-existent player", async () => {
      const result = await RegenService.checkAndApplyRegen(
        "non-existent-player",
      );
      expect(result).toBeNull();
    });

    it("should return null when no time has passed", async () => {
      await createTestPlayer({
        currentHp: 10,
        maxHp: 20,
        mana: 5,
        maxMana: 10,
        lastRegenAt: new Date(),
      });

      const result = await RegenService.checkAndApplyRegen(testPlayerId);
      expect(result).toBeNull();
    });

    it("should return null when not enough time for a tick", async () => {
      // Less than 18 seconds (mana interval) and less than 27 seconds (HP interval)
      const tenSecondsAgo = new Date(Date.now() - 10000);
      await createTestPlayer({
        currentHp: 10,
        maxHp: 20,
        mana: 5,
        maxMana: 10,
        lastRegenAt: tenSecondsAgo,
      });

      const result = await RegenService.checkAndApplyRegen(testPlayerId);
      expect(result).toBeNull();
    });

    it("should regen mana after 18 seconds out of combat", async () => {
      // 20 seconds ago - enough for 1 mana tick (18s)
      const twentySecondsAgo = new Date(Date.now() - 20000);
      await createTestPlayer({
        currentHp: 20, // Full HP so we only see mana regen
        maxHp: 20,
        mana: 5,
        maxMana: 100, // High max so 1% = 1
        lastRegenAt: twentySecondsAgo,
      });

      const result = await RegenService.checkAndApplyRegen(testPlayerId);

      expect(result).not.toBeNull();
      expect(result!.manaRestored).toBe(1); // 1% of 100 = 1
      expect(result!.hpRestored).toBe(0); // Not enough time for HP tick
    });

    it("should regen HP after 27 seconds out of combat", async () => {
      // 30 seconds ago - enough for 1 HP tick (27s) and 1 mana tick (18s)
      const thirtySecondsAgo = new Date(Date.now() - 30000);
      await createTestPlayer({
        currentHp: 50,
        maxHp: 100, // 1% = 1
        mana: 100, // Full mana so we only see HP regen
        maxMana: 100,
        lastRegenAt: thirtySecondsAgo,
      });

      const result = await RegenService.checkAndApplyRegen(testPlayerId);

      expect(result).not.toBeNull();
      expect(result!.hpRestored).toBe(1); // 1% of 100 = 1
      expect(result!.manaRestored).toBe(0); // Already at max
    });

    it("should regen minimum 1 point even with low max values", async () => {
      // 20 seconds ago - enough for 1 mana tick
      const twentySecondsAgo = new Date(Date.now() - 20000);
      await createTestPlayer({
        currentHp: 20,
        maxHp: 20,
        mana: 0,
        maxMana: 10, // 1% of 10 = 0.1, but minimum is 1
        lastRegenAt: twentySecondsAgo,
      });

      const result = await RegenService.checkAndApplyRegen(testPlayerId);

      expect(result).not.toBeNull();
      expect(result!.manaRestored).toBe(1); // Minimum 1 per tick
    });

    it("should return null when already at max", async () => {
      const thirtySecondsAgo = new Date(Date.now() - 30000);
      await createTestPlayer({
        currentHp: 20,
        maxHp: 20,
        mana: 10,
        maxMana: 10,
        lastRegenAt: thirtySecondsAgo,
      });

      const result = await RegenService.checkAndApplyRegen(testPlayerId);
      expect(result).toBeNull();
    });

    it("should accumulate multiple ticks over longer time", async () => {
      // 60 seconds ago - enough for 3 mana ticks (18s each) and 2 HP ticks (27s each)
      const sixtySecondsAgo = new Date(Date.now() - 60000);
      await createTestPlayer({
        currentHp: 50,
        maxHp: 100,
        mana: 50,
        maxMana: 100,
        lastRegenAt: sixtySecondsAgo,
      });

      const result = await RegenService.checkAndApplyRegen(testPlayerId);

      expect(result).not.toBeNull();
      expect(result!.manaRestored).toBe(3); // 3 ticks × 1% of 100 = 3
      expect(result!.hpRestored).toBe(2); // 2 ticks × 1% of 100 = 2
    });

    it("should update lastRegenAt timestamp", async () => {
      const thirtySecondsAgo = new Date(Date.now() - 30000);
      await createTestPlayer({
        currentHp: 50,
        maxHp: 100,
        mana: 50,
        maxMana: 100,
        lastRegenAt: thirtySecondsAgo,
      });

      const beforeRegen = Math.floor(Date.now() / 1000) * 1000; // Round to seconds
      await RegenService.checkAndApplyRegen(testPlayerId);
      const afterRegen = Math.ceil(Date.now() / 1000) * 1000 + 1000; // Round up + 1 second buffer

      const player = await db
        .select({ lastRegenAt: players.lastRegenAt })
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();

      expect(player!.lastRegenAt).not.toBeNull();
      const regenTime = player!.lastRegenAt!.getTime();
      expect(regenTime).toBeGreaterThanOrEqual(beforeRegen);
      expect(regenTime).toBeLessThanOrEqual(afterRegen);
    });

    it("should cap restoration at max values", async () => {
      // Long time ago - would restore more than needed
      const fiveMinutesAgo = new Date(Date.now() - 300000);
      await createTestPlayer({
        currentHp: 95, // Only need 5 more
        maxHp: 100,
        mana: 98, // Only need 2 more
        maxMana: 100,
        lastRegenAt: fiveMinutesAgo,
      });

      const result = await RegenService.checkAndApplyRegen(testPlayerId);

      expect(result).not.toBeNull();
      expect(result!.hpRestored).toBe(5); // Capped at what's needed
      expect(result!.manaRestored).toBe(2); // Capped at what's needed
      expect(result!.newHp).toBe(100);
      expect(result!.newMana).toBe(100);
    });
  });
});
