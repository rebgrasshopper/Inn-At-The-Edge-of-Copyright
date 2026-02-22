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
 * Pick up an item from the room and add it to player's inventory
 * @param playerId - The player picking up the item
 * @param roomId - The room to pick up from
 * @param itemName - The name of the item to pick up
 * @param requestedQuantity - How many to pick up (undefined = default based on bulk)
 * @returns ItemResult with success status and message
 */
export declare function getItem(playerId: string, roomId: string, itemName: string, requestedQuantity?: number | "all"): Promise<ItemResult>;
/**
 * Drop an item from player's inventory into the room
 * @param playerId - The player dropping the item
 * @param roomId - The room to drop into
 * @param itemName - The name of the item to drop
 * @param requestedQuantity - How many to drop (undefined = default based on bulk)
 * @returns ItemResult with success status and message
 */
export declare function dropItem(playerId: string, roomId: string, itemName: string, requestedQuantity?: number | "all"): Promise<ItemResult>;
/**
 * Examine an item and return its description
 * @param playerId - The player examining the item
 * @param roomId - The room the player is in
 * @param itemName - The name of the item to examine
 * @param searchOwn - If true, search own inventory first (for "examine my X")
 * @returns Description string or error message
 */
export declare function examineItem(playerId: string, roomId: string, itemName: string, searchOwn?: boolean): Promise<{
    success: boolean;
    description: string;
}>;
/**
 * Get a player's inventory
 * @param playerId - The player whose inventory to retrieve
 * @returns Array of ItemStacks
 */
export declare function getInventory(playerId: string): Promise<ItemStack[]>;
/**
 * Get an item from a container and add it to player's inventory
 * @param playerId - The player getting the item
 * @param roomId - The room the player is in
 * @param itemName - The name of the item to get
 * @param containerName - The name of the container to get from
 * @param requestedQuantity - How many to get
 * @returns ItemResult with success status and message
 */
export declare function getItemFromContainer(playerId: string, roomId: string, itemName: string, containerName: string, requestedQuantity?: number | "all"): Promise<ItemResult>;
/**
 * Give an item to another player in the same room
 * @param fromPlayerId - The player giving the item
 * @param roomId - The room both players are in
 * @param toPlayerName - The name of the player to give to
 * @param itemName - The name of the item to give
 * @param requestedQuantity - How many to give
 * @returns ItemResult with success status and message
 */
export declare function giveItem(fromPlayerId: string, roomId: string, toPlayerName: string, itemName: string, requestedQuantity?: number | "all"): Promise<ItemResult>;
//# sourceMappingURL=ItemService.d.ts.map