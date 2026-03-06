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
import { canDualWield } from "../FeatEffectHandler.js";
import { toItem } from "../ItemService.utils.js";
import { calculateEquipmentConBonus, calculateMaxHp } from "../StatService.js";
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
  back: "wornBack",
};

/** Human-readable display names for equipment slots */
const SLOT_DISPLAY_NAMES: Record<keyof PlayerEquipment, string> = {
  head: "head",
  torso: "torso",
  body: "body",
  legs: "legs",
  hands: "hands",
  feet: "feet",
  mainHand: "main hand",
  offHand: "off hand",
  neck: "neck",
  ring1: "ring",
  ring2: "ring",
  back: "back",
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
  back: "back",
  backpack: "back",
  cloak: "back",
  cape: "back",
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
    back: player.wornBack,
  };
}

/**
 * Recalculate and update player's max HP based on CON change from equipment.
 * Preserves damage taken (difference between max and current HP).
 * @param playerId - The player whose HP to recalculate
 * @param oldConBonus - CON bonus before equipment change
 * @param newConBonus - CON bonus after equipment change
 * @returns HP change message if HP changed, empty string otherwise
 */
async function recalculateHpForConChange(
  playerId: string,
  oldConBonus: number,
  newConBonus: number,
): Promise<string> {
  if (oldConBonus === newConBonus) return "";

  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) return "";

  const oldTotalCon = player.con + oldConBonus;
  const newTotalCon = player.con + newConBonus;

  const oldMaxHp = await calculateMaxHp(player.level, oldTotalCon, playerId);
  const newMaxHp = await calculateMaxHp(player.level, newTotalCon, playerId);

  if (oldMaxHp === newMaxHp) return "";

  // Preserve damage taken
  const damageTaken = player.maxHp - player.currentHp;
  const newCurrentHp = Math.max(1, newMaxHp - damageTaken);

  await db
    .update(players)
    .set({ maxHp: newMaxHp, currentHp: newCurrentHp })
    .where(eq(players.id, playerId));

  const hpDiff = newMaxHp - oldMaxHp;
  const sign = hpDiff > 0 ? "+" : "";
  return ` (${sign}${hpDiff} max HP)`;
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

  // Check for dual wield restriction: equipping weapon to offHand requires Two-Weapon Fighting
  if (slotToUse === "offHand" && item.weaponDamage) {
    // Check if mainHand has a weapon
    const mainHandItemId = equipment.mainHand;
    if (mainHandItemId) {
      const mainHandItem = db
        .select()
        .from(items)
        .where(eq(items.id, mainHandItemId))
        .get();

      if (mainHandItem?.weaponDamage) {
        // Both hands would have weapons - check for Two-Weapon Fighting feat
        const canDual = await canDualWield(playerId);
        if (!canDual) {
          return {
            success: false,
            message:
              "You need the Two-Weapon Fighting feat to dual wield weapons.",
          };
        }
      }
    }
  }

  // Check if something is already equipped in that slot
  const currentItemId = equipment[slotToUse];
  let swapMessage = "";
  let oldItemConEffect = 0;

  if (currentItemId) {
    // Get the currently equipped item's name and CON effect
    const currentItem = db
      .select()
      .from(items)
      .where(eq(items.id, currentItemId))
      .get();

    if (currentItem) {
      swapMessage = ` (removing ${currentItem.name})`;
      oldItemConEffect = currentItem.conEffect ?? 0;
    }
  }

  // Calculate CON change for HP recalculation
  const newItemConEffect = item.effects.con ?? 0;
  const equipped = await getEquippedItems(playerId);
  const oldConBonus = calculateEquipmentConBonus(equipped);
  const newConBonus = oldConBonus - oldItemConEffect + newItemConEffect;

  // Update the player's equipment
  const dbColumn = SLOT_TO_DB_COLUMN[slotToUse];
  await db
    .update(players)
    .set({ [dbColumn]: item.id })
    .where(eq(players.id, playerId));

  // Recalculate HP if CON changed
  const hpMessage = await recalculateHpForConChange(
    playerId,
    oldConBonus,
    newConBonus,
  );

  return {
    success: true,
    item,
    message: `You equip the ${item.name} on your ${SLOT_DISPLAY_NAMES[slotToUse]}${swapMessage}.${hpMessage}`,
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

    // Get the item for the message and CON effect
    const item = db.select().from(items).where(eq(items.id, itemId)).get();
    const itemName = item?.name || "item";
    const itemConEffect = item?.conEffect ?? 0;

    // Calculate CON change for HP recalculation
    const equipped = await getEquippedItems(playerId);
    const oldConBonus = calculateEquipmentConBonus(equipped);
    const newConBonus = oldConBonus - itemConEffect;

    // Clear the slot
    const dbColumn = SLOT_TO_DB_COLUMN[parsedSlot];
    await db
      .update(players)
      .set({ [dbColumn]: null })
      .where(eq(players.id, playerId));

    // Recalculate HP if CON changed
    const hpMessage = await recalculateHpForConChange(
      playerId,
      oldConBonus,
      newConBonus,
    );

    return {
      success: true,
      item: item ? toItem(item) : undefined,
      message: `You unequip the ${itemName} from your ${SLOT_DISPLAY_NAMES[parsedSlot as keyof PlayerEquipment]}.${hpMessage}`,
    };
  }

  // Try to find by item name using fuzzy matching
  for (const [slot, itemId] of Object.entries(equipment)) {
    if (!itemId) continue;

    const item = db.select().from(items).where(eq(items.id, itemId)).get();
    if (!item) continue;

    const matchResult = fuzzyMatch(itemNameOrSlot, item.name, item.pluralName);
    if (matchResult.matches) {
      // Calculate CON change for HP recalculation
      const itemConEffect = item.conEffect ?? 0;
      const equipped = await getEquippedItems(playerId);
      const oldConBonus = calculateEquipmentConBonus(equipped);
      const newConBonus = oldConBonus - itemConEffect;

      // Found the item, unequip it
      const dbColumn = SLOT_TO_DB_COLUMN[slot as keyof PlayerEquipment];
      await db
        .update(players)
        .set({ [dbColumn]: null })
        .where(eq(players.id, playerId));

      // Recalculate HP if CON changed
      const hpMessage = await recalculateHpForConChange(
        playerId,
        oldConBonus,
        newConBonus,
      );

      return {
        success: true,
        item: toItem(item),
        message: `You unequip the ${item.name} from your ${SLOT_DISPLAY_NAMES[slot as keyof PlayerEquipment]}.${hpMessage}`,
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
    back: "Back",
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
/** Equipped item with all stat effects */
export type EquippedItemData = {
  slot: keyof PlayerEquipment;
  id: string;
  name: string;
  weaponDamage: string | null;
  weaponRange: string | null;
  strEffect: number | null;
  dexEffect: number | null;
  conEffect: number | null;
  intEffect: number | null;
  wisEffect: number | null;
  chaEffect: number | null;
  hpEffect: number | null;
};

/**
 * Get all equipped items with their full data including stat effects.
 * @param playerId - The player's ID
 * @returns Array of equipped items with slot, name, and all stat effects
 */
export async function getEquippedItems(
  playerId: string,
): Promise<EquippedItemData[]> {
  const equipment = await getPlayerEquipment(playerId);
  if (!equipment) return [];

  const result: EquippedItemData[] = [];

  for (const [slot, itemId] of Object.entries(equipment)) {
    if (!itemId) continue;

    const item = db.select().from(items).where(eq(items.id, itemId)).get();
    if (item) {
      result.push({
        slot: slot as keyof PlayerEquipment,
        id: item.id,
        name: item.name,
        weaponDamage: item.weaponDamage,
        weaponRange: item.weaponRange,
        strEffect: item.strEffect,
        dexEffect: item.dexEffect,
        conEffect: item.conEffect,
        intEffect: item.intEffect,
        wisEffect: item.wisEffect,
        chaEffect: item.chaEffect,
        hpEffect: item.hpEffect,
      });
    }
  }

  return result;
}

/** Individual stat bonus from an equipped item */
export type StatBonus = {
  stat: "str" | "dex" | "con" | "int" | "wis" | "cha" | "hp";
  amount: number;
  itemName: string;
};

/** Aggregated equipment stat bonuses */
export type EquipmentBonuses = {
  totals: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
    hp: number;
  };
  bonuses: StatBonus[];
};

/**
 * Get aggregated stat bonuses from all equipped items.
 * @param playerId - The player's ID
 * @returns Totals per stat and list of individual bonuses with item names
 */
export async function getEquipmentStatBonuses(
  playerId: string,
): Promise<EquipmentBonuses> {
  const equippedItems = await getEquippedItems(playerId);

  const totals = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, hp: 0 };
  const bonuses: StatBonus[] = [];

  for (const item of equippedItems) {
    const effects: Array<{
      stat: StatBonus["stat"];
      value: number | null;
    }> = [
      { stat: "str", value: item.strEffect },
      { stat: "dex", value: item.dexEffect },
      { stat: "con", value: item.conEffect },
      { stat: "int", value: item.intEffect },
      { stat: "wis", value: item.wisEffect },
      { stat: "cha", value: item.chaEffect },
      { stat: "hp", value: item.hpEffect },
    ];

    for (const { stat, value } of effects) {
      if (value && value !== 0) {
        totals[stat] += value;
        bonuses.push({ stat, amount: value, itemName: item.name });
      }
    }
  }

  return { totals, bonuses };
}
