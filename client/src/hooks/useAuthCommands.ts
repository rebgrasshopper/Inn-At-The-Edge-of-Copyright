/**
 * Hook for handling auth commands (login, register, create) in the chat interface.
 * Supports multi-step flows with password masking.
 */

import { useCallback, useEffect, useState } from "react";
import * as api from "../api";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";
import type { ChatMessage } from "../types";

/**
 * Generates a unique ID for messages.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates a message object.
 */
function createMessage(
  type: ChatMessage["type"],
  content: string,
): ChatMessage {
  return { id: generateId(), type, content, timestamp: new Date() };
}

export type InputMode = "normal" | "username" | "password" | "character_name";

type AuthFlowState =
  | { type: "none" }
  | { type: "login_username" }
  | { type: "login_password"; username: string }
  | { type: "register_username" }
  | { type: "register_password"; username: string }
  | { type: "character_name" };

type UseAuthCommandsReturn = {
  handleCommand: (input: string) => Promise<boolean>;
  showWelcome: () => void;
  inputMode: InputMode;
  inputPlaceholder: string;
};

/**
 * Hook that handles authentication commands before socket connection.
 * Supports multi-step flows for login/register with password masking.
 * @returns Object with handleCommand, showWelcome, inputMode, and inputPlaceholder
 */
export function useAuthCommands(): UseAuthCommandsReturn {
  const { token, authState, setAuth, setPlayer } = useAuth();
  const { dispatch } = useGame();
  const [flowState, setFlowState] = useState<AuthFlowState>({ type: "none" });

  const addMessage = useCallback(
    (type: ChatMessage["type"], content: string) => {
      dispatch({ type: "ADD_MESSAGE", payload: createMessage(type, content) });
    },
    [dispatch],
  );

  // When authState changes to needs_character, prompt for character name
  // Use setTimeout to avoid synchronous setState warning in effect
  useEffect(() => {
    if (authState === "needs_character" && flowState.type === "none") {
      const timer = setTimeout(() => {
        setFlowState({ type: "character_name" });
        addMessage("system", "");
        addMessage("system", "Choose a name for your character:");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [authState, flowState.type, addMessage]);

  const showWelcome = useCallback(() => {
    addMessage("system", "═══════════════════════════════════════════");
    addMessage("system", "         Welcome to the MUD Game!");
    addMessage("system", "═══════════════════════════════════════════");
    addMessage("system", "");
    addMessage("system", "To get started:");
    addMessage("system", "  • New player? Type: register");
    addMessage("system", "  • Returning? Type: login");
    addMessage("system", "");
  }, [addMessage]);

  const handleCommand = useCallback(
    async (input: string): Promise<boolean> => {
      const trimmedInput = input.trim();

      // Handle character name input
      if (flowState.type === "character_name") {
        if (!trimmedInput) {
          addMessage("error", "Character name cannot be empty.");
          return true;
        }

        if (!token) {
          addMessage("error", "Authentication error. Please login again.");
          setFlowState({ type: "none" });
          return true;
        }

        addMessage("system", `Character name: ${trimmedInput}`);
        addMessage("system", "Creating character...");

        try {
          const result = await api.createCharacter(token, trimmedInput);

          if (result.success && result.player) {
            setFlowState({ type: "none" });
            setPlayer(result.player);
            addMessage("system", `Character "${result.player.name}" created!`);
            addMessage("system", "Connecting to the game world...");
          } else {
            addMessage("error", result.error || "Character creation failed");
          }
        } catch {
          addMessage("error", "Connection error. Please try again.");
        }

        return true;
      }

      // Handle multi-step auth flows
      if (flowState.type === "login_username") {
        if (!trimmedInput) {
          addMessage("error", "Username cannot be empty.");
          return true;
        }
        addMessage("system", `Username: ${trimmedInput}`);
        setFlowState({ type: "login_password", username: trimmedInput });
        addMessage("system", "Enter your password:");
        return true;
      }

      if (flowState.type === "login_password") {
        if (!trimmedInput) {
          addMessage("error", "Password cannot be empty.");
          return true;
        }
        addMessage("system", "Password: ********");
        addMessage("system", "Logging in...");

        try {
          const result = await api.login(flowState.username, trimmedInput);

          if (result.success && result.token) {
            setAuth(result.token, result.player || null);
            setFlowState({ type: "none" });

            if (result.player) {
              addMessage("system", `Welcome back, ${result.player.name}!`);
              addMessage("system", "Connecting to the game world...");
            } else {
              addMessage("system", "Login successful!");
              // The useEffect will trigger character_name flow
            }
          } else {
            addMessage("error", result.error || "Login failed");
            setFlowState({ type: "none" });
          }
        } catch {
          addMessage("error", "Connection error. Please try again.");
          setFlowState({ type: "none" });
        }

        return true;
      }

      if (flowState.type === "register_username") {
        if (!trimmedInput) {
          addMessage("error", "Username cannot be empty.");
          return true;
        }
        if (trimmedInput.length < 3) {
          addMessage("error", "Username must be at least 3 characters.");
          return true;
        }
        addMessage("system", `Username: ${trimmedInput}`);
        setFlowState({ type: "register_password", username: trimmedInput });
        addMessage("system", "Choose a password (at least 6 characters):");
        return true;
      }

      if (flowState.type === "register_password") {
        if (!trimmedInput) {
          addMessage("error", "Password cannot be empty.");
          return true;
        }
        if (trimmedInput.length < 6) {
          addMessage("error", "Password must be at least 6 characters.");
          return true;
        }
        addMessage("system", "Password: ********");
        addMessage("system", "Creating account...");

        try {
          const result = await api.register(flowState.username, trimmedInput);

          if (result.success && result.token) {
            setAuth(result.token, null);
            setFlowState({ type: "none" });
            addMessage("system", "Account created successfully!");
            // The useEffect will trigger character_name flow
          } else {
            addMessage("error", result.error || "Registration failed");
            setFlowState({ type: "none" });
          }
        } catch {
          addMessage("error", "Connection error. Please try again.");
          setFlowState({ type: "none" });
        }

        return true;
      }

      // Handle initial commands
      const parts = trimmedInput.split(/\s+/);
      const command = parts[0]?.toLowerCase();

      // Handle login command - start flow
      if (command === "login") {
        if (authState === "authenticated") {
          addMessage("error", "You are already logged in.");
          return true;
        }
        if (authState === "needs_character") {
          addMessage(
            "error",
            'You are already logged in. Enter a character name or type "logout".',
          );
          return true;
        }

        setFlowState({ type: "login_username" });
        addMessage("system", "Enter your username:");
        return true;
      }

      // Handle register command - start flow
      if (command === "register") {
        if (authState !== "unauthenticated") {
          addMessage(
            "error",
            'You are already logged in. Type "logout" first.',
          );
          return true;
        }

        setFlowState({ type: "register_username" });
        addMessage("system", "Choose a username (at least 3 characters):");
        return true;
      }

      // Handle cancel during auth flow
      if (command === "cancel" && flowState.type !== "none") {
        setFlowState({ type: "none" });
        addMessage("system", "Cancelled.");
        return true;
      }

      // Handle logout command
      if (command === "logout") {
        if (authState === "unauthenticated") {
          addMessage("error", "You are not logged in.");
          return true;
        }

        // Return false to let Console handle the actual logout
        return false;
      }

      // Handle help for unauthenticated users
      if (command === "help" && authState === "unauthenticated") {
        addMessage("system", "Available commands:");
        addMessage("system", "  login    - Login to your account");
        addMessage("system", "  register - Create a new account");
        return true;
      }

      // Handle help for users needing character
      if (command === "help" && authState === "needs_character") {
        addMessage(
          "system",
          'Enter a name for your character, or type "logout" to log out.',
        );
        return true;
      }

      // If not authenticated, block other commands
      if (authState === "unauthenticated") {
        addMessage("error", "Please login or register first.");
        addMessage("system", 'Type "help" for available commands.');
        return true;
      }

      // If needs character, treat input as character name
      if (authState === "needs_character") {
        // This shouldn't happen since flowState should be character_name
        // but handle it just in case - the useEffect will set the flow state
        addMessage("system", "Choose a name for your character:");
        setFlowState({ type: "character_name" });
        return true;
      }

      // Command not handled by auth - pass to socket
      return false;
    },
    [authState, token, setAuth, setPlayer, addMessage, flowState],
  );

  // Determine input mode based on flow state
  const inputMode: InputMode =
    flowState.type === "login_password" ||
    flowState.type === "register_password"
      ? "password"
      : flowState.type === "login_username" ||
          flowState.type === "register_username"
        ? "username"
        : flowState.type === "character_name"
          ? "character_name"
          : "normal";

  // Determine placeholder based on flow state
  const inputPlaceholder =
    flowState.type === "login_username" ||
    flowState.type === "register_username"
      ? "Enter username..."
      : flowState.type === "login_password" ||
          flowState.type === "register_password"
        ? "Enter password..."
        : flowState.type === "character_name"
          ? "Enter character name..."
          : "Enter command...";

  return { handleCommand, showWelcome, inputMode, inputPlaceholder };
}
