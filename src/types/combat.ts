/**
 * Combat system type definitions.
 * Defines types for combat participants, active combat state, and combat results.
 */

/**
 * A participant in combat (player or monster)
 */
export type CombatParticipant = {
  type: "player" | "monster";
  id: string;
  name: string;
  currentHp: number;
  maxHp: number;
  stats: {
    str: number;
    dex: number;
    con: number;
  };
  /** Weapon damage dice notation (e.g., "1d6"), null = unarmed (1d4) */
  weaponDamage: string | null;
  ac: number;
  level: number;
};

/**
 * Active combat state tracking all participants and timers
 */
export type ActiveCombat = {
  id: string;
  /** Map of participantId -> participant data */
  participants: Map<string, CombatParticipant>;
  /** Map of monsterId -> Set of playerIds attacking it */
  monsterTargets: Map<string, Set<string>>;
  /** Map of participantId -> attack interval timer */
  attackTimers: Map<string, NodeJS.Timeout>;
  roomId: string;
};

/**
 * Result of a single attack
 */
export type AttackResult = {
  hit: boolean;
  attackRoll: number;
  targetAC: number;
  /** Damage dealt, null if miss */
  damage: number | null;
  /** Defender's HP after damage */
  defenderHp: number;
  defenderDead: boolean;
  /** Formatted combat message for display */
  message: string;
};

/**
 * Result of a flee attempt
 */
export type FleeResult = {
  success: boolean;
  message: string;
  /** Room ID if successful, null if failed */
  destination: string | null;
};

/**
 * Result of initiating combat
 */
export type CombatResult = {
  success: boolean;
  message: string;
  /** Combat ID if successful, null if failed */
  combatId: string | null;
};

/**
 * Callback for broadcasting combat events to room
 * @param roomId - The room to broadcast to
 * @param event - The combat event
 * @param excludePlayerId - Optional player ID to exclude from broadcast
 */
export type CombatBroadcaster = (
  roomId: string,
  event: CombatEvent,
  excludePlayerId?: string,
) => void;

/**
 * Combat events that can be broadcast to room participants
 */
export type CombatEvent =
  | { type: "combat_start"; attackerName: string; defenderName: string }
  | { type: "attack"; message: string }
  | { type: "flee_success"; playerName: string; direction: string }
  | { type: "flee_fail"; playerName: string }
  | { type: "player_death"; playerName: string; killerName: string }
  | {
      type: "monster_death";
      monsterName: string;
      killerName: string;
      xpAwarded: number;
    }
  | {
      type: "level_up";
      playerId: string;
      playerName: string;
      newLevel: number;
      attributePoints: number;
    }
  | { type: "combat_end"; reason: string };
