import { Router } from "express";
import { authMiddleware, authMiddlewareLight } from "../middleware/auth.js";
import * as CharacterService from "../services/CharacterService.js";

const router = Router();

/**
 * POST /api/characters/create
 * Create a new character for the authenticated user
 * Requires authentication (but not an existing character)
 */
router.post("/create", authMiddlewareLight, async (req, res) => {
  const { name } = req.body;
  const userId = req.userId;

  // This shouldn't happen if authMiddlewareLight works, but be safe
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Validate input
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Character name is required" });
    return;
  }

  const result = await CharacterService.createCharacter(userId, name);

  if (result.success) {
    res.status(201).json({
      success: true,
      player: result.player,
    });
  } else {
    // Determine appropriate status code
    let status = 400;
    if (result.error === "Character name is already taken") {
      status = 409; // Conflict
    }

    res.status(status).json({
      success: false,
      error: result.error,
    });
  }
});

/**
 * GET /api/characters/me
 * Get the current player for the authenticated user
 * Uses light auth - returns player if exists, null if not
 */
router.get("/me", authMiddlewareLight, async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Get the user's character (we only support one character per user for MVP)
  const characters = await CharacterService.getCharactersByUserId(userId);

  if (characters.length === 0) {
    res.json({
      success: true,
      player: null,
    });
    return;
  }

  res.json({
    success: true,
    player: characters[0],
  });
});

/**
 * GET /api/characters
 * Get all characters for the authenticated user
 * Requires authentication
 */
router.get("/", authMiddleware, async (req, res) => {
  const userId = req.player?.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const characters = await CharacterService.getCharactersByUserId(userId);

  res.json({
    success: true,
    characters,
  });
});

/**
 * GET /api/characters/:id
 * Get a specific character by ID
 * Requires authentication and ownership
 */
router.get("/:id", authMiddleware, async (req, res) => {
  const userId = req.player?.userId;
  const characterId = req.params.id as string;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const character = await CharacterService.getCharacterById(characterId);

  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }

  // Verify ownership
  if (character.userId !== userId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json({
    success: true,
    character,
  });
});

export default router;
