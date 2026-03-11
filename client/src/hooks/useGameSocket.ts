/**
 * Hook that subscribes to socket game events and dispatches to GameContext.
 */

import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { useGame } from "../context/GameContext";
import type { ChatMessage, Player, Room } from "../types";

/**
 * Generates a unique ID for messages.
 * @returns Unique string ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates a system message object.
 * @param content - Message content
 * @returns ChatMessage object with system type
 */
function systemMessage(content: string): ChatMessage {
  return {
    id: generateId(),
    type: "system",
    content,
    timestamp: new Date(),
  };
}

/**
 * Creates a room name message object (bright white styling).
 * @param content - Room name
 * @returns ChatMessage object with roomName type
 */
function roomNameMessage(content: string): ChatMessage {
  return {
    id: generateId(),
    type: "roomName",
    content,
    timestamp: new Date(),
  };
}

/**
 * Formats a room's contents into display messages.
 * @param room - The room to format
 * @param currentPlayerId - The current player's ID (to exclude from player list)
 * @returns Array of message strings
 */
function formatRoomDescription(room: Room, currentPlayerId?: string): string[] {
  const lines: string[] = [];

  // Room name and description
  lines.push(room.name);
  lines.push(room.fullDescription || room.description);

  // Exits
  const exitDirs = Object.keys(room.exits);
  if (exitDirs.length > 0) {
    lines.push(`Exits: ${exitDirs.join(", ")}`);
  } else {
    lines.push("There are no obvious exits.");
  }

  // Other players
  const otherPlayers = room.players.filter((p) => p.id !== currentPlayerId);
  if (otherPlayers.length > 0) {
    const names = otherPlayers.map((p) => p.name).join(", ");
    lines.push(`Players here: ${names}`);
  }

  // Monsters
  if (room.monsters && room.monsters.length > 0) {
    const monsterNames = room.monsters.map((m) => m.monster.name);
    lines.push(`Creatures here: ${monsterNames.join(", ")}`);
  }

  // Corpses
  if (room.corpses && room.corpses.length > 0) {
    const corpseDescs = room.corpses.map((c) => `corpse of ${c.playerName}`);
    lines.push(`You see: ${corpseDescs.join(", ")}`);
  }

  // Items on the ground
  if (room.items.length > 0) {
    const itemDescs = room.items.map((stack) => {
      if (stack.quantity === 1) {
        return stack.item.name;
      }
      return `${stack.quantity} ${stack.item.name}s`;
    });
    lines.push(`You see: ${itemDescs.join(", ")}`);
  }

  return lines;
}

/**
 * Hook that subscribes to all game-related socket events and dispatches
 * state updates to the GameContext reducer.
 * @param socket - Socket.io client instance (null if not connected)
 */
export function useGameSocket(socket: Socket | null): void {
  const { dispatch } = useGame();

  useEffect(() => {
    if (!socket) return;

    // Room events
    const handleRoomEnter = (data: { room: Room; player: Player }) => {
      dispatch({ type: "SET_ROOM", payload: data.room });
      dispatch({ type: "SET_PLAYER", payload: data.player });

      // Show room name with special styling
      dispatch({
        type: "ADD_MESSAGE",
        payload: roomNameMessage(data.room.name),
      });

      // Show rest of room description
      const roomLines = formatRoomDescription(data.room, data.player.id);
      // Skip first line (room name) since we already added it
      for (const line of roomLines.slice(1)) {
        dispatch({
          type: "ADD_MESSAGE",
          payload: systemMessage(line),
        });
      }
    };

    const handleRoomLook = (data: { room: Room }) => {
      dispatch({ type: "SET_ROOM", payload: data.room });

      // Show room name with special styling
      dispatch({
        type: "ADD_MESSAGE",
        payload: roomNameMessage(data.room.name),
      });

      // Show rest of room description
      const roomLines = formatRoomDescription(data.room);
      // Skip first line (room name) since we already added it
      for (const line of roomLines.slice(1)) {
        dispatch({
          type: "ADD_MESSAGE",
          payload: systemMessage(line),
        });
      }
    };

    const handleRoomLeave = (data: {
      roomId: string;
      player?: Player;
      direction?: string;
    }) => {
      if (!data.player) return;
      const directionText = data.direction ? ` to the ${data.direction}` : "";
      dispatch({
        type: "ADD_MESSAGE",
        payload: systemMessage(`${data.player.name} leaves${directionText}.`),
      });
    };

    const handleRoomUpdate = (data: { room: Room }) => {
      dispatch({ type: "SET_ROOM", payload: data.room });
    };

    // Chat events
    const handleChatMessage = (data: {
      id: string;
      type: ChatMessage["type"];
      content: string;
      sender?: string;
      timestamp: string;
      rollInfo?: string;
    }) => {
      dispatch({
        type: "ADD_MESSAGE",
        payload: {
          id: data.id,
          type: data.type,
          content: data.content,
          sender: data.sender,
          timestamp: new Date(data.timestamp),
          rollInfo: data.rollInfo,
        },
      });
    };

    // Player events
    const handlePlayerUpdate = (data: { player: Partial<Player> }) => {
      dispatch({ type: "UPDATE_PLAYER", payload: data.player });
    };

    // Error events
    const handleError = (data: { message: string }) => {
      dispatch({
        type: "ADD_MESSAGE",
        payload: {
          id: generateId(),
          type: "error",
          content: data.message,
          timestamp: new Date(),
        },
      });
    };

    // System messages
    const handleSystemMessage = (data: { content: string }) => {
      dispatch({
        type: "ADD_MESSAGE",
        payload: systemMessage(data.content),
      });
    };

    // Subscribe to events
    socket.on("room:enter", handleRoomEnter);
    socket.on("room:look", handleRoomLook);
    socket.on("room:leave", handleRoomLeave);
    socket.on("room:update", handleRoomUpdate);
    socket.on("chat:message", handleChatMessage);
    socket.on("player:update", handlePlayerUpdate);
    socket.on("error", handleError);
    socket.on("system:message", handleSystemMessage);

    // Cleanup subscriptions
    return () => {
      socket.off("room:enter", handleRoomEnter);
      socket.off("room:look", handleRoomLook);
      socket.off("room:leave", handleRoomLeave);
      socket.off("room:update", handleRoomUpdate);
      socket.off("chat:message", handleChatMessage);
      socket.off("player:update", handlePlayerUpdate);
      socket.off("error", handleError);
      socket.off("system:message", handleSystemMessage);
    };
  }, [socket, dispatch]);
}
