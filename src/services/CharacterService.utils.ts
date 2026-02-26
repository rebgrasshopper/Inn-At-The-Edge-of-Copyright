import type { players } from "../db/schema.js";
import type { Player, PlayerEquipment } from "../types/player.js";

/**
 * Convert a database player record to a Player type.
 * @param record - Database row from players table
 * @returns Player object with equipment
 */
export function toPlayer(record: typeof players.$inferSelect): Player {
  return {
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
    equipment: {
      head: record.wornHead,
      torso: record.wornTorso,
      body: record.wornBody,
      legs: record.wornLegs,
      hands: record.wornHands,
      feet: record.wornFeet,
      mainHand: record.wornMainHand,
      offHand: record.wornOffHand,
      neck: record.wornNeck,
      ring1: record.wornRing1,
      ring2: record.wornRing2,
      back: record.wornBack,
    },
  };
}

/**
 * Create a default empty equipment object.
 * @returns PlayerEquipment with all slots null
 */
export function emptyEquipment(): PlayerEquipment {
  return {
    head: null,
    torso: null,
    body: null,
    legs: null,
    hands: null,
    feet: null,
    mainHand: null,
    offHand: null,
    neck: null,
    ring1: null,
    ring2: null,
    back: null,
  };
}
