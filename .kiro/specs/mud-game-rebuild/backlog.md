# Backlog

Items to revisit after the initial prototype is working.

## Pending

- [ ] **BUG: Phantom "look" output after howl/spawn** (intermittent)

  **Symptom:** After using "howl wolf" to spawn a monster, the full room description sometimes appears unexpectedly (as if "look" was typed). This is intermittent — happens ~50% of the time, hard to reproduce on demand.

  **Example output showing the bug:**

  ```
  wolf swings at Djim but misses!
  You let out a howl... A wolf appears!
  Forest Clearing                          <-- UNEXPECTED
  You emerge into a small clearing...      <-- UNEXPECTED
  Exits: north                             <-- UNEXPECTED
  Creatures here: wolf, wolf               <-- UNEXPECTED
  You see: rusty sword                     <-- UNEXPECTED
  wolf attacks Djim!
  ```

  **Investigation notes:**
  - Only two events display room descriptions on client: `room:look` and `room:enter`
  - `room:look` is ONLY emitted by `handleLook` in `src/services/commands/handlers/info.ts`
  - `room:enter` is emitted by: connection, death respawn, and room change (movement)
  - Feature interaction code (`src/services/commands/index.ts` lines 232-275) does NOT return any broadcast — just a message
  - `checkMonsterAggro` and `initiateCombat` don't emit room events
  - Client event handlers in `useGameSocket.ts` have proper cleanup (socket.off in return)
  - Socket reconnection logic exists but shouldn't trigger during active play

  **Ruled out:**
  - Feature interaction returning room:look broadcast (it doesn't)
  - CombatService emitting room events (it doesn't)
  - EffectHandler spawn_monster emitting events (it doesn't)
  - Duplicate client event subscriptions (cleanup looks correct)

  **Questions to answer when bug reproduces:**
  1. Does it happen only during existing combat, or also when starting fresh (no prior combat)?
  2. Where does the room description appear relative to other messages? (Always after "A wolf appears!"? Before "wolf attacks"?)
  3. Is there any pattern to when it happens vs doesn't?
  4. Check browser network tab — is a `room:look` or `room:enter` event actually being received?

  **Possible causes to investigate:**
  - Race condition with async `checkMonsterAggro` timers
  - Something in combat initiation flow triggering unexpected event
  - Client-side React re-render causing duplicate message display
  - Socket.io event delivery timing issue

  **Debug approach when it reproduces:**
  - Add `console.log` in client's `handleRoomLook` and `handleRoomEnter` to see which fires
  - Add server-side logging when `room:look` or `room:enter` is emitted
  - Check if the room description appears once or twice (duplicate events vs single unexpected event)

- [ ] **INT → Spell system**: Add spells that players can learn/use based on INT modifier. Number of spell slots = INT modifier (minimum 0). Include a basic attack spell (e.g., "magic missile") so non-STR builds have a combat option. Spells could use a `spells` table and `player_spells` junction table.

- [ ] **WIS → Perception/Discovery**: WIS modifier affects chance to notice hidden features, traps, or secrets. Could also affect saving throws against illusions or mind effects.

- [ ] **CHA → NPC interactions**: CHA modifier affects NPC disposition, shop prices, quest rewards, or persuasion checks. Could unlock special dialogue options.

- [ ] **Feats system**: Add feats table and player_feats junction table. Feats grant special abilities, modify rules (e.g., dual wielding), and unlock options.

- [ ] **Dual wielding restrictions**: By default, players can only equip one weapon. Require a "Two-Weapon Fighting" feat to equip weapons in both mainHand and offHand.

- [ ] **Off-hand penalty**: Weapons in offHand slot should apply reduced attack bonus (e.g., half bonus or -2 penalty) unless player has appropriate feat.

- [ ] **Shout range**: Change `shout` to only reach adjacent/connected rooms instead of region-wide. Keep region-wide announcements available as a system/admin-level feature (e.g., `announce` command).

- [ ] **Temporary stat modifications**: Add support for temporary buffs/debuffs with duration tracking. May need a `player_active_effects` table.

- [ ] **Status effects system**: Create `statuses` table defining possible statuses (poisoned, stunned, blessed, etc.) with their effects. Some statuses affect movement/speech, others do periodic damage/healing, others modify stats temporarily. Need to revisit temporary stat mods when implementing.

- [ ] **Per-player discoveries**: Some hidden features should only be revealed to the player who discovered them (e.g., high-WIS perception check finds hidden nook). Needs a `player_discoveries` table.

- [ ] **Session-based discoveries**: Some discoveries should be visible to all players (e.g., sweeping leaves reveals trapdoor to everyone). Current time-based reset is MVP approximation.

- [ ] **Property 21-23 (Socket tests)**: Defer socket room membership, disconnect state, and reconnection restoration property tests to integration testing phase. These require real socket connections and are better tested end-to-end.

- [ ] **Examine monsters**: Currently `examine` only handles items, features, and containers. Add support for examining monsters in the room to see their description, level, and possibly HP status (e.g., "healthy", "wounded", "near death").

- [ ] **Level up feat notification**: When a player levels up, check if they have any feats available to acquire and include a hint in the level-up message (e.g., "You have feats available! Use 'feats available' to see them."). Currently only mentions attribute points.

- [ ] **Target command for combat**: Add a `target <monster>` command to let players manually switch their attack target mid-combat. Currently players auto-target the first monster they attack, and auto-switch to another attacker when their target dies. Manual targeting would let players prioritize dangerous threats. Implementation: clear current attack timer, find the new target in combat participants, reschedule attack against new target.

- [ ] **Multi-monster combat unit tests**: Add unit tests for the multi-monster combat state management. Currently only manually tested. Potential tests:
  - `removeMonsterFromCombat()`: Verify player stays in combat with remaining monsters when one dies
  - `addMonsterToCombat()`: Verify monster joins existing player combat correctly
  - `clearPendingAggro()`: Verify timers are cancelled when player leaves room
  - Staggered aggro timing (would need timer mocking with vi.useFakeTimers)

- [ ] **UX: "look self" vs "stats" consistency**: Currently `look self` shows basic info (name, level, HP, equipment list) while `stats` shows detailed stats with equipment bonuses. Users may expect to see stat bonuses in both places. Consider whether to: (a) add stat bonuses to `look self`, (b) merge the commands, (c) add a hint in `look self` output to use `stats` for details, or (d) keep as-is. Need to balance information density vs discoverability.

- [ ] **Dice roll display toggle**: Add a player setting to show the dice rolls behind attacks, damage, and other mechanics. When enabled, display in a different color (e.g., gray or dim) the actual d20 rolls, modifiers, and calculations. Example: "Djim strikes wolf for 7 damage! [d20+5=18 vs AC 12, d6+2=7]". Store as a boolean flag on the player record or in a separate player_settings table.

- [ ] **Equipment bonuses → attack/damage/AC instead of stats**: Currently weapons boost STR and armor boosts CON, which then affect derived values. Change to direct attack bonus, damage bonus, and AC bonus instead. This is more intuitive and matches tabletop conventions. Keep the door open for actual stat-boosting items (like a Belt of Giant Strength) as a separate category. May need new columns on items table: `attackBonus`, `damageBonus`, `acBonus`.

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
