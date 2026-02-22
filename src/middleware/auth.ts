import type { NextFunction, Request, Response } from "express";
import * as AuthService from "../services/AuthService.js";
import type { Player } from "../types/player.js";

// Extend Express Request to include player
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
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Extract token from "Bearer <token>" format
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res.status(401).json({ error: "Invalid authorization format" });
    return;
  }

  const token = parts[1];

  // Check if token is invalidated
  if (AuthService.isTokenInvalidated(token)) {
    res.status(401).json({ error: "Session expired" });
    return;
  }

  // Validate token and get player
  const player = await AuthService.validateToken(token);

  if (!player) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Attach player and token to request
  req.player = player;
  req.userId = player.userId;
  req.token = token;

  next();
}

/**
 * Light authentication middleware for routes that don't require a player
 * Validates JWT token and attaches userId to request
 * Use this for routes like character creation where user exists but player doesn't
 */
export async function authMiddlewareLight(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Extract token from "Bearer <token>" format
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res.status(401).json({ error: "Invalid authorization format" });
    return;
  }

  const token = parts[1];

  // Check if token is invalidated
  if (AuthService.isTokenInvalidated(token)) {
    res.status(401).json({ error: "Session expired" });
    return;
  }

  // Validate token and get userId
  const userId = await AuthService.validateTokenForUserId(token);

  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Attach userId and token to request
  req.userId = userId;
  req.token = token;

  next();
}
