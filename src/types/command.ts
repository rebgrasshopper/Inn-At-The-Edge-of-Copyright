import type { Socket } from "socket.io";
import type { Player } from "./player.js";
import type { Room } from "./room.js";

export type CommandType =
  | "command"
  | "movement"
  | "chat"
  | "item"
  | "combat"
  | "info"
  | "feature"
  | "unknown";

export type ParsedCommand = {
  type: CommandType;
  action: string;
  target?: string;
  args?: string[];
  raw: string;
};

export type CommandContext = {
  player: Player;
  room: Room;
  socket: Socket;
};

export type BroadcastMessage = {
  event: string;
  room?: string;
  data: unknown;
};

export type CommandResult = {
  success: boolean;
  message?: string;
  broadcast?: BroadcastMessage[];
};
