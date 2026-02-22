import type { Container } from "../types/container.js";
import type { EffectResult, Feature } from "../types/feature.js";
/**
 * Get all visible features in a room
 * @param roomId - The room to get features from
 * @param includeHidden - If true, include hidden features (for admin/debug)
 * @returns Array of visible features
 */
export declare function getFeaturesInRoom(roomId: string, includeHidden?: boolean): Promise<Feature[]>;
/**
 * Find a feature by command (verb + target)
 * @param roomId - The room to search in
 * @param verb - The action verb (e.g., "pull", "move", "search")
 * @param target - The target noun (e.g., "lever", "leaves", "painting")
 * @returns The matching feature or null
 */
export declare function findFeatureByCommand(roomId: string, verb: string, target: string): Promise<Feature | null>;
/**
 * Result of a feature interaction
 */
export type FeatureInteractionResult = {
    success: boolean;
    message: string;
    effectsApplied: EffectResult[];
    revealedFeature?: Feature;
    revealedContainer?: Container;
    /** If true, the feature is waiting for a riddle answer */
    awaitingRiddleAnswer?: boolean;
    riddleQuestion?: string;
};
/**
 * Reveal a hidden feature (set isHidden to false and record revealedAt)
 * @param featureId - The feature to reveal
 * @returns The revealed feature
 */
export declare function revealFeature(featureId: string): Promise<Feature | null>;
/**
 * Reveal a hidden container (set isHidden to false and record revealedAt)
 * @param containerId - The container to reveal
 * @returns The revealed container
 */
export declare function revealContainer(containerId: string): Promise<Container | null>;
/**
 * Interact with a feature
 * @param playerId - The player interacting
 * @param feature - The feature to interact with
 * @param input - Optional input (for riddle answers)
 * @returns Interaction result
 */
export declare function interactWithFeature(playerId: string, feature: Feature, input?: string): Promise<FeatureInteractionResult>;
/**
 * Check and re-hide features/containers in a room if enough time has passed
 * and no players are present. Called when a player enters a room.
 * @param roomId - The room to check
 * @param playerCount - Number of players currently in the room
 */
export declare function checkRehideOnRoomEntry(roomId: string, playerCount: number): Promise<void>;
/**
 * Get visible containers in a room
 * @param roomId - The room to get containers from
 * @returns Array of visible containers
 */
export declare function getContainersInRoom(roomId: string): Promise<Container[]>;
//# sourceMappingURL=FeatureService.d.ts.map