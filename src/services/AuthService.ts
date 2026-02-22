import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { players, users } from "../db/schema.js";
import type { AuthResult } from "../types/auth.js";
import type { Player } from "../types/player.js";
import { generateToken, verifyToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { toPlayer } from "./CharacterService.utils.js";

// In-memory store for invalidated tokens (for logout)
// In production, consider using Redis or database storage
const invalidatedTokens = new Set<string>();

/**
 * Register a new user account
 * @param username - The desired username
 * @param password - The plaintext password
 * @returns AuthResult with success status and token if successful
 */
export async function register(
  username: string,
  password: string,
): Promise<AuthResult> {
  try {
    // Check if username already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .get();

    if (existingUser) {
      return {
        success: false,
        error: "Username already exists",
      };
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Create the user
    const userId = uuidv4();
    await db.insert(users).values({
      id: userId,
      username,
      passwordHash,
      createdAt: new Date(),
    });

    // Generate token
    const token = generateToken(userId, username);

    return {
      success: true,
      token,
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      error: "Registration failed",
    };
  }
}

/**
 * Login with username and password
 * @param username - The username
 * @param password - The plaintext password
 * @returns AuthResult with token and player data if successful
 */
export async function login(
  username: string,
  password: string,
): Promise<AuthResult> {
  try {
    // Find user by username
    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .get();

    if (!user) {
      return {
        success: false,
        error: "Invalid username or password",
      };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return {
        success: false,
        error: "Invalid username or password",
      };
    }

    // Generate token
    const token = generateToken(user.id, user.username);

    // Find player associated with this user (if exists)
    const playerRecord = await db
      .select()
      .from(players)
      .where(eq(players.userId, user.id))
      .get();

    let player: Player | undefined;
    if (playerRecord) {
      player = toPlayer(playerRecord);
    }

    return {
      success: true,
      token,
      player,
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: "Login failed",
    };
  }
}

/**
 * Validate a JWT token and return the associated player
 * @param token - The JWT token to validate
 * @returns The player if token is valid, null otherwise
 */
export async function validateToken(token: string): Promise<Player | null> {
  try {
    // Check if token has been invalidated (logged out)
    if (invalidatedTokens.has(token)) {
      return null;
    }

    // Verify the token
    const payload = verifyToken(token);
    if (!payload) {
      return null;
    }

    // Find the user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .get();

    if (!user) {
      return null;
    }

    // Find the player associated with this user
    const playerRecord = await db
      .select()
      .from(players)
      .where(eq(players.userId, user.id))
      .get();

    if (!playerRecord) {
      return null;
    }

    return toPlayer(playerRecord);
  } catch (error) {
    console.error("Token validation error:", error);
    return null;
  }
}

/**
 * Logout a user by invalidating their token
 * @param token - The JWT token to invalidate
 */
export async function logout(token: string): Promise<void> {
  // Add token to invalidated set
  invalidatedTokens.add(token);

  // Try to get the player and set them offline
  try {
    const payload = verifyToken(token);
    if (payload) {
      const playerRecord = await db
        .select()
        .from(players)
        .where(eq(players.userId, payload.userId))
        .get();

      if (playerRecord) {
        await db
          .update(players)
          .set({ isOnline: false })
          .where(eq(players.id, playerRecord.id));
      }
    }
  } catch (error) {
    console.error("Logout error:", error);
  }
}

/**
 * Check if a token has been invalidated
 * @param token - The token to check
 * @returns True if the token is invalidated
 */
export function isTokenInvalidated(token: string): boolean {
  return invalidatedTokens.has(token);
}

/**
 * Validate a JWT token and return the userId (without requiring a player)
 * Used for routes like character creation where user exists but player doesn't yet
 * @param token - The JWT token to validate
 * @returns The userId if token is valid, null otherwise
 */
export async function validateTokenForUserId(
  token: string,
): Promise<string | null> {
  try {
    // Check if token has been invalidated (logged out)
    if (invalidatedTokens.has(token)) {
      return null;
    }

    // Verify the token
    const payload = verifyToken(token);
    if (!payload) {
      return null;
    }

    // Find the user to confirm they exist
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .get();

    if (!user) {
      return null;
    }

    return payload.userId;
  } catch (error) {
    console.error("Token validation error:", error);
    return null;
  }
}
