# Backlog

Items to revisit after the initial prototype is working.

## Pending

- [ ] **INT → Spell system**: Add spells that players can learn/use based on INT modifier. Number of spell slots = INT modifier (minimum 0). Include a basic attack spell (e.g., "magic missile") so non-STR builds have a combat option. Spells could use a `spells` table and `player_spells` junction table.

- [ ] **WIS → Perception/Discovery**: WIS modifier affects chance to notice hidden features, traps, or secrets. Could also affect saving throws against illusions or mind effects.

- [ ] **CHA → NPC interactions**: CHA modifier affects NPC disposition, shop prices, quest rewards, or persuasion checks. Could unlock special dialogue options.

- [x] **Feats system**: Add feats table and player_feats junction table. Feats grant special abilities, modify rules (e.g., dual wielding), and unlock options.

- [ ] **Dual wielding restrictions**: By default, players can only equip one weapon. Require a "Two-Weapon Fighting" feat to equip weapons in both mainHand and offHand. NOTE: The feat is in place, but the penalties for dual weapon wielding need to be enacted.

- [ ] **Shout range**: Change `shout` to only reach adjacent/connected rooms instead of region-wide. Keep region-wide announcements available as a system/admin-level feature (e.g., `announce` command).

- [ ] **Temporary stat modifications**: Add support for temporary buffs/debuffs with duration tracking. May need a `player_active_effects` table.

- [ ] **Status effects system**: Create `statuses` table defining possible statuses (poisoned, stunned, blessed, etc.) with their effects. Some statuses affect movement/speech, others do periodic damage/healing, others modify stats temporarily. Need to revisit temporary stat mods when implementing.

- [ ] **Session-based discoveries**: Some discoveries should be visible to all players (e.g., sweeping leaves reveals trapdoor to everyone). Current time-based reset is MVP approximation.

- [ ] **Show personal discovery to another player**: Add a `show <feature> to <player>` command that lets a player share their personal discovery with another player in the same room. Would add the feature/container ID to the target player's discovered list. Useful for cooperative exploration.

- [ ] **Property 21-23 (Socket tests)**: Defer socket room membership, disconnect state, and reconnection restoration property tests to integration testing phase. These require real socket connections and are better tested end-to-end.

- [ ] **Examine monsters**: Currently `examine` only handles items, features, and containers. Add support for examining monsters in the room to see their description, level, and possibly HP status (e.g., "healthy", "wounded", "near death").

- [ ] **Target command for combat**: Add a `target <monster>` command to let players manually switch their attack target mid-combat. Currently players auto-target the first monster they attack, and auto-switch to another attacker when their target dies. Manual targeting would let players prioritize dangerous threats. Implementation: clear current attack timer, find the new target in combat participants, reschedule attack against new target.

- [ ] **Multi-monster combat unit tests**: Add unit tests for the multi-monster combat state management. Currently only manually tested. Potential tests:
  - `removeMonsterFromCombat()`: Verify player stays in combat with remaining monsters when one dies
  - `addMonsterToCombat()`: Verify monster joins existing player combat correctly
  - `clearPendingAggro()`: Verify timers are cancelled when player leaves room
  - Staggered aggro timing (would need timer mocking with vi.useFakeTimers)

- [ ] **UX: "look self" vs "stats" consistency**: Currently `look self` shows basic info (name, level, HP, equipment list) while `stats` shows detailed stats with equipment bonuses. Users may expect to see stat bonuses in both places. Consider whether to: (a) add stat bonuses to `look self`, (b) merge the commands, (c) add a hint in `look self` output to use `stats` for details, or (d) keep as-is. Need to balance information density vs discoverability.

- [ ] **Tab completion**: Add command/target auto-completion in InputPanel (Tab key). Old project had `parseSuggestion` for reference.

- [ ] **Command history persistence**: Optionally persist command history to localStorage across sessions.

- [ ] **Formatting stats**: Make stats and equipment more nicely formatted.

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

- [ ] **Client-side roll info toggle**: Move roll visibility logic from server to client. Currently server checks user preference before including rollInfo in messages. Change to: (1) Server always sends rollInfo when available, (2) Client stores rollInfo on all messages, (3) ChatMessage component checks preference before rendering rollInfo. This allows retroactive visibility - player can toggle on to see past rolls, then toggle off again. Implementation: Add `preferences` to player data sent on `room:enter`, store in GameContext, access from ChatMessage component. Removes preference check from `handleCommand` and `broadcastCombatEvent` on server.

- [ ] **Day/night cycle**: Rooms can have alternate descriptions based on time of day. Example: The sparkling stream could sparkle in sunlight during day and moonlight at night. Would need `dayDescription` and `nightDescription` fields on rooms, plus a time-of-day system.

- [ ] **Swimming skill**: Track swimming failures, every 20-30 failures grants a skill improvement that reduces swim DC or damage taken. Would need a skills system with `player_skills` table.

- [ ] **Underground region content**: Populate the cave system with new rooms, monsters (cave creatures like bats, cave spiders, blind fish), and features. The Cave Passage currently has blocked rubble that could be cleared to reveal deeper caves.

- [ ] **Swimming activity restrictions**: While swimming, players should not be able to: attack, equip/unequip items (except maybe head slot), pick up items from the ground, etc. Currently only movement is blocked.

## Feature Ideas

Ideas for future features that aren't fully fleshed out yet.

- [ ] **Echo Canyon/Chamber**: A location with natural rock formations that create echoes. Could have a flavor feature where players can "shout" or "yell" and hear their voice echo back with atmospheric text. Maybe the echo reveals something hidden, or attracts attention (friendly or hostile). Could tie into the sound/listen verb category.
