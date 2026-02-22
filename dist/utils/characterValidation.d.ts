export declare const NAME_MIN_LENGTH = 2;
export declare const NAME_MAX_LENGTH = 60;
export type NameValidationResult = {
    valid: boolean;
    error?: string;
};
/**
 * Validate a character name
 * - Must be 2-60 characters
 * - Only alphanumeric, spaces, and dashes allowed
 * - No profanity
 * - Cannot be only spaces/dashes
 */
export declare function validateCharacterName(name: string): NameValidationResult;
/**
 * Check if text contains profanity (for potential future use in chat)
 */
export declare function containsProfanity(text: string): boolean;
//# sourceMappingURL=characterValidation.d.ts.map