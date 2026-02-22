import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import {
  containerInventory,
  containers,
  items,
  playerInventory,
  roomInventory,
} from "../db/schema.js";
import type { Item, ItemStack } from "../types/item.js";

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
 * Convert a database item row to an Item type
 */
function toItem(row: typeof items.$inferSelect): Item {
  return {
    id: row.id,
    name: row.name,
    pluralName: row.pluralName ?? undefined,
    description: row.description,
    category: row.category ?? undefined,
    isBulk: row.isBulk ?? false,
    equipSlot: row.equipSlot ?? undefined,
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
 * Find an item in room inventory by name (exact or prefix match)
 */
async function findItemInRoom(
  roomId: string,
  itemName: string,
): Promise<{ item: Item; inventoryId: string; quantity: number } | null> {
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
    };
  }

  return null;
}

/**
 * Find an item in player inventory by name (exact or prefix match)
 */
async function findItemInPlayerInventory(
  playerId: string,
  itemName: string,
): Promise<{ item: Item; inventoryId: string; quantity: number } | null> {
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
    };
  }

  return null;
}

/**
 * Get the display name for an item based on quantity
 */
function getItemDisplayName(item: Item, quantity: number): string {
  if (quantity === 1) {
    return item.name;
  }
  return item.pluralName || `${item.name}s`;
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

  const { item, inventoryId, quantity: availableQuantity } = found;

  // Determine how many to take
  let quantityToTake: number;
  if (requestedQuantity === "all") {
    quantityToTake = availableQuantity;
  } else if (requestedQuantity !== undefined) {
    if (requestedQuantity > availableQuantity) {
      const displayName = getItemDisplayName(item, availableQuantity);
      return {
        success: false,
        message: `There are only ${availableQuantity} ${displayName} here.`,
      };
    }
    quantityToTake = requestedQuantity;
  } else {
    // Default: bulk items take all, non-bulk take 1
    quantityToTake = item.isBulk ? availableQuantity : 1;
  }

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

  const { item, inventoryId, quantity: availableQuantity } = found;

  // Determine how many to drop
  let quantityToDrop: number;
  if (requestedQuantity === "all") {
    quantityToDrop = availableQuantity;
  } else if (requestedQuantity !== undefined) {
    if (requestedQuantity > availableQuantity) {
      const displayName = getItemDisplayName(item, availableQuantity);
      return {
        success: false,
        message: `You only have ${availableQuantity} ${displayName}.`,
      };
    }
    quantityToDrop = requestedQuantity;
  } else {
    // Default: bulk items drop all, non-bulk drop 1
    quantityToDrop = item.isBulk ? availableQuantity : 1;
  }

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
 * Find an item in an open container by name
 */
async function findItemInContainer(
  containerId: string,
  itemName: string,
): Promise<{ item: Item; inventoryId: string; quantity: number } | null> {
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
 * Generate auto-description of item stats for private info
 */
function generateStatsDescription(item: Item): string {
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
  if (item.equipSlot) {
    parts.push(`Slot: ${item.equipSlot}`);
  }

  return parts.length > 0 ? `[${parts.join(", ")}]` : "";
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
 * Get a player's inventory
 * @param playerId - The player whose inventory to retrieve
 * @returns Array of ItemStacks
 */
export async function getInventory(playerId: string): Promise<ItemStack[]> {
  const inventoryRows = await db
    .select()
    .from(playerInventory)
    .innerJoin(items, eq(playerInventory.itemId, items.id))
    .where(eq(playerInventory.playerId, playerId));

  return inventoryRows.map((row) => ({
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

  const { item, inventoryId, quantity: availableQuantity } = found;

  // Determine how many to take
  let quantityToTake: number;
  if (requestedQuantity === "all") {
    quantityToTake = availableQuantity;
  } else if (requestedQuantity !== undefined) {
    if (requestedQuantity > availableQuantity) {
      const displayName = getItemDisplayName(item, availableQuantity);
      return {
        success: false,
        message: `There are only ${availableQuantity} ${displayName} in the ${container.name}.`,
      };
    }
    quantityToTake = requestedQuantity;
  } else {
    quantityToTake = item.isBulk ? availableQuantity : 1;
  }

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

  const { item, inventoryId, quantity: availableQuantity } = found;

  // Determine how many to give
  let quantityToGive: number;
  if (requestedQuantity === "all") {
    quantityToGive = availableQuantity;
  } else if (requestedQuantity !== undefined) {
    if (requestedQuantity > availableQuantity) {
      const displayName = getItemDisplayName(item, availableQuantity);
      return {
        success: false,
        message: `You only have ${availableQuantity} ${displayName}.`,
      };
    }
    quantityToGive = requestedQuantity;
  } else {
    quantityToGive = item.isBulk ? availableQuantity : 1;
  }

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
