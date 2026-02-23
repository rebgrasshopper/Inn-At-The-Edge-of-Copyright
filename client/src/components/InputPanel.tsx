/**
 * Command input panel with history navigation and password mode support.
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type FormEvent,
} from "react";
import type { InputMode } from "../hooks/useAuthCommands";
import "./InputPanel.css";

const MAX_HISTORY = 500;

type InputPanelProps = {
  onSubmit: (command: string) => void;
  disabled?: boolean;
  inputMode?: InputMode;
  placeholder?: string;
};

/**
 * Text input for entering game commands with up/down arrow history navigation.
 * Supports password mode for masked input during authentication.
 * @param props - Component props
 * @param props.onSubmit - Callback when command is submitted
 * @param props.disabled - Whether input is disabled
 * @param props.inputMode - Input mode: 'normal', 'username', or 'password'
 * @param props.placeholder - Placeholder text for input
 * @returns Input panel component with form
 */
export function InputPanel({
  onSubmit,
  disabled = false,
  inputMode = "normal",
  placeholder = "Enter command...",
}: InputPanelProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const historyIndexRef = useRef(-1);
  const savedInputRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount (with small delay to ensure DOM is ready)
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) return;

      onSubmit(trimmed);

      // Only add to history for normal mode (not passwords)
      if (inputMode === "normal") {
        setHistory((prev) => {
          const newHistory =
            prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed];
          return newHistory.slice(-MAX_HISTORY);
        });
      }

      setInput("");
      historyIndexRef.current = -1;
      savedInputRef.current = "";
    },
    [input, onSubmit, inputMode],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Only allow history navigation in normal mode
      if (inputMode !== "normal") return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length === 0) return;

        // Save current input when starting to navigate
        if (historyIndexRef.current === -1) {
          savedInputRef.current = input;
        }

        const newIndex =
          historyIndexRef.current === -1
            ? history.length - 1
            : Math.max(0, historyIndexRef.current - 1);

        historyIndexRef.current = newIndex;
        setInput(history[newIndex]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndexRef.current === -1) return;

        const newIndex = historyIndexRef.current + 1;

        if (newIndex >= history.length) {
          // Restore saved input
          historyIndexRef.current = -1;
          setInput(savedInputRef.current);
        } else {
          historyIndexRef.current = newIndex;
          setInput(history[newIndex]);
        }
      }
    },
    [history, input, inputMode],
  );

  // Determine input type based on mode
  const inputType = inputMode === "password" ? "password" : "text";

  return (
    <form className="input-panel" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type={inputType}
        className="command-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="submit"
        className="submit-button"
        disabled={disabled || !input.trim()}
        aria-label="Send command"
      >
        →
      </button>
    </form>
  );
}
