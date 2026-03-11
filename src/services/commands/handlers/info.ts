/**
 * Info command handlers.
 */

import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { players } from "../../../db/schema.js";
import type { CommandContext, CommandResult } from "../../../types/command.js";
import * as RoomService from "../../RoomService.js";
import { COMMAND_ALIASES } from "../aliases.js";
import { COMMAND_REGISTRY } from "../registry.js";
import { Command } from "../types.js";

/**
 * Handle look command
 */
export async function handleLook(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player, room } = context;

  // If there's a target, redirect to examine
  if (args.length > 0) {
    // Strip "at" if present (e.g., "look at sword")
    const targetArgs = args[0] === "at" ? args.slice(1) : args;
    const target = targetArgs.join(" ");

    if (target) {
      // Import dynamically to avoid circular dependency
      const { handleExamine } = await import("./items.js");
      return handleExamine(targetArgs, context);
    }
  }

  // Get fresh room data (include player's personal discoveries)
  const roomData = await RoomService.getRoomWithContents(room.id, player.id);
  if (!roomData) {
    return { success: false, message: "You are nowhere." };
  }

  // Send room data to client - client handles formatting
  return {
    success: true,
    broadcast: [
      {
        event: "room:look",
        room: `player:${player.id}`,
        data: { room: roomData },
      },
    ],
  };
}

/**
 * Format a stat value with its equipment bonus.
 * @param baseStat - The base stat value
 * @param bonus - The equipment bonus (can be positive or negative)
 * @returns Formatted string like "12 (+2)" or "10" if no bonus
 */
function formatStatWithBonus(baseStat: number, bonus: number): string {
  if (bonus === 0) {
    return String(baseStat + bonus);
  }
  const sign = bonus > 0 ? "+" : "";
  return `${baseStat + bonus} (${sign}${bonus})`;
}

/**
 * Handle stats command
 */
export async function handleStats(
  _args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player } = context;

  // Fetch fresh player data from database to get current HP/XP
  const freshPlayer = await db
    .select()
    .from(players)
    .where(eq(players.id, player.id))
    .get();

  if (!freshPlayer) {
    return { success: false, message: "Player not found." };
  }

  // Get equipment bonuses
  const { getEquipmentStatBonuses } = await import("../../items/equipment.js");
  const { totals, bonuses } = await getEquipmentStatBonuses(player.id);

  // Calculate CON HP bonus for display
  const { calculateConHpBonus } = await import("../../StatService.js");
  const totalCon = freshPlayer.con + totals.con;
  const conHpBonus = calculateConHpBonus(freshPlayer.level, totalCon);

  // Get active stance
  const { getActiveStance } = await import("../../FeatService.js");
  const activeStance = await getActiveStance(player.id);

  const strDisplay = formatStatWithBonus(freshPlayer.str, totals.str);
  const dexDisplay = formatStatWithBonus(freshPlayer.dex, totals.dex);
  const conDisplay = formatStatWithBonus(freshPlayer.con, totals.con);
  const intDisplay = formatStatWithBonus(freshPlayer.int, totals.int);
  const wisDisplay = formatStatWithBonus(freshPlayer.wis, totals.wis);
  const chaDisplay = formatStatWithBonus(freshPlayer.cha, totals.cha);

  // Format HP with CON bonus in parentheses if non-zero
  const hpDisplay =
    conHpBonus !== 0
      ? `HP: ${freshPlayer.currentHp}/${freshPlayer.maxHp} (${conHpBonus > 0 ? "+" : ""}${conHpBonus} from CON)`
      : `HP: ${freshPlayer.currentHp}/${freshPlayer.maxHp}`;

  // Calculate AC with breakdown
  const { calculateAC, getStatModifier, calculateEquipmentACBonus } =
    await import("../../StatService.js");
  const { getEquippedItems } = await import("../../items/equipment.js");
  const { getACModifiers } = await import("../../FeatEffectHandler.js");

  const equipped = await getEquippedItems(player.id);
  const equipACBonus = calculateEquipmentACBonus(equipped);
  const ac = await calculateAC(freshPlayer.dex, equipACBonus, player.id);
  const acMods = await getACModifiers(player.id);
  const dexMod = getStatModifier(freshPlayer.dex);

  // Build AC breakdown parts
  const acParts: string[] = [];
  if (dexMod !== 0) {
    acParts.push(`${dexMod > 0 ? "+" : ""}${dexMod} DEX`);
  }
  if (equipACBonus !== 0) {
    acParts.push(`${equipACBonus > 0 ? "+" : ""}${equipACBonus} armor`);
  }
  if (acMods.dodge !== 0) {
    acParts.push(`${acMods.dodge > 0 ? "+" : ""}${acMods.dodge} dodge`);
  }
  if (acMods.stance !== 0) {
    acParts.push(`${acMods.stance > 0 ? "+" : ""}${acMods.stance} stance`);
  }

  const acDisplay =
    acParts.length > 0 ? `AC: ${ac} (${acParts.join(", ")})` : `AC: ${ac}`;

  // Calculate attack and damage bonuses
  const { calculateBAB } = await import("../../FeatService.js");
  const { getAttackModifiers, getDamageModifiers } =
    await import("../../FeatEffectHandler.js");

  const bab = calculateBAB(freshPlayer.level);
  const strMod = getStatModifier(freshPlayer.str + totals.str);
  const featAttackMods = await getAttackModifiers(player.id);

  // Get main hand and off hand weapons
  const mainHandItem = equipped.find((e) => e.slot === "mainHand");
  const offHandItem = equipped.find((e) => e.slot === "offHand");
  const isDualWielding =
    mainHandItem?.weaponDamage && offHandItem?.weaponDamage;

  // Check if mainHand weapon is ranged to determine attack stat
  const isRanged = mainHandItem?.weaponRange === "ranged";
  const weaponType = isRanged ? "ranged" : "melee";

  // Use appropriate stat for attack (DEX for ranged, STR for melee)
  const attackStatMod = isRanged
    ? getStatModifier(freshPlayer.dex + totals.dex)
    : strMod;
  const attackStatName = isRanged ? "DEX" : "STR";

  const featDamageMods = await getDamageModifiers(player.id, weaponType);

  // Calculate feat totals
  const featAttackTotal = featAttackMods.stance;
  const featDamageTotal = featDamageMods.stance;

  // Dual wield penalty constant
  const DUAL_WIELD_PENALTY = -4;

  let attackDisplay: string;
  let damageDisplay: string;

  if (isDualWielding) {
    // Show per-weapon stats for dual wielding
    const mainAttackBonus = mainHandItem?.attackBonus ?? 0;
    const mainDamageBonus = mainHandItem?.damageBonus ?? 0;
    const offAttackBonus = offHandItem?.attackBonus ?? 0;
    const offDamageBonus = offHandItem?.damageBonus ?? 0;

    // Calculate totals for each hand (including dual wield penalty)
    const mainTotalAttack =
      bab +
      attackStatMod +
      mainAttackBonus +
      featAttackTotal +
      DUAL_WIELD_PENALTY;
    const offTotalAttack =
      bab +
      attackStatMod +
      offAttackBonus +
      featAttackTotal +
      DUAL_WIELD_PENALTY;
    const mainTotalDamage = strMod + mainDamageBonus + featDamageTotal;
    const offTotalDamage = strMod + offDamageBonus + featDamageTotal;

    const mainAttackSign = mainTotalAttack >= 0 ? "+" : "";
    const offAttackSign = offTotalAttack >= 0 ? "+" : "";
    const mainDamageSign = mainTotalDamage >= 0 ? "+" : "";
    const offDamageSign = offTotalDamage >= 0 ? "+" : "";

    attackDisplay = `Attack: ${mainAttackSign}${mainTotalAttack}/${offAttackSign}${offTotalAttack} (dual wield -4)`;
    damageDisplay = `Damage: ${mainDamageSign}${mainTotalDamage}/${offDamageSign}${offTotalDamage}`;
  } else {
    // Single weapon or unarmed - show combined stats
    const equipAttackBonus = mainHandItem?.attackBonus ?? 0;
    const equipDamageBonus = mainHandItem?.damageBonus ?? 0;

    // Build attack bonus breakdown
    const totalAttackBonus =
      bab + attackStatMod + equipAttackBonus + featAttackTotal;
    const attackParts: string[] = [];
    if (bab !== 0) attackParts.push(`${bab > 0 ? "+" : ""}${bab} BAB`);
    if (attackStatMod !== 0)
      attackParts.push(
        `${attackStatMod > 0 ? "+" : ""}${attackStatMod} ${attackStatName}`,
      );
    if (equipAttackBonus !== 0)
      attackParts.push(
        `${equipAttackBonus > 0 ? "+" : ""}${equipAttackBonus} equip`,
      );
    if (featAttackTotal !== 0)
      attackParts.push(
        `${featAttackTotal > 0 ? "+" : ""}${featAttackTotal} feat`,
      );

    const attackSign = totalAttackBonus >= 0 ? "+" : "";
    attackDisplay =
      attackParts.length > 0
        ? `Attack: ${attackSign}${totalAttackBonus} (${attackParts.join(", ")})`
        : `Attack: ${attackSign}${totalAttackBonus}`;

    // Build damage bonus breakdown
    const totalDamageBonus = strMod + equipDamageBonus + featDamageTotal;
    const damageParts: string[] = [];
    if (strMod !== 0) damageParts.push(`${strMod > 0 ? "+" : ""}${strMod} STR`);
    if (equipDamageBonus !== 0)
      damageParts.push(
        `${equipDamageBonus > 0 ? "+" : ""}${equipDamageBonus} equip`,
      );
    if (featDamageTotal !== 0)
      damageParts.push(
        `${featDamageTotal > 0 ? "+" : ""}${featDamageTotal} feat`,
      );

    const damageSign = totalDamageBonus >= 0 ? "+" : "";
    damageDisplay =
      damageParts.length > 0
        ? `Damage: ${damageSign}${totalDamageBonus} (${damageParts.join(", ")})`
        : `Damage: ${damageSign}${totalDamageBonus}`;
  }

  const lines = [
    `${freshPlayer.name} - Level ${freshPlayer.level}`,
    `${hpDisplay}  ${acDisplay}  XP: ${freshPlayer.xp}`,
    `${attackDisplay}  ${damageDisplay}`,
    `STR: ${strDisplay}  DEX: ${dexDisplay}  CON: ${conDisplay}`,
    `INT: ${intDisplay}  WIS: ${wisDisplay}  CHA: ${chaDisplay}`,
  ];

  // Add active stance if any
  if (activeStance) {
    lines.push(`Stance: ${activeStance.name} (use "stance off" to deactivate)`);
  }

  // Add equipment bonuses section if any exist
  const statBonuses = bonuses.filter((b) => b.stat !== "hp");
  if (statBonuses.length > 0) {
    lines.push("");
    lines.push("Equipment Bonuses:");
    for (const bonus of statBonuses) {
      const sign = bonus.amount > 0 ? "+" : "";
      lines.push(
        `  ${sign}${bonus.amount} ${bonus.stat.toUpperCase()} from ${bonus.itemName}`,
      );
    }
  }

  return { success: true, message: lines.join("\n") };
}

/**
 * Handle help command
 */
export async function handleHelp(
  args: string[],
  _context: CommandContext,
): Promise<CommandResult> {
  if (args.length === 0) {
    // General help - list all commands (excluding admin-only)
    const lines = ["Available commands:", ""];

    for (const cmd of Object.values(Command)) {
      const def = COMMAND_REGISTRY[cmd];
      if (def.adminOnly) continue;

      const aliasStr =
        def.help.aliases.length > 0
          ? ` (${def.help.aliases.slice(0, 3).join(", ")}${def.help.aliases.length > 3 ? "..." : ""})`
          : "";
      lines.push(`  ${cmd}${aliasStr} - ${def.help.summary}`);
    }

    lines.push("");
    lines.push('Type "help <command>" for details on a specific command.');
    return { success: true, message: lines.join("\n") };
  }

  // Specific command help
  const topic = args[0].toLowerCase();
  const command = COMMAND_ALIASES[topic];

  if (!command) {
    return { success: false, message: `Unknown command: ${topic}` };
  }

  const def = COMMAND_REGISTRY[command];

  // Hide admin-only commands from help lookups
  if (def.adminOnly) {
    return { success: false, message: `Unknown command: ${topic}` };
  }

  const lines = [
    `${command} - ${def.help.summary}`,
    "",
    "Usage:",
    ...def.help.usage.map((u) => `  ${u}`),
    "",
    `Aliases: ${def.help.aliases.join(", ") || "none"}`,
    "",
    "Examples:",
    ...def.help.examples.map((ex) => `  ${ex}`),
  ];

  return { success: true, message: lines.join("\n") };
}
