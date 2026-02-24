/**
 * Fuzzy matching utility for name lookups.
 * Used for items, equipment, containers, corpses, etc.
 */

/**
 * Result of a fuzzy match attempt
 */
export type FuzzyMatchResult = {
  matches: boolean;
  matchedPlural: boolean;
};

/**
 * Fuzzy match a search term against a name (and optional plural).
 * Matching priority: exact > prefix > word match.
 *
 * @param searchTerm - The user's search input
 * @param name - The canonical name to match against
 * @param pluralName - Optional plural form of the name
 * @returns Match result with whether it matched and if it matched the plural form
 */
export function fuzzyMatch(
  searchTerm: string,
  name: string,
  pluralName?: string | null,
): FuzzyMatchResult {
  const searchLower = searchTerm.toLowerCase();
  const nameLower = name.toLowerCase();
  const pluralLower = pluralName?.toLowerCase();

  // Empty search term never matches
  if (searchLower.length === 0) {
    return { matches: false, matchedPlural: false };
  }

  // Exact match on singular
  if (nameLower === searchLower) {
    return { matches: true, matchedPlural: false };
  }

  // Exact match on plural
  if (pluralLower && pluralLower === searchLower) {
    return { matches: true, matchedPlural: true };
  }

  // Prefix match on singular
  if (nameLower.startsWith(searchLower)) {
    return { matches: true, matchedPlural: false };
  }

  // Prefix match on plural
  if (pluralLower && pluralLower.startsWith(searchLower)) {
    return { matches: true, matchedPlural: true };
  }

  // Word match on singular (any word starts with search term)
  const singularWords = nameLower.split(/\s+/);
  if (singularWords.some((word) => word.startsWith(searchLower))) {
    return { matches: true, matchedPlural: false };
  }

  // Word match on plural
  if (pluralLower) {
    const pluralWords = pluralLower.split(/\s+/);
    if (pluralWords.some((word) => word.startsWith(searchLower))) {
      return { matches: true, matchedPlural: true };
    }
  }

  return { matches: false, matchedPlural: false };
}

/**
 * Find the first matching item from a list using fuzzy matching.
 *
 * @param searchTerm - The user's search input
 * @param candidates - Array of candidates with name and optional pluralName
 * @returns The matching candidate and match info, or null if not found
 */
export function fuzzyFindFirst<
  T extends { name: string; pluralName?: string | null },
>(
  searchTerm: string,
  candidates: T[],
): { item: T; matchedPlural: boolean } | null {
  for (const candidate of candidates) {
    const result = fuzzyMatch(searchTerm, candidate.name, candidate.pluralName);
    if (result.matches) {
      return { item: candidate, matchedPlural: result.matchedPlural };
    }
  }
  return null;
}
