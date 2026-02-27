import { test } from "@fast-check/vitest";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { afterAll, beforeAll, describe, expect } from "vitest";
import { db } from "../../src/db/index.js";
import { players, users } from "../../src/db/schema.js";
import * as AuthService from "../../src/services/AuthService.js";
import { verifyToken } from "../../src/utils/jwt.js";
import { verifyPassword } from "../../src/utils/password.js";
import {
  passwordArb,
  usernameArb,
  wrongPasswordArb,
} from "../generators/auth.generator.js";

// Clean up before and after all tests
beforeAll(async () => {
  await db.delete(players);
  await db.delete(users);
});

afterAll(async () => {
  await db.delete(players);
  await db.delete(users);
});

describe("Auth Property Tests", () => {
  /**
   * Feature: mud-game-rebuild, Property 1: Password Storage Security
   * **Validates: Requirements 1.1, 1.6**
   *
   * For any user registration with a plaintext password, the stored password hash
   * SHALL NOT equal the plaintext password, and the hash SHALL be verifiable
   * against the original password using bcrypt.
   */
  describe("Property 1: Password Storage Security", () => {
    test.prop([passwordArb], { numRuns: 20 })(
      "password hash should never equal plaintext and should be verifiable with bcrypt",
      async (password: string) => {
        const username = `prop1_${uuidv4().slice(0, 8)}`;
        const result = await AuthService.register(username, password);
        expect(result.success).toBe(true);

        const user = db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .get();

        expect(user).toBeDefined();
        // Property 1a: Hash should NOT equal plaintext
        expect(user!.passwordHash).not.toBe(password);

        // Property 1b: Hash should be verifiable with bcrypt
        const isValid = await verifyPassword(password, user!.passwordHash);
        expect(isValid).toBe(true);

        await db.delete(users).where(eq(users.username, username));
      },
    );
  });

  /**
   * Feature: mud-game-rebuild, Property 2: Authentication Round-Trip
   * **Validates: Requirements 1.2, 1.4**
   *
   * For any registered user with valid credentials, logging in SHALL return
   * a valid JWT token and player data that matches the stored character data.
   */
  describe("Property 2: Authentication Round-Trip", () => {
    test.prop([usernameArb, passwordArb], { numRuns: 20 })(
      "valid credentials should return JWT token and matching player data",
      async (baseUsername: string, password: string) => {
        const username = `prop2_${baseUsername}_${uuidv4().slice(0, 6)}`;
        const registerResult = await AuthService.register(username, password);
        expect(registerResult.success).toBe(true);

        const payload = verifyToken(registerResult.token!);
        expect(payload).toBeDefined();

        const playerId = uuidv4();
        const playerName = `Player_${uuidv4().slice(0, 8)}`;
        const roomId = `room_${uuidv4().slice(0, 8)}`;
        const stats = { str: 12, dex: 14, con: 10, int: 11, wis: 13, cha: 10 };

        await db.insert(players).values({
          id: playerId,
          userId: payload!.userId,
          name: playerName,
          currentRoomId: roomId,
          ...stats,
          currentHp: 20,
          maxHp: 20,
          xp: 0,
          level: 1,
          unspentAttributePoints: 0,
          isOnline: false,
          createdAt: new Date(),
        });

        const loginResult = await AuthService.login(username, password);

        // Property 2a: Should return success with valid token
        expect(loginResult.success).toBe(true);
        expect(loginResult.token).toBeDefined();

        const loginPayload = verifyToken(loginResult.token!);
        expect(loginPayload).toBeDefined();
        expect(loginPayload!.username).toBe(username);

        // Property 2b: Player data should match stored data
        expect(loginResult.player).toBeDefined();
        expect(loginResult.player!.id).toBe(playerId);
        expect(loginResult.player!.name).toBe(playerName);
        expect(loginResult.player!.currentRoomId).toBe(roomId);
        expect(loginResult.player!.stats.str).toBe(stats.str);
        expect(loginResult.player!.stats.dex).toBe(stats.dex);

        await db.delete(players).where(eq(players.id, playerId));
        await db.delete(users).where(eq(users.username, username));
      },
    );
  });

  /**
   * Feature: mud-game-rebuild, Property 3: Invalid Credentials Rejection
   * **Validates: Requirements 1.3**
   *
   * For any registered user, attempting to login with an incorrect password
   * SHALL fail and return an error, never returning a valid token.
   */
  describe("Property 3: Invalid Credentials Rejection", () => {
    test.prop([usernameArb, passwordArb, wrongPasswordArb], { numRuns: 20 })(
      "incorrect password should always fail and never return a token",
      async (
        baseUsername: string,
        correctPassword: string,
        wrongPassword: string,
      ) => {
        // Skip if passwords are the same
        if (correctPassword === wrongPassword) return;

        const username = `prop3_${baseUsername}_${uuidv4().slice(0, 6)}`;
        const registerResult = await AuthService.register(
          username,
          correctPassword,
        );
        expect(registerResult.success).toBe(true);

        const loginResult = await AuthService.login(username, wrongPassword);

        // Property 3: Should fail and NEVER return a token
        expect(loginResult.success).toBe(false);
        expect(loginResult.error).toBe("Invalid username or password");
        expect(loginResult.token).toBeUndefined();
        expect(loginResult.player).toBeUndefined();

        await db.delete(users).where(eq(users.username, username));
      },
    );
  });
});
