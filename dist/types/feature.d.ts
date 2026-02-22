import type { PlayerStats } from "./player.js";
export type FeatureCondition = {
    type: "stat_check";
    stat: keyof PlayerStats;
    dc: number;
} | {
    type: "riddle";
    question: string;
    answers: string[];
} | {
    type: "item_required";
    itemId: string;
    consumeItem?: boolean;
};
import type { Direction } from "./room.js";
export type PlayerEffect = {
    type: "damage";
    amount: number;
    damageType?: string;
} | {
    type: "heal";
    amount: number;
} | {
    type: "xp";
    amount: number;
} | {
    type: "stat_modify";
    stat: keyof PlayerStats;
    amount: number;
    permanent?: boolean;
} | {
    type: "give_item";
    itemId: string;
    quantity?: number;
} | {
    type: "teleport";
    roomId: string;
} | {
    type: "status";
    status: string;
    duration?: number;
} | {
    type: "unblock_exit";
    direction: Direction;
};
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
    isHidden: boolean | null;
    revealedAt?: Date;
    isDiscovered: boolean;
};
export type EffectResult = {
    type: string;
    success: boolean;
    message: string;
    playerUpdate?: Partial<import("./player.js").Player>;
};
//# sourceMappingURL=feature.d.ts.map