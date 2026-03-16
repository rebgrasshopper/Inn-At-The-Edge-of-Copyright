/**
 * Search command handler - WIS-based perception for discovering hidden features.
 */

import type { CommandContext, CommandResult } from "../../../types/command.js";
import type { Feature } from "../../../types/feature.js";
import { rollD20WithDetails } from "../../DiceService.js";
import * as FeatureService from "../../FeatureService.js";
import { getStatModifier } from "../../StatService.js";

/**
 * Find features in a room that can be searched (have "search" as a trigger verb)
 * @param roomId - The room to search in
 * @param target - Optional target to filter by
 * @param playerId - Player ID for personal discoveries
 * @returns Array of searchable features
 */
async function findSearchableFeatures(
  roomId: string,
  target: string,
  playerId: string,
): Promise<Feature[]> {
  const features = await FeatureService.getFeaturesInRoom(roomId, playerId);

  return features.filter((f) => {
    // Must have "search" as a trigger verb
    if (!f.triggerVerbs.includes("search")) return false;

    // If no target specified, return all searchable features
    if (!target) return true;

    // Match against triggerTarget or triggerAliases
    const targetLower = target.toLowerCase();
    const matchesTarget =
      f.triggerTarget.toLowerCase().includes(targetLower) ||
      targetLower.includes(f.triggerTarget.toLowerCase());

    const matchesAlias = f.triggerAliases?.some(
      (alias) =>
        alias.toLowerCase().includes(targetLower) ||
        targetLower.includes(alias.toLowerCase()),
    );

    return matchesTarget || matchesAlias;
  });
}

/**
 * Handle search command - roll WIS-based perception to discover hidden features
 */
export async function handleSearch(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player, room } = context;
  const target = args.join(" ").toLowerCase();

  // Find searchable features in the room
  const searchableFeatures = await findSearchableFeatures(
    room.id,
    target,
    player.id,
  );

  if (searchableFeatures.length === 0) {
    if (target) {
      return {
        success: false,
        message: `You don't see anything to search called "${target}".`,
      };
    }
    return {
      success: false,
      message: "You search the area but find nothing of interest.",
    };
  }

  // If multiple features match and no specific target, list them
  if (searchableFeatures.length > 1 && !target) {
    const names = searchableFeatures.map((f) => f.triggerTarget).join(", ");
    return {
      success: false,
      message: `What would you like to search? You could search: ${names}`,
    };
  }

  // If multiple features match a target, disambiguate
  if (searchableFeatures.length > 1) {
    const names = searchableFeatures.map((f) => f.name).join(", ");
    return {
      success: false,
      message: `Which one do you want to search? (${names})`,
    };
  }

  // Single feature found - attempt the search
  const feature = searchableFeatures[0];

  // If feature has perceptionDC, check if player already discovered it
  if (feature.perceptionDC) {
    const alreadyDiscovered = await FeatureService.hasPlayerDiscoveredFeature(
      player.id,
      feature.id,
    );

    if (alreadyDiscovered) {
      return {
        success: false,
        message: "You've already searched here thoroughly.",
      };
    }

    const wisModifier = getStatModifier(player.stats.wis);
    const roll = rollD20WithDetails(wisModifier);
    const success = roll.total >= feature.perceptionDC;

    if (!success) {
      const failMessage =
        feature.failureMessage ||
        "You search carefully but don't find anything unusual.";
      return {
        success: false,
        message: failMessage,
        broadcast: [
          {
            event: "room:activity",
            room: room.id,
            data: {
              message: `${player.name} searches the ${feature.triggerTarget}.`,
              excludePlayer: player.id,
            },
          },
        ],
        rollInfo: `${roll.formula} vs DC ${feature.perceptionDC}`,
      };
    }

    // Success - interact with the feature
    const result = await FeatureService.interactWithFeature(player.id, feature);

    // Build response message
    let message = result.message;

    // Add revealed feature/container info
    if (result.revealedFeature?.revealedText) {
      message += `\n${result.revealedFeature.revealedText}`;
    }
    if (result.revealedContainer?.revealedText) {
      message += `\n${result.revealedContainer.revealedText}`;
    }

    // Add effect messages
    for (const effect of result.effectsApplied) {
      if (effect.message) {
        message += `\n${effect.message}`;
      }
    }

    return {
      success: true,
      message,
      broadcast: [
        {
          event: "room:activity",
          room: room.id,
          data: {
            message: `${player.name} searches the ${feature.triggerTarget} and finds something!`,
            excludePlayer: player.id,
          },
        },
      ],
      rollInfo: `${roll.formula} vs DC ${feature.perceptionDC}`,
    };
  }

  // No perceptionDC - just interact normally (auto-success)
  const result = await FeatureService.interactWithFeature(player.id, feature);

  let message = result.message;

  if (result.revealedFeature?.revealedText) {
    message += `\n${result.revealedFeature.revealedText}`;
  }
  if (result.revealedContainer?.revealedText) {
    message += `\n${result.revealedContainer.revealedText}`;
  }

  for (const effect of result.effectsApplied) {
    if (effect.message) {
      message += `\n${effect.message}`;
    }
  }

  return {
    success: result.success,
    message,
    broadcast: [
      {
        event: "room:activity",
        room: room.id,
        data: {
          message: `${player.name} searches the ${feature.triggerTarget}.`,
          excludePlayer: player.id,
        },
      },
    ],
    rollInfo: result.rollInfo,
  };
}
