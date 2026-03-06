/**
 * Swimming service for managing swimming state and periodic STR checks.
 * Players swimming in water must pass STR checks or take escalating damage.
 */

import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { players } from "../db/schema.js";
import type {
  ActiveSwimmer,
  FailureResetTracker,
  SwimActionResult,
  SwimCheckResult,
  SwimmingBroadcaster,
  SwimmingEvent,
} from "../types/swimming.js";
import { rollD20WithDetails } from "./DiceService.js";
import { getStatModifier } from "./StatService.js";

// ============================================
// Constants
// ============================================

/** DC for swimming STR checks */
const SWIM_CHECK_DC = 6;

/** Interval between swimming checks in milliseconds (20 seconds) */
const SWIM_CHECK_INTERVAL_MS = 20_000;

/** Time in milliseconds before consecutive failures reset (60 seconds) */
const FAILURE_RESET_TIME_MS = 60_000;

/** Room IDs where swimming is allowed */
const SWIMMABLE_ROOMS = new Set([
  "room-sparkling-stream",
  "room-hidden-cavern",
]);

// ============================================
// In-Memory Swimming State
// ============================================

/** Map of playerId -> ActiveSwimmer */
const activeSwimmers = new Map<string, ActiveSwimmer>();

/** Map of playerId -> FailureResetTracker (for players who recently left water) */
const failureResetTrackers = new Map<string, FailureResetTracker>();

/** Broadcaster function set by socket handler integration */
let broadcaster: SwimmingBroadcaster | null = null;

// ============================================
// Service Configuration
// ============================================

/**
 * Set the broadcaster function for swimming events
 * @param fn - Function to broadcast swimming events to rooms
 */
export function setBroadcaster(fn: SwimmingBroadcaster): void {
  broadcaster = fn;
}

/**
 * Broadcast a swimming event to a room
 * @param roomId - The room to broadcast to
 * @param event - The swimming event
 * @param excludePlayerId - Optional player ID to exclude from broadcast
 */
function broadcast(
  roomId: string,
  event: SwimmingEvent,
  excludePlayerId?: string,
): void {
  if (broadcaster) {
    broadcaster(roomId, event, excludePlayerId);
  }
}

// ============================================
// Swimming State Queries
// ============================================

/**
 * Check if a player is currently swimming
 * @param playerId - The player's ID
 * @returns True if player is swimming
 */
export function isPlayerSwimming(playerId: string): boolean {
  return activeSwimmers.has(playerId);
}

/**
 * Check if a room allows swimming
 * @param roomId - The room's ID
 * @returns True if swimming is allowed in this room
 */
export function isSwimmableRoom(roomId: string): boolean {
  return SWIMMABLE_ROOMS.has(roomId);
}

/**
 * Get the active swimmer data for a player
 * @param playerId - The player's ID
 * @returns ActiveSwimmer data or null if not swimming
 */
export function getSwimmerData(playerId: string): ActiveSwimmer | null {
  return activeSwimmers.get(playerId) ?? null;
}

// ============================================
// Swimming Actions
// ============================================

/**
 * Start swimming for a player
 * @param playerId - The player's ID
 * @param playerName - The player's display name
 * @param roomId - The room where swimming starts
 * @returns Result indicating success or failure with message
 */
export async function startSwimming(
  playerId: string,
  playerName: string,
  roomId: string,
): Promise<SwimActionResult> {
  // Check if already swimming
  if (activeSwimmers.has(playerId)) {
    return {
      success: false,
      message: "You're already swimming!",
    };
  }

  // Check if room allows swimming
  if (!isSwimmableRoom(roomId)) {
    return {
      success: false,
      message: "There's nowhere to swim here.",
    };
  }

  // Check for any preserved consecutive failures from recent exit
  let consecutiveFailures = 0;
  const tracker = failureResetTrackers.get(playerId);
  if (tracker) {
    consecutiveFailures = tracker.consecutiveFailures;
    clearTimeout(tracker.resetTimer);
    failureResetTrackers.delete(playerId);
  }

  // Create the check timer
  const checkTimer = setInterval(
    () => performSwimCheck(playerId),
    SWIM_CHECK_INTERVAL_MS,
  );

  // Store swimmer state
  const swimmer: ActiveSwimmer = {
    playerId,
    playerName,
    roomId,
    checkTimer,
    consecutiveFailures,
    startedAt: new Date(),
  };
  activeSwimmers.set(playerId, swimmer);

  // Broadcast to room
  broadcast(roomId, { type: "swim_start", playerName }, playerId);

  return {
    success: true,
    message: "You wade into the water and begin swimming.",
  };
}

/**
 * Stop swimming for a player
 * @param playerId - The player's ID
 * @returns Result indicating success or failure with message
 */
export function stopSwimming(playerId: string): SwimActionResult {
  const swimmer = activeSwimmers.get(playerId);
  if (!swimmer) {
    return {
      success: false,
      message: "You're not swimming.",
    };
  }

  // Clear the check timer
  clearInterval(swimmer.checkTimer);

  // If player had consecutive failures, track them for potential reset
  if (swimmer.consecutiveFailures > 0) {
    const resetTimer = setTimeout(() => {
      failureResetTrackers.delete(playerId);
    }, FAILURE_RESET_TIME_MS);

    failureResetTrackers.set(playerId, {
      playerId,
      leftWaterAt: new Date(),
      consecutiveFailures: swimmer.consecutiveFailures,
      resetTimer,
    });
  }

  // Broadcast to room
  broadcast(
    swimmer.roomId,
    { type: "swim_stop", playerName: swimmer.playerName },
    playerId,
  );

  // Remove from active swimmers
  activeSwimmers.delete(playerId);

  return {
    success: true,
    message: "You climb out of the water.",
  };
}

/**
 * Force stop swimming for a player (used when leaving room, dying, etc.)
 * Does not broadcast or preserve failure state.
 * @param playerId - The player's ID
 */
export function forceStopSwimming(playerId: string): void {
  const swimmer = activeSwimmers.get(playerId);
  if (swimmer) {
    clearInterval(swimmer.checkTimer);
    activeSwimmers.delete(playerId);
  }
}

// ============================================
// Swimming Checks
// ============================================

/**
 * Perform a swimming STR check for a player
 * @param playerId - The player's ID
 * @returns The check result, or null if player is not swimming
 */
async function performSwimCheck(
  playerId: string,
): Promise<SwimCheckResult | null> {
  const swimmer = activeSwimmers.get(playerId);
  if (!swimmer) return null;

  // Get player stats
  const player = await db
    .select({
      str: players.str,
      currentHp: players.currentHp,
      maxHp: players.maxHp,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) {
    forceStopSwimming(playerId);
    return null;
  }

  // Roll STR check
  const strMod = getStatModifier(player.str);
  const { roll, total } = rollD20WithDetails();
  const checkTotal = total + strMod;
  const passed = checkTotal >= SWIM_CHECK_DC;

  let damage: number | null = null;
  let currentHp = player.currentHp;
  let playerDied = false;
  let message: string;

  if (passed) {
    // Reset consecutive failures on success
    swimmer.consecutiveFailures = 0;
    message = "You tread water steadily, keeping your head above the surface.";
  } else {
    // Increment consecutive failures
    swimmer.consecutiveFailures++;

    // Calculate damage: 1 + (consecutiveFailures - 1) = consecutiveFailures
    damage = swimmer.consecutiveFailures;
    currentHp = Math.max(0, player.currentHp - damage);

    // Update player HP in database
    await db.update(players).set({ currentHp }).where(eq(players.id, playerId));

    if (currentHp <= 0) {
      playerDied = true;
      message = `You slip beneath the surface and inhale water. The world goes dark...`;
    } else if (swimmer.consecutiveFailures === 1) {
      message = `You slip underwater momentarily, swallowing water as you struggle back to the surface. (-${damage} HP)`;
    } else {
      message = `You slip under again, struggling harder each time to reach the surface. (-${damage} HP)`;
    }
  }

  const rollInfo = `d20${strMod >= 0 ? "+" : ""}${strMod} = ${checkTotal}`;

  const result: SwimCheckResult = {
    passed,
    roll,
    dc: SWIM_CHECK_DC,
    modifier: strMod,
    damage,
    consecutiveFailures: swimmer.consecutiveFailures,
    message,
    rollInfo,
    currentHp,
    playerDied,
  };

  // Broadcast the check result
  broadcast(
    swimmer.roomId,
    {
      type: "swim_check",
      playerName: swimmer.playerName,
      passed,
      message: passed
        ? `${swimmer.playerName} treads water steadily.`
        : `${swimmer.playerName} slips beneath the surface!`,
      personalMessage: message,
      rollInfo,
    },
    playerId,
  );

  // Handle death
  if (playerDied) {
    broadcast(swimmer.roomId, {
      type: "swim_drown",
      playerName: swimmer.playerName,
    });
    forceStopSwimming(playerId);
    // Note: Actual death handling (respawn, corpse, etc.) should be triggered by the caller
  }

  return result;
}

/**
 * Manually trigger a swim check (for testing or special circumstances)
 * @param playerId - The player's ID
 * @returns The check result, or null if player is not swimming
 */
export async function triggerSwimCheck(
  playerId: string,
): Promise<SwimCheckResult | null> {
  return performSwimCheck(playerId);
}

// ============================================
// Cleanup
// ============================================

/**
 * Clean up all swimming state for a player (disconnect, logout, etc.)
 * @param playerId - The player's ID
 */
export function cleanupPlayer(playerId: string): void {
  forceStopSwimming(playerId);

  const tracker = failureResetTrackers.get(playerId);
  if (tracker) {
    clearTimeout(tracker.resetTimer);
    failureResetTrackers.delete(playerId);
  }
}

/**
 * Clean up all swimming state (server shutdown)
 */
export function cleanupAll(): void {
  for (const swimmer of activeSwimmers.values()) {
    clearInterval(swimmer.checkTimer);
  }
  activeSwimmers.clear();

  for (const tracker of failureResetTrackers.values()) {
    clearTimeout(tracker.resetTimer);
  }
  failureResetTrackers.clear();
}
