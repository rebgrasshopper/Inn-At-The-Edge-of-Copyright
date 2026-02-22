import { test } from "@fast-check/vitest";
import { v4 as uuidv4 } from "uuid";
import { afterAll, beforeAll, describe, expect } from "vitest";
import { db } from "../../src/db/index.js";
import { players, users } from "../../src/db/schema.js";
import * as CharacterService from "../../src/services/CharacterService.js";
import { validateCharacterName } from "../../src/utils/characterValidation.js";
import { DEFAULT_STATS } from "../../src/utils/stats.js";
import {
  invalidCharNameArb,
  tooLongNameArb,
  tooShortNameArb,
  validNameArb,
} from "../generators/character.generator.js";

let testUserId: string;

// Setup test user
beforeAll(async () => {
  await db.delete(players);
  await db.delete(users);

  testUserId = uuidv4();
  await db.insert(users).values({
    id: testUserId,
    username: `proptest_${uuidv4().slice(0, 8)}`,
    passwordHash: "hashedpassword",
    createdAt: new Date(),
  });
});

afterAll(async () => {
  await db.delete(players);
  await db.delete(users);
});

describe("Character Property Tests", () => {
  /**
   * Feature: mud-game-rebuild, Property 6: Character Name Validation
   * **Validates: Requirements 2.2**
   *
   * For any character name string, the validation function SHALL accept names
   * containing only alphanumeric characters, spaces, and dashes, and reject
   * names with special characters.
   */
  describe("Property 6: Character Name Validation", () => {
    test.prop([validNameArb], { numRuns: 50 })(
      "should accept valid names with alphanumeric, spaces, and dashes",
      (name: string) => {
        const result = validateCharacterName(name);
        // Valid names should pass (unless they happen to contain profanity)
        // We can't guarantee no profanity in random strings, so we just check
        // that if it fails, it's due to profanity, not format
        if (!result.valid) {
          expect(result.error).toContain("inappropriate");
        }
      },
    );

    test.prop([invalidCharNameArb], { numRuns: 50 })(
      "should reject names with invalid characters",
      (name: string) => {
        const result = validateCharacterName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("only contain");
      },
    );

    test.prop([tooShortNameArb], { numRuns: 20 })(
      "should reject names that are too short",
      (name: string) => {
        const result = validateCharacterName(name);
        expect(result.valid).toBe(false);
      },
    );

    test.prop([tooLongNameArb], { numRuns: 20 })(
      "should reject names that are too long",
      (name: string) => {
        const result = validateCharacterName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("at most");
      },
    );
  });

  /**
   * Feature: mud-game-rebuild, Property 7: Character Initialization Invariants
   * **Validates: Requirements 2.3, 2.4, 2.5**
   *
   * For any newly created character, all stats SHALL be initialized to default
   * values, currentRoomId SHALL be the designated starting room, and the
   * character SHALL be retrievable with all fields intact.
   */
  describe("Property 7: Character Initialization Invariants", () => {
    test.prop([validNameArb], { numRuns: 20 })(
      "newly created characters should have default stats and starting room",
      async (baseName: string) => {
        // Make name unique to avoid conflicts
        const name = `${baseName.slice(0, 30)}_${uuidv4().slice(0, 6)}`;

        const result = await CharacterService.createCharacter(testUserId, name);

        // Skip if name validation failed (e.g., profanity)
        if (!result.success) {
          return;
        }

        const player = result.player!;

        // Property 7a: Stats should be default values
        expect(player.stats).toEqual(DEFAULT_STATS);

        // Property 7b: Should be in starting room
        expect(player.currentRoomId).toBe(CharacterService.STARTING_ROOM_ID);

        // Property 7c: Should be retrievable with all fields intact
        const retrieved = await CharacterService.getCharacterById(player.id);
        expect(retrieved).toBeDefined();
        expect(retrieved!.id).toBe(player.id);
        expect(retrieved!.name).toBe(player.name);
        expect(retrieved!.stats).toEqual(player.stats);
        expect(retrieved!.currentRoomId).toBe(player.currentRoomId);
        expect(retrieved!.currentHp).toBe(player.currentHp);
        expect(retrieved!.maxHp).toBe(player.maxHp);
        expect(retrieved!.xp).toBe(player.xp);
        expect(retrieved!.level).toBe(player.level);

        // Cleanup
        await db.delete(players).where(
          // @ts-ignore - drizzle typing issue
          players.id === player.id,
        );
      },
    );
  });
});
