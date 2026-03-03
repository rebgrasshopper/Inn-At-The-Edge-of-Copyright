# Requirements Document

## Introduction

The Feats System adds Pathfinder-style feats to the MUD game, allowing players to gain special abilities and rule modifications as they level up. Feats are sourced from a CSV file containing ~1400 Pathfinder feats, filtered and tagged based on whether the game currently supports their prerequisites. Players gain their first feat at level 2, then every even level thereafter (4, 6, 8, etc.). For v1, only 4 starter feats are implemented: Toughness, Dodge, Combat Expertise, and Two-Weapon Fighting.

## Glossary

- **Feat_Service**: The service responsible for managing feat data, prerequisite checking, and feat acquisition
- **Feat_Seeder**: The component that imports feats from the CSV file into the database
- **Prerequisite_Checker**: The component that evaluates whether a player meets a feat's requirements
- **Feat_Effect_Handler**: The component that applies feat effects to game mechanics (hardcoded per feat for v1)
- **Player**: A game character controlled by a user
- **Feat**: A special ability or rule modification that a player can acquire
- **Feat_Slot**: An opportunity to acquire a feat, granted at level 2 and every even level thereafter
- **Supportability_Status**: Whether a feat's prerequisites can be evaluated by the current game systems (supported, unsupported, or partially_supported)
- **Effect_Type**: The category of mechanical effect a feat provides (hp_bonus, ac_bonus, combat_stance, equipment_unlock)

## Level Scaling

Pathfinder uses levels 1-20, while this game uses levels 1-99. Level-based prerequisites are scaled using the formula:

```
ourLevel = Math.round(pfLevel * (1 + pfLevel * 0.1))
```

This produces the following mapping:

- PF level 5 → Our level 8
- PF level 10 → Our level 20
- PF level 15 → Our level 38
- PF level 20 → Our level 60

## Starter Feats (v1 Scope)

Only these 6 feats are implemented for v1:

| Feat                | Prerequisites  | Effect Type      | Effect                                                 |
| ------------------- | -------------- | ---------------- | ------------------------------------------------------ |
| Toughness           | None           | hp_bonus         | +3 max HP, +1 max HP per level beyond 3rd              |
| Dodge               | Dex 13         | ac_bonus         | +1 AC bonus                                            |
| Combat Expertise    | Int 13         | stance           | Toggle: trade -1 attack for +1 AC                      |
| Power Attack        | Str 13, BAB +1 | stance           | Toggle: trade -1 attack for +2 melee damage            |
| Deadly Aim          | Dex 13, BAB +1 | stance           | Toggle: trade -1 attack for +2 ranged damage           |
| Two-Weapon Fighting | Dex 15         | equipment_unlock | Enables equipping weapons in both mainHand and offHand |

Note: Two-Weapon Fighting enables dual wielding, but off-hand attack penalties are not yet implemented (future backlog item).

## Base Attack Bonus (BAB)

BAB is calculated from player level: `BAB = floor(level / 3)`

| Level | BAB |
| ----- | --- |
| 1-2   | 0   |
| 3-5   | 1   |
| 6-8   | 2   |
| 9-11  | 3   |
| 12-14 | 4   |
| ...   | ... |

This means Power Attack and Deadly Aim (BAB +1) become available at level 3.

## Prerequisite Parsing Scope

### Phase 1 (This Implementation)

The following prerequisite types are supported:

| Type               | Regex Pattern                            | Example                         |
| ------------------ | ---------------------------------------- | ------------------------------- |
| Stat requirements  | `(Str\|Dex\|Con\|Int\|Wis\|Cha)\s+(\d+)` | "Dex 13", "Int 15"              |
| Level requirements | `(?:character\s+)?level\s+(\d+)`         | "level 5", "character level 10" |
| BAB requirements   | `base attack bonus \+(\d+)`              | "base attack bonus +1"          |
| Feat requirements  | Match against feat names in database     | "Dodge", "Combat Expertise"     |

BAB requirements are converted to level requirements using: `requiredLevel = babValue * 3`

All other prerequisite types are marked as `unsupported`.

### Phase 2 (Future Roadmap)

| Type               | Example                          | Blocked By                         |
| ------------------ | -------------------------------- | ---------------------------------- |
| Race               | "Elf", "Human", "Tiefling"       | Race system not implemented        |
| Class              | "Fighter level 4", "Rogue"       | Class system not implemented       |
| Class Features     | "Sneak attack", "Channel energy" | Class system not implemented       |
| Size               | "Small size or smaller"          | Size system not implemented        |
| Skills             | "Acrobatics 5 ranks"             | Skill system not implemented       |
| Weapon Proficiency | "Proficient with longsword"      | Proficiency system not implemented |
| Alignment          | "Lawful alignment"               | Alignment system not implemented   |
| Caster Level       | "Caster level 5th"               | Magic system not implemented       |
| Narrative          | "Have a troubled backstory"      | Cannot be automated                |

## CSV Analysis Summary

From the 1406 feats in the CSV:

- 127 feats have no prerequisites (always available)
- 8 feats have stat-only prerequisites (immediately supportable)
- 32 feats have stat + other feat prerequisites
- 240 feats have feat-only prerequisites (chains)
- 156 feats have level/BAB requirements
- 843 feats require unsupported systems (class/race/skills/etc.)

## Requirements

### Requirement 1: Feat Database Schema

**User Story:** As a developer, I want feats stored in a database table, so that the game can query and manage feat data efficiently.

#### Acceptance Criteria

1. THE Database SHALL store feats in a `feats` table with columns: id, name, prerequisites_text, short_description, long_description, source_book, category, effect_type, and supportability_status
2. THE Database SHALL store player-feat relationships in a `player_feats` table with columns: id, player_id, feat_id, and acquired_at timestamp
3. THE Database SHALL enforce a unique constraint on player_id and feat_id in the player_feats table to prevent duplicate feat assignments
4. THE Database SHALL store parsed prerequisite data in a `feat_prerequisites` table with columns: id, feat_id, prerequisite_type, prerequisite_key, prerequisite_value
5. WHEN a feat is deleted, THE Database SHALL cascade delete related records in feat_prerequisites and player_feats

### Requirement 2: Feat Seeding from CSV

**User Story:** As a developer, I want to import feats from the Pathfinder CSV file, so that players have access to a rich library of feats.

#### Acceptance Criteria

1. THE Feat_Seeder SHALL parse the CSV file at `feats/feats_with_books_and_categories.csv` and insert feats into the database
2. THE Feat_Seeder SHALL extract feat name, prerequisites text, short description, long description, source book, and category from each CSV row
3. THE Feat_Seeder SHALL parse prerequisite text using regex patterns for stat requirements `(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)`, level requirements `(?:character\s+)?level\s+(\d+)`, and feat requirements matched against feat names in the database
4. THE Feat_Seeder SHALL scale Pathfinder level requirements to game levels using the formula `ourLevel = Math.round(pfLevel * (1 + pfLevel * 0.1))`
5. THE Feat_Seeder SHALL mark feats as "supported" when all prerequisites can be evaluated by current game systems (stats, scaled levels, other feats)
6. THE Feat_Seeder SHALL mark feats as "unsupported" when prerequisites require systems not yet implemented (race, class, size, skills, BAB, special abilities, narrative conditions)
7. THE Feat_Seeder SHALL mark feats as "partially_supported" when some prerequisites are evaluable but others are not
8. THE Feat_Seeder SHALL preserve the original prerequisites text for display purposes regardless of parsing success
9. FOR ALL feats with parseable prerequisites, parsing then formatting back to text SHALL produce semantically equivalent prerequisite descriptions (round-trip property)

### Requirement 3: Prerequisite Checking

**User Story:** As a player, I want the game to check if I meet a feat's requirements, so that I can only acquire feats I'm eligible for.

#### Acceptance Criteria

1. WHEN a player attempts to acquire a feat, THE Prerequisite_Checker SHALL verify all stat requirements against the player's current stats (STR, DEX, CON, INT, WIS, CHA)
2. WHEN a player attempts to acquire a feat, THE Prerequisite_Checker SHALL verify level requirements against the player's current level using scaled values
3. WHEN a player attempts to acquire a feat, THE Prerequisite_Checker SHALL verify feat requirements by checking the player_feats table for required feats
4. WHEN a player does not meet all prerequisites, THE Prerequisite_Checker SHALL return a list of unmet requirements with human-readable descriptions
5. THE Prerequisite_Checker SHALL only evaluate prerequisites for feats with supportability_status of "supported"
6. WHEN a feat has supportability_status of "unsupported" or "partially_supported", THE Prerequisite_Checker SHALL indicate the feat is not yet available in the game

### Requirement 4: Feat Acquisition at Level-Up

**User Story:** As a player, I want to gain feat slots as I level up, so that my character grows more powerful over time.

#### Acceptance Criteria

1. THE Feat_Service SHALL grant players 0 unspent feat slots at character creation (level 1)
2. WHEN a player reaches level 2, THE Feat_Service SHALL grant 1 unspent feat slot (first feat opportunity)
3. WHEN a player levels up to an even level (4, 6, 8, etc.), THE Feat_Service SHALL grant 1 additional unspent feat slot
4. THE Player table SHALL track unspent_feat_slots as an integer column defaulting to 0
5. WHEN a player acquires a feat, THE Feat_Service SHALL decrement unspent_feat_slots by 1
6. IF a player has 0 unspent_feat_slots, THEN THE Feat_Service SHALL reject feat acquisition attempts with an appropriate message
7. WHEN a player acquires a feat, THE Feat_Service SHALL create a player_feats record with the current timestamp

### Requirement 5: Feats Command

**User Story:** As a player, I want to view my feats and available feats, so that I can plan my character's progression.

#### Acceptance Criteria

1. WHEN a player enters the `feats` command with no arguments, THE Command_Handler SHALL display the player's acquired feats with names and short descriptions
2. WHEN a player enters `feats available`, THE Command_Handler SHALL display feats the player is eligible to acquire (meets prerequisites, has not acquired, supportability_status is "supported")
3. WHEN a player enters `feats info <feat_name>`, THE Command_Handler SHALL display the feat's full description, prerequisites, and whether the player meets them
4. WHEN a player enters `feats acquire <feat_name>`, THE Command_Handler SHALL attempt to acquire the feat if the player has unspent slots and meets prerequisites
5. WHEN a player enters `feats category <category_name>`, THE Command_Handler SHALL display available feats filtered by category (Combat, Teamwork, etc.)
6. THE Command_Handler SHALL display the player's current unspent feat slots count with all feats command variations
7. WHEN displaying feats, THE Command_Handler SHALL indicate which feats are unavailable due to unsupported prerequisites

### Requirement 6: Feat Effect System

**User Story:** As a developer, I want a system for feats to modify game mechanics, so that feats have meaningful gameplay impact.

#### Acceptance Criteria

1. THE Feat_Effect_Handler SHALL implement hardcoded effect logic for each v1 feat based on effect_type
2. WHEN a player has Toughness, THE Feat_Effect_Handler SHALL add +3 max HP plus +1 max HP per level beyond 3rd to the player's HP calculation
3. WHEN a player has Dodge, THE Feat_Effect_Handler SHALL add +1 to the player's AC calculation
4. WHEN a player has a stance feat active (Combat Expertise, Power Attack, or Deadly Aim), THE Feat_Effect_Handler SHALL apply the appropriate attack and AC/damage modifiers
5. THE Combat_Service SHALL query the Feat_Effect_Handler before calculating attack rolls and AC to apply feat-based modifiers
6. THE Feat_Service SHALL provide a method to check if a player has a specific feat by feat name or id

### Requirement 7: Stance System

**User Story:** As a player, I want to toggle combat stances on and off, so that I can adapt my fighting style to different situations.

#### Acceptance Criteria

1. THE Player table SHALL track active_stance as a nullable feat_id column referencing the feats table
2. WHEN a player activates a stance, THE Feat_Service SHALL set active_stance to the stance feat's id
3. WHEN a player deactivates their stance, THE Feat_Service SHALL set active_stance to null
4. THE Feat_Service SHALL only allow one stance to be active at a time
5. WHEN a player attempts to activate a stance they don't have, THE Feat_Service SHALL reject the action with an appropriate message
6. WHEN a player enters the `stance` command with no arguments, THE Command_Handler SHALL display the currently active stance (or "No stance active")
7. WHEN a player enters `stance <feat_name>`, THE Command_Handler SHALL activate that stance if the player has the feat
8. WHEN a player enters `stance off`, THE Command_Handler SHALL deactivate the current stance
9. WHEN a player views their stats, THE Stats_Display SHALL show the active stance and a hint for how to change it (e.g., "Stance: Power Attack (use 'stance off' to deactivate)")

### Requirement 8: Stance Combat Effects

**User Story:** As a player, I want my active stance to affect combat, so that stance choices are meaningful.

#### Acceptance Criteria

1. WHEN Combat Expertise is active, THE Combat_Service SHALL apply -1 to attack rolls and +1 to AC
2. WHEN Power Attack is active and the player attacks with a melee weapon, THE Combat_Service SHALL apply -1 to attack rolls and +2 to damage
3. WHEN Deadly Aim is active and the player attacks with a ranged weapon, THE Combat_Service SHALL apply -1 to attack rolls and +2 to damage
4. WHEN Power Attack is active but the player attacks with a ranged weapon, THE Combat_Service SHALL NOT apply Power Attack modifiers
5. WHEN Deadly Aim is active but the player attacks with a melee weapon, THE Combat_Service SHALL NOT apply Deadly Aim modifiers
6. THE Items table SHALL include a weaponRange field ("melee" or "ranged") to distinguish weapon types

### Requirement 9: Two-Weapon Fighting Equipment Unlock

**User Story:** As a player, I want to dual wield weapons after acquiring Two-Weapon Fighting, so that I can use different combat styles.

#### Acceptance Criteria

1. WHEN a player has Two-Weapon Fighting feat, THE Equipment_Service SHALL allow equipping weapons in both mainHand and offHand slots
2. WHEN a player without Two-Weapon Fighting attempts to equip a weapon in offHand while mainHand has a weapon, THE Equipment_Service SHALL reject the action with the message "You need the Two-Weapon Fighting feat to dual wield weapons"
3. THE Equipment_Service SHALL query the Feat_Service to check for Two-Weapon Fighting before validating dual-wield equipment

### Requirement 10: Feat Categories and Filtering

**User Story:** As a player, I want to browse feats by category, so that I can find feats relevant to my playstyle.

#### Acceptance Criteria

1. THE Feat_Service SHALL preserve feat categories from the CSV (Combat, Untyped, Story, Mythic, Teamwork, Grit, Panache, etc.)
2. THE Feat_Service SHALL provide a method to list all available categories
3. THE Feat_Service SHALL provide a method to query feats by category with optional supportability filtering
4. WHEN displaying category lists, THE Command_Handler SHALL show the count of available feats per category
