/**
 * Dice rolling service for combat calculations.
 * Handles parsing dice notation (e.g., "1d6", "2d4+1") and rolling dice.
 */

/**
 * Represents a parsed dice roll specification
 */
export type DiceRoll = {
  count: number; // Number of dice (N in NdS)
  sides: number; // Die size (S in NdS)
  modifier: number; // Bonus/penalty (+M or -M)
};

/**
 * Result of executing a dice roll
 */
export type RollResult = {
  rolls: number[]; // Individual die results
  modifier: number; // Applied modifier
  total: number; // Sum of rolls + modifier
};

/** Regex pattern for dice notation: NdS, NdS+M, NdS-M */
const DICE_NOTATION_REGEX = /^(\d+)d(\d+)([+-]\d+)?$/i;

/**
 * Parse a dice notation string into a structured DiceRoll
 * @param notation - Dice string like "1d6", "2d4+1", "1d8-2"
 * @returns Parsed DiceRoll or null if invalid
 */
export function parseDiceNotation(notation: string): DiceRoll | null {
  const match = notation.trim().match(DICE_NOTATION_REGEX);
  if (!match) {
    return null;
  }

  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  // Validate reasonable values
  if (count < 1 || sides < 1 || count > 100 || sides > 100) {
    return null;
  }

  return { count, sides, modifier };
}

/**
 * Format a DiceRoll back to notation string
 * @param roll - Structured dice roll
 * @returns Notation string like "2d6+3" or "1d8-2"
 */
export function formatDiceNotation(roll: DiceRoll): string {
  const base = `${roll.count}d${roll.sides}`;
  if (roll.modifier === 0) {
    return base;
  }
  if (roll.modifier > 0) {
    return `${base}+${roll.modifier}`;
  }
  return `${base}${roll.modifier}`; // Negative already has minus sign
}

/**
 * Execute a dice roll
 * @param roll - Dice roll specification
 * @returns Result with individual rolls and total
 */
export function rollDice(roll: DiceRoll): RollResult {
  const rolls: number[] = [];

  for (let i = 0; i < roll.count; i++) {
    // Random integer from 1 to sides (inclusive)
    const result = Math.floor(Math.random() * roll.sides) + 1;
    rolls.push(result);
  }

  const sum = rolls.reduce((acc, val) => acc + val, 0);
  const total = sum + roll.modifier;

  return {
    rolls,
    modifier: roll.modifier,
    total,
  };
}

/**
 * Convenience function to parse and roll in one step
 * @param notation - Dice notation string
 * @returns Roll result or null if invalid notation
 */
export function roll(notation: string): RollResult | null {
  const parsed = parseDiceNotation(notation);
  if (!parsed) {
    return null;
  }
  return rollDice(parsed);
}

/**
 * Roll a d20 (commonly used for attack rolls, skill checks, etc.)
 * @param modifier - Optional modifier to add to the roll
 * @returns The d20 result plus modifier
 */
export function rollD20(modifier: number = 0): number {
  const result = Math.floor(Math.random() * 20) + 1;
  return result + modifier;
}

/**
 * Result of a d20 roll with details for display
 */
export type D20RollResult = {
  total: number; // Final result (roll + modifier)
  roll: number; // Raw die roll (1-20)
  modifier: number; // Modifier applied
  formula: string; // Human-readable: "d20+3 = 17"
};

/**
 * Roll a d20 and return detailed result for display
 * @param modifier - Modifier to add to the roll
 * @returns D20RollResult with total, raw roll, modifier, and formatted string
 */
export function rollD20WithDetails(modifier: number = 0): D20RollResult {
  const roll = Math.floor(Math.random() * 20) + 1;
  const total = roll + modifier;
  const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  const formula = `d20${modStr} = ${total}`;

  return { total, roll, modifier, formula };
}

/**
 * Result of a damage roll with details for display
 */
export type DamageRollResult = {
  total: number; // Final damage
  rolls: number[]; // Individual die results
  modifier: number; // Modifier applied
  formula: string; // Human-readable: "d6+2 = 7"
};

/**
 * Roll damage dice and return detailed result for display
 * @param notation - Dice notation string (e.g., "1d6", "2d4+1")
 * @returns DamageRollResult with details, or null if invalid notation
 */
export function rollDamageWithDetails(
  notation: string,
): DamageRollResult | null {
  const parsed = parseDiceNotation(notation);
  if (!parsed) {
    return null;
  }

  const result = rollDice(parsed);
  const formula = `${notation} = ${result.total}`;

  return {
    total: result.total,
    rolls: result.rolls,
    modifier: result.modifier,
    formula,
  };
}

/**
 * Format a roll result for display
 * @param result - The roll result to format
 * @param notation - Original notation for context
 * @returns Formatted string like "2d6+3: [4, 2] + 3 = 9"
 */
export function formatRollResult(result: RollResult, notation: string): string {
  const rollsStr = `[${result.rolls.join(", ")}]`;
  if (result.modifier === 0) {
    return `${notation}: ${rollsStr} = ${result.total}`;
  }
  const modStr =
    result.modifier > 0
      ? `+ ${result.modifier}`
      : `- ${Math.abs(result.modifier)}`;
  return `${notation}: ${rollsStr} ${modStr} = ${result.total}`;
}
