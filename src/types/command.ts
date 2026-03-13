import type { Socket } from "socket.io";
import type { Player } from "./player.js";
import type { RoomWithContents } from "./room.js";

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
  room: RoomWithContents;
  socket: Socket;
};

export type BroadcastMessage = {
  event: string;
  room?: string;
  data: unknown;
  /** If true, exclude the command sender from receiving this broadcast */
  excludeSender?: boolean;
};

export type CommandResult = {
  success: boolean;
  message?: string;
  broadcast?: BroadcastMessage[];
  /** Optional roll details to display (e.g., "d20+2 = 15") */
  rollInfo?: string;
  /** Set to true when a teleport effect moved the player to a new room */
  roomChanged?: boolean;
};
