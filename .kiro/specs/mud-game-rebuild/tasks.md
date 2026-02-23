# Implementation Tasks

## Task 0: Archive Existing Code

- [x] 0.1 Create /archive directory at project root
- [x] 0.2 Move all existing source directories to /archive (client, controllers, models, routes, config, scripts, test)
- [x] 0.3 Move existing root files to /archive (server.js, package.json, package-lock.json)
- [x] 0.4 Keep .git, .gitignore, .kiro, README.md, and LICENSE at root
- [x] 0.5 Update .gitignore to include /archive if desired (or keep it tracked for reference)
- [x] 0.6 Commit archive move before starting new implementation

## Task 1: Project Setup and Infrastructure

- [x] 1.1 Initialize new TypeScript Node.js project with package.json
- [x] 1.2 Configure TypeScript (tsconfig.json) for Node.js backend
- [x] 1.3 Set up Vite React TypeScript frontend in /client directory
- [x] 1.4 Install and configure Drizzle ORM with SQLite
- [x] 1.5 Create database schema file with all tables (users, players, rooms, items, etc.)
- [x] 1.6 Set up Drizzle migrations
- [x] 1.7 Configure Express server with TypeScript
- [x] 1.8 Set up Socket.io with Express integration
- [x] 1.9 Configure environment variables (.env) and dotenv
- [x] 1.10 Set up Vitest for testing with fast-check for property tests
- [x] 1.11 Create project directory structure (services, routes, types, etc.)

## Task 2: Database Layer

- [x] 2.1 Implement users table schema
- [x] 2.2 Implement players table schema with stats fields
- [x] 2.3 Implement rooms table schema with JSON exits
- [x] 2.4 Implement items table schema with stat effects
- [x] 2.5 Implement playerInventory junction table
- [x] 2.6 Implement roomInventory junction table
- [x] 2.7 Implement containers table schema
- [x] 2.8 Implement containerInventory junction table
- [x] 2.9 Implement features table schema with conditions and effects
- [x] 2.10 Implement monsters and monsterInstances tables
- [x] 2.11 Implement npcs table
- [x] 2.12 Implement monsterSpawns table
- [x] 2.13 Run initial migration and verify schema
- [x] 2.14 Create seed data script with starter rooms, items, and a test monster

## Task 3: Type Definitions

- [x] 3.1 Create Player and PlayerStats interfaces
- [x] 3.2 Create Room and RoomWithContents interfaces
- [x] 3.3 Create Item, ItemStack, and StatEffects interfaces
- [x] 3.4 Create Monster and MonsterInstance interfaces
- [x] 3.5 Create NPC interface
- [x] 3.6 Create Container interface
- [x] 3.7 Create Feature, FeatureCondition, and PlayerEffect types
- [x] 3.8 Create Direction type
- [x] 3.9 Create command-related types (ParsedCommand, CommandType, CommandContext, CommandResult)
- [x] 3.10 Create socket event types (all Server->Client and Client->Server events)
- [x] 3.11 Create AuthResult and related auth types

## Task 4: Authentication System

- [x] 4.1 Implement password hashing utility (bcrypt)
- [x] 4.2 Implement JWT token generation and validation utilities
- [x] 4.3 Implement AuthService.register()
- [x] 4.4 Implement AuthService.login()
- [x] 4.5 Implement AuthService.validateToken()
- [x] 4.6 Implement AuthService.logout()
- [x] 4.7 Create /api/auth/register REST endpoint
- [x] 4.8 Create /api/auth/login REST endpoint
- [x] 4.9 Create auth middleware for protected routes
- [x] 4.10 Implement Socket.io authentication via JWT in handshake
- [x] 4.11 Write unit tests for AuthService
- [x] 4.12 Write property tests for password security (Property 1)
- [x] 4.13 Write property tests for auth round-trip (Property 2)
- [x] 4.14 Write property tests for invalid credentials rejection (Property 3)

## Task 5: Character Creation

- [x] 5.1 Implement character name validation (alphanumeric, unique)
- [x] 5.2 Implement character creation with default stats
- [x] 5.3 Implement starting room assignment
- [x] 5.4 Create /api/characters/create REST endpoint
- [x] 5.5 Write unit tests for character creation
- [x] 5.6 Write property tests for character name validation (Property 6)
- [x] 5.7 Write property tests for character initialization (Property 7)

## Task 6: Room Service

- [x] 6.1 Implement RoomService.getRoom()
- [x] 6.2 Implement RoomService.getRoomWithContents() - aggregate players, items, monsters, NPCs, containers, features
- [x] 6.3 Implement RoomService.movePlayer() with exit validation
- [x] 6.4 Implement RoomService.getPlayersInRoom()
- [x] 6.5 Implement RoomService.getRoomsByRegion()
- [x] 6.6 Write unit tests for RoomService
- [x] 6.7 Write property tests for room contents completeness (Property 8)
- [x] 6.8 Write property tests for movement validity (Property 9)

## Task 7: Command Parser

- [x] 7.1 Implement command tokenizer (split input, handle articles)
- [x] 7.2 Implement movement command recognition (north, n, go north, etc.)
- [x] 7.3 Implement chat command recognition (speak, say, shout, whisper)
- [x] 7.4 Implement item command recognition (get, take, drop, examine, inventory)
- [x] 7.5 Implement combat command recognition (attack, fight, kill)
- [x] 7.6 Implement info command recognition (look, stats, help)
- [x] 7.7 Implement feature command matching (verb + target against room features)
- [x] 7.8 Implement CommandParser.parse() returning ParsedCommand
- [x] 7.9 Implement CommandParser.execute() routing to appropriate service
- [x] 7.10 Write unit tests for CommandParser
- [x] 7.11 Write property tests for command alias equivalence (Property 10)
- [x] 7.12 Write property tests for command recognition (Property 11)

## Task 8: Chat Service

- [x] 8.1 Implement ChatService.speak() - broadcast to room
- [x] 8.2 Implement ChatService.shout() - broadcast to region
- [x] 8.3 Implement ChatService.whisper() - private message to player
- [x] 8.4 Write unit tests for ChatService
- [x] 8.5 Write property tests for chat message routing (Property 12)

## Task 9: Item Service

- [x] 9.1 Implement ItemService.getItem() - move from room to player inventory
- [x] 9.2 Implement ItemService.dropItem() - move from player inventory to room
- [x] 9.3 Implement ItemService.examineItem() - return item description
- [x] 9.4 Implement ItemService.getInventory() - list player's items
- [x] 9.5 Implement container item retrieval (get from container)
- [x] 9.6 Write unit tests for ItemService
- [x] 9.7 Write property tests for item transfer round-trip (Property 13)
- [x] 9.8 Write property tests for item examination (Property 14)
- [x] 9.9 Write property tests for inventory completeness (Property 15)

## Task 10: Combat Resolver [DEFERRED]

**Status**: Deferred until working prototype is complete.

**Open Design Questions** (to resolve before implementation):

1. **Attack Roll Mechanics**
   - Which stat for attack rolls? STR for melee, DEX for ranged, or STR for all in MVP?
   - Target number: Add AC field to schema, calculate from DEX (10 + DEX mod), or flat target?

2. **Damage Calculation**
   - Unarmed damage if no weapon equipped? (1d3? flat 1?)
   - Monster damage: weapon dice or formula from stats?
   - Parse dice notation ("2d6+3") or simpler formula for MVP?

3. **Critical Hits/Misses**
   - Include natural 20 (auto-hit + double damage) and natural 1 (auto-miss)?

4. **Combat Flow**
   - Turn-based or real-time?
   - Auto counter-attack when monster is attacked?
   - Can players flee mid-combat?

5. **Player Defeat**
   - Death with respawn at starting room?
   - Unconscious state requiring healing?
   - HP can't go below 1 (no death in MVP)?

6. **Stat Modifiers**
   - Use Pathfinder formula `(stat - 10) / 2`? Or simpler?

7. **Equipped Weapon Integration**
   - Look up `wornMainHand` weapon's `weaponDamage`? Or stats-only for MVP?

8. **Testability**
   - Inject dice roller for deterministic property tests?

**Tasks** (when resumed):

- [ ] 10.1 Implement basic attack roll calculation (d20 + stat modifier)
- [ ] 10.2 Implement damage calculation based on stats
- [ ] 10.3 Implement CombatResolver.initiateAttack()
- [ ] 10.4 Implement CombatResolver.checkVictory()
- [ ] 10.5 Implement XP award on monster defeat
- [ ] 10.6 Implement player defeat handling
- [ ] 10.7 Write unit tests for CombatResolver
- [ ] 10.8 Write property tests for combat initiation (Property 16)
- [ ] 10.9 Write property tests for stat influence on combat (Property 17)
- [ ] 10.10 Write property tests for victory/defeat conditions (Property 18)

## Task 11: Monster Service [DEFERRED]

**Status**: Deferred until working prototype is complete. Depends on Task 10.

**Tasks** (when resumed):

- [ ] 11.1 Implement MonsterService.spawnMonster()
- [ ] 11.2 Implement MonsterService.getMonstersInRoom()
- [ ] 11.3 Implement MonsterService.getMonsterInRoom() - find by name
- [ ] 11.4 Implement MonsterService.damageMonster()
- [ ] 11.5 Implement MonsterService.removeMonster()
- [ ] 11.6 Write unit tests for MonsterService
- [ ] 11.7 Write property tests for monster spawning (Property 19)
- [ ] 11.8 Write property tests for monster instance independence (Property 20)

## Task 12: Feature Service and Effect Handler

- [x] 12.1 Implement EffectHandler.applyDamage() _(can stub until combat is implemented)_
- [x] 12.2 Implement EffectHandler.applyHeal() _(can stub until combat is implemented)_
- [x] 12.3 Implement EffectHandler.awardXp()
- [x] 12.4 Implement EffectHandler.modifyStat()
- [x] 12.5 Implement EffectHandler.giveItem()
- [x] 12.6 Implement EffectHandler.teleport()
- [x] 12.7 Implement EffectHandler.applyStatus() _(can stub until combat is implemented)_
- [x] 12.8 Implement EffectHandler.apply() - process array of effects
- [x] 12.9 Implement FeatureService.getFeaturesInRoom()
- [x] 12.10 Implement FeatureService.findFeatureByCommand()
- [x] 12.11 Implement condition checking (stat_check, riddle, item_required)
- [x] 12.12 Implement FeatureService.interactWithFeature()
- [x] 12.13 Implement FeatureService.revealFeature()
- [x] 12.14 Write unit tests for EffectHandler
- [x] 12.15 Write unit tests for FeatureService

## Task 13: Socket.io Event Handlers

- [x] 13.1 Implement connection handler with JWT auth
- [x] 13.2 Implement disconnect handler (update isOnline, notify room)
- [x] 13.3 Implement 'command' event handler routing to CommandParser
- [x] 13.4 Implement room:enter broadcast
- [x] 13.5 Implement room:leave broadcast
- [x] 13.6 Implement chat:message broadcast
- [ ] 13.7 Implement combat:action and combat:result broadcasts _(deferred until Task 10)_
- [x] 13.8 Implement player:update emission
- [x] 13.9 Implement socket room management (join/leave on movement)
- [x] 13.10 Write unit tests for socket handlers
- [ ] 13.11 Write property tests for socket room membership (Property 21) _(deferred to backlog - integration testing)_
- [ ] 13.12 Write property tests for disconnect state update (Property 22) _(deferred to backlog - integration testing)_
- [ ] 13.13 Write property tests for reconnection restoration (Property 23) _(deferred to backlog - integration testing)_

## Task 14: React Frontend - Core Components

**Design Decisions:**

- State management: useReducer + Context (GameContext with reducer)
- Socket connects after auth with JWT in handshake
- Socket instance lives in useSocket hook, exposed via SocketProvider
- useGameSocket hook subscribes to events and dispatches to GameContext
- Command history: 500 commands in memory (no persistence for MVP)
- Auto-scroll: Only if user is at bottom (track scroll position)
- Mobile: Skip for MVP, use responsive CSS later if needed
- Connection status: Small indicator in UI
- Styling: Simple, clean dark theme (not copying old project's visual style)

**Tasks:**

- [x] 14.1 Create GameContext with useReducer (messages, player, room, connection status)
- [x] 14.2 Create useSocket hook (connect after auth, auto-reconnect, expose sendCommand)
- [x] 14.3 Create SocketProvider wrapping app with socket + connection status
- [x] 14.4 Create useGameSocket hook (subscribe to server events, dispatch to GameContext)
- [x] 14.5 Create ChatMessage type and CSS classes for 6 message types
- [x] 14.6 Implement ChatPanel component with scrollable message list
- [x] 14.7 Implement smart auto-scroll (only if user at bottom)
- [x] 14.8 Implement InputPanel component with text input and submit
- [x] 14.9 Implement command history navigation (up/down arrows, 500 limit)
- [x] 14.10 Create Console component composing ChatPanel and InputPanel
- [x] 14.11 Add connection status indicator
- [x] 14.12 Style components with CSS (simple dark theme, readable fonts)

## Task 15: React Frontend - Auth Flow

## Task 15: React Frontend - Auth Flow (In-Chat)

**Design Decision:** Auth happens through chat commands (login, register, create) rather than separate forms. More immersive MUD experience.

- [x] 15.1 Create auth API client functions (login, register, createCharacter)
- [x] 15.2 Create AuthContext for managing auth state (token, player, authState)
- [x] 15.3 Implement JWT storage in localStorage
- [x] 15.4 Create useAuthCommands hook for handling auth commands in chat
- [x] 15.5 Implement login command with clear prompts
- [x] 15.6 Implement register command with validation feedback
- [x] 15.7 Implement create character command
- [x] 15.8 Implement logout command
- [x] 15.9 Show welcome message with clear instructions for new users
- [x] 15.10 Block game commands until authenticated with character
- [x] 15.11 Connect socket only after full authentication

## Task 16: Integration and Polish

- [x] 16.1 Wire up Express to serve React build in production
- [x] 16.2 Create npm scripts for dev (concurrent server + client) and production
- [x] 16.3 Test full auth flow end-to-end
- [x] 16.4 Test room navigation end-to-end
- [x] 16.5 Test chat (speak, shout, whisper) end-to-end
- [x] 16.6 Test item interactions end-to-end
- [ ] 16.7 Test combat end-to-end _(defer until Task 10)_
- [x] 16.8 Test feature interactions end-to-end
- [x] 16.9 Add error handling for edge cases
- [x] 16.10 Create README with setup instructions

## Task 17: Deployment Preparation

- [x] 17.1 Configure for Railway or Fly.io deployment
- [x] 17.2 Set up production environment variables
- [x] 17.3 Configure SQLite database path for production
- [x] 17.4 Test production build locally
- [ ] 17.5 Deploy and verify
