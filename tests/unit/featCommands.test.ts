import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import { feats, playerFeats, players, users } from "../../src/db/schema.js";
import {
  handleFeats,
  handleStance,
} from "../../src/services/commands/handlers/character.js";
import type { CommandContext } from "../../src/types/command.js";

let testUserId: string;
let testPlayerId: string;
let testContext: CommandContext;

// Feat IDs
let toughnessFeatId: string;
let dodgeFeatId: string;
let combatExpertiseFeatId: string;
let powerAttackFeatId: string;

beforeAll(async () => {
  // Clean up test data only (respect foreign keys, don't delete seeded data)
  // First delete playerFeats for players owned by our test users
  await db
    .delete(playerFeats)
    .where(
      sql`player_id IN (SELECT id FROM players WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'cmdtest_%'))`,
    );
  await db.delete(players).where(sql`name LIKE 'TestPlayer_%'`);
  await db.delete(users).where(sql`username LIKE 'cmdtest_%'`);

  // Create test user
  testUserId = uuidv4();
  await db.insert(users).values({
    id: testUserId,
    username: `cmdtest_${uuidv4().slice(0, 8)}`,
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });

  // Get feat IDs
  const toughness = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.name}) = 'toughness'`)
    .limit(1);
  toughnessFeatId = toughness[0]?.id;

  const dodge = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.name}) = 'dodge'`)
    .limit(1);
  dodgeFeatId = dodge[0]?.id;

  const combatExpertise = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.name}) = 'combat expertise'`)
    .limit(1);
  combatExpertiseFeatId = combatExpertise[0]?.id;

  const powerAttack = await db
    .select()
    .from(feats)
    .where(sql`lower(${feats.name}) = 'power attack'`)
    .limit(1);
  powerAttackFeatId = powerAttack[0]?.id;
});

beforeEach(async () => {
  // Clean up test player data only (testPlayerId may be undefined on first run)
  if (testPlayerId) {
    await db.delete(playerFeats).where(eq(playerFeats.playerId, testPlayerId));
  }
  await db.delete(players).where(eq(players.userId, testUserId));

  testPlayerId = uuidv4();
  await db.insert(players).values({
    id: testPlayerId,
    name: `TestPlayer_${uuidv4().slice(0, 6)}`,
    userId: testUserId,
    currentRoomId: "starting-room",
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    level: 1,
    xp: 0,
    currentHp: 10,
    maxHp: 10,
    unspentAttributePoints: 0,
    unspentFeatSlots: 0,
    activeStance: null,
    createdAt: new Date(),
  });

  testContext = {
    player: {
      id: testPlayerId,
      name: "TestPlayer",
      currentRoomId: "starting-room",
    },
    currentRoom: {
      id: "starting-room",
      name: "Starting Room",
      description: "A test room",
    },
  };
});

afterAll(async () => {
  // Clean up test data only - only delete playerFeats for our test player
  if (testPlayerId) {
    await db.delete(playerFeats).where(eq(playerFeats.playerId, testPlayerId));
  }
  await db.delete(players).where(sql`user_id = ${testUserId}`);
  await db.delete(users).where(sql`username LIKE 'cmdtest_%'`);
});

describe("handleFeats", () => {
  describe("feats (no args)", () => {
    it("should show no feats message when player has none", async () => {
      const result = await handleFeats([], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("no feats yet");
      expect(result.message).toContain("no unspent feat slots");
    });

    it("should show unspent slots count", async () => {
      await db
        .update(players)
        .set({ unspentFeatSlots: 3 })
        .where(eq(players.id, testPlayerId));

      const result = await handleFeats([], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("3 unspent feat slots");
    });

    it("should list owned feats", async () => {
      await db
        .update(players)
        .set({ unspentFeatSlots: 1 })
        .where(eq(players.id, testPlayerId));

      // Acquire Toughness
      await db.insert(playerFeats).values({
        id: uuidv4(),
        playerId: testPlayerId,
        featId: toughnessFeatId,
        acquiredAt: new Date(),
      });

      const result = await handleFeats([], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Toughness");
    });
  });

  describe("feats available", () => {
    it("should list available feats", async () => {
      const result = await handleFeats(["available"], testContext);

      expect(result.success).toBe(true);
      // Toughness has no prerequisites, should be available
      expect(result.message).toContain("Toughness");
    });

    it("should not list feats with unmet prerequisites", async () => {
      // Player has Dex 10, Dodge requires Dex 13
      const result = await handleFeats(["available"], testContext);

      expect(result.success).toBe(true);
      expect(result.message).not.toContain("Dodge");
    });

    it("should list feats when prerequisites are met", async () => {
      await db
        .update(players)
        .set({ dex: 15 })
        .where(eq(players.id, testPlayerId));

      const result = await handleFeats(["available"], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Dodge");
    });
  });

  describe("feats info <name>", () => {
    it("should show feat details", async () => {
      const result = await handleFeats(["info", "Toughness"], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Toughness");
      expect(result.message).toContain("Untyped");
    });

    it("should show prerequisite status", async () => {
      const result = await handleFeats(["info", "Dodge"], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Unmet");
      expect(result.message).toContain("Dex");
    });

    it("should show met prerequisites", async () => {
      await db
        .update(players)
        .set({ dex: 15 })
        .where(eq(players.id, testPlayerId));

      const result = await handleFeats(["info", "Dodge"], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Prerequisites met");
    });

    it("should return error for unknown feat", async () => {
      const result = await handleFeats(
        ["info", "NonexistentFeat"],
        testContext,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("No supported feat found");
    });

    it("should require feat name argument", async () => {
      const result = await handleFeats(["info"], testContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Usage");
    });
  });

  describe("feats acquire <name>", () => {
    it("should fail without feat slots", async () => {
      const result = await handleFeats(["acquire", "Toughness"], testContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("don't have any feat slots");
    });

    it("should acquire feat with available slots", async () => {
      await db
        .update(players)
        .set({ unspentFeatSlots: 1 })
        .where(eq(players.id, testPlayerId));

      const result = await handleFeats(["acquire", "Toughness"], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("acquired");
      expect(result.message).toContain("Toughness");
    });

    it("should fail for feat with unmet prerequisites", async () => {
      await db
        .update(players)
        .set({ unspentFeatSlots: 1 })
        .where(eq(players.id, testPlayerId));

      const result = await handleFeats(["acquire", "Dodge"], testContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("prerequisites");
    });

    it("should fail for already owned feat", async () => {
      await db
        .update(players)
        .set({ unspentFeatSlots: 2 })
        .where(eq(players.id, testPlayerId));

      // Acquire first time
      await handleFeats(["acquire", "Toughness"], testContext);

      // Try to acquire again
      const result = await handleFeats(["acquire", "Toughness"], testContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("already have");
    });

    it("should return error for unknown feat", async () => {
      await db
        .update(players)
        .set({ unspentFeatSlots: 1 })
        .where(eq(players.id, testPlayerId));

      const result = await handleFeats(
        ["acquire", "NonexistentFeat"],
        testContext,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("No supported feat found");
    });
  });

  describe("feats category <name>", () => {
    it("should list categories when no name provided", async () => {
      const result = await handleFeats(["category"], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Combat");
    });

    it("should list feats in category", async () => {
      const result = await handleFeats(["category", "Combat"], testContext);

      expect(result.success).toBe(true);
      // Combat Expertise and Power Attack are in the Combat category
      expect(result.message).toContain("Combat Expertise");
    });

    it("should return error for unknown category", async () => {
      const result = await handleFeats(
        ["category", "NonexistentCategory"],
        testContext,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("No supported feats found");
    });
  });
});

describe("handleStance", () => {
  beforeEach(async () => {
    // Give player stats and feats for stance testing
    await db
      .update(players)
      .set({ int: 15, str: 15, unspentFeatSlots: 2 })
      .where(eq(players.id, testPlayerId));

    // Acquire Combat Expertise and Power Attack
    await db.insert(playerFeats).values([
      {
        id: uuidv4(),
        playerId: testPlayerId,
        featId: combatExpertiseFeatId,
        acquiredAt: new Date(),
      },
      {
        id: uuidv4(),
        playerId: testPlayerId,
        featId: powerAttackFeatId,
        acquiredAt: new Date(),
      },
    ]);
  });

  describe("stance (no args)", () => {
    it("should show no stance message when none active", async () => {
      const result = await handleStance([], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("not in any combat stance");
    });

    it("should show active stance", async () => {
      await db
        .update(players)
        .set({ activeStance: combatExpertiseFeatId })
        .where(eq(players.id, testPlayerId));

      const result = await handleStance([], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Combat Expertise");
    });
  });

  describe("stance <name>", () => {
    it("should activate stance", async () => {
      const result = await handleStance(["Combat", "Expertise"], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("adopt");
    });

    it("should fail for non-stance feat", async () => {
      // Acquire Toughness (not a stance)
      await db.insert(playerFeats).values({
        id: uuidv4(),
        playerId: testPlayerId,
        featId: toughnessFeatId,
        acquiredAt: new Date(),
      });

      const result = await handleStance(["Toughness"], testContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("not a stance");
    });

    it("should fail for feat player doesn't have", async () => {
      // Player doesn't have Deadly Aim
      const result = await handleStance(["Deadly", "Aim"], testContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("don't have");
    });

    it("should fail for unknown feat", async () => {
      const result = await handleStance(["NonexistentStance"], testContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("No supported stance found");
    });
  });

  describe("stance off", () => {
    it("should deactivate stance", async () => {
      // Activate stance first
      await db
        .update(players)
        .set({ activeStance: combatExpertiseFeatId })
        .where(eq(players.id, testPlayerId));

      const result = await handleStance(["off"], testContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("relax");
    });

    it("should fail when no stance active", async () => {
      const result = await handleStance(["off"], testContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("don't have a stance active");
    });

    it("should accept 'none' as alias for off", async () => {
      await db
        .update(players)
        .set({ activeStance: combatExpertiseFeatId })
        .where(eq(players.id, testPlayerId));

      const result = await handleStance(["none"], testContext);

      expect(result.success).toBe(true);
    });

    it("should accept 'clear' as alias for off", async () => {
      await db
        .update(players)
        .set({ activeStance: combatExpertiseFeatId })
        .where(eq(players.id, testPlayerId));

      const result = await handleStance(["clear"], testContext);

      expect(result.success).toBe(true);
    });
  });
});
