/**
 * Equipment functions - equip, unequip, and equipment list.
 */

import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { items, players } from "../../db/schema.js";
import type { EquipmentSlot } from "../../types/item.js";
import {
  EQUIPMENT_SLOT_TO_FIELD,
  type PlayerEquipment,
} from "../../types/player.js";
import { fuzzyMatch } from "../../utils/fuzzyMatch.js";
import { toItem } from "../ItemService.utils.js";
import { findItemInPlayerInventory } from "./finders.js";
import type { ItemResult } from "./transfer.js";

/** Maps slot names to database column names */
const SLOT_TO_DB_COLUMN: Record<keyof PlayerEquipment, string> = {
  head: "wornHead",
  torso: "wornTorso",
  body: "wornBody",
  legs: "wornLegs",
  hands: "wornHands",
  feet: "wornFeet",
  mainHand: "wornMainHand",
  offHand: "wornOffHand",
  neck: "wornNeck",
  ring1: "wornRing1",
  ring2: "wornRing2",
};

/** Slot aliases for user input */
const SLOT_ALIASES: Record<string, EquipmentSlot | "ring1" | "ring2"> = {
  head: "head",
  helmet: "head",
  hat: "head",
  torso: "torso",
  chest: "torso",
  shirt: "torso",
  body: "body",
  armor: "body",
  legs: "legs",
  pants: "legs",
  leggings: "legs",
  hands: "hands",
  gloves: "hands",
  gauntlets: "hands",
  feet: "feet",
  boots: "feet",
  shoes: "feet",
  mainhand: "mainHand",
  main: "mainHand",
  weapon: "mainHand",
  offhand: "offHand",
  off: "offHand",
  shield: "offHand",
  neck: "neck",
  necklace: "neck",
  amulet: "neck",
  ring: "ring",
  ring1: "ring1",
  ring2: "ring2",
};

/**
 * Parse a slot name from user input.
 * @param input - User-provided slot name
 * @returns The canonical slot name or null if invalid
 */
function parseSlot(input: string): keyof PlayerEquipment | null {
  const normalized = input.toLowerCase().replace(/[\s-_]/g, "");
  const slot = SLOT_ALIASES[normalized];
  if (!slot) return null;
  return EQUIPMENT_SLOT_TO_FIELD[slot];
}

/**
 * Get the current equipment for a player.
 * @param playerId - The player's ID
 * @returns PlayerEquipment object or null if player not found
 */
export async function getPlayerEquipment(
  playerId: string,
): Promise<PlayerEquipment | null> {
  const player = db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) return null;

  return {
    head: player.wornHead,
    torso: player.wornTorso,
    body: player.wornBody,
    legs: player.wornLegs,
    hands: player.wornHands,
    feet: player.wornFeet,
    mainHand: player.wornMainHand,
    offHand: player.wornOffHand,
    neck: player.wornNeck,
    ring1: player.wornRing1,
    ring2: player.wornRing2,
  };
}

/**
 * Equip an item from the player's inventory.
 * @param playerId - The player equipping the item
 * @param itemName - The name of the item to equip
 * @param targetSlot - Optional specific slot to equip to
 * @returns ItemResult with success status and message
 */
export async function equipItem(
  playerId: string,
  itemName: string,
  targetSlot?: string,
): Promise<ItemResult> {
  // Find the item in player's inventory
  const found = await findItemInPlayerInventory(playerId, itemName);
  if (!found) {
    return { success: false, message: `You don't have any "${itemName}".` };
  }

  const { item } = found;

  // Check if item is equippable
  if (!item.equipSlots || item.equipSlots.length === 0) {
    return { success: false, message: `You can't equip the ${item.name}.` };
  }

  // Get current equipment
  const equipment = await getPlayerEquipment(playerId);
  if (!equipment) {
    return { success: false, message: "Player not found." };
  }

  // Determine which slot to use
  let slotToUse: keyof PlayerEquipment;

  if (targetSlot) {
    // User specified a slot
    const parsedSlot = parseSlot(targetSlot);
    if (!parsedSlot) {
      return {
        success: false,
        message: `Unknown equipment slot: ${targetSlot}`,
      };
    }

    // Check if item can go in that slot
    const slotAsEquipSlot = parsedSlot as EquipmentSlot;
    if (!item.equipSlots.includes(slotAsEquipSlot)) {
      return {
        success: false,
        message: `You can't equip the ${item.name} on your ${parsedSlot}. Valid slots: ${item.equipSlots.join(", ")}`,
      };
    }

    slotToUse = parsedSlot;
  } else {
    // Auto-select slot: prefer empty slot, otherwise use first valid slot
    const emptySlot = item.equipSlots.find((s) => {
      const field = EQUIPMENT_SLOT_TO_FIELD[s];
      return equipment[field] === null;
    });

    if (emptySlot) {
      slotToUse = EQUIPMENT_SLOT_TO_FIELD[emptySlot];
    } else {
      // All valid slots occupied, use the first one (will swap)
      slotToUse = EQUIPMENT_SLOT_TO_FIELD[item.equipSlots[0]];
    }
  }

  // Check if something is already equipped in that slot
  const currentItemId = equipment[slotToUse];
  let swapMessage = "";

  if (currentItemId) {
    // Get the currently equipped item's name
    const currentItem = db
      .select()
      .from(items)
      .where(eq(items.id, currentItemId))
      .get();

    if (currentItem) {
      swapMessage = ` (removing ${currentItem.name})`;
    }
  }

  // Update the player's equipment
  const dbColumn = SLOT_TO_DB_COLUMN[slotToUse];
  await db
    .update(players)
    .set({ [dbColumn]: item.id })
    .where(eq(players.id, playerId));

  return {
    success: true,
    item,
    message: `You equip the ${item.name} on your ${slotToUse}${swapMessage}.`,
  };
}

/**
 * Unequip an item and return it to inventory (it stays in inventory either way).
 * @param playerId - The player unequipping the item
 * @param itemNameOrSlot - The name of the item or slot to unequip
 * @returns ItemResult with success status and message
 */
export async function unequipItem(
  playerId: string,
  itemNameOrSlot: string,
): Promise<ItemResult> {
  // Get current equipment
  const equipment = await getPlayerEquipment(playerId);
  if (!equipment) {
    return { success: false, message: "Player not found." };
  }

  // First, try to interpret as a slot name
  const parsedSlot = parseSlot(itemNameOrSlot);
  if (parsedSlot) {
    const itemId = equipment[parsedSlot];
    if (!itemId) {
      return {
        success: false,
        message: `You don't have anything equipped on your ${parsedSlot}.`,
      };
    }

    // Get the item name for the message
    const item = db.select().from(items).where(eq(items.id, itemId)).get();
    const itemName = item?.name || "item";

    // Clear the slot
    const dbColumn = SLOT_TO_DB_COLUMN[parsedSlot];
    await db
      .update(players)
      .set({ [dbColumn]: null })
      .where(eq(players.id, playerId));

    return {
      success: true,
      item: item ? toItem(item) : undefined,
      message: `You unequip the ${itemName} from your ${parsedSlot}.`,
    };
  }

  // Try to find by item name using fuzzy matching
  for (const [slot, itemId] of Object.entries(equipment)) {
    if (!itemId) continue;

    const item = db.select().from(items).where(eq(items.id, itemId)).get();
    if (!item) continue;

    const matchResult = fuzzyMatch(itemNameOrSlot, item.name, item.pluralName);
    if (matchResult.matches) {
      // Found the item, unequip it
      const dbColumn = SLOT_TO_DB_COLUMN[slot as keyof PlayerEquipment];
      await db
        .update(players)
        .set({ [dbColumn]: null })
        .where(eq(players.id, playerId));

      return {
        success: true,
        item: toItem(item),
        message: `You unequip the ${item.name} from your ${slot}.`,
      };
    }
  }

  return {
    success: false,
    message: `You don't have "${itemNameOrSlot}" equipped.`,
  };
}

/**
 * Get a formatted list of equipped items for display.
 * @param playerId - The player whose equipment to list
 * @returns Object with success status and formatted equipment list
 */
export async function getEquipmentList(
  playerId: string,
): Promise<{ success: boolean; message: string }> {
  const equipment = await getPlayerEquipment(playerId);
  if (!equipment) {
    return { success: false, message: "Player not found." };
  }

  const lines: string[] = ["You have equipped:"];
  let hasEquipment = false;

  const slotDisplayNames: Record<keyof PlayerEquipment, string> = {
    head: "Head",
    torso: "Torso",
    body: "Body",
    legs: "Legs",
    hands: "Hands",
    feet: "Feet",
    mainHand: "Main Hand",
    offHand: "Off Hand",
    neck: "Neck",
    ring1: "Ring 1",
    ring2: "Ring 2",
  };

  for (const [slot, itemId] of Object.entries(equipment)) {
    if (!itemId) continue;

    const item = db.select().from(items).where(eq(items.id, itemId)).get();
    if (item) {
      hasEquipment = true;
      const displaySlot = slotDisplayNames[slot as keyof PlayerEquipment];
      lines.push(`  ${displaySlot}: ${item.name}`);
    }
  }

  if (!hasEquipment) {
    return { success: true, message: "You don't have anything equipped." };
  }

  return { success: true, message: lines.join("\n") };
}

/**
 * Get all equipped items with their full data.
 * @param playerId - The player's ID
 * @returns Array of equipped items with their data
 */
export async function getEquippedItems(playerId: string): Promise<
  Array<{
    slot: keyof PlayerEquipment;
    id: string;
    name: string;
    weaponDamage: string | null;
    conEffect: number | null;
  }>
> {
  const equipment = await getPlayerEquipment(playerId);
  if (!equipment) return [];

  const result: Array<{
    slot: keyof PlayerEquipment;
    id: string;
    name: string;
    weaponDamage: string | null;
    conEffect: number | null;
  }> = [];

  for (const [slot, itemId] of Object.entries(equipment)) {
    if (!itemId) continue;

    const item = db.select().from(items).where(eq(items.id, itemId)).get();
    if (item) {
      result.push({
        slot: slot as keyof PlayerEquipment,
        id: item.id,
        name: item.name,
        weaponDamage: item.weaponDamage,
        conEffect: item.conEffect,
      });
    }
  }

  return result;
}
