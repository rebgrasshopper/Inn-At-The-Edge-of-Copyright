/**
 * Socket context provider for managing WebSocket connection.
 */

import { createContext, useContext, type ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { useSocket } from "../hooks/useSocket";
import type { ConnectionStatus } from "../types";

type SocketContextValue = {
  socket: Socket | null;
  connectionStatus: ConnectionStatus;
  sendCommand: (command: string) => void;
  disconnect: () => void;
};

const SocketContext = createContext<SocketContextValue | null>(null);

type SocketProviderProps = {
  children: ReactNode;
  token: string | null;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
};

/**
 * Provider component for socket connection context.
 * @param props - Component props
 * @param props.children - Child components to wrap
 * @param props.token - JWT auth token for socket authentication
 * @param props.onConnect - Callback when socket connects
 * @param props.onDisconnect - Callback when socket disconnects
 * @param props.onError - Callback on socket error
 * @returns Provider component wrapping children
 */
export function SocketProvider({
  children,
  token,
  onConnect,
  onDisconnect,
  onError,
}: SocketProviderProps) {
  const socketState = useSocket({ token, onConnect, onDisconnect, onError });

  return (
    <SocketContext.Provider value={socketState}>
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Hook to access socket connection and controls.
 * @returns Socket context value
 * @throws Error if used outside of SocketProvider
 */
export function useSocketContext(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocketContext must be used within a SocketProvider");
  }
  return context;
}
