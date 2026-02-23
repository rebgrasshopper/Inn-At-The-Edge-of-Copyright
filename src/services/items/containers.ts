/**
 * Container functions - open, close, and examine containers.
 */

import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { containerInventory, containers, items } from "../../db/schema.js";
import { findContainerInRoom } from "./finders.js";

/**
 * Open a container in the room.
 * @param roomId - The room containing the container
 * @param containerName - The name of the container to open
 * @returns Result with success status and message
 */
export async function openContainer(
  roomId: string,
  containerName: string,
): Promise<{ success: boolean; message: string }> {
  const container = await findContainerInRoom(roomId, containerName);

  if (!container) {
    return {
      success: false,
      message: `You don't see any "${containerName}" here.`,
    };
  }

  if (container.isOpen) {
    return {
      success: false,
      message: `The ${container.name} is already open.`,
    };
  }

  await db
    .update(containers)
    .set({ isOpen: true })
    .where(eq(containers.id, container.id));

  return { success: true, message: `You open the ${container.name}.` };
}

/**
 * Close a container in the room.
 * @param roomId - The room containing the container
 * @param containerName - The name of the container to close
 * @returns Result with success status and message
 */
export async function closeContainer(
  roomId: string,
  containerName: string,
): Promise<{ success: boolean; message: string }> {
  const container = await findContainerInRoom(roomId, containerName);

  if (!container) {
    return {
      success: false,
      message: `You don't see any "${containerName}" here.`,
    };
  }

  if (!container.isOpen) {
    return {
      success: false,
      message: `The ${container.name} is already closed.`,
    };
  }

  await db
    .update(containers)
    .set({ isOpen: false })
    .where(eq(containers.id, container.id));

  return { success: true, message: `You close the ${container.name}.` };
}

/**
 * Examine a container, showing its description and contents if open.
 * @param roomId - The room containing the container
 * @param containerName - The name of the container to examine
 * @returns Result with success status and description
 */
export async function examineContainer(
  roomId: string,
  containerName: string,
): Promise<{ success: boolean; description: string }> {
  const container = await findContainerInRoom(roomId, containerName);

  if (!container) {
    return {
      success: false,
      description: `You don't see any "${containerName}" here.`,
    };
  }

  const lines = [container.description];

  if (container.isOpen) {
    // Get contents
    const contents = await db
      .select()
      .from(containerInventory)
      .innerJoin(items, eq(containerInventory.itemId, items.id))
      .where(eq(containerInventory.containerId, container.id));

    if (contents.length === 0) {
      lines.push("It is empty.");
    } else {
      lines.push("It contains:");
      for (const row of contents) {
        const item = row.items;
        const qty = row.container_inventory.quantity;
        if (qty === 1) {
          lines.push(`  ${item.name}`);
        } else {
          const name = item.pluralName || `${item.name}s`;
          lines.push(`  ${qty} ${name}`);
        }
      }
    }
  } else {
    lines.push("It is closed.");
  }

  return { success: true, description: lines.join("\n") };
}
