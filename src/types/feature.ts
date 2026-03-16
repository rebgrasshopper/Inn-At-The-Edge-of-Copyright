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
  | { type: "unblock_exit"; direction: Direction }
  | { type: "spawn_monster"; monsterId: string; roomId?: string }
  | { type: "learn_spell" }; // Learns spell from feature's teachesSpellId

export type Feature = {
  id: string;
  roomId: string;
  name: string;
  description: string;
  triggerVerbs: string[];
  triggerTarget: string;
  triggerAliases?: string[];
  condition: FeatureCondition | null;
  successMessage?: string;
  failureMessage?: string;
  successEffects?: PlayerEffect[];
  failureEffects?: PlayerEffect[];
  revealsFeatureId?: string;
  revealsContainerId?: string;
  // Text shown in room description when feature is revealed (for hidden features)
  revealedText?: string;
  // null = never hidden (always visible), true = currently hidden, false = currently visible
  isHidden: boolean | null;
  // When the feature was last revealed (for time-based re-hiding)
  revealedAt?: Date;
  isDiscovered: boolean;
  // Discovery scope: null or "global" = revealed for everyone, "personal" = only for discoverer
  discoveryScope?: string | null;
  // Custom refusal messages for invalid actions
  refuseGetMessage?: string;
  refuseDropMessage?: string;
  // Spell book features: links to a spell that can be learned
  teachesSpellId?: string | null;
  // Perception DC for finding this feature via search command (WIS check)
  perceptionDC?: number | null;
  // Hint shown when passive perception notices this feature
  perceptionHint?: string | null;
};

export type EffectResult = {
  type: string;
  success: boolean;
  message: string;
  playerUpdate?: Partial<import("./player.js").Player>;
};
