# Completed Backlog Items

Items that were in the backlog and have been completed.

- [x] **Discovered containers in room description**: When a hidden container is revealed, show it in the room description. Implementation: Add `revealedText` field to containers (e.g., "Under the root of a nearby tree you see a leather pouch."). Split room descriptions into main description + navigation sentence (last sentence). When rendering, concatenate: main description + revealed container texts + navigation sentence. This keeps discovered things naturally woven into the description rather than listed separately.

- [x] **Put items in containers**: Add `put <item> in <container>` command to move items from player inventory into an open container in the room.

- [x] **Better "get" error for non-items**: When player tries to `get <feature>` or `get <container>`, reply "You can't take that." instead of "There's no X here." Checks visible features and containers in the room before returning the generic "not found" message.

- [x] **Add small features**: Added 19 interactive features across all 5 rooms - Town Square (fountain, statue, moss, cobblestones), Rusty Tankard (fireplace, oak counter, mounted trophy, dartboard), Village Market (merchant stalls → loose board → hidden compartment chain, spice barrels, notice board), Forest Path (ancient oaks, rustling undergrowth, trail markers), Forest Clearing (mushroom ring → hidden cache chain, gnarled tree, soft moss, strange sounds). Standardized trigger verbs documented in backlog.

- [x] **Multiple simultaneous attackers**: Allow multiple monsters to attack a player at once. Implemented staggered engagement: first monster attacks after 3-5 seconds, additional monsters join every 3-5 seconds. Flee mechanics use highest-level monster for DC (already implemented). Added `clearPendingAggro()` to cancel pending attacks when player leaves room or disconnects. Modified `initiateCombat()` to allow monsters to join existing player combat via `addMonsterToCombat()` helper.

- [x] **iPad/mobile testing**: Set up ngrok tunneling for mobile device testing. Added `client/.env.example` with `VITE_API_URL` and `VITE_SOCKET_URL` variables. Created `MOBILE_TESTING.md` with step-by-step instructions. Updated server CORS to allow ngrok origins and local network IPs.

- [x] **Virtual scrolling**: Added @tanstack/react-virtual to ChatPanel for efficient rendering of large message lists. Uses dynamic row measurement for variable-height messages, preserves smart auto-scroll behavior (only scrolls when user is at bottom), and renders ~5 overscan items above/below viewport for smooth scrolling.

- [x] **Item and container sizes**: Added t-shirt size system (tiny=0, small=1, medium=2, large=3, huge=4) to items and containers. Items can only be placed in containers where `item.size < container.size`. Players cannot take huge items. Added `size` field to both `items` and `containers` tables in schema. Updated seed data with appropriate sizes (coins=tiny, potions=small, swords=medium, greatswords=large). Deferred portable container implementation (isContainer, itemInventory table) to later.
