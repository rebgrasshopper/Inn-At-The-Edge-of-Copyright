/**
 * Main game console component composing ChatPanel and InputPanel.
 * Handles auth flow through chat commands.
 */

import { useEffect, useCallback, useRef } from "react";
import { useGame } from "../context/GameContext";
import { useAuth } from "../context/AuthContext";
import { useSocketContext } from "../context/SocketContext";
import { useGameSocket } from "../hooks/useGameSocket";
import { useAuthCommands } from "../hooks/useAuthCommands";
import { ChatPanel } from "./ChatPanel";
import { InputPanel } from "./InputPanel";
import { ConnectionStatus } from "./ConnectionStatus";
import { GameLogo } from "./GameLogo";
import "./Console.css";

/**
 * Main console component that displays chat messages and command input.
 * Handles authentication via chat commands before connecting to socket.
 * @returns Console component with chat panel, input, and status indicator
 */
export function Console() {
  const { state, dispatch } = useGame();
  const { authState, logout, isLoading } = useAuth();
  const { socket, connectionStatus, sendCommand } = useSocketContext();
  const {
    handleCommand: handleAuthCommand,
    showWelcome,
    inputMode,
    inputPlaceholder,
  } = useAuthCommands();
  const welcomeShownRef = useRef(false);

  // Subscribe to game socket events
  useGameSocket(socket);

  // Show welcome message on first render (only for unauthenticated users with no token)
  useEffect(() => {
    if (!isLoading && !welcomeShownRef.current) {
      welcomeShownRef.current = true;
      // Only show welcome if truly unauthenticated (no token at all)
      if (authState === "unauthenticated") {
        showWelcome();
      }
    }
  }, [isLoading, authState, showWelcome]);

  const handleSubmit = useCallback(
    async (input: string) => {
      // Handle logout specially - needs to disconnect socket and show message
      if (input.trim().toLowerCase() === "logout") {
        if (authState !== "unauthenticated") {
          logout();
          dispatch({
            type: "ADD_MESSAGE",
            payload: {
              id: `${Date.now()}`,
              type: "system",
              content: "You have been logged out.",
              timestamp: new Date(),
            },
          });
          dispatch({
            type: "ADD_MESSAGE",
            payload: {
              id: `${Date.now()}-2`,
              type: "system",
              content: 'Type "login" to log back in.',
              timestamp: new Date(),
            },
          });
          return;
        }
      }

      // Try auth commands first
      const handled = await handleAuthCommand(input);
      if (handled) return;

      // If authenticated with character, send to socket
      if (authState === "authenticated" && connectionStatus === "connected") {
        sendCommand(input);
      }
    },
    [
      authState,
      connectionStatus,
      handleAuthCommand,
      sendCommand,
      logout,
      dispatch,
    ],
  );

  // Determine if input should be disabled
  const isInputDisabled = isLoading;

  // Show connection status only when authenticated
  const showConnectionStatus = authState === "authenticated";

  return (
    <div className="console">
      <header className="console-header">
        <GameLogo />
        {showConnectionStatus && <ConnectionStatus status={connectionStatus} />}
      </header>
      <ChatPanel messages={state.messages} />
      <InputPanel
        onSubmit={handleSubmit}
        disabled={isInputDisabled}
        inputMode={inputMode}
        placeholder={inputPlaceholder}
      />
    </div>
  );
}
