import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Direction type for exits
export type Direction = "north" | "south" | "east" | "west" | "up" | "down";

// Exit type with optional blocking
export type Exit = {
  roomId: string;
  blocked?: boolean;
  blockMessage?: string;
};

// Feature condition types
export type FeatureCondition =
  | {
      type: "stat_check";
      stat: "str" | "dex" | "con" | "int" | "wis" | "cha";
      dc: number;
    }
  | { type: "riddle"; question: string; answers: string[] }
  | { type: "item_required"; itemId: string; consumeItem?: boolean };

// Player effect types
export type PlayerEffect =
  | { type: "damage"; amount: number; damageType?: string }
  | { type: "heal"; amount: number }
  | { type: "xp"; amount: number }
  | {
      type: "stat_modify";
      stat: "str" | "dex" | "con" | "int" | "wis" | "cha";
      amount: number;
      permanent?: boolean;
    }
  | { type: "give_item"; itemId: string; quantity?: number }
  | { type: "teleport"; roomId: string }
  | { type: "status"; status: string; duration?: number }
  | { type: "unblock_exit"; direction: Direction };

// Users table (authentication)
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Players table (game characters)
export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull().unique(),
  currentRoomId: text("current_room_id"),

  // Pathfinder stats
  str: integer("str").notNull().default(10),
  dex: integer("dex").notNull().default(10),
  con: integer("con").notNull().default(10),
  int: integer("int").notNull().default(10),
  wis: integer("wis").notNull().default(10),
  cha: integer("cha").notNull().default(10),

  currentHp: integer("current_hp").notNull().default(10),
  maxHp: integer("max_hp").notNull().default(10),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),

  isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),

  // Worn equipment slots (item IDs)
  wornHead: text("worn_head"),
  wornTorso: text("worn_torso"),
  wornBody: text("worn_body"),
  wornLegs: text("worn_legs"),
  wornHands: text("worn_hands"),
  wornFeet: text("worn_feet"),
  wornMainHand: text("worn_main_hand"),
  wornOffHand: text("worn_off_hand"),
  wornNeck: text("worn_neck"),
  wornRing1: text("worn_ring1"),
  wornRing2: text("worn_ring2"),
});

// Rooms table
export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  // Navigation description (e.g., "The path leads north to the village.")
  navDescription: text("nav_description"),
  region: text("region").notNull(),
  // Exits stored as JSON: { "north": { roomId: "room_id", blocked?: true, blockMessage?: "..." } }
  exits: text("exits", { mode: "json" }).$type<
    Partial<Record<Direction, Exit>>
  >(),
});

// Equipment slot type
export type EquipmentSlot =
  | "head"
  | "torso"
  | "body"
  | "legs"
  | "hands"
  | "feet"
  | "mainHand"
  | "offHand"
  | "neck"
  | "ring";

// Items table (item definitions)
export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  pluralName: text("plural_name"),
  description: text("description").notNull(),
  category: text("category"),
  isBulk: integer("is_bulk", { mode: "boolean" }).default(false),

  // Equipment slots this item can be worn in (JSON array, first is default)
  equipSlots: text("equip_slots", { mode: "json" }).$type<EquipmentSlot[]>(),

  // Weapon properties
  weaponDamage: text("weapon_damage"), // e.g., "1d6", "2d4+1"
  weaponType: text("weapon_type"), // e.g., "slashing", "piercing", "bludgeoning"

  // Magic/special properties (JSON array of effects)
  magicProperties: text("magic_properties", { mode: "json" }).$type<string[]>(),

  // Stat effects when used/equipped
  strEffect: integer("str_effect").default(0),
  dexEffect: integer("dex_effect").default(0),
  conEffect: integer("con_effect").default(0),
  intEffect: integer("int_effect").default(0),
  wisEffect: integer("wis_effect").default(0),
  chaEffect: integer("cha_effect").default(0),
  hpEffect: integer("hp_effect").default(0),
});

// Player inventory (many-to-many)
export const playerInventory = sqliteTable("player_inventory", {
  id: text("id").primaryKey(),
  playerId: text("player_id")
    .notNull()
    .references(() => players.id),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id),
  quantity: integer("quantity").notNull().default(1),
});

// Room inventory (items on the ground)
export const roomInventory = sqliteTable("room_inventory", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id),
  quantity: integer("quantity").notNull().default(1),
});

// Containers (chests, hidden compartments, etc.)
export const containers = sqliteTable("containers", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  // Alternative names for the container (e.g., "pouch" for "hidden cache")
  aliases: text("aliases", { mode: "json" }).$type<string[]>(),
  // Text shown in room description when container is revealed (e.g., "Under a tree root you see a leather pouch.")
  revealedText: text("revealed_text"),
  // null = never hidden (always visible), true = currently hidden, false = currently visible
  isHidden: integer("is_hidden", { mode: "boolean" }),
  // When the container was last revealed (for time-based re-hiding)
  // null = never revealed or permanently visible
  revealedAt: integer("revealed_at", { mode: "timestamp" }),
  isOpen: integer("is_open", { mode: "boolean" }).default(false),
  revealCommand: text("reveal_command"),
});

// Container inventory
export const containerInventory = sqliteTable("container_inventory", {
  id: text("id").primaryKey(),
  containerId: text("container_id")
    .notNull()
    .references(() => containers.id),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id),
  quantity: integer("quantity").notNull().default(1),
});

// Monster definitions
export const monsters = sqliteTable("monsters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),

  str: integer("str").notNull().default(10),
  dex: integer("dex").notNull().default(10),
  con: integer("con").notNull().default(10),
  int: integer("int").notNull().default(10),
  wis: integer("wis").notNull().default(10),
  cha: integer("cha").notNull().default(10),

  maxHp: integer("max_hp").notNull().default(10),
  xpReward: integer("xp_reward").notNull().default(10),
});

// Monster instances (spawned monsters in rooms)
export const monsterInstances = sqliteTable("monster_instances", {
  id: text("id").primaryKey(),
  monsterId: text("monster_id")
    .notNull()
    .references(() => monsters.id),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id),
  currentHp: integer("current_hp").notNull(),
  spawnedAt: integer("spawned_at", { mode: "timestamp" }).notNull(),
});

// NPCs table
export const npcs = sqliteTable("npcs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  roomId: text("room_id").references(() => rooms.id),
});

// Monster spawn rules (which monsters can spawn where)
export const monsterSpawns = sqliteTable("monster_spawns", {
  id: text("id").primaryKey(),
  monsterId: text("monster_id")
    .notNull()
    .references(() => monsters.id),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id),
  maxCount: integer("max_count").notNull().default(1),
});

// Room features (interactable elements like levers, paintings, piles of leaves)
export const features = sqliteTable("features", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id),
  name: text("name").notNull(),
  description: text("description").notNull(),

  // Command matching - verbs that trigger this feature + target noun
  triggerVerbs: text("trigger_verbs", { mode: "json" }).$type<string[]>(),
  triggerTarget: text("trigger_target"),

  // Condition to pass (nullable = no condition)
  condition: text("condition", {
    mode: "json",
  }).$type<FeatureCondition | null>(),

  // Messages shown on success/failure
  successMessage: text("success_message"),
  failureMessage: text("failure_message"),

  // Effects applied to player on success/failure
  successEffects: text("success_effects", { mode: "json" }).$type<
    PlayerEffect[]
  >(),
  failureEffects: text("failure_effects", { mode: "json" }).$type<
    PlayerEffect[]
  >(),

  // What gets revealed on success
  revealsFeatureId: text("reveals_feature_id"),
  revealsContainerId: text("reveals_container_id"),

  // State: null = never hidden (always visible), true = currently hidden, false = currently visible
  isHidden: integer("is_hidden", { mode: "boolean" }),
  // When the feature was last revealed (for time-based re-hiding)
  // null = never revealed or permanently visible
  revealedAt: integer("revealed_at", { mode: "timestamp" }),
  isDiscovered: integer("is_discovered", { mode: "boolean" }).default(false),

  // Custom refusal messages for invalid actions (optional, fallback to generic)
  refuseGetMessage: text("refuse_get_message"),
  refuseDropMessage: text("refuse_drop_message"),
});
