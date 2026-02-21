# Implementation Tasks

## Task 0: Archive Existing Code

- [x] 0.1 Create /archive directory at project root
- [x] 0.2 Move all existing source directories to /archive (client, controllers, models, routes, config, scripts, test)
- [x] 0.3 Move existing root files to /archive (server.js, package.json, package-lock.json)
- [x] 0.4 Keep .git, .gitignore, .kiro, README.md, and LICENSE at root
- [x] 0.5 Update .gitignore to include /archive if desired (or keep it tracked for reference)
- [-] 0.6 Commit archive move before starting new implementation

## Task 1: Project Setup and Infrastructure

- [ ] 1.1 Initialize new TypeScript Node.js project with package.json
- [ ] 1.2 Configure TypeScript (tsconfig.json) for Node.js backend
- [ ] 1.3 Set up Vite React TypeScript frontend in /client directory
- [ ] 1.4 Install and configure Drizzle ORM with SQLite
- [ ] 1.5 Create database schema file with all tables (users, players, rooms, items, etc.)
- [ ] 1.6 Set up Drizzle migrations
- [ ] 1.7 Configure Express server with TypeScript
- [ ] 1.8 Set up Socket.io with Express integration
- [ ] 1.9 Configure environment variables (.env) and dotenv
- [ ] 1.10 Set up Vitest for testing with fast-check for property tests
- [ ] 1.11 Create project directory structure (services, routes, types, etc.)

## Task 2: Database Layer

- [ ] 2.1 Implement users table schema
- [ ] 2.2 Implement players table schema with stats fields
- [ ] 2.3 Implement rooms table schema with JSON exits
- [ ] 2.4 Implement items table schema with stat effects
- [ ] 2.5 Implement playerInventory junction table
- [ ] 2.6 Implement roomInventory junction table
- [ ] 2.7 Implement containers table schema
- [ ] 2.8 Implement containerInventory junction table
- [ ] 2.9 Implement features table schema with conditions and effects
- [ ] 2.10 Implement monsters and monsterInstances tables
- [ ] 2.11 Implement npcs table
- [ ] 2.12 Implement monsterSpawns table
- [ ] 2.13 Run initial migration and verify schema
- [ ] 2.14 Create seed data script with starter rooms, items, and a test monster

## Task 3: Type Definitions

- [ ] 3.1 Create Player and PlayerStats interfaces
- [ ] 3.2 Create Room and RoomWithContents interfaces
- [ ] 3.3 Create Item, ItemStack, and StatEffects interfaces
- [ ] 3.4 Create Monster and MonsterInstance interfaces
- [ ] 3.5 Create NPC interface
- [ ] 3.6 Create Container interface
- [ ] 3.7 Create Feature, FeatureCondition, and PlayerEffect types
- [ ] 3.8 Create Direction type
- [ ] 3.9 Create command-related types (ParsedCommand, CommandType, CommandContext, CommandResult)
- [ ] 3.10 Create socket event types (all Server->Client and Client->Server events)
- [ ] 3.11 Create AuthResult and related auth types

## Task 4: Authentication System

- [ ] 4.1 Implement password hashing utility (bcrypt)
- [ ] 4.2 Implement JWT token generation and validation utilities
- [ ] 4.3 Implement AuthService.register()
- [ ] 4.4 Implement AuthService.login()
- [ ] 4.5 Implement AuthService.validateToken()
- [ ] 4.6 Implement AuthService.logout()
- [ ] 4.7 Create /api/auth/register REST endpoint
- [ ] 4.8 Create /api/auth/login REST endpoint
- [ ] 4.9 Create auth middleware for protected routes
- [ ] 4.10 Implement Socket.io authentication via JWT in handshake
- [ ] 4.11 Write unit tests for AuthService
- [ ] 4.12 Write property tests for password security (Property 1)
- [ ] 4.13 Write property tests for auth round-trip (Property 2)
- [ ] 4.14 Write property tests for invalid credentials rejection (Property 3)

## Task 5: Character Creation

- [ ] 5.1 Implement character name validation (alphanumeric, unique)
- [ ] 5.2 Implement character creation with default stats
- [ ] 5.3 Implement starting room assignment
- [ ] 5.4 Create /api/characters/create REST endpoint
- [ ] 5.5 Write unit tests for character creation
- [ ] 5.6 Write property tests for character name validation (Property 6)
- [ ] 5.7 Write property tests for character initialization (Property 7)

## Task 6: Room Service

- [ ] 6.1 Implement RoomService.getRoom()
- [ ] 6.2 Implement RoomService.getRoomWithContents() - aggregate players, items, monsters, NPCs, containers, features
- [ ] 6.3 Implement RoomService.movePlayer() with exit validation
- [ ] 6.4 Implement RoomService.getPlayersInRoom()
- [ ] 6.5 Implement RoomService.getRoomsByRegion()
- [ ] 6.6 Write unit tests for RoomService
- [ ] 6.7 Write property tests for room contents completeness (Property 8)
- [ ] 6.8 Write property tests for movement validity (Property 9)

## Task 7: Command Parser

- [ ] 7.1 Implement command tokenizer (split input, handle articles)
- [ ] 7.2 Implement movement command recognition (north, n, go north, etc.)
- [ ] 7.3 Implement chat command recognition (speak, say, shout, whisper)
- [ ] 7.4 Implement item command recognition (get, take, drop, examine, inventory)
- [ ] 7.5 Implement combat command recognition (attack, fight, kill)
- [ ] 7.6 Implement info command recognition (look, stats, help)
- [ ] 7.7 Implement feature command matching (verb + target against room features)
- [ ] 7.8 Implement CommandParser.parse() returning ParsedCommand
- [ ] 7.9 Implement CommandParser.execute() routing to appropriate service
- [ ] 7.10 Write unit tests for CommandParser
- [ ] 7.11 Write property tests for command alias equivalence (Property 10)
- [ ] 7.12 Write property tests for command recognition (Property 11)

## Task 8: Chat Service

- [ ] 8.1 Implement ChatService.speak() - broadcast to room
- [ ] 8.2 Implement ChatService.shout() - broadcast to region
- [ ] 8.3 Implement ChatService.whisper() - private message to player
- [ ] 8.4 Write unit tests for ChatService
- [ ] 8.5 Write property tests for chat message routing (Property 12)

## Task 9: Item Service

- [ ] 9.1 Implement ItemService.getItem() - move from room to player inventory
- [ ] 9.2 Implement ItemService.dropItem() - move from player inventory to room
- [ ] 9.3 Implement ItemService.examineItem() - return item description
- [ ] 9.4 Implement ItemService.getInventory() - list player's items
- [ ] 9.5 Implement container item retrieval (get from container)
- [ ] 9.6 Write unit tests for ItemService
- [ ] 9.7 Write property tests for item transfer round-trip (Property 13)
- [ ] 9.8 Write property tests for item examination (Property 14)
- [ ] 9.9 Write property tests for inventory completeness (Property 15)

## Task 10: Combat Resolver

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

## Task 11: Monster Service

- [ ] 11.1 Implement MonsterService.spawnMonster()
- [ ] 11.2 Implement MonsterService.getMonstersInRoom()
- [ ] 11.3 Implement MonsterService.getMonsterInRoom() - find by name
- [ ] 11.4 Implement MonsterService.damageMonster()
- [ ] 11.5 Implement MonsterService.removeMonster()
- [ ] 11.6 Write unit tests for MonsterService
- [ ] 11.7 Write property tests for monster spawning (Property 19)
- [ ] 11.8 Write property tests for monster instance independence (Property 20)

## Task 12: Feature Service and Effect Handler

- [ ] 12.1 Implement EffectHandler.applyDamage()
- [ ] 12.2 Implement EffectHandler.applyHeal()
- [ ] 12.3 Implement EffectHandler.awardXp()
- [ ] 12.4 Implement EffectHandler.modifyStat()
- [ ] 12.5 Implement EffectHandler.giveItem()
- [ ] 12.6 Implement EffectHandler.teleport()
- [ ] 12.7 Implement EffectHandler.applyStatus()
- [ ] 12.8 Implement EffectHandler.apply() - process array of effects
- [ ] 12.9 Implement FeatureService.getFeaturesInRoom()
- [ ] 12.10 Implement FeatureService.findFeatureByCommand()
- [ ] 12.11 Implement condition checking (stat_check, riddle, item_required)
- [ ] 12.12 Implement FeatureService.interactWithFeature()
- [ ] 12.13 Implement FeatureService.revealFeature()
- [ ] 12.14 Write unit tests for EffectHandler
- [ ] 12.15 Write unit tests for FeatureService

## Task 13: Socket.io Event Handlers

- [ ] 13.1 Implement connection handler with JWT auth
- [ ] 13.2 Implement disconnect handler (update isOnline, notify room)
- [ ] 13.3 Implement 'command' event handler routing to CommandParser
- [ ] 13.4 Implement room:enter broadcast
- [ ] 13.5 Implement room:leave broadcast
- [ ] 13.6 Implement chat:message broadcast
- [ ] 13.7 Implement combat:action and combat:result broadcasts
- [ ] 13.8 Implement player:update emission
- [ ] 13.9 Implement socket room management (join/leave on movement)
- [ ] 13.10 Write unit tests for socket handlers
- [ ] 13.11 Write property tests for socket room membership (Property 21)
- [ ] 13.12 Write property tests for disconnect state update (Property 22)
- [ ] 13.13 Write property tests for reconnection restoration (Property 23)

## Task 14: React Frontend - Core Components

- [ ] 14.1 Set up Socket.io client connection with auth
- [ ] 14.2 Create ChatMessage type and message styling (chat, system, combat, error, whisper, emote)
- [ ] 14.3 Implement ChatPanel component with scrollable message list
- [ ] 14.4 Implement auto-scroll to new messages
- [ ] 14.5 Implement InputPanel component with text input
- [ ] 14.6 Implement command history navigation (up/down arrows)
- [ ] 14.7 Create main Console component composing ChatPanel and InputPanel
- [ ] 14.8 Implement socket event listeners for all server events
- [ ] 14.9 Style components with CSS (dark theme, readable fonts)

## Task 15: React Frontend - Auth Flow

- [ ] 15.1 Create Login component with username/password form
- [ ] 15.2 Create Register component with username/password form
- [ ] 15.3 Implement JWT storage (localStorage or sessionStorage)
- [ ] 15.4 Create auth context/hook for managing auth state
- [ ] 15.5 Implement protected route wrapper
- [ ] 15.6 Create character creation flow for new users
- [ ] 15.7 Implement logout functionality

## Task 16: Integration and Polish

- [ ] 16.1 Wire up Express to serve React build in production
- [ ] 16.2 Create npm scripts for dev (concurrent server + client) and production
- [ ] 16.3 Test full auth flow end-to-end
- [ ] 16.4 Test room navigation end-to-end
- [ ] 16.5 Test chat (speak, shout, whisper) end-to-end
- [ ] 16.6 Test item interactions end-to-end
- [ ] 16.7 Test combat end-to-end
- [ ] 16.8 Test feature interactions end-to-end
- [ ] 16.9 Add error handling for edge cases
- [ ] 16.10 Create README with setup instructions

## Task 17: Deployment Preparation

- [ ] 17.1 Configure for Railway or Fly.io deployment
- [ ] 17.2 Set up production environment variables
- [ ] 17.3 Configure SQLite database path for production
- [ ] 17.4 Test production build locally
- [ ] 17.5 Deploy and verify
