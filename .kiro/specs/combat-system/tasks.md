# Implementation Plan: Combat System

## Overview

Implement a real-time, interval-based combat system for the MUD game. The implementation follows a bottom-up approach: first building pure utility functions (dice, stats), then combat mechanics, then integration with the existing command system and socket handlers.

## Tasks

- [x] 1. Implement Dice Service
  - [x] 1.1 Create `src/services/DiceService.ts` with types and parsing
    - Define `DiceRoll` and `RollResult` types
    - Implement `parseDiceNotation()` to parse "NdS", "NdS+M", "NdS-M" formats
    - Implement `formatDiceNotation()` to convert DiceRoll back to string
    - Implement `rollDice()` to execute a roll and return results
    - Implement `roll()` convenience function
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]\* 1.2 Write property tests for dice notation round-trip
    - **Property 16: Dice Notation Round-Trip**
    - **Validates: Requirements 9.5, 9.6**

  - [ ]\* 1.3 Write property tests for dice roll bounds
    - **Property 15: Dice Roll Bounds**
    - **Validates: Requirements 9.3, 9.4**

  - [ ]\* 1.4 Write property tests for dice notation parsing
    - **Property 14: Dice Notation Parsing**
    - **Validates: Requirements 9.1, 9.2**

- [x] 2. Implement Stat Service
  - [x] 2.1 Create `src/services/StatService.ts` with modifier calculations
    - Implement `getStatModifier()` using floor((stat - 10) / 2)
    - Implement `calculateAC()` for armor class
    - Implement `calculateAttackInterval()` with clamping (1500-5000ms)
    - _Requirements: 10.1, 2.1, 2.2, 3.2_

  - [ ]\* 2.2 Write property tests for stat modifier calculation
    - **Property 1: Stat Modifier Calculation**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

  - [ ]\* 2.3 Write property tests for attack interval calculation
    - **Property 2: Attack Interval Calculation**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ]\* 2.4 Write property tests for AC calculation
    - **Property 3: AC Calculation**
    - **Validates: Requirements 3.2**

- [x] 3. Checkpoint - Core utilities complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Database schema updates
  - [x] 4.1 Add `aggroScore` field to monsters table in `src/db/schema.ts`
    - Add `aggroScore: integer("aggro_score").notNull().default(0)`
    - _Requirements: 7.1_

  - [x] 4.2 Add `respawnRoomId` field to players table
    - Add `respawnRoomId: text("respawn_room_id")`
    - _Requirements: 5.9, 5.10_

  - [x] 4.3 Create corpses and corpseInventory tables
    - Add `corpses` table with id, playerId, roomId, createdAt, unlocksAt
    - Add `corpseInventory` table with id, corpseId, itemId, quantity
    - _Requirements: 5.4, 5.5, 5.6_

  - [x] 4.4 Run database migration
    - Generate and apply migration for new schema
    - _Requirements: 5.4, 7.1_

- [x] 5. Implement Combat Types
  - [x] 5.1 Create `src/types/combat.ts` with combat type definitions
    - Define `CombatParticipant`, `ActiveCombat`, `AttackResult`, `FleeResult`, `CombatResult` types
    - _Requirements: 8.1_

- [x] 6. Implement Combat Service - Core Mechanics
  - [x] 6.1 Create `src/services/CombatService.ts` with combat state management
    - Create in-memory maps: `activeCombats`, `playerCombatMap`, `monsterCombatMap`
    - Implement `isInCombat()`, `getCombatForPlayer()`, `getCombatForMonster()`
    - _Requirements: 8.1, 8.2_

  - [x] 6.2 Implement attack resolution logic
    - Implement `processAttack()` with d20 + DEX vs AC
    - Calculate damage using weapon dice or 1d4 unarmed + STR modifier
    - Enforce minimum 1 damage on hits
    - Update defender HP
    - _Requirements: 3.1, 3.3, 3.5, 3.6, 3.7, 3.8_

  - [ ]\* 6.3 Write property tests for hit determination
    - **Property 4: Hit Determination**
    - **Validates: Requirements 3.3, 3.4**

  - [ ]\* 6.4 Write property tests for damage bounds
    - **Property 5: Damage Bounds**
    - **Validates: Requirements 3.5, 3.6, 3.7**

  - [ ]\* 6.5 Write property tests for HP reduction
    - **Property 6: HP Reduction**
    - **Validates: Requirements 3.8**

- [x] 7. Implement Combat Service - Combat Flow
  - [x] 7.1 Implement `initiateCombat()` function
    - Validate target exists in room
    - Check if already in combat with target
    - Create combat state and start attack intervals
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 7.2 Implement attack interval timers
    - Schedule automatic attacks at calculated intervals
    - Handle timer cleanup on combat end
    - _Requirements: 2.4, 2.5_

  - [x] 7.3 Implement `endCombatForPlayer()` and combat cleanup
    - Clear timers and combat state
    - Handle multi-player combat (monster continues fighting others)
    - _Requirements: 8.6_

- [x] 8. Implement Flee Mechanics
  - [x] 8.1 Implement `attemptFlee()` function
    - Roll 1d20 + DEX modifier vs DC 10 + (monster level - player level) \* 2
    - On success: end combat, move to random exit
    - On failure: return failure message, combat continues
    - Handle no exits case
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

  - [ ]\* 8.2 Write property tests for flee DC calculation
    - **Property 7: Flee DC Calculation**
    - **Validates: Requirements 4.2**

- [x] 9. Checkpoint - Combat mechanics complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Death Handling
  - [x] 10.1 Implement `handlePlayerDeath()` function
    - End all combat for player
    - Apply XP penalty (10%, minimum 0)
    - Create corpse at death location
    - Transfer inventory to corpse
    - Respawn at respawn point with 1 HP
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.9, 5.10_

  - [ ]\* 10.2 Write property tests for death trigger
    - **Property 8: Death Trigger**
    - **Validates: Requirements 5.1, 6.1**

  - [ ]\* 10.3 Write property tests for XP penalty calculation
    - **Property 9: XP Penalty Calculation**
    - **Validates: Requirements 5.3**

  - [x] 10.4 Implement `handleMonsterDeath()` function
    - End combat for all players fighting monster
    - Award XP to killing player
    - Remove monster instance from database
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]\* 10.5 Write property tests for XP award
    - **Property 12: XP Award**
    - **Validates: Requirements 6.3**

- [x] 11. Implement Corpse Service
  - [x] 11.1 Create `src/services/CorpseService.ts`
    - Implement `createCorpse()` with 1-hour lock
    - Implement `transferInventoryToCorpse()`
    - Implement `canLootCorpse()` based on ownership and time
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]\* 11.2 Write property tests for corpse access control
    - **Property 11: Corpse Access Control**
    - **Validates: Requirements 5.6, 5.7, 5.8**

- [x] 12. Implement Monster Aggro
  - [x] 12.1 Implement `checkMonsterAggro()` function
    - Query monsters in room with aggroScore > 0
    - Check if any player level <= aggroScore
    - Initiate combat with random valid target
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [ ]\* 12.2 Write property tests for aggro trigger
    - **Property 13: Aggro Trigger**
    - **Validates: Requirements 7.3**

- [x] 13. Checkpoint - Combat services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Integrate with Command System
  - [x] 14.1 Add flee command aliases to `src/services/commands/aliases.ts`
    - Add flee, run, escape mapped to Command.Flee
    - _Requirements: 4.1_

  - [x] 14.2 Add Command.Flee to command types
    - Update `src/services/commands/types.ts`
    - _Requirements: 4.1_

  - [x] 14.3 Create `src/services/commands/handlers/combat.ts`
    - Implement attack command handler (resolve target, call initiateCombat)
    - Implement flee command handler (call attemptFlee)
    - _Requirements: 1.1, 1.2, 4.1_

  - [x] 14.4 Wire combat handlers into command router
    - Update `src/services/commands/index.ts` to route attack and flee commands
    - _Requirements: 1.1, 4.1_

- [x] 15. Integrate with Socket Handlers
  - [x] 15.1 Add combat event broadcasts to socket handlers
    - Broadcast combat start, attack results, flee, death, victory messages
    - _Requirements: 1.5, 3.9, 4.6, 5.11, 6.5_

  - [x] 15.2 Add aggro check to room entry handler
    - Call `checkMonsterAggro()` when player enters room
    - _Requirements: 7.4_

  - [x] 15.3 Handle player disconnect during combat
    - Call `handlePlayerDeath()` if player disconnects while in combat
    - _Requirements: 8.4, 8.5_

- [x] 16. Update Seed Data
  - [x] 16.1 Add aggroScore to existing monster seed data
    - Set appropriate aggro levels for existing monsters
    - _Requirements: 7.1_

  - [x] 16.2 Set Town Square as default respawn point
    - Ensure Town Square room exists and is used as default
    - _Requirements: 5.10_

- [x] 17. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify combat flow works end-to-end manually

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use fast-check with 20 runs (per coding standards)
- Generators use `Arb` suffix (e.g., `statValueArb`)
- Combat state is in-memory only; disconnects trigger death to avoid stale state
