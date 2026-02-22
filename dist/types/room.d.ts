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
    region: string;
    exits: Partial<Record<Direction, Exit>>;
};
export type RoomWithContents = Room & {
    players: Player[];
    items: ItemStack[];
    monsters: MonsterInstance[];
    npcs: NPC[];
    containers: Container[];
    features: Feature[];
};
//# sourceMappingURL=room.d.ts.map