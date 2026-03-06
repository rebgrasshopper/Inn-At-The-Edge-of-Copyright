/**
 * Chat message types for the MUD game client.
 */

export type MessageType =
  | "chat"
  | "system"
  | "combat"
  | "error"
  | "whisper"
  | "emote"
  | "logo";

export type ChatMessage = {
  id: string;
  type: MessageType;
  content: string;
  sender?: string;
  timestamp: Date;
  /** Optional roll details to display (e.g., "d20+2 = 15 vs DC 12") */
  rollInfo?: string;
};
