export type StatEffects = {
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  hp?: number;
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
