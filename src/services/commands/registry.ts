/**
 * Command registry - the single source of truth for all commands.
 * TypeScript enforces that every Command enum value has an entry here.
 */

import { getAliasesForCommand } from "./aliases.js";
import { Command, type CommandDefinition } from "./types.js";

// Import handlers
import {
  handleFeats,
  handleStance,
  handleTrain,
} from "./handlers/character.js";
import {
  handleEmote,
  handleSay,
  handleShout,
  handleWhisper,
} from "./handlers/chat.js";
import { handleAttack, handleFlee } from "./handlers/combat.js";
import { handleHelp, handleLook, handleStats } from "./handlers/info.js";
import {
  handleClose,
  handleDrop,
  handleEquip,
  handleEquipment,
  handleExamine,
  handleGet,
  handleInventory,
  handleOpen,
  handlePut,
  handleUnequip,
} from "./handlers/items.js";
import { handleMove } from "./handlers/movement.js";

/**
 * Command registry. TypeScript will error if any Command enum
 * value is missing from this Record.
 */
export const COMMAND_REGISTRY: Record<Command, CommandDefinition> = {
  [Command.Move]: {
    handler: handleMove,
    help: {
      summary: "Move between rooms",
      usage: ["move <direction>", "<direction>"],
      aliases: getAliasesForCommand(Command.Move),
      examples: ["move north", "go east", "n", "south"],
    },
  },

  [Command.Say]: {
    handler: handleSay,
    help: {
      summary: "Talk to players in the room",
      usage: ["say <message>"],
      aliases: getAliasesForCommand(Command.Say),
      examples: ["say Hello everyone!", "speak Greetings"],
    },
  },

  [Command.Shout]: {
    handler: handleShout,
    help: {
      summary: "Shout to everyone in the region",
      usage: ["shout <message>"],
      aliases: getAliasesForCommand(Command.Shout),
      examples: ["shout Help!", "yell Is anyone there?"],
    },
  },

  [Command.Whisper]: {
    handler: handleWhisper,
    help: {
      summary: "Send a private message to a player",
      usage: ["whisper <player> <message>"],
      aliases: getAliasesForCommand(Command.Whisper),
      examples: ["whisper Bob Hey, over here", "tell Alice Secret message"],
    },
  },

  [Command.Emote]: {
    handler: handleEmote,
    help: {
      summary: "Perform an action visible to the room",
      usage: ["emote <action>"],
      aliases: getAliasesForCommand(Command.Emote),
      examples: ["emote waves hello", "me laughs"],
    },
  },

  [Command.Get]: {
    handler: handleGet,
    help: {
      summary: "Pick up an item",
      usage: ["get <item>", "get <item> from <container>", "get all <item>"],
      aliases: getAliasesForCommand(Command.Get),
      examples: ["get sword", "take 3 coins", "get potion from chest"],
    },
  },

  [Command.Drop]: {
    handler: handleDrop,
    help: {
      summary: "Drop an item from your inventory",
      usage: ["drop <item>", "drop all <item>"],
      aliases: getAliasesForCommand(Command.Drop),
      examples: ["drop sword", "drop 5 coins"],
    },
  },

  [Command.Put]: {
    handler: handlePut,
    help: {
      summary: "Put an item into a container",
      usage: ["put <item> in <container>"],
      aliases: getAliasesForCommand(Command.Put),
      examples: ["put sword in chest", "place coins in pouch"],
    },
  },

  [Command.Examine]: {
    handler: handleExamine,
    help: {
      summary: "Examine something closely",
      usage: ["examine <target>", "examine my <item>"],
      aliases: getAliasesForCommand(Command.Examine),
      examples: ["examine sword", "x chest", "examine my cap"],
    },
  },

  [Command.Inventory]: {
    handler: handleInventory,
    help: {
      summary: "View items you are carrying",
      usage: ["inventory"],
      aliases: getAliasesForCommand(Command.Inventory),
      examples: ["inventory", "inv", "i"],
    },
  },

  [Command.Equip]: {
    handler: handleEquip,
    help: {
      summary: "Equip an item from your inventory",
      usage: ["equip <item>", "equip <item> on <slot>"],
      aliases: getAliasesForCommand(Command.Equip),
      examples: ["equip sword", "wear cap", "equip torch on offhand"],
    },
  },

  [Command.Unequip]: {
    handler: handleUnequip,
    help: {
      summary: "Remove an equipped item",
      usage: ["unequip <item>", "unequip <slot>"],
      aliases: getAliasesForCommand(Command.Unequip),
      examples: ["unequip sword", "remove cap", "unequip mainhand"],
    },
  },

  [Command.Equipment]: {
    handler: handleEquipment,
    help: {
      summary: "View your equipped items",
      usage: ["equipment"],
      aliases: getAliasesForCommand(Command.Equipment),
      examples: ["equipment", "eq", "gear"],
    },
  },

  [Command.Open]: {
    handler: handleOpen,
    help: {
      summary: "Open a container",
      usage: ["open <container>"],
      aliases: getAliasesForCommand(Command.Open),
      examples: ["open chest", "open pouch"],
    },
  },

  [Command.Close]: {
    handler: handleClose,
    help: {
      summary: "Close a container",
      usage: ["close <container>"],
      aliases: getAliasesForCommand(Command.Close),
      examples: ["close chest", "shut pouch"],
    },
  },

  [Command.Look]: {
    handler: handleLook,
    help: {
      summary: "Look around the room or at something",
      usage: ["look", "look <target>", "look at <target>"],
      aliases: getAliasesForCommand(Command.Look),
      examples: ["look", "l", "look sword", "look at chest"],
    },
  },

  [Command.Stats]: {
    handler: handleStats,
    help: {
      summary: "View your character stats",
      usage: ["stats"],
      aliases: getAliasesForCommand(Command.Stats),
      examples: ["stats", "stat", "score"],
    },
  },

  [Command.Help]: {
    handler: handleHelp,
    help: {
      summary: "Show help for commands",
      usage: ["help", "help <command>"],
      aliases: getAliasesForCommand(Command.Help),
      examples: ["help", "help move", "help get", "?"],
    },
  },

  [Command.Attack]: {
    handler: handleAttack,
    help: {
      summary: "Attack a creature",
      usage: ["attack <target>"],
      aliases: getAliasesForCommand(Command.Attack),
      examples: ["attack goblin", "fight spider", "kill wolf"],
    },
  },

  [Command.Flee]: {
    handler: handleFlee,
    help: {
      summary: "Flee from combat in a random direction",
      usage: ["flee"],
      aliases: getAliasesForCommand(Command.Flee),
      examples: ["flee", "run", "escape"],
    },
  },

  [Command.Train]: {
    handler: handleTrain,
    help: {
      summary: "Spend attribute points to increase stats",
      usage: ["train", "train <stat>"],
      aliases: getAliasesForCommand(Command.Train),
      examples: ["train", "train str", "spend dex"],
    },
  },

  [Command.Feats]: {
    handler: handleFeats,
    help: {
      summary: "View and manage your feats",
      usage: [
        "feats",
        "feats available",
        "feats info <name>",
        "feats acquire <name>",
        "feats category <name>",
      ],
      aliases: getAliasesForCommand(Command.Feats),
      examples: [
        "feats",
        "feats available",
        "feats info Toughness",
        "feats acquire Dodge",
        "feats category Combat",
      ],
    },
  },

  [Command.Stance]: {
    handler: handleStance,
    help: {
      summary: "Activate or deactivate combat stances",
      usage: ["stance", "stance <name>", "stance off"],
      aliases: getAliasesForCommand(Command.Stance),
      examples: ["stance", "stance Power Attack", "stance off"],
    },
  },
};
