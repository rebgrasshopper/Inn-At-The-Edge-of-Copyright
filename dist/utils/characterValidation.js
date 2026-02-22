import { englishDataset, englishRecommendedTransformers, RegExpMatcher, } from "obscenity";
// Configure the profanity matcher with English dataset
const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
});
// Character name constraints
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 60;
// Allowed characters: alphanumeric, spaces, and dashes
const NAME_PATTERN = /^[a-zA-Z0-9 -]+$/;
/**
 * Validate a character name
 * - Must be 2-60 characters
 * - Only alphanumeric, spaces, and dashes allowed
 * - No profanity
 * - Cannot be only spaces/dashes
 */
export function validateCharacterName(name) {
    // Trim and check for empty
    const trimmed = name.trim();
    if (!trimmed) {
        return { valid: false, error: "Character name is required" };
    }
    // Length check
    if (trimmed.length < NAME_MIN_LENGTH) {
        return {
            valid: false,
            error: `Character name must be at least ${NAME_MIN_LENGTH} characters`,
        };
    }
    if (trimmed.length > NAME_MAX_LENGTH) {
        return {
            valid: false,
            error: `Character name must be at most ${NAME_MAX_LENGTH} characters`,
        };
    }
    // Character pattern check
    if (!NAME_PATTERN.test(trimmed)) {
        return {
            valid: false,
            error: "Character name can only contain letters, numbers, spaces, and dashes",
        };
    }
    // Must contain at least one letter or number (not just spaces/dashes)
    if (!/[a-zA-Z0-9]/.test(trimmed)) {
        return {
            valid: false,
            error: "Character name must contain at least one letter or number",
        };
    }
    // Profanity check
    if (matcher.hasMatch(trimmed)) {
        return {
            valid: false,
            error: "Character name contains inappropriate language",
        };
    }
    return { valid: true };
}
/**
 * Check if text contains profanity (for potential future use in chat)
 */
export function containsProfanity(text) {
    return matcher.hasMatch(text);
}
//# sourceMappingURL=characterValidation.js.map