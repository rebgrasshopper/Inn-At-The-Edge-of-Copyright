/**
 * Chat message types for the MUD game client.
 */

export type MessageType =
  | "chat"
  | "system"
  | "combat"
  | "error"
  | "whisper"
  | "emote";

export type ChatMessage = {
  id: string;
  type: MessageType;
  content: string;
  sender?: string;
  timestamp: Date;
};
