/**
 * Scrollable chat message panel with smart auto-scroll.
 */

import { useRef, useEffect, useCallback } from "react";
import type { ChatMessage as ChatMessageType } from "../types";
import { ChatMessage } from "./ChatMessage";
import "./ChatPanel.css";

type ChatPanelProps = {
  messages: ChatMessageType[];
};

/**
 * Displays a scrollable list of chat messages with auto-scroll behavior.
 * Only auto-scrolls when user is already at the bottom of the list.
 * @param props - Component props
 * @param props.messages - Array of chat messages to display
 * @returns Scrollable chat panel component
 */
export function ChatPanel({ messages }: ChatPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const threshold = 50; // pixels from bottom to consider "at bottom"
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // Track scroll position
  const handleScroll = useCallback(() => {
    isAtBottomRef.current = checkIfAtBottom();
  }, [checkIfAtBottom]);

  // Auto-scroll when new messages arrive (if at bottom)
  useEffect(() => {
    if (isAtBottomRef.current) {
      // Double requestAnimationFrame ensures DOM is fully updated after React render
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      });
    }
  }, [messages, scrollToBottom]);

  return (
    <div ref={containerRef} className="chat-panel" onScroll={handleScroll}>
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
    </div>
  );
}
