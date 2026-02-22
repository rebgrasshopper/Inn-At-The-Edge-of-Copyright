import type { PlayerStats } from "./player.js";
export type Monster = {
    id: string;
    name: string;
    description: string;
    stats: PlayerStats;
    maxHp: number;
    xpReward: number;
};
export type MonsterInstance = {
    id: string;
    monster: Monster;
    roomId: string;
    currentHp: number;
};
//# sourceMappingURL=monster.d.ts.map