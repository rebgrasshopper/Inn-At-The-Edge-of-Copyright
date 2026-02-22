import type { Socket } from "socket.io";
import type { Player } from "../types/player.js";
export * from "./handlers.js";
declare module "socket.io" {
    interface Socket {
        player?: Player;
        token?: string;
    }
}
/**
 * Socket.io authentication middleware
 * Validates JWT token from handshake auth and attaches player to socket
 */
export declare function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void>;
//# sourceMappingURL=index.d.ts.map