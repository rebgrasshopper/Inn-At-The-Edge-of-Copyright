import type { PlayerStats } from "./player.js";

export type Monster = {
  id: string;
  name: string;
  description: string;
  stats: PlayerStats;
  maxHp: number;
  xpReward: number;
  /** Aggro score: 0 = passive, >0 = attacks players at or below this level */
  aggroScore: number;
  /** Weapon damage dice notation (e.g., "1d6"), defaults to "1d4" */
  weaponDamage: string;
  /** Monster level for flee DC calculation */
  level: number;
};

export type MonsterInstance = {
  id: string;
  monster: Monster;
  roomId: string;
  currentHp: number;
};
