import type { AuthResult } from "../types/auth.js";
import type { Player } from "../types/player.js";
/**
 * Register a new user account
 * @param username - The desired username
 * @param password - The plaintext password
 * @returns AuthResult with success status and token if successful
 */
export declare function register(username: string, password: string): Promise<AuthResult>;
/**
 * Login with username and password
 * @param username - The username
 * @param password - The plaintext password
 * @returns AuthResult with token and player data if successful
 */
export declare function login(username: string, password: string): Promise<AuthResult>;
/**
 * Validate a JWT token and return the associated player
 * @param token - The JWT token to validate
 * @returns The player if token is valid, null otherwise
 */
export declare function validateToken(token: string): Promise<Player | null>;
/**
 * Logout a user by invalidating their token
 * @param token - The JWT token to invalidate
 */
export declare function logout(token: string): Promise<void>;
/**
 * Check if a token has been invalidated
 * @param token - The token to check
 * @returns True if the token is invalidated
 */
export declare function isTokenInvalidated(token: string): boolean;
/**
 * Validate a JWT token and return the userId (without requiring a player)
 * Used for routes like character creation where user exists but player doesn't yet
 * @param token - The JWT token to validate
 * @returns The userId if token is valid, null otherwise
 */
export declare function validateTokenForUserId(token: string): Promise<string | null>;
//# sourceMappingURL=AuthService.d.ts.map