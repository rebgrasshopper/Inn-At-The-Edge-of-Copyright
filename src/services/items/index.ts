/**
 * Item service - re-exports all item-related functions.
 *
 * This module provides a unified interface for item operations,
 * maintaining backward compatibility with the original ItemService.
 */

// Types
export type { ExamineContext } from "./examine.js";
export type { ItemResult } from "./transfer.js";

// Transfer operations (get, drop, give, put)
export {
  dropItem,
  getItem,
  getItemFromContainer,
  giveItem,
  putItemInContainer,
} from "./transfer.js";

// Equipment operations
export {
  equipItem,
  getEquipmentCombatBonuses,
  getEquipmentList,
  getEquipmentStatBonuses,
  getEquippedItems,
  getPlayerEquipment,
  unequipItem,
} from "./equipment.js";

// Container operations
export {
  closeContainer,
  examineContainer,
  openContainer,
} from "./containers.js";

// Examine operations
export { examineItem, getInventory } from "./examine.js";
