/**
 * Item transfer functions - get, drop, give, put (moving items between locations).
 */

import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../../db/index.js";
import {
  containerInventory,
  playerInventory,
  players,
  roomInventory,
} from "../../db/schema.js";
import * as FeatureService from "../FeatureService.js";
import { getItemDisplayName, resolveQuantity } from "../ItemService.utils.js";
import {
  findContainerInRoom,
  findItemInContainer,
  findItemInPlayerInventory,
  findItemInRoom,
  getOpenContainersInRoom,
} from "./finders.js";

export type ItemResult = {
  success: boolean;
  item?: import("../../types/item.js").Item;
  quantity?: number;
  message: string;
};

/**
 * Pick up an item from the room and add it to player's inventory.
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

  // If not in room, check open containers
  if (!found) {
    const openContainerList = await getOpenContainersInRoom(roomId);

    for (const container of openContainerList) {
      const containerItem = await findItemInContainer(container.id, itemName);
      if (containerItem) {
        // Delegate to getItemFromContainer
        return getItemFromContainer(
          playerId,
          roomId,
          itemName,
          container.name,
          requestedQuantity,
        );
      }
    }

    // Check if target is a feature (non-takeable thing)
    const feature = await FeatureService.findFeatureByName(roomId, itemName);
    if (feature) {
      return {
        success: false,
        message: feature.refuseGetMessage || "You can't take that.",
      };
    }

    const container = await findContainerInRoom(roomId, itemName);
    if (container) {
      return { success: false, message: "You can't take that." };
    }

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
 * Drop an item from player's inventory into the room.
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
 * Get an item from a container and add it to player's inventory.
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
  // Find the container using fuzzy matching
  const container = await findContainerInRoom(roomId, containerName);

  if (!container) {
    // Check if it's a feature (non-container thing like a fountain)
    const feature = await FeatureService.findFeatureByName(
      roomId,
      containerName,
    );
    if (feature) {
      return {
        success: false,
        message:
          feature.refuseGetMessage || "You can't take anything from that.",
      };
    }

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
 * Give an item to another player in the same room.
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

/**
 * Put an item from player inventory into a container in the room.
 * @param playerId - The player putting the item
 * @param roomId - The room containing the container
 * @param itemName - The name of the item to put
 * @param containerName - The name of the container
 * @param requestedQuantity - How many to put (optional)
 * @returns ItemResult with success status and message
 */
export async function putItemInContainer(
  playerId: string,
  roomId: string,
  itemName: string,
  containerName: string,
  requestedQuantity?: number | "all",
): Promise<ItemResult> {
  // Find the container using fuzzy matching
  const container = await findContainerInRoom(roomId, containerName);

  if (!container) {
    return {
      success: false,
      message: `You don't see any "${containerName}" here.`,
    };
  }

  if (!container.isOpen) {
    return { success: false, message: `The ${container.name} is closed.` };
  }

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

  const quantityToPut = resolveQuantity(
    requestedQuantity,
    availableQuantity,
    matchedPlural,
  );

  // Check if container already has this item
  const existingContainerInventory = await db
    .select()
    .from(containerInventory)
    .where(
      and(
        eq(containerInventory.containerId, container.id),
        eq(containerInventory.itemId, item.id),
      ),
    )
    .get();

  // Update or create container inventory entry
  if (existingContainerInventory) {
    await db
      .update(containerInventory)
      .set({ quantity: existingContainerInventory.quantity + quantityToPut })
      .where(eq(containerInventory.id, existingContainerInventory.id));
  } else {
    await db.insert(containerInventory).values({
      id: uuidv4(),
      containerId: container.id,
      itemId: item.id,
      quantity: quantityToPut,
    });
  }

  // Update or remove player inventory entry
  const remainingQuantity = availableQuantity - quantityToPut;
  if (remainingQuantity <= 0) {
    await db.delete(playerInventory).where(eq(playerInventory.id, inventoryId));
  } else {
    await db
      .update(playerInventory)
      .set({ quantity: remainingQuantity })
      .where(eq(playerInventory.id, inventoryId));
  }

  const displayName = getItemDisplayName(item, quantityToPut);
  const message =
    quantityToPut === 1
      ? `You put the ${displayName} in the ${container.name}.`
      : `You put ${quantityToPut} ${displayName} in the ${container.name}.`;

  return { success: true, item, quantity: quantityToPut, message };
}
