# Implementation Plan: Feats System

## Overview

Implement a Pathfinder-style feats system with 6 starter feats, prerequisite checking, stance mechanics, and CSV seeding. The implementation follows a bottom-up approach: schema → types → parsing → services → effects → commands → integration.

## Tasks

- [ ] 1. Database schema and types
  - [ ] 1.1 Add feats, feat_prerequisites, and player_feats tables to schema
    - Create `feats` table with id, name, prerequisites_text, short_description, long_description, source_book, category, effect_type, supportability_status
    - Create `feat_prerequisites` table with id, feat_id, prerequisite_type, prerequisite_key, prerequisite_value
    - Create `player_feats` table with id, player_id, feat_id, acquired_at with unique constraint on (player_id, feat_id)
    - Add cascade delete on feat_id foreign keys
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 1.2 Add unspent_feat_slots and active_stance columns to players table
    - Add `unspent_feat_slots` integer column defaulting to 0
    - Add `active_stance` text column referencing feats.id (nullable)
    - _Requirements: 4.4, 7.1_

  - [ ] 1.3 Add weaponRange column to items table
    - Add `weaponRange` text column for "melee" or "ranged" values
    - _Requirements: 8.6_

  - [ ] 1.4 Create feat type definitions in src/types/feat.ts
    - Define Feat, FeatPrerequisite, PlayerFeat, WeaponRange types
    - _Requirements: 1.1, 1.4_

- [ ] 2. Checkpoint - Run db:reset and verify schema
  - Run `npm run db:reset` to apply schema changes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Prerequisite parser
  - [ ] 3.1 Create prerequisiteParser.ts with parsePrerequisites function
    - Implement regex patterns for stat requirements `(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)`
    - Implement regex for level requirements `(?:character\s+)?level\s+(\d+)`
    - Implement regex for BAB requirements `base attack bonus \+(\d+)`
    - Implement feat name matching against known feat names
    - Mark unrecognized prerequisites as unsupported
    - Return supportability status based on parsed prerequisites
    - _Requirements: 2.3, 2.5, 2.6, 2.7_

  - [ ] 3.2 Implement scaleLevel function for Pathfinder level conversion
    - Formula: `ourLevel = Math.round(pfLevel * (1 + pfLevel * 0.1))`
    - _Requirements: 2.4_

  - [ ] 3.3 Implement babToLevel function for BAB to level conversion
    - Formula: `requiredLevel = babValue * 3`
    - _Requirements: BAB system_

  - [ ]\* 3.4 Write property test for level scaling (Property 1)
    - **Property 1: Level Scaling Formula**
    - **Validates: Requirements 2.4**

  - [ ]\* 3.5 Write property test for BAB calculation (Property 16)
    - **Property 16: BAB Calculation**
    - **Validates: BAB system**

  - [ ]\* 3.6 Write unit tests for prerequisite parser
    - Test stat parsing: "Dex 13", "Str 15, Int 13"
    - Test level parsing: "level 5", "character level 10"
    - Test BAB parsing: "base attack bonus +1"
    - Test feat matching
    - Test unsupported prerequisites
    - Test empty string
    - _Requirements: 2.3_

- [ ] 4. Feat seeder
  - [ ] 4.1 Create featSeeder.ts to parse CSV and seed feats
    - Parse `feats/feats_with_books_and_categories.csv`
    - Extract name, prerequisites, descriptions, source_book, category
    - Use prerequisiteParser to parse prerequisites
    - Insert feats with supportability_status
    - Insert parsed prerequisites to feat_prerequisites table
    - Preserve original prerequisites_text for display
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8_

  - [ ] 4.2 Seed the 6 starter feats with effect_type values
    - Toughness: effect_type = "hp_bonus"
    - Dodge: effect_type = "ac_bonus"
    - Combat Expertise: effect_type = "combat_stance"
    - Power Attack: effect_type = "combat_stance"
    - Deadly Aim: effect_type = "combat_stance"
    - Two-Weapon Fighting: effect_type = "equipment_unlock"
    - _Requirements: Starter Feats table_

  - [ ] 4.3 Update seed script to include feat seeding
    - Add feat seeder to db:seed command
    - _Requirements: 2.1_

- [ ] 5. Checkpoint - Run db:reset and verify seeding
  - Run `npm run db:reset` to seed feats
  - Verify 6 starter feats exist with correct data
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. FeatService core functions
  - [ ] 6.1 Create FeatService.ts with calculateBAB function
    - Formula: `BAB = floor(level / 3)`
    - _Requirements: BAB system_

  - [ ] 6.2 Implement getPlayerFeats function
    - Query player_feats joined with feats table
    - Return array of Feat records
    - _Requirements: 5.1_

  - [ ] 6.3 Implement getFeatByName function
    - Case-insensitive fuzzy match on feat name
    - _Requirements: 5.3_

  - [ ] 6.4 Implement hasFeat function
    - Check if player has a specific feat by name
    - _Requirements: 6.6_

  - [ ] 6.5 Implement checkPrerequisites function
    - Verify stat requirements against player stats
    - Verify level requirements against player level
    - Verify BAB requirements (converted to level)
    - Verify feat requirements against player_feats
    - Return unmet requirements list
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]\* 6.6 Write property test for prerequisite evaluation (Property 3)
    - **Property 3: Prerequisite Evaluation**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ] 6.7 Implement getAvailableFeats function
    - Filter by: supported status, not already owned, prerequisites met
    - _Requirements: 5.2_

  - [ ]\* 6.8 Write property test for available feats filtering (Property 19)
    - **Property 19: Available Feats Filtering**
    - **Validates: Requirements 5.2**

  - [ ]\* 6.9 Write property test for unsupported feat handling (Property 4)
    - **Property 4: Unsupported Feat Handling**
    - **Validates: Requirements 3.5, 3.6**

- [ ] 7. Feat acquisition
  - [ ] 7.1 Implement grantFeatSlot function
    - Increment unspent_feat_slots by 1
    - _Requirements: 4.2, 4.3_

  - [ ] 7.2 Implement acquireFeat function
    - Validate player has unspent slots
    - Validate player doesn't already have feat
    - Validate prerequisites are met
    - Decrement unspent_feat_slots
    - Create player_feats record with timestamp
    - _Requirements: 4.5, 4.6, 4.7_

  - [ ]\* 7.3 Write property test for even level feat slot grant (Property 5)
    - **Property 5: Even Level Feat Slot Grant**
    - **Validates: Requirements 4.2, 4.3**

  - [ ]\* 7.4 Write property test for feat acquisition invariants (Property 6)
    - **Property 6: Feat Acquisition Invariants**
    - **Validates: Requirements 4.5, 4.7**

  - [ ]\* 7.5 Write property test for zero slots rejection (Property 7)
    - **Property 7: Zero Slots Rejection**
    - **Validates: Requirements 4.6**

  - [ ]\* 7.6 Write property test for unique player-feat constraint (Property 8)
    - **Property 8: Unique Player-Feat Constraint**
    - **Validates: Requirements 1.3**

- [ ] 8. Checkpoint - Verify FeatService core
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Category and filtering functions
  - [ ] 9.1 Implement getFeatsByCategory function
    - Query feats by category with optional supportability filter
    - _Requirements: 10.3_

  - [ ] 9.2 Implement getCategories function
    - Return unique categories with feat counts
    - _Requirements: 10.2_

  - [ ]\* 9.3 Write property test for category filtering (Property 18)
    - **Property 18: Category Filtering**
    - **Validates: Requirements 10.3**

- [ ] 10. Stance system
  - [ ] 10.1 Implement isStanceFeat function
    - Check if feat has effect_type = "combat_stance"
    - _Requirements: 7.5_

  - [ ] 10.2 Implement setActiveStance function
    - Validate player has the stance feat
    - Validate feat is a stance feat
    - Update players.active_stance to feat_id or null
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

  - [ ] 10.3 Implement getActiveStance function
    - Return active stance feat or null
    - _Requirements: 7.6_

  - [ ]\* 10.4 Write property test for single active stance (Property 15)
    - **Property 15: Single Active Stance**
    - **Validates: Requirements 7.4**

- [ ] 11. FeatEffectHandler
  - [ ] 11.1 Create FeatEffectHandler.ts with getToughnessBonus function
    - Formula: +3 HP, +1 HP per level beyond 3rd
    - Return 0 if player doesn't have Toughness
    - _Requirements: 6.2_

  - [ ]\* 11.2 Write property test for Toughness HP bonus (Property 10)
    - **Property 10: Toughness HP Bonus**
    - **Validates: Requirements 6.2**

  - [ ] 11.3 Implement getACModifiers function
    - Return dodge bonus (+1 if player has Dodge)
    - Return stance bonus (+1 if Combat Expertise active)
    - _Requirements: 6.3, 6.4_

  - [ ]\* 11.4 Write property test for Dodge AC bonus (Property 11)
    - **Property 11: Dodge AC Bonus**
    - **Validates: Requirements 6.3**

  - [ ]\* 11.5 Write property test for Combat Expertise stance effects (Property 12)
    - **Property 12: Combat Expertise Stance Effects**
    - **Validates: Requirements 8.1**

  - [ ] 11.6 Implement getAttackModifiers function
    - Return -1 if any stance is active
    - _Requirements: 6.4, 8.1, 8.2, 8.3_

  - [ ] 11.7 Implement getDamageModifiers function
    - Return +2 if Power Attack active and weapon is melee
    - Return +2 if Deadly Aim active and weapon is ranged
    - Return 0 otherwise
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [ ]\* 11.8 Write property test for Power Attack stance effects (Property 13)
    - **Property 13: Power Attack Stance Effects**
    - **Validates: Requirements 8.2, 8.4**

  - [ ]\* 11.9 Write property test for Deadly Aim stance effects (Property 14)
    - **Property 14: Deadly Aim Stance Effects**
    - **Validates: Requirements 8.3, 8.5**

  - [ ] 11.10 Implement canDualWield function
    - Return true if player has Two-Weapon Fighting feat
    - _Requirements: 9.1_

  - [ ]\* 11.11 Write property test for Two-Weapon Fighting validation (Property 17)
    - **Property 17: Two-Weapon Fighting Validation**
    - **Validates: Requirements 9.1, 9.2**

- [ ] 12. Checkpoint - Verify FeatEffectHandler
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Service integrations
  - [ ] 13.1 Integrate FeatEffectHandler into StatService for HP calculation
    - Call getToughnessBonus in calculateMaxHp
    - _Requirements: 6.2_

  - [ ] 13.2 Integrate FeatEffectHandler into StatService for AC calculation
    - Call getACModifiers in calculateAC
    - _Requirements: 6.3, 6.4_

  - [ ] 13.3 Integrate FeatEffectHandler into CombatService for attack rolls
    - Call getAttackModifiers before calculating attack
    - Call getDamageModifiers before calculating damage
    - Pass weapon's weaponRange to getDamageModifiers
    - _Requirements: 6.5, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 13.4 Integrate FeatService into EquipmentService for dual wield validation
    - Call canDualWield before allowing offHand weapon equip
    - Return error message if player lacks Two-Weapon Fighting
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 13.5 Integrate feat slot granting into level-up logic
    - Call grantFeatSlot when player reaches even levels
    - _Requirements: 4.2, 4.3_

- [ ] 14. Checkpoint - Verify service integrations
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Command handlers
  - [ ] 15.1 Create feats command handler
    - `feats` - list owned feats with unspent slots count
    - `feats available` - list acquirable feats
    - `feats info <name>` - show feat details and prerequisite status
    - `feats acquire <name>` - attempt to acquire feat
    - `feats category <name>` - list feats in category
    - Show unavailable feats due to unsupported prerequisites
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]\* 15.2 Write property test for feat slot display (Property 20)
    - **Property 20: Feat Slot Display**
    - **Validates: Requirements 5.6**

  - [ ] 15.3 Create stance command handler
    - `stance` - show current stance with hint
    - `stance <name>` - activate stance
    - `stance off` - deactivate stance
    - _Requirements: 7.6, 7.7, 7.8_

  - [ ] 15.4 Update stats command to show active stance
    - Display stance name and hint for deactivation
    - _Requirements: 7.9_

  - [ ]\* 15.5 Write unit tests for command handlers
    - Test feats command variations
    - Test stance command variations
    - Test stats display with stance
    - _Requirements: 5.1-5.7, 7.6-7.9_

- [ ] 16. Checkpoint - Verify commands
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Database integrity tests
  - [ ]\* 17.1 Write property test for cascade delete (Property 9)
    - **Property 9: Cascade Delete**
    - **Validates: Requirements 1.5**

- [ ] 18. Final checkpoint
  - Run full test suite with `npm test -- --run 2>&1`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (20 runs each)
- Unit tests validate specific examples and edge cases
- Use `npm run db:reset` for schema changes during development
- Test generators go in `tests/generators/` with `Arb` suffix naming convention
