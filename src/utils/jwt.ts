import jwt from "jsonwebtoken";
import type { JWTPayload } from "../types/auth.js";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const JWT_EXPIRES_IN = "7d";

/**
 * Generate a JWT token for a user
 * @param userId - The user's ID
 * @param username - The user's username
 * @returns The signed JWT token
 */
export function generateToken(userId: string, username: string): string {
  const payload: Omit<JWTPayload, "iat" | "exp"> = {
    userId,
    username,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 * @param token - The JWT token to verify
 * @returns The decoded payload if valid, null if invalid
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Decode a JWT token without verifying (for inspection)
 * @param token - The JWT token to decode
 * @returns The decoded payload or null if malformed
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload | null;
    return decoded;
  } catch {
    return null;
  }
}
