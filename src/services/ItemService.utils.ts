import type { items } from "../db/schema.js";
import type { Item } from "../types/item.js";

export type ItemFindResult = {
  item: Item;
  inventoryId: string;
  quantity: number;
  matchedPlural: boolean;
};

/**
 * Generic item record with name fields for matching.
 * Used by findItemByName to work with any inventory source.
 */
export type ItemRecord = {
  name: string;
  pluralName?: string | null;
};

/**
 * Generic inventory entry that pairs an item with its inventory metadata.
 * @template T - The inventory record type (room_inventory, player_inventory, container_inventory)
 */
export type InventoryEntry<T> = {
  itemRecord: ItemRecord;
  inventoryRecord: T;
  /** Function to convert the raw item record to a full Item */
  rawItem: typeof items.$inferSelect;
};

/**
 * Result of a generic item search.
 * @template T - The inventory record type
 */
export type GenericFindResult<T> = {
  item: Item;
  inventoryRecord: T;
  matchedPlural: boolean;
} | null;

/**
 * Find an item by name using exact, prefix, or word matching.
 * This is the generic matcher used by all inventory searches.
 * @template T - The inventory record type
 * @param entries - Array of inventory entries to search
 * @param searchName - The name to search for (will be lowercased)
 * @returns The matching item with inventory record, or null if not found
 */
export function findItemByName<T>(
  entries: InventoryEntry<T>[],
  searchName: string,
): GenericFindResult<T> {
  const nameLower = searchName.toLowerCase();

  // Helper to check name/pluralName match
  const checkMatch = (
    record: ItemRecord,
    matchFn: (name: string) => boolean,
  ): boolean => {
    if (matchFn(record.name.toLowerCase())) return true;
    if (record.pluralName && matchFn(record.pluralName.toLowerCase()))
      return true;
    return false;
  };

  // Try exact match first
  const exactMatch = entries.find((e) =>
    checkMatch(e.itemRecord, (name) => name === nameLower),
  );
  if (exactMatch) {
    return {
      item: toItem(exactMatch.rawItem),
      inventoryRecord: exactMatch.inventoryRecord,
      matchedPlural: matchesPlural(
        nameLower,
        exactMatch.itemRecord.name,
        exactMatch.itemRecord.pluralName,
      ),
    };
  }

  // Try prefix match
  const prefixMatch = entries.find((e) =>
    checkMatch(e.itemRecord, (name) => name.startsWith(nameLower)),
  );
  if (prefixMatch) {
    return {
      item: toItem(prefixMatch.rawItem),
      inventoryRecord: prefixMatch.inventoryRecord,
      matchedPlural: matchesPlural(
        nameLower,
        prefixMatch.itemRecord.name,
        prefixMatch.itemRecord.pluralName,
      ),
    };
  }

  // Try word match (any word in the name starts with the search term)
  const wordMatch = entries.find((e) => {
    const words = e.itemRecord.name.toLowerCase().split(/\s+/);
    const pluralWords =
      e.itemRecord.pluralName?.toLowerCase().split(/\s+/) || [];
    return (
      words.some((w) => w.startsWith(nameLower)) ||
      pluralWords.some((w) => w.startsWith(nameLower))
    );
  });
  if (wordMatch) {
    return {
      item: toItem(wordMatch.rawItem),
      inventoryRecord: wordMatch.inventoryRecord,
      matchedPlural: matchesPlural(
        nameLower,
        wordMatch.itemRecord.name,
        wordMatch.itemRecord.pluralName,
      ),
    };
  }

  return null;
}

/**
 * Convert a database item row to an Item type.
 * @param row - Database row from items table
 * @returns Item object
 */
export function toItem(row: typeof items.$inferSelect): Item {
  return {
    id: row.id,
    name: row.name,
    pluralName: row.pluralName ?? undefined,
    description: row.description,
    category: row.category ?? undefined,
    isBulk: row.isBulk ?? false,
    equipSlots: row.equipSlots ?? undefined,
    weaponDamage: row.weaponDamage ?? undefined,
    weaponType: row.weaponType ?? undefined,
    magicProperties: row.magicProperties ?? undefined,
    effects: {
      str: row.strEffect ?? undefined,
      dex: row.dexEffect ?? undefined,
      con: row.conEffect ?? undefined,
      int: row.intEffect ?? undefined,
      wis: row.wisEffect ?? undefined,
      cha: row.chaEffect ?? undefined,
      hp: row.hpEffect ?? undefined,
    },
  };
}

/**
 * Check if a search term matches the plural form of an item.
 * @param nameLower - Lowercase search term
 * @param singularName - Item's singular name
 * @param pluralName - Item's plural name (optional)
 * @returns True if the search term matches the plural form
 */
export function matchesPlural(
  nameLower: string,
  singularName: string,
  pluralName: string | null | undefined,
): boolean {
  const singular = singularName.toLowerCase();
  const plural = pluralName?.toLowerCase();

  // Exact plural match
  if (plural && nameLower === plural) return true;

  // Prefix match on plural (but not singular)
  if (plural && nameLower.length > 0) {
    const matchesPluralPrefix = plural.startsWith(nameLower);
    const matchesSingularPrefix = singular.startsWith(nameLower);
    // If it matches plural prefix but not singular, it's plural
    if (matchesPluralPrefix && !matchesSingularPrefix) return true;
  }

  // Word match on plural words (but not singular words)
  if (plural) {
    const singularWords = singular.split(/\s+/);
    const pluralWords = plural.split(/\s+/);
    const matchesPluralWord = pluralWords.some((w) => w.startsWith(nameLower));
    const matchesSingularWord = singularWords.some((w) =>
      w.startsWith(nameLower),
    );
    if (matchesPluralWord && !matchesSingularWord) return true;
  }

  return false;
}

/**
 * Determine how many items to transfer based on request and context.
 * @param requestedQuantity - Explicit quantity, "all", or undefined for default
 * @param availableQuantity - How many are available
 * @param matchedPlural - Whether the user typed the plural form
 * @returns The quantity to transfer
 */
export function resolveQuantity(
  requestedQuantity: number | "all" | undefined,
  availableQuantity: number,
  matchedPlural: boolean,
): number {
  if (requestedQuantity === "all") {
    return availableQuantity;
  }
  if (requestedQuantity !== undefined) {
    return requestedQuantity;
  }
  // Default: plural form transfers all, singular transfers 1
  return matchedPlural ? availableQuantity : 1;
}

/**
 * Get the display name for an item based on quantity.
 * @param item - The item
 * @param quantity - How many
 * @returns Singular or plural name as appropriate
 */
export function getItemDisplayName(item: Item, quantity: number): string {
  if (quantity === 1) {
    return item.name;
  }
  return item.pluralName || `${item.name}s`;
}

/**
 * Generate auto-description of item stats for private info.
 * @param item - The item to describe
 * @returns Formatted stats string or empty string if no stats
 */
export function generateStatsDescription(item: Item): string {
  const parts: string[] = [];

  // Stat effects
  const statNames: Record<string, string> = {
    str: "STR",
    dex: "DEX",
    con: "CON",
    int: "INT",
    wis: "WIS",
    cha: "CHA",
    hp: "HP",
  };

  for (const [key, label] of Object.entries(statNames)) {
    const value = item.effects[key as keyof typeof item.effects];
    if (value && value !== 0) {
      parts.push(`${value > 0 ? "+" : ""}${value} ${label}`);
    }
  }

  // Weapon damage
  if (item.weaponDamage) {
    parts.push(
      `Damage: ${item.weaponDamage}${item.weaponType ? ` (${item.weaponType})` : ""}`,
    );
  }

  // Magic properties
  if (item.magicProperties && item.magicProperties.length > 0) {
    parts.push(`Magic: ${item.magicProperties.join(", ")}`);
  }

  // Equipment slot
  if (item.equipSlots && item.equipSlots.length > 0) {
    parts.push(`Slot: ${item.equipSlots.join(", ")}`);
  }

  return parts.length > 0 ? `[${parts.join(", ")}]` : "";
}
