/**
 * Game state types for the MUD game client.
 */

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

export type ItemStack = {
  item: {
    id: string;
    name: string;
    description: string;
  };
  quantity: number;
};

export type Room = {
  id: string;
  name: string;
  description: string;
  region: string;
  exits: Partial<Record<string, string>>;
  players: Player[];
  items: ItemStack[];
};

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";
