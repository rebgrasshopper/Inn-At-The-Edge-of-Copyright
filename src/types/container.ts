export type Container = {
  id: string;
  roomId: string;
  name: string;
  description: string;
  // null = never hidden (always visible), true = currently hidden, false = currently visible
  isHidden: boolean | null;
  // When the container was last revealed (for time-based re-hiding)
  revealedAt?: Date;
  isOpen: boolean;
  revealCommand?: string;
};
