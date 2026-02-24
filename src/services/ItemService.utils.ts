import type { items } from "../db/schema.js";
import type { Item } from "../types/item.js";
import { fuzzyMatch } from "../utils/fuzzyMatch.js";

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
 * Find an item by name using fuzzy matching (exact, prefix, or word match).
 * This is the generic matcher used by all inventory searches.
 * @template T - The inventory record type
 * @param entries - Array of inventory entries to search
 * @param searchName - The name to search for
 * @returns The matching item with inventory record, or null if not found
 */
export function findItemByName<T>(
  entries: InventoryEntry<T>[],
  searchName: string,
): GenericFindResult<T> {
  for (const entry of entries) {
    const result = fuzzyMatch(
      searchName,
      entry.itemRecord.name,
      entry.itemRecord.pluralName,
    );
    if (result.matches) {
      return {
        item: toItem(entry.rawItem),
        inventoryRecord: entry.inventoryRecord,
        matchedPlural: result.matchedPlural,
      };
    }
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
