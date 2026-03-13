/**
 * Tests for spell learning via library features
 */

import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import {
  features,
  players,
  playerSpells,
  rooms,
  spells,
  users,
} from "../../src/db/schema.js";
import * as FeatureService from "../../src/services/FeatureService.js";
import * as SpellService from "../../src/services/SpellService.js";

describe("Spell Learning via Library Features", () => {
  const testUserId = uuidv4();
  const testPlayerId = uuidv4();
  const testRoomId = uuidv4();
  const testSpellId = uuidv4();
  const testFeatureId = uuidv4();

  beforeEach(async () => {
    // Create test user
    await db.insert(users).values({
      id: testUserId,
      username: `testuser-${uuidv4().slice(0, 8)}`,
      passwordHash: "hash",
      createdAt: new Date(),
    });

    // Create test room
    await db.insert(rooms).values({
      id: testRoomId,
      name: "Test Library",
      description: "A test library",
      region: "test",
    });

    // Create test player with INT 14 (can learn spells with minInt <= 14)
    await db.insert(players).values({
      id: testPlayerId,
      userId: testUserId,
      name: `TestPlayer-${uuidv4().slice(0, 8)}`,
      currentRoomId: testRoomId,
      int: 14,
      str: 10,
      dex: 10,
      con: 10,
      wis: 10,
      cha: 10,
      currentHp: 20,
      maxHp: 20,
      createdAt: new Date(),
    });

    // Create test spell (minInt 12)
    await db.insert(spells).values({
      id: testSpellId,
      name: "Test Bolt",
      description: "A test spell",
      manaCost: 2,
      minInt: 12,
      targetType: "enemy",
    });

    // Create spell book feature
    await db.insert(features).values({
      id: testFeatureId,
      roomId: testRoomId,
      name: "Test Spellbook",
      description: "A test spellbook",
      triggerVerbs: ["study", "read"],
      triggerTarget: "test spellbook",
      successMessage: "You learn the spell!",
      successEffects: [{ type: "learn_spell" }],
      teachesSpellId: testSpellId,
      isHidden: false,
    });
  });

  afterEach(async () => {
    // Clean up in reverse order of dependencies
    await db
      .delete(playerSpells)
      .where(eq(playerSpells.playerId, testPlayerId));
    await db.delete(features).where(eq(features.id, testFeatureId));
    await db.delete(spells).where(eq(spells.id, testSpellId));
    await db.delete(players).where(eq(players.id, testPlayerId));
    await db.delete(rooms).where(eq(rooms.id, testRoomId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  it("should learn spell from spellbook feature", async () => {
    // Find the feature
    const match = await FeatureService.findFeatureByCommand(
      testRoomId,
      "study",
      "test spellbook",
      testPlayerId,
    );
    expect(match.type).toBe("found");
    if (match.type !== "found") throw new Error("Expected found");

    // Interact with the feature
    const result = await FeatureService.interactWithFeature(
      testPlayerId,
      match.feature,
    );

    expect(result.success).toBe(true);
    expect(result.effectsApplied).toHaveLength(1);
    expect(result.effectsApplied[0].type).toBe("learn_spell");
    expect(result.effectsApplied[0].success).toBe(true);
    expect(result.effectsApplied[0].message).toContain("learned");

    // Verify player now knows the spell
    const knownSpells = await SpellService.getPlayerSpells(testPlayerId);
    expect(knownSpells).toHaveLength(1);
    expect(knownSpells[0].id).toBe(testSpellId);
  });

  it("should fail if player already knows the spell", async () => {
    // First, learn the spell
    await SpellService.learnSpell(testPlayerId, testSpellId);

    // Try to learn again
    const match = await FeatureService.findFeatureByCommand(
      testRoomId,
      "study",
      "test spellbook",
      testPlayerId,
    );
    expect(match.type).toBe("found");
    if (match.type !== "found") throw new Error("Expected found");

    const result = await FeatureService.interactWithFeature(
      testPlayerId,
      match.feature,
    );

    expect(result.success).toBe(false); // Feature interaction fails when learning fails
    expect(result.effectsApplied[0].success).toBe(false);
    expect(result.effectsApplied[0].message).toContain("already know");
  });

  it("should fail if player INT is too low", async () => {
    // Lower player's INT below spell requirement
    await db
      .update(players)
      .set({ int: 10 })
      .where(eq(players.id, testPlayerId));

    const match = await FeatureService.findFeatureByCommand(
      testRoomId,
      "study",
      "test spellbook",
      testPlayerId,
    );
    expect(match.type).toBe("found");
    if (match.type !== "found") throw new Error("Expected found");

    const result = await FeatureService.interactWithFeature(
      testPlayerId,
      match.feature,
    );

    expect(result.success).toBe(false); // Feature interaction fails when learning fails
    expect(result.effectsApplied[0].success).toBe(false);
    expect(result.effectsApplied[0].message).toContain("INT");
  });

  it("should fail if player is at spell capacity", async () => {
    // Player has INT 14 = +2 modifier, capacity = 2 + 2 = 4 spells
    // Create and learn 4 spells to fill capacity
    for (let i = 0; i < 4; i++) {
      const spellId = uuidv4();
      await db.insert(spells).values({
        id: spellId,
        name: `Filler Spell ${i}`,
        description: "A filler spell",
        manaCost: 1,
        minInt: 10,
        targetType: "self",
      });
      await SpellService.learnSpell(testPlayerId, spellId);
    }

    // Try to learn one more
    const match = await FeatureService.findFeatureByCommand(
      testRoomId,
      "study",
      "test spellbook",
      testPlayerId,
    );
    expect(match.type).toBe("found");
    if (match.type !== "found") throw new Error("Expected found");

    const result = await FeatureService.interactWithFeature(
      testPlayerId,
      match.feature,
    );

    expect(result.success).toBe(false); // Feature interaction fails when learning fails
    expect(result.effectsApplied[0].success).toBe(false);
    expect(result.effectsApplied[0].message).toContain("Capacity");
  });

  it("should show disambiguation when multiple books match", async () => {
    // Create a second spellbook with overlapping trigger target
    const secondFeatureId = uuidv4();
    const secondSpellId = uuidv4();

    await db.insert(spells).values({
      id: secondSpellId,
      name: "Second Spell",
      description: "Another spell",
      manaCost: 3,
      minInt: 12,
      targetType: "self",
    });

    await db.insert(features).values({
      id: secondFeatureId,
      roomId: testRoomId,
      name: "Another Test Spellbook",
      description: "Another spellbook",
      triggerVerbs: ["study", "read"],
      triggerTarget: "test spellbook two", // Both start with "test spellbook"
      successMessage: "You learn the spell!",
      successEffects: [{ type: "learn_spell" }],
      teachesSpellId: secondSpellId,
      isHidden: false,
    });

    // Try to read "test spellbook" - should match both (one exact, one prefix)
    // Actually, let's use "test" which should match both via includes
    const match = await FeatureService.findFeatureByCommand(
      testRoomId,
      "read",
      "test",
      testPlayerId,
    );

    expect(match.type).toBe("ambiguous");
    if (match.type === "ambiguous") {
      expect(match.features.length).toBe(2);
    }

    // Clean up
    await db.delete(features).where(eq(features.id, secondFeatureId));
    await db.delete(spells).where(eq(spells.id, secondSpellId));
  });
});
