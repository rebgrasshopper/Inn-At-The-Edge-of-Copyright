import type { Player } from "./player.js";
import type { RoomWithContents } from "./room.js";
export type RoomEnterData = {
    room: RoomWithContents;
    player: Player;
};
export type RoomLeaveData = {
    roomId: string;
    player: Player;
};
export type RoomUpdateData = {
    room: RoomWithContents;
};
export type ChatMessageData = {
    id: string;
    type: "chat" | "system" | "combat" | "error" | "whisper" | "emote";
    content: string;
    sender?: string;
    timestamp: string;
};
export type CombatActionData = {
    attacker: string;
    defender: string;
    action: string;
};
export type CombatResultData = {
    hit: boolean;
    damage: number;
    attackRoll: number;
    defenderHp: number;
    narrative: string;
    victory?: {
        victor: string;
        defeated: string;
        xpAwarded: number;
    };
};
export type PlayerUpdateData = {
    player: Partial<Player>;
};
export type ErrorData = {
    message: string;
    code?: string;
};
export type SystemMessageData = {
    content: string;
    timestamp: string;
};
export type ClientToServerEvents = {
    command: (input: string) => void;
    disconnect: () => void;
};
export type ServerToClientEvents = {
    "room:enter": (data: RoomEnterData) => void;
    "room:leave": (data: RoomLeaveData) => void;
    "room:update": (data: RoomUpdateData) => void;
    "chat:message": (data: ChatMessageData) => void;
    "combat:action": (data: CombatActionData) => void;
    "combat:result": (data: CombatResultData) => void;
    "player:update": (data: PlayerUpdateData) => void;
    error: (data: ErrorData) => void;
    "system:message": (data: SystemMessageData) => void;
};
//# sourceMappingURL=socket.d.ts.map