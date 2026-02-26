# Completed Backlog Items

Items that were in the backlog and have been completed.

- [x] **Discovered containers in room description**: When a hidden container is revealed, show it in the room description. Implementation: Add `revealedText` field to containers (e.g., "Under the root of a nearby tree you see a leather pouch."). Split room descriptions into main description + navigation sentence (last sentence). When rendering, concatenate: main description + revealed container texts + navigation sentence. This keeps discovered things naturally woven into the description rather than listed separately.

- [x] **Put items in containers**: Add `put <item> in <container>` command to move items from player inventory into an open container in the room.

- [x] **Better "get" error for non-items**: When player tries to `get <feature>` or `get <container>`, reply "You can't take that." instead of "There's no X here." Checks visible features and containers in the room before returning the generic "not found" message.

- [x] **Add small features**: Added 19 interactive features across all 5 rooms - Town Square (fountain, statue, moss, cobblestones), Rusty Tankard (fireplace, oak counter, mounted trophy, dartboard), Village Market (merchant stalls → loose board → hidden compartment chain, spice barrels, notice board), Forest Path (ancient oaks, rustling undergrowth, trail markers), Forest Clearing (mushroom ring → hidden cache chain, gnarled tree, soft moss, strange sounds). Standardized trigger verbs documented in backlog.

- [x] **Multiple simultaneous attackers**: Allow multiple monsters to attack a player at once. Implemented staggered engagement: first monster attacks after 3-5 seconds, additional monsters join every 3-5 seconds. Flee mechanics use highest-level monster for DC (already implemented). Added `clearPendingAggro()` to cancel pending attacks when player leaves room or disconnects. Modified `initiateCombat()` to allow monsters to join existing player combat via `addMonsterToCombat()` helper.
