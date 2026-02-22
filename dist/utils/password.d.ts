/**
 * Hash a plaintext password using bcrypt
 * @param password - The plaintext password to hash
 * @returns The hashed password
 */
export declare function hashPassword(password: string): Promise<string>;
/**
 * Verify a plaintext password against a hash
 * @param password - The plaintext password to verify
 * @param hash - The hash to verify against
 * @returns True if the password matches the hash
 */
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
//# sourceMappingURL=password.d.ts.map