import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { containers, features, items, monsterInstances, monsters, npcs, players, roomInventory, rooms, } from "../db/schema.js";
/**
 * Get a room by ID (basic room data only)
 * @param roomId - The room's unique identifier
 * @returns The room or null if not found
 */
export async function getRoom(roomId) {
    const record = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .get();
    if (!record)
        return null;
    return {
        id: record.id,
        name: record.name,
        description: record.description,
        region: record.region,
        exits: record.exits || {},
    };
}
/**
 * Get all online players in a room
 * @param roomId - The room's unique identifier
 * @returns Array of online players in the room
 */
export async function getPlayersInRoom(roomId) {
    const records = await db
        .select()
        .from(players)
        .where(eq(players.currentRoomId, roomId));
    return records
        .filter((r) => r.isOnline)
        .map((record) => ({
        id: record.id,
        userId: record.userId,
        name: record.name,
        currentRoomId: record.currentRoomId,
        stats: {
            str: record.str,
            dex: record.dex,
            con: record.con,
            int: record.int,
            wis: record.wis,
            cha: record.cha,
        },
        currentHp: record.currentHp,
        maxHp: record.maxHp,
        xp: record.xp,
        level: record.level,
        isOnline: record.isOnline,
    }));
}
/**
 * Get all rooms in a region (for region-wide broadcasts like shouting)
 * @param region - The region name
 * @returns Array of rooms in the region
 */
export async function getRoomsByRegion(region) {
    const records = await db.select().from(rooms).where(eq(rooms.region, region));
    return records.map((record) => ({
        id: record.id,
        name: record.name,
        description: record.description,
        region: record.region,
        exits: record.exits || {},
    }));
}
/**
 * Get a room with all its contents (players, items, monsters, NPCs, containers, features)
 * @param roomId - The room's unique identifier
 * @returns The room with all contents or null if room not found
 */
export async function getRoomWithContents(roomId) {
    const room = await getRoom(roomId);
    if (!room)
        return null;
    // Fetch all contents in parallel
    const [roomPlayers, roomItemRecords, roomMonsterRecords, roomNpcs, roomContainers, roomFeatures,] = await Promise.all([
        getPlayersInRoom(roomId),
        db
            .select()
            .from(roomInventory)
            .innerJoin(items, eq(roomInventory.itemId, items.id))
            .where(eq(roomInventory.roomId, roomId)),
        db
            .select()
            .from(monsterInstances)
            .innerJoin(monsters, eq(monsterInstances.monsterId, monsters.id))
            .where(eq(monsterInstances.roomId, roomId)),
        db.select().from(npcs).where(eq(npcs.roomId, roomId)),
        db.select().from(containers).where(eq(containers.roomId, roomId)),
        db.select().from(features).where(eq(features.roomId, roomId)),
    ]);
    // Transform items to ItemStack format
    const roomItems = roomItemRecords.map((record) => ({
        item: {
            id: record.items.id,
            name: record.items.name,
            pluralName: record.items.pluralName || undefined,
            description: record.items.description,
            category: record.items.category || undefined,
            isBulk: record.items.isBulk || undefined,
            effects: {
                str: record.items.strEffect || undefined,
                dex: record.items.dexEffect || undefined,
                con: record.items.conEffect || undefined,
                int: record.items.intEffect || undefined,
                wis: record.items.wisEffect || undefined,
                cha: record.items.chaEffect || undefined,
                hp: record.items.hpEffect || undefined,
            },
        },
        quantity: record.room_inventory.quantity,
    }));
    // Transform monster instances
    const roomMonsters = roomMonsterRecords.map((record) => ({
        id: record.monster_instances.id,
        monster: {
            id: record.monsters.id,
            name: record.monsters.name,
            description: record.monsters.description,
            stats: {
                str: record.monsters.str,
                dex: record.monsters.dex,
                con: record.monsters.con,
                int: record.monsters.int,
                wis: record.monsters.wis,
                cha: record.monsters.cha,
            },
            maxHp: record.monsters.maxHp,
            xpReward: record.monsters.xpReward,
        },
        roomId: record.monster_instances.roomId,
        currentHp: record.monster_instances.currentHp,
    }));
    // Transform NPCs
    const transformedNpcs = roomNpcs.map((record) => ({
        id: record.id,
        name: record.name,
        description: record.description,
        roomId: record.roomId,
    }));
    // Transform containers (only non-hidden ones, or discovered hidden ones)
    const transformedContainers = roomContainers
        .filter((c) => !c.isHidden)
        .map((record) => ({
        id: record.id,
        roomId: record.roomId,
        name: record.name,
        description: record.description,
        isHidden: record.isHidden || false,
        isOpen: record.isOpen || false,
        revealCommand: record.revealCommand || undefined,
    }));
    // Transform features (only non-hidden ones)
    const transformedFeatures = roomFeatures
        .filter((f) => !f.isHidden)
        .map((record) => ({
        id: record.id,
        roomId: record.roomId,
        name: record.name,
        description: record.description,
        triggerVerbs: record.triggerVerbs || [],
        triggerTarget: record.triggerTarget || "",
        condition: record.condition,
        successMessage: record.successMessage || undefined,
        failureMessage: record.failureMessage || undefined,
        successEffects: record.successEffects || undefined,
        failureEffects: record.failureEffects || undefined,
        revealsFeatureId: record.revealsFeatureId || undefined,
        revealsContainerId: record.revealsContainerId || undefined,
        isHidden: record.isHidden || false,
        isDiscovered: record.isDiscovered || false,
    }));
    return {
        ...room,
        players: roomPlayers,
        items: roomItems,
        monsters: roomMonsters,
        npcs: transformedNpcs,
        containers: transformedContainers,
        features: transformedFeatures,
    };
}
/**
 * Move a player in a direction, validating the exit exists and is not blocked
 * @param playerId - The player's unique identifier
 * @param direction - The direction to move
 * @returns MoveResult with the new room contents on success, or error message on failure
 */
export async function movePlayer(playerId, direction) {
    // Get the player's current room
    const playerRecord = await db
        .select()
        .from(players)
        .where(eq(players.id, playerId))
        .get();
    if (!playerRecord) {
        return { success: false, error: "Player not found" };
    }
    if (!playerRecord.currentRoomId) {
        return { success: false, error: "Player is not in a room" };
    }
    // Get the current room to check exits
    const currentRoom = await getRoom(playerRecord.currentRoomId);
    if (!currentRoom) {
        return { success: false, error: "Current room not found" };
    }
    // Check if exit exists in that direction
    const exit = currentRoom.exits[direction];
    if (!exit) {
        return { success: false, error: "There's no exit in that direction." };
    }
    // Check if exit is blocked
    if (exit.blocked) {
        return {
            success: false,
            error: exit.blockMessage || "The way is blocked.",
        };
    }
    // Update player's room
    await db
        .update(players)
        .set({ currentRoomId: exit.roomId })
        .where(eq(players.id, playerId));
    // Get the new room with contents
    const newRoom = await getRoomWithContents(exit.roomId);
    if (!newRoom) {
        return { success: false, error: "Destination room not found" };
    }
    return { success: true, room: newRoom };
}
//# sourceMappingURL=RoomService.js.map