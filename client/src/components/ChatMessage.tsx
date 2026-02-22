/**
 * Individual chat message component with type-based styling.
 */

import type { ChatMessage as ChatMessageType } from "../types";
import "./ChatMessage.css";

type ChatMessageProps = {
  message: ChatMessageType;
};

/**
 * Renders a single chat message with appropriate styling based on type.
 * @param props - Component props
 * @param props.message - The chat message to display
 * @returns Styled message paragraph element
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const className = `chat-message msg-${message.type}`;

  const prefix = message.sender ? `${message.sender}: ` : "";
  const content =
    message.type === "emote" && message.sender
      ? `* ${message.sender} ${message.content}`
      : `${prefix}${message.content}`;

  return <p className={className}>{content}</p>;
}
