import type { EquipmentSlot } from "./item.js";

export type PlayerStats = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

export type PlayerEquipment = {
  head: string | null;
  torso: string | null;
  body: string | null;
  legs: string | null;
  hands: string | null;
  feet: string | null;
  mainHand: string | null;
  offHand: string | null;
  neck: string | null;
  ring1: string | null;
  ring2: string | null;
  back: string | null;
};

/** Maps equipment slot names to player worn field names */
export const EQUIPMENT_SLOT_TO_FIELD: Record<
  EquipmentSlot | "ring1" | "ring2",
  keyof PlayerEquipment
> = {
  head: "head",
  torso: "torso",
  body: "body",
  legs: "legs",
  hands: "hands",
  feet: "feet",
  mainHand: "mainHand",
  offHand: "offHand",
  neck: "neck",
  ring: "ring1", // Default ring slot
  ring1: "ring1",
  ring2: "ring2",
  back: "back",
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
  unspentAttributePoints: number;
  isOnline: boolean;
  equipment: PlayerEquipment;
  // Personal discoveries (features/containers only this player can see)
  discoveredFeatureIds: string[];
  discoveredContainerIds: string[];
};
