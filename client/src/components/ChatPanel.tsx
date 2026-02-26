/**
 * Scrollable chat message panel with virtual scrolling and smart auto-scroll.
 * Uses @tanstack/react-virtual for performance with large message lists.
 */

import { useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ChatMessage as ChatMessageType } from "../types";
import { ChatMessage } from "./ChatMessage";
import "./ChatPanel.css";

type ChatPanelProps = {
  messages: ChatMessageType[];
};

/** Estimated height of a single-line message in pixels */
const ESTIMATED_ROW_HEIGHT = 24;

/** Number of extra items to render above/below the visible area */
const OVERSCAN_COUNT = 5;

/** Pixels from bottom to consider "at bottom" for auto-scroll */
const SCROLL_THRESHOLD = 50;

/**
 * Displays a virtualized, scrollable list of chat messages with auto-scroll behavior.
 * Only auto-scrolls when user is already at the bottom of the list.
 * Uses virtual scrolling to efficiently render large message lists.
 * @param props - Component props
 * @param props.messages - Array of chat messages to display
 * @returns Scrollable chat panel component with virtual scrolling
 */
export function ChatPanel({ messages }: ChatPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(messages.length);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
  });

  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      SCROLL_THRESHOLD
    );
  }, []);

  const scrollToBottom = useCallback(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages.length, virtualizer]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    isAtBottomRef.current = checkIfAtBottom();
  }, [checkIfAtBottom]);

  // Auto-scroll when new messages arrive (if at bottom)
  useEffect(() => {
    const hasNewMessages = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (hasNewMessages && isAtBottomRef.current) {
      // Double requestAnimationFrame ensures DOM is fully updated after React render
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      });
    }
  }, [messages.length, scrollToBottom]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div ref={containerRef} className="chat-panel" onScroll={handleScroll}>
      <div
        className="chat-panel-inner"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const message = messages[virtualItem.index];
          return (
            <div
              key={message.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="chat-panel-item"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ChatMessage message={message} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
