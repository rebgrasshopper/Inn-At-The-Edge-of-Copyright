/**
 * Magic command handlers for spellcasting.
 */

import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { monsterInstances, players } from "../../../db/schema.js";
import type { CommandContext, CommandResult } from "../../../types/command.js";
import * as CombatService from "../../CombatService.js";
import { rollD20WithDetails } from "../../DiceService.js";
import { resolveEntity } from "../../EntityResolver.js";
import { calculateBAB } from "../../FeatService.js";
import * as SpellService from "../../SpellService.js";
import { calculateAC, getStatModifier } from "../../StatService.js";

/** Spell attack accuracy bonus (makes spells more likely to hit than physical attacks) */
const SPELL_ATTACK_BONUS = 5;

/**
 * Handle cast command - cast a spell on a target
 * @param args - Spell name and optional target
 * @param context - Command context with player and room
 * @param _rawInput - Original raw input string (unused)
 * @returns Command result with spell effect
 */
export async function handleCast(
  args: string[],
  context: CommandContext,
  _rawInput: string,
): Promise<CommandResult> {
  const { player, room } = context;

  if (args.length === 0) {
    return {
      success: false,
      message: "Cast what? Usage: cast <spell> [target]",
    };
  }

  // Parse spell name and target
  // Support "cast bolt goblin" or "cast arcane bolt goblin" or "cast mend" or "cast mend player"
  const spellName = args[0];
  const targetName = args.slice(1).join(" ") || null;

  // Find the spell
  const spell = await SpellService.getSpellByName(spellName);
  if (!spell) {
    return {
      success: false,
      message: `You don't know a spell called "${spellName}".`,
    };
  }

  // Check if player knows this spell
  const playerSpell = await SpellService.getPlayerSpell(player.id, spell.id);
  if (!playerSpell) {
    return {
      success: false,
      message: `You haven't learned ${spell.name} yet.`,
    };
  }

  // Get player's current mana
  const playerData = await db
    .select({ mana: players.mana, int: players.int, level: players.level })
    .from(players)
    .where(eq(players.id, player.id))
    .get();

  if (!playerData) {
    return { success: false, message: "Player data not found." };
  }

  // Check mana
  if (playerData.mana < spell.manaCost) {
    return {
      success: false,
      message: `Not enough mana. ${spell.name} costs ${spell.manaCost} mana, you have ${playerData.mana}.`,
    };
  }

  const intMod = getStatModifier(playerData.int);

  // Check for spell failure (proficiency)
  const failed = SpellService.checkSpellFailure(playerSpell.successfulCasts);
  if (failed) {
    // Deduct half mana on failure
    const halfCost = Math.ceil(spell.manaCost / 2);
    await SpellService.deductMana(player.id, halfCost);

    const failureChance = SpellService.calculateFailureChance(
      playerSpell.successfulCasts,
    );
    return {
      success: true,
      message: `You attempt to cast ${spell.name}, but the spell fizzles! (${failureChance}% failure chance, ${halfCost} mana lost)`,
    };
  }

  // Deduct full mana
  await SpellService.deductMana(player.id, spell.manaCost);

  // Increment successful casts
  await SpellService.incrementSuccessfulCasts(player.id, spell.id);

  // Handle spell effect based on type
  if (!spell.effect) {
    return {
      success: true,
      message: `You cast ${spell.name}. (${spell.manaCost} mana)`,
    };
  }

  const effect = spell.effect;

  // Damage spell
  if (effect.type === "damage") {
    return handleDamageSpell(
      spell,
      effect,
      targetName,
      player,
      room,
      playerData.level,
      intMod,
    );
  }

  // Healing spell
  if (effect.type === "heal") {
    return handleHealingSpell(spell, effect, targetName, player, room, intMod);
  }

  // Other spell types (light, shield, etc.) - placeholder for future
  return {
    success: true,
    message: `You cast ${spell.name}. (${spell.manaCost} mana)`,
  };
}

/**
 * Handle a damage spell cast
 */
async function handleDamageSpell(
  spell: typeof import("../../../db/schema.js").spells.$inferSelect,
  effect: { type: "damage"; dice: string; modifier?: "int" },
  targetName: string | null,
  player: CommandContext["player"],
  room: CommandContext["room"],
  casterLevel: number,
  intMod: number,
): Promise<CommandResult> {
  if (!targetName) {
    return { success: false, message: `Cast ${spell.name} at what?` };
  }

  // Check if already in combat
  if (CombatService.isPlayerInCombat(player.id)) {
    return {
      success: false,
      message: "You can't cast while in combat! (Use physical attacks or flee)",
    };
  }

  // Find target monster
  const result = await resolveEntity(room.id, targetName, ["monster"]);

  if (result.status === "not_found") {
    return { success: false, message: `You don't see "${targetName}" here.` };
  }

  if (result.status === "wrong_type") {
    return {
      success: false,
      message: `You can't attack the ${result.name} with magic.`,
    };
  }

  const monsterRecord = result.entity as {
    monster_instances: { id: string; currentHp: number };
    monsters: { id: string; name: string; maxHp: number; dex: number };
  };

  const monsterInstanceId = monsterRecord.monster_instances.id;
  const monsterName = monsterRecord.monsters.name;

  // Get monster's AC (10 + DEX mod, no equipment)
  const monsterAC = await calculateAC(monsterRecord.monsters.dex, 0);

  // Spell attack roll: d20 + BAB + INT mod + 5 (spell accuracy bonus)
  const bab = calculateBAB(casterLevel);
  const totalAttackMod = bab + intMod + SPELL_ATTACK_BONUS;
  const attackResult = rollD20WithDetails(totalAttackMod);

  // Natural 20 always hits, natural 1 always misses
  const isNatural20 = attackResult.roll === 20;
  const isNatural1 = attackResult.roll === 1;
  const hit = isNatural1
    ? false
    : isNatural20
      ? true
      : attackResult.total >= monsterAC;

  if (!hit) {
    // Miss - still initiate combat (monster retaliates)
    const combatResult = await CombatService.initiateCombat(
      player.id,
      monsterInstanceId,
      room.id,
    );

    return {
      success: true,
      message: `Your ${spell.name} misses the ${monsterName}! ${combatResult.message}`,
      rollInfo: `Attack: ${attackResult.formula}`,
      broadcast: [
        {
          event: "spell:cast",
          room: room.id,
          data: {
            casterName: player.name,
            spellName: spell.name,
            targetName: monsterName,
            damage: 0,
            targetDead: false,
            missed: true,
          },
          excludeSender: true,
        },
      ],
    };
  }

  // Hit - calculate damage
  const missileCount = SpellService.calculateMissileCount(
    casterLevel,
    spell.scalingLevel,
  );
  const { total: damage, rollInfo: damageRollInfo } =
    SpellService.calculateSpellDamage(effect, intMod, missileCount);

  // Apply damage to monster
  const newHp = Math.max(0, monsterRecord.monster_instances.currentHp - damage);
  const monsterDead = newHp <= 0;

  await db
    .update(monsterInstances)
    .set({ currentHp: newHp })
    .where(eq(monsterInstances.id, monsterInstanceId));

  // Build roll info string
  const rollInfo = `Attack: ${attackResult.formula}  |  ${damageRollInfo}`;

  // Build broadcasts
  const broadcasts = [
    {
      event: "spell:cast",
      room: room.id,
      data: {
        casterName: player.name,
        spellName: spell.name,
        targetName: monsterName,
        damage,
        targetDead: monsterDead,
      },
      excludeSender: true,
    },
  ];

  // Handle monster death or initiate combat
  if (monsterDead) {
    // Award XP and cleanup via CombatService
    await CombatService.handleMonsterDeath(monsterInstanceId, player.id);

    return {
      success: true,
      message: `Your ${spell.name} strikes the ${monsterName} for ${damage} damage, defeating it!`,
      rollInfo,
      broadcast: broadcasts,
    };
  }

  // Monster survived - initiate combat (monster retaliates)
  const combatResult = await CombatService.initiateCombat(
    player.id,
    monsterInstanceId,
    room.id,
  );

  // Build message with combat initiation
  const message = `Your ${spell.name} strikes the ${monsterName} for ${damage} damage! (${newHp}/${monsterRecord.monsters.maxHp} HP) ${combatResult.message}`;

  return {
    success: true,
    message,
    rollInfo,
    broadcast: broadcasts,
  };
}

/**
 * Handle a healing spell cast
 */
async function handleHealingSpell(
  spell: typeof import("../../../db/schema.js").spells.$inferSelect,
  effect: { type: "heal"; dice: string; modifier?: "int" },
  targetName: string | null,
  player: CommandContext["player"],
  room: CommandContext["room"],
  intMod: number,
): Promise<CommandResult> {
  // Determine target - self if no target specified
  let targetId = player.id;
  let targetPlayerName = player.name;
  let isSelf = true;

  if (
    targetName &&
    targetName.toLowerCase() !== "self" &&
    targetName.toLowerCase() !== player.name.toLowerCase()
  ) {
    // Find target player in room
    const result = await resolveEntity(room.id, targetName, ["player"]);

    if (result.status === "not_found") {
      return { success: false, message: `You don't see "${targetName}" here.` };
    }

    if (result.status === "wrong_type") {
      return { success: false, message: `You can't heal the ${result.name}.` };
    }

    const targetPlayer = result.entity as { id: string; name: string };
    targetId = targetPlayer.id;
    targetPlayerName = targetPlayer.name;
    isSelf = false;
  }

  // Get target's current HP
  const targetData = await db
    .select({ currentHp: players.currentHp, maxHp: players.maxHp })
    .from(players)
    .where(eq(players.id, targetId))
    .get();

  if (!targetData) {
    return { success: false, message: "Target not found." };
  }

  // Calculate healing
  const { total: healing, rollInfo } = SpellService.calculateSpellHealing(
    effect,
    intMod,
  );

  // Apply healing (cap at max HP)
  const newHp = Math.min(targetData.maxHp, targetData.currentHp + healing);
  const actualHealing = newHp - targetData.currentHp;

  await db
    .update(players)
    .set({ currentHp: newHp })
    .where(eq(players.id, targetId));

  // Build message
  let message: string;
  if (isSelf) {
    if (actualHealing === 0) {
      message = `You cast ${spell.name} on yourself, but you're already at full health.`;
    } else {
      message = `You cast ${spell.name} on yourself, healing ${actualHealing} HP. (${newHp}/${targetData.maxHp} HP)`;
    }
  } else {
    if (actualHealing === 0) {
      message = `You cast ${spell.name} on ${targetPlayerName}, but they're already at full health.`;
    } else {
      message = `You cast ${spell.name} on ${targetPlayerName}, healing ${actualHealing} HP.`;
    }
  }

  // Build broadcasts
  const broadcasts = [
    {
      event: "spell:cast",
      room: room.id,
      data: {
        casterName: player.name,
        spellName: spell.name,
        targetName: targetPlayerName,
        healing: actualHealing,
        isSelf,
      },
      excludeSender: true,
    },
  ];

  return {
    success: true,
    message,
    rollInfo,
    broadcast: broadcasts,
  };
}
