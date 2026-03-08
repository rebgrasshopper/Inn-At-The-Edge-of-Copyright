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
import {
  rollD20,
  rollD20WithDetails,
  rollDamageWithDetails,
} from "./DiceService.js";
import { getAttackModifiers, getDamageModifiers } from "./FeatEffectHandler.js";
import { calculateBAB, grantFeatSlot } from "./FeatService.js";
import {
  calculateAC,
  calculateAttackInterval,
  calculateEquipmentConBonus,
  calculateFleeDC,
  calculateMaxHp,
  calculateXpAfterDeath,
  calculateXpReward,
  checkLevelUp,
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

/** Map of playerId -> pending aggro timers (for cleanup on room leave) */
const pendingAggroTimers = new Map<string, NodeJS.Timeout[]>();

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
  const ac = await calculateAC(player.dex, conBonus, playerId);

  // Find equipped weapon damage and range
  const weapon = equipped.find((item) => item.weaponDamage);
  const weaponDamage = weapon?.weaponDamage || null;
  const weaponRange = (weapon?.weaponRange as "melee" | "ranged") ?? "melee";

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
    weaponRange,
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

  // Monster AC: 10 + DEX modifier (no equipment, no feats)
  const ac = await calculateAC(monster.dex, 0);

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
    weaponRange: "melee", // Monsters default to melee attacks
    ac,
    level: monster.level,
  };
}

/**
 * Add a monster to an existing combat (for multi-monster aggro)
 * @param combat - The existing combat to join
 * @param playerId - The player being attacked
 * @param monsterInstanceId - The monster joining the fight
 * @param roomId - The room where combat is happening
 * @returns Combat result
 */
async function addMonsterToCombat(
  combat: ActiveCombat,
  playerId: string,
  monsterInstanceId: string,
  roomId: string,
): Promise<CombatResult> {
  const monsterParticipant = await buildMonsterParticipant(monsterInstanceId);
  if (!monsterParticipant) {
    return {
      success: false,
      message: "That creature isn't here.",
      combatId: null,
    };
  }

  // Add monster to combat
  combat.participants.set(monsterInstanceId, monsterParticipant);
  monsterCombatMap.set(monsterInstanceId, combat.id);

  // Create target set for this monster
  combat.monsterTargets.set(monsterInstanceId, new Set([playerId]));

  // Start attack timer for monster attacking player
  scheduleAttack(combat, monsterInstanceId, playerId);

  const playerParticipant = combat.participants.get(playerId);
  const playerName = playerParticipant?.name || "You";

  broadcast(roomId, {
    type: "combat_start",
    attackerName: monsterParticipant.name,
    defenderName: playerName,
  });

  return {
    success: true,
    message: `The ${monsterParticipant.name} joins the fight!`,
    combatId: combat.id,
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

/** Optional feat modifiers for attack resolution */
type FeatModifiers = {
  attackBonus: number;
  damageBonus: number;
};

/**
 * Process a single attack from attacker to defender
 * @param attacker - The attacking participant
 * @param defender - The defending participant
 * @param featMods - Optional feat modifiers (attack and damage bonuses)
 * @returns Attack result with hit/miss, damage, and messages
 */
export function processAttack(
  attacker: CombatParticipant,
  defender: CombatParticipant,
  featMods?: FeatModifiers,
): AttackResult {
  // Calculate BAB from level
  const bab = calculateBAB(attacker.level);

  // Use STR for melee, DEX for ranged
  const attackStat =
    attacker.weaponRange === "ranged" ? attacker.stats.dex : attacker.stats.str;
  const attackStatMod = getStatModifier(attackStat);

  // Roll d20 + BAB + STR/DEX modifier + feat attack bonus
  const attackBonus = featMods?.attackBonus ?? 0;
  const totalAttackMod = bab + attackStatMod + attackBonus;
  const attackResult = rollD20WithDetails(totalAttackMod);

  const hit = attackResult.total >= defender.ac;

  if (!hit) {
    return {
      hit: false,
      attackRoll: attackResult.total,
      targetAC: defender.ac,
      damage: null,
      defenderHp: defender.currentHp,
      defenderDead: false,
      message: `${attacker.name} swings at ${defender.name} but misses!`,
      rollInfo: `Attack: ${attackResult.formula}`,
    };
  }

  // Calculate damage: weapon dice + STR modifier + feat damage bonus, minimum 1
  const weaponNotation = attacker.weaponDamage || "1d4";
  const damageResult = rollDamageWithDetails(weaponNotation);
  const strMod = getDamageModifier(attacker.stats.str);
  const damageBonus = featMods?.damageBonus ?? 0;
  const rawDamage = (damageResult?.total || 1) + strMod + damageBonus;
  const damage = Math.max(1, rawDamage);

  // Build damage formula string with modifiers
  const totalDamageMod = strMod + damageBonus;
  let damageFormula: string;
  if (totalDamageMod === 0) {
    damageFormula = `${weaponNotation} = ${damage}`;
  } else {
    const modStr =
      totalDamageMod >= 0 ? `+${totalDamageMod}` : `${totalDamageMod}`;
    damageFormula = `${weaponNotation}${modStr} = ${damage}`;
  }

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
    attackRoll: attackResult.total,
    targetAC: defender.ac,
    damage,
    defenderHp: Math.max(0, newHp),
    defenderDead,
    message,
    rollInfo: `Attack: ${attackResult.formula}  |  Damage: ${damageFormula}`,
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

    // Get feat modifiers for player attackers
    let featMods: { attackBonus: number; damageBonus: number } | undefined;
    if (currentAttacker.type === "player") {
      const attackMods = await getAttackModifiers(attackerId);

      // Get weapon range for damage modifiers
      const equipped = await getEquippedItems(attackerId);
      const weapon = equipped.find((item) => item.weaponDamage);
      const weaponRange =
        (weapon?.weaponRange as "melee" | "ranged") ?? "melee";

      const damageMods = await getDamageModifiers(attackerId, weaponRange);

      featMods = {
        attackBonus: attackMods.stance,
        damageBonus: damageMods.stance,
      };
    }

    // Process the attack with feat modifiers
    const result = processAttack(currentAttacker, currentDefender, featMods);

    // Update defender HP in combat state
    currentDefender.currentHp = result.defenderHp;

    // Broadcast attack result (include attacker ID for roll info delivery)
    broadcast(currentCombat.roomId, {
      type: "attack",
      message: result.message,
      attackerId: currentAttacker.type === "player" ? attackerId : undefined,
      defenderId: currentDefender.type === "player" ? defenderId : undefined,
      defenderType: currentDefender.type,
      hit: result.hit,
      rollInfo: result.rollInfo,
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

    // If monster-initiated (aggro), allow monster to join existing combat
    if (monsterInitiated && existingCombat) {
      return addMonsterToCombat(
        existingCombat,
        playerId,
        monsterInstanceId,
        roomId,
      );
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

    broadcast(
      roomId,
      {
        type: "combat_start",
        attackerName: playerParticipant.name,
        defenderName: monsterParticipant.name,
      },
      playerId,
    );

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

  broadcast(
    roomId,
    {
      type: "combat_start",
      attackerName: playerParticipant.name,
      defenderName: monsterParticipant.name,
    },
    playerId,
  );

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
 * Remove a dead monster from combat, keeping players in combat with remaining monsters
 * @param combat - The combat instance
 * @param monsterInstanceId - The dead monster's ID
 */
function removeMonsterFromCombat(
  combat: ActiveCombat,
  monsterInstanceId: string,
): void {
  // Get players who were fighting this monster
  const targets = combat.monsterTargets.get(monsterInstanceId);
  if (!targets) return;

  // Clear monster's attack timer
  const monsterTimer = combat.attackTimers.get(monsterInstanceId);
  if (monsterTimer) {
    clearTimeout(monsterTimer);
    combat.attackTimers.delete(monsterInstanceId);
  }

  // For each player fighting this monster, check if they have other monsters to fight
  for (const playerId of targets) {
    // Clear player's attack timer for this specific monster
    // (player may have multiple attack timers if fighting multiple monsters)
    const playerTimer = combat.attackTimers.get(playerId);
    if (playerTimer) {
      clearTimeout(playerTimer);
      combat.attackTimers.delete(playerId);
    }

    // Check if player is fighting any other monsters
    let hasOtherMonsters = false;
    for (const [otherId, otherTargets] of combat.monsterTargets) {
      if (otherId !== monsterInstanceId && otherTargets.has(playerId)) {
        hasOtherMonsters = true;
        // Reschedule player's attack against remaining monster
        scheduleAttack(combat, playerId, otherId);
        break;
      }
    }

    // If player has no other monsters to fight, end their combat
    if (!hasOtherMonsters) {
      combat.participants.delete(playerId);
      playerCombatMap.delete(playerId);
    }
  }

  // Remove monster from combat
  combat.participants.delete(monsterInstanceId);
  combat.monsterTargets.delete(monsterInstanceId);
  monsterCombatMap.delete(monsterInstanceId);

  // Clean up combat if empty
  if (combat.participants.size === 0) {
    cleanupCombat(combat.id);
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
      message: `You try to flee but can't escape!`,
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
      wornBack: null,
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
 * Handle monster death - award XP, check for level up, remove monster, end combat
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

  // Get killer for XP calculation
  const killer = await db
    .select()
    .from(players)
    .where(eq(players.id, killerPlayerId))
    .get();

  if (killer) {
    // Calculate XP based on level difference (PF2e style)
    const xpReward = calculateXpReward(monster.level, killer.level);
    const newXp = killer.xp + xpReward;

    // Check for level up
    const levelUpResult = checkLevelUp(newXp, killer.level);

    if (levelUpResult.shouldLevel) {
      // Level up! Update XP, level, and grant attribute points
      const newUnspentPoints =
        (killer.unspentAttributePoints ?? 0) + levelUpResult.attributePoints;

      // Get equipment CON bonus for max HP calculation
      const equipped = await getEquippedItems(killerPlayerId);
      const equipConBonus = calculateEquipmentConBonus(equipped);
      const totalCon = killer.con + equipConBonus;

      // Calculate new max HP based on new level (with feat bonuses)
      const newMaxHp = await calculateMaxHp(
        levelUpResult.newLevel,
        totalCon,
        killerPlayerId,
      );

      // Heal the HP gained from leveling (difference between old and new max)
      const hpGained = newMaxHp - killer.maxHp;
      const newCurrentHp = killer.currentHp + hpGained;

      await db
        .update(players)
        .set({
          xp: levelUpResult.newXp,
          level: levelUpResult.newLevel,
          unspentAttributePoints: newUnspentPoints,
          maxHp: newMaxHp,
          currentHp: newCurrentHp,
        })
        .where(eq(players.id, killerPlayerId));

      // Grant feat slot on even levels (2, 4, 6, 8, ...)
      const gainedFeatSlot = levelUpResult.newLevel % 2 === 0;
      if (gainedFeatSlot) {
        await grantFeatSlot(killerPlayerId);
      }

      // Broadcast level up
      if (roomId) {
        broadcast(roomId, {
          type: "level_up",
          playerId: killerPlayerId,
          playerName: killer.name,
          newLevel: levelUpResult.newLevel,
          attributePoints: levelUpResult.attributePoints,
          gainedFeatSlot,
        });
      }
    } else {
      // Just award XP
      await db
        .update(players)
        .set({ xp: newXp })
        .where(eq(players.id, killerPlayerId));
    }

    // Broadcast monster death with actual XP awarded
    if (roomId) {
      broadcast(roomId, {
        type: "monster_death",
        monsterName: monster.name,
        killerName: killer.name,
        killerId: killerPlayerId,
        xpAwarded: xpReward,
      });
    }
  }

  // Remove monster from combat, keeping players in combat with remaining monsters
  if (combat) {
    removeMonsterFromCombat(combat, monsterInstanceId);
  }

  // Remove monster instance from database
  await db
    .delete(monsterInstances)
    .where(eq(monsterInstances.id, monsterInstanceId));
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

/** Minimum delay before first monster attacks (ms) */
const AGGRO_INITIAL_DELAY_MIN = 3000;
/** Maximum delay before first monster attacks (ms) */
const AGGRO_INITIAL_DELAY_MAX = 5000;
/** Minimum delay between subsequent monster attacks (ms) */
const AGGRO_STAGGER_DELAY_MIN = 3000;
/** Maximum delay between subsequent monster attacks (ms) */
const AGGRO_STAGGER_DELAY_MAX = 5000;

/**
 * Generate a random delay within a range
 * @param min - Minimum delay in ms
 * @param max - Maximum delay in ms
 * @returns Random delay between min and max
 */
function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Clear pending aggro timers for a player (called when they leave the room)
 * @param playerId - The player whose timers to clear
 */
export function clearPendingAggro(playerId: string): void {
  const timers = pendingAggroTimers.get(playerId);
  if (timers) {
    for (const timer of timers) {
      clearTimeout(timer);
    }
    pendingAggroTimers.delete(playerId);
  }
}

/**
 * Check and trigger monster aggro when player enters room.
 * Aggressive monsters attack with staggered timing:
 * - First monster attacks after 3-5 seconds
 * - Additional monsters join every 3-5 seconds after that
 * @param playerId - The entering player's ID
 * @param roomId - The room being entered
 */
export async function checkMonsterAggro(
  playerId: string,
  roomId: string,
): Promise<void> {
  // Clear any existing pending aggro timers for this player
  clearPendingAggro(playerId);

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

  // Shuffle monsters for random attack order
  const shuffled = [...aggressiveMonsters].sort(() => Math.random() - 0.5);

  // Schedule staggered attacks
  const timers: NodeJS.Timeout[] = [];
  let cumulativeDelay = randomDelay(
    AGGRO_INITIAL_DELAY_MIN,
    AGGRO_INITIAL_DELAY_MAX,
  );

  for (const attacker of shuffled) {
    const monsterInstanceId = attacker.monster_instances.id;
    const delay = cumulativeDelay;

    const timer = setTimeout(async () => {
      // Re-check player is still in room
      const currentPlayer = await db
        .select()
        .from(players)
        .where(eq(players.id, playerId))
        .get();

      if (currentPlayer?.currentRoomId !== roomId) {
        return; // Player left the room
      }

      // Check if monster is still available (not already in combat or dead)
      if (isMonsterInCombat(monsterInstanceId)) {
        return;
      }

      // Initiate combat - this now handles both new combat and joining existing
      await initiateCombat(playerId, monsterInstanceId, roomId, true);
    }, delay);

    timers.push(timer);

    // Add stagger delay for next monster
    cumulativeDelay += randomDelay(
      AGGRO_STAGGER_DELAY_MIN,
      AGGRO_STAGGER_DELAY_MAX,
    );
  }

  // Store timers for cleanup if player leaves
  pendingAggroTimers.set(playerId, timers);
}
