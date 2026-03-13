# Backlog

Items to revisit after the initial prototype is working.

## Dual-User Testing Findings (March 2026)

Issues found during first multiplayer testing session, ordered from smallest to largest fix:

- [x] **Add "loot" as alias for "get all from"**: "loot corpse" should work as shorthand for "get all from corpse".

- [x] **Wearing already-equipped item gives confusing message**: Trying to wear an item you're already wearing says "You equip the leather cap on your head (removing leather cap)." Should say "You're already wearing that." or similar.

- [x] **"look <myPlayerName>" should resolve to "look self"**: Looking at your own character name should use the self-view logic, not the "look at other player" logic.

- [x] **Show direction when player leaves**: When another player leaves the room, show which direction they went. E.g., "Fox leaves to the north." instead of just "Fox has left."

- [x] **No broadcast when player picks up item**: Other players in the room don't see a message when someone picks up an item. Should broadcast something like "Fox picks up a rusty sword."

- [x] **Look at other players shows too much info**: When looking at another player, you currently see their full stats (STR, DEX, etc.), level, HP, AC, XP. Should only show a description and visible equipped items — not their private stats. The "You don't have anything equipped" message is also wrong (should be "They don't have..." or list their gear).

- [x] **Equip fuzzy match should prioritize unequipped items**: When using "wear" or "equip" with a fuzzy item name, prioritize matching unequipped items over already-equipped ones. Avoids the "already wearing that" issue when you have duplicates.

- [x] **"look <item>" should check inventory**: When looking at an item by name, it should also search the player's inventory, not just the room. E.g., "look sword" should work if you're carrying a sword.

- [x] **Monster spawn not broadcast to room**: When a monster spawns (via admin command or respawn system), other players in the room don't see it appear. Should broadcast something like "A wolf emerges from the shadows."

- [x] **Split XP for group combat**: When multiple players fight the same monster, XP should be split among participants. Consider a bonus so each player gets slightly more than a pure split (e.g., 60% each for 2 players instead of 50%).

- [x] **Monster respawn system**: Monsters don't respawn after being killed. Need logic to re-spawn monsters after some time (either per-monster cooldown or periodic sweep that repopulates rooms).

- [ ] **UI overlap issue (intermittent)**: Room description overlapping with exits display. Not reproducible yet — only happened for one player. Need to investigate CSS/layout when it happens again.

## Party System Brainstorm (March 2026)

Ideas for party/group mechanics beyond just being in the same combat:

- [ ] **Follow mechanic**: `follow <player>` to auto-move when they move. `stop following` or `unfollow` to stop. Followers see "You follow Djim north." Edge cases: can't follow while in combat, blocked exits leave follower behind with message, chain following (A follows B follows C) probably allowed.

- [ ] **Shared vision**: Party members see each other's personal discoveries. If Djim found the hidden nook, party members can see it too while grouped. Non-party version: `show <feature> to <player>` (already in backlog).

- [ ] **HP visibility**: Party members see each other's HP in room description or via `party status`. Useful for knowing when to heal/help.

- [ ] **Party chat**: `ptell <message>` or `party say <message>` reaches all party members regardless of room. Consider range limit (region-based?) to avoid weirdness when crossing region boundaries.

- [ ] **Monster loot drops**: Monsters should drop loot when killed. Could be fixed drops per monster type, random from loot table, or both. Loot appears on corpse or ground. Foundation for shared loot feature.

- [ ] **Shared loot**: Option to auto-split gold/coins when picked up by party member. Or `party loot` mode where corpse items go to whoever needs them most. Requires monster loot drops first.

- [ ] **Buff sharing / Auras**: When status effects/buffs exist, some could affect the whole party (bard songs, paladin auras, protection spells). Requires temporary stat modifications and status effects systems first.

- [ ] **Revive/rescue**: Party members could have special options for downed allies - drag their corpse to safety, revive with penalty, stabilize to prevent XP loss, etc.

- [ ] **Party formation commands**: `party invite <player>`, `party accept`/`party decline`, `party leave`, `party kick <player>` (leader only), `party list` or `party` (show members/status), `party leader <player>` (transfer leadership).

## Magic System Design (March 2026)

Comprehensive magic system using INT stat. Replaces traditional spell slots with mana pool.

### Core Mechanics

**Mana Pool**

- `maxMana` = (INT modifier + 2) × level
- Mana regenerates passively: 1% of max per 18 seconds out of combat (~30 min to full)
- In combat: half speed (1% per 36 seconds, ~60 min to full)
- Minimum 1 point per tick
- Future: `meditate` command for faster regen while stationary

**HP Regeneration**

- 1% of max per 27 seconds out of combat (~45 min to full)
- In combat: half speed (1% per 54 seconds, ~90 min to full)
- Minimum 1 point per tick
- Future: resting/sleeping boosts regen rate

**Combat Changes**

- Natural 20 ALWAYS hits regardless of modifiers
- Natural 1 ALWAYS misses regardless of modifiers

### Spells (Initial Set)

**1. Arcane Bolt** (attack spell)

- Cost: 2-3 mana
- Damage: 1d4 + INT modifier
- Attack roll: d20 + INT mod + level/2 (high accuracy, not auto-hit)
- Ranged attack, no weapon needed
- Scaling: +1 missile per 4 levels (each missile rolls separately)
- Command: `cast bolt <target>` or `cast arcane bolt <target>`

**2. Mend** (healing spell)

- Cost: 4-5 mana
- Heals: 1d8 + INT modifier (or caster level, capped)
- Target: self or another player in room
- Command: `cast mend` (self) or `cast mend <player>`
- Future: group heal variant with higher cost, targets party in room

**3. Light** (utility, future)

- Cost: 1 mana
- Effect: illuminates dark areas
- Duration-based (5-10 minutes?)
- Requires dark areas to be meaningful
- Torches also shed light (item-based alternative)

**4. Shield** (defensive, future)

- Cost: 3 mana
- Effect: temporary AC bonus (+2 to +4?)
- Duration: either "until hit" (flat cost) or ongoing mana drain
- TBD: which approach feels better

### Spell Learning System

**INT determines capacity**: Higher INT mod = more spells you can know

- Formula: max known spells = INT modifier + 2 (minimum 1)

**Discovery-based learning**: Find spell books in libraries, then study them

- Spell books are features in library rooms (not inventory items)
- Use `study <book>` or `read <book>` to learn the spell
- Books are NOT consumed - anyone can learn from them
- Learning is instant (time-based learning backlogged for later)

**Proficiency through use**: Newly learned spells have failure chance

- Starting failure: 25%
- Decreases with successful casts
- Formula: `failure% = max(0, 25 - (successful_casts / 2))`
- Mastery at 50 successful casts (0% failure)
- Failed cast costs half mana

**Feature disambiguation**: When multiple features match the same command (e.g., "read book" in a room with multiple books), the system prompts "Read which one?" with a list of options.

**Spell minimum INT requirements**:

- Missile: 12
- Mend: 13
- Light (future): 12
- Shield (future): 14
- Fireball (future): 18
- Teleport (future): 40

### Database Schema (Proposed)

```
spells table:
- id, name, description, manaCost, damage, healing, effect, scaling, minInt

player_spells table:
- playerId, spellId, successfulCasts, learnedAt

players table additions:
- mana (current), maxMana
```

### Implementation Order

1. Add `mana` and `maxMana` to players schema ✅
2. Add mana regen system (passive background timer or on-action check) ✅
3. Add HP regen out of combat ✅
4. Implement natural 20/1 always hit/miss rule ✅
5. Create spells table and seed initial spells ✅
6. Create player_spells junction table ✅
7. Implement `cast <spell> [target]` command ✅
8. Implement arcane bolt spell ✅
9. Implement mend spell ✅
10. Add spell books as features in library, implement `study` command ✅
11. Add spell failure chance based on proficiency ✅
12. Add trigger aliases to spell books for "read book" / "read spellbook" disambiguation ✅

### Future Spell Ideas

- **Fireball**: AoE damage, hits all enemies in room
- **Invisibility**: Stealth bonus, breaks on attack
- **Teleport**: Return to town square or marked location
- **Detect Magic**: Reveal hidden magical items/features
- **Sleep**: Crowd control, puts weak enemies to sleep
- **Haste**: Temporary attack speed boost
- **Slow**: Debuff enemy attack speed

---

- [ ] **WIS → Perception/Discovery**: WIS modifier affects chance to notice hidden features, traps, or secrets. Could also affect saving throws against illusions or mind effects.

- [ ] **CHA → NPC interactions**: CHA modifier affects NPC disposition, shop prices, quest rewards, or persuasion checks. Could unlock special dialogue options.

- [ ] **Temporary stat modifications**: Add support for temporary buffs/debuffs with duration tracking. May need a `player_active_effects` table. Foundation for buff sharing/auras in party system.

- [ ] **Status effects system**: Create `statuses` table defining possible statuses (poisoned, stunned, blessed, etc.) with their effects. Some statuses affect movement/speech, others do periodic damage/healing, others modify stats temporarily. Need to revisit temporary stat mods when implementing. Foundation for party auras and buff sharing.

- [ ] **Session-based discoveries**: Some discoveries should be visible to all players (e.g., sweeping leaves reveals trapdoor to everyone). Current time-based reset is MVP approximation.

- [ ] **Show personal discovery to another player**: Add a `show <feature> to <player>` command that lets a player share their personal discovery with another player in the same room. Would add the feature/container ID to the target player's discovered list. Useful for cooperative exploration.

- [ ] **Property 21-23 (Socket tests)**: Defer socket room membership, disconnect state, and reconnection restoration property tests to integration testing phase. These require real socket connections and are better tested end-to-end.

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

- [ ] **Level-scaling regen duration**: At higher levels, the total time to regenerate from 0 to full HP/mana should take longer. Currently fixed at ~30 min mana, ~45 min HP out of combat. Could scale the interval based on level (e.g., +5% per level beyond 5) so high-level characters with larger pools don't regen disproportionately fast.

- [ ] **Underground region content**: Populate the cave system with new rooms, monsters (cave creatures like bats, cave spiders, blind fish), and features. The Cave Passage currently has blocked rubble that could be cleared to reveal deeper caves.

- [ ] **Swimming activity restrictions**: While swimming, players should not be able to: attack, equip/unequip items (except maybe head slot), pick up items from the ground, etc. Currently only movement is blocked.

- [ ] **Party system**: Allow players to form parties/groups. See "Party System Brainstorm" section for detailed feature list. Core features: party formation commands, follow mechanic, shared vision, HP visibility, party chat. Foundation for front/rear line positioning system.

- [ ] **Front/rear line positioning**: When in a party or group combat, combatants are positioned in front line or rear line based on their weapon type. Melee weapons = front line, ranged weapons = rear line. Melee attackers can only hit front line targets unless the front line is empty. Ranged attackers can hit either line. Flying monsters or those with ranged attacks (breath weapons, spitting) count as rear line. Adds tactical depth: protect your ranged attackers, focus down enemy front line to reach their casters. Requires party system first.

- [ ] **Monster group behavior**: Monsters in the same group (pack, patrol) all join combat when one is attacked, regardless of individual aggression levels. Ungrouped monsters in the room react differently: timid creatures might flee when combat starts nearby, neutral creatures ignore it, and only aggressive ones might opportunistically join. Could add a `groupId` field to monster instances and a `combatReaction` field to monster templates ("join", "flee", "ignore"). Creates more dynamic encounters — attack one wolf and the pack swarms you, but the nearby deer scatter.

## Feature Ideas

Ideas for future features that aren't fully fleshed out yet.

- [ ] **Echo Canyon/Chamber**: A location with natural rock formations that create echoes. Could have a flavor feature where players can "shout" or "yell" and hear their voice echo back with atmospheric text. Maybe the echo reveals something hidden, or attracts attention (friendly or hostile). Could tie into the sound/listen verb category.
