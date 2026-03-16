import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  containers,
  features,
  items,
  playerInventory,
  players,
  spells,
} from "../db/schema.js";
import type { Container } from "../types/container.js";
import type {
  EffectResult,
  Feature,
  FeatureCondition,
} from "../types/feature.js";
import { stripFillerWords } from "../utils/text.js";
import { rollD20WithDetails } from "./DiceService.js";
import * as EffectHandler from "./EffectHandler.js";
import * as SpellService from "./SpellService.js";
import { getStatModifier } from "./StatService.js";

/** Time in milliseconds for hidden features to re-hide (2 hours) */
const REHIDE_TIMEOUT_MS = EffectHandler.REHIDE_TIMEOUT_MS;

// Re-export SpellService functions used in learnSpellFromFeature
const {
  getPlayerSpell,
  meetsIntRequirement,
  getPlayerSpells,
  getSpellCapacity,
  learnSpell,
} = SpellService;

/**
 * Convert a database feature row to a Feature type
 * @param row - Database row from features table
 * @returns Feature object
 */
function toFeature(row: typeof features.$inferSelect): Feature {
  return {
    id: row.id,
    roomId: row.roomId,
    name: row.name,
    description: row.description,
    triggerVerbs: row.triggerVerbs || [],
    triggerTarget: row.triggerTarget || "",
    triggerAliases: row.triggerAliases ?? undefined,
    condition: row.condition,
    successMessage: row.successMessage ?? undefined,
    failureMessage: row.failureMessage ?? undefined,
    successEffects: row.successEffects ?? undefined,
    failureEffects: row.failureEffects ?? undefined,
    revealsFeatureId: row.revealsFeatureId ?? undefined,
    revealsContainerId: row.revealsContainerId ?? undefined,
    revealedText: row.revealedText ?? undefined,
    isHidden: row.isHidden,
    revealedAt: row.revealedAt ?? undefined,
    isDiscovered: row.isDiscovered ?? false,
    discoveryScope: row.discoveryScope ?? undefined,
    refuseGetMessage: row.refuseGetMessage ?? undefined,
    refuseDropMessage: row.refuseDropMessage ?? undefined,
    teachesSpellId: row.teachesSpellId ?? undefined,
    perceptionDC: row.perceptionDC ?? undefined,
    perceptionHint: row.perceptionHint ?? undefined,
  };
}

/**
 * Convert a database container row to a Container type
 * @param row - Database row from containers table
 * @returns Container object
 */
function toContainer(row: typeof containers.$inferSelect): Container {
  return {
    id: row.id,
    roomId: row.roomId,
    name: row.name,
    description: row.description,
    aliases: (row.aliases as string[]) ?? undefined,
    revealedText: row.revealedText ?? undefined,
    isHidden: row.isHidden,
    revealedAt: row.revealedAt ?? undefined,
    isOpen: row.isOpen ?? false,
    revealCommand: row.revealCommand ?? undefined,
    size: row.size,
    discoveryScope: row.discoveryScope ?? undefined,
    perceptionDC: row.perceptionDC ?? undefined,
    perceptionHint: row.perceptionHint ?? undefined,
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
 * Get all visible features in a room for a specific player
 * @param roomId - The room to get features from
 * @param playerId - Optional player ID to include their personal discoveries
 * @param includeHidden - If true, include hidden features (for admin/debug)
 * @returns Array of visible features
 */
export async function getFeaturesInRoom(
  roomId: string,
  playerId?: string,
  includeHidden: boolean = false,
): Promise<Feature[]> {
  const rows = await db
    .select()
    .from(features)
    .where(eq(features.roomId, roomId));

  // Get player's personal discoveries if playerId provided
  let playerDiscoveredFeatureIds: string[] = [];
  if (playerId) {
    const player = await db
      .select({ discoveredFeatureIds: players.discoveredFeatureIds })
      .from(players)
      .where(eq(players.id, playerId))
      .get();
    playerDiscoveredFeatureIds = player?.discoveredFeatureIds || [];
  }

  const result: Feature[] = [];

  for (const row of rows) {
    const feature = toFeature(row);

    // Skip if hidden and not including hidden
    if (!includeHidden) {
      // isHidden = null means never hidden (always visible)
      // isHidden = false means currently visible (globally revealed)
      // isHidden = true means currently hidden
      if (feature.isHidden === true) {
        // Check if this is a personal discovery the player has found
        const isPersonalScope = feature.discoveryScope === "personal";
        const playerHasDiscovered = playerDiscoveredFeatureIds.includes(
          feature.id,
        );

        if (isPersonalScope && playerHasDiscovered) {
          // Player has personally discovered this feature
          result.push(feature);
        }
        // Otherwise skip - it's hidden and player hasn't discovered it
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
 * @param playerId - Optional player ID to include their personal discoveries
 * @returns The matching feature or null
 */
export async function findFeatureByName(
  roomId: string,
  name: string,
  playerId?: string,
): Promise<Feature | null> {
  const roomFeatures = await getFeaturesInRoom(roomId, playerId, false);
  const nameLower = name.toLowerCase();

  // First pass: look for exact matches (prioritize over partial)
  for (const feature of roomFeatures) {
    const featureName = feature.name.toLowerCase();
    if (featureName === nameLower) {
      return feature;
    }

    // Check triggerAliases for exact match
    if (feature.triggerAliases) {
      for (const alias of feature.triggerAliases) {
        if (alias.toLowerCase() === nameLower) {
          return feature;
        }
      }
    }
  }

  // Second pass: partial matches (e.g., "fountain" matches "stone fountain")
  for (const feature of roomFeatures) {
    const featureName = feature.name.toLowerCase();
    if (featureName.includes(nameLower) || nameLower.includes(featureName)) {
      return feature;
    }

    // Check triggerAliases for partial match
    if (feature.triggerAliases) {
      for (const alias of feature.triggerAliases) {
        const aliasLower = alias.toLowerCase();
        if (aliasLower.includes(nameLower) || nameLower.includes(aliasLower)) {
          return feature;
        }
      }
    }
  }

  return null;
}

/** Result of finding a feature by command */
export type FeatureMatchResult =
  | { type: "found"; feature: Feature }
  | { type: "ambiguous"; features: Feature[] }
  | { type: "none" };

/**
 * Find a feature by command (verb + target)
 * Returns disambiguation result when multiple features match the same verb+target.
 * @param roomId - The room to search in
 * @param verb - The action verb (e.g., "pull", "move", "search")
 * @param target - The target noun (e.g., "lever", "leaves", "painting")
 * @param playerId - Optional player ID to include their personal discoveries
 * @returns FeatureMatchResult indicating found, ambiguous, or none
 */
export async function findFeatureByCommand(
  roomId: string,
  verb: string,
  target: string,
  playerId?: string,
): Promise<FeatureMatchResult> {
  const roomFeatures = await getFeaturesInRoom(roomId, playerId, false);

  const verbLower = verb.toLowerCase();
  const targetLower = stripFillerWords(target);

  const matches: Feature[] = [];

  for (const feature of roomFeatures) {
    // Check if verb matches any trigger verb
    const verbMatches = feature.triggerVerbs.some(
      (v) => v.toLowerCase() === verbLower,
    );

    if (!verbMatches) continue;

    // Check if target matches (exact or prefix)
    const featureTarget = feature.triggerTarget.toLowerCase();

    // Support standalone commands (empty target matches empty triggerTarget)
    if (targetLower === "" && featureTarget === "") {
      matches.push(feature);
      continue;
    }

    // Skip empty targets for non-standalone features
    if (targetLower === "") continue;

    // Check primary triggerTarget
    const targetMatches =
      featureTarget === targetLower ||
      featureTarget.startsWith(targetLower) ||
      targetLower.includes(featureTarget);

    // Check triggerAliases if primary target doesn't match
    const aliasMatches =
      !targetMatches &&
      feature.triggerAliases?.some((alias) => {
        const aliasLower = alias.toLowerCase();
        return (
          aliasLower === targetLower ||
          aliasLower.startsWith(targetLower) ||
          targetLower.includes(aliasLower)
        );
      });

    if (targetMatches || aliasMatches) {
      matches.push(feature);
    }
  }

  if (matches.length === 0) {
    return { type: "none" };
  }

  if (matches.length === 1) {
    return { type: "found", feature: matches[0] };
  }

  return { type: "ambiguous", features: matches };
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
  /** Roll details for display (e.g., "d20+2 = 15 vs DC 12") */
  rollInfo?: string;
};

/**
 * Check a stat-based condition using d20 + stat modifier vs DC
 * @param playerId - The player attempting the check
 * @param condition - The stat check condition with stat and DC
 * @returns Whether the check passed and the roll formula for display
 */
async function checkStatCondition(
  playerId: string,
  condition: Extract<FeatureCondition, { type: "stat_check" }>,
): Promise<{ passed: boolean; rollFormula?: string }> {
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) {
    return { passed: false };
  }

  // Roll d20 + stat modifier vs DC
  const statValue = player[condition.stat];
  const modifier = getStatModifier(statValue);
  const result = rollD20WithDetails(modifier);
  const passed = result.total >= condition.dc;

  return { passed, rollFormula: result.formula };
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
 * Add a feature to a player's personal discoveries
 * @param playerId - The player who discovered the feature
 * @param featureId - The feature that was discovered
 */
async function addPersonalFeatureDiscovery(
  playerId: string,
  featureId: string,
): Promise<void> {
  const player = await db
    .select({ discoveredFeatureIds: players.discoveredFeatureIds })
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  const currentIds = player?.discoveredFeatureIds || [];
  if (!currentIds.includes(featureId)) {
    await db
      .update(players)
      .set({ discoveredFeatureIds: [...currentIds, featureId] })
      .where(eq(players.id, playerId));
  }
}

/**
 * Add a container to a player's personal discoveries
 * @param playerId - The player who discovered the container
 * @param containerId - The container that was discovered
 */
async function addPersonalContainerDiscovery(
  playerId: string,
  containerId: string,
): Promise<void> {
  const player = await db
    .select({ discoveredContainerIds: players.discoveredContainerIds })
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  const currentIds = player?.discoveredContainerIds || [];
  if (!currentIds.includes(containerId)) {
    await db
      .update(players)
      .set({ discoveredContainerIds: [...currentIds, containerId] })
      .where(eq(players.id, playerId));
  }
}

/**
 * Reveal a hidden feature (global or personal based on discoveryScope)
 * @param featureId - The feature to reveal
 * @param playerId - The player revealing the feature (required for personal scope)
 * @returns The revealed feature
 */
export async function revealFeature(
  featureId: string,
  playerId?: string,
): Promise<Feature | null> {
  const feature = await db
    .select()
    .from(features)
    .where(eq(features.id, featureId))
    .get();

  if (!feature) {
    return null;
  }

  const isPersonalScope = feature.discoveryScope === "personal";

  if (isPersonalScope && playerId) {
    // Personal discovery: add to player's discovered list, don't change global state
    await addPersonalFeatureDiscovery(playerId, featureId);
    return toFeature(feature);
  } else {
    // Global discovery: update the feature's global visibility
    await db
      .update(features)
      .set({ isHidden: false, revealedAt: new Date() })
      .where(eq(features.id, featureId));

    return toFeature({ ...feature, isHidden: false, revealedAt: new Date() });
  }
}

/**
 * Reveal a hidden container (global or personal based on discoveryScope)
 * @param containerId - The container to reveal
 * @param playerId - The player revealing the container (required for personal scope)
 * @returns The revealed container
 */
export async function revealContainer(
  containerId: string,
  playerId?: string,
): Promise<Container | null> {
  const container = await db
    .select()
    .from(containers)
    .where(eq(containers.id, containerId))
    .get();

  if (!container) {
    return null;
  }

  const isPersonalScope = container.discoveryScope === "personal";

  if (isPersonalScope && playerId) {
    // Personal discovery: add to player's discovered list, don't change global state
    await addPersonalContainerDiscovery(playerId, containerId);
    return toContainer(container);
  } else {
    // Global discovery: update the container's global visibility
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
}

/**
 * Attempt to learn a spell from a feature's teachesSpellId
 * Checks INT requirement, spell capacity, and whether already known.
 * @param playerId - The player learning the spell
 * @param spellId - The spell ID to learn
 * @returns EffectResult with success status and message
 */
async function learnSpellFromFeature(
  playerId: string,
  spellId: string,
): Promise<EffectResult> {
  // Get the spell
  const spell = await db
    .select()
    .from(spells)
    .where(eq(spells.id, spellId))
    .get();

  if (!spell) {
    return {
      type: "learn_spell",
      success: false,
      message: "The spell seems to be missing from this book.",
    };
  }

  // Get player stats
  const player = await db
    .select({ int: players.int })
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) {
    return {
      type: "learn_spell",
      success: false,
      message: "Player not found.",
    };
  }

  // Check if already known
  const existingSpell = await getPlayerSpell(playerId, spellId);
  if (existingSpell) {
    return {
      type: "learn_spell",
      success: false,
      message: `You already know ${spell.name}.`,
    };
  }

  // Check INT requirement
  if (!meetsIntRequirement(player.int, spell.minInt)) {
    return {
      type: "learn_spell",
      success: false,
      message: `You need at least ${spell.minInt} INT to learn ${spell.name}. (You have ${player.int})`,
    };
  }

  // Check spell capacity
  const knownSpells = await getPlayerSpells(playerId);
  const capacity = getSpellCapacity(player.int);
  if (knownSpells.length >= capacity) {
    return {
      type: "learn_spell",
      success: false,
      message: `You cannot learn any more spells. (Capacity: ${capacity}, Known: ${knownSpells.length})`,
    };
  }

  // Learn the spell
  const learned = await learnSpell(playerId, spellId);
  if (!learned) {
    return {
      type: "learn_spell",
      success: false,
      message: "Failed to learn the spell.",
    };
  }

  return {
    type: "learn_spell",
    success: true,
    message: `You have learned ${spell.name}!`,
  };
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
  let rollInfo: string | undefined;

  // Check condition if present
  if (feature.condition) {
    let passed = false;
    let failMessage = feature.failureMessage || "You failed.";

    switch (feature.condition.type) {
      case "stat_check": {
        const result = await checkStatCondition(playerId, feature.condition);
        passed = result.passed;
        rollInfo = result.rollFormula;
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
        rollInfo,
      };
    }
  }

  // Success! Apply success effects
  if (feature.successEffects && feature.successEffects.length > 0) {
    // Filter out learn_spell effects - they need special handling with feature context
    const regularEffects = feature.successEffects.filter(
      (e) => e.type !== "learn_spell",
    );
    const hasLearnSpell = feature.successEffects.some(
      (e) => e.type === "learn_spell",
    );

    // Apply regular effects
    if (regularEffects.length > 0) {
      const successEffects = await EffectHandler.apply(
        playerId,
        regularEffects,
      );
      effectsApplied.push(...successEffects);
    }

    // Handle learn_spell effect using feature's teachesSpellId
    if (hasLearnSpell && feature.teachesSpellId) {
      const learnResult = await learnSpellFromFeature(
        playerId,
        feature.teachesSpellId,
      );
      effectsApplied.push(learnResult);
    } else if (hasLearnSpell && !feature.teachesSpellId) {
      effectsApplied.push({
        type: "learn_spell",
        success: false,
        message: "This book doesn't seem to contain any spells.",
      });
    }
  }

  // Reveal any hidden features/containers
  if (feature.revealsFeatureId) {
    revealedFeature =
      (await revealFeature(feature.revealsFeatureId, playerId)) ?? undefined;
  }

  if (feature.revealsContainerId) {
    revealedContainer =
      (await revealContainer(feature.revealsContainerId, playerId)) ??
      undefined;
  }

  // Mark feature as discovered
  // For features with perceptionDC, use per-player tracking so each player
  // can discover it independently. For other features, use global tracking.
  if (feature.perceptionDC) {
    // Per-player discovery - add to player's discovered list
    await addPersonalFeatureDiscovery(playerId, feature.id);
  } else {
    // Global discovery - mark feature as discovered for everyone
    await db
      .update(features)
      .set({ isDiscovered: true })
      .where(eq(features.id, feature.id));
  }

  // Check if learn_spell effect failed - if so, return failure with just the effect message
  const learnSpellEffect = effectsApplied.find((e) => e.type === "learn_spell");
  if (learnSpellEffect && !learnSpellEffect.success) {
    return {
      success: false,
      message: learnSpellEffect.message,
      effectsApplied,
      revealedFeature,
      revealedContainer,
      rollInfo,
    };
  }

  const message = feature.successMessage || "Success!";

  return {
    success: true,
    message,
    effectsApplied,
    revealedFeature,
    revealedContainer,
    rollInfo,
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
 * Get visible containers in a room for a specific player
 * @param roomId - The room to get containers from
 * @param playerId - Optional player ID to include their personal discoveries
 * @returns Array of visible containers
 */
export async function getContainersInRoom(
  roomId: string,
  playerId?: string,
): Promise<Container[]> {
  const rows = await db
    .select()
    .from(containers)
    .where(eq(containers.roomId, roomId));

  // Get player's personal discoveries if playerId provided
  let playerDiscoveredContainerIds: string[] = [];
  if (playerId) {
    const player = await db
      .select({ discoveredContainerIds: players.discoveredContainerIds })
      .from(players)
      .where(eq(players.id, playerId))
      .get();
    playerDiscoveredContainerIds = player?.discoveredContainerIds || [];
  }

  const result: Container[] = [];

  for (const row of rows) {
    const container = toContainer(row);

    // isHidden = null means never hidden (always visible)
    // isHidden = false means currently visible (globally revealed)
    // isHidden = true means currently hidden
    if (container.isHidden === true) {
      // Check if this is a personal discovery the player has found
      const isPersonalScope = container.discoveryScope === "personal";
      const playerHasDiscovered = playerDiscoveredContainerIds.includes(
        container.id,
      );

      if (isPersonalScope && playerHasDiscovered) {
        // Player has personally discovered this container
        result.push(container);
      }
      // Otherwise skip - it's hidden and player hasn't discovered it
      continue;
    }

    result.push(container);
  }

  return result;
}

/** Passive perception constant (10 + WIS modifier) */
const PASSIVE_PERCEPTION_BASE = 10;

/**
 * Get passive perception hints for features in a room.
 * Uses passive perception (10 + WIS modifier) vs feature's perceptionDC.
 * Only returns hints for features the player hasn't already discovered.
 * @param roomId - The room to check
 * @param playerId - The player entering the room
 * @param wisModifier - The player's WIS modifier
 * @returns Array of perception hint strings
 */
export async function getPassivePerceptionHints(
  roomId: string,
  playerId: string,
  wisModifier: number,
): Promise<string[]> {
  const hints: string[] = [];
  const passivePerception = PASSIVE_PERCEPTION_BASE + wisModifier;

  // Get player's discovered features to exclude already-found ones
  const player = await db
    .select({ discoveredFeatureIds: players.discoveredFeatureIds })
    .from(players)
    .where(eq(players.id, playerId))
    .get();
  const discoveredIds = player?.discoveredFeatureIds || [];

  // Get all features in the room
  const roomFeatures = await db
    .select()
    .from(features)
    .where(eq(features.roomId, roomId));

  for (const row of roomFeatures) {
    const feature = toFeature(row);

    // Skip if no perceptionDC or no hint
    if (!feature.perceptionDC || !feature.perceptionHint) continue;

    // Skip if already discovered by this player
    if (feature.isDiscovered || discoveredIds.includes(feature.id)) continue;

    // Skip if feature is hidden (player can't see it at all)
    if (feature.isHidden === true) continue;

    // Check passive perception vs DC
    if (passivePerception >= feature.perceptionDC) {
      hints.push(feature.perceptionHint);
    }
  }

  // Also check containers with perceptionDC
  const roomContainers = await db
    .select()
    .from(containers)
    .where(eq(containers.roomId, roomId));

  const discoveredContainerIds =
    (
      await db
        .select({ discoveredContainerIds: players.discoveredContainerIds })
        .from(players)
        .where(eq(players.id, playerId))
        .get()
    )?.discoveredContainerIds || [];

  for (const row of roomContainers) {
    const container = toContainer(row);

    // Skip if no perceptionDC or no hint
    if (!container.perceptionDC || !container.perceptionHint) continue;

    // Skip if already discovered
    if (discoveredContainerIds.includes(container.id)) continue;

    // Skip if hidden
    if (container.isHidden === true) continue;

    // Check passive perception vs DC
    if (passivePerception >= container.perceptionDC) {
      hints.push(container.perceptionHint);
    }
  }

  return hints;
}

/**
 * Check if a player has already discovered a feature.
 * Checks both global isDiscovered flag and player's personal discoveredFeatureIds.
 * @param playerId - The player to check
 * @param featureId - The feature to check
 * @returns True if the player has discovered this feature
 */
export async function hasPlayerDiscoveredFeature(
  playerId: string,
  featureId: string,
): Promise<boolean> {
  // Check global discovery first
  const feature = await db
    .select({ isDiscovered: features.isDiscovered })
    .from(features)
    .where(eq(features.id, featureId))
    .get();

  if (feature?.isDiscovered) {
    return true;
  }

  // Check player's personal discoveries
  const player = await db
    .select({ discoveredFeatureIds: players.discoveredFeatureIds })
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  const discoveredIds = player?.discoveredFeatureIds || [];
  return discoveredIds.includes(featureId);
}
