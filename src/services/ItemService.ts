import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import {
  containerInventory,
  containers,
  items,
  playerInventory,
  players,
  roomInventory,
} from "../db/schema.js";
import type { EquipmentSlot, Item, ItemStack } from "../types/item.js";
import {
  EQUIPMENT_SLOT_TO_FIELD,
  type PlayerEquipment,
} from "../types/player.js";
import {
  generateStatsDescription,
  getItemDisplayName,
  matchesPlural,
  resolveQuantity,
  toItem,
  type ItemFindResult,
} from "./ItemService.utils.js";

export type ItemResult = {
  success: boolean;
  item?: Item;
  quantity?: number;
  message: string;
};

export type ExamineContext = {
  playerId: string;
  roomId: string;
};

/**
 * Find an item in room inventory by name (exact, prefix, or word match)
 */
async function findItemInRoom(
  roomId: string,
  itemName: string,
): Promise<ItemFindResult | null> {
  const roomItems = await db
    .select()
    .from(roomInventory)
    .innerJoin(items, eq(roomInventory.itemId, items.id))
    .where(eq(roomInventory.roomId, roomId));

  const nameLower = itemName.toLowerCase();

  // Try exact match first
  const exactMatch = roomItems.find(
    (r) =>
      r.items.name.toLowerCase() === nameLower ||
      r.items.pluralName?.toLowerCase() === nameLower,
  );
  if (exactMatch) {
    return {
      item: toItem(exactMatch.items),
      inventoryId: exactMatch.room_inventory.id,
      quantity: exactMatch.room_inventory.quantity,
      matchedPlural: matchesPlural(
        nameLower,
        exactMatch.items.name,
        exactMatch.items.pluralName,
      ),
    };
  }

  // Try prefix match
  const prefixMatch = roomItems.find(
    (r) =>
      r.items.name.toLowerCase().startsWith(nameLower) ||
      r.items.pluralName?.toLowerCase().startsWith(nameLower),
  );
  if (prefixMatch) {
    return {
      item: toItem(prefixMatch.items),
      inventoryId: prefixMatch.room_inventory.id,
      quantity: prefixMatch.room_inventory.quantity,
      matchedPlural: matchesPlural(
        nameLower,
        prefixMatch.items.name,
        prefixMatch.items.pluralName,
      ),
    };
  }

  // Try word match (any word in the item name starts with the search term)
  const wordMatch = roomItems.find((r) => {
    const words = r.items.name.toLowerCase().split(/\s+/);
    const pluralWords = r.items.pluralName?.toLowerCase().split(/\s+/) || [];
    return (
      words.some((w) => w.startsWith(nameLower)) ||
      pluralWords.some((w) => w.startsWith(nameLower))
    );
  });
  if (wordMatch) {
    return {
      item: toItem(wordMatch.items),
      inventoryId: wordMatch.room_inventory.id,
      quantity: wordMatch.room_inventory.quantity,
      matchedPlural: matchesPlural(
        nameLower,
        wordMatch.items.name,
        wordMatch.items.pluralName,
      ),
    };
  }

  return null;
}

/**
 * Find an item in player inventory by name (exact, prefix, or word match)
 */
async function findItemInPlayerInventory(
  playerId: string,
  itemName: string,
): Promise<ItemFindResult | null> {
  const playerItems = await db
    .select()
    .from(playerInventory)
    .innerJoin(items, eq(playerInventory.itemId, items.id))
    .where(eq(playerInventory.playerId, playerId));

  const nameLower = itemName.toLowerCase();

  // Try exact match first
  const exactMatch = playerItems.find(
    (r) =>
      r.items.name.toLowerCase() === nameLower ||
      r.items.pluralName?.toLowerCase() === nameLower,
  );
  if (exactMatch) {
    return {
      item: toItem(exactMatch.items),
      inventoryId: exactMatch.player_inventory.id,
      quantity: exactMatch.player_inventory.quantity,
      matchedPlural: matchesPlural(
        nameLower,
        exactMatch.items.name,
        exactMatch.items.pluralName,
      ),
    };
  }

  // Try prefix match
  const prefixMatch = playerItems.find(
    (r) =>
      r.items.name.toLowerCase().startsWith(nameLower) ||
      r.items.pluralName?.toLowerCase().startsWith(nameLower),
  );
  if (prefixMatch) {
    return {
      item: toItem(prefixMatch.items),
      inventoryId: prefixMatch.player_inventory.id,
      quantity: prefixMatch.player_inventory.quantity,
      matchedPlural: matchesPlural(
        nameLower,
        prefixMatch.items.name,
        prefixMatch.items.pluralName,
      ),
    };
  }

  // Try word match (any word in the item name starts with the search term)
  const wordMatch = playerItems.find((r) => {
    const words = r.items.name.toLowerCase().split(/\s+/);
    const pluralWords = r.items.pluralName?.toLowerCase().split(/\s+/) || [];
    return (
      words.some((w) => w.startsWith(nameLower)) ||
      pluralWords.some((w) => w.startsWith(nameLower))
    );
  });
  if (wordMatch) {
    return {
      item: toItem(wordMatch.items),
      inventoryId: wordMatch.player_inventory.id,
      quantity: wordMatch.player_inventory.quantity,
      matchedPlural: matchesPlural(
        nameLower,
        wordMatch.items.name,
        wordMatch.items.pluralName,
      ),
    };
  }

  return null;
}

/**
 * Pick up an item from the room and add it to player's inventory
 * @param playerId - The player picking up the item
 * @param roomId - The room to pick up from
 * @param itemName - The name of the item to pick up
 * @param requestedQuantity - How many to pick up (undefined = default based on bulk)
 * @returns ItemResult with success status and message
 */
export async function getItem(
  playerId: string,
  roomId: string,
  itemName: string,
  requestedQuantity?: number | "all",
): Promise<ItemResult> {
  // Find the item in the room
  const found = await findItemInRoom(roomId, itemName);
  if (!found) {
    return { success: false, message: `You don't see any "${itemName}" here.` };
  }

  const {
    item,
    inventoryId,
    quantity: availableQuantity,
    matchedPlural,
  } = found;

  // Validate requested quantity if explicit
  if (
    typeof requestedQuantity === "number" &&
    requestedQuantity > availableQuantity
  ) {
    const displayName = getItemDisplayName(item, availableQuantity);
    return {
      success: false,
      message: `There are only ${availableQuantity} ${displayName} here.`,
    };
  }

  const quantityToTake = resolveQuantity(
    requestedQuantity,
    availableQuantity,
    matchedPlural,
  );

  // Check if player already has this item
  const existingInventory = await db
    .select()
    .from(playerInventory)
    .where(
      and(
        eq(playerInventory.playerId, playerId),
        eq(playerInventory.itemId, item.id),
      ),
    )
    .get();

  // Update or create player inventory entry
  if (existingInventory) {
    await db
      .update(playerInventory)
      .set({ quantity: existingInventory.quantity + quantityToTake })
      .where(eq(playerInventory.id, existingInventory.id));
  } else {
    await db.insert(playerInventory).values({
      id: uuidv4(),
      playerId,
      itemId: item.id,
      quantity: quantityToTake,
    });
  }

  // Update or remove room inventory entry
  const remainingQuantity = availableQuantity - quantityToTake;
  if (remainingQuantity <= 0) {
    await db.delete(roomInventory).where(eq(roomInventory.id, inventoryId));
  } else {
    await db
      .update(roomInventory)
      .set({ quantity: remainingQuantity })
      .where(eq(roomInventory.id, inventoryId));
  }

  const displayName = getItemDisplayName(item, quantityToTake);
  const message =
    quantityToTake === 1
      ? `You pick up the ${displayName}.`
      : `You pick up ${quantityToTake} ${displayName}.`;

  return { success: true, item, quantity: quantityToTake, message };
}

/**
 * Drop an item from player's inventory into the room
 * @param playerId - The player dropping the item
 * @param roomId - The room to drop into
 * @param itemName - The name of the item to drop
 * @param requestedQuantity - How many to drop (undefined = default based on bulk)
 * @returns ItemResult with success status and message
 */
export async function dropItem(
  playerId: string,
  roomId: string,
  itemName: string,
  requestedQuantity?: number | "all",
): Promise<ItemResult> {
  // Find the item in player's inventory
  const found = await findItemInPlayerInventory(playerId, itemName);
  if (!found) {
    return { success: false, message: `You don't have any "${itemName}".` };
  }

  const {
    item,
    inventoryId,
    quantity: availableQuantity,
    matchedPlural,
  } = found;

  // Validate requested quantity if explicit
  if (
    typeof requestedQuantity === "number" &&
    requestedQuantity > availableQuantity
  ) {
    const displayName = getItemDisplayName(item, availableQuantity);
    return {
      success: false,
      message: `You only have ${availableQuantity} ${displayName}.`,
    };
  }

  const quantityToDrop = resolveQuantity(
    requestedQuantity,
    availableQuantity,
    matchedPlural,
  );

  // Check if room already has this item
  const existingRoomInventory = await db
    .select()
    .from(roomInventory)
    .where(
      and(eq(roomInventory.roomId, roomId), eq(roomInventory.itemId, item.id)),
    )
    .get();

  // Update or create room inventory entry
  if (existingRoomInventory) {
    await db
      .update(roomInventory)
      .set({ quantity: existingRoomInventory.quantity + quantityToDrop })
      .where(eq(roomInventory.id, existingRoomInventory.id));
  } else {
    await db.insert(roomInventory).values({
      id: uuidv4(),
      roomId,
      itemId: item.id,
      quantity: quantityToDrop,
    });
  }

  // Update or remove player inventory entry
  const remainingQuantity = availableQuantity - quantityToDrop;
  if (remainingQuantity <= 0) {
    await db.delete(playerInventory).where(eq(playerInventory.id, inventoryId));
  } else {
    await db
      .update(playerInventory)
      .set({ quantity: remainingQuantity })
      .where(eq(playerInventory.id, inventoryId));
  }

  const displayName = getItemDisplayName(item, quantityToDrop);
  const message =
    quantityToDrop === 1
      ? `You drop the ${displayName}.`
      : `You drop ${quantityToDrop} ${displayName}.`;

  return { success: true, item, quantity: quantityToDrop, message };
}

/**
 * Find an item in an open container by name (exact, prefix, or word match)
 */
async function findItemInContainer(
  containerId: string,
  itemName: string,
): Promise<ItemFindResult | null> {
  const containerItems = await db
    .select()
    .from(containerInventory)
    .innerJoin(items, eq(containerInventory.itemId, items.id))
    .where(eq(containerInventory.containerId, containerId));

  const nameLower = itemName.toLowerCase();

  // Try exact match first
  const exactMatch = containerItems.find(
    (r) =>
      r.items.name.toLowerCase() === nameLower ||
      r.items.pluralName?.toLowerCase() === nameLower,
  );
  if (exactMatch) {
    return {
      item: toItem(exactMatch.items),
      inventoryId: exactMatch.container_inventory.id,
      quantity: exactMatch.container_inventory.quantity,
      matchedPlural: matchesPlural(
        nameLower,
        exactMatch.items.name,
        exactMatch.items.pluralName,
      ),
    };
  }

  // Try prefix match
  const prefixMatch = containerItems.find(
    (r) =>
      r.items.name.toLowerCase().startsWith(nameLower) ||
      r.items.pluralName?.toLowerCase().startsWith(nameLower),
  );
  if (prefixMatch) {
    return {
      item: toItem(prefixMatch.items),
      inventoryId: prefixMatch.container_inventory.id,
      quantity: prefixMatch.container_inventory.quantity,
      matchedPlural: matchesPlural(
        nameLower,
        prefixMatch.items.name,
        prefixMatch.items.pluralName,
      ),
    };
  }

  // Try word match (any word in the item name starts with the search term)
  const wordMatch = containerItems.find((r) => {
    const words = r.items.name.toLowerCase().split(/\s+/);
    const pluralWords = r.items.pluralName?.toLowerCase().split(/\s+/) || [];
    return (
      words.some((w) => w.startsWith(nameLower)) ||
      pluralWords.some((w) => w.startsWith(nameLower))
    );
  });
  if (wordMatch) {
    return {
      item: toItem(wordMatch.items),
      inventoryId: wordMatch.container_inventory.id,
      quantity: wordMatch.container_inventory.quantity,
      matchedPlural: matchesPlural(
        nameLower,
        wordMatch.items.name,
        wordMatch.items.pluralName,
      ),
    };
  }

  return null;
}

/**
 * Get open containers in a room (in order)
 */
async function getOpenContainersInRoom(roomId: string) {
  return db
    .select()
    .from(containers)
    .where(
      and(
        eq(containers.roomId, roomId),
        eq(containers.isOpen, true),
        eq(containers.isHidden, false),
      ),
    );
}

/**
 * Examine an item and return its description
 * @param playerId - The player examining the item
 * @param roomId - The room the player is in
 * @param itemName - The name of the item to examine
 * @param searchOwn - If true, search own inventory first (for "examine my X")
 * @returns Description string or error message
 */
export async function examineItem(
  playerId: string,
  roomId: string,
  itemName: string,
  searchOwn: boolean = false,
): Promise<{ success: boolean; description: string }> {
  let item: Item | null = null;
  let isOwnItem = false;

  if (searchOwn) {
    // Search own inventory first
    const ownItem = await findItemInPlayerInventory(playerId, itemName);
    if (ownItem) {
      item = ownItem.item;
      isOwnItem = true;
    }
  }

  if (!item) {
    // Search room inventory
    const roomItem = await findItemInRoom(roomId, itemName);
    if (roomItem) {
      item = roomItem.item;
    }
  }

  if (!item && !searchOwn) {
    // Search own inventory (if not already searched)
    const ownItem = await findItemInPlayerInventory(playerId, itemName);
    if (ownItem) {
      item = ownItem.item;
      isOwnItem = true;
    }
  }

  if (!item) {
    // Search open containers
    const openContainers = await getOpenContainersInRoom(roomId);
    for (const container of openContainers) {
      const containerItem = await findItemInContainer(container.id, itemName);
      if (containerItem) {
        item = containerItem.item;
        break;
      }
    }
  }

  // TODO: Search worn items on other players, NPCs, monsters

  if (!item) {
    return {
      success: false,
      description: `You don't see any "${itemName}" here.`,
    };
  }

  // Build description
  let description = item.description;

  // Add private stats info if it's the player's own item
  if (isOwnItem) {
    const statsDesc = generateStatsDescription(item);
    if (statsDesc) {
      description += `\n${statsDesc}`;
    }
  }

  return { success: true, description };
}

/**
 * Get a player's inventory (excluding equipped items)
 * @param playerId - The player whose inventory to retrieve
 * @returns Array of ItemStacks
 */
export async function getInventory(playerId: string): Promise<ItemStack[]> {
  // Get equipped item IDs to exclude
  const equipment = await getPlayerEquipment(playerId);
  const equippedItemIds = new Set<string>();
  if (equipment) {
    for (const itemId of Object.values(equipment)) {
      if (itemId) equippedItemIds.add(itemId);
    }
  }

  const inventoryRows = await db
    .select()
    .from(playerInventory)
    .innerJoin(items, eq(playerInventory.itemId, items.id))
    .where(eq(playerInventory.playerId, playerId));

  // Filter out equipped items
  return inventoryRows
    .filter((row) => !equippedItemIds.has(row.items.id))
    .map((row) => ({
      item: toItem(row.items),
      quantity: row.player_inventory.quantity,
    }));
}

/**
 * Get an item from a container and add it to player's inventory
 * @param playerId - The player getting the item
 * @param roomId - The room the player is in
 * @param itemName - The name of the item to get
 * @param containerName - The name of the container to get from
 * @param requestedQuantity - How many to get
 * @returns ItemResult with success status and message
 */
export async function getItemFromContainer(
  playerId: string,
  roomId: string,
  itemName: string,
  containerName: string,
  requestedQuantity?: number | "all",
): Promise<ItemResult> {
  // Find the container
  const containerList = await db
    .select()
    .from(containers)
    .where(and(eq(containers.roomId, roomId), eq(containers.isHidden, false)));

  const containerNameLower = containerName.toLowerCase();
  const container = containerList.find(
    (c) =>
      c.name.toLowerCase() === containerNameLower ||
      c.name.toLowerCase().startsWith(containerNameLower),
  );

  if (!container) {
    return {
      success: false,
      message: `You don't see any "${containerName}" here.`,
    };
  }

  if (!container.isOpen) {
    return { success: false, message: `The ${container.name} is closed.` };
  }

  // Find the item in the container
  const found = await findItemInContainer(container.id, itemName);
  if (!found) {
    return {
      success: false,
      message: `There's no "${itemName}" in the ${container.name}.`,
    };
  }

  const {
    item,
    inventoryId,
    quantity: availableQuantity,
    matchedPlural,
  } = found;

  // Validate requested quantity if explicit
  if (
    typeof requestedQuantity === "number" &&
    requestedQuantity > availableQuantity
  ) {
    const displayName = getItemDisplayName(item, availableQuantity);
    return {
      success: false,
      message: `There are only ${availableQuantity} ${displayName} in the ${container.name}.`,
    };
  }

  const quantityToTake = resolveQuantity(
    requestedQuantity,
    availableQuantity,
    matchedPlural,
  );

  // Check if player already has this item
  const existingInventory = await db
    .select()
    .from(playerInventory)
    .where(
      and(
        eq(playerInventory.playerId, playerId),
        eq(playerInventory.itemId, item.id),
      ),
    )
    .get();

  // Update or create player inventory entry
  if (existingInventory) {
    await db
      .update(playerInventory)
      .set({ quantity: existingInventory.quantity + quantityToTake })
      .where(eq(playerInventory.id, existingInventory.id));
  } else {
    await db.insert(playerInventory).values({
      id: uuidv4(),
      playerId,
      itemId: item.id,
      quantity: quantityToTake,
    });
  }

  // Update or remove container inventory entry
  const remainingQuantity = availableQuantity - quantityToTake;
  if (remainingQuantity <= 0) {
    await db
      .delete(containerInventory)
      .where(eq(containerInventory.id, inventoryId));
  } else {
    await db
      .update(containerInventory)
      .set({ quantity: remainingQuantity })
      .where(eq(containerInventory.id, inventoryId));
  }

  const displayName = getItemDisplayName(item, quantityToTake);
  const message =
    quantityToTake === 1
      ? `You take the ${displayName} from the ${container.name}.`
      : `You take ${quantityToTake} ${displayName} from the ${container.name}.`;

  return { success: true, item, quantity: quantityToTake, message };
}

/**
 * Give an item to another player in the same room
 * @param fromPlayerId - The player giving the item
 * @param roomId - The room both players are in
 * @param toPlayerName - The name of the player to give to
 * @param itemName - The name of the item to give
 * @param requestedQuantity - How many to give
 * @returns ItemResult with success status and message
 */
export async function giveItem(
  fromPlayerId: string,
  roomId: string,
  toPlayerName: string,
  itemName: string,
  requestedQuantity?: number | "all",
): Promise<ItemResult> {
  // Find the target player in the room
  const { players } = await import("../db/schema.js");
  const roomPlayers = await db
    .select()
    .from(players)
    .where(eq(players.currentRoomId, roomId));

  const targetNameLower = toPlayerName.toLowerCase();
  const targetPlayer = roomPlayers.find(
    (p) =>
      p.name.toLowerCase() === targetNameLower ||
      p.name.toLowerCase().startsWith(targetNameLower),
  );

  if (!targetPlayer) {
    return {
      success: false,
      message: `There's no one named "${toPlayerName}" here.`,
    };
  }

  if (targetPlayer.id === fromPlayerId) {
    return { success: false, message: "You can't give items to yourself." };
  }

  // Find the item in giver's inventory
  const found = await findItemInPlayerInventory(fromPlayerId, itemName);
  if (!found) {
    return { success: false, message: `You don't have any "${itemName}".` };
  }

  const {
    item,
    inventoryId,
    quantity: availableQuantity,
    matchedPlural,
  } = found;

  // Validate requested quantity if explicit
  if (
    typeof requestedQuantity === "number" &&
    requestedQuantity > availableQuantity
  ) {
    const displayName = getItemDisplayName(item, availableQuantity);
    return {
      success: false,
      message: `You only have ${availableQuantity} ${displayName}.`,
    };
  }

  const quantityToGive = resolveQuantity(
    requestedQuantity,
    availableQuantity,
    matchedPlural,
  );

  // Check if target already has this item
  const existingTargetInventory = await db
    .select()
    .from(playerInventory)
    .where(
      and(
        eq(playerInventory.playerId, targetPlayer.id),
        eq(playerInventory.itemId, item.id),
      ),
    )
    .get();

  // Update or create target's inventory entry
  if (existingTargetInventory) {
    await db
      .update(playerInventory)
      .set({ quantity: existingTargetInventory.quantity + quantityToGive })
      .where(eq(playerInventory.id, existingTargetInventory.id));
  } else {
    await db.insert(playerInventory).values({
      id: uuidv4(),
      playerId: targetPlayer.id,
      itemId: item.id,
      quantity: quantityToGive,
    });
  }

  // Update or remove giver's inventory entry
  const remainingQuantity = availableQuantity - quantityToGive;
  if (remainingQuantity <= 0) {
    await db.delete(playerInventory).where(eq(playerInventory.id, inventoryId));
  } else {
    await db
      .update(playerInventory)
      .set({ quantity: remainingQuantity })
      .where(eq(playerInventory.id, inventoryId));
  }

  const displayName = getItemDisplayName(item, quantityToGive);
  const message =
    quantityToGive === 1
      ? `You give the ${displayName} to ${targetPlayer.name}.`
      : `You give ${quantityToGive} ${displayName} to ${targetPlayer.name}.`;

  return { success: true, item, quantity: quantityToGive, message };
}

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
async function getPlayerEquipment(
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

  // Try to find by item name
  const nameLower = itemNameOrSlot.toLowerCase();

  // Check each equipped slot for a matching item
  for (const [slot, itemId] of Object.entries(equipment)) {
    if (!itemId) continue;

    const item = db.select().from(items).where(eq(items.id, itemId)).get();
    if (!item) continue;

    if (
      item.name.toLowerCase() === nameLower ||
      item.name.toLowerCase().startsWith(nameLower) ||
      item.pluralName?.toLowerCase() === nameLower ||
      item.pluralName?.toLowerCase().startsWith(nameLower)
    ) {
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
