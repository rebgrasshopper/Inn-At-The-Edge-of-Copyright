export type PlayerStats = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

export type Player = {
  id: string;
  userId: string;
  name: string;
  currentRoomId: string | null;
  stats: PlayerStats;
  currentHp: number;
  maxHp: number;
  xp: number;
  level: number;
  isOnline: boolean;
};
