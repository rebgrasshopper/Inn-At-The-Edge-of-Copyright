import type { ChatMessageData } from "../types/socket.js";
export type ChatScope = {
    type: "room";
    roomId: string;
} | {
    type: "region";
    region: string;
} | {
    type: "player";
    playerId: string;
};
export type ChatResult = {
    success: boolean;
    message?: ChatMessageData;
    scope?: ChatScope;
    roomNotice?: ChatMessageData;
    error?: string;
};
/**
 * Broadcast a message to all players in the same room
 * @param playerId - The speaking player's ID
 * @param message - The message content
 * @returns ChatResult with message data and room scope
 */
export declare function speak(playerId: string, message: string): Promise<ChatResult>;
/**
 * Broadcast a message to all players in the same region
 * @param playerId - The shouting player's ID
 * @param message - The message content
 * @returns ChatResult with message data and region scope
 */
export declare function shout(playerId: string, message: string): Promise<ChatResult>;
/**
 * Send a private message to another player in the same room
 * @param playerId - The whispering player's ID
 * @param targetName - The target player's name (or prefix)
 * @param message - The message content
 * @returns ChatResult with message data and player scope
 */
export declare function whisper(playerId: string, targetName: string, message: string): Promise<ChatResult>;
/**
 * Broadcast an emote/action to all players in the same room
 * @param playerId - The emoting player's ID
 * @param action - The action description (e.g., "waves hello")
 * @returns ChatResult with message data and room scope
 */
export declare function emote(playerId: string, action: string): Promise<ChatResult>;
//# sourceMappingURL=ChatService.d.ts.map