import type { JWTPayload } from "../types/auth.js";
/**
 * Generate a JWT token for a user
 * @param userId - The user's ID
 * @param username - The user's username
 * @returns The signed JWT token
 */
export declare function generateToken(userId: string, username: string): string;
/**
 * Verify and decode a JWT token
 * @param token - The JWT token to verify
 * @returns The decoded payload if valid, null if invalid
 */
export declare function verifyToken(token: string): JWTPayload | null;
/**
 * Decode a JWT token without verifying (for inspection)
 * @param token - The JWT token to decode
 * @returns The decoded payload or null if malformed
 */
export declare function decodeToken(token: string): JWTPayload | null;
//# sourceMappingURL=jwt.d.ts.map