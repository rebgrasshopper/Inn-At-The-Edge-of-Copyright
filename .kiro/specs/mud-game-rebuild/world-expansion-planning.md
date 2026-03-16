# World Expansion Planning

Ideas and guidelines for expanding the game world beyond the starter area.

## Current Map Structure

```
                    [Library]
                        |
[Tavern] -- [Town Square] -- [Market]
                |
           [Forest Path]
                |
         [Forest Clearing] -- [Sparkling Stream]
                                    |
                              [Hidden Cavern] -- [Cave Passage]
```

## Stat Usage by Feature Type

Guidelines for which stats govern different interactions:

| Stat | Primary Uses                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------ |
| STR  | Physical challenges (swimming against current, moving heavy objects, breaking things)            |
| DEX  | Agility challenges (climbing, balancing, sneaking, pickpocketing)                                |
| CON  | Endurance challenges (holding breath, resisting poison, surviving harsh conditions)              |
| INT  | Knowledge checks (identifying items, reading ancient texts, solving logic puzzles), spellcasting |
| WIS  | Perception (finding hidden things, noticing traps, reading people), divine magic (future)        |
| CHA  | Social interactions (persuasion, intimidation, haggling), NPC disposition                        |

## Feature Design Patterns

### Discovery Chains

A sequence of discoveries where finding one thing leads to another:

- Example: Search mushrooms → find hidden cache → cache contains key → key opens locked chest elsewhere
- Aim for 1 discovery chain per 5-6 rooms
- Keep chains to 2-3 steps max to avoid frustration

### Perception DCs (WIS-based)

For hidden things found via `search` command:

- DC 8: Obvious hiding spots (coins in cracks, items under furniture)
- DC 10: Moderate concealment (bird nests, things behind objects)
- DC 12: Well-hidden (secret compartments, camouflaged items)
- DC 14: Expertly concealed (underwater secrets, magical concealment)
- DC 16+: Nearly impossible to find without hints

### Interaction Conditions

For challenges after discovery:

- DC 10: Easy (most players succeed)
- DC 12: Moderate (average stat succeeds ~50%)
- DC 14: Challenging (requires good stat or luck)
- DC 16: Hard (requires high stat)
- DC 18+: Very hard (requires exceptional stat or buffs)

## Planned Regions

### Deep Forest (South of Clearing)

- 3-4 rooms of increasingly dense forest
- Darker atmosphere, more dangerous creatures
- Features: Ancient shrine, druid circle, wolf den
- Monsters: Wolves (packs), giant spiders, forest spirits
- Discovery: Hidden druid cache with nature-themed items

### Wishing Well Area (Forest Branch)

- Single room with interactive well
- Toss coins for random effects (luck-based)
- Possible effects: Small heal, small damage, temporary buff, spawn friendly/hostile creature
- Could tie into CHA stat for "luck" interpretation

### Cave System (Beyond Rubble)

- Requires clearing rubble (STR check or explosives item)
- 4-5 rooms of underground exploration
- Features: Glowing crystals, underground river, ancient carvings
- Monsters: Cave bats, blind fish, cave spiders, possibly a boss creature
- Discovery: Rare minerals, ancient artifacts

### Road to Other Villages (East from Town)

- Connects to future expansion areas
- Roadside encounters: Traveling merchants, bandits, fellow adventurers
- Rest stops with inns
- Bridges over rivers (toll or puzzle to cross)

### Riverside/Lake Area

- Fishing mechanics (future)
- Swimming challenges
- Water-based creatures
- Boat travel to islands (future)

### Abandoned Ruins

- Puzzle-heavy area
- Riddle doors, pressure plates, ancient mechanisms
- Undead creatures
- Treasure vault at the end

## NPC Types to Add

### Merchants

- General store (basic supplies)
- Blacksmith (weapons, armor)
- Alchemist (potions, reagents)
- Traveling merchant (rare items, appears randomly)

### Quest Givers

- Village elder (main storyline)
- Bounty board (monster hunting)
- Mysterious stranger (side quests)

### Ambient NPCs

- Villagers with gossip/hints
- Guards with warnings about dangerous areas
- Other adventurers (potential party members?)

## Monster Design Guidelines

### Aggro Levels

- 0: Passive (only fights if attacked) - deer, rabbits
- 1-3: Attacks low-level players on sight - goblins, wolves
- 4-6: Attacks mid-level players - bandits, large predators
- 7+: Attacks anyone - boss creatures, territorial monsters

### Monster Groups

- Pack behavior: All wolves in a room attack together
- Territorial: One attacks, others watch unless you're winning
- Cowardly: Flee when health is low or allies die

### Respawn Considerations

- Common monsters: 2-5 minute respawn
- Rare monsters: 15-30 minute respawn
- Boss monsters: 1+ hour respawn, possibly daily

## Trap Ideas (Future Feature)

Traps would require WIS check to notice before triggering:

- Pit trap: Fall damage, STR to climb out
- Poison dart: CON save to resist poison status
- Alarm: Alerts nearby monsters
- Snare: Immobilizes until freed (DEX or STR)
- Magical trap: Various effects based on trap type

## Ambush Mechanics (Future Feature)

Aggressive monsters could have ambush behavior:

- WIS check when entering room with ambushing monster
- Success: "You notice movement in the shadows..." (get initiative)
- Failure: Monster gets free attack before combat starts

## Day/Night Cycle Ideas

- Different room descriptions for day vs night
- Some creatures only appear at night (undead, nocturnal predators)
- Some areas darker at night (require light source)
- NPC schedules (shops closed at night, tavern busier)

## Echo Canyon/Chamber Idea

A location with natural acoustics:

- `shout` or `yell` command produces echo effect
- Flavor text describes voice bouncing off walls
- Could attract attention (spawn encounter)
- Could reveal hidden things (sound-based puzzle)
- Ties into the "listen" verb category

## Implementation Priority

1. WIS perception system (in progress)
2. Deep Forest expansion (next)
3. Cave system (after rubble mechanic)
4. Day/night cycle
5. Trap system
6. Additional villages/regions
