# MUD Game Project Context

## Workflow Preferences

- Always discuss and get agreement on implementation details before writing code
- For new features or changes, propose the approach first and wait for confirmation
- Don't assume — ask clarifying questions when the scope or details are ambiguous

## Backlog Management

- Backlog items live in `.kiro/specs/mud-game-rebuild/backlog.md`
- Completed backlog items move to `.kiro/specs/mud-game-rebuild/backlog-completed.md`
- When completing a backlog item, move it from `backlog.md` to `backlog-completed.md` and mark it `[x]`
- The main `tasks.md` file is for the structured implementation checklist only

## Project Goal

Building a MUD (multi-user dungeon) game as a learning project for AI-assisted coding — exploring "vibe coding" or pair programming with AI rather than just using autocomplete.

## Core Requirements

### UI

- Simple chat-based interface: a box with chat logs and an input field
- Clean, nice-looking design but minimal complexity
- Future enhancements might include character panel, inventory display, etc.
- Chat history persists across room changes (scrollable)

### Gameplay

- Pathfinder RPG vibe (tabletop RPG system by Paizo)
- Text-based virtual world exploration
- "Rooms" represent locations (indoor or outdoor, like a forest section)
- Live interaction with other players and NPCs/monsters
- Item interaction (get, drop, use, etc.)
- Movement between rooms/locations

### Multiplayer

- Chat room-like experience per location
- See and interact with players/NPCs in your current room
- Real-time updates via WebSocket

## Technical Preferences

- TypeScript and Node.js wherever possible
- WebSocket/Socket.io for real-time features (user needs guidance here)
- Balance cost and maintainability
- Target: under $5/month hosting
- Must be stable for periods of inactivity (no frequently-deprecated infrastructure)
- Avoid free tiers with inconvenient limits

## Reference Codebase

This workspace contains an old MUD project built when the user was learning to code. It's offered as reference for understanding desired features, but:

- Code is outdated and doesn't run due to dependency issues
- Feel free to suggest modern approaches and libraries
- Can lift convenient pieces but not obligated to follow its patterns
- User didn't write the Socket.io portions and needs guidance there

## Key Files to Understand (from old project)

- `client/` - React frontend
- `controllers/` - Game logic (NPCs, monsters, quests, fighting, etc.)
- `models/` - Data models
- `routes/` - API endpoints
- `server.js` - Main server entry point

## Old Project Architecture Summary

### Tech Stack (circa 2020-2021)

- Express + Socket.io 3.x server
- React 17 with Auth0 for authentication
- MongoDB/Mongoose for persistence
- Heroku deployment

### Data Models

- Player: stats (WIS, DEX, STR, HP, CHA, XP, level), inventory, quests, tokens, worn items, race/profession
- Location: day/night descriptions, exits (directional), NPCs, inventory, discoverables, fightables, region
- Item: stats effects, edible flag, equippable slots
- Quest: objectives with tokens, XP rewards
- Dialog: NPC conversation trees
- Action: help text for commands

### Socket Events (key ones)

- Connection/disconnect with player state management
- Movement between rooms (join/leave socket rooms per location)
- Chat: speak (room), shout (region-wide), whisper (private/NPC)
- Combat: attackCreature, battle, battleVictory
- Items: get, drop, give, eat, wear, remove
- Quests: assignQuest, updatePlayerQuest
- NPCs: conversation routing via Dialog model

### Command System

Client-side parsing in InputPanel.js with action keywords:

- Movement: move, walk, go, exit + direction
- Communication: speak, shout, whisper, emote
- Items: get, drop, give, wear, remove, eat, examine
- Combat: attack, fight, kill
- Info: look, inventory, stats, help, quests
- State: sleep, wake, position (sit/stand/lie)

### Notable Features

- Day/night cycle affecting descriptions
- Region-based shouting
- NPC conversation system with routes
- Discoverables (location-specific interactive elements)
- Monster spawning/sweeping intervals
- Juggling minigame with DEX progression
