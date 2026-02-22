import type { NextFunction, Request, Response } from "express";
import type { Player } from "../types/player.js";
declare global {
    namespace Express {
        interface Request {
            player?: Player;
            userId?: string;
            token?: string;
        }
    }
}
/**
 * Authentication middleware for protected routes
 * Validates JWT token from Authorization header and attaches player to request
 * Use this for routes that require an existing player/character
 */
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Light authentication middleware for routes that don't require a player
 * Validates JWT token and attaches userId to request
 * Use this for routes like character creation where user exists but player doesn't
 */
export declare function authMiddlewareLight(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.d.ts.map