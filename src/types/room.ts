import type { Container } from "./container.js";
import type { Feature } from "./feature.js";
import type { ItemStack } from "./item.js";
import type { MonsterInstance } from "./monster.js";
import type { NPC } from "./npc.js";
import type { Player } from "./player.js";

export type Direction = "north" | "south" | "east" | "west" | "up" | "down";

export type Exit = {
  roomId: string;
  blocked?: boolean;
  blockMessage?: string;
};

export type Room = {
  id: string;
  name: string;
  description: string;
  // Navigation description (e.g., "The path leads north to the village.")
  navDescription?: string;
  region: string;
  exits: Partial<Record<Direction, Exit>>;
};

export type RoomWithContents = Room & {
  // Composed description: description + revealed container texts + navDescription
  fullDescription?: string;
  players: Player[];
  items: ItemStack[];
  monsters: MonsterInstance[];
  npcs: NPC[];
  containers: Container[];
  features: Feature[];
};
