import * as AuthService from "../services/AuthService.js";
// Re-export handlers
export * from "./handlers.js";
/**
 * Socket.io authentication middleware
 * Validates JWT token from handshake auth and attaches player to socket
 */
export async function socketAuthMiddleware(socket, next) {
    try {
        const token = socket.handshake.auth.token;
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
    }
    catch (error) {
        next(new Error("Authentication failed"));
    }
}
//# sourceMappingURL=index.js.map