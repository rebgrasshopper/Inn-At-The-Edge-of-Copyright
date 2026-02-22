import * as fc from "fast-check";
import type { Direction } from "../../src/types/room.js";

const DIRECTIONS: Direction[] = [
  "north",
  "south",
  "east",
  "west",
  "up",
  "down",
];

/**
 * Generator for valid direction values
 */
export const directionArb = fc.constantFrom(...DIRECTIONS);

/**
 * Generator for room IDs
 */
export const roomIdArb = fc
  .string({ minLength: 5, maxLength: 30 })
  .map((s) => `room-${s.replace(/[^a-zA-Z0-9]/g, "x")}`);

/**
 * Generator for exit configurations (subset of directions with room IDs)
 */
export const exitsArb = fc
  .subarray(DIRECTIONS, { minLength: 0, maxLength: 6 })
  .chain((dirs) =>
    fc.tuple(
      fc.constant(dirs),
      fc.array(roomIdArb, { minLength: dirs.length, maxLength: dirs.length }),
    ),
  )
  .map(([dirs, roomIds]) => {
    const exits: Partial<
      Record<Direction, { roomId: string; blocked?: boolean }>
    > = {};
    dirs.forEach((dir, i) => {
      exits[dir] = { roomId: roomIds[i] };
    });
    return exits;
  });

/**
 * Generator for exits with some blocked
 */
export const exitsWithBlockedArb = fc
  .subarray(DIRECTIONS, { minLength: 1, maxLength: 6 })
  .chain((dirs) =>
    fc.tuple(
      fc.constant(dirs),
      fc.array(roomIdArb, { minLength: dirs.length, maxLength: dirs.length }),
      fc.array(fc.boolean(), {
        minLength: dirs.length,
        maxLength: dirs.length,
      }),
    ),
  )
  .map(([dirs, roomIds, blocked]) => {
    const exits: Partial<
      Record<
        Direction,
        { roomId: string; blocked?: boolean; blockMessage?: string }
      >
    > = {};
    dirs.forEach((dir, i) => {
      exits[dir] = {
        roomId: roomIds[i],
        blocked: blocked[i] || undefined,
        blockMessage: blocked[i] ? "The way is blocked." : undefined,
      };
    });
    return exits;
  });
