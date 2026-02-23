# Completed Backlog Items

Items that were in the backlog and have been completed.

- [x] **Discovered containers in room description**: When a hidden container is revealed, show it in the room description. Implementation: Add `revealedText` field to containers (e.g., "Under the root of a nearby tree you see a leather pouch."). Split room descriptions into main description + navigation sentence (last sentence). When rendering, concatenate: main description + revealed container texts + navigation sentence. This keeps discovered things naturally woven into the description rather than listed separately.

- [x] **Put items in containers**: Add `put <item> in <container>` command to move items from player inventory into an open container in the room.

- [x] **Better "get" error for non-items**: When player tries to `get <feature>` or `get <container>`, reply "You can't take that." instead of "There's no X here." Checks visible features and containers in the room before returning the generic "not found" message.
