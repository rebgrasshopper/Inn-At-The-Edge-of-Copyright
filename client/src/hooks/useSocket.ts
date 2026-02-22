/**
 * Socket.io connection hook with auto-reconnect and auth support.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ConnectionStatus } from "../types";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 1000;

type UseSocketOptions = {
  token: string | null;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
};

type UseSocketReturn = {
  socket: Socket | null;
  connectionStatus: ConnectionStatus;
  sendCommand: (command: string) => void;
  disconnect: () => void;
};

/**
 * Hook for managing Socket.io connection with authentication.
 * Connects when token is provided, auto-reconnects on disconnect.
 * @param options - Socket configuration options
 * @param options.token - JWT auth token (connects when provided)
 * @param options.onConnect - Callback when connected
 * @param options.onDisconnect - Callback when disconnected
 * @param options.onError - Callback on connection error
 * @returns Socket instance, connection status, and control functions
 */
export function useSocket({
  token,
  onConnect,
  onDisconnect,
  onError,
}: UseSocketOptions): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  // Use state for socket so changes trigger re-renders
  const [socket, setSocket] = useState<Socket | null>(null);

  // Connect to socket server
  const connect = useCallback(() => {
    if (!token || socketRef.current?.connected) return;

    setConnectionStatus("connecting");

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false, // We handle reconnection manually
    });

    newSocket.on("connect", () => {
      setConnectionStatus("connected");
      reconnectAttempts.current = 0;
      onConnect?.();
    });

    newSocket.on("disconnect", () => {
      setConnectionStatus("disconnected");
      onDisconnect?.();

      // Attempt reconnection with exponential backoff
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        const delay =
          RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts.current);
        reconnectAttempts.current++;
        setTimeout(() => connect(), delay);
      }
    });

    newSocket.on("connect_error", (error) => {
      setConnectionStatus("error");
      onError?.(error);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);
  }, [token, onConnect, onDisconnect, onError]);

  // Disconnect from socket server
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnectionStatus("disconnected");
    }
  }, []);

  // Send a command to the server
  const sendCommand = useCallback((command: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("command", command);
    }
  }, []);

  // Connect when token becomes available
  useEffect(() => {
    if (token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  return {
    socket,
    connectionStatus,
    sendCommand,
    disconnect,
  };
}
