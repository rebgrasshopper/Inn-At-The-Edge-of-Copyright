import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/db/index.js";
import { players, users } from "../../src/db/schema.js";
import * as AuthService from "../../src/services/AuthService.js";
import { verifyToken } from "../../src/utils/jwt.js";
import { verifyPassword } from "../../src/utils/password.js";

describe("AuthService", () => {
  const TEST_PREFIX = "authtest_";

  // Clean up test data before each test
  beforeEach(async () => {
    // Delete only test users with our prefix (and their players)
    // First get user IDs with our prefix
    const testUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`username LIKE ${TEST_PREFIX + "%"}`);

    if (testUsers.length > 0) {
      const userIds = testUsers.map((u) => u.id);
      // Delete players for these users
      for (const userId of userIds) {
        await db.delete(players).where(eq(players.userId, userId));
      }
      // Delete the users
      await db.delete(users).where(sql`username LIKE ${TEST_PREFIX + "%"}`);
    }
  });

  describe("register", () => {
    it("should create a new user with hashed password", async () => {
      const username = `authtest_${uuidv4().slice(0, 8)}`;
      const password = "testpassword123";

      const result = await AuthService.register(username, password);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.error).toBeUndefined();

      // Verify user was created in database
      const user = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .get();

      expect(user).toBeDefined();
      expect(user!.username).toBe(username);
      // Password should be hashed, not plaintext
      expect(user!.passwordHash).not.toBe(password);
      // But should verify correctly
      const isValid = await verifyPassword(password, user!.passwordHash);
      expect(isValid).toBe(true);
    });

    it("should return a valid JWT token", async () => {
      const username = `authtest_${uuidv4().slice(0, 8)}`;
      const password = "testpassword123";

      const result = await AuthService.register(username, password);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();

      // Verify token is valid
      const payload = verifyToken(result.token!);
      expect(payload).toBeDefined();
      expect(payload!.username).toBe(username);
    });

    it("should reject duplicate usernames", async () => {
      const username = `authtest_${uuidv4().slice(0, 8)}`;
      const password = "testpassword123";

      // First registration should succeed
      const result1 = await AuthService.register(username, password);
      expect(result1.success).toBe(true);

      // Second registration with same username should fail
      const result2 = await AuthService.register(username, "differentpassword");
      expect(result2.success).toBe(false);
      expect(result2.error).toBe("Username already exists");
    });
  });

  describe("login", () => {
    it("should login with valid credentials", async () => {
      const username = `authtest_${uuidv4().slice(0, 8)}`;
      const password = "testpassword123";

      // Register first
      await AuthService.register(username, password);

      // Login
      const result = await AuthService.login(username, password);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it("should reject invalid username", async () => {
      const result = await AuthService.login("nonexistent_user", "password");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid username or password");
      expect(result.token).toBeUndefined();
    });

    it("should reject invalid password", async () => {
      const username = `authtest_${uuidv4().slice(0, 8)}`;
      const password = "testpassword123";

      // Register first
      await AuthService.register(username, password);

      // Login with wrong password
      const result = await AuthService.login(username, "wrongpassword");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid username or password");
      expect(result.token).toBeUndefined();
    });

    it("should return player data if player exists", async () => {
      const username = `authtest_${uuidv4().slice(0, 8)}`;
      const password = "testpassword123";

      // Register user
      const registerResult = await AuthService.register(username, password);
      const payload = verifyToken(registerResult.token!);

      // Create a player for this user
      const playerId = uuidv4();
      await db.insert(players).values({
        id: playerId,
        userId: payload!.userId,
        name: `Player_${uuidv4().slice(0, 8)}`,
        currentRoomId: "room_1",
        str: 12,
        dex: 14,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
        currentHp: 15,
        maxHp: 15,
        xp: 100,
        level: 2,
        unspentAttributePoints: 0,
        isOnline: false,
        createdAt: new Date(),
      });

      // Login
      const result = await AuthService.login(username, password);

      expect(result.success).toBe(true);
      expect(result.player).toBeDefined();
      expect(result.player!.id).toBe(playerId);
      expect(result.player!.stats.str).toBe(12);
      expect(result.player!.stats.dex).toBe(14);
      expect(result.player!.level).toBe(2);
    });
  });

  describe("validateToken", () => {
    it("should return player for valid token", async () => {
      const username = `authtest_${uuidv4().slice(0, 8)}`;
      const password = "testpassword123";

      // Register user
      const registerResult = await AuthService.register(username, password);
      const payload = verifyToken(registerResult.token!);

      // Create a player
      const playerId = uuidv4();
      await db.insert(players).values({
        id: playerId,
        userId: payload!.userId,
        name: `Player_${uuidv4().slice(0, 8)}`,
        currentRoomId: null,
        createdAt: new Date(),
      });

      // Validate token
      const player = await AuthService.validateToken(registerResult.token!);

      expect(player).toBeDefined();
      expect(player!.id).toBe(playerId);
    });

    it("should return null for invalid token", async () => {
      const player = await AuthService.validateToken("invalid.token.here");
      expect(player).toBeNull();
    });

    it("should return null for invalidated token", async () => {
      const username = `authtest_${uuidv4().slice(0, 8)}`;
      const password = "testpassword123";

      // Register user
      const registerResult = await AuthService.register(username, password);
      const payload = verifyToken(registerResult.token!);

      // Create a player
      await db.insert(players).values({
        id: uuidv4(),
        userId: payload!.userId,
        name: `Player_${uuidv4().slice(0, 8)}`,
        currentRoomId: null,
        createdAt: new Date(),
      });

      // Logout (invalidate token)
      await AuthService.logout(registerResult.token!);

      // Validate token should now fail
      const player = await AuthService.validateToken(registerResult.token!);
      expect(player).toBeNull();
    });
  });

  describe("logout", () => {
    it("should invalidate the token", async () => {
      const username = `authtest_${uuidv4().slice(0, 8)}`;
      const password = "testpassword123";

      // Register user
      const registerResult = await AuthService.register(username, password);

      // Token should be valid initially
      expect(AuthService.isTokenInvalidated(registerResult.token!)).toBe(false);

      // Logout
      await AuthService.logout(registerResult.token!);

      // Token should now be invalidated
      expect(AuthService.isTokenInvalidated(registerResult.token!)).toBe(true);
    });

    it("should set player offline", async () => {
      const username = `authtest_${uuidv4().slice(0, 8)}`;
      const password = "testpassword123";

      // Register user
      const registerResult = await AuthService.register(username, password);
      const payload = verifyToken(registerResult.token!);

      // Create a player that is online
      const playerId = uuidv4();
      await db.insert(players).values({
        id: playerId,
        userId: payload!.userId,
        name: `Player_${uuidv4().slice(0, 8)}`,
        currentRoomId: null,
        isOnline: true,
        createdAt: new Date(),
      });

      // Logout
      await AuthService.logout(registerResult.token!);

      // Player should be offline
      const player = await db
        .select()
        .from(players)
        .where(eq(players.id, playerId))
        .get();

      expect(player!.isOnline).toBe(false);
    });
  });
});
