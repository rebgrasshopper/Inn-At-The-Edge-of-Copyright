import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import {
  containers,
  features,
  items,
  playerInventory,
  players,
  rooms,
  users,
} from "../../src/db/schema.js";
import * as FeatureService from "../../src/services/FeatureService.js";

describe("FeatureService", () => {
  let testUserId: string;
  let testPlayerId: string;
  let testRoomId: string;
  let testRoom2Id: string;
  let testItemId: string;

  beforeEach(async () => {
    // Create test user
    testUserId = uuidv4();
    await db.insert(users).values({
      id: testUserId,
      username: `testuser_${Date.now()}`,
      passwordHash: "hash",
      createdAt: new Date(),
    });

    // Create test rooms
    testRoomId = uuidv4();
    testRoom2Id = uuidv4();
    await db.insert(rooms).values([
      {
        id: testRoomId,
        name: "Test Room",
        description: "A test room",
        region: "test",
        exits: {},
      },
      {
        id: testRoom2Id,
        name: "Second Room",
        description: "Another test room",
        region: "test",
        exits: {},
      },
    ]);

    // Create test player with high stats for condition tests
    testPlayerId = uuidv4();
    await db.insert(players).values({
      id: testPlayerId,
      userId: testUserId,
      name: `TestPlayer_${Date.now()}`,
      currentRoomId: testRoomId,
      currentHp: 20,
      maxHp: 20,
      xp: 0,
      str: 15,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
      createdAt: new Date(),
    });

    // Create test item for item_required conditions
    testItemId = uuidv4();
    await db.insert(items).values({
      id: testItemId,
      name: "Magic Key",
      description: "A magical key",
    });
  });

  afterEach(async () => {
    // Clean up in reverse order of dependencies
    await db
      .delete(playerInventory)
      .where(eq(playerInventory.playerId, testPlayerId));
    await db.delete(features).where(eq(features.roomId, testRoomId));
    await db.delete(containers).where(eq(containers.roomId, testRoomId));
    await db.delete(players).where(eq(players.id, testPlayerId));
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(items).where(eq(items.id, testItemId));
    await db.delete(rooms).where(eq(rooms.id, testRoomId));
    await db.delete(rooms).where(eq(rooms.id, testRoom2Id));
  });

  describe("getFeaturesInRoom", () => {
    it("should return visible features", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Lever",
        description: "A rusty lever",
        triggerVerbs: ["pull", "push"],
        triggerTarget: "lever",
        isHidden: false,
      });

      const result = await FeatureService.getFeaturesInRoom(testRoomId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Lever");
    });

    it("should exclude hidden features by default", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Secret Door",
        description: "A hidden door",
        triggerVerbs: ["open"],
        triggerTarget: "door",
        isHidden: true,
      });

      const result = await FeatureService.getFeaturesInRoom(testRoomId);

      expect(result).toHaveLength(0);
    });

    it("should include hidden features when requested", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Secret Door",
        description: "A hidden door",
        triggerVerbs: ["open"],
        triggerTarget: "door",
        isHidden: true,
      });

      const result = await FeatureService.getFeaturesInRoom(testRoomId, true);

      expect(result).toHaveLength(1);
    });

    it("should include features with null isHidden (never hidden)", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Fountain",
        description: "A beautiful fountain",
        triggerVerbs: ["drink"],
        triggerTarget: "fountain",
        isHidden: null,
      });

      const result = await FeatureService.getFeaturesInRoom(testRoomId);

      expect(result).toHaveLength(1);
    });
  });

  describe("findFeatureByCommand", () => {
    it("should find feature by verb and target", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Lever",
        description: "A rusty lever",
        triggerVerbs: ["pull", "push"],
        triggerTarget: "lever",
        isHidden: false,
      });

      const result = await FeatureService.findFeatureByCommand(
        testRoomId,
        "pull",
        "lever",
      );

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Lever");
    });

    it("should match verb case-insensitively", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Lever",
        description: "A rusty lever",
        triggerVerbs: ["pull"],
        triggerTarget: "lever",
        isHidden: false,
      });

      const result = await FeatureService.findFeatureByCommand(
        testRoomId,
        "PULL",
        "lever",
      );

      expect(result).not.toBeNull();
    });

    it("should return null for non-matching verb", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Lever",
        description: "A rusty lever",
        triggerVerbs: ["pull"],
        triggerTarget: "lever",
        isHidden: false,
      });

      const result = await FeatureService.findFeatureByCommand(
        testRoomId,
        "kick",
        "lever",
      );

      expect(result).toBeNull();
    });
  });

  describe("interactWithFeature", () => {
    it("should succeed with no condition", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Lever",
        description: "A rusty lever",
        triggerVerbs: ["pull"],
        triggerTarget: "lever",
        isHidden: false,
        successMessage: "The lever clicks into place.",
      });

      const feature = await FeatureService.findFeatureByCommand(
        testRoomId,
        "pull",
        "lever",
      );
      const result = await FeatureService.interactWithFeature(
        testPlayerId,
        feature!,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("The lever clicks into place.");
    });

    it("should pass stat check when stat is high enough", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Heavy Door",
        description: "A heavy stone door",
        triggerVerbs: ["push", "open"],
        triggerTarget: "door",
        isHidden: false,
        condition: { type: "stat_check", stat: "str", dc: 12 },
        successMessage: "You push the door open!",
        failureMessage: "The door won't budge.",
      });

      const feature = await FeatureService.findFeatureByCommand(
        testRoomId,
        "push",
        "door",
      );
      const result = await FeatureService.interactWithFeature(
        testPlayerId,
        feature!,
      );

      // Player has STR 15, DC is 12
      expect(result.success).toBe(true);
      expect(result.message).toBe("You push the door open!");
    });

    it("should fail stat check when stat is too low", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Heavy Door",
        description: "A heavy stone door",
        triggerVerbs: ["push"],
        triggerTarget: "door",
        isHidden: false,
        condition: { type: "stat_check", stat: "str", dc: 20 },
        successMessage: "You push the door open!",
        failureMessage: "The door won't budge.",
      });

      const feature = await FeatureService.findFeatureByCommand(
        testRoomId,
        "push",
        "door",
      );
      const result = await FeatureService.interactWithFeature(
        testPlayerId,
        feature!,
      );

      // Player has STR 15, DC is 20
      expect(result.success).toBe(false);
      expect(result.message).toBe("The door won't budge.");
    });

    it("should pass item_required when player has item", async () => {
      // Give player the item
      await db.insert(playerInventory).values({
        id: uuidv4(),
        playerId: testPlayerId,
        itemId: testItemId,
        quantity: 1,
      });

      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Locked Chest",
        description: "A locked chest",
        triggerVerbs: ["unlock", "open"],
        triggerTarget: "chest",
        isHidden: false,
        condition: {
          type: "item_required",
          itemId: testItemId,
          consumeItem: false,
        },
        successMessage: "You unlock the chest!",
      });

      const feature = await FeatureService.findFeatureByCommand(
        testRoomId,
        "unlock",
        "chest",
      );
      const result = await FeatureService.interactWithFeature(
        testPlayerId,
        feature!,
      );

      expect(result.success).toBe(true);
    });

    it("should fail item_required when player lacks item", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Locked Chest",
        description: "A locked chest",
        triggerVerbs: ["unlock"],
        triggerTarget: "chest",
        isHidden: false,
        condition: { type: "item_required", itemId: testItemId },
        successMessage: "You unlock the chest!",
      });

      const feature = await FeatureService.findFeatureByCommand(
        testRoomId,
        "unlock",
        "chest",
      );
      const result = await FeatureService.interactWithFeature(
        testPlayerId,
        feature!,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("Magic Key");
    });

    it("should request riddle answer when none provided", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Sphinx",
        description: "A stone sphinx",
        triggerVerbs: ["answer", "speak"],
        triggerTarget: "sphinx",
        isHidden: false,
        condition: {
          type: "riddle",
          question: "What has keys but no locks?",
          answers: ["piano", "keyboard"],
        },
        successMessage: "The sphinx nods approvingly.",
      });

      const feature = await FeatureService.findFeatureByCommand(
        testRoomId,
        "speak",
        "sphinx",
      );
      const result = await FeatureService.interactWithFeature(
        testPlayerId,
        feature!,
      );

      expect(result.success).toBe(false);
      expect(result.awaitingRiddleAnswer).toBe(true);
      expect(result.riddleQuestion).toBe("What has keys but no locks?");
    });

    it("should pass riddle with correct answer", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Sphinx",
        description: "A stone sphinx",
        triggerVerbs: ["answer"],
        triggerTarget: "sphinx",
        isHidden: false,
        condition: {
          type: "riddle",
          question: "What has keys but no locks?",
          answers: ["piano", "keyboard"],
        },
        successMessage: "The sphinx nods approvingly.",
      });

      const feature = await FeatureService.findFeatureByCommand(
        testRoomId,
        "answer",
        "sphinx",
      );
      const result = await FeatureService.interactWithFeature(
        testPlayerId,
        feature!,
        "piano",
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("The sphinx nods approvingly.");
    });

    it("should fail riddle with wrong answer", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Sphinx",
        description: "A stone sphinx",
        triggerVerbs: ["answer"],
        triggerTarget: "sphinx",
        isHidden: false,
        condition: {
          type: "riddle",
          question: "What has keys but no locks?",
          answers: ["piano"],
        },
        successMessage: "The sphinx nods approvingly.",
        failureMessage: "The sphinx shakes its head.",
      });

      const feature = await FeatureService.findFeatureByCommand(
        testRoomId,
        "answer",
        "sphinx",
      );
      const result = await FeatureService.interactWithFeature(
        testPlayerId,
        feature!,
        "door",
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("The sphinx shakes its head.");
    });

    it("should apply success effects", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Healing Fountain",
        description: "A magical fountain",
        triggerVerbs: ["drink"],
        triggerTarget: "fountain",
        isHidden: null,
        successMessage: "You feel refreshed!",
        successEffects: [{ type: "heal", amount: 10 }],
      });

      // Damage player first
      await db
        .update(players)
        .set({ currentHp: 10 })
        .where(eq(players.id, testPlayerId));

      const feature = await FeatureService.findFeatureByCommand(
        testRoomId,
        "drink",
        "fountain",
      );
      const result = await FeatureService.interactWithFeature(
        testPlayerId,
        feature!,
      );

      expect(result.success).toBe(true);
      expect(result.effectsApplied).toHaveLength(1);
      expect(result.effectsApplied[0].type).toBe("heal");

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.currentHp).toBe(20);
    });

    it("should apply failure effects", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Trapped Chest",
        description: "A suspicious chest",
        triggerVerbs: ["open"],
        triggerTarget: "chest",
        isHidden: false,
        condition: { type: "stat_check", stat: "dex", dc: 20 },
        successMessage: "You carefully open the chest.",
        failureMessage: "A dart shoots out!",
        failureEffects: [{ type: "damage", amount: 5 }],
      });

      const feature = await FeatureService.findFeatureByCommand(
        testRoomId,
        "open",
        "chest",
      );
      const result = await FeatureService.interactWithFeature(
        testPlayerId,
        feature!,
      );

      expect(result.success).toBe(false);
      expect(result.effectsApplied).toHaveLength(1);
      expect(result.effectsApplied[0].type).toBe("damage");

      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, testPlayerId))
        .get();
      expect(player?.currentHp).toBe(15);
    });
  });

  describe("revealFeature", () => {
    it("should set isHidden to false and record revealedAt", async () => {
      const featureId = uuidv4();
      await db.insert(features).values({
        id: featureId,
        roomId: testRoomId,
        name: "Secret Door",
        description: "A hidden door",
        triggerVerbs: ["open"],
        triggerTarget: "door",
        isHidden: true,
      });

      const result = await FeatureService.revealFeature(featureId);

      expect(result).not.toBeNull();
      expect(result?.isHidden).toBe(false);
      expect(result?.revealedAt).toBeDefined();
    });
  });

  describe("getContainersInRoom", () => {
    it("should return visible containers", async () => {
      const containerId = uuidv4();
      await db.insert(containers).values({
        id: containerId,
        roomId: testRoomId,
        name: "Wooden Chest",
        description: "A wooden chest",
        isHidden: false,
        isOpen: false,
      });

      const result = await FeatureService.getContainersInRoom(testRoomId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Wooden Chest");
    });

    it("should exclude hidden containers", async () => {
      const containerId = uuidv4();
      await db.insert(containers).values({
        id: containerId,
        roomId: testRoomId,
        name: "Hidden Compartment",
        description: "A secret compartment",
        isHidden: true,
        isOpen: false,
      });

      const result = await FeatureService.getContainersInRoom(testRoomId);

      expect(result).toHaveLength(0);
    });
  });
});
