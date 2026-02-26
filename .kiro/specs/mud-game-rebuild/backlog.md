# Backlog

Items to revisit after the initial prototype is working.

## Pending

- [ ] **Feats system**: Add feats table and player_feats junction table. Feats grant special abilities, modify rules (e.g., dual wielding), and unlock options.

- [ ] **Dual wielding restrictions**: By default, players can only equip one weapon. Require a "Two-Weapon Fighting" feat to equip weapons in both mainHand and offHand.

- [ ] **Off-hand penalty**: Weapons in offHand slot should apply reduced attack bonus (e.g., half bonus or -2 penalty) unless player has appropriate feat.

- [ ] **Shout range**: Change `shout` to only reach adjacent/connected rooms instead of region-wide. Keep region-wide announcements available as a system/admin-level feature (e.g., `announce` command).

- [ ] **Temporary stat modifications**: Add support for temporary buffs/debuffs with duration tracking. May need a `player_active_effects` table.

- [ ] **Status effects system**: Create `statuses` table defining possible statuses (poisoned, stunned, blessed, etc.) with their effects. Some statuses affect movement/speech, others do periodic damage/healing, others modify stats temporarily. Need to revisit temporary stat mods when implementing.

- [ ] **Per-player discoveries**: Some hidden features should only be revealed to the player who discovered them (e.g., high-WIS perception check finds hidden nook). Needs a `player_discoveries` table.

- [ ] **Session-based discoveries**: Some discoveries should be visible to all players (e.g., sweeping leaves reveals trapdoor to everyone). Current time-based reset is MVP approximation.

- [ ] **Property 21-23 (Socket tests)**: Defer socket room membership, disconnect state, and reconnection restoration property tests to integration testing phase. These require real socket connections and are better tested end-to-end.

- [ ] **Multi-monster combat unit tests**: Add unit tests for the multi-monster combat state management. Currently only manually tested. Potential tests:
  - `removeMonsterFromCombat()`: Verify player stays in combat with remaining monsters when one dies
  - `addMonsterToCombat()`: Verify monster joins existing player combat correctly
  - `clearPendingAggro()`: Verify timers are cancelled when player leaves room
  - Staggered aggro timing (would need timer mocking with vi.useFakeTimers)

- [ ] **Tab completion**: Add command/target auto-completion in InputPanel (Tab key). Old project had `parseSuggestion` for reference.

- [ ] **Virtual scrolling**: If chat performance degrades with many messages, add react-window or @tanstack/virtual to only render visible messages.

- [ ] **Command history persistence**: Optionally persist command history to localStorage across sessions.

- [ ] **Formatting stats**: Make stats and equipment more nicely formatted.

- [ ] **Item and container sizes**: Add t-shirt size system (tiny, small, medium, large, huge) to items and containers. Items can only be placed in containers strictly smaller than the container (`item.size < container.size`). Huge containers exist mainly to hold large items. Players cannot take huge items.

  **Design decisions:**
  - Containers = room fixtures (chest, hidden cache, hole in tree) - cannot be taken
  - Items with `isContainer: true` = portable containers (pouch, backpack, sack) - can be taken and used from inventory
  - Add `size` field to both items and containers schemas
  - Add `isContainer` boolean to items schema
  - Create `itemInventory` table for items that function as containers
  - Portable containers in player inventory support `put X in Y` and `get X from Y`
  - Defer portable container implementation to later; start with just size enforcement on room containers

- [ ] **Back equipment slot**: Add "back" equipment slot for backpacks/cloaks. Backpacks could function as wearable containers that expand inventory capacity if we implement inventory limits.

- [ ] **EffectHandler registry pattern**: Consider refactoring EffectHandler.ts to use a registry pattern (similar to CommandParser) when more effect types are added. The current switch statement in `apply()` is manageable but could grow unwieldy. Low priority - revisit when adding new effect types.

- [ ] **Expand world map**: Flesh out more locations beyond the starter area. Ideas:
  - Forest depths with wishing well (random luck effects when tossing coins)
  - Cave system accessible from forest
  - Road leading to other villages/towns
  - Riverside or lake area
  - Abandoned ruins with puzzles
  - Each area should have 3-5 rooms with interconnected features
  - Aim for 1 in 5-6 rooms to have a discovery chain (like mushrooms → hidden cache)

- [ ] **Randomized loot from features**: Some features (like bird nests, undergrowth) should give random items from a loot table instead of fixed items. Include cooldown so it's empty if recently looted. Example: nest gives feather (common), egg (rare), or nothing (if looted within last hour).

- [ ] **Unified "can't do that" messaging**: Currently each command handler has to know about corpses, features, monsters, NPCs, etc. to avoid "no X here" messages for things that ARE visible. Consider a centralized "entity resolver" that checks all entity types and returns appropriate "you can't <verb> that" messages instead of "no X here". This would improve maintainability as new entity types are added.

## Standard Feature Trigger Verbs

Use these consistently across all features to avoid player frustration:

- **Search/Discovery**: `search`, `rummage` - for finding hidden things
- **Read/Information**: `read` - for signs, plaques, menus, notices
- **Physical Interaction**: `touch`, `feel`, `push`, `pull`, `pry`, `lift`, `move`, `open` - for manipulating objects
- **Sensory**: `smell`, `sniff`, `listen` - for atmospheric/sensory experiences
- **Rest/Comfort**: `warm`, `rest`, `sit` - for resting spots
- **Play/Games**: `play`, `throw` - for minigames/activities
- **Consume**: `drink`, `taste`, `eat` - for consumables

Note: Don't use `examine`, `inspect`, or `look` as trigger verbs - these are handled by the command system and show descriptions without triggering effects.
