import type { ItemSize } from "../db/schema.js";

export type StatEffects = {
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  hp?: number;
};

// Re-export ItemSize from schema for convenience
export type { ItemSize };

/** Tiny - coins, rings, small gems */
export const SIZE_TINY: ItemSize = 0;
/** Small - potions, daggers, scrolls */
export const SIZE_SMALL: ItemSize = 1;
/** Medium - swords, helmets, books, torches */
export const SIZE_MEDIUM: ItemSize = 2;
/** Large - greatswords, shields, armor */
export const SIZE_LARGE: ItemSize = 3;
/** Huge - furniture, boulders (cannot be taken by players) */
export const SIZE_HUGE: ItemSize = 4;

/** Human-readable size names */
export const SIZE_NAMES: Record<ItemSize, string> = {
  0: "tiny",
  1: "small",
  2: "medium",
  3: "large",
  4: "huge",
};

export type EquipmentSlot =
  | "head"
  | "torso"
  | "body"
  | "legs"
  | "hands"
  | "feet"
  | "mainHand"
  | "offHand"
  | "neck"
  | "ring";

export type Item = {
  id: string;
  name: string;
  pluralName?: string;
  description: string;
  category?: string;
  isBulk?: boolean;
  /** Size: 0=tiny, 1=small, 2=medium, 3=large, 4=huge */
  size: ItemSize;
  /** Valid slots this item can be equipped to (first is default) */
  equipSlots?: EquipmentSlot[];
  weaponDamage?: string; // e.g., "1d6", "2d4+1"
  weaponType?: string; // e.g., "slashing", "piercing", "bludgeoning"
  magicProperties?: string[]; // e.g., ["poison", "flaming"]
  effects: StatEffects;
};

export type ItemStack = {
  item: Item;
  quantity: number;
};
