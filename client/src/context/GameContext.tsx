/**
 * Game state context using useReducer for centralized state management.
 * Manages messages, player state, room state, and connection status.
 */

import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { ChatMessage, Player, Room, ConnectionStatus } from "../types";

type GameState = {
  messages: ChatMessage[];
  player: Player | null;
  room: Room | null;
  connectionStatus: ConnectionStatus;
};

type GameAction =
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "SET_MESSAGES"; payload: ChatMessage[] }
  | { type: "SET_PLAYER"; payload: Player | null }
  | { type: "UPDATE_PLAYER"; payload: Partial<Player> }
  | { type: "SET_ROOM"; payload: Room | null }
  | { type: "SET_CONNECTION_STATUS"; payload: ConnectionStatus }
  | { type: "CLEAR_MESSAGES" };

const MAX_MESSAGES = 500;

const initialState: GameState = {
  messages: [],
  player: null,
  room: null,
  connectionStatus: "disconnected",
};

/**
 * Reducer function for game state updates.
 * @param state - Current game state
 * @param action - Action to perform
 * @returns Updated game state
 */
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "ADD_MESSAGE": {
      const newMessages = [...state.messages, action.payload];
      // Trim to max messages limit
      if (newMessages.length > MAX_MESSAGES) {
        return { ...state, messages: newMessages.slice(-MAX_MESSAGES) };
      }
      return { ...state, messages: newMessages };
    }
    case "SET_MESSAGES":
      return { ...state, messages: action.payload.slice(-MAX_MESSAGES) };
    case "SET_PLAYER":
      return { ...state, player: action.payload };
    case "UPDATE_PLAYER":
      if (!state.player) return state;
      return { ...state, player: { ...state.player, ...action.payload } };
    case "SET_ROOM":
      return { ...state, room: action.payload };
    case "SET_CONNECTION_STATUS":
      return { ...state, connectionStatus: action.payload };
    case "CLEAR_MESSAGES":
      return { ...state, messages: [] };
    default:
      return state;
  }
}

type GameContextValue = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
};

const GameContext = createContext<GameContextValue | null>(null);

/**
 * Provider component for game state context.
 * @param props - Component props
 * @param props.children - Child components to wrap
 * @returns Provider component wrapping children
 */
export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

/**
 * Hook to access game state and dispatch function.
 * @returns Game context value with state and dispatch
 * @throws Error if used outside of GameProvider
 */
export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}

export type { GameState, GameAction };
