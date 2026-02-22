import type {
  CommandContext,
  CommandResult,
  ParsedCommand,
} from "../types/command.js";
import type { Direction } from "../types/room.js";
import * as ChatService from "./ChatService.js";
import * as FeatureService from "./FeatureService.js";
import * as ItemService from "./ItemService.js";
import * as RoomService from "./RoomService.js";

// Articles to strip from input
const ARTICLES = ["the", "a", "an"];

// Direction aliases
const DIRECTION_MAP: Record<string, Direction> = {
  north: "north",
  n: "north",
  south: "south",
  s: "south",
  east: "east",
  e: "east",
  west: "west",
  w: "west",
  up: "up",
  u: "up",
  down: "down",
  d: "down",
};

// Movement verbs (direction can follow)
const MOVEMENT_VERBS = ["go", "walk", "move", "exit", "leave"];

// Chat verbs
const CHAT_VERBS: Record<string, string> = {
  say: "speak",
  speak: "speak",
  talk: "speak",
  shout: "shout",
  yell: "shout",
  whisper: "whisper",
  tell: "whisper",
  emote: "emote",
  me: "emote",
};

// Item verbs
const ITEM_VERBS: Record<string, string> = {
  get: "get",
  take: "get",
  grab: "get",
  pick: "get",
  drop: "drop",
  put: "drop",
  examine: "examine",
  inspect: "examine",
  inventory: "inventory",
  inv: "inventory",
  i: "inventory",
  equip: "equip",
  wear: "equip",
  wield: "equip",
  unequip: "unequip",
  remove: "unequip",
  unwear: "unequip",
  equipment: "equipment",
  eq: "equipment",
  gear: "equipment",
};

// Combat verbs
const COMBAT_VERBS: Record<string, string> = {
  attack: "attack",
  fight: "attack",
  kill: "attack",
  hit: "attack",
  strike: "attack",
};

// Info verbs
const INFO_VERBS: Record<string, string> = {
  look: "look",
  l: "look",
  stats: "stats",
  stat: "stats",
  score: "stats",
  help: "help",
  "?": "help",
};

// All known verbs for suggestion matching
const ALL_VERBS = [
  ...Object.keys(DIRECTION_MAP),
  ...MOVEMENT_VERBS,
  ...Object.keys(CHAT_VERBS),
  ...Object.keys(ITEM_VERBS),
  ...Object.keys(COMBAT_VERBS),
  ...Object.keys(INFO_VERBS),
];

/**
 * Tokenize input: lowercase, split on whitespace, strip articles
 * @param input - Raw user input string
 * @returns Array of tokens with articles removed
 */
export function tokenize(input: string): string[] {
  const tokens = input
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  // Strip articles
  return tokens.filter((t) => !ARTICLES.includes(t));
}

/**
 * Extract quantity from tokens if present (e.g., "get 3 coins" or "get all coins")
 * @param tokens - Array of tokens
 * @returns Object with quantity (or undefined) and remaining tokens
 */
export function extractQuantity(tokens: string[]): {
  quantity: number | "all" | undefined;
  tokens: string[];
} {
  if (tokens.length < 2) {
    return { quantity: undefined, tokens };
  }

  const second = tokens[1];

  // Check for "all"
  if (second === "all") {
    return { quantity: "all", tokens: [tokens[0], ...tokens.slice(2)] };
  }

  // Check for numeric quantity
  const num = parseInt(second, 10);
  if (!isNaN(num) && num > 0) {
    return { quantity: num, tokens: [tokens[0], ...tokens.slice(2)] };
  }

  return { quantity: undefined, tokens };
}

/**
 * Find the closest matching verb for suggestions
 * @param input - The unrecognized verb
 * @returns The closest matching verb or null
 */
export function findSimilarVerb(input: string): string | null {
  const inputLower = input.toLowerCase();

  // Check for prefix match (user typed partial command)
  const prefixMatches = ALL_VERBS.filter((v) => v.startsWith(inputLower));
  if (prefixMatches.length === 1) {
    return prefixMatches[0];
  }

  // Simple Levenshtein-ish check: if first 2 chars match and length is close
  for (const verb of ALL_VERBS) {
    if (
      verb.length >= 2 &&
      inputLower.length >= 2 &&
      verb.slice(0, 2) === inputLower.slice(0, 2) &&
      Math.abs(verb.length - inputLower.length) <= 2
    ) {
      return verb;
    }
  }

  return null;
}

/**
 * Parse raw user input into a structured command
 * @param input - Raw user input string
 * @returns ParsedCommand with type, action, target, and args
 */
export function parse(input: string): ParsedCommand {
  const rawTokens = tokenize(input);

  if (rawTokens.length === 0) {
    return {
      type: "unknown",
      action: "",
      raw: input,
    };
  }

  const firstToken = rawTokens[0];

  // Check for direct direction (e.g., "north", "n")
  if (DIRECTION_MAP[firstToken]) {
    return {
      type: "movement",
      action: "move",
      target: DIRECTION_MAP[firstToken],
      raw: input,
    };
  }

  // Check for movement verb + direction (e.g., "go north")
  if (MOVEMENT_VERBS.includes(firstToken)) {
    const dirToken = rawTokens[1];
    if (dirToken && DIRECTION_MAP[dirToken]) {
      return {
        type: "movement",
        action: "move",
        target: DIRECTION_MAP[dirToken],
        raw: input,
      };
    }
    // Movement verb without valid direction
    return {
      type: "movement",
      action: "move",
      target: undefined,
      raw: input,
    };
  }

  // Check for chat commands
  if (CHAT_VERBS[firstToken]) {
    const action = CHAT_VERBS[firstToken];
    const rest = rawTokens.slice(1).join(" ");

    // For whisper, first word is target, rest is message
    if (action === "whisper" && rawTokens.length >= 2) {
      return {
        type: "chat",
        action,
        target: rawTokens[1],
        args: rawTokens.slice(2),
        raw: input,
      };
    }

    return {
      type: "chat",
      action,
      target: rest || undefined,
      raw: input,
    };
  }

  // Check for item commands
  if (ITEM_VERBS[firstToken]) {
    const action = ITEM_VERBS[firstToken];

    // Inventory has no target
    if (action === "inventory") {
      return {
        type: "item",
        action,
        raw: input,
      };
    }

    // Extract quantity if present
    const { quantity, tokens } = extractQuantity(rawTokens);
    const target = tokens.slice(1).join(" ") || undefined;

    return {
      type: "item",
      action,
      target,
      args: quantity !== undefined ? [String(quantity)] : undefined,
      raw: input,
    };
  }

  // Check for combat commands
  if (COMBAT_VERBS[firstToken]) {
    return {
      type: "combat",
      action: COMBAT_VERBS[firstToken],
      target: rawTokens.slice(1).join(" ") || undefined,
      raw: input,
    };
  }

  // Check for info commands
  if (INFO_VERBS[firstToken]) {
    const action = INFO_VERBS[firstToken];

    // "look" without target is room look, with target is examine
    if (action === "look") {
      let targetTokens = rawTokens.slice(1);
      // Handle "look at X" - strip the "at"
      if (targetTokens[0] === "at") {
        targetTokens = targetTokens.slice(1);
      }
      const target = targetTokens.join(" ");
      if (target) {
        return {
          type: "item",
          action: "examine",
          target,
          raw: input,
        };
      }
      return {
        type: "info",
        action: "look",
        raw: input,
      };
    }

    return {
      type: "info",
      action,
      target: rawTokens.slice(1).join(" ") || undefined,
      raw: input,
    };
  }

  // Unknown command - try to suggest
  const suggestion = findSimilarVerb(firstToken);

  return {
    type: "unknown",
    action: firstToken,
    target: rawTokens.slice(1).join(" ") || undefined,
    args: suggestion ? [suggestion] : undefined,
    raw: input,
  };
}

/**
 * Execute a parsed command by routing to the appropriate service
 * @param command - The parsed command to execute
 * @param context - The command context (player, room, socket)
 * @returns CommandResult with success status, message, and optional broadcasts
 */
export async function execute(
  command: ParsedCommand,
  context: CommandContext,
): Promise<CommandResult> {
  const { player, room } = context;

  switch (command.type) {
    case "movement":
      return executeMovement(command, context);

    case "chat":
      return executeChat(command, context);

    case "item":
      return executeItem(command, context);

    case "info":
      return executeInfo(command, context);

    case "combat":
      // Combat is deferred - return a placeholder message
      return {
        success: false,
        message: "Combat is not yet implemented.",
      };

    case "feature":
      return executeFeature(command, context);

    case "unknown":
    default:
      // Check if this might be a feature command
      if (command.action && command.target) {
        const feature = await FeatureService.findFeatureByCommand(
          room.id,
          command.action,
          command.target,
        );
        if (feature) {
          return executeFeatureInteraction(player.id, feature);
        }
      }

      // Unknown command with suggestion
      if (command.args && command.args[0]) {
        return {
          success: false,
          message: `I don't understand "${command.action}". Did you mean "${command.args[0]}"?`,
        };
      }
      return {
        success: false,
        message: `I don't understand "${command.raw}". Try "help" for commands.`,
      };
  }
}

/**
 * Execute a movement command
 */
async function executeMovement(
  command: ParsedCommand,
  context: CommandContext,
): Promise<CommandResult> {
  const { player } = context;

  if (!command.target) {
    return { success: false, message: "Which direction do you want to go?" };
  }

  const direction = command.target as Direction;
  const result = await RoomService.movePlayer(player.id, direction);

  if (!result.success) {
    return { success: false, message: result.error };
  }

  // Build broadcasts for room enter/leave
  const broadcasts = [];

  // Notify old room that player left
  broadcasts.push({
    event: "room:leave",
    room: context.room.id,
    data: { playerName: player.name, roomId: context.room.id },
  });

  // Notify new room that player entered
  if (result.room) {
    broadcasts.push({
      event: "room:enter",
      room: result.room.id,
      data: { room: result.room, player },
    });
  }

  return {
    success: true,
    message: result.room ? `You move ${direction}.` : undefined,
    broadcast: broadcasts,
  };
}

/**
 * Execute a chat command
 */
async function executeChat(
  command: ParsedCommand,
  context: CommandContext,
): Promise<CommandResult> {
  const { player } = context;

  switch (command.action) {
    case "speak": {
      if (!command.target) {
        return { success: false, message: "What do you want to say?" };
      }
      const result = await ChatService.speak(player.id, command.target);
      if (!result.success) {
        return { success: false, message: result.error };
      }
      const broadcasts = [];
      if (result.message && result.scope?.type === "room") {
        broadcasts.push({
          event: "chat:message",
          room: result.scope.roomId,
          data: result.message,
        });
      }
      return { success: true, broadcast: broadcasts };
    }

    case "shout": {
      if (!command.target) {
        return { success: false, message: "What do you want to shout?" };
      }
      const result = await ChatService.shout(player.id, command.target);
      if (!result.success) {
        return { success: false, message: result.error };
      }
      const broadcasts = [];
      if (result.message && result.scope?.type === "region") {
        // Get all rooms in the region for broadcasting
        const regionRooms = await RoomService.getRoomsByRegion(
          result.scope.region,
        );
        for (const regionRoom of regionRooms) {
          broadcasts.push({
            event: "chat:message",
            room: regionRoom.id,
            data: result.message,
          });
        }
      }
      return { success: true, broadcast: broadcasts };
    }

    case "whisper": {
      if (!command.target) {
        return { success: false, message: "Who do you want to whisper to?" };
      }
      const message = command.args?.join(" ") || "";
      if (!message) {
        return { success: false, message: "What do you want to whisper?" };
      }
      const result = await ChatService.whisper(
        player.id,
        command.target,
        message,
      );
      if (!result.success) {
        return { success: false, message: result.error };
      }
      const broadcasts = [];
      // Send whisper to target
      if (result.message && result.scope?.type === "player") {
        broadcasts.push({
          event: "chat:message",
          room: `player:${result.scope.playerId}`,
          data: result.message,
        });
        // Also send to sender so they see their own whisper
        broadcasts.push({
          event: "chat:message",
          room: `player:${player.id}`,
          data: result.message,
        });
      }
      // Send room notice if present (e.g., "X is whispering to themself")
      if (result.roomNotice) {
        broadcasts.push({
          event: "chat:message",
          room: context.room.id,
          data: result.roomNotice,
        });
      }
      return { success: true, broadcast: broadcasts };
    }

    case "emote": {
      if (!command.target) {
        return { success: false, message: "What do you want to do?" };
      }
      const result = await ChatService.emote(player.id, command.target);
      if (!result.success) {
        return { success: false, message: result.error };
      }
      const broadcasts = [];
      if (result.message && result.scope?.type === "room") {
        broadcasts.push({
          event: "chat:message",
          room: result.scope.roomId,
          data: result.message,
        });
      }
      return { success: true, broadcast: broadcasts };
    }

    default:
      return { success: false, message: "Unknown chat command." };
  }
}

/**
 * Execute an item command
 */
async function executeItem(
  command: ParsedCommand,
  context: CommandContext,
): Promise<CommandResult> {
  const { player, room } = context;

  // Parse quantity from args if present
  let quantity: number | "all" | undefined;
  if (command.args && command.args[0]) {
    if (command.args[0] === "all") {
      quantity = "all";
    } else {
      const num = parseInt(command.args[0], 10);
      if (!isNaN(num)) {
        quantity = num;
      }
    }
  }

  switch (command.action) {
    case "get": {
      if (!command.target) {
        return { success: false, message: "What do you want to pick up?" };
      }

      // Check for "get X from Y" pattern
      const fromMatch = command.target.match(/^(.+?)\s+from\s+(.+)$/i);
      if (fromMatch) {
        const [, itemName, containerName] = fromMatch;
        const result = await ItemService.getItemFromContainer(
          player.id,
          room.id,
          itemName.trim(),
          containerName.trim(),
          quantity,
        );
        return { success: result.success, message: result.message };
      }

      const result = await ItemService.getItem(
        player.id,
        room.id,
        command.target,
        quantity,
      );
      return { success: result.success, message: result.message };
    }

    case "drop": {
      if (!command.target) {
        return { success: false, message: "What do you want to drop?" };
      }
      const result = await ItemService.dropItem(
        player.id,
        room.id,
        command.target,
        quantity,
      );
      return { success: result.success, message: result.message };
    }

    case "examine": {
      if (!command.target) {
        return { success: false, message: "What do you want to examine?" };
      }

      // Check for self-examination
      const selfWords = ["self", "me", "myself", player.name.toLowerCase()];
      if (selfWords.includes(command.target.toLowerCase())) {
        // Show character info with equipment
        const equipResult = await ItemService.getEquipmentList(player.id);
        const lines = [
          `${player.name} - Level ${player.level}`,
          `HP: ${player.currentHp}/${player.maxHp}  XP: ${player.xp}`,
          `STR: ${player.stats.str}  DEX: ${player.stats.dex}  CON: ${player.stats.con}`,
          `INT: ${player.stats.int}  WIS: ${player.stats.wis}  CHA: ${player.stats.cha}`,
          "",
          equipResult.message,
        ];
        return { success: true, message: lines.join("\n") };
      }

      // Check for "examine my X" pattern
      const myMatch = command.target.match(/^my\s+(.+)$/i);
      const searchOwn = !!myMatch;
      const itemName = myMatch ? myMatch[1] : command.target;

      const result = await ItemService.examineItem(
        player.id,
        room.id,
        itemName,
        searchOwn,
      );
      return { success: result.success, message: result.description };
    }

    case "inventory": {
      const inventory = await ItemService.getInventory(player.id);
      if (inventory.length === 0) {
        return { success: true, message: "You are not carrying anything." };
      }

      const lines = ["You are carrying:"];
      for (const stack of inventory) {
        if (stack.quantity === 1) {
          lines.push(`  ${stack.item.name}`);
        } else {
          const name = stack.item.pluralName || `${stack.item.name}s`;
          lines.push(`  ${stack.quantity} ${name}`);
        }
      }
      return { success: true, message: lines.join("\n") };
    }

    case "equip": {
      if (!command.target) {
        return { success: false, message: "What do you want to equip?" };
      }

      // Check for "equip X on Y" or "equip X to Y" pattern
      const slotMatch = command.target.match(/^(.+?)\s+(?:on|to)\s+(.+)$/i);
      if (slotMatch) {
        const [, itemName, slotName] = slotMatch;
        const result = await ItemService.equipItem(
          player.id,
          itemName.trim(),
          slotName.trim(),
        );
        return { success: result.success, message: result.message };
      }

      const result = await ItemService.equipItem(player.id, command.target);
      return { success: result.success, message: result.message };
    }

    case "unequip": {
      if (!command.target) {
        return { success: false, message: "What do you want to unequip?" };
      }
      const result = await ItemService.unequipItem(player.id, command.target);
      return { success: result.success, message: result.message };
    }

    case "equipment": {
      const result = await ItemService.getEquipmentList(player.id);
      return { success: result.success, message: result.message };
    }

    default:
      return { success: false, message: "Unknown item command." };
  }
}

/**
 * Execute an info command
 */
async function executeInfo(
  command: ParsedCommand,
  context: CommandContext,
): Promise<CommandResult> {
  const { player, room } = context;

  switch (command.action) {
    case "look": {
      // Get fresh room data
      const roomData = await RoomService.getRoomWithContents(room.id);
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

    case "stats": {
      const lines = [
        `${player.name} - Level ${player.level}`,
        `HP: ${player.currentHp}/${player.maxHp}  XP: ${player.xp}`,
        `STR: ${player.stats.str}  DEX: ${player.stats.dex}  CON: ${player.stats.con}`,
        `INT: ${player.stats.int}  WIS: ${player.stats.wis}  CHA: ${player.stats.cha}`,
      ];
      return { success: true, message: lines.join("\n") };
    }

    case "help": {
      const lines = [
        "Available commands:",
        "  Movement: north, south, east, west, up, down (or n, s, e, w, u, d)",
        "  Chat: say <message>, shout <message>, whisper <player> <message>, emote <action>",
        "  Items: get <item>, drop <item>, examine <item>, inventory",
        "  Equipment: equip <item> [on <slot>], unequip <item|slot>, equipment",
        "  Info: look, stats, help",
      ];
      return { success: true, message: lines.join("\n") };
    }

    default:
      return { success: false, message: "Unknown info command." };
  }
}

/**
 * Execute a feature command
 */
async function executeFeature(
  command: ParsedCommand,
  context: CommandContext,
): Promise<CommandResult> {
  const { player, room } = context;

  if (!command.target) {
    return { success: false, message: "What do you want to interact with?" };
  }

  const feature = await FeatureService.findFeatureByCommand(
    room.id,
    command.action,
    command.target,
  );

  if (!feature) {
    return {
      success: false,
      message: `You can't ${command.action} that here.`,
    };
  }

  return executeFeatureInteraction(player.id, feature);
}

/**
 * Execute interaction with a specific feature
 */
async function executeFeatureInteraction(
  playerId: string,
  feature: FeatureService.FeatureInteractionResult extends never
    ? never
    : Parameters<typeof FeatureService.interactWithFeature>[1],
): Promise<CommandResult> {
  const result = await FeatureService.interactWithFeature(playerId, feature);

  const messages = [result.message];

  // Add effect messages
  for (const effect of result.effectsApplied) {
    if (effect.message) {
      messages.push(effect.message);
    }
  }

  // Add reveal messages
  if (result.revealedFeature) {
    messages.push(`You discover: ${result.revealedFeature.name}`);
  }
  if (result.revealedContainer) {
    messages.push(`You find: ${result.revealedContainer.name}`);
  }

  return {
    success: result.success,
    message: messages.join("\n"),
  };
}
