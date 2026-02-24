import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  containers,
  features,
  items,
  playerInventory,
  players,
} from "../db/schema.js";
import type { Container } from "../types/container.js";
import type {
  EffectResult,
  Feature,
  FeatureCondition,
} from "../types/feature.js";
import { stripFillerWords } from "../utils/text.js";
import * as EffectHandler from "./EffectHandler.js";

/** Time in milliseconds for hidden features to re-hide (2 hours) */
const REHIDE_TIMEOUT_MS = EffectHandler.REHIDE_TIMEOUT_MS;

/**
 * Convert a database feature row to a Feature type
 */
function toFeature(row: typeof features.$inferSelect): Feature {
  return {
    id: row.id,
    roomId: row.roomId,
    name: row.name,
    description: row.description,
    triggerVerbs: row.triggerVerbs || [],
    triggerTarget: row.triggerTarget || "",
    condition: row.condition,
    successMessage: row.successMessage ?? undefined,
    failureMessage: row.failureMessage ?? undefined,
    successEffects: row.successEffects ?? undefined,
    failureEffects: row.failureEffects ?? undefined,
    revealsFeatureId: row.revealsFeatureId ?? undefined,
    revealsContainerId: row.revealsContainerId ?? undefined,
    isHidden: row.isHidden,
    revealedAt: row.revealedAt ?? undefined,
    isDiscovered: row.isDiscovered ?? false,
    refuseGetMessage: row.refuseGetMessage ?? undefined,
    refuseDropMessage: row.refuseDropMessage ?? undefined,
  };
}

/**
 * Convert a database container row to a Container type
 */
function toContainer(row: typeof containers.$inferSelect): Container {
  return {
    id: row.id,
    roomId: row.roomId,
    name: row.name,
    description: row.description,
    isHidden: row.isHidden,
    revealedAt: row.revealedAt ?? undefined,
    isOpen: row.isOpen ?? false,
    revealCommand: row.revealCommand ?? undefined,
  };
}

/**
 * Check if a feature/container should be re-hidden based on time
 * @param revealedAt - When it was revealed
 * @returns true if it should be re-hidden
 */
function shouldRehide(revealedAt: Date | undefined): boolean {
  if (!revealedAt) return false;
  const elapsed = Date.now() - revealedAt.getTime();
  return elapsed >= REHIDE_TIMEOUT_MS;
}

/**
 * Get all visible features in a room
 * @param roomId - The room to get features from
 * @param includeHidden - If true, include hidden features (for admin/debug)
 * @returns Array of visible features
 */
export async function getFeaturesInRoom(
  roomId: string,
  includeHidden: boolean = false,
): Promise<Feature[]> {
  const rows = await db
    .select()
    .from(features)
    .where(eq(features.roomId, roomId));

  const result: Feature[] = [];

  for (const row of rows) {
    const feature = toFeature(row);

    // Skip if hidden and not including hidden
    if (!includeHidden) {
      // isHidden = null means never hidden (always visible)
      // isHidden = false means currently visible
      // isHidden = true means currently hidden
      if (feature.isHidden === true) {
        continue;
      }
    }

    result.push(feature);
  }

  return result;
}

/**
 * Find a feature by name (for examine/look commands)
 * @param roomId - The room to search in
 * @param name - The name to match against feature names
 * @returns The matching feature or null
 */
export async function findFeatureByName(
  roomId: string,
  name: string,
): Promise<Feature | null> {
  const roomFeatures = await getFeaturesInRoom(roomId, false);
  const nameLower = name.toLowerCase();

  for (const feature of roomFeatures) {
    const featureName = feature.name.toLowerCase();
    // Match full name, or partial match (e.g., "fountain" matches "stone fountain")
    if (
      featureName === nameLower ||
      featureName.includes(nameLower) ||
      nameLower.includes(featureName)
    ) {
      return feature;
    }
  }

  return null;
}

/**
 * Find a feature by command (verb + target)
 * @param roomId - The room to search in
 * @param verb - The action verb (e.g., "pull", "move", "search")
 * @param target - The target noun (e.g., "lever", "leaves", "painting")
 * @returns The matching feature or null
 */
export async function findFeatureByCommand(
  roomId: string,
  verb: string,
  target: string,
): Promise<Feature | null> {
  const roomFeatures = await getFeaturesInRoom(roomId, false);

  const verbLower = verb.toLowerCase();
  const targetLower = stripFillerWords(target);

  for (const feature of roomFeatures) {
    // Check if verb matches any trigger verb
    const verbMatches = feature.triggerVerbs.some(
      (v) => v.toLowerCase() === verbLower,
    );

    if (!verbMatches) continue;

    // Check if target matches (exact or prefix)
    const featureTarget = feature.triggerTarget.toLowerCase();

    if (
      featureTarget === targetLower ||
      featureTarget.startsWith(targetLower) ||
      targetLower.includes(featureTarget)
    ) {
      return feature;
    }
  }

  return null;
}

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
 * Check a stat-based condition
 */
async function checkStatCondition(
  playerId: string,
  condition: Extract<FeatureCondition, { type: "stat_check" }>,
): Promise<{ passed: boolean; roll?: number }> {
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) {
    return { passed: false };
  }

  // Simple check: stat value >= DC
  // TODO: Add d20 roll + modifier when combat system is implemented
  const statValue = player[condition.stat];
  const passed = statValue >= condition.dc;

  return { passed, roll: statValue };
}

/**
 * Check an item-required condition
 */
async function checkItemCondition(
  playerId: string,
  condition: Extract<FeatureCondition, { type: "item_required" }>,
): Promise<{ passed: boolean; itemName?: string }> {
  // Check if player has the required item
  const inventoryEntry = await db
    .select()
    .from(playerInventory)
    .innerJoin(items, eq(playerInventory.itemId, items.id))
    .where(
      and(
        eq(playerInventory.playerId, playerId),
        eq(playerInventory.itemId, condition.itemId),
      ),
    )
    .get();

  if (!inventoryEntry) {
    // Get item name for error message
    const item = await db
      .select()
      .from(items)
      .where(eq(items.id, condition.itemId))
      .get();
    return { passed: false, itemName: item?.name };
  }

  // If consumeItem is true, remove the item on attempt (not just success)
  if (condition.consumeItem) {
    if (inventoryEntry.player_inventory.quantity <= 1) {
      await db
        .delete(playerInventory)
        .where(eq(playerInventory.id, inventoryEntry.player_inventory.id));
    } else {
      await db
        .update(playerInventory)
        .set({ quantity: inventoryEntry.player_inventory.quantity - 1 })
        .where(eq(playerInventory.id, inventoryEntry.player_inventory.id));
    }
  }

  return { passed: true, itemName: inventoryEntry.items.name };
}

/**
 * Check a riddle condition
 */
function checkRiddleCondition(
  condition: Extract<FeatureCondition, { type: "riddle" }>,
  answer?: string,
): { passed: boolean; needsAnswer: boolean } {
  if (!answer) {
    return { passed: false, needsAnswer: true };
  }

  const answerLower = answer.toLowerCase().trim();
  const passed = condition.answers.some(
    (a) => a.toLowerCase().trim() === answerLower,
  );

  return { passed, needsAnswer: false };
}

/**
 * Reveal a hidden feature (set isHidden to false and record revealedAt)
 * @param featureId - The feature to reveal
 * @returns The revealed feature
 */
export async function revealFeature(
  featureId: string,
): Promise<Feature | null> {
  const feature = await db
    .select()
    .from(features)
    .where(eq(features.id, featureId))
    .get();

  if (!feature) {
    return null;
  }

  await db
    .update(features)
    .set({ isHidden: false, revealedAt: new Date() })
    .where(eq(features.id, featureId));

  return toFeature({ ...feature, isHidden: false, revealedAt: new Date() });
}

/**
 * Reveal a hidden container (set isHidden to false and record revealedAt)
 * @param containerId - The container to reveal
 * @returns The revealed container
 */
export async function revealContainer(
  containerId: string,
): Promise<Container | null> {
  const container = await db
    .select()
    .from(containers)
    .where(eq(containers.id, containerId))
    .get();

  if (!container) {
    return null;
  }

  await db
    .update(containers)
    .set({ isHidden: false, revealedAt: new Date() })
    .where(eq(containers.id, containerId));

  return toContainer({
    ...container,
    isHidden: false,
    revealedAt: new Date(),
  });
}

/**
 * Interact with a feature
 * @param playerId - The player interacting
 * @param feature - The feature to interact with
 * @param input - Optional input (for riddle answers)
 * @returns Interaction result
 */
export async function interactWithFeature(
  playerId: string,
  feature: Feature,
  input?: string,
): Promise<FeatureInteractionResult> {
  const effectsApplied: EffectResult[] = [];
  let revealedFeature: Feature | undefined;
  let revealedContainer: Container | undefined;

  // Check condition if present
  if (feature.condition) {
    let passed = false;
    let failMessage = feature.failureMessage || "You failed.";

    switch (feature.condition.type) {
      case "stat_check": {
        const result = await checkStatCondition(playerId, feature.condition);
        passed = result.passed;
        if (!passed) {
          failMessage =
            feature.failureMessage ||
            `You need higher ${feature.condition.stat.toUpperCase()} to do that.`;
        }
        break;
      }

      case "item_required": {
        const result = await checkItemCondition(playerId, feature.condition);
        passed = result.passed;
        if (!passed) {
          failMessage = `You need ${result.itemName ? `a ${result.itemName}` : "a specific item"} to do that.`;
        }
        break;
      }

      case "riddle": {
        const result = checkRiddleCondition(feature.condition, input);
        if (result.needsAnswer) {
          return {
            success: false,
            message: feature.condition.question,
            effectsApplied: [],
            awaitingRiddleAnswer: true,
            riddleQuestion: feature.condition.question,
          };
        }
        passed = result.passed;
        if (!passed) {
          failMessage =
            feature.failureMessage || "That is not the correct answer.";
        }
        break;
      }
    }

    // Handle failure
    if (!passed) {
      // Apply failure effects if any
      if (feature.failureEffects && feature.failureEffects.length > 0) {
        const failEffects = await EffectHandler.apply(
          playerId,
          feature.failureEffects,
        );
        effectsApplied.push(...failEffects);
      }

      return {
        success: false,
        message: failMessage,
        effectsApplied,
      };
    }
  }

  // Success! Apply success effects
  if (feature.successEffects && feature.successEffects.length > 0) {
    const successEffects = await EffectHandler.apply(
      playerId,
      feature.successEffects,
    );
    effectsApplied.push(...successEffects);
  }

  // Reveal any hidden features/containers
  if (feature.revealsFeatureId) {
    revealedFeature =
      (await revealFeature(feature.revealsFeatureId)) ?? undefined;
  }

  if (feature.revealsContainerId) {
    revealedContainer =
      (await revealContainer(feature.revealsContainerId)) ?? undefined;
  }

  // Mark feature as discovered
  await db
    .update(features)
    .set({ isDiscovered: true })
    .where(eq(features.id, feature.id));

  const message = feature.successMessage || "Success!";

  return {
    success: true,
    message,
    effectsApplied,
    revealedFeature,
    revealedContainer,
  };
}

/**
 * Check and re-hide features/containers in a room if enough time has passed
 * and no players are present. Called when a player enters a room.
 * @param roomId - The room to check
 * @param playerCount - Number of players currently in the room
 */
export async function checkRehideOnRoomEntry(
  roomId: string,
  playerCount: number,
): Promise<void> {
  // Only re-hide if room is empty (the entering player hasn't been counted yet)
  if (playerCount > 0) {
    return;
  }

  // Check features that were revealed and might need re-hiding
  const roomFeatures = await db
    .select()
    .from(features)
    .where(eq(features.roomId, roomId));

  for (const feature of roomFeatures) {
    // Only re-hide if:
    // - isHidden is false (currently visible)
    // - revealedAt is set (was revealed, not permanently visible)
    // - enough time has passed
    if (
      feature.isHidden === false &&
      feature.revealedAt &&
      shouldRehide(feature.revealedAt)
    ) {
      await db
        .update(features)
        .set({ isHidden: true, revealedAt: null })
        .where(eq(features.id, feature.id));
    }
  }

  // Check containers
  const roomContainers = await db
    .select()
    .from(containers)
    .where(eq(containers.roomId, roomId));

  for (const container of roomContainers) {
    if (
      container.isHidden === false &&
      container.revealedAt &&
      shouldRehide(container.revealedAt)
    ) {
      await db
        .update(containers)
        .set({ isHidden: true, revealedAt: null })
        .where(eq(containers.id, container.id));
    }
  }
}

/**
 * Get visible containers in a room
 * @param roomId - The room to get containers from
 * @returns Array of visible containers
 */
export async function getContainersInRoom(
  roomId: string,
): Promise<Container[]> {
  const rows = await db
    .select()
    .from(containers)
    .where(
      and(
        eq(containers.roomId, roomId),
        or(eq(containers.isHidden, false), isNull(containers.isHidden)),
      ),
    );

  return rows.map(toContainer);
}
