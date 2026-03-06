import type { ItemSize } from "../db/schema.js";

export type Container = {
  id: string;
  roomId: string;
  name: string;
  description: string;
  // Alternative names for the container
  aliases?: string[];
  // Text shown in room description when container is revealed
  revealedText?: string;
  // null = never hidden (always visible), true = currently hidden, false = currently visible
  isHidden: boolean | null;
  // When the container was last revealed (for time-based re-hiding)
  revealedAt?: Date;
  isOpen: boolean;
  revealCommand?: string;
  /** Size: 0=tiny, 1=small, 2=medium, 3=large, 4=huge. Items must be strictly smaller to fit. */
  size: ItemSize;
  // Discovery scope: null or "global" = revealed for everyone, "personal" = only for discoverer
  discoveryScope?: string | null;
};
