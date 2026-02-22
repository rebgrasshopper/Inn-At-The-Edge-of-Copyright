import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const JWT_EXPIRES_IN = "7d";
/**
 * Generate a JWT token for a user
 * @param userId - The user's ID
 * @param username - The user's username
 * @returns The signed JWT token
 */
export function generateToken(userId, username) {
    const payload = {
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
export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    }
    catch {
        return null;
    }
}
/**
 * Decode a JWT token without verifying (for inspection)
 * @param token - The JWT token to decode
 * @returns The decoded payload or null if malformed
 */
export function decodeToken(token) {
    try {
        const decoded = jwt.decode(token);
        return decoded;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=jwt.js.map