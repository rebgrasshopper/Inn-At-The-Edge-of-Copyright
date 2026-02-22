import type { PlayerStats } from "./player.js";

// Condition types for features
export type FeatureCondition =
  | { type: "stat_check"; stat: keyof PlayerStats; dc: number }
  | { type: "riddle"; question: string; answers: string[] }
  | { type: "item_required"; itemId: string; consumeItem?: boolean };

import type { Direction } from "./room.js";

// Effects that can be applied to players or the world
export type PlayerEffect =
  | { type: "damage"; amount: number; damageType?: string }
  | { type: "heal"; amount: number }
  | { type: "xp"; amount: number }
  | {
      type: "stat_modify";
      stat: keyof PlayerStats;
      amount: number;
      permanent?: boolean;
    }
  | { type: "give_item"; itemId: string; quantity?: number }
  | { type: "teleport"; roomId: string }
  | { type: "status"; status: string; duration?: number }
  | { type: "unblock_exit"; direction: Direction };

export type Feature = {
  id: string;
  roomId: string;
  name: string;
  description: string;
  triggerVerbs: string[];
  triggerTarget: string;
  condition: FeatureCondition | null;
  successMessage?: string;
  failureMessage?: string;
  successEffects?: PlayerEffect[];
  failureEffects?: PlayerEffect[];
  revealsFeatureId?: string;
  revealsContainerId?: string;
  // null = never hidden (always visible), true = currently hidden, false = currently visible
  isHidden: boolean | null;
  // When the feature was last revealed (for time-based re-hiding)
  revealedAt?: Date;
  isDiscovered: boolean;
};

export type EffectResult = {
  type: string;
  success: boolean;
  message: string;
  playerUpdate?: Partial<import("./player.js").Player>;
};
