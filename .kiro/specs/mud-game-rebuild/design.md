# Design Document: MUD Game Rebuild

## Overview

This design describes a modern MUD (Multi-User Dungeon) game built as a monolithic Node.js application serving both a REST API and static React frontend. The system uses WebSocket (Socket.io) for real-time multiplayer features and SQLite for persistence.

The architecture prioritizes:

- **Server-side authority**: All game logic and command validation happens on the server
- **Pluggable combat**: Combat calculations isolated in a replaceable module for future Pathfinder d20 mechanics
- **Real-time multiplayer**: Socket.io rooms map to game rooms for efficient broadcasting
- **Simplicity**: Monolith architecture suitable for low-cost hosting (<$5/month)

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Server**: Express.js serving API routes and static files
- **Real-time**: Socket.io for WebSocket communication
- **Database**: SQLite (file-based) with Drizzle ORM
- **Frontend**: React with TypeScript, built with Vite
- **Auth**: JWT tokens with bcrypt password hashing
- **Hosting Target**: Railway or Fly.io

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (React)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  ChatPanel  │  │ InputPanel  │  │    Socket.io Client     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Server (Node.js/Express)                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Socket.io Server                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │ Room Mgmt   │  │  Chat Mgmt  │  │  Event Router   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Game Services                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │CommandParser │  │ RoomService  │  │ ItemService  │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │CombatResolver│  │MonsterService│  │ ChatService  │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Auth & API Layer                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │  AuthService │  │  REST Routes │  │  Middleware  │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Data Layer (Drizzle)                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │   Players    │  │    Rooms     │  │    Items     │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  │  ┌──────────────┐  ┌──────────────┐                     │   │
│  │  │   Monsters   │  │     NPCs     │                     │   │
│  │  └──────────────┘  └──────────────┘                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  SQLite File    │
                    │  (game.db)      │
                    └─────────────────┘
```

### Request Flow

1. **Authentication Flow**:
   - Client sends credentials to `/api/auth/login` or `/api/auth/register`
   - Server validates, creates/verifies user, returns JWT
   - Client stores JWT and includes in subsequent requests
   - Socket.io connection authenticates via JWT in handshake

2. **Command Flow**:
   - Player types command in InputPanel
   - Client sends command via Socket.io event
   - Server's CommandParser validates and routes to appropriate service
   - Service executes game logic, updates database
   - Server broadcasts results to relevant socket rooms

3. **Real-time Sync**:
   - Each game room maps to a Socket.io room
   - Players join/leave socket rooms as they move
   - Actions broadcast to room members only (speak) or region (shout)

## Components and Interfaces

### Server Components

#### AuthService

Handles user registration, login, and session management.

```typescript
interface AuthService {
  register(username: string, password: string): Promise<AuthResult>;
  login(username: string, password: string): Promise<AuthResult>;
  validateToken(token: string): Promise<Player | null>;
  logout(playerId: string): Promise<void>;
}

interface AuthResult {
  success: boolean;
  token?: string;
  player?: Player;
  error?: string;
}
```

#### CommandParser

Server-side command parsing and routing. All commands validated here before execution.

```typescript
interface CommandParser {
  parse(input: string): ParsedCommand;
  execute(
    command: ParsedCommand,
    context: CommandContext,
  ): Promise<CommandResult>;
}

interface ParsedCommand {
  type: CommandType;
  action: string;
  target?: string;
  args?: string[];
  raw: string;
}

type CommandType = "movement" | "chat" | "item" | "combat" | "info" | "unknown";

interface CommandContext {
  player: Player;
  room: Room;
  socket: Socket;
}

interface CommandResult {
  success: boolean;
  message?: string;
  broadcast?: BroadcastMessage[];
}
```

#### RoomService

Manages room data, player movement, and room-based queries.

```typescript
interface RoomService {
  getRoom(roomId: string): Promise<Room | null>;
  getRoomWithContents(roomId: string): Promise<RoomWithContents>;
  movePlayer(player: Player, direction: Direction): Promise<MoveResult>;
  getPlayersInRoom(roomId: string): Promise<Player[]>;
  getRoomsByRegion(region: string): Promise<Room[]>;
}

interface MoveResult {
  success: boolean;
  previousRoom?: Room;
  newRoom?: Room;
  error?: string;
}

type Direction = "north" | "south" | "east" | "west" | "up" | "down";
```

#### ItemService

Handles item interactions: get, drop, examine, inventory.

```typescript
interface ItemService {
  getItem(player: Player, itemName: string, room: Room): Promise<ItemResult>;
  dropItem(player: Player, itemName: string, room: Room): Promise<ItemResult>;
  examineItem(itemIdentifier: string, context: ExamineContext): Promise<string>;
  getInventory(player: Player): Promise<Item[]>;
}

interface ItemResult {
  success: boolean;
  item?: Item;
  message: string;
}

interface ExamineContext {
  player: Player;
  room: Room;
}
```

#### CombatResolver

Pluggable combat system. MVP uses simple calculations; can be replaced with Pathfinder d20 mechanics later.

```typescript
interface CombatResolver {
  initiateAttack(
    attacker: Combatant,
    defender: Combatant,
  ): Promise<AttackResult>;
  calculateDamage(attacker: Combatant, defender: Combatant): number;
  checkVictory(combatants: Combatant[]): VictoryResult | null;
}

interface Combatant {
  id: string;
  name: string;
  stats: CombatStats;
  currentHp: number;
  maxHp: number;
}

interface CombatStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

interface AttackResult {
  hit: boolean;
  damage: number;
  attackRoll: number;
  defenderHp: number;
  narrative: string;
}

interface VictoryResult {
  victor: Combatant;
  defeated: Combatant;
  xpAwarded: number;
}
```

#### ChatService

Manages chat message routing based on type (speak, shout, whisper).

```typescript
interface ChatService {
  speak(player: Player, message: string, room: Room): Promise<void>;
  shout(player: Player, message: string, region: string): Promise<void>;
  whisper(
    player: Player,
    targetName: string,
    message: string,
  ): Promise<WhisperResult>;
}

interface WhisperResult {
  success: boolean;
  error?: string;
}
```

#### MonsterService

Manages monster spawning, state, and removal.

```typescript
interface MonsterService {
  spawnMonster(monsterId: string, roomId: string): Promise<MonsterInstance>;
  getMonsterInRoom(
    roomId: string,
    monsterName: string,
  ): Promise<MonsterInstance | null>;
  getMonstersInRoom(roomId: string): Promise<MonsterInstance[]>;
  damageMonster(
    instance: MonsterInstance,
    damage: number,
  ): Promise<MonsterInstance>;
  removeMonster(instanceId: string): Promise<void>;
}

interface MonsterInstance {
  instanceId: string;
  monsterId: string;
  name: string;
  currentHp: number;
  maxHp: number;
  stats: CombatStats;
  roomId: string;
}
```

#### FeatureService

Handles room feature interactions, condition checking, and effect application.

```typescript
interface FeatureService {
  getFeaturesInRoom(
    roomId: string,
    includeHidden?: boolean,
  ): Promise<Feature[]>;
  findFeatureByCommand(
    roomId: string,
    verb: string,
    target: string,
  ): Promise<Feature | null>;
  interactWithFeature(
    player: Player,
    feature: Feature,
    input?: string, // for riddle answers
  ): Promise<FeatureInteractionResult>;
  revealFeature(featureId: string): Promise<void>;
}

interface FeatureInteractionResult {
  success: boolean;
  message: string;
  effectsApplied: EffectResult[];
  revealedFeature?: Feature;
  revealedContainer?: Container;
}
```

#### EffectHandler

Applies player effects from features, combat, items, etc. Centralized effect processing.

```typescript
interface EffectHandler {
  apply(player: Player, effects: PlayerEffect[]): Promise<EffectResult[]>;
  applyDamage(
    player: Player,
    amount: number,
    damageType?: string,
  ): EffectResult;
  applyHeal(player: Player, amount: number): EffectResult;
  awardXp(player: Player, amount: number): EffectResult;
  modifyStat(
    player: Player,
    stat: keyof PlayerStats,
    amount: number,
    permanent?: boolean,
  ): EffectResult;
  giveItem(
    player: Player,
    itemId: string,
    quantity?: number,
  ): Promise<EffectResult>;
  teleport(player: Player, roomId: string): Promise<EffectResult>;
  applyStatus(player: Player, status: string, duration?: number): EffectResult;
}

interface EffectResult {
  type: string;
  success: boolean;
  message: string;
  playerUpdate?: Partial<Player>;
}
```

### Socket Event Handlers

```typescript
// Server-side socket event registration
interface SocketEvents {
  // Client -> Server
  command: (input: string) => void;
  disconnect: () => void;

  // Server -> Client
  "room:enter": (data: RoomEnterData) => void;
  "room:leave": (data: RoomLeaveData) => void;
  "room:update": (data: RoomUpdateData) => void;
  "chat:message": (data: ChatMessageData) => void;
  "combat:action": (data: CombatActionData) => void;
  "combat:result": (data: CombatResultData) => void;
  "player:update": (data: PlayerUpdateData) => void;
  error: (data: ErrorData) => void;
  "system:message": (data: SystemMessageData) => void;
}
```

### Client Components

#### ChatPanel

Displays scrollable message history with different styling per message type.

```typescript
interface ChatPanelProps {
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  type: "chat" | "system" | "combat" | "error" | "whisper" | "emote";
  content: string;
  sender?: string;
  timestamp: Date;
}
```

#### InputPanel

Text input for commands with history navigation.

```typescript
interface InputPanelProps {
  onSubmit: (command: string) => void;
  disabled?: boolean;
}

// Internal state manages command history for up/down arrow navigation
```

## Data Models

### Database Schema (Drizzle)

```typescript
// schema.ts

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

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
  currentRoomId: text("current_room_id").references(() => rooms.id),

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
});

// Rooms table
export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  region: text("region").notNull(),

  // Exits stored as JSON: { "north": "room_id", "south": "room_id" }
  exits: text("exits", { mode: "json" }).$type<Record<Direction, string>>(),
});

// Items table (item definitions)
export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category"),

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
  isHidden: integer("is_hidden", { mode: "boolean" }).default(false),
  revealCommand: text("reveal_command"), // e.g., "search painting"
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
  // Parser matches: "{verb} [the|a|some]? {target}"
  triggerVerbs: text("trigger_verbs", { mode: "json" }).$type<string[]>(), // ["move", "remove", "clear"]
  triggerTarget: text("trigger_target"), // "leaves"

  // Condition to pass (nullable = no condition, just the command triggers it)
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
  revealsFeatureId: text("reveals_feature_id").references(() => features.id),
  revealsContainerId: text("reveals_container_id").references(
    () => containers.id,
  ),

  // State
  isHidden: integer("is_hidden", { mode: "boolean" }).default(false),
  isDiscovered: integer("is_discovered", { mode: "boolean" }).default(false),
});
```

### Type Definitions

```typescript
// types.ts

export interface Player {
  id: string;
  userId: string;
  name: string;
  currentRoomId: string | null;
  stats: PlayerStats;
  currentHp: number;
  maxHp: number;
  xp: number;
  level: number;
  isOnline: boolean;
}

export interface PlayerStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  region: string;
  exits: Partial<Record<Direction, string>>;
}

export interface RoomWithContents extends Room {
  players: Player[];
  items: ItemStack[];
  monsters: MonsterInstance[];
  npcs: NPC[];
  containers: Container[]; // visible containers only; hidden ones excluded until revealed
  features: Feature[]; // visible features only; hidden ones excluded until revealed
}

export interface Item {
  id: string;
  name: string;
  description: string;
  category?: string;
  effects: StatEffects;
}

export interface ItemStack {
  item: Item;
  quantity: number;
}

export interface StatEffects {
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  hp?: number;
}

export interface Monster {
  id: string;
  name: string;
  description: string;
  stats: PlayerStats;
  maxHp: number;
  xpReward: number;
}

export interface MonsterInstance {
  id: string;
  monster: Monster;
  roomId: string;
  currentHp: number;
}

export interface NPC {
  id: string;
  name: string;
  description: string;
  roomId: string | null;
}

export interface Container {
  id: string;
  roomId: string;
  name: string;
  description: string;
  isHidden: boolean;
  revealCommand?: string;
}

export interface Feature {
  id: string;
  roomId: string;
  name: string;
  description: string;
  triggerVerbs: string[];
  triggerTarget: string;
  condition: FeatureCondition | null;
  successMessage?: string;
  failureMessage?: string;
  successEffects?: PlayerEffect[];
  failureEffects?: PlayerEffect[];
  revealsFeatureId?: string;
  revealsContainerId?: string;
  isHidden: boolean;
  isDiscovered: boolean;
}

// Condition types for features
export type FeatureCondition =
  | { type: "stat_check"; stat: keyof PlayerStats; dc: number }
  | { type: "riddle"; question: string; answers: string[] }
  | { type: "item_required"; itemId: string; consumeItem?: boolean };

// Effects that can be applied to players
export type PlayerEffect =
  | { type: "damage"; amount: number; damageType?: string }
  | { type: "heal"; amount: number }
  | { type: "xp"; amount: number }
  | {
      type: "stat_modify";
      stat: keyof PlayerStats;
      amount: number;
      permanent?: boolean;
    }
  | { type: "give_item"; itemId: string; quantity?: number }
  | { type: "teleport"; roomId: string }
  | { type: "status"; status: string; duration?: number };

export type Direction = "north" | "south" | "east" | "west" | "up" | "down";
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Password Storage Security

_For any_ user registration with a plaintext password, the stored password hash SHALL NOT equal the plaintext password, and the hash SHALL be verifiable against the original password using bcrypt/argon2.

**Validates: Requirements 1.1, 1.6**

### Property 2: Authentication Round-Trip

_For any_ registered user with valid credentials, logging in SHALL return a valid JWT token and player data that matches the stored character data (name, stats, currentRoomId).

**Validates: Requirements 1.2, 1.4**

### Property 3: Invalid Credentials Rejection

_For any_ registered user, attempting to login with an incorrect password SHALL fail and return an error, never returning a valid token.

**Validates: Requirements 1.3**

### Property 4: Session Invalidation

_For any_ logged-in user, after logout the previously valid session token SHALL be rejected on subsequent authentication attempts.

**Validates: Requirements 1.5**

### Property 5: Username Uniqueness

_For any_ existing username in the system, attempting to register a new account with that same username SHALL fail with an error.

**Validates: Requirements 1.7**

### Property 6: Character Name Validation

_For any_ character name string, the validation function SHALL accept names containing only alphanumeric characters and reject names with special characters, and SHALL reject names that already exist in the database.

**Validates: Requirements 2.2**

### Property 7: Character Initialization Invariants

_For any_ newly created character, all stats (STR, DEX, CON, INT, WIS, CHA) SHALL be initialized to default values (10), currentRoomId SHALL be the designated starting room, and the character SHALL be retrievable with all fields intact.

**Validates: Requirements 2.3, 2.4, 2.5**

### Property 8: Room Contents Completeness

_For any_ room query, the returned RoomWithContents SHALL include all players currently in that room, all items on the ground, all monster instances, and all NPCs assigned to that room.

**Validates: Requirements 3.1**

### Property 9: Movement Validity and Execution

_For any_ player and direction, if the current room has an exit in that direction, movement SHALL succeed and update the player's currentRoomId to the destination room; if no exit exists, movement SHALL fail and the player's currentRoomId SHALL remain unchanged.

**Validates: Requirements 3.2, 3.3**

### Property 10: Command Alias Equivalence

_For any_ pair of command aliases (e.g., "n"/"north", "get"/"take", "speak"/"say"), parsing both SHALL produce ParsedCommands with the same type and normalized action.

**Validates: Requirements 3.7, 5.8**

### Property 11: Command Parser Recognition

_For any_ valid command input string, the CommandParser SHALL correctly identify the command type (movement, chat, item, combat, info) based on the action keyword, and SHALL return type "unknown" for unrecognized commands.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

### Property 12: Chat Message Routing

_For any_ chat message: speak messages SHALL target only the sender's current room, shout messages SHALL target all rooms in the sender's region, and whisper messages SHALL target only the specified recipient player.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 13: Item Transfer Round-Trip

_For any_ item in a room, getting it SHALL move it to the player's inventory and remove it from the room; subsequently dropping it SHALL move it back to the room and remove it from the player's inventory. The item's properties SHALL remain unchanged through the transfer.

**Validates: Requirements 6.1, 6.2**

### Property 14: Item Examination Consistency

_For any_ item (in inventory or room), examining it SHALL return the item's stored description without modification.

**Validates: Requirements 6.3**

### Property 15: Inventory Query Completeness

_For any_ player, the inventory query SHALL return exactly the items in their playerInventory records with correct quantities.

**Validates: Requirements 6.4**

### Property 16: Combat Initiation

_For any_ attack command targeting a monster present in the player's current room, the CombatResolver SHALL produce an AttackResult (hit or miss) and the monster's currentHp SHALL be reduced by the damage amount if hit.

**Validates: Requirements 7.1**

### Property 17: Combat Stat Influence

_For any_ attacker with higher STR/DEX stats, the average damage dealt over many attacks SHALL be greater than an attacker with lower stats, demonstrating that stats influence combat outcomes.

**Validates: Requirements 7.2, 7.3**

### Property 18: Victory and Defeat Conditions

_For any_ combat where a combatant's HP reaches zero or below: if the monster's HP reaches zero, a VictoryResult SHALL be returned with XP awarded; if the player's HP reaches zero, defeat SHALL be signaled.

**Validates: Requirements 7.4, 7.5**

### Property 19: Monster Spawning

_For any_ monster spawn rule, spawning SHALL create a MonsterInstance in the specified room with HP equal to the monster's maxHp, and the instance SHALL appear in room queries.

**Validates: Requirements 8.3**

### Property 20: Monster Instance Independence

_For any_ two monster instances of the same monster type, damaging one SHALL NOT affect the other's currentHp, and defeating one SHALL remove only that instance from its room.

**Validates: Requirements 8.4, 8.5**

### Property 21: Socket Room Membership

_For any_ player connection or room movement, the player SHALL be a member of exactly one game room's socket channel (their currentRoomId), and movement SHALL update this membership atomically.

**Validates: Requirements 10.2, 10.3**

### Property 22: Disconnect State Update

_For any_ player disconnection, the player's isOnline field SHALL be set to false in the database.

**Validates: Requirements 10.4**

### Property 23: Reconnection Restoration

_For any_ player who disconnects and reconnects, their currentRoomId SHALL be preserved and they SHALL be restored to their last location.

**Validates: Requirements 10.5**

## Error Handling

### Authentication Errors

| Error Condition     | Response                                    | HTTP Status |
| ------------------- | ------------------------------------------- | ----------- |
| Invalid credentials | `{ error: "Invalid username or password" }` | 401         |
| Username taken      | `{ error: "Username already exists" }`      | 409         |
| Invalid token       | `{ error: "Authentication required" }`      | 401         |
| Expired token       | `{ error: "Session expired" }`              | 401         |

### Game Action Errors

| Error Condition          | Response Message                                    |
| ------------------------ | --------------------------------------------------- |
| Invalid direction        | "You can't go that way."                            |
| Item not in room         | "You don't see that here."                          |
| Item not in inventory    | "You don't have that."                              |
| Target not found         | "You don't see [target] here."                      |
| Player offline (whisper) | "[Player] is not online."                           |
| Unknown command          | "I don't understand that. Try 'help' for commands." |

### Socket Error Handling

```typescript
// Connection errors
socket.on("connect_error", (error) => {
  // Attempt reconnection with exponential backoff
  // Max 5 retries, then show connection failed message
});

// Command execution errors
socket.on("error", (data: ErrorData) => {
  // Display error message in chat panel
  // Log for debugging if in development
});
```

### Database Error Handling

- All database operations wrapped in try-catch
- Failed writes trigger rollback where applicable
- Connection failures trigger graceful degradation message
- Retry logic for transient failures (max 3 retries)

## Testing Strategy

### Dual Testing Approach

This project uses both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across randomly generated inputs

### Testing Framework

- **Test Runner**: Vitest
- **Property-Based Testing**: fast-check
- **Minimum iterations**: 100 per property test

### Unit Test Coverage

Unit tests focus on:

- Specific input/output examples for each service method
- Edge cases (empty strings, null values, boundary conditions)
- Error conditions and exception handling
- Integration points between services

### Property Test Coverage

Each correctness property maps to a property-based test:

```typescript
// Example: Property 13 - Item Transfer Round-Trip
// Feature: mud-game-rebuild, Property 13: Item Transfer Round-Trip
test.prop([arbitraryItem, arbitraryPlayer, arbitraryRoom], { numRuns: 100 })(
  "getting then dropping an item returns it to the room unchanged",
  async (item, player, room) => {
    // Setup: item in room, player in room
    await roomInventory.add(room.id, item.id, 1);

    // Get item
    await itemService.getItem(player, item.name, room);

    // Verify in inventory
    const inventory = await itemService.getInventory(player);
    expect(inventory).toContainEqual(expect.objectContaining({ id: item.id }));

    // Drop item
    await itemService.dropItem(player, item.name, room);

    // Verify back in room
    const roomItems = await roomInventory.getItems(room.id);
    expect(roomItems).toContainEqual(expect.objectContaining({ id: item.id }));
  },
);
```

### Test Organization

```
tests/
├── unit/
│   ├── auth.test.ts
│   ├── commandParser.test.ts
│   ├── roomService.test.ts
│   ├── itemService.test.ts
│   ├── combatResolver.test.ts
│   └── chatService.test.ts
├── property/
│   ├── auth.property.test.ts
│   ├── commandParser.property.test.ts
│   ├── roomService.property.test.ts
│   ├── itemService.property.test.ts
│   ├── combatResolver.property.test.ts
│   └── chatService.property.test.ts
└── generators/
    ├── player.generator.ts
    ├── room.generator.ts
    ├── item.generator.ts
    └── monster.generator.ts
```

### Property Test Tagging

Each property test includes a comment referencing the design property:

```typescript
// Feature: mud-game-rebuild, Property 1: Password Storage Security
// Feature: mud-game-rebuild, Property 2: Authentication Round-Trip
// etc.
```
