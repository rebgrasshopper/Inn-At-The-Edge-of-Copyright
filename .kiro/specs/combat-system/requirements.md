# Requirements Document

## Introduction

This document specifies the requirements for a real-time combat system in a MUD (multi-user dungeon) game. The combat system enables players to engage in automated interval-based combat with monsters, featuring attack resolution using D&D-style mechanics, flee mechanics, death and respawn systems, and monster aggression behavior.

## Glossary

- **Combat_System**: The server-side system managing all combat interactions between players and monsters
- **Player**: A user-controlled character with stats (STR, DEX, CON, INT, WIS, CHA), HP, XP, and equipment
- **Monster_Instance**: A spawned monster in a specific room with current HP, derived from a Monster definition
- **Monster**: A template definition containing base stats and XP reward for a type of creature
- **Attack_Interval**: The time between automatic attacks, determined by DEX score
- **AC (Armor Class)**: A defensive value determining how hard a target is to hit
- **Stat_Modifier**: The bonus derived from a stat using formula: floor((stat - 10) / 2)
- **Weapon_Damage**: A dice notation string (e.g., "1d6", "2d4+1") representing damage dealt
- **Corpse**: A container created at a player's death location holding their dropped inventory
- **Aggro_Score**: A monster attribute determining automatic attack behavior toward players
- **Combat_State**: The tracking of active combat relationships between players and monsters

## Requirements

### Requirement 1: Initiate Combat

**User Story:** As a player, I want to attack monsters using combat commands, so that I can engage in combat and earn XP.

#### Acceptance Criteria

1. WHEN a player issues an attack command (attack, fight, kill, hit, strike) with a valid monster target, THE Combat_System SHALL initiate combat between the player and the targeted Monster_Instance
2. WHEN a player issues an attack command with an invalid or non-existent target, THE Combat_System SHALL return an error message indicating the target was not found
3. WHEN a player issues an attack command while already in combat with the same target, THE Combat_System SHALL inform the player they are already fighting that target
4. WHEN combat is initiated, THE Combat_System SHALL start automatic attack intervals for both the player and the monster
5. WHEN combat is initiated, THE Combat_System SHALL broadcast a combat start message to all players in the room

### Requirement 2: Attack Interval Timing

**User Story:** As a player, I want my attack speed to be influenced by my DEX score, so that agile characters have an advantage in combat.

#### Acceptance Criteria

1. THE Combat_System SHALL calculate attack intervals using the formula: interval = 3000 - (dexModifier \* 200) milliseconds
2. THE Combat_System SHALL clamp attack intervals to a minimum of 1500ms and maximum of 5000ms
3. WHEN a player's DEX modifier is 0, THE Combat_System SHALL use a base attack interval of 3000ms
4. WHEN a monster attacks, THE Combat_System SHALL use the monster's DEX stat to calculate its attack interval using the same formula
5. WHILE combat is active, THE Combat_System SHALL execute attacks automatically at each combatant's calculated interval

### Requirement 3: Attack Resolution

**User Story:** As a player, I want attacks to be resolved using dice rolls and stats, so that combat feels like a tabletop RPG.

#### Acceptance Criteria

1. WHEN an attack is made, THE Combat_System SHALL roll 1d20 + attacker's DEX modifier for the attack roll
2. THE Combat_System SHALL calculate defender AC as: 10 + DEX modifier + equipment CON bonus
3. WHEN the attack roll meets or exceeds the defender's AC, THE Combat_System SHALL register a hit
4. WHEN the attack roll is below the defender's AC, THE Combat_System SHALL register a miss
5. WHEN a hit is registered and the attacker has a weapon equipped, THE Combat_System SHALL roll the weapon's damage dice + STR modifier
6. WHEN a hit is registered and the attacker has no weapon equipped, THE Combat_System SHALL roll 1d4 + STR modifier for unarmed damage
7. THE Combat_System SHALL enforce a minimum damage of 1 on any successful hit
8. WHEN damage is dealt, THE Combat_System SHALL subtract the damage from the defender's current HP
9. WHEN an attack resolves, THE Combat_System SHALL broadcast the result (hit/miss, damage) to all players in the room

### Requirement 4: Flee Combat

**User Story:** As a player, I want to flee from combat with a chance of failure, so that escape is risky but possible.

#### Acceptance Criteria

1. WHEN a player issues a flee command (flee, run, escape) while in combat, THE Combat_System SHALL attempt a flee check
2. THE Combat_System SHALL calculate flee success using a DEX-based check: roll 1d20 + player DEX modifier vs DC 10 + (monster level - player level) \* 2
3. WHEN the flee check succeeds, THE Combat_System SHALL end combat and move the player to a random available exit
4. WHEN the flee check fails, THE Combat_System SHALL inform the player the flee attempt failed and combat continues
5. IF no exits are available when fleeing, THEN THE Combat_System SHALL inform the player there is nowhere to flee
6. WHEN a player successfully flees, THE Combat_System SHALL broadcast a flee message to the original room
7. WHEN a player successfully flees, THE Combat_System SHALL NOT allow the monster to get a final attack

### Requirement 5: Player Death

**User Story:** As a player, I want death to have meaningful consequences, so that combat feels risky and rewarding.

#### Acceptance Criteria

1. WHEN a player's HP reaches 0 or below, THE Combat_System SHALL trigger player death
2. WHEN a player dies, THE Combat_System SHALL end all active combat for that player
3. WHEN a player dies, THE Combat_System SHALL apply an XP penalty (lose 10% of current XP, minimum 0)
4. WHEN a player dies, THE Combat_System SHALL create a Corpse container at the death location
5. WHEN a player dies, THE Combat_System SHALL transfer all inventory items to the Corpse
6. WHEN a Corpse is created, THE Combat_System SHALL lock it to the owning player for 1 hour
7. WHILE a Corpse is player-locked, THE Combat_System SHALL only allow the owning player to retrieve items
8. WHEN 1 hour has passed since Corpse creation, THE Combat_System SHALL unlock the Corpse for any player
9. WHEN a player dies, THE Combat_System SHALL respawn the player at their respawn point with 1 HP
10. THE Combat_System SHALL use Town Square as the default respawn point for all players
11. WHEN a player dies, THE Combat_System SHALL broadcast a death message to the room

### Requirement 6: Monster Death

**User Story:** As a player, I want to defeat monsters and earn rewards, so that I can progress my character.

#### Acceptance Criteria

1. WHEN a Monster_Instance's HP reaches 0 or below, THE Combat_System SHALL trigger monster death
2. WHEN a monster dies, THE Combat_System SHALL end combat for all players fighting that monster
3. WHEN a monster dies, THE Combat_System SHALL award the monster's XP reward to the player who dealt the killing blow
4. WHEN a monster dies, THE Combat_System SHALL remove the Monster_Instance from the room
5. WHEN a monster dies, THE Combat_System SHALL broadcast a victory message to all players in the room

### Requirement 7: Monster Aggression

**User Story:** As a player, I want some monsters to attack me automatically, so that the world feels dangerous and dynamic.

#### Acceptance Criteria

1. THE Monster definition SHALL include an aggro_score field (integer, default 0)
2. WHEN a monster has aggro_score of 0, THE Combat_System SHALL only initiate combat when the monster is attacked first
3. WHEN a monster has aggro_score greater than 0, THE Combat_System SHALL automatically attack players at or below that level
4. WHEN a player enters a room with aggressive monsters, THE Combat_System SHALL check for aggro triggers
5. WHEN multiple players are valid aggro targets, THE Combat_System SHALL select one randomly to attack

### Requirement 8: Combat State Management

**User Story:** As a player, I want combat to be tracked reliably, so that the game state remains consistent.

#### Acceptance Criteria

1. THE Combat_System SHALL track which players are in combat with which Monster_Instances
2. THE Combat_System SHALL allow multiple players to attack the same Monster_Instance simultaneously
3. WHEN multiple players attack the same monster, THE Combat_System SHALL have the monster attack all engaged players
4. WHEN a player disconnects during combat, THE Combat_System SHALL trigger player death
5. WHEN a player reconnects after combat disconnect, THE Combat_System SHALL have them at their respawn point
6. WHEN combat ends for any reason, THE Combat_System SHALL clean up all combat state for the affected combatants

### Requirement 9: Dice Rolling

**User Story:** As a developer, I want a reliable dice rolling system, so that combat calculations are accurate.

#### Acceptance Criteria

1. THE Combat_System SHALL parse dice notation strings in format "NdS" (e.g., "1d6", "2d4")
2. THE Combat_System SHALL parse dice notation with modifiers in format "NdS+M" or "NdS-M" (e.g., "1d6+2", "2d4-1")
3. WHEN rolling dice, THE Combat_System SHALL generate random values between 1 and the die size (inclusive) for each die
4. THE Combat_System SHALL sum all dice results and apply any modifier
5. THE Combat_System SHALL provide a pretty-printer to format dice roll results for display
6. FOR ALL valid dice notation strings, parsing then pretty-printing then parsing SHALL produce an equivalent result (round-trip property)

### Requirement 10: Stat Modifier Calculation

**User Story:** As a developer, I want consistent stat modifier calculations, so that combat math follows D&D conventions.

#### Acceptance Criteria

1. THE Combat_System SHALL calculate stat modifiers using the formula: floor((stat - 10) / 2)
2. WHEN a stat is 10 or 11, THE Combat_System SHALL return a modifier of 0
3. WHEN a stat is below 10, THE Combat_System SHALL return a negative modifier
4. WHEN a stat is above 11, THE Combat_System SHALL return a positive modifier
