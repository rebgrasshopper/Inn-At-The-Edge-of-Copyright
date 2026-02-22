import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import { players, users } from "../../src/db/schema.js";
import * as CharacterService from "../../src/services/CharacterService.js";
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  validateCharacterName,
} from "../../src/utils/characterValidation.js";
import { DEFAULT_HP, DEFAULT_STATS } from "../../src/utils/stats.js";

describe("Character Validation", () => {
  describe("validateCharacterName", () => {
    it("should accept valid names", () => {
      expect(validateCharacterName("Gandalf").valid).toBe(true);
      expect(validateCharacterName("Sir Reginald").valid).toBe(true);
      expect(validateCharacterName("Dark-Knight").valid).toBe(true);
      expect(validateCharacterName("Player 123").valid).toBe(true);
      expect(validateCharacterName("A-B C-D").valid).toBe(true);
    });

    it("should reject names that are too short", () => {
      const result = validateCharacterName("A");
      expect(result.valid).toBe(false);
      expect(result.error).toContain(`at least ${NAME_MIN_LENGTH}`);
    });

    it("should reject names that are too long", () => {
      const longName = "A".repeat(NAME_MAX_LENGTH + 1);
      const result = validateCharacterName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toContain(`at most ${NAME_MAX_LENGTH}`);
    });

    it("should reject names with invalid characters", () => {
      expect(validateCharacterName("Player_One").valid).toBe(false); // underscore
      expect(validateCharacterName("Player@Name").valid).toBe(false); // @
      expect(validateCharacterName("Player!").valid).toBe(false); // !
      expect(validateCharacterName("Player#1").valid).toBe(false); // #
    });

    it("should reject empty or whitespace-only names", () => {
      expect(validateCharacterName("").valid).toBe(false);
      expect(validateCharacterName("   ").valid).toBe(false);
      expect(validateCharacterName("---").valid).toBe(false);
      expect(validateCharacterName("- - -").valid).toBe(false);
    });

    it("should reject names with profanity", () => {
      // Testing with common profane words
      const result = validateCharacterName("fuck");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("inappropriate");
    });

    it("should handle trimming", () => {
      const result = validateCharacterName("  Gandalf  ");
      expect(result.valid).toBe(true);
    });
  });
});

describe("CharacterService", () => {
  let testUserId: string;

  beforeEach(async () => {
    // Clean up
    await db.delete(players);
    await db.delete(users);

    // Create a test user
    testUserId = uuidv4();
    await db.insert(users).values({
      id: testUserId,
      username: `testuser_${uuidv4().slice(0, 8)}`,
      passwordHash: "hashedpassword",
      createdAt: new Date(),
    });
  });

  describe("createCharacter", () => {
    it("should create a character with default stats", async () => {
      const result = await CharacterService.createCharacter(
        testUserId,
        "TestHero",
      );

      expect(result.success).toBe(true);
      expect(result.player).toBeDefined();
      expect(result.player!.name).toBe("TestHero");
      expect(result.player!.stats).toEqual(DEFAULT_STATS);
      expect(result.player!.currentHp).toBe(DEFAULT_HP);
      expect(result.player!.maxHp).toBe(DEFAULT_HP);
      expect(result.player!.level).toBe(1);
      expect(result.player!.xp).toBe(0);
    });

    it("should place character in starting room", async () => {
      const result = await CharacterService.createCharacter(
        testUserId,
        "TestHero",
      );

      expect(result.success).toBe(true);
      expect(result.player!.currentRoomId).toBe(
        CharacterService.STARTING_ROOM_ID,
      );
    });

    it("should reject invalid names", async () => {
      const result = await CharacterService.createCharacter(testUserId, "A");

      expect(result.success).toBe(false);
      expect(result.error).toContain("at least");
    });

    it("should reject duplicate names", async () => {
      // Create first character
      await CharacterService.createCharacter(testUserId, "UniqueHero");

      // Try to create another with same name
      const result = await CharacterService.createCharacter(
        testUserId,
        "UniqueHero",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Character name is already taken");
    });

    it("should allow multiple characters per user", async () => {
      const result1 = await CharacterService.createCharacter(
        testUserId,
        "Hero One",
      );
      const result2 = await CharacterService.createCharacter(
        testUserId,
        "Hero Two",
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.player!.id).not.toBe(result2.player!.id);
    });
  });

  describe("getCharactersByUserId", () => {
    it("should return all characters for a user", async () => {
      await CharacterService.createCharacter(testUserId, "Hero One");
      await CharacterService.createCharacter(testUserId, "Hero Two");

      const characters =
        await CharacterService.getCharactersByUserId(testUserId);

      expect(characters).toHaveLength(2);
      expect(characters.map((c) => c.name)).toContain("Hero One");
      expect(characters.map((c) => c.name)).toContain("Hero Two");
    });

    it("should return empty array for user with no characters", async () => {
      const characters =
        await CharacterService.getCharactersByUserId(testUserId);
      expect(characters).toHaveLength(0);
    });
  });

  describe("getCharacterById", () => {
    it("should return character by ID", async () => {
      const createResult = await CharacterService.createCharacter(
        testUserId,
        "TestHero",
      );
      const character = await CharacterService.getCharacterById(
        createResult.player!.id,
      );

      expect(character).toBeDefined();
      expect(character!.name).toBe("TestHero");
    });

    it("should return null for non-existent ID", async () => {
      const character = await CharacterService.getCharacterById("non-existent");
      expect(character).toBeNull();
    });
  });
});
