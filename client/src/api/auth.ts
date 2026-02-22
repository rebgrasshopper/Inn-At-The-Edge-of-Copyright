/**
 * Authentication API client functions.
 */

import type { Player } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

type LoginResponse = {
  success: boolean;
  token?: string;
  player?: Player;
  error?: string;
};

type RegisterResponse = {
  success: boolean;
  token?: string;
  error?: string;
};

type CreateCharacterResponse = {
  success: boolean;
  player?: Player;
  error?: string;
};

type GetMeResponse = {
  success: boolean;
  player: Player | null;
  error?: string;
};

/**
 * Login with username and password.
 * @param username - User's username
 * @param password - User's password
 * @returns Login response with token and optional player
 */
export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  return response.json();
}

/**
 * Register a new user account.
 * @param username - Desired username
 * @param password - Desired password
 * @returns Register response with token
 */
export async function register(
  username: string,
  password: string,
): Promise<RegisterResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  return response.json();
}

/**
 * Create a new character for the authenticated user.
 * @param token - JWT auth token
 * @param name - Character name
 * @returns Response with created player
 */
export async function createCharacter(
  token: string,
  name: string,
): Promise<CreateCharacterResponse> {
  const response = await fetch(`${API_BASE}/characters/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  return response.json();
}

/**
 * Get the current player for the authenticated user.
 * @param token - JWT auth token
 * @returns Response with player (or null if no character exists)
 */
export async function getMe(token: string): Promise<GetMeResponse> {
  const response = await fetch(`${API_BASE}/characters/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return { success: false, player: null, error: "Failed to fetch player" };
  }

  return response.json();
}
