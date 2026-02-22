import type { Socket } from "socket.io";
import * as AuthService from "../services/AuthService.js";
import type { Player } from "../types/player.js";

// Re-export handlers
export * from "./handlers.js";

// Extend Socket to include player data
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
export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  try {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    // Check if token is invalidated
    if (AuthService.isTokenInvalidated(token)) {
      return next(new Error("Session expired"));
    }

    // Validate token and get player
    const player = await AuthService.validateToken(token);

    if (!player) {
      return next(new Error("Invalid or expired token"));
    }

    // Attach player and token to socket
    socket.player = player;
    socket.token = token;

    next();
  } catch (error) {
    next(new Error("Authentication failed"));
  }
}
