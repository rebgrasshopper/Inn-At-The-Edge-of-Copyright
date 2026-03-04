/**
 * Parses prerequisite text into structured data for feat requirements.
 * Supports stat requirements, level requirements, BAB requirements, and feat prerequisites.
 */

/** Valid stat keys for stat prerequisites */
type StatKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

/**
 * Parsed prerequisite representing a single requirement.
 * - stat: Requires a minimum ability score (e.g., "Dex 13")
 * - level: Requires a minimum character level (e.g., "level 5")
 * - bab: Requires a minimum base attack bonus (e.g., "base attack bonus +1")
 * - feat: Requires another feat to be acquired (e.g., "Dodge")
 * - unsupported: Prerequisite that cannot be evaluated by current game systems
 */
export type ParsedPrerequisite =
  | { type: "stat"; key: StatKey; value: number }
  | { type: "level"; key: null; value: number }
  | { type: "bab"; key: null; value: number }
  | { type: "feat"; key: string; value: null }
  | { type: "unsupported"; key: string; value: null };

/**
 * Result of parsing prerequisite text.
 * @property prerequisites - Array of parsed prerequisites
 * @property supportability - Overall supportability status based on parsed prerequisites
 */
export type ParseResult = {
  prerequisites: ParsedPrerequisite[];
  supportability: "supported" | "unsupported" | "partially_supported";
};

/** Regex pattern for stat requirements: "Str 13", "Dex 15", etc. */
const STAT_PATTERN = /(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)/i;

/** Regex pattern for level requirements: "level 5", "character level 10" */
const LEVEL_PATTERN = /(?:character\s+)?level\s+(\d+)/i;

/** Regex pattern for BAB requirements: "base attack bonus +1" */
const BAB_PATTERN = /base attack bonus \+(\d+)/i;

/**
 * Parse prerequisite text into structured prerequisites.
 * Supported patterns:
 * - Stat: "Str 13", "Dex 15", etc.
 * - Level: "level 5", "character level 10"
 * - BAB: "base attack bonus +1" (converted to level requirement: BAB * 3)
 * - Feat: matches against known feat names
 * @param text - Raw prerequisite text from CSV
 * @param knownFeatNames - Set of feat names for feat prerequisite matching
 * @returns Parsed prerequisites and supportability status
 */
export function parsePrerequisites(
  text: string,
  knownFeatNames: Set<string>,
): ParseResult {
  if (!text || text.trim() === "") {
    return {
      prerequisites: [],
      supportability: "supported",
    };
  }

  // Handle "—" (em dash) or "none" as meaning no prerequisites
  const trimmedText = text.trim();
  if (trimmedText === "—" || trimmedText.toLowerCase() === "none") {
    return {
      prerequisites: [],
      supportability: "supported",
    };
  }

  const prerequisites: ParsedPrerequisite[] = [];

  // Build a case-insensitive lookup map for feat names
  const knownFeatNamesLower = new Map<string, string>();
  for (const name of knownFeatNames) {
    knownFeatNamesLower.set(name.toLowerCase(), name);
  }

  // Split text into segments and process each one
  const segments = splitPrerequisiteText(text);

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const parsed = parseSegment(trimmed, knownFeatNamesLower);
    if (parsed) {
      prerequisites.push(parsed);
    }
  }

  // Determine supportability status
  const supportability = determineSupportability(prerequisites);

  return { prerequisites, supportability };
}

/**
 * Parse a single prerequisite segment into a structured prerequisite.
 * @param segment - A single prerequisite segment (trimmed)
 * @param knownFeatNamesLower - Map of lowercase feat names to original names
 * @returns Parsed prerequisite or null if segment is empty
 */
function parseSegment(
  segment: string,
  knownFeatNamesLower: Map<string, string>,
): ParsedPrerequisite | null {
  // Try stat pattern first
  const statMatch = segment.match(STAT_PATTERN);
  if (statMatch) {
    const statName = statMatch[1].toLowerCase() as StatKey;
    const value = parseInt(statMatch[2], 10);
    return { type: "stat", key: statName, value };
  }

  // Try level pattern
  const levelMatch = segment.match(LEVEL_PATTERN);
  if (levelMatch) {
    const value = parseInt(levelMatch[1], 10);
    return { type: "level", key: null, value };
  }

  // Try BAB pattern
  const babMatch = segment.match(BAB_PATTERN);
  if (babMatch) {
    const value = parseInt(babMatch[1], 10);
    return { type: "bab", key: null, value };
  }

  // Check if segment matches a known feat name (case-insensitive)
  const originalFeatName = knownFeatNamesLower.get(segment.toLowerCase());
  if (originalFeatName) {
    return { type: "feat", key: originalFeatName, value: null };
  }

  // Mark as unsupported if not recognized
  return { type: "unsupported", key: segment, value: null };
}

/**
 * Split prerequisite text into individual segments.
 * Splits on commas, semicolons, and "or" (treating "or" as separate requirements).
 * @param text - Raw prerequisite text
 * @returns Array of individual prerequisite segments
 */
function splitPrerequisiteText(text: string): string[] {
  // Split on commas, semicolons, and standalone "or"
  return text
    .split(/[,;]|\bor\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Determine the supportability status based on parsed prerequisites.
 * - "supported": All prerequisites are evaluable (stat, level, bab, feat)
 * - "unsupported": All prerequisites are unsupported
 * - "partially_supported": Mix of supported and unsupported prerequisites
 * @param prerequisites - Array of parsed prerequisites
 * @returns Supportability status
 */
function determineSupportability(
  prerequisites: ParsedPrerequisite[],
): "supported" | "unsupported" | "partially_supported" {
  if (prerequisites.length === 0) {
    return "supported";
  }

  const supportedCount = prerequisites.filter(
    (p) => p.type !== "unsupported",
  ).length;
  const unsupportedCount = prerequisites.filter(
    (p) => p.type === "unsupported",
  ).length;

  if (unsupportedCount === 0) {
    return "supported";
  }
  if (supportedCount === 0) {
    return "unsupported";
  }
  return "partially_supported";
}

/**
 * Scale a Pathfinder level to game level.
 * Pathfinder uses levels 1-20, while this game uses levels 1-99.
 * Formula: ourLevel = Math.round(pfLevel * (1 + pfLevel * 0.1))
 *
 * Expected mappings:
 * - PF level 1 → game level 1
 * - PF level 5 → game level 8
 * - PF level 10 → game level 20
 * - PF level 15 → game level 38
 * - PF level 20 → game level 60
 *
 * @param pfLevel - Pathfinder level (1-20)
 * @returns Scaled game level
 */
export function scaleLevel(pfLevel: number): number {
  return Math.round(pfLevel * (1 + pfLevel * 0.1));
}

/**
 * Convert BAB requirement to level requirement.
 * BAB is calculated from level as: BAB = floor(level / 3)
 * The inverse gives us the minimum level needed for a given BAB.
 * Formula: requiredLevel = babValue * 3
 *
 * Expected mappings:
 * - BAB +1 requires level 3
 * - BAB +2 requires level 6
 * - BAB +3 requires level 9
 *
 * @param bab - Required BAB value
 * @returns Required level to achieve that BAB
 */
export function babToLevel(bab: number): number {
  return bab * 3;
}
