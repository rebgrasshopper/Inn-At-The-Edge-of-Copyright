/**
 * Swimming system type definitions.
 * Defines types for swimming state, check results, and swimming events.
 */

/**
 * Active swimming state for a player
 */
export type ActiveSwimmer = {
  playerId: string;
  playerName: string;
  roomId: string;
  /** Timer for periodic STR checks */
  checkTimer: NodeJS.Timeout;
  /** Number of consecutive failed checks (for escalating damage) */
  consecutiveFailures: number;
  /** Timestamp when swimming started */
  startedAt: Date;
};

/**
 * Result of a swimming STR check
 */
export type SwimCheckResult = {
  passed: boolean;
  roll: number;
  dc: number;
  modifier: number;
  /** Damage taken if failed, null if passed */
  damage: number | null;
  /** Current consecutive failures after this check */
  consecutiveFailures: number;
  /** Message to display to player */
  message: string;
  /** Roll info for display (e.g., "d20+2 = 14") */
  rollInfo: string;
  /** Player's HP after damage (if any) */
  currentHp?: number;
  /** Whether player died from drowning */
  playerDied?: boolean;
};

/**
 * Result of starting/stopping swimming
 */
export type SwimActionResult = {
  success: boolean;
  message: string;
};

/**
 * Callback for broadcasting swimming events to room
 * @param roomId - The room to broadcast to
 * @param event - The swimming event
 * @param excludePlayerId - Optional player ID to exclude from broadcast
 */
export type SwimmingBroadcaster = (
  roomId: string,
  event: SwimmingEvent,
  excludePlayerId?: string,
) => void;

/**
 * Swimming events that can be broadcast to room participants
 */
export type SwimmingEvent =
  | { type: "swim_start"; playerName: string }
  | { type: "swim_stop"; playerName: string }
  | {
      type: "swim_check";
      playerName: string;
      passed: boolean;
      message: string;
      personalMessage?: string;
      rollInfo?: string;
    }
  | { type: "swim_drown"; playerName: string };

/**
 * Tracking data for consecutive failure reset
 */
export type FailureResetTracker = {
  playerId: string;
  /** Timestamp when player left water */
  leftWaterAt: Date;
  /** Consecutive failures at time of leaving */
  consecutiveFailures: number;
  /** Timer to clear the tracker after 60 seconds */
  resetTimer: NodeJS.Timeout;
};
