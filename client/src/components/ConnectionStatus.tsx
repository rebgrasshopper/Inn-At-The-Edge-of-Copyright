/**
 * Connection status indicator component.
 */

import type { ConnectionStatus as ConnectionStatusType } from "../types";
import "./ConnectionStatus.css";

type ConnectionStatusProps = {
  status: ConnectionStatusType;
};

const STATUS_CONFIG: Record<
  ConnectionStatusType,
  { label: string; className: string }
> = {
  connected: { label: "Connected", className: "status-connected" },
  connecting: { label: "Connecting...", className: "status-connecting" },
  disconnected: { label: "Disconnected", className: "status-disconnected" },
  error: { label: "Connection Error", className: "status-error" },
};

/**
 * Displays current connection status with colored indicator dot.
 * @param props - Component props
 * @param props.status - Current connection status
 * @returns Status indicator component
 */
export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={`connection-status ${config.className}`}>
      <span className="status-dot" />
      <span className="status-label">{config.label}</span>
    </div>
  );
}
