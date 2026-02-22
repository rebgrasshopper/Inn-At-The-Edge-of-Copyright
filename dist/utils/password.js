import bcrypt from "bcrypt";
const SALT_ROUNDS = 10;
/**
 * Hash a plaintext password using bcrypt
 * @param password - The plaintext password to hash
 * @returns The hashed password
 */
export async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}
/**
 * Verify a plaintext password against a hash
 * @param password - The plaintext password to verify
 * @param hash - The hash to verify against
 * @returns True if the password matches the hash
 */
export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
//# sourceMappingURL=password.js.map