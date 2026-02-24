/**
 * Combat service for managing real-time combat between players and monsters.
 * Handles combat state, attack resolution, flee mechanics, and death handling.
 */

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { monsterInstances, monsters, players, rooms } from "../db/schema.js";
import type {
  ActiveCombat,
  AttackResult,
  CombatBroadcaster,
  CombatParticipant,
  CombatResult,
  FleeResult,
} from "../types/combat.js";
import type { Direction, Exit } from "../types/room.js";
import * as CorpseService from "./CorpseService.js";
import { roll, rollD20 } from "./DiceService.js";
import {
  calculateAC,
  calculateAttackInterval,
  calculateEquipmentConBonus,
  calculateFleeDC,
  calculateXpAfterDeath,
  getDamageModifier,
  getStatModifier,
} from "./StatService.js";
import { getEquippedItems } from "./items/equipment.js";

/** Default respawn room ID (Town Square) */
const DEFAULT_RESPAWN_ROOM = "room-town-square";

// ============================================
// In-Memory Combat State
// ============================================

/** Map of combatId -> ActiveCombat */
const activeCombats = new Map<string, ActiveCombat>();

/** Map of playerId -> combatId for quick lookup */
const playerCombatMap = new Map<string, string>();

/** Map of monsterInstanceId -> combatId for quick lookup */
const monsterCombatMap = new Map<string, string>();

/** Broadcaster function set by socket handler integration */
let broadcaster: CombatBroadcaster | null = null;

/** Callback for player death events (handles respawn room change) */
export type DeathCallback = (
  playerId: string,
  deathRoomId: string,
  respawnRoomId: string,
) => Promise<void>;

let deathCallback: DeathCallback | null = null;

// ============================================
// Combat State Queries
// ============================================

/**
 * Set the broadcaster function for combat events
 * @param fn - Function to broadcast combat events to rooms
 */
export function setBroadcaster(fn: CombatBroadcaster): void {
  broadcaster = fn;
}

/**
 * Set the callback for player death events
 * @param fn - Function to handle player respawn (room change, socket updates)
 */
export function setDeathCallback(fn: DeathCallback): void {
  deathCallback = fn;
}

/**
 * Check if a player is currently in combat
 * @param playerId - The player's ID
 * @returns True if player is in combat
 */
export function isPlayerInCombat(playerId: string): boolean {
  return playerCombatMap.has(playerId);
}

/**
 * Check if a monster instance is currently in combat
 * @param monsterInstanceId - The monster instance's ID
 * @returns True if monster is in combat
 */
export function isMonsterInCombat(monsterInstanceId: string): boolean {
  return monsterCombatMap.has(monsterInstanceId);
}

/**
 * Get the active combat for a player
 * @param playerId - The player's ID
 * @returns The active combat or null if not in combat
 */
export function getCombatForPlayer(playerId: string): ActiveCombat | null {
  const combatId = playerCombatMap.get(playerId);
  if (!combatId) return null;
  return activeCombats.get(combatId) || null;
}

/**
 * Get the active combat for a monster instance
 * @param monsterInstanceId - The monster instance's ID
 * @returns The active combat or null if not in combat
 */
export function getCombatForMonster(
  monsterInstanceId: string,
): ActiveCombat | null {
  const combatId = monsterCombatMap.get(monsterInstanceId);
  if (!combatId) return null;
  return activeCombats.get(combatId) || null;
}

/**
 * Get all players currently fighting a specific monster
 * @param monsterInstanceId - The monster instance's ID
 * @returns Array of player IDs fighting this monster
 */
export function getPlayersAttackingMonster(
  monsterInstanceId: string,
): string[] {
  const combat = getCombatForMonster(monsterInstanceId);
  if (!combat) return [];
  const targets = combat.monsterTargets.get(monsterInstanceId);
  return targets ? Array.from(targets) : [];
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build a CombatParticipant from a player database record
 */
async function buildPlayerParticipant(
  playerId: string,
): Promise<CombatParticipant | null> {
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) return null;

  // Get equipped items for AC calculation and weapon
  const equipped = await getEquippedItems(playerId);
  const conBonus = calculateEquipmentConBonus(equipped);
  const ac = calculateAC(player.dex, conBonus);

  // Find equipped weapon damage
  const weapon = equipped.find((item) => item.weaponDamage);
  const weaponDamage = weapon?.weaponDamage || null;

  return {
    type: "player",
    id: player.id,
    name: player.name,
    currentHp: player.currentHp,
    maxHp: player.maxHp,
    stats: {
      str: player.str,
      dex: player.dex,
      con: player.con,
    },
    weaponDamage,
    ac,
    level: player.level,
  };
}

/**
 * Build a CombatParticipant from a monster instance
 */
async function buildMonsterParticipant(
  monsterInstanceId: string,
): Promise<CombatParticipant | null> {
  const record = await db
    .select()
    .from(monsterInstances)
    .innerJoin(monsters, eq(monsterInstances.monsterId, monsters.id))
    .where(eq(monsterInstances.id, monsterInstanceId))
    .get();

  if (!record) return null;

  const monster = record.monsters;
  const instance = record.monster_instances;

  // Monster AC: 10 + DEX modifier (no equipment)
  const ac = calculateAC(monster.dex, 0);

  return {
    type: "monster",
    id: instance.id,
    name: monster.name,
    currentHp: instance.currentHp,
    maxHp: monster.maxHp,
    stats: {
      str: monster.str,
      dex: monster.dex,
      con: monster.con,
    },
    weaponDamage: monster.weaponDamage || "1d4",
    ac,
    level: monster.level,
  };
}

/**
 * Broadcast a combat event if broadcaster is set
 */
function broadcast(
  roomId: string,
  event: Parameters<CombatBroadcaster>[1],
  excludePlayerId?: string,
): void {
  if (broadcaster) {
    broadcaster(roomId, event, excludePlayerId);
  }
}

// ============================================
// Attack Resolution
// ============================================

/**
 * Process a single attack from attacker to defender
 * @param attacker - The attacking participant
 * @param defender - The defending participant
 * @returns Attack result with hit/miss, damage, and messages
 */
export function processAttack(
  attacker: CombatParticipant,
  defender: CombatParticipant,
): AttackResult {
  // Roll d20 + DEX modifier for attack
  const dexMod = getStatModifier(attacker.stats.dex);
  const attackRoll = rollD20(dexMod);

  const hit = attackRoll >= defender.ac;

  if (!hit) {
    return {
      hit: false,
      attackRoll,
      targetAC: defender.ac,
      damage: null,
      defenderHp: defender.currentHp,
      defenderDead: false,
      message: `${attacker.name} swings at ${defender.name} but misses!`,
    };
  }

  // Calculate damage: weapon dice + STR modifier, minimum 1
  const weaponNotation = attacker.weaponDamage || "1d4";
  const damageRoll = roll(weaponNotation);
  const strMod = getDamageModifier(attacker.stats.str);
  const rawDamage = (damageRoll?.total || 1) + strMod;
  const damage = Math.max(1, rawDamage);

  const newHp = defender.currentHp - damage;
  const defenderDead = newHp <= 0;

  let message: string;
  if (defenderDead) {
    message = `${attacker.name} strikes ${defender.name} for ${damage} damage, defeating them!`;
  } else {
    message = `${attacker.name} hits ${defender.name} for ${damage} damage! (${Math.max(0, newHp)}/${defender.maxHp} HP)`;
  }

  return {
    hit: true,
    attackRoll,
    targetAC: defender.ac,
    damage,
    defenderHp: Math.max(0, newHp),
    defenderDead,
    message,
  };
}

// ============================================
// Combat Flow
// ============================================

/**
 * Schedule an attack for a participant
 */
function scheduleAttack(
  combat: ActiveCombat,
  attackerId: string,
  defenderId: string,
): void {
  const attacker = combat.participants.get(attackerId);
  const defender = combat.participants.get(defenderId);

  if (!attacker || !defender) return;

  const interval = calculateAttackInterval(attacker.stats.dex);

  const timer = setTimeout(async () => {
    // Re-fetch current state
    const currentCombat = activeCombats.get(combat.id);
    if (!currentCombat) return;

    const currentAttacker = currentCombat.participants.get(attackerId);
    const currentDefender = currentCombat.participants.get(defenderId);

    if (!currentAttacker || !currentDefender) return;

    // Process the attack
    const result = processAttack(currentAttacker, currentDefender);

    // Update defender HP in combat state
    currentDefender.currentHp = result.defenderHp;

    // Broadcast attack result
    broadcast(currentCombat.roomId, {
      type: "attack",
      message: result.message,
    });

    if (result.defenderDead) {
      if (currentDefender.type === "monster") {
        await handleMonsterDeath(defenderId, attackerId);
      } else {
        await handlePlayerDeath(defenderId, currentCombat.roomId);
      }
    } else {
      // Update HP in database
      if (currentDefender.type === "player") {
        await db
          .update(players)
          .set({ currentHp: result.defenderHp })
          .where(eq(players.id, defenderId));
      } else {
        await db
          .update(monsterInstances)
          .set({ currentHp: result.defenderHp })
          .where(eq(monsterInstances.id, defenderId));
      }

      // Schedule next attack if combat still active
      if (activeCombats.has(combat.id)) {
        scheduleAttack(currentCombat, attackerId, defenderId);
      }
    }
  }, interval);

  combat.attackTimers.set(attackerId, timer);
}

/**
 * Initiate combat between a player and a monster
 * @param playerId - The player's ID
 * @param monsterInstanceId - The monster instance ID
 * @param roomId - The room where combat occurs
 * @param monsterInitiated - Whether the monster initiated combat (aggro)
 * @returns Combat result with success/failure and message
 */
export async function initiateCombat(
  playerId: string,
  monsterInstanceId: string,
  roomId: string,
  monsterInitiated: boolean = false,
): Promise<CombatResult> {
  // Check if player is already in combat
  if (isPlayerInCombat(playerId)) {
    const existingCombat = getCombatForPlayer(playerId);
    if (existingCombat?.participants.has(monsterInstanceId)) {
      return {
        success: false,
        message: "You're already fighting that!",
        combatId: null,
      };
    }
    return {
      success: false,
      message: "You're already in combat!",
      combatId: null,
    };
  }

  // Build participants
  const playerParticipant = await buildPlayerParticipant(playerId);
  if (!playerParticipant) {
    return { success: false, message: "Player not found.", combatId: null };
  }

  const monsterParticipant = await buildMonsterParticipant(monsterInstanceId);
  if (!monsterParticipant) {
    return {
      success: false,
      message: "That creature isn't here.",
      combatId: null,
    };
  }

  // Check if monster is already in combat - join existing combat
  let combat = getCombatForMonster(monsterInstanceId);

  if (combat) {
    // Add player to existing combat
    combat.participants.set(playerId, playerParticipant);
    playerCombatMap.set(playerId, combat.id);

    // Add player to monster's targets
    const targets = combat.monsterTargets.get(monsterInstanceId);
    if (targets) {
      targets.add(playerId);
    }

    // Start attack timers for both
    scheduleAttack(combat, playerId, monsterInstanceId);
    scheduleAttack(combat, monsterInstanceId, playerId);

    broadcast(roomId, {
      type: "combat_start",
      attackerName: playerParticipant.name,
      defenderName: monsterParticipant.name,
    });

    return {
      success: true,
      message: `You join the fight against the ${monsterParticipant.name}!`,
      combatId: combat.id,
    };
  }

  // Create new combat
  const combatId = randomUUID();
  combat = {
    id: combatId,
    participants: new Map([
      [playerId, playerParticipant],
      [monsterInstanceId, monsterParticipant],
    ]),
    monsterTargets: new Map([[monsterInstanceId, new Set([playerId])]]),
    attackTimers: new Map(),
    roomId,
  };

  activeCombats.set(combatId, combat);
  playerCombatMap.set(playerId, combatId);
  monsterCombatMap.set(monsterInstanceId, combatId);

  // Start attack timers for both
  scheduleAttack(combat, playerId, monsterInstanceId);
  scheduleAttack(combat, monsterInstanceId, playerId);

  // Broadcast with correct attacker/defender based on who initiated
  if (monsterInitiated) {
    broadcast(roomId, {
      type: "combat_start",
      attackerName: monsterParticipant.name,
      defenderName: playerParticipant.name,
    });

    return {
      success: true,
      message: `The ${monsterParticipant.name} attacks you!`,
      combatId,
    };
  }

  broadcast(roomId, {
    type: "combat_start",
    attackerName: playerParticipant.name,
    defenderName: monsterParticipant.name,
  });

  return {
    success: true,
    message: `You attack the ${monsterParticipant.name}!`,
    combatId,
  };
}

/**
 * End combat for a specific player
 * @param playerId - The player leaving combat
 */
export function endCombatForPlayer(playerId: string): void {
  const combatId = playerCombatMap.get(playerId);
  if (!combatId) return;

  const combat = activeCombats.get(combatId);
  if (!combat) {
    playerCombatMap.delete(playerId);
    return;
  }

  // Clear player's attack timer
  const timer = combat.attackTimers.get(playerId);
  if (timer) {
    clearTimeout(timer);
    combat.attackTimers.delete(playerId);
  }

  // Remove player from combat
  combat.participants.delete(playerId);
  playerCombatMap.delete(playerId);

  // Remove player from all monster target lists
  for (const [monsterId, targets] of combat.monsterTargets) {
    targets.delete(playerId);

    // If monster has no more targets, clear its timer
    if (targets.size === 0) {
      const monsterTimer = combat.attackTimers.get(monsterId);
      if (monsterTimer) {
        clearTimeout(monsterTimer);
        combat.attackTimers.delete(monsterId);
      }
    }
  }

  // Check if combat should end entirely
  const remainingPlayers = Array.from(combat.participants.values()).filter(
    (p) => p.type === "player",
  );

  if (remainingPlayers.length === 0) {
    // No players left, end combat
    cleanupCombat(combatId);
  }
}

/**
 * Clean up a combat entirely
 */
function cleanupCombat(combatId: string): void {
  const combat = activeCombats.get(combatId);
  if (!combat) return;

  // Clear all timers
  for (const timer of combat.attackTimers.values()) {
    clearTimeout(timer);
  }

  // Remove all mappings
  for (const participant of combat.participants.values()) {
    if (participant.type === "player") {
      playerCombatMap.delete(participant.id);
    } else {
      monsterCombatMap.delete(participant.id);
    }
  }

  activeCombats.delete(combatId);
}

// ============================================
// Flee Mechanics
// ============================================

/**
 * Attempt to flee from combat
 * @param playerId - The fleeing player's ID
 * @returns Flee result with success/failure and destination
 */
export async function attemptFlee(playerId: string): Promise<FleeResult> {
  const combat = getCombatForPlayer(playerId);
  if (!combat) {
    return {
      success: false,
      message: "You're not in combat.",
      destination: null,
    };
  }

  const player = combat.participants.get(playerId);
  if (!player) {
    return {
      success: false,
      message: "Combat state error.",
      destination: null,
    };
  }

  // Find the monster(s) we're fighting to get level for DC
  const fightingMonsters = Array.from(combat.participants.values()).filter(
    (p) => p.type === "monster",
  );

  // Use highest level monster for DC
  const highestLevel = Math.max(...fightingMonsters.map((m) => m.level), 1);
  const fleeDC = calculateFleeDC(player.level, highestLevel);

  // Roll flee check: d20 + DEX modifier vs DC
  const dexMod = getStatModifier(player.stats.dex);
  const fleeRoll = rollD20(dexMod);

  if (fleeRoll < fleeDC) {
    broadcast(combat.roomId, {
      type: "flee_fail",
      playerName: player.name,
    });

    return {
      success: false,
      message: `You try to flee but can't escape! (rolled ${fleeRoll} vs DC ${fleeDC})`,
      destination: null,
    };
  }

  // Get room exits for random flee direction
  const room = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, combat.roomId))
    .get();

  if (!room || !room.exits) {
    return {
      success: false,
      message: "There's nowhere to run!",
      destination: null,
    };
  }

  const exits = room.exits as Partial<Record<Direction, Exit>>;
  const availableExits = Object.entries(exits).filter(
    ([_, exit]) => exit && !exit.blocked,
  ) as [Direction, Exit][];

  if (availableExits.length === 0) {
    return {
      success: false,
      message: "There's nowhere to run!",
      destination: null,
    };
  }

  // Pick random exit
  const [direction, exit] =
    availableExits[Math.floor(Math.random() * availableExits.length)];

  // End combat for player
  endCombatForPlayer(playerId);

  // Move player to new room
  await db
    .update(players)
    .set({ currentRoomId: exit.roomId })
    .where(eq(players.id, playerId));

  broadcast(
    combat.roomId,
    {
      type: "flee_success",
      playerName: player.name,
      direction,
    },
    playerId,
  );

  return {
    success: true,
    message: `You flee ${direction}!`,
    destination: exit.roomId,
  };
}

// ============================================
// Death Handling
// ============================================

/**
 * Handle player death - create corpse, transfer inventory, respawn
 * @param playerId - The dying player's ID
 * @param roomId - The room where death occurred
 */
export async function handlePlayerDeath(
  playerId: string,
  roomId: string,
): Promise<void> {
  // End combat for player
  endCombatForPlayer(playerId);

  // Get player data
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) return;

  // Apply XP penalty
  const newXp = calculateXpAfterDeath(player.xp);

  // Create corpse and transfer inventory using CorpseService
  const corpseId = await CorpseService.createCorpse(playerId, roomId);
  await CorpseService.transferInventoryToCorpse(playerId, corpseId);

  // Clear worn equipment
  await db
    .update(players)
    .set({
      wornHead: null,
      wornTorso: null,
      wornBody: null,
      wornLegs: null,
      wornHands: null,
      wornFeet: null,
      wornMainHand: null,
      wornOffHand: null,
      wornNeck: null,
      wornRing1: null,
      wornRing2: null,
    })
    .where(eq(players.id, playerId));

  // Respawn player
  const respawnRoom = player.respawnRoomId || DEFAULT_RESPAWN_ROOM;

  await db
    .update(players)
    .set({
      currentHp: 1,
      xp: newXp,
      currentRoomId: respawnRoom,
    })
    .where(eq(players.id, playerId));

  broadcast(roomId, {
    type: "player_death",
    playerName: player.name,
    killerName: "a monster", // Could be enhanced to track killer
  });

  // Call death callback to handle socket room change and player state update
  if (deathCallback) {
    await deathCallback(playerId, roomId, respawnRoom);
  }
}

/**
 * Handle monster death - award XP, remove monster, end combat
 * @param monsterInstanceId - The dying monster's instance ID
 * @param killerPlayerId - The player who dealt the killing blow
 */
export async function handleMonsterDeath(
  monsterInstanceId: string,
  killerPlayerId: string,
): Promise<void> {
  const combat = getCombatForMonster(monsterInstanceId);
  const roomId = combat?.roomId;

  // Get monster data for XP reward
  const record = await db
    .select()
    .from(monsterInstances)
    .innerJoin(monsters, eq(monsterInstances.monsterId, monsters.id))
    .where(eq(monsterInstances.id, monsterInstanceId))
    .get();

  if (!record) return;

  const monster = record.monsters;
  const xpReward = monster.xpReward;

  // Award XP to killer
  const killer = await db
    .select()
    .from(players)
    .where(eq(players.id, killerPlayerId))
    .get();

  if (killer) {
    await db
      .update(players)
      .set({ xp: killer.xp + xpReward })
      .where(eq(players.id, killerPlayerId));
  }

  // End combat for all players fighting this monster
  if (combat) {
    const targets = combat.monsterTargets.get(monsterInstanceId);
    if (targets) {
      for (const playerId of targets) {
        endCombatForPlayer(playerId);
      }
    }

    // Clear monster from combat
    const monsterTimer = combat.attackTimers.get(monsterInstanceId);
    if (monsterTimer) {
      clearTimeout(monsterTimer);
    }
    combat.participants.delete(monsterInstanceId);
    combat.monsterTargets.delete(monsterInstanceId);
    monsterCombatMap.delete(monsterInstanceId);

    // Clean up combat if empty
    if (combat.participants.size === 0) {
      cleanupCombat(combat.id);
    }
  }

  // Remove monster instance from database
  await db
    .delete(monsterInstances)
    .where(eq(monsterInstances.id, monsterInstanceId));

  if (roomId) {
    broadcast(roomId, {
      type: "monster_death",
      monsterName: monster.name,
      killerName: killer?.name || "someone",
      xpAwarded: xpReward,
    });
  }
}

/**
 * Handle player disconnect during combat - triggers death
 * @param playerId - The disconnecting player's ID
 */
export async function handleDisconnect(playerId: string): Promise<void> {
  const combat = getCombatForPlayer(playerId);
  if (combat) {
    await handlePlayerDeath(playerId, combat.roomId);
  }
}

// ============================================
// Monster Aggro
// ============================================

/**
 * Check and trigger monster aggro when player enters room
 * @param playerId - The entering player's ID
 * @param roomId - The room being entered
 */
export async function checkMonsterAggro(
  playerId: string,
  roomId: string,
): Promise<void> {
  // Get player level
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) return;

  // Get monsters in room with aggro
  const roomMonsters = await db
    .select()
    .from(monsterInstances)
    .innerJoin(monsters, eq(monsterInstances.monsterId, monsters.id))
    .where(eq(monsterInstances.roomId, roomId));

  // Find aggressive monsters that would attack this player
  const aggressiveMonsters = roomMonsters.filter(
    (record) =>
      record.monsters.aggroScore > 0 &&
      player.level <= record.monsters.aggroScore &&
      !isMonsterInCombat(record.monster_instances.id),
  );

  if (aggressiveMonsters.length === 0) return;

  // Pick a random aggressive monster to attack
  const attacker =
    aggressiveMonsters[Math.floor(Math.random() * aggressiveMonsters.length)];

  // Small delay before aggro triggers (feels more natural)
  setTimeout(async () => {
    // Re-check player is still in room and not in combat
    const currentPlayer = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .get();

    if (
      currentPlayer?.currentRoomId === roomId &&
      !isPlayerInCombat(playerId)
    ) {
      await initiateCombat(
        playerId,
        attacker.monster_instances.id,
        roomId,
        true,
      );
    }
  }, 500);
}
