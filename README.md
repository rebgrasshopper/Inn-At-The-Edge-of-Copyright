# Inn at the Edge of Copyright

A text-based MUD (Multi-User Dungeon) game with Pathfinder RPG vibes. Explore a virtual world, interact with other players, collect items, and discover secrets.

## Features

- Real-time multiplayer via WebSocket
- Text-based exploration with room descriptions
- Item system (get, drop, examine, equip)
- Chat system (speak, shout, whisper, emote)
- Interactive room features with effects
- Equipment slots and character stats
- Hidden containers and discoverable secrets

## Tech Stack

- TypeScript + Node.js backend
- Express + Socket.io for real-time communication
- React + Vite frontend
- SQLite + Drizzle ORM for persistence
- Vitest + fast-check for testing

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Set up environment
cp .env.example .env
# Edit .env with your JWT_SECRET

# Initialize database
npx drizzle-kit push
npm run db:seed
```

### Development

```bash
# Start both server and client
npm run dev
```

- Server runs on http://localhost:3000
- Client runs on http://localhost:5173

### Production Build

```bash
npm run build
npm start
```

## Game Commands

### Movement

- `north`, `south`, `east`, `west`, `up`, `down` (or `n`, `s`, `e`, `w`, `u`, `d`)
- `go <direction>`

### Communication

- `say <message>` - Speak to everyone in the room
- `shout <message>` - Shout to the entire region
- `whisper <player> <message>` - Private message
- `emote <action>` - Describe an action

### Items

- `get <item>` - Pick up an item
- `drop <item>` - Drop an item
- `examine <item>` - Look at an item closely
- `inventory` - List what you're carrying

### Equipment

- `equip <item>` - Equip an item
- `unequip <item>` - Remove equipped item
- `equipment` - Show equipped items

### Information

- `look` - Look around the room
- `stats` - View your character stats
- `examine self` - View your character details
- `help` - Show available commands

### Features

- Interact with room features using verbs like `drink fountain`, `search mushrooms`

## Project Structure

```
├── src/
│   ├── db/           # Database schema and migrations
│   ├── routes/       # REST API endpoints
│   ├── services/     # Business logic
│   ├── socket/       # Socket.io handlers
│   └── types/        # TypeScript type definitions
├── client/           # React frontend
├── tests/
│   ├── unit/         # Unit tests
│   ├── property/     # Property-based tests
│   └── generators/   # Test data generators
└── scripts/          # Utility scripts
```

## Testing

```bash
# Run all tests
npm test -- --run

# Run with watch mode
npm test

# Run e2e tests (requires server running)
npx tsx scripts/e2e-test.ts
```

## Environment Variables

| Variable       | Description           | Default     |
| -------------- | --------------------- | ----------- |
| `PORT`         | Server port           | 3000        |
| `DATABASE_URL` | SQLite database path  | game.db     |
| `JWT_SECRET`   | Secret for JWT tokens | (required)  |
| `NODE_ENV`     | Environment mode      | development |

## Deployment (Fly.io)

### Prerequisites

1. Install the Fly CLI: https://fly.io/docs/hands-on/install-flyctl/
2. Sign up/login: `fly auth login`

### First-time Setup

```bash
# Create the app (uses fly.toml config)
fly launch --no-deploy

# Create persistent volume for SQLite database
fly volumes create mud_data --size 1 --region iad

# Set production secrets
fly secrets set JWT_SECRET=$(openssl rand -base64 32)

# Deploy
fly deploy

# Seed the database (first time only)
fly ssh console -C "cd /app && node dist/db/seed.js"
```

### Subsequent Deployments

```bash
fly deploy
```

### Useful Commands

```bash
# View logs
fly logs

# SSH into the running app
fly ssh console

# Check app status
fly status

# Open the app in browser
fly open
```

## License

[GNU General Public License V3](LICENSE)

---

_Originally created by the Inn at the Edge of Copyright team. Rebuilt with modern tooling._
